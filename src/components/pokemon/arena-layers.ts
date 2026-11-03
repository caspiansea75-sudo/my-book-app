/**
 * Layered effects for all 18 types, built the way the reference sheets build theirs: a final effect is several simple
 * layers stacked (a flash / core, an expanding shockwave, a dome, a decal on the floor, swirling or rising particles,
 * a glow and a faint distortion ring), and each type picks the layers and the shapes that say its element.
 *
 * Two moments use it:
 *   "core"  the quick part of a heavy hit (flash + shockwave + a few flying pieces), cheap enough for every big hit;
 *   "rest"  the slow part of a zone move or a nova (floor decal, dome, orbiting / rising / swirling pieces).
 *   "all"   both at once.
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
function rune(k: K) {
  k.c.decal({ kind: "vfx", x: k.x, y: k.y + 4, r: Math.min(110, k.R * 1.2), life: 1.05, seed: Math.random() * 900, ang: rnd(0, TAU), vfx: { style: "rune", motif: "rune", pal: k.pal, tex: typeTex(k.type) } });
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

/** Soft puffs that spread out in a ring (a smoke dome, dust, mist). */
function puffs(k: K, n: number, color: (i: number) => string, o: { out?: number; rise?: number; size?: [number, number]; grow?: number; life?: [number, number]; ring?: number } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(-0.2, 0.2);
    const d = k.R * (o.ring ?? 0.25) * rnd(0.6, 1.2);
    A(k, {
      kind: "smoke", x: k.x + Math.cos(a) * d, y: k.y + Math.sin(a) * d * 0.6, vx: Math.cos(a) * (o.out ?? 70) * rnd(0.6, 1.2), vy: Math.sin(a) * (o.out ?? 70) * 0.5 - (o.rise ?? 20), g: 0,
      life: rnd(...(o.life ?? [0.8, 1.3])), size: rnd(...(o.size ?? [10, 16])), grow: o.grow ?? 26, color: color(i),
    });
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
  // flash + shockwave + flying sparks and debris + a cracked, glowing floor + rising embers and smoke + heat haze
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
    }
  },
  // a ripple of rings, a dome of water, droplets circling up, a splash on the floor and mist
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
      swirl(k, 3, () => lt, { size: 7 });
      puffs(k, cnt(k, 4), () => "#e8f6ff", { out: 40, rise: 30, size: [8, 12], life: [0.7, 1] });
    }
  },
  // flash + radial air shockwave + forking arcs + circling sparks + forked lightning running over the floor
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
    }
  },
  // thorns out of the ground, leaves wheeling round, pollen drifting up, a green rune ring
  Grass(k) {
    const [dk, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, lt, 0.8, false);
      shock(k, md);
      burst(k, cnt(k, 8), "leaf", (i) => pick([dk, md, lt]), { size: [3.5, 6], g: 150, up: 200, life: [0.8, 1.2] });
    }
    if (k.rest) {
      rune(k);
      ground(k);
      spikes(k, cnt(k, 6), (i) => (i % 2 ? md : lt), { size: [4, 6], up: 240 });
      orbit(k, cnt(k, 9), (i) => (i % 2 ? core : lt), { radius: 0.7, spin: 3.5, size: 2.4, rise: 30, life: 1.1 });
      rise(k, cnt(k, 6), "dot", () => core, { speed: [30, 80], size: [1.5, 2.6], g: -10, life: [1, 1.5] });
    }
  },
  // frost spikes standing up, a runic frost ring, ice shards circling, freezing mist and falling flakes
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
    }
  },
  // the ground splits, dust rolls out in a dome, rocks fly up, a second ring follows
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
      swirl(k, cnt(k, 6), (i) => (i % 2 ? lt : core), { size: 9, speed: 1.9 });
      orbit(k, cnt(k, 8), () => "#ffffff", { radius: 0.7, spin: 4.5, size: 3.2, life: 0.9 });
      puffs(k, cnt(k, 4), () => md, { out: 60, rise: 6, size: [7, 11], life: [0.5, 0.8] });
    }
  },
  // a lens flare, a rune ring, a rose dome, motes drifting in orbit, a refraction ring
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
    }
  },
  // a dark dome, a curse ring, embers floating up in orbit, a ring of links turning slowly, a distortion wave
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
      orbit(k, cnt(k, 9), () => md, { radius: 0.95, spin: 1.6, size: 3.4, life: 1.1, spread: 0.05 });
      k.c.later(0.12, () => A(k, { kind: "gring", x: k.x, y: k.y + 6, life: 0.6, size: 4, grow: (k.R * 1.6) / 0.6, color: dk }));
    }
  },
  // a rune ring, spirals of energy, gold sparks circling, star flares
  Dragon(k) {
    const [, md, lt, core] = k.pal;
    if (k.core) {
      flash(k, lt, 1);
      shock(k, md, true);
    }
    if (k.rest) {
      rune(k);
      swirl(k, cnt(k, 8), (i) => (i % 2 ? lt : core), { size: 10, speed: 1.7, life: 0.65, turns: 5 });
      orbit(k, cnt(k, 9), (i) => (i % 2 ? "#ffd05a" : core), { radius: 0.7, spin: 5.5, size: 2.4, life: 0.9 });
      burst(k, cnt(k, 6), "star", (i) => (i % 2 ? lt : core), { size: [4, 7], g: 0, up: 0, out: 200, life: [0.5, 0.8] });
    }
  },
  // an expanding smoke dome, a curse decal, chaotic motes and a shadow glow
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
    }
  },
  // a white flash with a cross, orange sparks, metal shards, a second ring, cracked floor
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
    }
  },
  // a dome of light, crystal shards, sparkles and a gentle rune ring
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
    }
  },
};

/** Stack the layers for `type` at (x, y). `pal` is the move's own colour set, so a move keeps its colour variant. */
export function layeredBurst(type: string, x: number, y: number, r: number, part: LayerPart, pal: Pal, c: SpecCtx) {
  const R = Math.max(34, Math.min(190, r));
  const k: K = { type, c, x, y, R, s: Math.max(0.6, Math.min(1.6, R / 70)), pal, core: part !== "rest", rest: part !== "core" };
  (RECIPE[type] ?? RECIPE.Normal!)(k);
}
