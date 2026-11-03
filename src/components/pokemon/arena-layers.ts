/**
 * Layered effects for all 18 types, built the way the reference sheets build theirs: a final effect is several simple
 * layers stacked (a flash / core, an expanding shockwave, a dome, a decal on the floor, swirling or rising particles,
 * a glow and a faint distortion ring), and each type picks the layers and the shapes that say its element.
 *
 * Three moments use it:
 *   "core"  the quick part of a heavy hit (flash + shockwave + a few flying pieces);
 *   "rest"  the slow part of a zone move or a nova (floor decal, dome, orbiting / rising / swirling pieces);
 *   "all"   both at once (casts, finishers);
 *   and `layeredHit`, a small version for ordinary hits.
 * Everything scales to the device: `SpecCtx.q` (how fast the renderer is running) picks one of three tiers, and the number of
 * particles already alive (`SpecCtx.load`) thins every new burst, so a slow phone gets the same shapes with fewer of them,
 * and the heaviest layers (columns of light, second domes, volumetric smoke, ribbons, chains) only appear when there is room.
 * The renderer owns the particle list; this module only asks for particles and floor marks through `SpecCtx`.
 */
import type { SpecCtx, SP } from "./arena-spec";
import { typeTex } from "./arena-tex";

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

export type Pal = [string, string, string, string]; // dark, mid, light, core
export type LayerPart = "core" | "rest" | "all";

type K = {
  /** 0 = a slow device (the simple layers), 1 = normal, 2 = a fast one (every layer) */
  tier: 0 | 1 | 2;
  type: string;
  c: SpecCtx;
  x: number;
  y: number;
  /** radius of the effect */
  R: number;
  /** how many pieces: 1 at a normal size */
  s: number;
  pal: Pal;
  core: boolean;
  rest: boolean;
};

const A = (k: K, p: SP) => k.c.add(p);
const cnt = (k: K, n: number) => Math.max(1, Math.round(n * k.s));

/* ------------------------------------------------------------------ the layers */

/** The hot instant of the impact: a soft glow that blows up and thins out, and a bright cross-flare. */
function flash(k: K, color: string, power = 1, cross = true) {
  A(k, { kind: "glow", x: k.x, y: k.y, life: 0.3, size: k.R * 0.1, grow: k.R * 3 * power, color });
  if (cross) A(k, { kind: "cross", x: k.x, y: k.y, life: 0.2, size: k.R * 0.8 * power, color: k.pal[3] });
}

/** An expanding shockwave on the floor (two rings, the inner one hotter) and, later, a fainter echo. */
function shock(k: K, color: string = k.pal[2], echo = false) {
  const life = 0.5;
  A(k, { kind: "gring", x: k.x, y: k.y + 6, life, size: 6, grow: (k.R * 1.15) / life, color });
  A(k, { kind: "gring", x: k.x, y: k.y + 6, life: life * 0.7, size: 3, grow: (k.R * 0.8) / (life * 0.7), color: k.pal[3] });
  if (echo) k.c.later(0.12, () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.55, size: 4, grow: (k.R * 1.5) / 0.55, color }));
}

/** A hemispherical energy dome that swells out of the floor and fades, lit at its rim. */
function dome(k: K, color: string, edge: string, life = 0.75, size = 1) {
  A(k, { kind: "dome", x: k.x, y: k.y + 4, life, size: k.R * 0.25, grow: (k.R * 1.05 * size) / life, color, edge });
}

/** A thin ring of runes on the floor that flares in, turns and fades (the "runic ground decal" of the sheets). */
function rune(k: K, scale = 1) {
  k.c.decal({ kind: "vfx", x: k.x, y: k.y + 4, r: Math.min(110, k.R * 1.2) * scale, life: 1.05, seed: Math.random() * 900, ang: rnd(0, TAU), vfx: { style: "rune", motif: "rune", pal: k.pal, tex: typeTex(k.type) } });
}

/** The type's own mark on the floor (cracks, scorch, frost, droplets, forked lightning, leaves...). */
function ground(k: K, style: "rays" | "splat" = "rays") {
  k.c.decal({ kind: "vfx", x: k.x, y: k.y + 6, r: Math.min(90, k.R), life: 1.2, seed: Math.random() * 900, ang: rnd(0, TAU), vfx: { style, motif: "orb", pal: k.pal, tex: typeTex(k.type) } });
}

/** Little lights circling the point (the orbiting embers, motes and sparks of the sheets). */
function orbit(k: K, n: number, color: (i: number) => string, o: { radius?: number; spin?: number; size?: number; life?: number; rise?: number; spread?: number } = {}) {
  const r0 = k.R * (o.radius ?? 0.7);
  const life = o.life ?? 0.9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(0, 0.5);
    const dir = i % 5 === 4 ? -1 : 1; // a few turn the other way
    A(k, {
      kind: "orbit", x: k.x, y: k.y, x2: k.x, y2: k.y, vx: 0, vy: -(o.rise ?? 0), weight: r0 * rnd(0.45, 1.1), rot: a, vr: dir * (o.spin ?? 5) * rnd(0.8, 1.25),
      seed: ((o.spread ?? 0.3) * k.R * rnd(0.4, 1)) / life, life: life * rnd(0.8, 1.1), size: (o.size ?? 2.6) * rnd(0.8, 1.3), color: color(i),
    });
  }
}

/** Pieces that fly up and out and fall back (sparks, stones, shards). */
function burst(k: K, n: number, kind: string, color: (i: number) => string, o: { up?: number; out?: number; g?: number; size?: [number, number]; life?: [number, number] } = {}) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU);
    const out = rnd(0.4, 1) * (o.out ?? 220);
    A(k, {
      kind, x: k.x + Math.cos(a) * 6, y: k.y + Math.sin(a) * 4, vx: Math.cos(a) * out, vy: Math.sin(a) * out * 0.6 - rnd(0.4, 1) * (o.up ?? 260), g: o.g ?? 700,
      life: rnd(...(o.life ?? [0.5, 0.9])), size: rnd(...(o.size ?? [2, 4])), rot: rnd(0, 6), vr: rnd(-10, 10), color: color(i),
    });
  }
}

/** Things that stand up out of the floor in a ring (thorns, ice spikes, crystals). */
function spikes(k: K, n: number, color: (i: number) => string, o: { size?: [number, number]; up?: number } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(-0.2, 0.2);
    const d = k.R * rnd(0.3, 0.8);
    A(k, { kind: "shard", x: k.x + Math.cos(a) * d, y: k.y + Math.sin(a) * d * 0.7, vx: Math.cos(a) * 30, vy: -rnd(0.6, 1) * (o.up ?? 300), g: 780, life: rnd(0.55, 0.8), size: rnd(...(o.size ?? [4, 7])), rot: rnd(-0.3, 0.3), vr: 0, color: color(i) });
  }
}

/** Soft puffs that spread out in a ring (a smoke dome, dust, mist). On a device with room they are lit, shaded lumps of smoke. */
function puffs(k: K, n: number, color: (i: number) => string, o: { out?: number; rise?: number; size?: [number, number]; grow?: number; life?: [number, number]; ring?: number } = {}) {
  const vol = k.tier >= 1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(-0.2, 0.2);
    const d = k.R * (o.ring ?? 0.25) * rnd(0.6, 1.2);
    A(k, {
      kind: vol ? "plume" : "smoke", x: k.x + Math.cos(a) * d, y: k.y + Math.sin(a) * d * 0.6, vx: Math.cos(a) * (o.out ?? 70) * rnd(0.6, 1.2), vy: Math.sin(a) * (o.out ?? 70) * 0.5 - (o.rise ?? 20), g: 0,
      life: rnd(...(o.life ?? [0.8, 1.3])), size: rnd(...(o.size ?? [10, 16])) * (vol ? 1.15 : 1), grow: o.grow ?? 26, color: color(i), edge: k.pal[2], seed: Math.random() * 100,
    });
  }
}

/** A tall soft column of light (or heat, or lightning) that shoots up out of the floor and thins away. */
function column(k: K, color: string, edge: string, o: { h?: number; w?: number; life?: number } = {}) {
  A(k, { kind: "pillar", x: k.x, y: k.y + 4, life: o.life ?? 0.55, size: (o.w ?? 0.22) * k.R, weight: (o.h ?? 1.7) * k.R, color, edge });
}

/** Swept ribbons that wheel round the point, each a long fading tail (wind, water, vines, a dragon's spirals). */
function ribbons(k: K, n: number, color: (i: number) => string, o: { radius?: number; spin?: number; size?: number; life?: number; rise?: number; spread?: number } = {}) {
  const life = o.life ?? 0.8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(0, 0.5);
    A(k, {
      kind: "orbit", edge: "ribbon", x: k.x, y: k.y, x2: k.x, y2: k.y, vx: 0, vy: -(o.rise ?? 0), weight: k.R * (o.radius ?? 0.55) * rnd(0.6, 1.1), rot: a, vr: (i % 2 ? 1 : 1.15) * (o.spin ?? 5.5),
      seed: ((o.spread ?? 0.5) * k.R * rnd(0.5, 1)) / life, life: life * rnd(0.85, 1.1), size: (o.size ?? 3) * rnd(0.85, 1.2), color: color(i),
    });
  }
}

/** A ring of chain links turning slowly round the point. */
function links(k: K, n: number, color: string, o: { radius?: number; spin?: number; life?: number } = {}) {
  const life = o.life ?? 1.1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    A(k, { kind: "orbit", edge: "link", x: k.x, y: k.y, x2: k.x, y2: k.y, vx: 0, vy: 0, weight: k.R * (o.radius ?? 0.85), rot: a, vr: o.spin ?? 1.8, seed: 0, life, size: 2.6, color });
  }
}

/** Light things that drift upward (embers, spores, bubbles, motes). */
function rise(k: K, n: number, kind: string, color: (i: number) => string, o: { speed?: [number, number]; size?: [number, number]; life?: [number, number]; g?: number; spread?: number } = {}) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU);
    const d = k.R * (o.spread ?? 0.7) * Math.sqrt(Math.random());
    A(k, { kind, x: k.x + Math.cos(a) * d, y: k.y + Math.sin(a) * d * 0.6, vx: rnd(-18, 18), vy: -rnd(...(o.speed ?? [50, 130])), g: o.g ?? -20, life: rnd(...(o.life ?? [0.8, 1.3])), size: rnd(...(o.size ?? [2, 4])), color: color(i) });
  }
}

/** Curved streaks that sweep round the point (wind ribbons, water ribbons, a dragon's spirals). */
function swirl(k: K, n: number, color: (i: number) => string, o: { speed?: number; size?: number; life?: number; turns?: number } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(0, 0.4);
    const d = k.R * 0.35;
    const sp = (o.speed ?? 1.6) * k.R;
    A(k, { kind: "arc", x: k.x + Math.cos(a) * d, y: k.y + Math.sin(a) * d * 0.7, vx: -Math.sin(a) * sp, vy: Math.cos(a) * sp * 0.7, life: o.life ?? 0.55, size: (o.size ?? 8) * rnd(0.8, 1.2), rot: a + Math.PI / 2, vr: (o.turns ?? 4) * (i % 2 ? 1 : 1.2), color: color(i) });
  }
}

function bolts(k: K, n: number, longest = 1) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU);
    const L = k.R * rnd(0.5, 1.1) * longest;
    A(k, { kind: "bolt", x: k.x, y: k.y, life: 0.22, color: i % 2 ? k.pal[3] : k.pal[2], x2: k.x + Math.cos(a) * L, y2: k.y + Math.sin(a) * L * 0.75, seed: i * 11 + 5 });
  }
}

/* ------------------------------------------------------------------ one recipe per type */

const RECIPE: Record<string, (k: K) => void> = {
  // flash + shockwave + flying sparks and debris + a cracked, glowing floor + rising embers and smoke + heat haze (+ a column of heat)
  Fire(k) {
    const [dk, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, lt);
      shock(k, md);
      burst(k, cnt(k, 9), "spark", (i) => (i % 2 ? core : lt), { size: [1.8, 3.2], g: 420 });
    }
    if (k.rest) {
      ground(k);
      rise(k, cnt(k, 9), "dot", (i) => (i % 3 ? md : lt), { speed: [60, 150], size: [1.6, 3], g: -60 });
      puffs(k, cnt(k, 4), () => dk, { out: 18, rise: 70, size: [9, 14], grow: 22, life: [0.9, 1.4], ring: 0.2 });
      k.c.later(0.1, () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.6, size: 4, grow: (k.R * 1.7) / 0.6, color: "rgba(255,230,200,.5)" }));
      if (k.tier >= 2) {
        column(k, md, core, { w: 0.2, h: 1.5 });
        burst(k, cnt(k, 6), "flame", (i) => (i % 2 ? lt : md), { size: [8, 13], g: -20, up: 120, out: 90, life: [0.5, 0.8] });
      }
    }
  },
  // a ripple of rings, a dome of water, ribbons of water wheeling round, droplets circling up, a splash and mist
  Water(k) {
    const [, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, lt, 0.7, false);
      shock(k, lt, true);
      burst(k, cnt(k, 9), "dot", (i) => (i % 2 ? lt : core), { size: [2.2, 4.2], g: 760, up: 300 });
    }
    if (k.rest) {
      dome(k, md, lt);
      ground(k);
      orbit(k, cnt(k, 9), (i) => (i % 2 ? lt : core), { radius: 0.65, spin: 4, size: 3, rise: 40, life: 1 });
      if (k.tier >= 1) ribbons(k, cnt(k, 3), (i) => (i % 2 ? lt : core), { size: 3.2 });
      else swirl(k, 3, () => lt, { size: 7 });
      puffs(k, cnt(k, 4), () => "#e8f6ff", { out: 40, rise: 30, size: [8, 12], life: [0.7, 1] });
      if (k.tier >= 2) {
        dome(k, lt, core, 0.65, 0.6);
        column(k, lt, core, { w: 0.14, h: 1.3 });
      }
    }
  },
  // flash + radial air shockwave + forking arcs + circling sparks + forked lightning running over the floor (+ a lightning column)
  Electric(k) {
    const [, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, md, 1.1);
      shock(k, lt);
      bolts(k, cnt(k, 5));
      burst(k, cnt(k, 8), "spark", (i) => (i % 2 ? "#ffffff" : core), { size: [1.6, 2.8], g: 200, up: 160, out: 280, life: [0.3, 0.5] });
    }
    if (k.rest) {
      ground(k);
      k.c.later(0.08, () => bolts(k, cnt(k, 4), 0.85));
      orbit(k, cnt(k, 10), (i) => (i % 2 ? core : lt), { radius: 0.6, spin: 9, size: 1.9, life: 0.7 });
      A(k, { kind: "glow", x: k.x, y: k.y, life: 0.5, size: k.R * 0.2, grow: k.R * 1.1, color: md });
      if (k.tier >= 1) k.c.later(0.16, () => bolts(k, cnt(k, 3), 1.1));
      if (k.tier >= 2) {
        column(k, lt, "#ffffff", { w: 0.1, h: 2, life: 0.4 });
        orbit(k, cnt(k, 8), () => "#ffffff", { radius: 0.95, spin: -11, size: 1.7, life: 0.6 });
      }
    }
  },
  // thorns out of the ground, vines wheeling round, leaves, pollen drifting up, a green rune ring
  Grass(k) {
    const [dk, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, lt, 0.8, false);
      shock(k, md);
      burst(k, cnt(k, 8), "leaf", () => pick([dk, md, lt]), { size: [3.5, 6], g: 150, up: 200, life: [0.8, 1.2] });
    }
    if (k.rest) {
      rune(k);
      ground(k);
      spikes(k, cnt(k, 6), (i) => (i % 2 ? md : lt), { size: [4, 6], up: 240 });
      orbit(k, cnt(k, 9), (i) => (i % 2 ? core : lt), { radius: 0.7, spin: 3.5, size: 2.4, rise: 30, life: 1.1 });
      rise(k, cnt(k, 6), "dot", () => core, { speed: [30, 80], size: [1.5, 2.6], g: -10, life: [1, 1.5] });
      if (k.tier >= 1) ribbons(k, cnt(k, 3), (i) => (i % 2 ? md : lt), { size: 3.2, radius: 0.6, rise: 14, life: 0.95 });
      if (k.tier >= 2) {
        rune(k, 0.62);
        spikes(k, cnt(k, 5), (i) => (i % 2 ? lt : core), { size: [3, 5], up: 200 });
      }
    }
  },
  // frost spikes standing up, a runic frost ring, ribbons of cold wind, ice shards circling, freezing mist and falling flakes
  Ice(k) {
    const [, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, core, 0.9);
      shock(k, lt);
      burst(k, cnt(k, 9), "shard", (i) => (i % 2 ? lt : "#ffffff"), { size: [3, 6], g: 560, up: 250 });
    }
    if (k.rest) {
      ground(k);
      rune(k);
      spikes(k, cnt(k, 8), (i) => (i % 2 ? lt : "#ffffff"), { size: [5, 8], up: 330 });
      orbit(k, cnt(k, 7), () => core, { radius: 0.7, spin: 4.5, size: 2.8, life: 0.95 });
      puffs(k, cnt(k, 5), (i) => (i % 2 ? "#dff3ff" : md), { out: 36, rise: 14, size: [9, 14], life: [0.9, 1.3] });
      rise(k, cnt(k, 6), "flake", () => "#ffffff", { speed: [-30, -10], size: [2, 3.6], g: 14, life: [1, 1.5], spread: 0.9 });
      if (k.tier >= 1) ribbons(k, cnt(k, 4), (i) => (i % 2 ? lt : core), { size: 3, radius: 0.6, life: 0.9 });
      if (k.tier >= 2) {
        rune(k, 0.6);
        column(k, lt, "#ffffff", { w: 0.16, h: 1.5 });
      }
    }
  },
  // a hard flash with a cross, a double shockwave, radial stars and flying debris over a cracked floor
  Fighting(k) {
    const [dk, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, lt, 1.1);
      shock(k, lt, true);
      burst(k, cnt(k, 10), "star", (i) => (i % 2 ? core : lt), { size: [4, 8], g: 0, up: 0, out: 260, life: [0.4, 0.6] });
    }
    if (k.rest) {
      ground(k);
      burst(k, cnt(k, 8), "plank", (i) => (i % 2 ? dk : md), { size: [4, 8], g: 760, up: 300 });
      puffs(k, cnt(k, 4), () => "#c9b79a", { out: 60, rise: 6, size: [8, 12], life: [0.6, 0.9] });
      if (k.tier >= 2) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          A(k, { kind: "streak", x: k.x + Math.cos(a) * 14, y: k.y + Math.sin(a) * 10, vx: Math.cos(a) * 420, vy: Math.sin(a) * 300, life: 0.25, size: rnd(10, 18), color: i % 2 ? lt : core });
        }
        k.c.later(0.1, () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.5, size: 4, grow: (k.R * 1.6) / 0.5, color: md }));
      }
    }
  },
  // a toxic glow, a bubbling puddle, swirling miasma and acid bubbles
  Poison(k) {
    const [dk, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, md, 0.9, false);
      shock(k, md);
      rise(k, cnt(k, 6), "bubble", (i) => (i % 2 ? lt : md), { speed: [70, 150], size: [3, 6], g: -30, spread: 0.4 });
    }
    if (k.rest) {
      ground(k, "splat");
      dome(k, dk, md, 0.8, 0.8);
      puffs(k, cnt(k, 6), (i) => (i % 2 ? dk : md), { out: 40, rise: 26, size: [10, 16], grow: 20, life: [1, 1.5], ring: 0.5 });
      rise(k, cnt(k, 8), "bubble", (i) => (i % 2 ? lt : core), { speed: [40, 100], size: [2.5, 5], g: -20 });
      A(k, { kind: "glow", x: k.x, y: k.y, life: 0.6, size: k.R * 0.2, grow: k.R * 1.1, color: md });
      if (k.tier >= 2) {
        dome(k, md, lt, 0.7, 0.5);
        rise(k, cnt(k, 8), "bubble", (i) => (i % 2 ? core : lt), { speed: [60, 130], size: [3, 6.5], g: -30, spread: 0.8 });
      }
    }
  },
  // the ground splits, dust rolls out in a dome, rocks fly up, a second ring follows (+ a column of dust)
  Ground(k) {
    const [dk, md, lt] = k.pal;
    if (k.core) {
      flash(k, lt, 0.8, false);
      shock(k, md, true);
      puffs(k, cnt(k, 5), () => "#c9b79a", { out: 90, rise: 8, size: [9, 14], life: [0.6, 0.95], ring: 0.2 });
    }
    if (k.rest) {
      ground(k);
      burst(k, cnt(k, 10), "plank", (i) => (i % 2 ? dk : lt), { size: [5, 9], g: 760, up: 330 });
      puffs(k, cnt(k, 7), () => "#b8a687", { out: 110, rise: 20, size: [12, 19], grow: 30, life: [0.9, 1.4], ring: 0.5 });
      if (k.tier >= 2) {
        column(k, "#d8c398", "#fff4d0", { w: 0.24, h: 1.2, life: 0.6 });
        ground(k);
      }
    }
  },
  // rings of wind, ribbons sweeping round, feathers circling, a puff of dust
  Flying(k) {
    const [, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, "#ffffff", 0.7, false);
      shock(k, lt, true);
      burst(k, cnt(k, 8), "puff", () => "#ffffff", { size: [5, 7], g: 0, up: 40, out: 160, life: [0.4, 0.6] });
    }
    if (k.rest) {
      if (k.tier >= 1) ribbons(k, cnt(k, 6), (i) => (i % 2 ? lt : core), { size: 3.4, radius: 0.65, spin: 6, life: 0.85, spread: 0.7 });
      else swirl(k, cnt(k, 6), (i) => (i % 2 ? lt : core), { size: 9, speed: 1.9 });
      orbit(k, cnt(k, 8), () => "#ffffff", { radius: 0.7, spin: 4.5, size: 3.2, life: 0.9 });
      puffs(k, cnt(k, 4), () => md, { out: 60, rise: 6, size: [7, 11], life: [0.5, 0.8] });
      if (k.tier >= 2) {
        for (let i = 0; i < 2; i++) k.c.later(0.1 * (i + 1), () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.5, size: 4, grow: (k.R * (1.3 + i * 0.4)) / 0.5, color: "rgba(255,255,255,.55)" }));
      }
    }
  },
  // a lens flare, a rune ring, a rose dome, ribbons and motes in orbit, a refraction ring (+ a beam of light)
  Psychic(k) {
    const [, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, md, 1);
      shock(k, lt);
    }
    if (k.rest) {
      rune(k);
      dome(k, md, lt, 0.8);
      orbit(k, cnt(k, 9), (i) => (i % 2 ? lt : core), { radius: 0.75, spin: 3, size: 2.6, rise: 20, life: 1.1 });
      k.c.later(0.1, () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.6, size: 4, grow: (k.R * 1.6) / 0.6, color: "rgba(255,255,255,.45)" }));
      if (k.tier >= 1) ribbons(k, cnt(k, 3), (i) => (i % 2 ? lt : core), { size: 3, radius: 0.6, life: 1 });
      if (k.tier >= 2) {
        rune(k, 0.62);
        dome(k, lt, core, 0.7, 0.55);
        column(k, md, core, { w: 0.14, h: 1.9 });
      }
    }
  },
  // a swarm circling fast, spores floating up, shards of shell
  Bug(k) {
    const [dk, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, lt, 0.8, false);
      shock(k, md);
      burst(k, cnt(k, 8), "spark", (i) => (i % 2 ? core : lt), { size: [1.8, 3], g: 300, up: 180 });
    }
    if (k.rest) {
      orbit(k, cnt(k, 16), (i) => (i % 3 ? dk : lt), { radius: 0.8, spin: 8, size: 1.9, life: 0.95, spread: 0.5 });
      rise(k, cnt(k, 7), "dot", () => core, { speed: [30, 80], size: [1.6, 2.8], g: -10 });
      burst(k, cnt(k, 5), "shard", (i) => (i % 2 ? md : lt), { size: [3, 5], g: 600, up: 220 });
      if (k.tier >= 1) orbit(k, cnt(k, 12), (i) => (i % 2 ? md : core), { radius: 0.55, spin: -10, size: 1.7, life: 0.85, spread: 0.7 });
      if (k.tier >= 2) {
        ground(k);
        ribbons(k, cnt(k, 3), () => lt, { size: 2.4, radius: 0.7, spin: 8, life: 0.7 });
      }
    }
  },
  // stones fly up and fall, crystals jump, a dust dome rolls out over a cracked floor
  Rock(k) {
    const [dk, md, lt] = k.pal;
    if (k.core) {
      flash(k, lt, 0.8, false);
      shock(k, md);
      burst(k, cnt(k, 8), "plank", (i) => (i % 2 ? dk : lt), { size: [4, 8], g: 800, up: 300 });
    }
    if (k.rest) {
      ground(k);
      burst(k, cnt(k, 6), "shard", () => lt, { size: [4, 7], g: 640, up: 280 });
      puffs(k, cnt(k, 6), () => "#c9b79a", { out: 100, rise: 14, size: [11, 17], grow: 28, life: [0.8, 1.2], ring: 0.5 });
      if (k.tier >= 2) {
        burst(k, cnt(k, 8), "plank", (i) => (i % 2 ? md : dk), { size: [6, 11], g: 700, up: 380 });
        ground(k);
      }
    }
  },
  // a dark dome, a curse ring, embers floating up in orbit, a ring of chain links turning slowly, a distortion wave (+ a dark column)
  Ghost(k) {
    const [dk, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, md, 0.9, false);
      shock(k, md);
    }
    if (k.rest) {
      rune(k);
      dome(k, dk, md, 0.85);
      orbit(k, cnt(k, 8), (i) => (i % 2 ? lt : core), { radius: 0.7, spin: 2.6, size: 2.6, rise: 36, life: 1.2 });
      if (k.tier >= 1) links(k, cnt(k, 14), lt);
      else orbit(k, cnt(k, 9), () => md, { radius: 0.95, spin: 1.6, size: 3.4, life: 1.1, spread: 0.05 });
      k.c.later(0.12, () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.6, size: 4, grow: (k.R * 1.6) / 0.6, color: dk }));
      if (k.tier >= 2) {
        dome(k, md, lt, 0.75, 0.6);
        column(k, md, core, { w: 0.15, h: 1.7 });
        rune(k, 0.62);
      }
    }
  },
  // a rune ring, spirals of energy, gold sparks circling, star flares (+ a pillar of light)
  Dragon(k) {
    const [, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, lt, 1);
      shock(k, md, true);
    }
    if (k.rest) {
      rune(k);
      if (k.tier >= 1) ribbons(k, cnt(k, 6), (i) => (i % 2 ? lt : core), { size: 4, radius: 0.6, spin: 5.5, life: 0.9, rise: 30 });
      else swirl(k, cnt(k, 8), (i) => (i % 2 ? lt : core), { size: 10, speed: 1.7, life: 0.65, turns: 5 });
      orbit(k, cnt(k, 9), (i) => (i % 2 ? "#ffd05a" : core), { radius: 0.7, spin: 5.5, size: 2.4, life: 0.9 });
      burst(k, cnt(k, 6), "star", (i) => (i % 2 ? lt : core), { size: [4, 7], g: 0, up: 0, out: 200, life: [0.5, 0.8] });
      if (k.tier >= 2) {
        rune(k, 0.6);
        column(k, md, "#ffd05a", { w: 0.18, h: 2 });
        k.c.later(0.1, () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.55, size: 4, grow: (k.R * 1.6) / 0.55, color: lt }));
      }
    }
  },
  // an expanding smoke dome, a curse decal, chaotic motes, chain links and a shadow glow
  Dark(k) {
    const [dk, md, lt] = k.pal;
    if (k.core) {
      flash(k, md, 0.8, false);
      shock(k, md);
    }
    if (k.rest) {
      rune(k);
      dome(k, dk, md, 0.8, 0.9);
      puffs(k, cnt(k, 9), (i) => (i % 3 ? dk : "#3a2a50"), { out: 85, rise: 14, size: [12, 18], grow: 30, life: [0.9, 1.4], ring: 0.35 });
      orbit(k, cnt(k, 11), (i) => (i % 2 ? lt : md), { radius: 0.75, spin: 4, size: 2.3, rise: 24, life: 1 });
      A(k, { kind: "glow", x: k.x, y: k.y, life: 0.7, size: k.R * 0.2, grow: k.R * 1.2, color: dk });
      if (k.tier >= 1) links(k, cnt(k, 10), md, { radius: 0.9, spin: -1.6 });
      if (k.tier >= 2) {
        dome(k, md, lt, 0.7, 0.6);
        column(k, dk, md, { w: 0.2, h: 1.6, life: 0.65 });
        rune(k, 0.6);
      }
    }
  },
  // a white flash with a cross, orange sparks, metal shards, a second ring, cracked floor, chains of steel
  Steel(k) {
    const [dk, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, "#ffffff", 1);
      shock(k, lt, true);
      burst(k, cnt(k, 10), "spark", (i) => (i % 2 ? "#ffb02e" : core), { size: [1.8, 3.2], g: 500, up: 280, out: 280 });
    }
    if (k.rest) {
      ground(k);
      burst(k, cnt(k, 7), "plank", (i) => (i % 2 ? md : lt), { size: [3, 6], g: 760, up: 300 });
      puffs(k, cnt(k, 3), () => dk, { out: 50, rise: 8, size: [7, 11], life: [0.5, 0.8] });
      if (k.tier >= 1) links(k, cnt(k, 9), lt, { radius: 0.8, spin: 2.2, life: 0.9 });
      if (k.tier >= 2) {
        burst(k, cnt(k, 10), "spark", () => "#ffb02e", { size: [1.6, 2.8], g: 520, up: 320, out: 320 });
        k.c.later(0.1, () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.5, size: 4, grow: (k.R * 1.5) / 0.5, color: md }));
      }
    }
  },
  // a dome of light, crystal shards, ribbons of sparkle and a gentle rune ring (+ a pillar of light)
  Fairy(k) {
    const [, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, lt, 0.9);
      shock(k, lt);
      burst(k, cnt(k, 8), "star", (i) => (i % 3 ? lt : core), { size: [4, 7], g: 0, up: 0, out: 190, life: [0.5, 0.75] });
    }
    if (k.rest) {
      rune(k);
      dome(k, lt, core, 0.8);
      burst(k, cnt(k, 6), "shard", (i) => (i % 2 ? lt : core), { size: [3.5, 6], g: 540, up: 280 });
      orbit(k, cnt(k, 9), (i) => (i % 2 ? core : md), { radius: 0.7, spin: 3.2, size: 2.4, rise: 28, life: 1.1 });
      if (k.tier >= 1) ribbons(k, cnt(k, 4), (i) => (i % 2 ? lt : core), { size: 3, radius: 0.6, life: 0.95, rise: 20 });
      if (k.tier >= 2) {
        rune(k, 0.6);
        dome(k, core, lt, 0.7, 0.55);
        column(k, lt, core, { w: 0.2, h: 2.1 });
      }
    }
  },
  // a clean flash, two rings, a burst of stars and a puff of dust
  Normal(k) {
    const [, , lt, core] = k.pal;
    if (k.core) {
      flash(k, lt, 0.9);
      shock(k, lt, true);
      burst(k, cnt(k, 8), "star", (i) => (i % 2 ? lt : core), { size: [3.5, 7], g: 0, up: 0, out: 220, life: [0.4, 0.6] });
    }
    if (k.rest) {
      ground(k);
      puffs(k, cnt(k, 4), () => "#e8e4da", { out: 70, rise: 6, size: [8, 12], life: [0.5, 0.8] });
      if (k.tier >= 2) k.c.later(0.1, () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.5, size: 4, grow: (k.R * 1.5) / 0.5, color: lt }));
    }
  },
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Which tier this device gets, and how much of the budget is left (1 = nothing else alive, 0.25 = crowded). */
function budget(c: SpecCtx) {
  const tier = (c.q >= 0.9 ? 2 : c.q >= 0.7 ? 1 : 0) as 0 | 1 | 2;
  const room = clamp(1.3 - c.load * 1.15, 0.25, 1);
  return { tier, room };
}

/** Stack the layers for `type` at (x, y). `pal` is the move's own colour set, so a move keeps its colour variant. */
export function layeredBurst(type: string, x: number, y: number, r: number, part: LayerPart, pal: Pal, c: SpecCtx) {
  const R = clamp(r, 34, 200);
  const { tier, room } = budget(c);
  const s = clamp(R / 70, 0.6, 1.6) * [0.55, 1, 1.4][tier]! * room;
  const k: K = { tier, type, c, x, y, R, s, pal, core: part !== "rest", rest: part !== "core" };
  (RECIPE[type] ?? RECIPE.Normal!)(k);
}

/** What an ordinary hit throws, by type: [particle kind, flies up?, colour index into the palette]. */
const HIT: Record<string, [string, boolean, number]> = {
  Fire: ["spark", true, 3], Water: ["dot", true, 2], Electric: ["spark", false, 3], Grass: ["leaf", true, 1], Ice: ["shard", true, 2], Fighting: ["star", false, 3],
  Poison: ["bubble", true, 2], Ground: ["plank", true, 0], Flying: ["puff", false, 3], Psychic: ["star", false, 2], Bug: ["spark", false, 2], Rock: ["plank", true, 1],
  Ghost: ["dot", true, 2], Dragon: ["spark", false, 3], Dark: ["dot", true, 1], Steel: ["spark", true, 3], Fairy: ["star", false, 2], Normal: ["star", false, 2],
};

/** A small version for an ordinary hit: a flash, one ring and a few pieces of the type. Skipped on slow devices and in a crowd. */
export function layeredHit(type: string, x: number, y: number, dx: number, dy: number, pal: Pal, c: SpecCtx) {
  const { tier, room } = budget(c);
  if (tier === 0 || room < 0.5) return;
  const R = 34;
  const k: K = { tier, type, c, x, y, R, s: room * (tier === 2 ? 1.3 : 1), pal, core: true, rest: false };
  const [kind, up, ci] = HIT[type] ?? HIT.Normal!;
  A(k, { kind: "glow", x, y, life: 0.22, size: 4, grow: 150, color: pal[2] });
  A(k, { kind: "gring", x, y: y + 6, life: 0.3, size: 3, grow: 190, color: pal[2] });
  const ang = Math.atan2(dy || 0.0001, dx || 0.0001);
  for (let i = 0; i < cnt(k, 5); i++) {
    const a = ang + rnd(-1.1, 1.1);
    const v = rnd(80, 230);
    A(k, { kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - (up ? rnd(60, 160) : 0), g: up ? 620 : 0, life: rnd(0.3, 0.6), size: rnd(2, 4.2), rot: rnd(0, 6), vr: rnd(-9, 9), color: i % 2 ? pal[ci]! : pal[3] });
  }
  if (type === "Electric") bolts(k, 2, 0.8);
}

const MAGIC = new Set(["Psychic", "Ghost", "Dark", "Dragon", "Fairy", "Grass", "Ice", "Steel"]);

/** The start of a move: a glow and a few lights circling the caster, and (on a fast device) a small rune ring for the magical types. */
export function layeredCast(type: string, x: number, y: number, pal: Pal, c: SpecCtx) {
  const { tier, room } = budget(c);
  if (tier === 0 || room < 0.45) return;
  const k: K = { tier, type, c, x, y, R: 46, s: room * (tier === 2 ? 1.2 : 0.9), pal, core: false, rest: true };
  A(k, { kind: "gring", x, y: y + 6, life: 0.35, size: 3, grow: 150, color: pal[2] });
  orbit(k, cnt(k, 5), (i) => (i % 2 ? pal[3] : pal[2]), { radius: 0.7, spin: 7, size: 2, life: 0.5, spread: 0.2 });
  if (tier === 2 && MAGIC.has(type)) rune(k, 0.8);
}
