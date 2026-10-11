import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/members/avatar";
import { Sprite, TypeBadge, useT } from "@/components/pokemon/ui";
import type { BattleView, PersonLite } from "@/lib/pokemon-api";
import { hpPercent, type BState, type Cue, type Mon, type SideId } from "@/lib/pokemon/protocol";
import {
  FLAWLESS_LINES,
  CLOSE_LINES,
  LOSE_LINES,
  WIN_LINES,
  TYPE_COLOR,
  guessSpriteId,
  pickLine,
  typeMult,
  type BattleRequest,
  type MoveInfo,
  type SpriteInfo,
} from "@/lib/pokemon/shared";

/* ============================================================ the scene */

type FxKind = "ring" | "mega" | "flash" | "zbeam" | "zaura" | "cloud" | "shards" | "sparks" | "arrow" | "label" | "num" | "banner" | "aura" | "burst" | "typefx" | "ball" | "band";
type Fx = { id: number; kind: FxKind; side?: SideId; to?: SideId; color?: string; text?: string; up?: boolean; extra?: string; delay?: number };

const CENTER = { me: { x: 27, y: 62 }, foe: { x: 72, y: 33 } };
let fxCounter = 0;
const weatherLabel: Record<string, string> = { RainDance: "🌧️ Rain", SunnyDay: "☀️ Sun", Sandstorm: "🌪️ Sand", Snow: "❄️ Snow", Hail: "🧊 Hail", DesolateLand: "🔥 Harsh Sun", PrimordialSea: "🌊 Heavy Rain", DeltaStream: "🌀 Delta Stream" };
const STATUS_LABEL: Record<string, string> = { brn: "BRN", par: "PAR", slp: "SLP", frz: "FRZ", psn: "PSN", tox: "TOX" };
const BOOST_LABEL: Record<string, string> = { atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe", accuracy: "Acc", evasion: "Eva" };

/** What each attacking type looks like when it flies and when it lands. */
const TYPE_FX: Record<string, { e: string[]; mode: "out" | "up" | "down" | "spiral"; n: number; size: number }> = {
  Fire: { e: ["🔥", "✨"], mode: "up", n: 11, size: 24 }, Water: { e: ["💧", "🌊"], mode: "down", n: 11, size: 22 },
  Electric: { e: ["⚡", "✨"], mode: "out", n: 10, size: 26 }, Grass: { e: ["🍃", "🌿"], mode: "spiral", n: 10, size: 22 },
  Ice: { e: ["❄️", "💎"], mode: "out", n: 10, size: 22 }, Psychic: { e: ["🔮", "🌀"], mode: "spiral", n: 9, size: 26 },
  Ghost: { e: ["👻", "💜"], mode: "up", n: 8, size: 24 }, Dragon: { e: ["🐉", "🔥", "✨"], mode: "spiral", n: 9, size: 24 },
  Dark: { e: ["🌑", "💢"], mode: "out", n: 9, size: 24 }, Fairy: { e: ["✨", "💖", "⭐"], mode: "out", n: 11, size: 22 },
  Fighting: { e: ["💥", "👊"], mode: "out", n: 9, size: 28 }, Poison: { e: ["☠️", "🟣"], mode: "up", n: 9, size: 22 },
  Ground: { e: ["🪨", "💨"], mode: "up", n: 10, size: 24 }, Flying: { e: ["💨", "🪶"], mode: "out", n: 9, size: 22 },
  Bug: { e: ["🐛", "🐝"], mode: "spiral", n: 9, size: 22 }, Rock: { e: ["🪨", "💥"], mode: "down", n: 10, size: 26 },
  Steel: { e: ["⚙️", "✨"], mode: "out", n: 10, size: 22 }, Normal: { e: ["⭐", "💥"], mode: "out", n: 10, size: 24 },
  Stellar: { e: ["⭐", "🌟"], mode: "spiral", n: 10, size: 24 },
};
const SLASH_TYPES = new Set(["Normal", "Fighting", "Steel", "Bug", "Dark", "Rock", "Dragon", "Flying", "Ground"]);
const SCREEN_FX = new Set<FxKind>(["band", "banner", "num"]);

const spriteOf = (sprites: Record<string, SpriteInfo>, species: string): SpriteInfo => sprites[species] ?? { id: guessSpriteId(species), num: 0, types: [] };

export function BattleScene({ state, you, sprites, cue, theme = 0, children }: { state: BState; you: SideId | null; sprites: Record<string, SpriteInfo>; cue: Cue | null; theme?: number; children?: React.ReactNode }) {
  const mine: SideId = you ?? "p1";
  const foe: SideId = mine === "p1" ? "p2" : "p1";
  const meRef = useRef<HTMLDivElement>(null);
  const foeRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<HTMLDivElement>(null);
  const [fx, setFx] = useState<Fx[]>([]);

  const clouds = useMemo(() => [{ y: "6%", w: "26%", d: "58s", dl: "-12s" }, { y: "16%", w: "18%", d: "80s", dl: "-50s" }, { y: "2%", w: "14%", d: "46s", dl: "-30s" }], []);
  const motes = useMemo(
    () => Array.from({ length: 14 }, () => ({ x: `${Math.random() * 100}%`, s: `${3 + Math.random() * 4}px`, d: `${6 + Math.random() * 7}s`, dl: `${-Math.random() * 10}s` })),
    [],
  );

  useEffect(() => {
    if (!cue) return;
    const refOf = (s: SideId | undefined) => (s === mine ? meRef : foeRef).current;
    const add = (f: Omit<Fx, "id">, ms = 1700) => {
      const id = ++fxCounter;
      setFx((l) => [...l, { id, ...f }]);
      window.setTimeout(() => setFx((l) => l.filter((x) => x.id !== id)), ms);
    };
    const color = (type?: string) => TYPE_COLOR[type ?? ""] ?? "#ffffff";
    const jolt = (el: HTMLElement | null, frames: Keyframe[], ms: number, delay = 0) =>
      el?.animate(frames, { duration: ms, delay, easing: "ease-in-out", fill: delay ? "backwards" : "none" });
    const zoom = (amount: number, ms = 380) =>
      camRef.current?.animate([{ transform: "scale(1)" }, { transform: `scale(${1 + amount})` }, { transform: "scale(1)" }], { duration: ms, easing: "ease-out" });
    const shakeScene = () => {
      sceneRef.current?.classList.remove("pk-shake");
      void sceneRef.current?.offsetWidth;
      sceneRef.current?.classList.add("pk-shake");
    };
    switch (cue.kind) {
      case "move": {
        const from = cue.from ?? mine;
        const to = cue.side ?? (from === mine ? foe : mine);
        const type = cue.moveType ?? "Normal";
        const c = color(type);
        const dir = from === mine ? { x: 42, y: -26 } : { x: -42, y: 26 };
        add({ kind: "band", side: from, text: cue.moveName, color: c, extra: from === mine ? "me" : "foe" }, 1250);
        if (cue.cat === "Status") {
          add({ kind: "aura", side: from, color: c }, 1000);
          add({ kind: "typefx", side: from, to: from, text: type, extra: "self" }, 1700);
          jolt(refOf(from), [{ transform: "scale(1)" }, { transform: "scale(1.12) translateY(-4%)", offset: 0.4 }, { transform: "scale(1)" }], 650);
        } else if (cue.cat === "Special") {
          add({ kind: "typefx", side: from, to, text: type, extra: "travel" }, 1800);
          jolt(refOf(from), [{ transform: "translate(0,0)" }, { transform: `translate(${-dir.x * 0.08}%, ${-dir.y * 0.08}%) scale(1.07)`, offset: 0.4 }, { transform: "translate(0,0)" }], 520);
        } else {
          jolt(refOf(from), [{ transform: "translate(0,0)" }, { transform: `translate(${dir.x}%, ${dir.y}%) scale(1.08)`, offset: 0.42 }, { transform: "translate(0,0)" }], 560);
          add({ kind: "typefx", side: from, to, text: type, extra: "impact" }, 1700);
        }
        break;
      }
      case "hit": {
        const side = cue.side;
        const c = color(cue.moveType);
        jolt(refOf(side), [
          { transform: "translateX(0)", filter: "brightness(1)" }, { transform: "translateX(-7%)", filter: "brightness(2.6)" }, { transform: "translateX(6%)", filter: "brightness(1)" },
          { transform: "translateX(-4%)", filter: "brightness(2.1)" }, { transform: "translateX(2%)", filter: "brightness(1)" }, { transform: "translateX(0)" },
        ], 480);
        if (cue.amount) add({ kind: "num", side, text: `−${cue.amount}%` }, 1200);
        add({ kind: "burst", side, color: c }, 800);
        if ((cue.amount ?? 0) >= 30 || cue.effect === "crit") zoom(0.06);
        if (cue.effect === "crit") {
          add({ kind: "banner", text: "CRITICAL HIT!", extra: "crit" }, 1300);
          shakeScene();
        } else if (cue.effect === "se") add({ kind: "banner", text: "SUPER EFFECTIVE!", extra: "se" }, 1300);
        else if (cue.effect === "nve") add({ kind: "banner", text: "not very effective…", extra: "nve" }, 1300);
        break;
      }
      case "faint":
        add({ kind: "ring", side: cue.side, color: "#9aa0a6" }, 1000);
        add({ kind: "sparks", side: cue.side, color: "#cbd5e1" }, 1000);
        zoom(0.04, 600);
        break;
      case "switch":
        add({ kind: "ball", side: cue.side }, 1100);
        add({ kind: "ring", side: cue.side, color: "#ff4d4d", delay: 430 }, 1600);
        add({ kind: "flash", side: cue.side, delay: 430 }, 1300);
        jolt(refOf(cue.side), [{ transform: "scale(0.1)", filter: "brightness(4)", opacity: 0 }, { transform: "scale(1.18)", filter: "brightness(1.8)", opacity: 1, offset: 0.55 }, { transform: "scale(1)", filter: "brightness(1)", opacity: 1 }], 650, 430);
        break;
      case "heal":
        add({ kind: "sparks", side: cue.side, color: "#6df08a" }, 1000);
        if (cue.amount) add({ kind: "num", side: cue.side, text: `+${cue.amount}%`, extra: "heal" }, 1200);
        break;
      case "boost":
        add({ kind: "arrow", side: cue.side, up: cue.up, text: cue.up ? "▲" : "▼" }, 1200);
        add({ kind: "ring", side: cue.side, color: cue.up ? "#4cd964" : "#ff453a" }, 1000);
        break;
      case "status":
        add({ kind: "label", side: cue.side, text: (cue.text ?? "").toUpperCase(), color: "#a040a0" }, 1400);
        add({ kind: "sparks", side: cue.side, color: "#c77dff" }, 1000);
        break;
      case "mega":
        add({ kind: "flash", side: cue.side }, 1000);
        add({ kind: "mega", side: cue.side }, 1700);
        zoom(0.08, 900);
        jolt(refOf(cue.side), [{ transform: "scale(1)", filter: "brightness(1)" }, { transform: "scale(0.7)", filter: "brightness(5)", offset: 0.4 }, { transform: "scale(1.2)", filter: "brightness(2)", offset: 0.75 }, { transform: "scale(1)", filter: "brightness(1)" }], 1500);
        break;
      case "zpower":
        add({ kind: "zaura", side: cue.side }, 1400);
        add({ kind: "zbeam", side: cue.side }, 1500);
        zoom(0.05, 900);
        break;
      case "dynamax":
        add({ kind: "cloud", side: cue.side }, 1700);
        add({ kind: "flash", side: cue.side }, 1000);
        zoom(0.1, 1000);
        shakeScene();
        break;
      case "tera":
        add({ kind: "shards", side: cue.side, color: color(cue.type) }, 1700);
        add({ kind: "ring", side: cue.side, color: color(cue.type) }, 1100);
        add({ kind: "flash", side: cue.side }, 900);
        zoom(0.06, 800);
        break;
      case "form":
        add({ kind: "flash", side: cue.side }, 700);
        break;
      case "ability":
      case "item":
        add({ kind: "label", side: cue.side, text: cue.text, color: "#3a86ff" }, 1500);
        break;
      case "miss":
        add({ kind: "label", side: cue.side, text: "MISS", color: "#7d8590" }, 1000);
        break;
      case "hazard":
        add({ kind: "label", side: cue.side, text: cue.text, color: "#b6a136" }, 1200);
        break;
      case "weather":
        if (cue.text) add({ kind: "banner", text: cue.text.replace(/([a-z])([A-Z])/g, "$1 $2"), extra: "turn" }, 1300);
        break;
      case "turn":
        add({ kind: "banner", text: `Turn ${cue.text}`, extra: "turn" }, 1100);
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.id]);

  const meMon = state.sides[mine].active;
  const foeMon = state.sides[foe].active;
  return (
    <div ref={sceneRef} className="pk-scene" data-weather={state.weather} data-terrain={state.terrain} data-theme={theme}>
      <div ref={camRef} className="pk-camera">
        <div className="pk-sky">
          <div className="pk-rays" />
          {clouds.map((c, i) => (
            <i key={i} className="pk-cloud" style={{ ["--y" as string]: c.y, ["--w" as string]: c.w, ["--d" as string]: c.d, ["--dl" as string]: c.dl }} />
          ))}
        </div>
        <div className="pk-hills" />
        <div className="pk-floor" />
        <div className="pk-ground-glow" />
        <div className="pk-platform foe" />
        <div className="pk-platform me" />
        {motes.map((m, i) => (
          <i key={i} className="pk-mote" style={{ ["--x" as string]: m.x, ["--s" as string]: m.s, ["--d" as string]: m.d, ["--dl" as string]: m.dl }} />
        ))}
        <div className="pk-wx rain" /> <div className="pk-wx sun" /> <div className="pk-wx sand" /> <div className="pk-wx snow" /> <div className="pk-wx wind" />
        <MonView mon={foeMon} side="foe" sprites={sprites} anim={foeRef} />
        <MonView mon={meMon} side="me" sprites={sprites} anim={meRef} back />
        {fx.filter((f) => !SCREEN_FX.has(f.kind)).map((f) => (
          <FxView key={f.id} fx={f} mine={mine} />
        ))}
      </div>

      <FieldChips state={state} mine={mine} />
      <HpBox key={`f-${foeMon?.species ?? ""}`} mon={foeMon} side="foe" exact={false} />
      <HpBox key={`m-${meMon?.species ?? ""}`} mon={meMon} side="me" exact />
      {fx.filter((f) => SCREEN_FX.has(f.kind)).map((f) => (
        <FxView key={f.id} fx={f} mine={mine} />
      ))}
      {children}
    </div>
  );
}

function MonView({ mon, side, sprites, anim, back }: { mon: Mon | null; side: "me" | "foe"; sprites: Record<string, SpriteInfo>; anim: React.RefObject<HTMLDivElement | null>; back?: boolean }) {
  const info = mon ? spriteOf(sprites, mon.species) : null;
  return (
    <div
      className={`pk-mon ${side}`}
      data-empty={mon ? "0" : "1"}
      data-fainted={mon?.fainted ? "1" : "0"}
      data-dyna={mon?.dynamax && !mon.gmax ? "1" : "0"}
      data-gmax={mon?.dynamax && mon.gmax ? "1" : "0"}
      data-tera={mon?.tera ? "1" : "0"}
      data-mega={mon?.mega ? "1" : "0"}
      style={{ "--tera": TYPE_COLOR[mon?.tera ?? ""] ?? "#fff" } as CSSProperties}
    >
      <i className="pk-shadow" />
      <div ref={anim} className="pk-anim">
        <div className="pk-mon-inner">{info ? <Sprite info={info} back={back} alt={mon?.species} /> : null}</div>
      </div>
    </div>
  );
}

/** A number that counts up or down to its new value instead of jumping. */
function Tick({ to }: { to: number }) {
  const [v, setV] = useState(to);
  const shown = useRef(to);
  useEffect(() => {
    const from = shown.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 750);
      const e = 1 - Math.pow(1 - p, 3);
      shown.current = Math.round(from + (to - from) * e);
      setV(shown.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}</>;
}

function HpBox({ mon, side, exact }: { mon: Mon | null; side: "me" | "foe"; exact: boolean }) {
  if (!mon) return null;
  const pct = hpPercent(mon);
  const lvl = pct <= 20 ? "low" : pct <= 50 ? "mid" : "hi";
  const boosts = Object.entries(mon.boosts).filter(([, v]) => v !== 0);
  return (
    <div className={`pk-hp ${side}`}>
      <div className="pk-hp-row">
        <span className="pk-hp-name">{mon.species}</span>
        <span style={{ opacity: 0.7 }}>
          {mon.gender === "M" ? "♂" : mon.gender === "F" ? "♀" : ""} Lv{mon.level}
        </span>
        {mon.status ? <span className={`pk-stat ${mon.status}`}>{STATUS_LABEL[mon.status] ?? mon.status}</span> : null}
        {mon.tera ? <span title={`Tera ${mon.tera}`}>💎</span> : null}
        {mon.mega ? <span title="Mega">🧬</span> : null}
        {mon.dynamax ? <span title={mon.gmax ? "Gigantamax" : "Dynamax"}>{mon.gmax ? "🦖" : "🔴"}</span> : null}
      </div>
      <div className="pk-bar">
        <i data-lvl={lvl} style={{ ["--w" as string]: `${pct}%` }} />
      </div>
      <div className="pk-hp-row" style={{ justifyContent: "space-between", marginTop: 2, fontSize: 11, opacity: 0.9 }}>
        <span>
          {exact && mon.maxHp !== 100 ? (
            <>
              <Tick to={mon.hp} />/{mon.maxHp}
            </>
          ) : (
            <>
              <Tick to={pct} />%
            </>
          )}
        </span>
      </div>
      {boosts.length ? (
        <div>
          {boosts.map(([k, v]) => (
            <span key={k} className={`pk-chip ${v > 0 ? "up" : "down"}`}>
              {BOOST_LABEL[k] ?? k} {v > 0 ? "+" : ""}
              {v}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FieldChips({ state, mine }: { state: BState; mine: SideId }) {
  const foe: SideId = mine === "p1" ? "p2" : "p1";
  const chips: string[] = [];
  if (state.weather) chips.push(weatherLabel[state.weather] ?? state.weather);
  if (state.terrain) chips.push(`🌐 ${state.terrain}`);
  for (const r of state.rooms) chips.push(`🔲 ${r}`);
  for (const c of state.sides[foe].conditions) chips.push(`⬆ ${c}`);
  for (const c of state.sides[mine].conditions) chips.push(`⬇ ${c}`);
  if (!chips.length) return null;
  return (
    <div className="pk-field">
      {chips.slice(0, 7).map((c, i) => (
        <span key={c + i}>{c}</span>
      ))}
    </div>
  );
}

function TypeFx({ fx, mine }: { fx: Fx; mine: SideId }) {
  const ref = useRef<HTMLDivElement>(null);
  const type = fx.text ?? "Normal";
  const spec = TYPE_FX[type] ?? TYPE_FX.Normal;
  const color = TYPE_COLOR[type] ?? "#fff";
  const pos = (s: SideId | undefined) => (s === mine ? CENTER.me : CENTER.foe);
  const a = pos(fx.side);
  const b = pos(fx.to ?? fx.side);
  const travel = fx.extra === "travel";
  const base = travel ? 430 : fx.extra === "impact" ? 240 : 80;
  const at = { left: `${b.x}%`, top: `${b.y}%`, ["--dl" as string]: `${base}ms` } as CSSProperties;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-t]").forEach((el) => {
      const j = Number(el.dataset.i ?? 0);
      if (el.dataset.t === "trav") {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - 10;
        el.animate(
          [
            { left: `${a.x}%`, top: `${a.y}%`, opacity: 0, transform: "translate(-50%,-50%) scale(.4)" },
            { opacity: 1, offset: 0.18 },
            { left: `${mx}%`, top: `${my}%`, transform: "translate(-50%,-50%) scale(1)", offset: 0.55 },
            { left: `${b.x}%`, top: `${b.y}%`, opacity: 1, transform: "translate(-50%,-50%) scale(1.25)", offset: 0.92 },
            { left: `${b.x}%`, top: `${b.y}%`, opacity: 0, transform: "translate(-50%,-50%) scale(1.5)" },
          ],
          { duration: 470, delay: j * 55, easing: "ease-in", fill: "both" },
        );
      } else {
        const ang = (j / spec.n) * Math.PI * 2 + (j % 2) * 0.3;
        const r = 46 + (j % 3) * 18;
        let dx = Math.cos(ang) * r;
        let dy = Math.sin(ang) * r;
        if (spec.mode === "up") {
          dx = (Math.random() - 0.5) * 70;
          dy = -(40 + Math.random() * 70);
        } else if (spec.mode === "down") {
          dx = (Math.random() - 0.5) * 60;
          dy = 20 + Math.random() * 60;
        }
        const spin = spec.mode === "spiral" ? 360 : (Math.random() - 0.5) * 120;
        el.animate(
          [
            { transform: "translate(-50%,-50%) scale(.3) rotate(0)", opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.15) rotate(${spin}deg)`, opacity: 0 },
          ],
          { duration: 820, delay: base + j * 28, easing: "ease-out", fill: "both" },
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emoji = (i: number) => spec.e[i % spec.e.length];
  return (
    <div ref={ref} className="pk-fx-root" style={{ ["--c" as string]: color }}>
      {travel
        ? Array.from({ length: 6 }).map((_, i) => (
            <span key={`t${i}`} data-t="trav" data-i={i} className="pk-em" style={{ left: `${a.x}%`, top: `${a.y}%`, ["--sz" as string]: `${spec.size}px` }}>
              {emoji(i)}
            </span>
          ))
        : null}
      {Array.from({ length: spec.n }).map((_, i) => (
        <span key={`i${i}`} data-t="imp" data-i={i} className="pk-em" style={{ left: `${b.x}%`, top: `${b.y}%`, ["--sz" as string]: `${spec.size}px` }}>
          {emoji(i)}
        </span>
      ))}
      <div className="pk-shock" style={at} />
      {type === "Electric" ? (
        <svg className="pk-bolt" viewBox="0 0 40 100" style={at}>
          <polyline points="22,0 8,46 20,46 10,100 34,38 22,38 32,0" fill="#fff6a0" stroke={color} strokeWidth="3" strokeLinejoin="round" />
        </svg>
      ) : null}
      {fx.extra === "impact" && SLASH_TYPES.has(type) ? (
        <div className="pk-slash" style={at}>
          <i /> <i /> <i />
        </div>
      ) : null}
    </div>
  );
}

function FxView({ fx, mine }: { fx: Fx; mine: SideId }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = (s: SideId | undefined) => (s === mine ? CENTER.me : CENTER.foe);
  const at = pos(fx.side);
  const c = fx.color ?? "#fff";
  const dl = fx.delay ? `${fx.delay}ms` : undefined;
  const style: CSSProperties = { left: `${at.x}%`, top: `${at.y}%`, ["--c" as string]: c, animationDelay: dl };

  useEffect(() => {
    if (fx.kind !== "ball" || !ref.current) return;
    const start = fx.side === mine ? { x: 2, y: 98 } : { x: 98, y: 8 };
    const end = pos(fx.side);
    ref.current.animate(
      [
        { left: `${start.x}%`, top: `${start.y}%`, opacity: 1, transform: "translate(-50%,-50%) rotate(0deg) scale(.8)" },
        { left: `${(start.x + end.x) / 2}%`, top: `${Math.min(start.y, end.y) - 24}%`, offset: 0.5, transform: "translate(-50%,-50%) rotate(360deg) scale(1)" },
        { left: `${end.x}%`, top: `${end.y}%`, opacity: 1, offset: 0.86, transform: "translate(-50%,-50%) rotate(700deg) scale(1)" },
        { left: `${end.x}%`, top: `${end.y}%`, opacity: 0, transform: "translate(-50%,-50%) rotate(720deg) scale(1.8)" },
      ],
      { duration: 520, easing: "ease-in-out", fill: "both" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  switch (fx.kind) {
    case "ring": return <div className="pk-fx pk-ring" style={style} />;
    case "mega": return <div className="pk-fx pk-mega-ring" style={style} />;
    case "flash": return <div className="pk-fx pk-flash" style={{ ["--x" as string]: `${at.x}%`, ["--y" as string]: `${at.y}%`, animationDelay: dl }} />;
    case "zbeam": return <div className="pk-fx pk-zbeam" style={{ ...style, top: `${at.y + 18}%` }} />;
    case "zaura": return <div className="pk-fx pk-zaura" style={style} />;
    case "cloud": return <div className="pk-fx pk-dyna-cloud" style={style} />;
    case "aura": return <div className="pk-fx pk-aura" style={style} />;
    case "ball": return <div ref={ref} className="pk-ballfx" style={{ left: `${at.x}%`, top: `${at.y}%` }} />;
    case "typefx": return <TypeFx fx={fx} mine={mine} />;
    case "shards":
      return (
        <>
          {Array.from({ length: 12 }).map((_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            const r = 90 + (i % 3) * 30;
            return <div key={i} className="pk-fx pk-shard" style={{ ...style, ["--dx" as string]: `${Math.cos(ang) * r}px`, ["--dy" as string]: `${Math.sin(ang) * r}px`, ["--r" as string]: `${i * 40}deg`, animationDelay: `${(i % 4) * 40}ms` }} />;
          })}
        </>
      );
    case "sparks":
    case "burst":
      return (
        <>
          {Array.from({ length: 10 }).map((_, i) => {
            const ang = (i / 10) * Math.PI * 2 + (fx.kind === "sparks" ? 0 : 0.3);
            const r = fx.kind === "sparks" ? 40 : 60;
            return <div key={i} className="pk-fx pk-spark burst" style={{ ...style, ["--dx" as string]: `${Math.cos(ang) * r}px`, ["--dy" as string]: `${(fx.kind === "sparks" ? -Math.abs(Math.sin(ang)) : Math.sin(ang)) * r}px` }} />;
          })}
        </>
      );
    case "arrow": return <div className={`pk-fx pk-arrow ${fx.up ? "" : "down"}`} style={style}>{fx.text}{fx.text}</div>;
    case "label": return <div className="pk-fx pk-pop-label" style={{ ...style, top: `${at.y - 24}%`, background: c }}>{fx.text}</div>;
    case "num": return <div className={`pk-float-num ${fx.extra ?? ""}`} style={{ left: `${at.x}%`, top: `${at.y - 6}%` }}>{fx.text}</div>;
    case "banner": return <div className={`pk-banner ${fx.extra ?? ""}`}>{fx.text}</div>;
    case "band":
      return (
        <div className="pk-band" style={{ ["--c" as string]: c }}>
          <b>{fx.text}</b>
        </div>
      );
    default: return null;
  }
}

/* ================================================================ VS intro */

export function VsIntro({ names, people, you, onDone }: { names: { p1: string; p2: string }; people: { p1: PersonLite | null; p2: PersonLite | null }; you: SideId | null; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 2300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const left: SideId = you === "p2" ? "p2" : "p1";
  const right: SideId = left === "p1" ? "p2" : "p1";
  const card = (s: SideId, cls: string) => (
    <div className={`pk-vs-card ${cls}`}>
      <Avatar name={names[s]} url={people[s]?.avatarUrl} size={72} />
      <span>{names[s]}</span>
    </div>
  );
  return (
    <div className="pk-vs" onClick={onDone} role="button" aria-label="skip intro">
      <div className="pk-vs-row">
        {card(left, "")}
        <div className="pk-vs-mid">VS</div>
        {card(right, "r")}
      </div>
    </div>
  );
}

/* ========================================================= action panel */

type Gimmick = "mega" | "megax" | "megay" | "ultra" | "zmove" | "dynamax" | "terastallize";

/**
 * The move picker. It stays on screen (stuck to the bottom on phones, to the side on wide screens),
 * so there is no scrolling to find your moves. Keys: 1–4 pick a move, S switches, G toggles the gimmick, Esc cancels.
 */
export function ActionPanel({
  view,
  state,
  moves,
  sprites,
  busy,
  locked,
  className = "",
  onChoose,
  onForfeit,
  onClaim,
}: {
  view: BattleView;
  state: BState;
  moves: Record<string, MoveInfo>;
  sprites: Record<string, SpriteInfo>;
  busy: boolean;
  locked: boolean;
  className?: string;
  onChoose: (choice: string) => void;
  onForfeit: () => void;
  onClaim: () => void;
}) {
  const { t } = useT();
  const [gimmick, setGimmick] = useState<Gimmick | null>(null);
  const [showSwitch, setShowSwitch] = useState(false);
  const [hint, setHint] = useState("");
  const req: BattleRequest | null = view.request;
  const you = view.you;
  const act = req?.active?.[0];
  const disabled = busy || locked;
  const forced = !!req?.forceSwitch?.some(Boolean);
  const canAct = !!you && view.status === "active" && !!req && !req.wait && !view.chosen;

  const toggles = useMemo(() => {
    const list: { id: Gimmick; icon: string; bn: string; en: string }[] = [];
    if (!act) return list;
    if (act.canMegaEvo) list.push({ id: "mega", icon: "🧬", bn: "মেগা", en: "Mega" });
    if (act.canMegaEvoX) list.push({ id: "megax", icon: "🧬", bn: "মেগা X", en: "Mega X" });
    if (act.canMegaEvoY) list.push({ id: "megay", icon: "🧬", bn: "মেগা Y", en: "Mega Y" });
    if (act.canUltraBurst) list.push({ id: "ultra", icon: "🌟", bn: "আল্ট্রা বার্স্ট", en: "Ultra Burst" });
    if (act.canZMove?.some(Boolean)) list.push({ id: "zmove", icon: "✨", bn: "জেড-মুভ", en: "Z-Move" });
    if (act.canDynamax) list.push({ id: "dynamax", icon: act.maxMoves?.gigantamax ? "🦖" : "🔴", bn: act.maxMoves?.gigantamax ? "গিগান্টাম্যাক্স" : "ডায়ানাক্স", en: act.maxMoves?.gigantamax ? "Gigantamax" : "Dynamax" });
    if (act.canTerastallize) list.push({ id: "terastallize", icon: "💎", bn: `টেরা (${act.canTerastallize})`, en: `Tera (${act.canTerastallize})` });
    return list;
  }, [act]);

  useEffect(() => {
    setGimmick(null);
    setShowSwitch(false);
    setHint("");
  }, [view.rev]);

  useEffect(() => {
    if (!canAct || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const k = e.key.toLowerCase();
      if (k >= "1" && k <= "4") document.querySelector<HTMLButtonElement>(`[data-move="${Number(k) - 1}"]`)?.click();
      else if (k === "s") setShowSwitch((v) => !v);
      else if (k === "g" && toggles.length) setGimmick((g) => (g ? null : toggles[0].id));
      else if (k === "escape") {
        setShowSwitch(false);
        setGimmick(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAct, disabled, toggles]);

  if (!you || view.status !== "active") return null;

  const footer = (
    <div className="mt-2 flex flex-wrap items-center gap-3 font-sans text-[11px] text-subtle">
      <button type="button" onClick={() => window.confirm(t("সত্যিই হার মানবেন?", "Really forfeit?")) && onForfeit()} className="pressable underline-offset-4 hover:text-nsfw hover:underline">
        🏳️ {t("হার মানুন", "Forfeit")}
      </button>
      {view.canClaimTimeout ? (
        <button type="button" onClick={onClaim} className="pressable rounded-full bg-accent px-3 py-1 text-accent-fg">
          ⏱ {t("প্রতিপক্ষ সাড়া দিচ্ছে না — জয় দাবি করুন", "Opponent isn't responding — claim the win")}
        </button>
      ) : null}
    </div>
  );

  if (!canAct) {
    return (
      <div className={`pk-dock ${className}`}>
        <p className="flex items-center gap-2 font-sans text-sm text-muted">
          <span className="pk-dots" aria-hidden="true"><span /><span /><span /></span>
          {locked ? t("লড়াই চলছে…", "Battle in progress…") : view.cpu ? t("CPU ভাবছে…", "CPU is thinking…") : t("প্রতিপক্ষের চালের অপেক্ষায়…", "Waiting for your opponent…")}
        </p>
        {footer}
      </div>
    );
  }

  const bench =
    req?.side?.pokemon
      .map((p, i) => ({ p, slot: i + 1 }))
      .filter(({ p }) => !p.active && !p.condition.endsWith(" fnt")) ?? [];
  const switchList = (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {bench.map(({ p, slot }) => {
        const species = p.details.split(",")[0];
        const [hp] = p.condition.split(" ");
        const [a, b] = hp.split("/").map(Number);
        const pct = b ? Math.round((a / b) * 100) : 100;
        const st = p.condition.split(" ")[1];
        return (
          <li key={slot}>
            <button type="button" disabled={disabled} onClick={() => onChoose(`switch ${slot}`)} className="pressable flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 p-2 text-left hover:bg-surface disabled:opacity-50">
              <Sprite info={spriteOf(sprites, species)} still className="size-11 object-contain" />
              <span className="min-w-0 flex-1 font-sans text-sm">
                <b className="block truncate">{species}</b>
                <span className="block h-1.5 overflow-hidden rounded-full bg-bg"><i className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct > 50 ? "#4cd964" : pct > 20 ? "#ffcc00" : "#ff3b30" }} /></span>
                <span className="text-[11px] text-muted">{pct}% {st ? `· ${st.toUpperCase()}` : ""}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  if (forced) {
    return (
      <div className={`pk-dock ${className}`}>
        <p className="pk-ribbon">🔁 {t("কাকে মাঠে পাঠাবেন?", "Who comes in next?")}</p>
        <div className="mt-2 max-h-[46vh] overflow-y-auto">{switchList}</div>
        {footer}
      </div>
    );
  }
  if (!act) return <div className={`pk-dock ${className}`}>…{footer}</div>;

  const foeSide: SideId = you === "p1" ? "p2" : "p1";
  const foeMon = state.sides[foeSide].active;
  const foeTypes = foeMon ? (foeMon.tera ? [foeMon.tera] : sprites[foeMon.species]?.types ?? []) : [];
  const maxMoves = act.maxMoves?.maxMoves;
  const dynamaxed = !!maxMoves && !act.canDynamax;

  return (
    <div className={`pk-dock ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="pk-ribbon">⚔️ {t("আপনার চাল!", "Your move!")}</span>
        {toggles.map((g) => (
          <button key={g.id} type="button" disabled={disabled} data-on={gimmick === g.id ? "1" : "0"} onClick={() => setGimmick(gimmick === g.id ? null : g.id)} className="pk-gbtn">
            {g.icon} {t(g.bn, g.en)}
          </button>
        ))}
        <button type="button" onClick={() => setShowSwitch((v) => !v)} disabled={disabled || act.trapped || bench.length === 0} className="pk-gbtn ml-auto" title={t("পোকেমন বদলান (S)", "Switch Pokémon (S)")}>
          🔁 {act.trapped ? t("আটকে", "Trapped") : t("বদলান", "Switch")}
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {act.moves.map((m, i) => {
          const base = moves[m.id];
          const useMax = dynamaxed || gimmick === "dynamax";
          const useZ = gimmick === "zmove";
          const z = act.canZMove?.[i] ?? null;
          const label = useMax && maxMoves?.[i] ? maxMoves[i].move : useZ && z ? z.move : m.move;
          const off = !!m.disabled || (useZ && !z) || (useMax && !!maxMoves?.[i]?.disabled);
          const col = TYPE_COLOR[base?.type ?? ""] ?? "#68a090";
          const mult = base && base.cat !== "Status" && foeTypes.length && view.gen >= 6 ? typeMult(base.type, foeTypes) : 1;
          const suffix = gimmick && !dynamaxed ? ` ${gimmick}` : "";
          return (
            <li key={m.id + i}>
              <button
                type="button"
                data-move={i}
                disabled={disabled || off}
                onClick={() => onChoose(`move ${i + 1}${suffix}`)}
                onMouseEnter={() => setHint(base?.desc ?? "")}
                onFocus={() => setHint(base?.desc ?? "")}
                onMouseLeave={() => setHint("")}
                className={`pk-move w-full ${gimmick ? "gimmick-on" : ""}`}
                style={{ ["--c" as string]: col }}
              >
                <b className="flex items-center justify-between gap-2">
                  <span className="truncate">{label}</span>
                  <span className="pk-kbd">{i + 1}</span>
                </b>
                <small>
                  {base ? <TypeBadge type={base.type} small /> : null}
                  {base ? <span>{base.cat === "Status" ? "—" : base.cat === "Physical" ? "⚔️" : "✴️"} {base.bp || "—"}</span> : null}
                  {m.pp !== undefined ? <span>PP {m.pp}/{m.maxpp}</span> : null}
                  {mult >= 2 ? <span className="tag se">×{mult}</span> : mult === 0 ? <span className="tag imm">×0</span> : mult < 1 ? <span className="tag nve">×{mult}</span> : null}
                </small>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 min-h-[2.1em] font-sans text-[11px] leading-snug text-muted">{hint || t("চালের ওপর মাউস রাখলে বিবরণ দেখা যাবে · কিবোর্ড: 1–4 চাল, S বদল, G গিমিক", "Hover a move for details · keys: 1–4 move, S switch, G gimmick")}</p>
      {showSwitch ? (
        <div className="pk-sheet">
          <div className="mb-2 flex items-center justify-between font-sans text-sm">
            <b>{t("পোকেমন বদলান", "Switch Pokémon")}</b>
            <button type="button" onClick={() => setShowSwitch(false)} className="pressable text-muted">✕</button>
          </div>
          {switchList}
        </div>
      ) : null}
      {footer}
    </div>
  );
}

/* =============================================================== roster */

export function Roster({ state, side, you }: { state: BState; side: SideId; you: SideId | null }) {
  const s = state.sides[side];
  const total = Math.max(s.size, s.team.length);
  const dots = Array.from({ length: total }, (_, i) => s.team[i] ?? null);
  return (
    <div className="flex items-center gap-1.5" title={s.name}>
      <span className="mr-1 max-w-28 truncate font-sans text-xs text-muted">{you === side ? "★ " : ""}{s.name}</span>
      {dots.map((m, i) => (
        <span key={i} className="pk-mini" data-s={!m || !m.revealed ? "hidden" : m.fainted ? "fnt" : s.active === m ? "out" : "alive"} title={m?.revealed ? m.species : "?"} />
      ))}
    </div>
  );
}

/* ================================================================== log */

export type LogLine = { id: number; text: string };
export function BattleLog({ lines }: { lines: LogLine[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div ref={box} className="pk-log" aria-live="polite">
      {lines.slice(-140).map((l) => (
        <p key={l.id} className={l.text.startsWith("——") ? "turn" : l.text.startsWith("🏆") ? "win" : undefined}>
          {l.text}
        </p>
      ))}
    </div>
  );
}

/* ================================================================ result */

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: `${Math.random() * 100}%`,
        s: `${6 + Math.random() * 8}px`,
        d: `${2.6 + Math.random() * 2.4}s`,
        delay: `${-Math.random() * 4}s`,
        dx: `${(Math.random() - 0.5) * 160}px`,
        r: `${360 + Math.random() * 720}deg`,
        c: ["#ffcb05", "#ff4d6d", "#4aa8ff", "#36d27b", "#b46bff", "#ff9f1c"][i % 6],
      })),
    [],
  );
  return (
    <div className="pk-confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ ["--x" as string]: b.x, ["--s" as string]: b.s, ["--d" as string]: b.d, ["--delay" as string]: b.delay, ["--dx" as string]: b.dx, ["--r" as string]: b.r, ["--c" as string]: b.c }} />
      ))}
    </div>
  );
}
function FallingStuff() {
  const bits = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        x: `${Math.random() * 100}%`,
        s: `${22 + Math.random() * 20}px`,
        d: `${2.4 + Math.random() * 2}s`,
        delay: `${-Math.random() * 4}s`,
        r: `${(Math.random() - 0.5) * 900}deg`,
        e: ["🍅", "💀", "🥀", "😭", "🍅", "📉"][i % 6],
      })),
    [],
  );
  return (
    <div className="pk-rain" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ ["--x" as string]: b.x, ["--s" as string]: b.s, ["--d" as string]: b.d, ["--delay" as string]: b.delay, ["--r" as string]: b.r }}>{b.e}</i>
      ))}
    </div>
  );
}

function Wave({ text }: { text: string }) {
  return (
    <span className="pk-fx-wave" aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={i} style={{ ["--i" as string]: i }}>{ch === " " ? "\u00a0" : ch}</span>
      ))}
    </span>
  );
}

export function ResultOverlay({ view, state, onReplay, onRematch }: { view: BattleView; state: BState; onReplay: () => void; onRematch?: () => void }) {
  const { t, lang } = useT();
  const winner = view.winner;
  const you = view.you;
  const outcome: "win" | "lose" | "draw" = winner === "tie" || !winner ? "draw" : !you ? "win" : winner === you ? "win" : "lose";
  const winnerName = winner === "p1" || winner === "p2" ? view.names[winner] : "";
  const winSide = winner === "p1" || winner === "p2" ? winner : null;
  const size = winSide ? Math.max(state.sides[winSide].size, state.sides[winSide].team.length) : 0;
  const left = winSide ? view.left[winSide] : null;
  const flawless = outcome !== "draw" && view.endReason === "normal" && left != null && size > 0 && left === size;
  const photoFinish = outcome !== "draw" && view.endReason === "normal" && left === 1 && size > 1;
  const list = outcome === "lose" ? LOSE_LINES : flawless ? FLAWLESS_LINES : photoFinish ? CLOSE_LINES : WIN_LINES;
  const line = pickLine(list, view.id);
  const pickText = (p: readonly [string, string]) => (lang === "en" ? p[1] : p[0]);
  const reason = view.endReason === "forfeit" ? t("(হার মেনে নেওয়ায়)", "(by forfeit)") : view.endReason === "timeout" ? t("(সময় শেষ হওয়ায়)", "(by timeout)") : "";

  return (
    <div className={`pk-result ${outcome}`}>
      {outcome === "win" ? <Confetti /> : outcome === "lose" ? <FallingStuff /> : null}
      <div className="pk-result-inner">
        <div className={outcome === "lose" ? "pk-skull" : "pk-trophy"} aria-hidden="true">{outcome === "lose" ? "💀" : outcome === "draw" ? "🤝" : "🏆"}</div>
        <h2 className={`pk-big ${outcome}`}>
          {outcome === "win" ? (you ? t("জয়!", "VICTORY!") : winnerName) : outcome === "lose" ? t("হার!", "DEFEAT") : t("ড্র!", "DRAW")}
        </h2>
        {outcome !== "draw" ? (
          <p className={`pk-troll ${outcome === "lose" ? "lose" : ""}`}>
            {you ? pickText(line) : `${winnerName} ${t("জিতেছে!", "wins!")}`}
          </p>
        ) : null}
        {flawless && you === winner ? (
          <p className="mt-2 font-display text-xl"><span className="pk-fx-rainbow"><Wave text={t("ফ্ললেস ভিক্টরি 👑", "FLAWLESS VICTORY 👑")} /></span></p>
        ) : null}
        <p className="mt-3 font-sans text-sm text-white/80">
          {winnerName ? `${winnerName} ${t("জিতেছে", "won")} · ` : ""}
          {t("টার্ন", "Turn")} {view.turn} {reason}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 font-sans text-sm">
          <Link to="/pokemon" className="pressable rounded-full bg-white/90 px-4 py-2 text-black">{t("লবিতে ফিরুন", "Back to lobby")}</Link>
          <Link to="/pokemon/board" className="pressable rounded-full border border-white/40 px-4 py-2 text-white">{t("বোর্ড দেখুন", "See the board")}</Link>
          <button type="button" onClick={onReplay} className="pressable rounded-full border border-white/40 px-4 py-2 text-white">↺ {t("রিপ্লে", "Replay")}</button>
          {onRematch ? <button type="button" onClick={onRematch} className="pressable rounded-full bg-accent px-4 py-2 text-accent-fg">⚔️ {t("আবার লড়ুন", "Rematch")}</button> : null}
        </div>
      </div>
    </div>
  );
}
