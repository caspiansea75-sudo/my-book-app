import { useCallback, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, Dices, Swords, Users } from "lucide-react";
import { Avatar } from "@/components/members/avatar";
import { PokeHeader, useInterval, useT } from "@/components/pokemon/ui";
import { answerChallenge, cancelChallenge, createBattle, engineStatus, lobby, type BattleListItem, type Invite, type LobbyData } from "@/lib/pokemon-api";
import { CPU_LEVELS, FORMATS, formatByGen, type CpuLevel } from "@/lib/pokemon/shared";

export const Route = createFileRoute("/pokemon/")({
  loader: async () => {
    const [data, engine] = await Promise.all([lobby(), engineStatus()]);
    return { data, engine };
  },
  component: LobbyPage,
});

type TeamChoice = { kind: "random"; size: number } | { kind: "saved"; id: number };

function LobbyPage() {
  const initial = Route.useLoaderData();
  const { t, te } = useT();
  const navigate = useNavigate();
  const [data, setData] = useState<LobbyData>(initial.data);
  const [gen, setGen] = useState(9);
  const [mode, setMode] = useState<"cpu" | "pvp">("cpu");
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>("normal");
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [team, setTeam] = useState<TeamChoice>({ kind: "random", size: 6 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      setData(await lobby());
    } catch {
      /* keep what we have */
    }
  }, []);
  useInterval(() => void refresh(), 6000);

  const fmt = formatByGen(gen);
  const teamsForGen = data.teams.filter((x) => x.gen === gen);
  const chosenTeam: TeamChoice = team.kind === "saved" && !teamsForGen.some((x) => x.id === team.id) ? { kind: "random", size: 6 } : team;

  async function start() {
    setErr("");
    if (mode === "pvp" && !opponentId) return setErr(t("প্রতিপক্ষ বেছে নিন", "Pick an opponent"));
    setBusy(true);
    try {
      const r = await createBattle({ data: { gen, mode, cpuLevel, opponentId: opponentId ?? undefined, team: chosenTeam } });
      if (r.status === "active") await navigate({ to: "/pokemon/battle/$id", params: { id: String(r.id) } });
      else {
        await refresh();
        setErr("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  const live = data.battles.filter((b) => b.status !== "done");
  const done = data.battles.filter((b) => b.status === "done").slice(0, 8);

  return (
    <>
      <PokeHeader
        title={t("পোকেমন অ্যারেনা", "Pokémon Arena")}
        sub={t(
          "আসল পোকেমন শোডাউন ইঞ্জিনে চলা লড়াই — আসল ড্যামেজ ফর্মুলা, সব চাল, অ্যাবিলিটি, আইটেম আর মেগা / জেড-মুভ / ডায়ানাক্স / টেরা। সদস্যদের চ্যালেঞ্জ করুন, কিংবা CPU-র সাথে প্র্যাকটিস করুন।",
          "Battles run on the real Pokémon Showdown engine — true damage formula, every move, ability and item, plus Mega / Z-Move / Dynamax / Tera. Challenge members or practise against the CPU.",
        )}
      />
      <section className="mx-auto max-w-5xl space-y-6 px-5 pb-20 pt-6 sm:px-8">
        {!initial.engine.ok ? <p className="pk-card border-nsfw/50 p-4 font-sans text-sm text-nsfw">{te(initial.engine.error)}</p> : null}

        {data.invites.length ? (
          <div className="space-y-3">
            {data.invites.map((inv) => (
              <InviteCard key={inv.id} inv={inv} teams={data.teams.filter((x) => x.gen === inv.gen)} onDone={refresh} />
            ))}
          </div>
        ) : null}

        <div className="pk-card p-5">
          <h2 className="font-display text-xl">⚔️ {t("নতুন লড়াই", "New battle")}</h2>

          <p className="mt-4 font-sans text-xs text-muted">{t("১. জেনারেশন (গিমিক)", "1. Generation (gimmick)")}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
            {FORMATS.map((f) => (
              <button key={f.gen} type="button" onClick={() => setGen(f.gen)} className={`pressable rounded-xl border px-2 py-2 font-sans text-sm ${gen === f.gen ? "border-lamp bg-surface-2 text-fg shadow-soft" : "border-border bg-bg text-muted"}`}>
                <b className="block">{t(f.bn, f.en)}</b>
                <span className="text-lg">{f.gimmick === "tera" ? "💎" : f.gimmick === "dynamax" ? "🔴" : f.gimmick === "mega-z" ? "🧬✨" : f.gimmick === "mega" ? "🧬" : "🎮"}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 font-sans text-xs text-muted">{t("এই জেনারেশনে: ", "In this generation: ")}<b className="text-fg">{t(fmt.gimmickBn, fmt.gimmickEn)}</b></p>

          <p className="mt-5 font-sans text-xs text-muted">{t("২. প্রতিপক্ষ", "2. Opponent")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill on={mode === "cpu"} onClick={() => setMode("cpu")}><Bot className="size-4" /> CPU</Pill>
            <Pill on={mode === "pvp"} onClick={() => setMode("pvp")}><Users className="size-4" /> {t("সদস্য", "A member")}</Pill>
          </div>
          {mode === "cpu" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 font-sans text-xs text-muted">
              {t("কঠিনতা:", "Difficulty:")}
              {CPU_LEVELS.map((l) => (
                <Pill key={l.id} on={cpuLevel === l.id} onClick={() => setCpuLevel(l.id)}>{t(l.bn, l.en)}</Pill>
              ))}
            </div>
          ) : (
            <label className="mt-3 block font-sans text-xs text-muted">
              {t("কাকে চ্যালেঞ্জ করবেন?", "Who do you want to challenge?")}
              <select value={opponentId ?? ""} onChange={(e) => setOpponentId(Number(e.target.value) || null)} className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg sm:w-72">
                <option value="">—</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>{m.displayName} (@{m.username})</option>
                ))}
              </select>
            </label>
          )}

          <p className="mt-5 font-sans text-xs text-muted">{t("৩. আপনার টিম", "3. Your team")}</p>
          <TeamPicker gen={gen} teams={teamsForGen} value={chosenTeam} onChange={setTeam} />

          {err ? <p className="mt-3 font-sans text-sm text-nsfw">{te(err)}</p> : null}
          <button type="button" disabled={busy} onClick={() => void start()} className="pressable mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 font-sans text-sm font-semibold text-accent-fg disabled:opacity-60">
            <Swords className="size-4" /> {mode === "pvp" ? t("চ্যালেঞ্জ পাঠান", "Send challenge") : t("লড়াই শুরু!", "Start battle!")}
          </button>
        </div>

        {live.length ? (
          <div>
            <h2 className="mb-3 font-display text-xl">{t("চলমান লড়াই", "In progress")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {live.map((b, i) => (
                <BattleRow key={b.id} b={b} i={i} onChanged={refresh} />
              ))}
            </ul>
          </div>
        ) : null}

        {done.length ? (
          <div>
            <h2 className="mb-3 font-display text-xl">{t("সাম্প্রতিক ফলাফল", "Recent results")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {done.map((b, i) => (
                <BattleRow key={b.id} b={b} i={i} onChanged={refresh} />
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`pressable inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 font-sans text-sm ${on ? "border-lamp bg-surface-2 text-fg" : "border-border bg-bg text-muted hover:text-fg"}`}>
      {children}
    </button>
  );
}

function TeamPicker({ gen, teams, value, onChange }: { gen: number; teams: LobbyData["teams"]; value: TeamChoice; onChange: (v: TeamChoice) => void }) {
  const { t } = useT();
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Pill on={value.kind === "random"} onClick={() => onChange({ kind: "random", size: value.kind === "random" ? value.size : 6 })}>
          <Dices className="size-4" /> {t("র‍্যান্ডম টিম", "Random team")}
        </Pill>
        {value.kind === "random" ? (
          <label className="flex items-center gap-2 font-sans text-xs text-muted">
            {t("কয়টি পোকেমন", "Size")}
            <select value={value.size} onChange={(e) => onChange({ kind: "random", size: Number(e.target.value) })} className="rounded-md border border-border bg-bg px-2 py-1 text-fg">
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {teams.length ? (
        <label className="block font-sans text-xs text-muted">
          {t("অথবা সেভ করা টিম (জেন ", "Or a saved team (Gen ")}{gen})
          <select
            value={value.kind === "saved" ? value.id : ""}
            onChange={(e) => (e.target.value ? onChange({ kind: "saved", id: Number(e.target.value) }) : onChange({ kind: "random", size: 6 }))}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg sm:w-72"
          >
            <option value="">—</option>
            {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name} ({tm.sets.length})</option>)}
          </select>
        </label>
      ) : (
        <p className="font-sans text-xs text-subtle">
          {t("এই জেনারেশনের কোনো সেভ করা টিম নেই — ", "No saved team for this generation — ")}
          <Link to="/pokemon/team" className="text-lamp underline-offset-4 hover:underline">{t("টিম বানান", "build one")}</Link>
        </p>
      )}
    </div>
  );
}

function InviteCard({ inv, teams, onDone }: { inv: Invite; teams: LobbyData["teams"]; onDone: () => Promise<void> }) {
  const { t, te } = useT();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamChoice>({ kind: "random", size: 6 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fmt = formatByGen(inv.gen);
  async function answer(accept: boolean) {
    setBusy(true);
    setErr("");
    try {
      const r = await answerChallenge({ data: { id: inv.id, accept, team: accept ? team : undefined } });
      if (r.status === "active") await navigate({ to: "/pokemon/battle/$id", params: { id: String(r.id) } });
      else await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pk-card pk-pulse-badge border-lamp p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={inv.from.displayName} url={inv.from.avatarUrl} size={36} />
        <p className="font-sans text-sm">
          <b>{inv.from.displayName}</b> {t("আপনাকে চ্যালেঞ্জ করেছে!", "challenged you!")} <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{t(fmt.bn, fmt.en)} · {t(fmt.gimmickBn, fmt.gimmickEn)}</span>
        </p>
      </div>
      <TeamPicker gen={inv.gen} teams={teams} value={team} onChange={setTeam} />
      {err ? <p className="mt-2 font-sans text-sm text-nsfw">{te(err)}</p> : null}
      <div className="mt-3 flex gap-2 font-sans text-sm">
        <button type="button" disabled={busy} onClick={() => void answer(true)} className="pressable rounded-full bg-accent px-5 py-2 text-accent-fg">⚔️ {t("গ্রহণ করুন", "Accept")}</button>
        <button type="button" disabled={busy} onClick={() => void answer(false)} className="pressable rounded-full border border-border px-5 py-2 text-muted">{t("ফিরিয়ে দিন", "Decline")}</button>
      </div>
    </div>
  );
}

function BattleRow({ b, i, onChanged }: { b: BattleListItem; i: number; onChanged: () => Promise<void> }) {
  const { t } = useT();
  const fmt = formatByGen(b.gen);
  const status =
    b.status === "invited" ? t("উত্তরের অপেক্ষায়", "Waiting for an answer") : b.status === "done" ? (b.result === "win" ? t("জিতেছেন 🏆", "You won 🏆") : b.result === "loss" ? t("হেরেছেন 💀", "You lost 💀") : t("ড্র 🤝", "Draw 🤝")) : b.yourTurn ? t("আপনার চাল!", "Your move!") : t("চলছে…", "In progress…");
  return (
    <li className="pk-rise" style={{ ["--i" as string]: i }}>
      <div className={`pk-card flex items-center gap-3 p-3 ${b.yourTurn ? "border-lamp" : ""}`}>
        <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-lg">{b.cpu ? "🤖" : "🧑"}</span>
        <div className="min-w-0 flex-1 font-sans text-sm">
          <b className="block truncate">vs {b.opponent}</b>
          <span className={`text-xs ${b.yourTurn ? "text-lamp" : "text-muted"}`}>{status} · {t(fmt.bn, fmt.en)}{b.status !== "invited" ? ` · ${t("টার্ন", "Turn")} ${b.turn}` : ""}</span>
        </div>
        {b.status === "invited" ? (
          <button type="button" onClick={() => void cancelChallenge({ data: { id: b.id } }).then(onChanged)} className="pressable rounded-full border border-border px-3 py-1 font-sans text-xs text-muted">{t("বাতিল", "Cancel")}</button>
        ) : (
          <Link to="/pokemon/battle/$id" params={{ id: String(b.id) }} className={`pressable rounded-full px-4 py-1.5 font-sans text-xs ${b.yourTurn ? "pk-pulse-badge bg-accent text-accent-fg" : "border border-border"}`}>
            {b.status === "done" ? t("রিপ্লে", "Replay") : t("চালিয়ে যান", "Continue")}
          </Link>
        )}
      </div>
    </li>
  );
}
