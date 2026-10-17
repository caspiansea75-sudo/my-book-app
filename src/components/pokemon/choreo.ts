/**
 * Who does what, and when, for every kind of move. Each move is staged in its own way:
 *
 *   physical  wind-up → rush → CONTACT: white flash, a few frames of freeze, knockback, sparks flying off, shake
 *   special   charge (light is pulled in) → a glowing core flies out leaving a trail → burst through the target,
 *             a reaction, embers that linger
 *   status    on yourself: heal / guard / power-up / roar each look different; on the foe: a wave that lands and drags them down;
 *             on the field: a sweep of colour (weather, terrain, hazards, screens)
 *
 * The result of a move (the "hit" cue) arrives 760 ms after the move cue, so every attack is timed to make
 * contact at CONTACT, a hair before it. Times are written for normal speed and shortened by T() when the
 * battle is played at 2×.
 */
import type { Cue, SideId } from "@/lib/pokemon/protocol";
import { TYPE_COLOR } from "@/lib/pokemon/shared";
import { AILMENT_RX, FIELD_RX, motionFor, type Motion } from "@/lib/pokemon/motion";
import { attackAnim, fk, reactAnim } from "@/components/pokemon/anims";
import * as J from "@/components/pokemon/juice";

export type FxKind = "ring" | "mega" | "flash" | "zbeam" | "zaura" | "cloud" | "shards" | "sparks" | "arrow" | "label" | "num" | "banner" | "aura" | "burst" | "typefx" | "ball" | "band" | "shield";
export type Fx = { id: number; kind: FxKind; side?: SideId; to?: SideId; color?: string; text?: string; up?: boolean; extra?: string; delay?: number; t0?: number; dur?: number; type?: string };
export type LastMove = { from: SideId; to: SideId; type: string; cat: string; name: string; motion: Motion };

export type Ctx = {
  mine: SideId;
  layer: HTMLElement | null;
  scene: HTMLElement | null;
  /** The element the move and reaction animations play on. */
  anim: (s: SideId) => HTMLElement | null;
  /** The element that gets knocked back and flashed white. */
  kb: (s: SideId) => HTMLElement | null;
  /** Shortens a time for 2× playback. */
  T: (ms: number) => number;
  add: (f: Omit<Fx, "id">, ms?: number) => void;
  zoom: (amount: number, ms?: number) => void;
  last: { current: LastMove | null };
};

export const CENTER = { me: { x: 27, y: 62 }, foe: { x: 72, y: 33 } };
export const posOf = (ctx: Ctx, s: SideId | undefined): J.Pt => (s === ctx.mine ? CENTER.me : CENTER.foe);
const other = (ctx: Ctx, s: SideId): SideId => (s === ctx.mine ? (ctx.mine === "p1" ? "p2" : "p1") : ctx.mine);
const color = (type?: string) => TYPE_COLOR[type ?? ""] ?? "#ffffff";
const wait = (ms: number, fn: () => void) => window.setTimeout(fn, ms);

/** When an attack makes contact, in ms after the move cue (the hit cue lands at 760). */
const CONTACT = 690;
/** How long a spell charges before it is released. */
const CHARGE = 340;
/** Where in each rush the contact happens (as a fraction of the animation). */
const CONTACT_AT: Partial<Record<Motion, number>> = { dash: 0.42, jump: 0.62, spin: 0.5, dig: 0.7, bite: 0.3, uppercut: 0.5, slam: 0.5, quake: 0.45 };

const DEBRIS: Record<string, string[]> = {
  Fire: ["🔥"], Water: ["💧"], Electric: ["⚡"], Grass: ["🍃"], Ice: ["❄️"], Fighting: ["💥", "⭐"], Rock: ["🪨"], Ground: ["🪨", "💨"],
  Poison: ["🟣"], Bug: ["🐝"], Normal: ["⭐", "💥"], Flying: ["🪶"], Psychic: ["✨"], Ghost: ["👻"], Dragon: ["🔥", "✨"], Dark: ["💢"], Steel: ["⚙️", "✨"], Fairy: ["💖", "✨"],
};
const HAZARD_GLYPH: Record<string, string> = { "stealth rock": "🪨", spikes: "▲", "toxic spikes": "☠️", "sticky web": "🕸️" };

/* ------------------------------------------------------------------------- move */

export function playMove(ctx: Ctx, cue: Cue) {
  const { T } = ctx;
  const from = cue.from ?? ctx.mine;
  const to = cue.side ?? other(ctx, from);
  const type = cue.moveType ?? "Normal";
  const cat = cue.cat ?? "Physical";
  const name = cue.moveName ?? "";
  const c = color(type);
  const A = posOf(ctx, from);
  const B = posOf(ctx, to);
  const dir = from === ctx.mine ? { x: 42, y: -26 } : { x: -42, y: 26 };
  const sg = dir.x > 0 ? 1 : -1;
  const motion = motionFor(name, type, cat);
  ctx.last.current = { from, to, type, cat, name, motion };
  ctx.add({ kind: "band", side: from, text: name, color: c, type, extra: from === ctx.mine ? "me" : "foe" }, 1400);
  const attacker = ctx.anim(from);

  if (cat === "Status") {
    status(ctx, { from, to, type, name, motion, c, A, B });
    return;
  }

  if (cat === "Special") {
    // charge: lean back, glow, light pulled in
    const launch = T(CHARGE + 30);
    const flight = Math.max(T(CONTACT) - launch, 160);
    const a = attackAnim("charge", dir, c);
    attacker?.animate(a.frames, { duration: launch / 0.7, easing: "ease-in-out" });
    J.converge(ctx.layer, A, c, 16, T(CHARGE), 96);
    // release: a flash at the caster, then the core flies
    J.ringWave(ctx.layer, A, c, T(420), launch, 54);
    J.sparkBurst(ctx.layer, A, c, 8, [20, 52], T(380), launch);
    J.core(ctx.layer, A, B, { color: c, type, ms: flight, delay: launch });
    J.trail(ctx.layer, A, B, { color: c, type, ms: flight, delay: launch, n: 18 });
    ctx.add({ kind: "typefx", side: from, to, text: type, extra: "travel", t0: launch, dur: flight }, 1800);
    return;
  }

  // ---- physical: wind-up, then a rush that makes contact exactly when the result lands
  const anim = attackAnim(motion, dir, c);
  const dur = T(anim.ms);
  const frac = CONTACT_AT[motion] ?? 0.42;
  const delay = Math.max(0, T(CONTACT) - frac * dur);
  const crouch = fk(0, -sg * 5, 3, 0, 1.06, 0.88, 1.2, c, 8);
  if (delay > 60) {
    attacker?.animate(
      [fk(0, 0, 0), fk(0.4, -sg * 3, 2, 0, 1.04, 0.92, 1.1), { ...crouch, offset: 0.75 }, { ...crouch, offset: 1 }],
      { duration: delay, easing: "ease-out" },
    );
  }
  const frames = anim.frames.map((f) => ({ ...f }));
  frames[0] = { ...crouch, offset: 0 };
  attacker?.animate(frames, { duration: dur, delay, easing: "ease-in-out" });
  if (motion !== "dig" && motion !== "quake" && motion !== "jump") J.speedLines(ctx.layer, A, B, c, 7, T(CONTACT) - dur * frac * 0.9, T(320));
}

/* --------------------------------------------------------------------- status */

type StatusArgs = { from: SideId; to: SideId; type: string; name: string; motion: Motion; c: string; A: J.Pt; B: J.Pt };

function status(ctx: Ctx, a: StatusArgs) {
  const { T } = ctx;
  const { from, to, type, name, motion, c, A, B } = a;
  const attacker = ctx.anim(from);
  const lower = name.toLowerCase();
  const anim = attackAnim(motion, from === ctx.mine ? { x: 42, y: -26 } : { x: -42, y: 26 }, c);
  attacker?.animate(anim.frames, { duration: T(anim.ms), easing: "ease-in-out" });

  // a move that changes the whole field: weather, terrain, hazards, screens
  if (FIELD_RX.test(lower)) {
    ctx.add({ kind: "aura", side: from, color: c }, 1000);
    J.sweep(ctx.layer, c, from === ctx.mine, T(1000));
    const glyph = HAZARD_GLYPH[lower];
    if (glyph) {
      for (let i = 0; i < J.cnt(7); i++) J.spawn(ctx.layer, { at: { x: B.x + J.rnd(-9, 9), y: B.y + 8 }, shape: "glyph", glyph, size: J.rnd(14, 20), from: [J.rnd(-10, 10), -150], to: [J.rnd(-10, 10), 6], ms: T(520), delay: T(380) + i * T(70), s0: 1, s1: 1, ease: "cubic-bezier(.5,0,.9,.5)" });
      J.sparkBurst(ctx.layer, B, c, 10, [20, 60], T(500), T(800));
    } else if (/(rain|hail|snow|chilly)/.test(lower)) {
      for (let i = 0; i < J.cnt(18); i++) J.spawn(ctx.layer, { at: { x: J.rnd(5, 95), y: 5 }, shape: "streak", color: c, size: 10, angle: 100, from: [0, -10], to: [-12, 260], ms: T(J.rnd(420, 640)), delay: T(250) + i * T(32), s0: 1, s1: 1, o: 0.8 });
    } else if (/(reflect|light screen|veil|safeguard|mist|lucky)/.test(lower)) {
      ctx.add({ kind: "shield", side: from, color: c }, 1500);
      J.ringWave(ctx.layer, A, c, T(700), T(200), 90);
    }
    return;
  }

  // on the user: guard, heal, power up, roar
  if (to === from) {
    ctx.add({ kind: "aura", side: from, color: c }, 1000);
    ctx.add({ kind: "typefx", side: from, to: from, text: type, extra: "self" }, 1700);
    J.tint(attacker, c, T(900));
    if (motion === "heal") {
      J.risers(ctx.layer, A, "#6df08a", { n: 12, glyph: "+", ms: T(1100) });
      J.glow(ctx.layer, A, "#6df08a", 80, T(900), 0, 0.6);
      J.ringWave(ctx.layer, A, "#6df08a", T(700), T(120), 70);
    } else if (motion === "curl") {
      ctx.add({ kind: "shield", side: from, color: c }, 1400);
      J.ringWave(ctx.layer, A, c, T(600), 0, 76);
      J.ringWave(ctx.layer, A, "#fff", T(600), T(140), 60);
      J.sparkBurst(ctx.layer, A, c, 12, [30, 62], T(500), T(100));
    } else if (motion === "roar") {
      [0, 160, 320].forEach((d) => ctx.add({ kind: "ring", side: from, color: c, delay: d }, 1400));
      for (let i = 0; i < J.cnt(14); i++) {
        const ang = (i / 14) * Math.PI * 2;
        J.spawn(ctx.layer, { at: A, shape: "streak", color: i % 2 ? "#fff" : c, size: 11, from: [Math.cos(ang) * 30, Math.sin(ang) * 26], to: [Math.cos(ang) * 96, Math.sin(ang) * 82], ms: T(520), delay: T(140), s1: 0.3 });
      }
      J.shakeScene(ctx.scene, 2.5, T(380), T(140));
    } else {
      J.spiral(ctx.layer, A, c, 20, T(1100));
      J.risers(ctx.layer, A, c, { n: 6, glyph: "▲", ms: T(1000) });
      J.ringWave(ctx.layer, A, c, T(700), T(300), 70);
    }
    return;
  }

  // aimed at the foe: a wave that crosses the field, lands, and weighs them down
  ctx.add({ kind: "aura", side: from, color: c }, 800);
  const launch = T(160);
  const flight = T(390);
  J.core(ctx.layer, A, B, { color: c, type: "Psychic", ms: flight, delay: launch, size: 24 });
  J.trail(ctx.layer, A, B, { color: c, type, ms: flight, delay: launch, n: 10 });
  const land = launch + flight;
  const victim = ctx.anim(to);
  wait(land, () => {
    J.ringWave(ctx.layer, B, c, T(620), 0, 80);
    J.glow(ctx.layer, B, c, 82, T(800), 0, 0.7);
    J.sparkBurst(ctx.layer, B, c, 10, [24, 56], T(560));
    J.tint(victim, c, T(900));
    // it sags: the target is dragged down a little
    victim?.animate([fk(0, 0, 0), fk(0.3, 0, 4, 0, 1.04, 0.93, 0.8), fk(0.7, 0, 3, 0, 1.02, 0.96, 0.9), fk(1, 0, 0)], { duration: T(700), easing: "ease-in-out" });
    if (AILMENT_RX.test(lower)) J.risers(ctx.layer, B, c, { n: 7, glyph: "▼", down: true, ms: T(900) });
  });
}

/* ------------------------------------------------------------------------ hit */

export function playHit(ctx: Ctx, cue: Cue) {
  const { T } = ctx;
  const side = cue.side;
  if (!side) return;
  const target = ctx.kb(side);
  const attackerSide = other(ctx, side);
  const B = posOf(ctx, side);
  const A = posOf(ctx, attackerSide);
  const amount = cue.amount ?? 0;

  // damage from poison, recoil, weather…: just a flinch, no big hit
  if (cue.text) {
    J.whiteFlash(target, 60);
    ctx.add({ kind: "burst", side, color: "#ffffff" }, 800);
    return;
  }

  const last = ctx.last.current;
  const type = cue.moveType ?? last?.type ?? "Normal";
  const cat = last?.cat ?? "Physical";
  const c = color(type);
  const crit = cue.effect === "crit";
  const power = Math.min(1.3, Math.max(0.15, amount / 45) + (crit ? 0.3 : 0));
  const dir = J.dirOf(ctx.layer, A, B);
  const stop = Math.round(T((cat === "Special" ? 36 : 56) + power * 62 + (crit ? 40 : 0)));
  const special = cat === "Special";

  // 1. the instant it lands: the target goes white and everything freezes for a few frames
  J.whiteFlash(target, stop + 24);
  J.hitStop(ctx.scene, stop);

  // 2. then the blow plays out
  wait(stop, () => {
    const react = reactAnim(type, side === ctx.mine ? -1 : 1);
    ctx.anim(side)?.animate(react.frames, { duration: T(react.ms), easing: "ease-out" });
    J.knock(target, dir, (special ? 9 : 14) + power * (special ? 20 : 30), T(560));
    J.recoil(ctx.kb(attackerSide), dir, special ? 3 : 6 + power * 7, T(300));
    const glyphs = DEBRIS[type] ?? DEBRIS.Normal!;
    if (special) {
      J.burstThrough(ctx.layer, B, dir, c, Math.round(14 + power * 10));
      J.tint(ctx.anim(side), c, T(1100));
      J.aftermath(ctx.layer, B, c, T(1500), T(180));
      J.shakeScene(ctx.scene, 1.5 + power * 3, T(300));
      ctx.add({ kind: "typefx", side: attackerSide, to: side, text: type, extra: "land" }, 1700);
    } else {
      J.impactStar(ctx.layer, B, crit ? "#ffd54a" : "#fff", 64 + power * 52);
      J.glow(ctx.layer, B, c, 70 + power * 30, T(380), 0, 0.8);
      J.spray(ctx.layer, B, dir, { n: Math.round(10 + power * 12), color: c, power, glyphs });
      J.shakeScene(ctx.scene, 2 + power * 5.5, T(320));
      ctx.add({ kind: "typefx", side: attackerSide, to: side, text: type, extra: "land-phys" }, 1700);
      if (last?.motion === "quake") {
        J.shakeScene(ctx.scene, 7, T(560), T(80));
        J.ringWave(ctx.layer, B, "#c9a96e", T(700), 0, 100);
      }
    }
    if (power > 0.7) ctx.zoom(0.03 + power * 0.03, T(420));
  });
}

/* ----------------------------------------------------------------------- other */

export function playFaint(ctx: Ctx, cue: Cue) {
  const { T } = ctx;
  const side = cue.side;
  if (!side) return;
  const B = posOf(ctx, side);
  const body = ctx.kb(side);
  const last = ctx.last.current;
  const c = color(last?.type);
  const byMove = last && last.to === side;

  if (byMove && last.cat === "Special") {
    // burnt to ashes: scorched, it crumbles upward
    body?.parentElement?.setAttribute("data-ko", "1");
    body?.animate(
      [
        { filter: "brightness(1) sepia(0)", opacity: 1, transform: "translate(0,0) scale(1)", offset: 0 },
        { filter: "brightness(0.55) sepia(1) saturate(2)", opacity: 1, transform: "translate(2px,0) scale(1)", offset: 0.18 },
        { filter: "brightness(0.25) sepia(1) saturate(1.4)", opacity: 0.95, transform: "translate(-2px,-1%) scale(1.01)", offset: 0.4 },
        { filter: "brightness(0.12) blur(2px)", opacity: 0.6, transform: "translate(0,-8%) scale(0.96, 1.08)", offset: 0.7 },
        { filter: "brightness(0) blur(6px)", opacity: 0, transform: "translate(0,-18%) scale(0.8, 1.2)", offset: 1 },
      ],
      { duration: Math.max(T(860), 820), easing: "ease-in", fill: "forwards" },
    );
    J.ashes(ctx.layer, B, 34);
    ctx.zoom(0.04, T(700));
    return;
  }

  if (byMove && last.cat === "Physical") {
    // pop like a balloon: it swells and shudders, then goes off in a shower of colour
    body?.parentElement?.setAttribute("data-ko", "1");
    body?.animate(
      [
        { transform: "scale(1)", opacity: 1, offset: 0 },
        { transform: "scale(1.1, 0.95)", offset: 0.1 },
        { transform: "scale(1.22, 1.22) rotate(-2deg)", offset: 0.22 },
        { transform: "scale(1.32, 1.32) rotate(2deg)", offset: 0.32 },
        { transform: "scale(1.42, 1.42) rotate(-2deg)", opacity: 1, offset: 0.42 },
        { transform: "scale(0.1)", opacity: 0, offset: 0.45 },
        { transform: "scale(0.1)", opacity: 0, offset: 1 },
      ],
      { duration: Math.max(T(860), 820), easing: "ease-in-out", fill: "forwards" },
    );
    wait(T(860 * 0.43), () => {
      J.popBurst(ctx.layer, B, c);
      J.shakeScene(ctx.scene, 3.5, T(260));
      ctx.zoom(0.05, T(500));
    });
    return;
  }

  ctx.add({ kind: "ring", side, color: "#9aa0a6" }, 1000);
  ctx.add({ kind: "sparks", side, color: "#cbd5e1" }, 1000);
  ctx.zoom(0.04, 600);
}

export function playStatus(ctx: Ctx, cue: Cue) {
  const side = cue.side;
  if (!side) return;
  const B = posOf(ctx, side);
  J.statusFx(ctx.layer, B, cue.text ?? "");
  ctx.add({ kind: "label", side, text: (cue.text ?? "").toUpperCase(), color: "#a040a0" }, 1400);
}

export function playBoost(ctx: Ctx, cue: Cue) {
  const side = cue.side;
  if (!side) return;
  const B = posOf(ctx, side);
  const col = cue.up ? "#4cd964" : "#ff453a";
  ctx.add({ kind: "arrow", side, up: cue.up, text: cue.up ? "▲" : "▼" }, 1200);
  ctx.add({ kind: "ring", side, color: col }, 1000);
  J.risers(ctx.layer, B, col, { n: 8, glyph: cue.up ? "▲" : "▼", down: !cue.up, ms: ctx.T(1000), spread: 26 });
  J.glow(ctx.layer, B, col, 70, ctx.T(700), 0, 0.5);
}

export function playHeal(ctx: Ctx, cue: Cue) {
  const side = cue.side;
  if (!side) return;
  const B = posOf(ctx, side);
  J.risers(ctx.layer, B, "#6df08a", { n: 10, glyph: "+", ms: ctx.T(1100) });
  J.glow(ctx.layer, B, "#6df08a", 80, ctx.T(900), 0, 0.6);
}

/** A miss: the target steps aside. */
export function playMiss(ctx: Ctx) {
  const last = ctx.last.current;
  if (!last || last.cat === "Status") return;
  const el = ctx.kb(last.to);
  if (!el) return;
  const k = last.to === ctx.mine ? -1 : 1;
  el.animate(
    [
      { transform: "translate(0,0) rotate(0deg)" },
      { transform: `translate(${k * 18}px, -8px) rotate(${k * 5}deg)`, offset: 0.35 },
      { transform: `translate(${k * 12}px, -2px) rotate(${k * 3}deg)`, offset: 0.65 },
      { transform: "translate(0,0) rotate(0deg)" },
    ],
    { duration: ctx.T(520), easing: "ease-in-out" },
  );
}
