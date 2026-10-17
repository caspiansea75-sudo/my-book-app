/**
 * The "juice" of the battle scene: the small things that make a hit feel like a hit — a white flash,
 * a freeze for a few frames, knockback, sparks flying off, a shake — and the particles behind every
 * spell. Everything here draws straight into the scene with the Web Animations API (no React state),
 * so a burst of forty sparks costs nothing, and every element removes itself when it is done.
 *
 * Positions are in percent of the scene; sizes and distances are in "units" (1 unit = 1/480 of the scene width).
 */
import { pathY } from "@/components/pokemon/anims";

export type Pt = { x: number; y: number };
export type Vec = { x: number; y: number };

const MAX_PARTICLES = 240;

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
/** Fewer particles for anyone who asked for less motion. */
export const cnt = (n: number) => Math.max(1, Math.round(n * (reducedMotion() ? 0.3 : 1)));

const unit = (layer: HTMLElement) => Math.max(0.55, layer.clientWidth / 480);

/** Unit vector pointing from `a` to `b`, measured in real pixels (the scene is not square). */
export function dirOf(layer: HTMLElement | null, a: Pt, b: Pt): Vec {
  const w = layer?.clientWidth || 480;
  const h = layer?.clientHeight || 360;
  const dx = ((b.x - a.x) / 100) * w;
  const dy = ((b.y - a.y) / 100) * h;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
const rot = (v: Vec, ang: number): Vec => ({ x: v.x * Math.cos(ang) - v.y * Math.sin(ang), y: v.x * Math.sin(ang) + v.y * Math.cos(ang) });

export type ParticleShape = "dot" | "streak" | "glyph" | "ring" | "smoke" | "shard" | "star" | "glow";
type Particle = {
  at: Pt;
  shape?: ParticleShape;
  color?: string;
  /** Size in units. */
  size?: number;
  glyph?: string;
  from?: [number, number];
  via?: [number, number];
  to: [number, number];
  ms: number;
  delay?: number;
  s0?: number;
  s1?: number;
  rot?: number;
  /** Peak opacity. */
  o?: number;
  ease?: string;
  /** Streaks point along this angle (degrees); they also turn to follow their own travel when omitted. */
  angle?: number;
  normal?: boolean;
};

/** Puts one particle on the scene. Returns it, or null when the scene is already full. */
export function spawn(layer: HTMLElement | null, p: Particle): HTMLElement | null {
  if (!layer || layer.childElementCount > MAX_PARTICLES) return null;
  const k = unit(layer);
  const el = document.createElement("i");
  el.className = `pk-p pk-p-${p.shape ?? "dot"}`;
  el.style.left = `${p.at.x}%`;
  el.style.top = `${p.at.y}%`;
  el.style.setProperty("--c", p.color ?? "#fff");
  el.style.setProperty("--s", `${(p.size ?? 6) * k}px`);
  if (p.glyph) el.textContent = p.glyph;
  if (p.normal) el.style.mixBlendMode = "normal";
  layer.appendChild(el);

  const [fx, fy] = p.from ?? [0, 0];
  const [tx, ty] = p.to;
  const s0 = p.s0 ?? 1;
  const s1 = p.s1 ?? 0.3;
  const peak = p.o ?? 1;
  const turn = p.angle ?? (p.shape === "streak" ? (Math.atan2(ty - fy, tx - fx) * 180) / Math.PI : 0);
  const R = p.rot ?? 0;
  const at = (x: number, y: number, s: number, o: number, r: number): Keyframe => ({
    transform: `translate(calc(-50% + ${x * k}px), calc(-50% + ${y * k}px)) rotate(${turn + r}deg) scale(${s})`,
    opacity: o,
  });
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const frames: Keyframe[] = [
    { ...at(fx, fy, s0, 0, 0), offset: 0 },
    { ...at(mix(fx, tx, 0.1), mix(fy, ty, 0.1), s0, peak, R * 0.1), offset: 0.1 },
  ];
  if (p.via) frames.push({ ...at(p.via[0], p.via[1], mix(s0, s1, 0.5), peak * 0.9, R * 0.55), offset: 0.55 });
  frames.push({ ...at(tx, ty, s1, 0, R), offset: 1 });
  const a = el.animate(frames, { duration: p.ms, delay: p.delay ?? 0, easing: p.ease ?? "cubic-bezier(.2,.7,.3,1)", fill: "both" });
  a.onfinish = () => el.remove();
  a.oncancel = () => el.remove();
  return el;
}

/* ---------------------------------------------------------------- bursts and sprays */

/** Sparks and chips flung away from a hit, in the direction the blow was travelling, falling under gravity. */
export function spray(layer: HTMLElement | null, at: Pt, dir: Vec, o: { n: number; color: string; power: number; glyphs?: readonly string[]; delay?: number }) {
  for (let i = 0; i < cnt(o.n); i++) {
    const v = rot(dir, rnd(-0.9, 0.9));
    const r = rnd(46, 118) * (0.55 + o.power * 0.75);
    const x = v.x * r;
    const y = v.y * r;
    const glyph = o.glyphs && i % 4 === 0 ? pick(o.glyphs) : null;
    spawn(layer, {
      at,
      shape: glyph ? "glyph" : i % 3 === 0 ? "streak" : "dot",
      glyph: glyph ?? undefined,
      color: i % 3 === 1 ? "#fff" : o.color,
      size: glyph ? rnd(13, 19) : rnd(3, 6.5),
      via: [x * 0.55, y * 0.55 - rnd(10, 30)],
      to: [x, y + rnd(26, 62)],
      ms: rnd(520, 860),
      delay: o.delay,
      rot: glyph ? rnd(-200, 200) : 0,
      s1: 0.25,
    });
  }
}

/** A round burst: sparks leaving a point in every direction. */
export function sparkBurst(layer: HTMLElement | null, at: Pt, color: string, n: number, reach: [number, number], ms = 620, delay = 0) {
  for (let i = 0; i < cnt(n); i++) {
    const a = (i / n) * Math.PI * 2 + rnd(-0.2, 0.2);
    const r = rnd(reach[0], reach[1]);
    spawn(layer, { at, shape: i % 2 ? "streak" : "dot", color: i % 4 === 0 ? "#fff" : color, size: rnd(3, 6), to: [Math.cos(a) * r, Math.sin(a) * r], ms: rnd(ms * 0.8, ms * 1.2), delay, s1: 0.2 });
  }
}

/** The burst of a spell hitting: a flash, a ring, and long streaks that pass on *through* the target. */
export function burstThrough(layer: HTMLElement | null, at: Pt, dir: Vec, color: string, n = 16, delay = 0) {
  glow(layer, at, "#fff", 62, 260, delay);
  glow(layer, at, color, 96, 520, delay);
  ringWave(layer, at, color, 520, delay);
  for (let i = 0; i < cnt(n); i++) {
    const spread = i < n * 0.6 ? rnd(-0.55, 0.55) : rnd(-Math.PI, Math.PI);
    const v = rot(dir, spread);
    const r = rnd(70, 150);
    spawn(layer, { at, shape: "streak", color: i % 3 ? color : "#fff", size: rnd(5, 9), to: [v.x * r, v.y * r], ms: rnd(420, 700), delay, s1: 0.15 });
  }
  sparkBurst(layer, at, color, 10, [24, 70], 560, delay);
}

export function glow(layer: HTMLElement | null, at: Pt, color: string, size: number, ms: number, delay = 0, peak = 0.95) {
  spawn(layer, { at, shape: "glow", color, size, to: [0, 0], ms, delay, s0: 0.25, s1: 1.5, o: peak, ease: "ease-out" });
}

export function ringWave(layer: HTMLElement | null, at: Pt, color: string, ms = 600, delay = 0, size = 70) {
  spawn(layer, { at, shape: "ring", color, size, to: [0, 0], ms, delay, s0: 0.15, s1: 1.7, o: 0.9, ease: "ease-out" });
}

/** A comic-book starburst at the point of contact. */
export function impactStar(layer: HTMLElement | null, at: Pt, color: string, size: number, delay = 0) {
  spawn(layer, { at, shape: "star", color, size, to: [0, 0], ms: 340, delay, s0: 0.3, s1: 1.25, rot: rnd(-18, 18), o: 1, ease: "cubic-bezier(.1,.9,.2,1)", normal: true });
}

/** Thin speed lines left along the path of a rush. */
export function speedLines(layer: HTMLElement | null, a: Pt, b: Pt, color: string, n: number, delay: number, ms = 300) {
  const dir = dirOf(layer, a, b);
  for (let i = 0; i < cnt(n); i++) {
    const t = rnd(0.1, 0.8);
    const at = { x: a.x + (b.x - a.x) * t + rnd(-4, 4), y: a.y + (b.y - a.y) * t + rnd(-5, 5) };
    spawn(layer, { at, shape: "streak", color: i % 2 ? "#fff" : color, size: rnd(9, 15), from: [-dir.x * 8, -dir.y * 8], to: [-dir.x * rnd(26, 52), -dir.y * rnd(26, 52)], ms, delay: delay + i * 22, s1: 0.2, o: 0.8 });
  }
}

/* ------------------------------------------------------------------- spells */

/** Fire (and light) gathered out of the air into the caster. */
export function converge(layer: HTMLElement | null, at: Pt, color: string, n: number, ms: number, radius = 90) {
  glow(layer, at, color, 34, ms, 0, 0.7);
  for (let i = 0; i < cnt(n); i++) {
    const a = rnd(0, Math.PI * 2);
    const r = rnd(radius * 0.6, radius);
    const delay = (i / n) * ms * 0.7;
    spawn(layer, { at, shape: i % 3 === 0 ? "streak" : "dot", color: i % 4 === 0 ? "#fff" : color, size: rnd(3, 6), from: [Math.cos(a) * r, Math.sin(a) * r], to: [0, 0], ms: ms * 0.5, delay, s0: 0.5, s1: 1.1, ease: "cubic-bezier(.5,0,.9,.6)" });
  }
}

const CORE_SHAPE: Record<string, string> = { Ice: "diamond", Steel: "diamond", Rock: "diamond", Psychic: "ring", Ghost: "ring", Fairy: "ring", Dragon: "ring", Electric: "spark", Water: "drop", Poison: "drop" };

/** The glowing core of a spell: a bright centre in a coloured halo, flying from the caster to the target. */
export function core(layer: HTMLElement | null, a: Pt, b: Pt, o: { color: string; type: string; ms: number; delay: number; size?: number }) {
  if (!layer || layer.childElementCount > MAX_PARTICLES) return;
  const el = document.createElement("i");
  el.className = `pk-core pk-core-${CORE_SHAPE[o.type] ?? "orb"}`;
  el.style.setProperty("--c", o.color);
  el.style.setProperty("--s", `${(o.size ?? 26) * unit(layer)}px`);
  layer.appendChild(el);
  const steps = 14;
  const frames: Keyframe[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    frames.push({
      left: `${a.x + (b.x - a.x) * t}%`,
      top: `${a.y + (b.y - a.y) * t + pathY(o.type, t)}%`,
      opacity: k === 0 ? 0 : k === steps ? 0.9 : 1,
      transform: `translate(-50%,-50%) scale(${0.45 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.35 + t * 0.55}) rotate(${t * 360}deg)`,
      offset: t,
    });
  }
  const anim = el.animate(frames, { duration: o.ms, delay: o.delay, easing: "cubic-bezier(.45,0,.85,.6)", fill: "both" });
  anim.onfinish = () => el.remove();
  anim.oncancel = () => el.remove();
  return el;
}

/** Tongues of light left behind a flying spell. */
export function trail(layer: HTMLElement | null, a: Pt, b: Pt, o: { color: string; type: string; ms: number; delay: number; n?: number }) {
  const n = cnt(o.n ?? 16);
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    // the spell accelerates, so its trail points are spaced to match its timing
    const eased = Math.pow(t, 1.35);
    const at = { x: a.x + (b.x - a.x) * eased, y: a.y + (b.y - a.y) * eased + pathY(o.type, eased) };
    const dir = dirOf(layer, a, b);
    spawn(layer, {
      at,
      shape: i % 3 === 0 ? "streak" : "dot",
      color: i % 4 === 0 ? "#fff" : o.color,
      size: rnd(4, 9),
      from: [rnd(-3, 3), rnd(-3, 3)],
      to: [-dir.x * rnd(14, 36) + rnd(-8, 8), -dir.y * rnd(14, 36) + rnd(-12, 4)],
      ms: rnd(260, 460),
      delay: o.delay + eased * o.ms,
      s1: 0.1,
      o: 0.9,
    });
  }
}

/** What lingers on the target after a spell lands: warm light, slowly rising embers. */
export function aftermath(layer: HTMLElement | null, at: Pt, color: string, ms = 1500, delay = 0) {
  glow(layer, at, color, 80, ms, delay, 0.5);
  for (let i = 0; i < cnt(9); i++) {
    spawn(layer, { at: { x: at.x + rnd(-4, 4), y: at.y + rnd(-2, 6) }, shape: "dot", color: i % 3 ? color : "#fff", size: rnd(2.5, 5), from: [rnd(-26, 26), rnd(-8, 16)], via: [rnd(-22, 22), rnd(-44, -20)], to: [rnd(-26, 26), rnd(-92, -52)], ms: rnd(ms * 0.7, ms * 1.1), delay: delay + rnd(0, 420), s1: 0.1, o: 0.85, ease: "ease-out" });
  }
}

/* --------------------------------------------------------------- self moves */

/** Glyphs or dots rising around a Pokémon: a power-up, a heal, a stat change. */
export function risers(layer: HTMLElement | null, at: Pt, color: string, o: { n: number; glyph?: string; down?: boolean; ms?: number; spread?: number }) {
  const sp = o.spread ?? 34;
  for (let i = 0; i < cnt(o.n); i++) {
    const x = rnd(-sp, sp);
    spawn(layer, {
      at: { x: at.x, y: at.y + 6 },
      shape: o.glyph ? "glyph" : "dot",
      glyph: o.glyph,
      color,
      size: o.glyph ? rnd(13, 19) : rnd(3, 6),
      from: [x, o.down ? -78 : 22],
      via: [x + rnd(-8, 8), o.down ? -28 : -26],
      to: [x + rnd(-10, 10), o.down ? 34 : -92],
      ms: o.ms ?? rnd(800, 1200),
      delay: i * 70 + rnd(0, 120),
      s1: 0.6,
      o: 0.95,
      ease: "ease-out",
    });
  }
}

/** Energy spiralling up around a Pokémon (a setup move like Swords Dance). */
export function spiral(layer: HTMLElement | null, at: Pt, color: string, n = 18, ms = 1100) {
  for (let i = 0; i < cnt(n); i++) {
    const a0 = (i / n) * Math.PI * 4;
    const pts: [number, number][] = [0, 1, 2, 3].map((q) => [Math.cos(a0 + q * 1.1) * 30, 36 - q * 34 - i * 1.2]);
    spawn(layer, { at, shape: i % 3 ? "dot" : "streak", color: i % 4 === 0 ? "#fff" : color, size: rnd(3, 6), from: pts[0], via: pts[2], to: pts[3]!, ms, delay: i * 38, s1: 0.2 });
  }
}

/** A wide band of colour sweeping across the field: weather, terrain, hazards. */
export function sweep(layer: HTMLElement | null, color: string, fromLeft: boolean, ms = 900) {
  if (!layer) return;
  const el = document.createElement("i");
  el.className = "pk-sweep";
  el.style.setProperty("--c", color);
  layer.appendChild(el);
  const a = el.animate(
    [
      { transform: `translateX(${fromLeft ? "-110%" : "110%"}) skewX(${fromLeft ? -16 : 16}deg)`, opacity: 0 },
      { opacity: 0.85, offset: 0.25 },
      { opacity: 0.85, offset: 0.6 },
      { transform: `translateX(${fromLeft ? "110%" : "-110%"}) skewX(${fromLeft ? -16 : 16}deg)`, opacity: 0 },
    ],
    { duration: ms, easing: "ease-in-out", fill: "both" },
  );
  a.onfinish = () => el.remove();
}

/* -------------------------------------------------------------- ailments */

const STATUS_FX: Record<string, { color: string; glyph?: string; mode: "up" | "zap" | "freeze" | "bubble" | "float" }> = {
  brn: { color: "#ff7a2f", glyph: "🔥", mode: "up" },
  par: { color: "#ffe14d", glyph: "⚡", mode: "zap" },
  slp: { color: "#9fb4ff", glyph: "💤", mode: "float" },
  frz: { color: "#8ee8ff", glyph: "❄️", mode: "freeze" },
  psn: { color: "#b259d6", glyph: "☠️", mode: "bubble" },
  tox: { color: "#9d3fc4", glyph: "☠️", mode: "bubble" },
};

/** Each ailment looks like itself: flames lick up, sparks crackle, Zs float, ice closes in, bubbles rise. */
export function statusFx(layer: HTMLElement | null, at: Pt, status: string) {
  const f = STATUS_FX[status];
  if (!f) {
    sparkBurst(layer, at, "#c77dff", 10, [26, 54]);
    return;
  }
  glow(layer, at, f.color, 76, 900, 0, 0.55);
  if (f.mode === "up") {
    for (let i = 0; i < cnt(10); i++) spawn(layer, { at, shape: "glyph", glyph: "🔥", size: rnd(11, 17), from: [rnd(-26, 26), rnd(6, 22)], to: [rnd(-30, 30), rnd(-72, -40)], ms: rnd(650, 950), delay: i * 60, s1: 0.4 });
  } else if (f.mode === "zap") {
    for (let i = 0; i < cnt(12); i++) spawn(layer, { at, shape: "streak", color: i % 2 ? "#fff" : f.color, size: rnd(7, 13), from: [rnd(-24, 24), rnd(-30, 20)], to: [rnd(-36, 36), rnd(-44, 30)], ms: rnd(160, 300), delay: i * 70, rot: rnd(-40, 40), s1: 0.6 });
  } else if (f.mode === "float") {
    for (let i = 0; i < 4; i++) spawn(layer, { at, shape: "glyph", glyph: i % 2 ? "z" : "Z", color: "#cfd8ff", size: 14 + i * 3, from: [10 + i * 4, -30], via: [26 + i * 8, -52 - i * 8], to: [34 + i * 12, -80 - i * 12], ms: 1500, delay: i * 340, s0: 0.5, s1: 1.2 });
  } else if (f.mode === "freeze") {
    for (let i = 0; i < cnt(12); i++) {
      const a = (i / 12) * Math.PI * 2;
      spawn(layer, { at, shape: "shard", color: "#bff4ff", size: rnd(8, 14), from: [Math.cos(a) * 70, Math.sin(a) * 60], to: [Math.cos(a) * 22, Math.sin(a) * 18], ms: 520, delay: i * 18, rot: rnd(-60, 60), s0: 0.6, s1: 1, o: 0.95 });
    }
  } else {
    for (let i = 0; i < cnt(9); i++) spawn(layer, { at, shape: "ring", color: f.color, size: rnd(6, 13), from: [rnd(-26, 26), rnd(10, 26)], to: [rnd(-30, 30), rnd(-70, -36)], ms: rnd(800, 1200), delay: i * 90, s0: 0.5, s1: 1.2, o: 0.85 });
  }
}

/* ----------------------------------------------------------------- KO effects */

/** A balloon pop: it swells, and goes off in a shower of colour. */
export function popBurst(layer: HTMLElement | null, at: Pt, color: string) {
  glow(layer, at, "#fff", 70, 260);
  ringWave(layer, at, color, 520, 0, 80);
  const colors = [color, "#fff", "#ffd54a", "#ff7bd5", "#6ecbff"];
  for (let i = 0; i < cnt(26); i++) {
    const a = (i / 26) * Math.PI * 2 + rnd(-0.15, 0.15);
    const r = rnd(50, 130);
    spawn(layer, { at, shape: i % 3 === 0 ? "streak" : "dot", color: colors[i % colors.length]!, size: rnd(3.5, 7), to: [Math.cos(a) * r, Math.sin(a) * r * 0.8 + 24], via: [Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.5 - 10], ms: rnd(600, 980), s1: 0.2 });
  }
}

/** Burnt to ashes: grey flakes lift off with a few last embers. */
export function ashes(layer: HTMLElement | null, at: Pt, n = 30) {
  for (let i = 0; i < cnt(n); i++) {
    const hot = i % 5 === 0;
    spawn(layer, {
      at: { x: at.x + rnd(-6, 6), y: at.y + rnd(-6, 8) },
      shape: hot ? "dot" : "smoke",
      color: hot ? "#ff9a3c" : pick(["#8c8782", "#6b6661", "#a8a39d", "#4e4a46"]),
      size: hot ? rnd(2.5, 4.5) : rnd(5, 11),
      from: [rnd(-20, 20), rnd(-10, 26)],
      via: [rnd(-26, 26), rnd(-50, -20)],
      to: [rnd(-46, 46), rnd(-130, -70)],
      ms: rnd(1000, 1700),
      delay: i * 28 + rnd(0, 200),
      s0: 0.7,
      s1: 1.3,
      o: hot ? 0.95 : 0.75,
      ease: "ease-out",
      normal: !hot,
    });
  }
  glow(layer, at, "#ff7a2f", 70, 900, 0, 0.45);
}

/* --------------------------------------------------------- on the Pokémon */

/** Freezes everything in the scene for a few frames, as a heavy blow lands. */
export function hitStop(scene: HTMLElement | null, ms: number) {
  if (!scene || reducedMotion() || ms < 24) return;
  const running = scene.getAnimations({ subtree: true }).filter((a) => a.playState === "running");
  for (const a of running) {
    try {
      a.pause();
    } catch {
      /* not pausable */
    }
  }
  window.setTimeout(() => {
    for (const a of running) {
      try {
        if (a.playState === "paused") a.play();
      } catch {
        /* gone */
      }
    }
  }, ms);
}

/** Turns a Pokémon plain white for a moment (just a few frames reads as a hit). */
export function whiteFlash(el: HTMLElement | null, ms: number) {
  if (!el) return;
  el.classList.add("pk-white");
  window.setTimeout(() => el.classList.remove("pk-white"), ms);
}

/** Knocks a Pokémon back along a direction and lets it spring home. */
export function knock(el: HTMLElement | null, dir: Vec, dist: number, ms: number, delay = 0) {
  if (!el) return;
  const x = dir.x * dist;
  const y = dir.y * dist * 0.6;
  el.animate(
    [
      { transform: "translate(0px, 0px) scale(1, 1)" },
      { transform: `translate(${x}px, ${y}px) scale(${1 - Math.abs(dir.x) * 0.06}, ${1 + Math.abs(dir.x) * 0.08})`, offset: 0.22 },
      { transform: `translate(${x * 0.35}px, ${y * 0.35}px) scale(1.03, 0.97)`, offset: 0.55 },
      { transform: `translate(${-x * 0.06}px, ${-y * 0.06}px)`, offset: 0.78 },
      { transform: "translate(0px, 0px) scale(1, 1)" },
    ],
    { duration: ms, delay, easing: "cubic-bezier(.2,.8,.3,1)" },
  );
}

/** A small hop-back when the attacker connects (it bounces off the hit). */
export function recoil(el: HTMLElement | null, dir: Vec, dist: number, ms = 300) {
  if (!el) return;
  el.animate(
    [{ transform: "translate(0,0)" }, { transform: `translate(${-dir.x * dist}px, ${-dir.y * dist * 0.5 - 4}px) scale(1.04, .96)`, offset: 0.3 }, { transform: "translate(0,0)" }],
    { duration: ms, easing: "ease-out" },
  );
}

/** Colours a Pokémon with the light of the attack that hit it, fading away. */
export function tint(el: HTMLElement | null, color: string, ms: number, delay = 0) {
  if (!el) return;
  el.animate(
    [
      { filter: `brightness(1) drop-shadow(0 0 0px ${color})` },
      { filter: `brightness(1.5) drop-shadow(0 0 16px ${color}) drop-shadow(0 0 30px ${color})`, offset: 0.2 },
      { filter: `brightness(1.15) drop-shadow(0 0 10px ${color})`, offset: 0.6 },
      { filter: `brightness(1) drop-shadow(0 0 0px ${color})` },
    ],
    { duration: ms, delay, easing: "ease-out" },
  );
}

/** The whole scene jolts (the HP boxes too: it is the screen shaking). */
export function shakeScene(scene: HTMLElement | null, amp: number, ms = 300, delay = 0) {
  if (!scene || reducedMotion() || amp <= 0) return;
  const steps = 8;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const fade = 1 - i / steps;
    frames.push({ transform: i === steps ? "translate(0px,0px)" : `translate(${(i % 2 ? -1 : 1) * amp * fade}px, ${(i % 3 ? 1 : -1) * amp * 0.6 * fade}px)`, offset: i / steps });
  }
  scene.animate(frames, { duration: ms, delay, easing: "linear", composite: "add" });
}
