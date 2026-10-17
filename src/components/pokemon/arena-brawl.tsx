import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { ArenaRenderer } from "@/components/pokemon/arena-render";
import { sfx } from "@/components/pokemon/arena-sfx";
import { TypeIcon } from "@/components/pokemon/type-icons";
import { Sprite, useT } from "@/components/pokemon/ui";
import { MOVES, PERKS, ROSTER, speciesOf } from "@/lib/pokemon/arena-data";
import { ARENA, begin, choosePerk, newGame, noInput, playerOf, step, type Ev, type Input, type Mode, type State } from "@/lib/pokemon/arena-engine";
import { TYPE_COLOR } from "@/lib/pokemon/shared";
import "@/components/pokemon/arena-brawl.css";

type Screen = "menu" | "play" | "perks" | "over";
type Save = { bestWave: number; bestScore: number; royaleWins: number; royalePlays: number };
const SAVE_KEY = "arena-brawl-v1";
const loadSave = (): Save => {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "{}") as Partial<Save>;
    return { bestWave: raw.bestWave ?? 0, bestScore: raw.bestScore ?? 0, royaleWins: raw.royaleWins ?? 0, royalePlays: raw.royalePlays ?? 0 };
  } catch {
    return { bestWave: 0, bestScore: 0, royaleWins: 0, royalePlays: 0 };
  }
};
const keepSave = (s: Save) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
};

type Hud = { hp: number; ghost: number; max: number; cds: number[]; dodge: number; combo: number; wave: number; score: number; foes: number; storm: boolean; name: string; buff: boolean };
const KEYS = ["1", "2", "3", "4"];

type Runtime = {
  S: State | null;
  R: ArenaRenderer | null;
  keys: Set<string>;
  joy: { x: number; y: number };
  aim: { x: number; y: number } | null;
  queue: [boolean, boolean, boolean, boolean];
  dodge: boolean;
  mouse: boolean;
  paused: boolean;
  last: number;
  raf: number;
  hudAt: number;
  endT: number;
  mode: Mode;
  hit: boolean;
};

export function ArenaBrawl() {
  const { t } = useT();
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("survival");
  const [pick, setPick] = useState("charizard");
  const [save, setSave] = useState<Save>({ bestWave: 0, bestScore: 0, royaleWins: 0, royalePlays: 0 });
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<{ win: boolean; wave: number; score: number; place: number; kos: number; combo: number; perfects: number; best: boolean } | null>(null);
  const [perkIds, setPerkIds] = useState<string[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const joyEl = useRef<HTMLDivElement>(null);
  const rt = useRef<Runtime>({ S: null, R: null, keys: new Set(), joy: { x: 0, y: 0 }, aim: null, queue: [false, false, false, false], dodge: false, mouse: false, paused: false, last: 0, raf: 0, hudAt: 0, endT: 0, mode: "survival", hit: false });

  useEffect(() => {
    setSave(loadSave());
    setMuted(sfx.isMuted());
  }, []);

  const mewtwoOpen = save.bestWave >= 5;
  const sp = speciesOf(pick);
  const inGame = screen !== "menu";

  /* ------------------------------------------------------------- starting */

  const start = useCallback(() => {
    sfx.unlock();
    const S = newGame(mode, pick);
    begin(S);
    rt.current.S = S;
    rt.current.mode = mode;
    rt.current.endT = 0;
    rt.current.queue = [false, false, false, false];
    rt.current.paused = false;
    setPaused(false);
    setResult(null);
    setHud(null);
    setScreen("play");
  }, [mode, pick]);

  /* ----------------------------------------------------------- the loop */

  const onEvents = useCallback((S: State, evs: Ev[]) => {
    const r = rt.current;
    const p = playerOf(S);
    r.R?.feed(evs, p);
    for (const e of evs) {
      switch (e.t) {
        case "cast": sfx.cast(e.kind); break;
        case "hit": if (e.toPlayer) sfx.hurt(); else sfx.hit(e.heavy, e.crit); break;
        case "explode": if (e.r >= 100) sfx.boom(); break;
        case "dodge": sfx.dodge(); break;
        case "perfect": sfx.perfect(); break;
        case "ko": sfx.ko(e.boss); break;
        case "combo": sfx.combo(e.n, e.finish); break;
        case "wave":
          sfx.wave(e.boss);
          r.R?.say(e.boss ? t("বস!", "BOSS!") : r.mode === "royale" ? t("শুরু!", "FIGHT!") : `${t("ওয়েভ", "WAVE")} ${e.n}`, e.boss ? "#ff6a6a" : "#ffffff");
          break;
        case "storm": r.R?.say(t("ঝড় আসছে!", "THE STORM CLOSES IN!"), "#d28bff"); break;
        default: break;
      }
    }
  }, [t]);

  const finish = useCallback(() => {
    const S = rt.current.S;
    if (!S) return;
    const p = playerOf(S);
    const prev = loadSave();
    const next = { ...prev };
    let best = false;
    if (S.mode === "survival") {
      const wave = S.wave;
      if (S.score > prev.bestScore) {
        next.bestScore = S.score;
        best = true;
      }
      if (wave > prev.bestWave) next.bestWave = wave;
    } else {
      next.royalePlays++;
      if (S.winner) next.royaleWins++;
    }
    keepSave(next);
    setSave(next);
    if (S.winner) sfx.win();
    else sfx.lose();
    setResult({ win: S.winner, wave: S.wave, score: S.score, place: S.place, kos: p.kos, combo: p.combo.best, perfects: S.perfects, best });
    setScreen("over");
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const r = rt.current;
    const cv = canvas.current;
    if (!cv || !r.S) return;
    if (!r.R) r.R = new ArenaRenderer(cv);
    r.R.resize();
    const onResize = () => r.R?.resize();
    window.addEventListener("resize", onResize);
    r.last = performance.now();

    const build = (): Input => {
      const k = r.keys;
      let mx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
      let my = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
      if (mx === 0 && my === 0) {
        mx = r.joy.x;
        my = r.joy.y;
      }
      const cast: [boolean, boolean, boolean, boolean] = [r.queue[0] || r.mouse, r.queue[1], r.queue[2], r.queue[3]];
      const dodge = r.dodge;
      r.queue = [false, false, false, false];
      r.dodge = false;
      return { mx, my, aim: r.aim, cast, dodge };
    };

    const tick = (now: number) => {
      const S = r.S!;
      const dt = Math.min(0.05, (now - r.last) / 1000);
      r.last = now;
      if (!r.paused) {
        step(S, build(), dt);
        if (S.events.length) {
          onEvents(S, S.events);
          S.events.length = 0;
        }
      }
      const p = playerOf(S);
      r.R!.render(S, r.paused ? 0 : dt, p);

      if (now - r.hudAt > 90) {
        r.hudAt = now;
        setHud({
          hp: p.hp,
          ghost: p.ghost,
          max: p.maxHp,
          cds: p.sp.moves.map((id, i) => Math.max(0, p.cd[i]! / (MOVES[id]!.cd * p.cdMul))),
          dodge: Math.max(0, p.dodge.cd / (1.15 * p.dodgeMul)),
          combo: p.combo.n,
          wave: S.wave,
          score: S.score,
          foes: S.fighters.filter((f) => f.alive && f.team !== 0).length,
          storm: S.storm.on,
          name: p.sp.name,
          buff: p.buffT > 0,
        });
      }

      if (S.phase === "perks" || S.phase === "over") {
        // let the last blow play out before the screen changes
        r.endT += dt;
        if (r.endT > (S.phase === "perks" ? 1.0 : 1.5)) {
          if (S.phase === "perks") {
            setPerkIds(S.perks);
            sfx.wave(false);
            setScreen("perks");
          } else finish();
          return;
        }
      }
      r.raf = requestAnimationFrame(tick);
    };
    r.endT = 0;
    r.raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(r.raf);
      window.removeEventListener("resize", onResize);
    };
  }, [screen, onEvents, finish]);

  // keep the canvas the right size when the game screens appear
  useEffect(() => {
    if (inGame) rt.current.R?.resize();
  }, [inGame]);

  /* ------------------------------------------------------------- input */

  useEffect(() => {
    if (!inGame) return;
    const r = rt.current;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === " " || k === "shift") r.dodge = true;
      else if (k === "p" || k === "escape") togglePause();
      else if (k === "1" || k === "j") r.queue[0] = true;
      else if (k === "2" || k === "k") r.queue[1] = true;
      else if (k === "3" || k === "l") r.queue[2] = true;
      else if (k === "4" || k === ";") r.queue[3] = true;
      else r.keys.add(k);
    };
    const up = (e: KeyboardEvent) => r.keys.delete(e.key.toLowerCase());
    const blur = () => {
      r.keys.clear();
      if (screen === "play") setPausedBoth(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
      r.keys.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inGame, screen]);

  function setPausedBoth(v: boolean) {
    rt.current.paused = v;
    setPaused(v);
  }
  function togglePause() {
    if (screen !== "play") return;
    setPausedBoth(!rt.current.paused);
  }

  function aimFrom(e: React.PointerEvent) {
    const cv = canvas.current;
    if (!cv || e.pointerType !== "mouse") return;
    const b = cv.getBoundingClientRect();
    rt.current.aim = { x: ((e.clientX - b.left) / b.width) * ARENA.W, y: ((e.clientY - b.top) / b.height) * ARENA.H };
  }

  // touch joystick
  const joyMove = (e: React.PointerEvent) => {
    const el = joyEl.current;
    if (!el || !(e.buttons || e.pointerType === "touch")) return;
    const b = el.getBoundingClientRect();
    let x = (e.clientX - (b.left + b.width / 2)) / (b.width / 2);
    let y = (e.clientY - (b.top + b.height / 2)) / (b.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    rt.current.joy = { x: Math.abs(x) < 0.15 ? 0 : x, y: Math.abs(y) < 0.15 ? 0 : y };
    const knob = el.firstElementChild as HTMLElement | null;
    if (knob) knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
  };
  const joyEnd = () => {
    rt.current.joy = { x: 0, y: 0 };
    const knob = joyEl.current?.firstElementChild as HTMLElement | null;
    if (knob) knob.style.transform = "";
  };

  /* ---------------------------------------------------------------- UI */

  const pickPerk = (id: string) => {
    const S = rt.current.S;
    if (!S) return;
    sfx.pick();
    choosePerk(S, id);
    rt.current.endT = 0;
    setScreen("play");
  };

  const p0 = useMemo(() => speciesOf(pick), [pick]);
  const hpColor = (v: number) => (v > 0.5 ? "#4cd964" : v > 0.25 ? "#ffb020" : "#ff453a");

  if (!inGame) {
    return (
      <div className="ab-menu">
        <div className="ab-modes">
          <button type="button" className={`ab-mode ${mode === "survival" ? "on" : ""}`} onClick={() => setMode("survival")}>
            <b>{t("সারভাইভাল", "Survival")}</b>
            <span>{t("ওয়েভের পর ওয়েভ। প্রতি ওয়েভের পর একটি পার্ক বেছে নিন। প্রতি ৫ম ওয়েভে বস।", "Wave after wave. Pick a perk after each one. A boss every 5th wave.")}</span>
          </button>
          <button type="button" className={`ab-mode ${mode === "royale" ? "on" : ""}`} onClick={() => setMode("royale")}>
            <b>{t("ব্যাটল রয়্যাল", "Battle Royale")}</b>
            <span>{t("৫টি পোকেমন, একটি মাঠ, সবাই সবার শত্রু। ঝড় ধীরে ধীরে মাঠ ছোট করে।", "Five Pokémon, one arena, everyone against everyone. A storm slowly shrinks the floor.")}</span>
          </button>
        </div>

        <div className="ab-roster">
          {ROSTER.map((s) => {
            const locked = s.locked && !mewtwoOpen;
            return (
              <button key={s.id} type="button" disabled={locked} className={`ab-card ${pick === s.id ? "on" : ""} ${locked ? "lock" : ""}`} onClick={() => { sfx.pick(); setPick(s.id); }}>
                <Sprite info={{ id: s.id, num: s.num, types: s.types }} still alt={s.name} />
                <b>{locked ? "???" : s.name}</b>
                <span style={{ display: "flex", gap: 2 }}>{s.types.map((ty) => <TypeIcon key={ty} type={ty} size={14} />)}</span>
              </button>
            );
          })}
        </div>

        <div className="ab-detail">
          <h3>{sp.name}</h3>
          <div style={{ fontSize: 13, opacity: 0.8 }}>{sp.blurb}</div>
          <div className="ab-mvlist">
            {sp.moves.map((id, i) => {
              const mv = MOVES[id]!;
              return (
                <div key={id}>
                  <b style={{ display: "flex", alignItems: "center", gap: 6 }}><TypeIcon type={mv.type} size={14} />{i + 1}. {mv.name}</b>
                  <span style={{ opacity: 0.75 }}>{mv.desc}</span>
                </div>
              );
            })}
          </div>
          <div className="ab-help">
            <kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd> {t("চলুন", "move")} · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> ({t("বা", "or")} <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>;</kbd>) {t("চাল", "moves")} · <kbd>Space</kbd> {t("গড়ান (ডজ)", "dodge roll")} · {t("মাউস: লক্ষ্য, বাম ক্লিক = চাল ১", "mouse: aim, left click = move 1")} · <kbd>P</kbd> {t("বিরতি", "pause")}
            <br />
            {t("লাল চিহ্ন দেখলে সরে যান। ঠিক সময়ে গড়ালে ‘পারফেক্ট ডজ’: সময় ধীর হয়, পরের আঘাত জোরালো। আলাদা আলাদা চাল পরপর চালালে কম্বো।", "Move out of anything shown in red. Roll through an attack for a PERFECT DODGE: time slows and your next hits hit harder. Chain different moves for a combo.")}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {t("সেরা", "Best")}: {t("ওয়েভ", "wave")} {save.bestWave} · {t("স্কোর", "score")} {save.bestScore} · {t("রয়্যাল জয়", "royale wins")} {save.royaleWins}/{save.royalePlays}
          </div>
          <div><button type="button" className="ab-btn" onClick={start}>{t("লড়াই শুরু", "Start the fight")}</button></div>
        </div>
      </div>
    );
  }

  const pct = hud ? hud.hp / hud.max : 1;
  return (
    <div className="ab">
      <div
        className="ab-stage"
        onPointerMove={aimFrom}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && screen === "play") {
            aimFrom(e);
            rt.current.mouse = e.button === 0;
            if (e.button === 2) rt.current.queue[1] = true;
          }
        }}
        onPointerUp={() => (rt.current.mouse = false)}
        onPointerLeave={() => {
          rt.current.mouse = false;
          rt.current.aim = null;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvas} />
        {hud ? (
          <div className="ab-hud">
            <div className="ab-me">
              <b>{hud.name}</b>
              <small>{Math.ceil(hud.hp)} / {hud.max}</small>
              <div className="ab-bar">
                <i className="ghost" style={{ width: `${Math.max(0, (hud.ghost / hud.max) * 100)}%` }} />
                <i className="fill" style={{ width: `${Math.max(0, pct * 100)}%`, background: hpColor(pct) }} />
              </div>
            </div>
            <div className="ab-top">
              {rt.current.mode === "survival" ? <>{t("ওয়েভ", "Wave")} {hud.wave}</> : <>{t("ব্যাটল রয়্যাল", "Battle Royale")}</>}
              <span>{t("শত্রু", "Foes")} {hud.foes}</span>
              <span>★ {hud.score}</span>
            </div>
            {hud.combo > 1 ? <div className="ab-combo pulse">{t("কম্বো", "COMBO")} ×{hud.combo}</div> : null}
            <div className="ab-tools">
              <button type="button" className="ab-ic" onClick={() => { const v = !sfx.isMuted(); sfx.setMuted(v); setMuted(v); }} aria-label={t("শব্দ", "Sound")}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
              <button type="button" className="ab-ic" onClick={togglePause} aria-label={t("বিরতি", "Pause")}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
            </div>
            <div ref={joyEl} className="ab-joy" onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); joyMove(e); }} onPointerMove={joyMove} onPointerUp={joyEnd} onPointerCancel={joyEnd}>
              <i />
            </div>
          </div>
        ) : null}

        {paused && screen === "play" ? (
          <div className="ab-ov">
            <div>
              <h2>{t("বিরতি", "Paused")}</h2>
              <div className="ab-row">
                <button type="button" className="ab-btn" onClick={() => setPausedBoth(false)}>{t("চালিয়ে যান", "Resume")}</button>
                <button type="button" className="ab-btn ghost" onClick={() => { cancelAnimationFrame(rt.current.raf); setScreen("menu"); }}>{t("মেনু", "Menu")}</button>
              </div>
            </div>
          </div>
        ) : null}

        {screen === "perks" ? (
          <div className="ab-ov">
            <div>
              <h2>{t("ওয়েভ সাফ!", "Wave cleared!")}</h2>
              <p>{t("একটি পার্ক বেছে নিন", "Pick a perk")}</p>
              <div className="ab-perks">
                {perkIds.map((id) => {
                  const pk = PERKS.find((x) => x.id === id)!;
                  return (
                    <button key={id} type="button" className="ab-perk" onClick={() => pickPerk(id)}>
                      <div className="em">{pk.icon}</div>
                      <b>{t(PERK_BN[id]?.[0] ?? pk.name, pk.name)}</b>
                      <span>{t(PERK_BN[id]?.[1] ?? pk.desc, pk.desc)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {screen === "over" && result ? (
          <div className="ab-ov">
            <div>
              <h2 style={{ color: result.win ? "#ffd54a" : "#ff8a8a" }}>
                {rt.current.mode === "royale" ? (result.win ? t("চ্যাম্পিয়ন!", "Champion!") : `${t("স্থান", "Place")} #${result.place}`) : t("হেরে গেছেন", "Defeated")}
              </h2>
              {result.best ? <p style={{ color: "#ffd54a" }}>{t("নতুন সেরা স্কোর!", "New best score!")}</p> : null}
              <div className="ab-stats">
                {rt.current.mode === "survival" ? <><span>{t("ওয়েভ", "Wave")}</span><b>{result.wave}</b></> : null}
                <span>{t("স্কোর", "Score")}</span><b>{result.score}</b>
                <span>{t("নক-আউট", "KOs")}</span><b>{result.kos}</b>
                <span>{t("সেরা কম্বো", "Best combo")}</span><b>×{result.combo}</b>
                <span>{t("পারফেক্ট ডজ", "Perfect dodges")}</span><b>{result.perfects}</b>
              </div>
              {rt.current.mode === "survival" && result.wave >= 5 && !mewtwoOpen ? null : null}
              <div className="ab-row">
                <button type="button" className="ab-btn" onClick={start}>{t("আবার", "Again")}</button>
                <button type="button" className="ab-btn ghost" onClick={() => setScreen("menu")}>{t("মেনু", "Menu")}</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="ab-moves">
        {p0.moves.map((id, i) => {
          const mv = MOVES[id]!;
          const cd = hud?.cds[i] ?? 0;
          return (
            <button
              key={id}
              type="button"
              className={`ab-mv ${cd <= 0 ? "ready" : ""}`}
              style={{ ["--c" as string]: TYPE_COLOR[mv.type] ?? "#fff" }}
              onPointerDown={(e) => {
                e.preventDefault();
                rt.current.queue[i] = true;
              }}
            >
              <span className="ic"><TypeIcon type={mv.type} size={20} /></span>
              <span className="nm">{mv.name}</span>
              <span className="ky">{KEYS[i]}</span>
              <span className="cd" style={{ height: `${Math.min(1, cd) * 100}%` }} />
            </button>
          );
        })}
        <button
          type="button"
          className={`ab-mv dodge ${(hud?.dodge ?? 0) <= 0 ? "ready" : ""}`}
          onPointerDown={(e) => {
            e.preventDefault();
            rt.current.dodge = true;
          }}
        >
          <span className="ic">🌀</span>
          <span className="nm">{t("গড়ান", "Dodge")}</span>
          <span className="ky">Space</span>
          <span className="cd" style={{ height: `${Math.min(1, hud?.dodge ?? 0) * 100}%` }} />
        </button>
      </div>
    </div>
  );
}

/** Bangla names for the perks (the English ones live with the perk data). */
const PERK_BN: Record<string, [string, string]> = {
  power: ["শক্তি বাড়ান", "+১৮% ড্যামেজ"],
  swift: ["দ্রুত পা", "+১৪% চলার গতি"],
  haste: ["দ্রুত রিচার্জ", "চাল ১৫% দ্রুত তৈরি হয়"],
  vigor: ["তেজ", "+২৫% সর্বোচ্চ HP, সমান HP ফেরত"],
  drain: ["প্রাণ শোষণ", "দেওয়া ড্যামেজের ৭% HP ফেরত"],
  roll: ["চটপটে গড়ান", "ডজ ৩০% দ্রুত তৈরি হয়"],
  crit: ["তীক্ষ্ণ দৃষ্টি", "+১৪% ক্রিটিক্যাল সুযোগ"],
  guardian: ["শক্ত চামড়া", "১২% কম ড্যামেজ নিন"],
};
