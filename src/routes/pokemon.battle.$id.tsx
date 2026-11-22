import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FastForward } from "lucide-react";
import { ActionPanel, BattleLog, BattleScene, ResultOverlay, Roster, VsIntro, type LogLine } from "@/components/pokemon/arena";
import { Sprite, useInterval, useT } from "@/components/pokemon/ui";
import { Avatar } from "@/components/members/avatar";
import { MusicPanel } from "@/components/pokemon/music-panel";
import { TypeIcons } from "@/components/pokemon/type-icons";
import {
  claimTimeout,
  createBattle,
  forfeitBattle,
  getBattle,
  pokeMoveInfo,
  submitChoice,
  type BattleReply,
  type BattleView,
} from "@/lib/pokemon-api";
import { battleAudio } from "@/lib/pokemon/audio";
import { applyLine, hpPercent, initialState, replayAll, unknownMoves, type BState, type Cue } from "@/lib/pokemon/protocol";
import { pickAutoTrack } from "@/lib/pokemon/tracks";
import { ARENAS, arenaForBattle, formatByGen, guessSpriteId, type MoveInfo } from "@/lib/pokemon/shared";

export const Route = createFileRoute("/pokemon/battle/$id")({
  loader: ({ params }) => getBattle({ data: { id: Number(params.id), since: 0 } }),
  component: BattlePage,
});

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function BattlePage() {
  const first = Route.useLoaderData() as BattleReply;
  if (first.unchanged) return null;
  return <Arena key={first.id} initial={first} />;
}

function Arena({ initial }: { initial: BattleView }) {
  const { t, te, lang } = useT();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<BattleView>(initial);
  const [bstate, setBstate] = useState<BState>(initialState());
  const [log, setLog] = useState<LogLine[]>([]);
  const [cue, setCue] = useState<Cue | null>(null);
  const [animating, setAnimating] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 0>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [intro, setIntro] = useState(false);
  const [arena, setArena] = useState<string>("auto");
  useEffect(() => {
    try {
      setArena(window.localStorage.getItem("pk-arena") || "auto");
    } catch {
      /* private mode: keep auto */
    }
  }, []);
  const pickArena = (v: string) => {
    setArena(v);
    try {
      window.localStorage.setItem("pk-arena", v);
    } catch {
      /* ignore */
    }
  };
  const pendingIngest = useRef<(() => void) | null>(null);

  const metaRef = useRef(meta);
  const stateRef = useRef<BState>(initialState());
  const queue = useRef<{ line: string; animate: boolean }[]>([]);
  const running = useRef(false);
  const seen = useRef(0);
  const logId = useRef(0);
  const moves = useRef<Record<string, MoveInfo>>({ ...initial.moves });
  const speedRef = useRef(speed);
  const langRef = useRef(lang);
  const polling = useRef(false);
  speedRef.current = speed;
  langRef.current = lang;

  const ctx = () => ({ lang: langRef.current, moves: moves.current, sprites: metaRef.current.sprites, you: metaRef.current.you });
  const pushLog = (texts: string[]) => {
    if (!texts.length) return;
    setLog((l) => [...l, ...texts.map((text) => ({ id: ++logId.current, text }))].slice(-300));
  };

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setAnimating(true);
    try {
      // Learn the type of any move we have not seen, so its effect gets the right colour.
      const need = unknownMoves(
        queue.current.filter((q) => q.animate).map((q) => q.line),
        moves.current,
      );
      if (need.length) {
        try {
          Object.assign(moves.current, await pokeMoveInfo({ data: { gen: metaRef.current.gen, names: need } }));
        } catch {
          /* effects just use a neutral colour */
        }
      }
      while (queue.current.length) {
        const item = queue.current.shift()!;
        const step = applyLine(stateRef.current, item.line, ctx());
        stateRef.current = step.state;
        setBstate(step.state);
        pushLog(step.say);
        const fast = !item.animate || speedRef.current === 0;
        if (!fast && step.cue) {
          setCue(step.cue);
          battleAudio.cue(step.cue, step.state, metaRef.current.you);
        }
        if (item.animate) {
          const sd = metaRef.current.you ?? "p1";
          const mon = step.state.sides[sd].active;
          battleAudio.lowHp(!!mon && !mon.fainted && !step.state.ended && hpPercent(mon) <= 20);
          if (step.cue?.kind === "win") {
            const you = metaRef.current.you;
            const winnerSide = step.state.sides.p1.name === step.cue.text ? "p1" : step.state.sides.p2.name === step.cue.text ? "p2" : null;
            battleAudio.finish(!winnerSide ? "draw" : !you || winnerSide === you ? "win" : "lose");
          }
        }
        if (!fast && step.wait) await sleep(step.wait / speedRef.current);
      }
    } finally {
      running.current = false;
      setAnimating(false);
      if (stateRef.current.ended) window.setTimeout(() => setShowResult(true), 700);
    }
  }, []);

  /** Takes in what the server sent: new log lines (to play), and the current situation. */
  const ingest = useCallback(
    (v: BattleView, animate: boolean) => {
      metaRef.current = v;
      setMeta(v);
      Object.assign(moves.current, v.moves);
      if (v.lines.length) {
        seen.current = v.total;
        if (animate) {
          queue.current.push(...v.lines.map((line) => ({ line, animate: true })));
          void drain();
        } else {
          const r = replayAll(v.lines, ctx(), stateRef.current);
          stateRef.current = r.state;
          setBstate(r.state);
          pushLog(r.say);
          if (r.state.ended) setShowResult(true);
        }
      } else {
        seen.current = Math.max(seen.current, v.total);
      }
    },
    [drain],
  );

  // First load: a finished battle (or a brand-new one) is played from the start, after a short VS splash;
  // one already in progress jumps straight to now.
  // Music: pick the theme, start on the first tap or key press, and let go of the sound device when leaving.
  useEffect(() => {
    if (initial.status === "invited") return;
    battleAudio.setAuto(pickAutoTrack({ id: initial.id, cpu: initial.cpu, cpuLevel: initial.cpuLevel }));
    const go = () => void battleAudio.unlock();
    go();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      battleAudio.stopAll();
    };
  }, [initial.id, initial.status, initial.cpu, initial.cpuLevel]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initial.status === "done" || initial.turn <= 1) {
      setIntro(true);
      pendingIngest.current = () => ingest(initial, true);
    } else ingest(initial, false);
  }, [initial, ingest]);
  const finishIntro = useCallback(() => {
    setIntro(false);
    const go = pendingIngest.current;
    pendingIngest.current = null;
    go?.();
  }, []);

  const poll = useCallback(async () => {
    const m = metaRef.current;
    if (polling.current || running.current || pendingIngest.current || m.status === "done") return;
    polling.current = true;
    try {
      const r = await getBattle({ data: { id: m.id, since: seen.current, rev: m.rev } });
      if (!r.unchanged) ingest(r, true);
    } catch {
      /* try again next tick */
    } finally {
      polling.current = false;
    }
  }, [ingest]);
  useInterval(() => void poll(), meta.waitingFor === "you" ? 5000 : 2000, meta.status !== "done");

  const act = async (fn: () => Promise<BattleView>) => {
    setBusy(true);
    setErr("");
    try {
      ingest(await fn(), true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };
  const onChoose = (choice: string) => void act(() => submitChoice({ data: { id: meta.id, choice, since: seen.current } }));
  const onForfeit = () => void act(() => forfeitBattle({ data: { id: meta.id, since: seen.current } }));
  const onClaim = () => void act(() => claimTimeout({ data: { id: meta.id, since: seen.current } }));

  const onReplay = async () => {
    if (running.current) return;
    setShowResult(false);
    battleAudio.restart();
    stateRef.current = initialState();
    setBstate(stateRef.current);
    setLog([]);
    setCue(null);
    try {
      const full = await getBattle({ data: { id: meta.id, since: 0 } });
      if (full.unchanged) return;
      seen.current = full.total;
      queue.current.push(...full.lines.map((line) => ({ line, animate: true })));
      void drain();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  };

  const onRematch = async () => {
    if (!meta.cpu || !meta.mySets) return;
    setBusy(true);
    try {
      const r = await createBattle({ data: { gen: meta.gen, mode: "cpu", cpuLevel: meta.cpuLevel ?? "normal", team: { kind: "random", size: meta.mySets.length } } });
      await navigate({ to: "/pokemon/battle/$id", params: { id: String(r.id) } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
      setBusy(false);
    }
  };

  const you = meta.you;
  const fmt = formatByGen(meta.gen);
  const names = meta.names;
  const mineSide = you ?? "p1";
  const foeSide = mineSide === "p1" ? "p2" : "p1";

  if (meta.status === "invited") {
    return (
      <section className="mx-auto max-w-xl px-5 py-20 text-center">
        <p className="pk-ball" style={{ fontSize: 48 }} aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl">{you === "p1" ? t(`${names.p2}-এর উত্তরের অপেক্ষা…`, `Waiting for ${names.p2} to answer…`) : t("এই চ্যালেঞ্জের উত্তর লবি থেকে দিন", "Answer this challenge from the lobby")}</h1>
        <Link to="/pokemon" className="pressable mt-6 inline-block rounded-full border border-border bg-surface px-5 py-2 font-sans text-sm">{t("লবিতে ফিরুন", "Back to lobby")}</Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-3 font-sans text-sm">
        <Link to="/pokemon" className="pressable inline-flex items-center gap-1.5 text-muted hover:text-fg"><ArrowLeft className="size-4" /> {t("লবি", "Lobby")}</Link>
        <span className="flex items-center gap-2">
          <Avatar name={names.p1} url={meta.people.p1?.avatarUrl} size={26} />
          <b>{names.p1}</b>
          <span className="text-subtle">⚔</span>
          <Avatar name={names.p2} url={meta.people.p2?.avatarUrl} size={26} />
          <b>{names.p2}</b>
        </span>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{t(fmt.bn, fmt.en)} · {t("টার্ন", "Turn")} {Math.max(bstate.turn, 0)}</span>
        {meta.status === "done" ? <span className="rounded-full bg-lamp/20 px-2.5 py-0.5 text-xs text-lamp">{t("শেষ", "Finished")}</span> : null}
        <span className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <MusicPanel />
          <label className="flex items-center gap-1">
            🎨
            <select value={arena} onChange={(e) => pickArena(e.target.value)} className="rounded-full border border-border bg-bg px-2 py-0.5 text-fg" aria-label={t("আরেনা", "Arena")}>
              <option value="auto">{t("অটো (প্রতিবার আলাদা)", "Auto (varies each battle)")}</option>
              {ARENAS.map((a) => (
                <option key={a.id} value={a.id}>{a.emoji} {t(a.bn, a.en)}</option>
              ))}
            </select>
          </label>
          {t("গতি", "Speed")}
          {([1, 2] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSpeed(s)} className={`pressable rounded-full border px-2.5 py-0.5 ${speed === s ? "border-lamp bg-surface-2 text-fg" : "border-border"}`}>{s}×</button>
          ))}
          <button type="button" title={t("এগিয়ে যান", "Skip animations")} onClick={() => setSpeed(0)} className={`pressable rounded-full border px-2 py-0.5 ${speed === 0 ? "border-lamp bg-surface-2 text-fg" : "border-border"}`}><FastForward className="size-3.5" /></button>
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative lg:col-start-1 lg:row-start-1">
          <BattleScene state={bstate} you={you} sprites={meta.sprites} cue={cue} theme={arena === "auto" ? arenaForBattle(meta.id) : Number(arena)}>
            {intro ? <VsIntro names={names} people={meta.people} you={you} onDone={finishIntro} /> : null}
            {showResult && meta.status === "done" ? <ResultOverlay view={meta} state={bstate} onReplay={() => void onReplay()} onRematch={meta.cpu && meta.mySets ? () => void onRematch() : undefined} /> : null}
          </BattleScene>
        </div>

        <div className="space-y-3 lg:col-start-1 lg:row-start-2">
          <div className="flex flex-wrap justify-between gap-3">
            <Roster state={bstate} side={mineSide} you={you} />
            <Roster state={bstate} side={foeSide} you={you} />
          </div>
          {err ? <p className="rounded-lg border border-nsfw/40 bg-nsfw/10 px-3 py-2 font-sans text-sm text-nsfw">{te(err)}</p> : null}
          {meta.status === "done" ? (
            <div className="pk-card p-4">
              <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
                {meta.winner && meta.winner !== "tie" ? <b>🏆 {names[meta.winner]}</b> : <b>🤝</b>}
                <button type="button" onClick={() => void onReplay()} className="pressable rounded-full border border-border bg-surface-2 px-3 py-1">↺ {t("রিপ্লে", "Replay")}</button>
                {meta.teams.p1 || meta.teams.p2 ? (
                  <button type="button" onClick={() => setShowTeams((v) => !v)} className="pressable rounded-full border border-border bg-surface-2 px-3 py-1">{showTeams ? "▾" : "▸"} {t("টিম দেখুন", "Show teams")}</button>
                ) : null}
              </div>
              {showTeams ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {([["p1", names.p1], ["p2", names.p2]] as const).map(([side, nm]) => {
                    const sets = meta.teams[side];
                    return (
                      <div key={side}>
                        <p className="mb-1 font-sans text-xs text-muted">{nm}</p>
                        <ul className="space-y-1 font-sans text-xs">
                          {(sets ?? []).map((s, i) => (
                            <li key={i} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1">
                              <Sprite info={meta.sprites[s.species] ?? { id: guessSpriteId(s.species), num: 0, types: [] }} still className="size-8 object-contain" />
                              <span><b>{s.species}</b> <TypeIcons types={meta.sprites[s.species]?.types ?? []} size={14} className="align-middle" />{s.item ? ` @ ${s.item}` : ""}<br /><span className="text-muted">{s.moves.join(" · ")}</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <ActionPanel className="lg:col-start-2 lg:row-start-1 lg:self-start" view={meta} state={bstate} moves={moves.current} sprites={meta.sprites} busy={busy} locked={animating || intro} onChoose={onChoose} onForfeit={onForfeit} onClaim={onClaim} />
        <div className={meta.status === "done" || !you ? "lg:col-start-2 lg:row-span-2 lg:row-start-1" : "lg:col-start-2 lg:row-start-2"}>
          <BattleLog lines={log} />
        </div>
      </div>
    </section>
  );
}
