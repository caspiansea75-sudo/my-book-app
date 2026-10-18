import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { ArenaRenderer } from "@/components/pokemon/arena-render";
import { sfx } from "@/components/pokemon/arena-sfx";
import { TypeIcon } from "@/components/pokemon/type-icons";
import { Sprite, useT } from "@/components/pokemon/ui";
import { FIELDS, ITEMS, MOVES, PERKS, ROSTER, speciesOf, type FieldKind } from "@/lib/pokemon/arena-data";
import { ARENA, begin, choosePerk, newGame, playerOf, step, type Ev, type Input, type Mode, type State } from "@/lib/pokemon/arena-engine";
import { TYPE_COLOR } from "@/lib/pokemon/shared";
import "@/components/pokemon/arena-brawl.css";

type Screen = "menu" | "play" | "perks" | "over";
type Save = { bestWave: number; bestScore: number; royaleWins: number; royalePlays: number };
const SAVE_KEY = "arena-brawl-v1";
const ZOOM_KEY = "arena-brawl-zoom";
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
const clampZoom = (z: number) => Math.max(0.8, Math.min(2.2, Math.round(z * 100) / 100));

type Hud = { hp: number; ghost: number; max: number; cds: number[]; cdLeft: number[]; dodge: number; dodgeLeft: number; ult: number; awaken: number; combo: number; wave: number; score: number; foes: number; field: FieldKind; name: string };
const KEYS = ["1", "2", "3", "4"];

type Runtime = {
  S: State | null;
  R: ArenaRenderer | null;
  keys: Set<string>;
  joy: { x: number; y: number };
  aim: { x: number; y: number } | null;
  queue: [boolean, boolean, boolean, boolean];
  held: [boolean, boolean, boolean, boolean];
  dodge: boolean;
  ult: boolean;
  mouse: boolean;
  paused: boolean;
  last: number;
  raf: number;
  hudAt: number;
  endT: number;
  mode: Mode;
  zoom: number;
  pointers: Map<number, { x: number; y: number }>;
  pinch: number;
};

const coarse = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export function ArenaBrawl() {
  const { t } = useT();
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>("survival");
  const [pick, setPick] = useState("charizard");
  const [save, setSave] = useState<Save>({ bestWave: 0, bestScore: 0, royaleWins: 0, royalePlays: 0 });
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [fs, setFs] = useState(false);
  const [portraitHint, setPortraitHint] = useState(false);
  const [result, setResult] = useState<{ win: boolean; wave: number; score: number; place: number; kos: number; combo: number; perfects: number; best: boolean } | null>(null);
  const [perkIds, setPerkIds] = useState<string[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const joyEl = useRef<HTMLDivElement>(null);
  const fsAuto = useRef(false);
  const fsNative = useRef(false);
  const rt = useRef<Runtime>({ S: null, R: null, keys: new Set(), joy: { x: 0, y: 0 }, aim: null, queue: [false, false, false, false], held: [false, false, false, false], dodge: false, ult: false, mouse: false, paused: false, last: 0, raf: 0, hudAt: 0, endT: 0, mode: "survival", zoom: 1, pointers: new Map(), pinch: 0 });

  useEffect(() => {
    setSave(loadSave());
    setMuted(sfx.isMuted());
    const z = clampZoom(Number(localStorage.getItem(ZOOM_KEY)) || 1);
    rt.current.zoom = z;
    setZoomState(z);
  }, []);

  const unlocked = (need?: number) => !need || save.bestWave >= need;
  const sp = speciesOf(pick);
  const inGame = screen !== "menu";

  /* ------------------------------------------------------------ zoom */

  const setZoom = useCallback((z: number) => {
    const v = clampZoom(z);
    rt.current.zoom = v;
    rt.current.R?.setZoom(v);
    setZoomState(v);
    try {
      localStorage.setItem(ZOOM_KEY, String(v));
    } catch {
      /* storage unavailable */
    }
  }, []);

  /* ------------------------------------------------------- full screen */

  const enterFs = useCallback(async (auto = false) => {
    fsAuto.current = auto;
    setFs(true);
    const el = shell.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    try {
      if (el && !document.fullscreenElement && (el.requestFullscreen || el.webkitRequestFullscreen)) {
        await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen!());
        fsNative.current = true;
      }
    } catch {
      /* browsers only allow this after a tap, so on rotation the screen-filling layout below is what you get */
    }
    try {
      await (window.screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape");
    } catch {
      /* not allowed here */
    }
  }, []);

  const exitFs = useCallback(() => {
    fsAuto.current = false;
    setFs(false);
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      window.screen.orientation?.unlock?.();
    } catch {
      /* already out */
    }
    fsNative.current = false;
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && fsNative.current) {
        fsNative.current = false;
        setFs(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // turn the phone sideways and the game fills the screen; turn it back and it goes back
  useEffect(() => {
    if (!inGame) {
      if (fsAuto.current) exitFs();
      setPortraitHint(false);
      return;
    }
    const land = window.matchMedia("(orientation: landscape)");
    const check = () => {
      if (!coarse()) return;
      if (land.matches) {
        setPortraitHint(false);
        if (!fs) void enterFs(true);
      } else {
        setPortraitHint(true);
        if (fsAuto.current) exitFs();
      }
    };
    check();
    land.addEventListener("change", check);
    return () => land.removeEventListener("change", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inGame]);

  useEffect(() => {
    document.documentElement.style.overflow = fs ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [fs]);

  /* ------------------------------------------------------------- starting */

  const start = useCallback(() => {
    sfx.unlock();
    const S = newGame(mode, pick);
    begin(S);
    const r = rt.current;
    r.S = S;
    r.mode = mode;
    r.endT = 0;
    r.queue = [false, false, false, false];
    r.held = [false, false, false, false];
    r.paused = false;
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
        case "awaken": sfx.boom(); sfx.perfect(); break;
        case "item": if (e.byPlayer) sfx.combo(3, true); break;
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
      if (S.score > prev.bestScore) {
        next.bestScore = S.score;
        best = true;
      }
      if (S.wave > prev.bestWave) next.bestWave = S.wave;
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

  // the canvas follows the size of its box (rotation, full screen, window changes)
  useEffect(() => {
    const el = stage.current;
    if (!el || !inGame) return;
    const ro = new ResizeObserver(() => rt.current.R?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [inGame]);

  useEffect(() => {
    if (screen !== "play") return;
    const r = rt.current;
    const cv = canvas.current;
    if (!cv || !r.S) return;
    if (!r.R) r.R = new ArenaRenderer(cv);
    r.R.setZoom(r.zoom);
    r.R.resize();
    r.last = performance.now();

    const build = (): Input => {
      const k = r.keys;
      let mx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
      let my = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
      if (mx === 0 && my === 0) {
        mx = r.joy.x;
        my = r.joy.y;
      }
      const cast: [boolean, boolean, boolean, boolean] = [r.queue[0] || r.held[0] || r.mouse, r.queue[1] || r.held[1], r.queue[2] || r.held[2], r.queue[3] || r.held[3]];
      const inp: Input = { mx, my, aim: r.aim, cast, dodge: r.dodge, ult: r.ult };
      r.queue = [false, false, false, false];
      r.dodge = false;
      r.ult = false;
      return inp;
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
        const ids = p.sp.moves;
        setHud({
          hp: p.hp,
          ghost: p.ghost,
          max: p.maxHp,
          cds: ids.map((id, i) => Math.max(0, p.cd[i]! / (MOVES[id]!.cd * p.cdMul))),
          cdLeft: ids.map((_, i) => p.cd[i]!),
          dodge: Math.max(0, p.dodge.cd / (1.15 * p.dodgeMul)),
          dodgeLeft: p.dodge.cd,
          ult: p.ult,
          awaken: p.awaken,
          combo: p.combo.n,
          wave: S.wave,
          score: S.score,
          foes: S.fighters.filter((f) => f.alive && f.team !== 0).length,
          field: S.field,
          name: p.sp.name,
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
    return () => cancelAnimationFrame(r.raf);
  }, [screen, onEvents, finish]);

  /* ------------------------------------------------------------- input */

  const setPausedBoth = useCallback((v: boolean) => {
    rt.current.paused = v;
    setPaused(v);
  }, []);

  useEffect(() => {
    if (!inGame) return;
    const r = rt.current;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === " " || k === "shift") r.dodge = true;
      else if (k === "q") r.ult = true;
      else if (k === "p" || (k === "escape" && !document.fullscreenElement)) setPausedBoth(!r.paused);
      else if (k === "f") (fs ? exitFs : () => enterFs(false))();
      else if (k === "+" || k === "=") setZoom(r.zoom + 0.15);
      else if (k === "-" || k === "_") setZoom(r.zoom - 0.15);
      else if (k === "0") setZoom(1);
      else if (k === "1" || k === "j") r.queue[0] = true;
      else if (k === "2" || k === "k") r.queue[1] = true;
      else if (k === "3" || k === "l") r.queue[2] = true;
      else if (k === "4" || k === ";") r.queue[3] = true;
      else r.keys.add(k);
    };
    const up = (e: KeyboardEvent) => r.keys.delete(e.key.toLowerCase());
    const blur = () => {
      r.keys.clear();
      r.held = [false, false, false, false];
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
  }, [inGame, screen, fs, enterFs, exitFs, setZoom, setPausedBoth]);

  // the mouse wheel zooms
  useEffect(() => {
    const el = shell.current;
    if (!el || !inGame) return;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest(".ab-ov")) return;
      e.preventDefault();
      setZoom(rt.current.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [inGame, setZoom]);

  function aimFrom(e: React.PointerEvent) {
    const cv = canvas.current;
    const R = rt.current.R;
    if (!cv || !R || e.pointerType !== "mouse") return;
    const b = cv.getBoundingClientRect();
    rt.current.aim = R.toWorld(((e.clientX - b.left) / b.width) * ARENA.W, ((e.clientY - b.top) / b.height) * ARENA.H);
  }

  // two fingers pinch to zoom
  function stageDown(e: React.PointerEvent) {
    const r = rt.current;
    if (e.pointerType === "mouse") {
      if (screen === "play") {
        aimFrom(e);
        r.mouse = e.button === 0;
        if (e.button === 2) r.queue[1] = true;
      }
      return;
    }
    r.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (r.pointers.size === 2) {
      const [a, b] = [...r.pointers.values()];
      r.pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
  }
  function stageMove(e: React.PointerEvent) {
    const r = rt.current;
    if (e.pointerType === "mouse") return aimFrom(e);
    if (!r.pointers.has(e.pointerId)) return;
    r.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (r.pointers.size === 2 && r.pinch > 0) {
      const [a, b] = [...r.pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      setZoom(r.zoom * (d / r.pinch));
      r.pinch = d;
    }
  }
  function stageUp(e: React.PointerEvent) {
    const r = rt.current;
    r.pointers.delete(e.pointerId);
    r.pinch = 0;
    if (e.pointerType === "mouse") r.mouse = false;
  }

  // touch joystick
  const joyMove = (e: React.PointerEvent) => {
    const el = joyEl.current;
    if (!el) return;
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

  const pickPerk = (id: string) => {
    const S = rt.current.S;
    if (!S) return;
    sfx.pick();
    choosePerk(S, id);
    rt.current.endT = 0;
    setScreen("play");
  };

  const hpColor = (v: number) => (v > 0.5 ? "#4cd964" : v > 0.25 ? "#ffb020" : "#ff453a");

  /* ---------------------------------------------------------------- menu */

  if (!inGame) {
    return (
      <div className="ab-menu">
        <div className="ab-modes">
          <button type="button" className={`ab-mode ${mode === "survival" ? "on" : ""}`} onClick={() => setMode("survival")}>
            <b>{t("সারভাইভাল", "Survival")}</b>
            <span>{t("ওয়েভের পর ওয়েভ। প্রতি ওয়েভের পর একটি পার্ক বেছে নিন। বস: ৫ম ওয়েভে মিউটু, ১০ম ওয়েভে রেকুয়াজা।", "Wave after wave. Pick a perk after each one. Bosses: Mewtwo on wave 5, Rayquaza on wave 10.")}</span>
          </button>
          <button type="button" className={`ab-mode ${mode === "royale" ? "on" : ""}`} onClick={() => setMode("royale")}>
            <b>{t("ব্যাটল রয়্যাল", "Battle Royale")}</b>
            <span>{t("৫টি পোকেমন, একটি মাঠ, সবাই সবার শত্রু। ঝড় ধীরে ধীরে মাঠ ছোট করে।", "Five Pokémon, one arena, everyone against everyone. A storm slowly shrinks the floor.")}</span>
          </button>
        </div>

        <div className="ab-roster">
          {ROSTER.map((s) => {
            const locked = !unlocked(s.unlock);
            return (
              <button key={s.id} type="button" disabled={locked} className={`ab-card ${pick === s.id ? "on" : ""} ${locked ? "lock" : ""}`} onClick={() => { sfx.pick(); setPick(s.id); }}>
                <Sprite info={{ id: s.id, num: s.num, types: s.types }} still alt={s.name} />
                <b>{locked ? "???" : s.name}</b>
                <span style={{ display: "flex", gap: 2 }}>{s.types.map((ty) => <TypeIcon key={ty} type={ty} size={14} />)}</span>
                {locked ? <small style={{ fontSize: 10, opacity: 0.8 }}>{t("ওয়েভ", "Wave")} {s.unlock}</small> : null}
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

          <div className="ab-gimmicks">
            <b>{t("মাঠের চমক", "Arena gimmicks")}</b>
            <div><span>⚡</span> <em>{t("জাগরণ (Q)", "Awaken (Q)")}</em> {t("ড্যামেজ দিলে ও ঠিক সময়ে গড়ালে গেজ ভরে। পূর্ণ হলে Q: ঝলক, তারপর ৮ সেকেন্ড বেশি ড্যামেজ, গতি ও দ্রুত রিচার্জ।", "Dealing damage and perfect dodges fill the gauge. When full, press Q: a shockwave, then 8 seconds of more damage, speed and faster recharge.")}</div>
            <div><span>🎁</span> <em>{t("পিকআপ", "Pickups")}</em> {t("বেরি, এনার্জি অর্ব, স্পিড বুট ও পাওয়ার ক্রিস্টাল মাঠে পড়ে। ছুঁয়ে নিন।", "Berries, Energy Orbs, Speed Boots and Power Crystals appear on the floor. Walk over them.")}</div>
            <div><span>🌦️</span> <em>{t("আবহাওয়া", "Weather")}</em> {t("রোদে আগুন, বৃষ্টিতে জল ও বিদ্যুৎ জোরালো। বালুঝড় ও শিলাবৃষ্টি বেশিরভাগ পোকেমনকে ক্ষয় করে।", "Sun boosts Fire, rain boosts Water and Electric. Sand and hail wear most Pokémon down.")}</div>
            <div><span>🌩️</span> <em>{t("বজ্র", "Lightning")}</em> {t("ওয়েভ ৩ থেকে আকাশ থেকে হলুদ বৃত্তে বজ্র পড়ে। সরে যান।", "From wave 3, lightning falls in yellow circles. Step out of them.")}</div>
          </div>

          <div className="ab-help">
            <kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd> {t("চলুন", "move")} · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> {t("চাল", "moves")} · <kbd>Space</kbd> {t("গড়ান", "dodge roll")} · <kbd>Q</kbd> {t("জাগরণ", "awaken")} · <kbd>+</kbd> <kbd>−</kbd> / {t("মাউস হুইল", "mouse wheel")} {t("জুম", "zoom")} · <kbd>F</kbd> {t("ফুল স্ক্রিন", "full screen")} · <kbd>P</kbd> {t("বিরতি", "pause")}
            <br />
            {t("ফোনে: ফোন আড়াআড়ি ঘোরালে নিজে থেকে ফুল স্ক্রিন হয়। বাঁ দিকে জয়স্টিক, ডান দিকে চালের বোতাম, দুই আঙুলে জুম।", "On a phone: turn it sideways and it goes full screen by itself. Joystick on the left, move buttons on the right, pinch with two fingers to zoom.")}
            <br />
            {t("লাল ও হলুদ বৃত্ত বা রেখা দেখলে সরে যান। ঠিক সময়ে গড়ালে ‘পারফেক্ট ডজ’: সময় ধীর হয়, পরের আঘাত জোরালো। আলাদা আলাদা চাল পরপর চালালে কম্বো।", "Move out of anything shown in red or yellow. Roll through an attack for a PERFECT DODGE: time slows and your next hits hit harder. Chain different moves for a combo.")}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {t("সেরা", "Best")}: {t("ওয়েভ", "wave")} {save.bestWave} · {t("স্কোর", "score")} {save.bestScore} · {t("রয়্যাল জয়", "royale wins")} {save.royaleWins}/{save.royalePlays}
          </div>
          <div><button type="button" className="ab-btn" onClick={start}>{t("লড়াই শুরু", "Start the fight")}</button></div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- game */

  const pct = hud ? hud.hp / hud.max : 1;
  const fld = hud && hud.field !== "none" ? FIELDS[hud.field] : null;
  const padBtn = (i: number, cls: string) => {
    const id = sp.moves[i]!;
    const mv = MOVES[id]!;
    const f = hud?.cds[i] ?? 0;
    return (
      <button
        key={id}
        type="button"
        className={`ab-pb ${cls} ${f <= 0 ? "ready" : ""}`}
        style={{ ["--c" as string]: TYPE_COLOR[mv.type] ?? "#fff", ["--f" as string]: Math.min(1, f) }}
        aria-label={mv.name}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          rt.current.queue[i] = true;
          rt.current.held[i] = true;
        }}
        onPointerUp={() => (rt.current.held[i] = false)}
        onPointerCancel={() => (rt.current.held[i] = false)}
        onLostPointerCapture={() => (rt.current.held[i] = false)}
      >
        <span className="pb-ic"><TypeIcon type={mv.type} size={26} /></span>
        <span className="pb-nm">{mv.name}</span>
        <span className="pb-ky">{KEYS[i]}</span>
        {f > 0 ? <span className="pb-cd">{(hud?.cdLeft[i] ?? 0).toFixed(hud && hud.cdLeft[i]! < 10 ? 1 : 0)}</span> : null}
      </button>
    );
  };

  return (
    <div className="ab">
      <div ref={shell} className={`ab-shell ${fs ? "fs" : ""}`} onContextMenu={(e) => e.preventDefault()}>
        <div ref={stage} className="ab-stage" onPointerDown={stageDown} onPointerMove={stageMove} onPointerUp={stageUp} onPointerCancel={stageUp} onPointerLeave={(e) => { if (e.pointerType === "mouse") { rt.current.mouse = false; rt.current.aim = null; } }}>
          <canvas ref={canvas} />
        </div>

        {hud ? (
          <div className="ab-hud">
            <div className="ab-me">
              <b>{hud.name}</b>
              <small>{Math.ceil(hud.hp)} / {hud.max}</small>
              <div className="ab-bar">
                <i className="ghost" style={{ width: `${Math.max(0, (hud.ghost / hud.max) * 100)}%` }} />
                <i className="fill" style={{ width: `${Math.max(0, pct * 100)}%`, background: hpColor(pct) }} />
              </div>
              {hud.awaken > 0 ? <div className="ab-awk">{t("জাগরণ", "AWAKENED")} {hud.awaken.toFixed(1)}s</div> : null}
            </div>
            <div className="ab-top">
              {rt.current.mode === "survival" ? <>{t("ওয়েভ", "Wave")} {hud.wave}</> : <>{t("ব্যাটল রয়্যাল", "Battle Royale")}</>}
              <span>{t("শত্রু", "Foes")} {hud.foes}</span>
              <span className="sc">★ {hud.score}</span>
              {fld ? <span title={t(fld.bn, fld.name)}>{fld.icon}<i className="wx"> {t(fld.bn, fld.name)}</i></span> : null}
            </div>
            {hud.combo > 1 ? <div className="ab-combo pulse">{t("কম্বো", "COMBO")} ×{hud.combo}</div> : null}

            <div className="ab-tools">
              <button type="button" className="ab-ic" onClick={() => setZoom(zoom - 0.15)} aria-label={t("ছোট করুন", "Zoom out")}><ZoomOut size={16} /></button>
              <button type="button" className="ab-ic wide" onClick={() => setZoom(1)} aria-label={t("জুম রিসেট", "Reset zoom")}>×{zoom.toFixed(2).replace(/\.?0+$/, "")}</button>
              <button type="button" className="ab-ic" onClick={() => setZoom(zoom + 0.15)} aria-label={t("বড় করুন", "Zoom in")}><ZoomIn size={16} /></button>
              <button type="button" className="ab-ic" onClick={() => (fs ? exitFs() : void enterFs(false))} aria-label={fs ? t("ফুল স্ক্রিন থেকে বের হন", "Exit full screen") : t("ফুল স্ক্রিন", "Full screen")}>{fs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
              <button type="button" className="ab-ic" onClick={() => { const v = !sfx.isMuted(); sfx.setMuted(v); setMuted(v); }} aria-label={t("শব্দ", "Sound")}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
              <button type="button" className="ab-ic" onClick={() => setPausedBoth(!paused)} aria-label={t("বিরতি", "Pause")}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
            </div>

            <div className="ab-ctl">
            <div ref={joyEl} className="ab-joy" onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); joyMove(e); }} onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture?.(e.pointerId)) joyMove(e); }} onPointerUp={joyEnd} onPointerCancel={joyEnd}>
              <i />
            </div>

            <div className="ab-pad">
              {padBtn(0, "m1")}
              {padBtn(1, "m2")}
              {padBtn(2, "m3")}
              {padBtn(3, "m4")}
              <button
                type="button"
                className={`ab-pb dodge ${(hud.dodge ?? 0) <= 0 ? "ready" : ""}`}
                style={{ ["--c" as string]: "#7fe3ff", ["--f" as string]: Math.min(1, hud.dodge) }}
                aria-label={t("গড়ান", "Dodge")}
                onPointerDown={(e) => { e.preventDefault(); rt.current.dodge = true; }}
              >
                <span className="pb-ic">🌀</span>
                <span className="pb-nm">{t("গড়ান", "Roll")}</span>
                <span className="pb-ky">Space</span>
                {hud.dodge > 0 ? <span className="pb-cd">{hud.dodgeLeft.toFixed(1)}</span> : null}
              </button>
              <button
                type="button"
                className={`ab-pb ult ${hud.ult >= 100 && hud.awaken <= 0 ? "ready full" : ""}`}
                style={{ ["--c" as string]: "#ffd54a", ["--f" as string]: 1 - Math.min(1, hud.ult / 100) }}
                aria-label={t("জাগরণ", "Awaken")}
                onPointerDown={(e) => { e.preventDefault(); rt.current.ult = true; }}
              >
                <span className="pb-ic">⚡</span>
                <span className="pb-nm">{hud.awaken > 0 ? `${hud.awaken.toFixed(0)}s` : `${Math.floor(hud.ult)}%`}</span>
                <span className="pb-ky">Q</span>
              </button>
            </div>
            </div>
          </div>
        ) : null}

        {paused && screen === "play" ? (
          <div className="ab-ov">
            <div>
              <h2>{t("বিরতি", "Paused")}</h2>
              <div className="ab-row">
                <button type="button" className="ab-btn" onClick={() => setPausedBoth(false)}>{t("চালিয়ে যান", "Resume")}</button>
                <button type="button" className="ab-btn ghost" onClick={() => { cancelAnimationFrame(rt.current.raf); exitFs(); setScreen("menu"); }}>{t("মেনু", "Menu")}</button>
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
              <div className="ab-row">
                <button type="button" className="ab-btn" onClick={start}>{t("আবার", "Again")}</button>
                <button type="button" className="ab-btn ghost" onClick={() => { exitFs(); setScreen("menu"); }}>{t("মেনু", "Menu")}</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {portraitHint && !fs ? <div className="ab-tip">{t("ফোন আড়াআড়ি ঘোরালে ফুল স্ক্রিনে খেলা যাবে ↻", "Turn your phone sideways to play full screen ↻")}</div> : null}
      <div className="ab-help">
        {t("চাল: ১–৪ · গড়ান: Space · জাগরণ: Q · জুম: + − বা মাউস হুইল / দুই আঙুল · ফুল স্ক্রিন: F", "Moves 1–4 · Roll: Space · Awaken: Q · Zoom: + − or mouse wheel / two fingers · Full screen: F")}
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
void ITEMS;
