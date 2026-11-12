import type { MegaStyle } from "@/lib/pokemon/arena-megamoves";

/** What a look needs from the renderer: put a particle in, a ring, call something a moment later, shake and flash the screen. */
export type MegaApi = {
  P: (p: Record<string, unknown>) => void;
  ring: (x: number, y: number, color: string, r: number, life?: number) => void;
  later: (t: number, fn: () => void) => void;
  shake: (amount: number, time: number) => void;
  flash: (t: number) => void;
};

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

/** Lights rushing in from the edge to the centre before the burst. */
function gather(a: MegaApi, x: number, y: number, R: number, cols: string[], n = 22, kind = "spark", tm = 0.28) {
  for (let i = 0; i < n; i++) {
    const an = Math.random() * TAU, d = R * rnd(0.7, 1.15);
    a.P({ kind, x: x + Math.cos(an) * d, y: y + Math.sin(an) * d, vx: (-Math.cos(an) * d) / tm, vy: (-Math.sin(an) * d) / tm, life: tm, size: rnd(2, 4), color: pick(cols), rot: 0, vr: 8 });
  }
}
const glow = (a: MegaApi, x: number, y: number, size: number, grow: number, color: string, life = 0.5) => a.P({ kind: "glow", x, y, life, size, grow, color });
const tangent = (a: MegaApi, x: number, y: number, R: number, kind: string, cols: string[], n: number, life: number, spin: number, out: number, size: number) => {
  for (let i = 0; i < n; i++) {
    const an = (i / n) * TAU, r = R * rnd(0.15, 0.55);
    a.P({ kind, x: x + Math.cos(an) * r, y: y + Math.sin(an) * r, vx: -Math.sin(an) * spin + Math.cos(an) * out, vy: Math.cos(an) * spin + Math.sin(an) * out, life: life * rnd(0.8, 1.1), size, color: pick(cols), rot: an, vr: rnd(-8, 8) });
  }
};
const cracks = (a: MegaApi, x: number, y: number, R: number, n: number, color: string) => {
  for (let i = 0; i < n; i++) {
    const an = (i / n) * TAU + rnd(-0.2, 0.2);
    a.P({ kind: "crack", x, y, x2: x + Math.cos(an) * R * rnd(0.75, 1.05), y2: y + Math.sin(an) * R * rnd(0.75, 1.05), life: 1.3, size: 3, color, seed: Math.random() * 9 });
  }
};

const LOOKS: Record<MegaStyle, (a: MegaApi, x: number, y: number, c1: string, c2: string, R: number) => void> = {
  // a ring of fire: embers rush in, then flames rise in columns and spiral out
  inferno(a, x, y, c1, c2, R) {
    gather(a, x, y, R, [c1, c2, "#ffffff"]);
    a.later(0.28, () => {
      a.ring(x, y, c2, R * 1.1, 0.5); a.ring(x, y, c1, R, 0.8);
      glow(a, x, y, 40, R * 2.2, c1, 0.6);
      for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + 0.3; a.P({ kind: "pillar", x: x + Math.cos(an) * R * 0.72, y: y + Math.sin(an) * R * 0.72, life: 0.7, size: 22, weight: 110, color: c1 }); }
      for (let i = 0; i < 90; i++) a.later(i * 0.006, () => { const an = rnd(0, TAU), r = rnd(0.1, 1) * R; a.P({ kind: "flame", x: x + Math.cos(an) * r, y: y + Math.sin(an) * r, vx: Math.cos(an) * 60, vy: -rnd(60, 220), life: rnd(0.6, 1.0), size: rnd(9, 17), color: Math.random() < 0.6 ? c1 : c2, seed: Math.random() * 9 }); });
      a.shake(11, 0.35);
    });
  },
  // torrents: rings of splash, crescent water blades, bubbles
  tide(a, x, y, c1, c2, R) {
    glow(a, x, y, 20, R * 1.5, c1, 0.4);
    for (let i = 0; i < 3; i++) a.later(i * 0.1, () => a.ring(x, y, i % 2 ? c2 : c1, R * (1.2 - i * 0.15), 0.6));
    for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; a.P({ kind: "arc", x: x + Math.cos(an) * 30, y: y + Math.sin(an) * 30, vx: Math.cos(an) * 420, vy: Math.sin(an) * 420, life: 0.55, size: 9, color: i % 2 ? c2 : c1, rot: an, vr: 9 }); }
    for (let i = 0; i < 26; i++) { const an = rnd(0, TAU), s = rnd(60, 300); a.P({ kind: "bubble", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 40, life: rnd(0.6, 1.1), size: rnd(4, 9), color: pick([c1, c2]) }); }
    for (let i = 0; i < 30; i++) { const an = rnd(0, TAU), s = rnd(120, 460); a.P({ kind: "dot", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 140, g: 520, life: rnd(0.4, 0.8), size: rnd(2, 4), color: c2 }); }
    a.shake(9, 0.3);
  },
  // forking lightning in every direction
  thunder(a, x, y, c1, c2, R) {
    a.flash(0.1);
    gather(a, x, y, R * 0.7, [c1, c2], 14, "spark", 0.18);
    for (let i = 0; i < 12; i++) a.later(0.12 + i * 0.025, () => { const an = (i / 12) * TAU + rnd(-0.15, 0.15); a.P({ kind: "bolt", x, y, x2: x + Math.cos(an) * R * rnd(0.85, 1.15), y2: y + Math.sin(an) * R * rnd(0.85, 1.15), life: 0.32, size: 4, color: i % 3 ? c1 : c2, seed: i * 3 + 1 }); });
    a.later(0.12, () => { a.ring(x, y, c1, R, 0.45); a.ring(x, y, "#ffffff", R * 0.6, 0.3); glow(a, x, y, 30, R * 1.8, c1, 0.4); });
    for (let i = 0; i < 40; i++) a.later(0.12 + i * 0.006, () => { const an = rnd(0, TAU), s = rnd(200, 520); a.P({ kind: "spark", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: rnd(0.2, 0.5), size: rnd(1.8, 3.4), color: pick([c1, c2, "#ffffff"]) }); });
    a.shake(10, 0.3);
  },
  // spirit lights spiral in, then a calm shockwave of rings and rising motes
  aura(a, x, y, c1, c2, R) {
    for (let i = 0; i < 24; i++) { const an = (i / 24) * TAU * 2, d = R * (1.2 - i / 24 * 0.2), tm = 0.34; a.P({ kind: "star", x: x + Math.cos(an) * d, y: y + Math.sin(an) * d, vx: (-Math.cos(an) * d) / tm, vy: (-Math.sin(an) * d) / tm, life: tm, size: 4, color: i % 2 ? c1 : c2, rot: 0, vr: 6 }); }
    a.later(0.34, () => {
      a.ring(x, y, "#ffffff", R * 1.15, 0.4); a.ring(x, y, c1, R, 0.6); a.ring(x, y, c2, R * 0.75, 0.8);
      glow(a, x, y, 50, R * 1.9, c1, 0.6);
      for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU; a.P({ kind: "pillar", x: x + Math.cos(an) * R * 0.5, y: y + Math.sin(an) * R * 0.5, life: 0.9, size: 14, weight: 170, color: "#ffffff" }); }
      for (let i = 0; i < 28; i++) { const an = rnd(0, TAU), r = rnd(0, R); a.P({ kind: "glow", x: x + Math.cos(an) * r, y: y + Math.sin(an) * r, vy: -rnd(40, 100), life: rnd(0.7, 1.2), size: rnd(4, 9), grow: -4, color: pick([c1, c2]) }); }
      a.shake(8, 0.3);
    });
  },
  // contracting then expanding rings with floating orbs
  psychic(a, x, y, c1, c2, R) {
    a.P({ kind: "ring", x, y, life: 0.35, size: R * 1.2, grow: -(R * 1.15) / 0.35, color: c1 });
    a.P({ kind: "ring", x, y, life: 0.35, size: R * 0.9, grow: -(R * 0.85) / 0.35, color: c2 });
    a.later(0.35, () => {
      a.flash(0.08);
      for (let i = 0; i < 3; i++) a.later(i * 0.09, () => a.ring(x, y, i % 2 ? c2 : c1, R * (1.15 - i * 0.12), 0.7));
      glow(a, x, y, 40, R * 2, c1, 0.5);
      for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU; a.P({ kind: "orbit", x, y, x2: x, y2: y, rot: an, vr: i % 2 ? 5 : -5, weight: 16, seed: 210 + i * 12, life: 0.9, size: 6, color: i % 2 ? c1 : c2 }); }
      for (let i = 0; i < 24; i++) { const an = rnd(0, TAU), s = rnd(80, 360); a.P({ kind: "star", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: rnd(0.5, 0.9), size: rnd(3, 6), color: pick([c1, c2, "#ffffff"]), rot: 0, vr: 7 }); }
      a.shake(7, 0.3);
    });
  },
  // a dark void: smoke plumes spread, wisps coil, red eyes open
  shadow(a, x, y, c1, c2, R) {
    glow(a, x, y, 30, R * 1.4, c1, 0.6);
    a.ring(x, y, c2, R * 0.9, 0.7);
    for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU; a.P({ kind: "plume", x: x + Math.cos(an) * 20, y: y + Math.sin(an) * 20, vx: Math.cos(an) * 170, vy: Math.sin(an) * 170, life: 0.9, size: 34, grow: 40, color: c1, edge: c2, seed: i * 2.3 }); }
    tangent(a, x, y, R, "streak", [c2, c1], 18, 0.7, 520, 160, 7);
    for (let i = 0; i < 6; i++) a.later(0.12 + i * 0.07, () => { const an = rnd(0, TAU), r = rnd(0.3, 0.9) * R; for (const s of [-6, 6]) a.P({ kind: "dot", x: x + Math.cos(an) * r + s, y: y + Math.sin(an) * r, life: 0.55, size: 3, color: "#ff3a5a" }); });
    a.shake(8, 0.4);
  },
  // crossing slashes and flying steel
  blades(a, x, y, c1, c2, R) {
    for (let k = 0; k < 4; k++) a.later(k * 0.05, () => { const an = (k / 4) * Math.PI + 0.3; a.P({ kind: "streak", x: x - Math.cos(an) * R, y: y - Math.sin(an) * R, vx: Math.cos(an) * 1500, vy: Math.sin(an) * 1500, life: 0.3, size: 14, color: k % 2 ? c1 : c2 }); });
    for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU; a.P({ kind: "arc", x: x + Math.cos(an) * 40, y: y + Math.sin(an) * 40, vx: Math.cos(an) * 360, vy: Math.sin(an) * 360, life: 0.5, size: 12, color: i % 2 ? c1 : c2, rot: an, vr: 12 }); }
    a.later(0.1, () => { a.ring(x, y, "#ffffff", R * 1.1, 0.35); a.ring(x, y, c1, R * 0.8, 0.5); });
    for (let i = 0; i < 22; i++) { const an = rnd(0, TAU), s = rnd(180, 520); a.P({ kind: "shard", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: rnd(0.4, 0.8), size: rnd(2.5, 4.5), color: pick([c1, c2, "#e8eefc"]), rot: 0, vr: rnd(-12, 12) }); }
    a.shake(9, 0.25);
  },
  // ice: shards fly out, snowflakes and a cold ring
  frost(a, x, y, c1, c2, R) {
    glow(a, x, y, 20, R * 1.6, c1, 0.5);
    a.ring(x, y, "#ffffff", R * 1.15, 0.45); a.ring(x, y, c1, R * 0.9, 0.7);
    for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU; a.P({ kind: "shard", x: x + Math.cos(an) * 20, y: y + Math.sin(an) * 20, vx: Math.cos(an) * 440, vy: Math.sin(an) * 440, life: 0.55, size: 7, color: i % 2 ? c1 : c2, rot: an + Math.PI / 2, vr: 0 }); }
    for (let i = 0; i < 40; i++) { const an = rnd(0, TAU), s = rnd(80, 330); a.P({ kind: "flake", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: rnd(0.7, 1.3), size: rnd(3, 6), color: pick([c1, c2, "#ffffff"]), rot: 0, vr: rnd(-6, 6) }); }
    for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU; a.P({ kind: "pillar", x: x + Math.cos(an) * R * 0.65, y: y + Math.sin(an) * R * 0.65, life: 0.8, size: 18, weight: 120, color: c1 }); }
    a.shake(8, 0.3);
  },
  // two spiral arms of dragon light and two great wing slashes
  dragon(a, x, y, c1, c2, R) {
    gather(a, x, y, R, [c1, c2], 16, "streak", 0.22);
    a.later(0.22, () => {
      a.flash(0.06);
      glow(a, x, y, 50, R * 2, c1, 0.55);
      a.ring(x, y, c2, R * 1.1, 0.45); a.ring(x, y, c1, R * 0.85, 0.7);
      for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 22; i++) { const an = arm * Math.PI + (i / 22) * Math.PI * 2.2, s = 120 + i * 20; a.P({ kind: "streak", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: 0.7, size: 7, color: arm ? c1 : c2 }); }
      for (const sd of [-1, 1]) a.P({ kind: "arc", x: x + sd * 40, y: y - 10, vx: sd * 260, vy: -30, life: 0.7, size: 26, color: c1, rot: sd > 0 ? -0.6 : Math.PI + 0.6, vr: sd * 3 });
      for (let i = 0; i < 18; i++) { const an = rnd(0, TAU), s = rnd(160, 420); a.P({ kind: "star", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: 0.7, size: 4, color: pick([c1, c2, "#ffffff"]), rot: 0, vr: 7 }); }
      a.shake(12, 0.4);
    });
  },
  // whirling winds
  tempest(a, x, y, c1, c2, R) {
    a.ring(x, y, c2, R * 1.2, 0.6); a.ring(x, y, c1, R * 0.85, 0.8);
    for (let ly = 0; ly < 3; ly++) a.later(ly * 0.08, () => tangent(a, x, y, R, "streak", [c1, c2, "#ffffff"], 18, 0.7, 520 - ly * 70, 170, 6));
    for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU; a.P({ kind: "arc", x: x + Math.cos(an) * 30, y: y + Math.sin(an) * 30, vx: Math.cos(an + 0.7) * 300, vy: Math.sin(an + 0.7) * 300, life: 0.7, size: 11, color: i % 2 ? c1 : c2, rot: an, vr: 7 }); }
    for (let i = 0; i < 26; i++) { const an = rnd(0, TAU), s = rnd(80, 330); a.P({ kind: "dot", x, y, vx: Math.cos(an) * s - Math.sin(an) * 120, vy: Math.sin(an) * s + Math.cos(an) * 120, life: rnd(0.5, 0.9), size: rnd(2, 4), color: c2 }); }
    glow(a, x, y, 20, R * 1.4, c1, 0.4);
    a.shake(8, 0.3);
  },
  // cracks race out, rocks fly up, dust
  quake(a, x, y, c1, c2, R) {
    cracks(a, x, y, R, 10, "#2a1c10");
    a.ring(x, y, c2, R * 1.1, 0.55); a.ring(x, y, c1, R * 0.8, 0.8);
    glow(a, x, y, 40, R * 1.6, c1, 0.6);
    for (let i = 0; i < 18; i++) { const an = rnd(0, TAU), s = rnd(90, 260); a.P({ kind: "plank", x: x + Math.cos(an) * 30, y: y + Math.sin(an) * 30, vx: Math.cos(an) * s, vy: -rnd(260, 520), g: 1100, life: rnd(0.7, 1.1), size: rnd(4, 9), color: pick([c1, "#6b5a3a", "#8a7a5a"]), rot: 0, vr: rnd(-10, 10) }); }
    for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; a.P({ kind: "plume", x: x + Math.cos(an) * R * 0.5, y: y + Math.sin(an) * R * 0.5, vx: Math.cos(an) * 60, vy: -30, life: 0.9, size: 18, grow: 24, color: c2, edge: "#fff3d6", seed: i * 1.7 }); }
    a.shake(18, 0.5);
  },
  // sparkling stars and rainbow rings
  starlight(a, x, y, c1, c2, R) {
    glow(a, x, y, 40, R * 1.9, c1, 0.6);
    ["#ff9ad0", "#ffd84d", "#9affd0", "#9ad0ff", "#d09aff"].forEach((cc, i) => a.later(i * 0.06, () => a.ring(x, y, cc, R * (1.25 - i * 0.14), 0.7)));
    for (let i = 0; i < 40; i++) { const an = rnd(0, TAU), s = rnd(80, 420); a.P({ kind: "star", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: rnd(0.7, 1.2), size: rnd(4, 8), color: pick([c1, c2, "#ffffff", "#ffd84d"]), rot: 0, vr: rnd(-6, 6) }); }
    for (let i = 0; i < 26; i++) a.later(0.1 + i * 0.015, () => { const an = rnd(0, TAU), r = rnd(0, R); a.P({ kind: "glow", x: x + Math.cos(an) * r, y: y + Math.sin(an) * r - 40, vy: 70, life: 0.8, size: rnd(4, 8), grow: -3, color: pick([c1, c2]) }); });
    a.shake(6, 0.3);
  },
  // acid bubbles, poison clouds, stingers
  toxic(a, x, y, c1, c2, R) {
    a.ring(x, y, c2, R * 1.1, 0.6); a.ring(x, y, c1, R * 0.85, 0.8);
    for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU; a.P({ kind: "plume", x: x + Math.cos(an) * 30, y: y + Math.sin(an) * 30, vx: Math.cos(an) * 130, vy: Math.sin(an) * 130, life: 0.9, size: 20, grow: 26, color: c1, edge: c2, seed: i * 1.3 }); }
    for (let i = 0; i < 30; i++) { const an = rnd(0, TAU), s = rnd(60, 280); a.P({ kind: "bubble", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 30, life: rnd(0.7, 1.3), size: rnd(4, 9), color: pick([c1, c2]) }); }
    for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; a.P({ kind: "streak", x, y, vx: Math.cos(an) * 600, vy: Math.sin(an) * 600, life: 0.4, size: 6, color: c2 }); }
    a.shake(7, 0.3);
  },
  // a swarm of darting streaks
  swarm(a, x, y, c1, c2, R) {
    a.ring(x, y, c1, R, 0.55);
    for (let i = 0; i < 40; i++) a.later(i * 0.008, () => { const an = (i / 40) * TAU * 2, s = rnd(280, 560); a.P({ kind: "streak", x: x + Math.cos(an) * 24, y: y + Math.sin(an) * 24, vx: Math.cos(an + 0.5) * s, vy: Math.sin(an + 0.5) * s, life: 0.5, size: 7, color: pick([c1, c2]) }); });
    for (let i = 0; i < 14; i++) { const an = rnd(0, TAU), s = rnd(120, 360); a.P({ kind: "star", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: 0.6, size: 4, color: c2, rot: 0, vr: 9 }); }
    glow(a, x, y, 24, R * 1.3, c1, 0.4);
    a.later(0.1, () => a.ring(x, y, c2, R * 1.25, 0.5));
    a.shake(8, 0.3);
  },
  // sets of triple claw slashes
  claws(a, x, y, c1, c2, R) {
    const set = (delay: number, base: number, col: string) => a.later(delay, () => {
      for (let k = -1; k <= 1; k++) { const nx = -Math.sin(base) * k * 26, ny = Math.cos(base) * k * 26; a.P({ kind: "streak", x: x - Math.cos(base) * R * 0.9 + nx, y: y - Math.sin(base) * R * 0.9 + ny, vx: Math.cos(base) * 1600, vy: Math.sin(base) * 1600, life: 0.3, size: 12, color: col }); }
      for (let i = 0; i < 10; i++) a.P({ kind: "spark", x, y, vx: rnd(-380, 380), vy: rnd(-380, 380), life: 0.35, size: 2.6, color: col });
    });
    const b0 = rnd(0, Math.PI);
    set(0, b0, c1); set(0.1, b0 + 1.2, c2); set(0.2, b0 - 1.2, c1);
    a.later(0.1, () => { a.ring(x, y, "#ffffff", R * 1.05, 0.35); a.ring(x, y, c1, R * 0.8, 0.5); });
    glow(a, x, y, 20, R, c2, 0.4);
    a.shake(10, 0.3);
  },
  // leaves and petals in a spiral
  verdant(a, x, y, c1, c2, R) {
    glow(a, x, y, 30, R * 1.5, c1, 0.5);
    a.ring(x, y, c1, R * 1.1, 0.7); a.ring(x, y, c2, R * 0.8, 0.9);
    for (let i = 0; i < 50; i++) a.later(i * 0.008, () => { const an = (i / 50) * TAU * 2, s = 160 + (i % 10) * 28; a.P({ kind: "leaf", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 30, g: 60, life: rnd(0.8, 1.3), size: rnd(4, 7), color: i % 3 ? c1 : c2, rot: an, vr: rnd(-10, 10) }); });
    for (let i = 0; i < 24; i++) { const an = rnd(0, TAU), r = rnd(0.1, 1) * R; a.P({ kind: "glow", x: x + Math.cos(an) * r, y: y + Math.sin(an) * r, vy: -rnd(30, 80), life: rnd(0.8, 1.2), size: rnd(3, 7), grow: -2, color: c2 }); }
    a.shake(7, 0.3);
  },
  // fire and cracks together
  magma(a, x, y, c1, c2, R) {
    cracks(a, x, y, R, 8, c1);
    LOOKS.inferno(a, x, y, c1, c2, R);
    for (let i = 0; i < 12; i++) { const an = rnd(0, TAU), s = rnd(100, 260); a.P({ kind: "plank", x, y, vx: Math.cos(an) * s, vy: -rnd(300, 520), g: 1100, life: 1, size: rnd(4, 8), color: pick([c1, "#3a2a2a"]), rot: 0, vr: rnd(-10, 10) }); }
  },
  // clockwork lines: straight bolts along the compass and corners, with rings
  pulse(a, x, y, c1, c2, R) {
    a.flash(0.06);
    for (let k = 0; k < 8; k++) a.later(0.05 * (k % 2), () => { const an = (k / 8) * TAU; a.P({ kind: "bolt", x, y, x2: x + Math.cos(an) * R * (k % 2 ? 0.8 : 1.1), y2: y + Math.sin(an) * R * (k % 2 ? 0.8 : 1.1), life: 0.35, size: 4, color: k % 2 ? c2 : c1, seed: k * 5 + 2 }); });
    for (let i = 0; i < 3; i++) a.later(i * 0.08, () => a.ring(x, y, i % 2 ? c2 : c1, R * (1.1 - i * 0.2), 0.6));
    for (let i = 0; i < 20; i++) { const k = i % 8, an = (k / 8) * TAU, s = rnd(200, 500); a.P({ kind: "spark", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: 0.4, size: 3, color: pick([c1, c2]) }); }
    glow(a, x, y, 30, R * 1.6, c1, 0.45);
    a.shake(9, 0.3);
  },
  // a spiral galaxy of stars and a dark core
  cosmic(a, x, y, c1, c2, R) {
    glow(a, x, y, 60, R * 1.8, c1, 0.7);
    ["#ff9ad0", "#9ad0ff", c1, c2].forEach((cc, i) => a.later(i * 0.07, () => a.ring(x, y, cc, R * (1.2 - i * 0.12), 0.7)));
    for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 28; i++) { const an = arm * Math.PI + (i / 28) * Math.PI * 2.4, s = 100 + i * 14; a.P({ kind: "star", x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: 0.9, size: rnd(3, 6), color: pick([c1, c2, "#ffffff"]), rot: 0, vr: rnd(-6, 6) }); }
    a.shake(10, 0.4);
  },
};

export function playMegaLook(style: MegaStyle, a: MegaApi, x: number, y: number, c1: string, c2: string, R = 230) {
  (LOOKS[style] ?? LOOKS.cosmic)(a, x, y, c1, c2, R);
}
