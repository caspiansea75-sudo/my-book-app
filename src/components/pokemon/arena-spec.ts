/**
 * Art for the 18 type-specialty moves. Each one has its own look (lava pool, water-vortex cage, mushroom garden,
 * lightning cage, snowflake burst, chasm, wind blades, bugs, a wisp with a face, rune circle + claw rake, eclipse,
 * armour plates, moonbeam, a hand of mind power...) instead of borrowing the art of a generic move.
 * The renderer owns the particle list; this module only draws and asks for particles through `SpecCtx`.
 */

import { texPat } from "./arena-tex";

export const SPEC_ART = new Set([
  "overdriverush", "magmastorm", "whirlpoolprison", "sporegarden", "thundercage", "absolutezero", "finalflurry", "toxicflood",
  "psychicgrip", "fissurebreak", "hurricanegale", "swarmburst", "rockwrecker", "hauntingcurse", "draconicfury", "eternalnight",
  "ironfortress", "moonlitwish",
]);

export type SP = { kind: string; x: number; y: number; vx?: number; vy?: number; g?: number; life: number; size?: number; grow?: number; color: string; x2?: number; y2?: number; seed?: number; rot?: number; vr?: number; edge?: string; text?: string; weight?: number };
export type Decal = { kind: "snow" | "night" | "runes" | "claws"; x: number; y: number; r: number; t: number; life: number; seed: number; ang: number };

export interface SpecCtx {
  add(p: SP): void;
  ring(x: number, y: number, color: string, r: number, life?: number): void;
  later(t: number, fn: () => void): void;
  shake(a: number, d: number): void;
  flash(t: number): void;
  night(t: number): void;
  decal(d: Omit<Decal, "t">): void;
  scorch(x: number, y: number, r: number, type: string): void;
}

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
const hash = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const ease = (u: number) => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;

function ball(g: CanvasRenderingContext2D, x: number, y: number, r: number, c0: string, c1: string) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, c0);
  gr.addColorStop(1, c1);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/* ------------------------------------------------------------------ the moment a specialty lands (or is cast on the spot) */

export function specBoom(id: string, x: number, y: number, r: number, c: SpecCtx) {
  const A = c.add;
  const add = (p: SP) => A.call(c, p);
  switch (id) {
    case "magmastorm":
      c.ring(x, y, "#ff7a1a", r * 1.2, 0.5);
      c.ring(x, y, "#ffe27a", r * 0.7, 0.35);
      add({ kind: "glow", x, y, life: 0.5, size: r * 0.6, grow: r * 1.4, color: "#ff8a1f" });
      for (let i = 0; i < 26; i++) add({ kind: "dot", x: x + rnd(-14, 14), y, vx: rnd(-160, 160), vy: rnd(-560, -240), g: 760, life: rnd(0.7, 1.2), size: rnd(4, 8), color: pick(["#ff5a1a", "#ffb02e", "#ffe27a"]) });
      for (let i = 0; i < 10; i++) add({ kind: "flame", x: x + rnd(-r * 0.5, r * 0.5), y: y + rnd(-6, 6), vx: rnd(-50, 50), vy: rnd(-300, -140), g: 40, life: rnd(0.6, 1), size: rnd(10, 18), color: pick(["#ffd84d", "#ff8a1f", "#e63a1e"]), seed: i });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; add({ kind: "crack", x, y, life: 1.4, color: "#000", x2: x + Math.cos(a) * r * 1.3, y2: y + Math.sin(a) * r * 1.0, seed: 11 + i }); }
      for (let i = 0; i < 5; i++) add({ kind: "smoke", x: x + rnd(-r * 0.4, r * 0.4), y, vx: rnd(-20, 20), vy: rnd(-130, -70), life: rnd(1, 1.6), size: rnd(14, 22), grow: 30, color: i % 2 ? "#3a2a26" : "#1f1614" });
      c.scorch(x, y, r * 0.8, "Fire");
      c.shake(9, 0.3);
      c.flash(0.08);
      break;
    case "whirlpoolprison":
      c.ring(x, y, "#2f8fe0", r * 1.2, 0.55);
      c.ring(x, y, "#e8f6ff", r * 0.8, 0.4);
      c.later(0.14, () => c.ring(x, y, "#8fd2ff", r * 1.0, 0.5));
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; add({ kind: "arc", x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.4, vx: Math.cos(a + 1.2) * r * 1.2, vy: Math.sin(a + 1.2) * r * 1.2, life: 0.7, size: 12, color: i % 2 ? "#3da0ff" : "#8fd3ff", rot: a, vr: 6 }); }
      for (let i = 0; i < 30; i++) add({ kind: "bubble", x: x + rnd(-r * 0.8, r * 0.8), y: y + rnd(-r * 0.4, r * 0.4), vx: rnd(-30, 30), vy: rnd(-120, -40), g: -20, life: rnd(0.7, 1.3), size: rnd(3, 8), color: "#bfe6ff" });
      for (let i = 0; i < 20; i++) add({ kind: "dot", x, y, vx: rnd(-200, 200), vy: rnd(-420, -160), g: 800, life: rnd(0.5, 0.9), size: rnd(2.5, 5), color: i % 2 ? "#ffffff" : "#6fc0ff" });
      c.shake(4, 0.25);
      break;
    case "sporegarden":
      c.ring(x, y, "#a8e890", r * 1.1, 0.6);
      c.ring(x, y, "#ffb0e8", r * 0.8, 0.45);
      for (let i = 0; i < 30; i++) add({ kind: "smoke", x: x + rnd(-r * 0.7, r * 0.7), y: y + rnd(-r * 0.4, r * 0.3), vx: rnd(-26, 26), vy: rnd(-70, -20), life: rnd(1, 1.6), size: rnd(8, 15), grow: 16, color: pick(["#ffb0e8", "#a8e890", "#fff3a0", "#c9a0ff"]) });
      for (let i = 0; i < 26; i++) add({ kind: "spark", x, y, vx: rnd(-120, 120), vy: rnd(-200, -40), g: -20, life: rnd(0.9, 1.6), size: rnd(1.6, 3), color: pick(["#fff3a0", "#d8ff8a", "#ffd1f4"]) });
      for (let i = 0; i < 10; i++) add({ kind: "leaf", x, y, vx: rnd(-160, 160), vy: rnd(-260, -60), g: 150, life: rnd(0.8, 1.3), size: rnd(3.5, 6), color: i % 2 ? "#6fcf4a" : "#ffb0e8", rot: rnd(0, 6), vr: rnd(-9, 9) });
      break;
    case "absolutezero":
      c.decal({ kind: "snow", x, y, r: Math.max(150, r * 1.05), life: 1.7, seed: Math.random() * 99, ang: rnd(0, 1) });
      c.ring(x, y, "#ffffff", r * 1.3, 0.5);
      c.ring(x, y, "#8fe6ff", r * 0.9, 0.7);
      add({ kind: "glow", x, y, life: 0.5, size: r * 0.4, grow: r * 1.6, color: "#9fe8ff" });
      for (let i = 0; i < 40; i++) { const a = rnd(0, TAU), v = rnd(120, r * 3.2); add({ kind: "shard", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.5, 1.0), size: rnd(3, 7), color: i % 2 ? "#ffffff" : "#bfefff", rot: rnd(0, 6), vr: rnd(-10, 10) }); }
      for (let i = 0; i < 30; i++) add({ kind: "flake", x: x + rnd(-r, r), y: y + rnd(-r * 0.6, r * 0.6), vx: rnd(-40, 40), vy: rnd(10, 60), life: rnd(1.1, 1.9), size: rnd(3, 6), color: "#e8fbff", rot: rnd(0, 3), vr: rnd(-4, 4) });
      c.shake(6, 0.25);
      c.flash(0.06);
      break;
    case "toxicflood":
      c.ring(x, y, "#a24be0", r * 1.15, 0.5);
      c.ring(x, y, "#7ed957", r * 0.8, 0.4);
      for (let i = 0; i < 24; i++) add({ kind: "bubble", x: x + rnd(-r * 0.8, r * 0.8), y: y + rnd(-r * 0.4, r * 0.4), vx: rnd(-25, 25), vy: rnd(-110, -30), g: -15, life: rnd(0.8, 1.4), size: rnd(4, 9), color: pick(["#d28bff", "#9dff6a"]) });
      for (let i = 0; i < 22; i++) add({ kind: "dot", x, y, vx: rnd(-180, 180), vy: rnd(-400, -140), g: 760, life: rnd(0.6, 1), size: rnd(3, 6), color: i % 2 ? "#a855f7" : "#5b8c2a" });
      for (let i = 0; i < 8; i++) add({ kind: "smoke", x: x + rnd(-r * 0.6, r * 0.6), y, vx: rnd(-20, 20), vy: rnd(-90, -40), life: rnd(1, 1.6), size: rnd(12, 20), grow: 24, color: i % 2 ? "#6b8c2a" : "#6b21a8" });
      c.shake(4, 0.2);
      break;
    case "rockwrecker":
      c.ring(x, y, "#e8d9b8", r * 1.4, 0.5);
      c.ring(x, y, "#ffffff", r * 0.8, 0.3);
      add({ kind: "gring", x, y: y + 8, life: 0.6, size: 8, grow: r * 5, color: "#d9c7a0" });
      for (let i = 0; i < 16; i++) add({ kind: "plank", x: x + rnd(-20, 20), y, vx: rnd(-300, 300), vy: rnd(-620, -220), g: 1100, life: rnd(0.7, 1.2), size: rnd(5, 11), color: pick(["#8a8f99", "#6b5b4a", "#a89878"]), rot: rnd(0, 6), vr: rnd(-12, 12) });
      for (let i = 0; i < 10; i++) add({ kind: "smoke", x: x + rnd(-r * 0.6, r * 0.6), y: y + rnd(-10, 10), vx: rnd(-90, 90), vy: rnd(-90, -20), life: rnd(0.9, 1.5), size: rnd(14, 24), grow: 34, color: i % 2 ? "#cfc2aa" : "#9a8f80" });
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + rnd(-0.2, 0.2); add({ kind: "crack", x, y, life: 1.5, color: "#000", x2: x + Math.cos(a) * r * 1.7, y2: y + Math.sin(a) * r * 1.2, seed: 21 + i }); }
      c.scorch(x, y, r * 0.9, "Rock");
      c.shake(15, 0.45);
      c.flash(0.1);
      break;
    case "draconicfury":
      c.decal({ kind: "runes", x, y, r: Math.max(150, r * 1.1), life: 1.0, seed: 0, ang: rnd(0, 6) });
      c.later(0.1, () => c.decal({ kind: "claws", x, y, r: Math.max(150, r * 1.1), life: 0.55, seed: 0, ang: rnd(-0.5, 0.5) }));
      c.ring(x, y, "#7b5cff", r * 1.2, 0.55);
      c.ring(x, y, "#ffd54a", r * 0.8, 0.4);
      add({ kind: "glow", x, y, life: 0.5, size: r * 0.5, grow: r * 1.6, color: "#8b5cf6" });
      for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU; add({ kind: "streak", x, y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 0.4, size: 9, color: i % 2 ? "#7b5cff" : "#4aa8ff" }); }
      for (let i = 0; i < 18; i++) add({ kind: "flame", x: x + rnd(-r * 0.6, r * 0.6), y: y + rnd(-r * 0.3, r * 0.3), vx: rnd(-60, 60), vy: rnd(-260, -100), life: rnd(0.6, 1), size: rnd(9, 16), color: pick(["#7b5cff", "#4aa8ff", "#c9a0ff"]), seed: i });
      for (let i = 0; i < 14; i++) add({ kind: "star", x, y, vx: rnd(-360, 360), vy: rnd(-420, 120), g: 200, life: rnd(0.7, 1.1), size: rnd(5, 9), color: i % 2 ? "#ffd54a" : "#ffffff", rot: 0, vr: 6 });
      c.shake(11, 0.35);
      c.flash(0.1);
      break;
    case "eternalnight":
      c.decal({ kind: "night", x, y, r: Math.max(150, r * 1.15), life: 1.7, seed: Math.random() * 99, ang: 0 });
      c.night(1.7);
      c.ring(x, y, "#8a5be0", r * 1.2, 0.7);
      for (let i = 0; i < 26; i++) { const a = rnd(0, TAU); add({ kind: "smoke", x: x + Math.cos(a) * r * 1.1, y: y + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * 120, vy: -Math.sin(a) * 90, life: 0.9, size: rnd(12, 20), grow: -4, color: i % 2 ? "#2a1a45" : "#4b2a80" }); }
      for (let i = 0; i < 30; i++) add({ kind: "star", x: x + rnd(-r, r), y: y - rnd(120, 260), vx: rnd(-20, 20), vy: rnd(120, 220), g: 40, life: rnd(0.8, 1.4), size: rnd(3, 6), color: i % 3 ? "#ffffff" : "#c9a0ff", rot: 0, vr: 3 });
      for (let i = 0; i < 6; i++) add({ kind: "text", x: x + rnd(-r * 0.6, r * 0.6), y: y - rnd(0, 30), vx: rnd(-10, 10), vy: -50, life: 1.3, size: 15 + (i % 3) * 3, color: "#b9b4ff", text: i % 2 ? "z" : "Z", weight: 800 });
      c.shake(3, 0.2);
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ the cast itself: what the caster does */

export function specCast(id: string, e: { x: number; y: number; dir: number; tx: number; ty: number }, range: number, c: SpecCtx) {
  const { x, y } = e;
  const ux = Math.cos(e.dir), uy = Math.sin(e.dir);
  const add = (p: SP) => c.add(p);
  switch (id) {
    case "overdriverush": {
      // a speed-line field laid along the whole run, a compressed ring and a puff of dust
      c.ring(x, y, "#ffffff", 70, 0.3);
      for (let d = 30; d < range + 30; d += 16) {
        const o = rnd(-22, 22);
        add({ kind: "streak", x: x + ux * d - uy * o, y: y + uy * d + ux * o, vx: -ux * 120, vy: -uy * 120, life: 0.34, size: rnd(8, 14), color: pick(["#ffffff", "#fff3c4", "#ffd54a"]) });
      }
      for (let i = 0; i < 8; i++) add({ kind: "puff", x: x + rnd(-10, 10), y: y + 14, vx: -ux * rnd(60, 200) + rnd(-40, 40), vy: rnd(-50, 10), life: 0.5, size: 8, grow: 18, color: "#e8d9b8", edge: "#8f7f66", seed: i });
      break;
    }
    case "magmastorm":
      c.ring(x, y, "#ff7a1a", 60, 0.4);
      for (let i = 0; i < 12; i++) add({ kind: "flame", x: x + rnd(-14, 14), y: y + rnd(-6, 10), vx: ux * rnd(60, 200) + rnd(-30, 30), vy: rnd(-160, -50), life: 0.6, size: rnd(7, 12), color: pick(["#ffd84d", "#ff8a1f"]), seed: i });
      break;
    case "whirlpoolprison":
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; add({ kind: "bubble", x: x + Math.cos(a) * 22, y: y + Math.sin(a) * 14, vx: Math.cos(a + 1.5) * 90, vy: Math.sin(a + 1.5) * 60 - 40, life: 0.7, size: rnd(3, 6), color: "#bfe6ff" }); }
      c.ring(x, y, "#6fc0ff", 56, 0.4);
      break;
    case "sporegarden":
      for (let i = 0; i < 10; i++) add({ kind: "smoke", x: x + rnd(-12, 12), y: y + rnd(-10, 6), vx: ux * rnd(40, 120) + rnd(-20, 20), vy: rnd(-60, -10), life: 0.8, size: rnd(7, 12), grow: 14, color: pick(["#ffb0e8", "#a8e890", "#fff3a0"]) });
      break;
    case "thundercage":
      c.ring(x, y, "#ffe14d", 60, 0.35);
      for (let i = 0; i < 7; i++) { const a = rnd(0, TAU); add({ kind: "bolt", x, y, life: 0.25, color: "#ffe14d", x2: x + Math.cos(a) * 60, y2: y + Math.sin(a) * 50, seed: i * 17 + 3 }); }
      c.flash(0.04);
      break;
    case "absolutezero":
      c.ring(x, y, "#bfefff", 70, 0.45);
      for (let i = 0; i < 12; i++) add({ kind: "flake", x: x + rnd(-30, 30), y: y + rnd(-20, 20), vx: rnd(-50, 50), vy: rnd(-40, 30), life: 0.8, size: rnd(3, 6), color: "#e8fbff", rot: rnd(0, 3), vr: rnd(-6, 6) });
      break;
    case "finalflurry":
      for (let i = 0; i < 10; i++) add({ kind: "star", x: x + ux * 30 + rnd(-24, 24), y: y + uy * 30 + rnd(-24, 24), vx: ux * rnd(80, 300), vy: uy * rnd(80, 300), life: 0.35, size: rnd(5, 9), color: pick(["#ffd54a", "#ff5a3c", "#ffffff"]), rot: 0, vr: 8 });
      for (let d = 30; d < range; d += 22) add({ kind: "streak", x: x + ux * d + rnd(-18, 18), y: y + uy * d + rnd(-18, 18), vx: -ux * 100, vy: -uy * 100, life: 0.3, size: 9, color: "#ffcf4d" });
      break;
    case "toxicflood":
      for (let i = 0; i < 9; i++) add({ kind: "bubble", x: x + rnd(-14, 14), y: y + rnd(-10, 10), vx: ux * rnd(30, 100), vy: rnd(-80, -20), life: 0.8, size: rnd(3, 7), color: pick(["#d28bff", "#9dff6a"]) });
      break;
    case "fissurebreak":
      for (let i = 0; i < 4; i++) add({ kind: "crack", x, y: y + 8, life: 0.9, color: "#000", x2: x + ux * rnd(50, 110) + rnd(-20, 20), y2: y + uy * rnd(50, 110) + rnd(-20, 20), seed: 31 + i });
      for (let i = 0; i < 8; i++) add({ kind: "smoke", x: x + rnd(-14, 14), y: y + 12, vx: rnd(-50, 50), vy: rnd(-40, -10), life: 0.6, size: 9, grow: 20, color: "#b9a889" });
      break;
    case "hurricanegale":
      for (let i = 0; i < 14; i++) { const a = e.dir + rnd(-1.2, 1.2); add({ kind: "streak", x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 20, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, life: 0.3, size: 8, color: i % 2 ? "#ffffff" : "#bfe6ff" }); }
      c.ring(x, y, "#e8f6ff", 64, 0.4);
      break;
    case "swarmburst":
      for (let i = 0; i < 14; i++) add({ kind: "dot", x: x + rnd(-16, 16), y: y + rnd(-16, 10), vx: rnd(-140, 140), vy: rnd(-140, 100), life: 0.5, size: rnd(2, 3.5), color: i % 2 ? "#ffd23a" : "#2a2a1a" });
      break;
    case "rockwrecker":
      for (let i = 0; i < 9; i++) add({ kind: "plank", x: x + rnd(-24, 24), y: y + 10, vx: rnd(-40, 40), vy: rnd(-260, -120), g: 500, life: 0.8, size: rnd(3.5, 7), color: pick(["#8a8f99", "#6b5b4a"]), rot: rnd(0, 6), vr: rnd(-10, 10) });
      c.ring(x, y, "#cfc2aa", 56, 0.4);
      break;
    case "hauntingcurse":
      c.ring(x, y, "#b58cff", 56, 0.45);
      for (let i = 0; i < 8; i++) add({ kind: "smoke", x: x + rnd(-14, 14), y: y + rnd(-10, 6), vx: ux * rnd(20, 90), vy: rnd(-70, -20), life: 0.8, size: rnd(8, 13), grow: 14, color: i % 2 ? "#6b3fa0" : "#c9a0ff" });
      for (let i = 0; i < 6; i++) add({ kind: "star", x: x + rnd(-24, 24), y: y + rnd(-20, 10), vx: rnd(-40, 40), vy: rnd(-90, -30), life: 0.8, size: rnd(4, 7), color: "#e9d5ff", rot: 0, vr: 4 });
      break;
    case "draconicfury":
      // rage gathers inward before the burst
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; add({ kind: "streak", x: x + Math.cos(a) * 140, y: y + Math.sin(a) * 100, vx: -Math.cos(a) * 340, vy: -Math.sin(a) * 250, life: 0.36, size: 8, color: i % 2 ? "#7b5cff" : "#ffd54a" }); }
      break;
    case "eternalnight":
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; add({ kind: "smoke", x: x + Math.cos(a) * 130, y: y + Math.sin(a) * 90, vx: -Math.cos(a) * 260, vy: -Math.sin(a) * 180, life: 0.5, size: 12, grow: -6, color: i % 2 ? "#2a1a45" : "#4b2a80" }); }
      break;
    case "ironfortress":
      c.ring(x, y, "#ffffff", 80, 0.3);
      for (let i = 0; i < 18; i++) add({ kind: "shard", x, y, vx: rnd(-420, 420), vy: rnd(-420, 120), g: 600, life: 0.7, size: rnd(2.5, 5), color: pick(["#c8d4e0", "#ffe9a0", "#ffffff"]), rot: rnd(0, 6), vr: rnd(-14, 14) });
      c.shake(5, 0.2);
      break;
    case "moonlitwish":
      c.ring(x, y, "#ffe9a8", 90, 0.7);
      c.ring(x, y, "#ffc2e6", 60, 0.5);
      for (let i = 0; i < 16; i++) add({ kind: "star", x: x + rnd(-40, 40), y: y - rnd(0, 20), vx: rnd(-30, 30), vy: rnd(-180, -60), life: rnd(0.9, 1.4), size: rnd(4, 8), color: pick(["#ffe27a", "#ffc2e6", "#ffffff"]), rot: 0, vr: 4 });
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ pools, gardens and cages that stay on the floor */

export function specLinger(g: CanvasRenderingContext2D, id: string, z: { x: number; y: number; r: number; id: number }, t: number, age: number, grow: number, fade: number, c: SpecCtx) {
  const R = z.r;
  const add = (p: SP) => c.add(p);
  g.save();
  g.globalAlpha = fade;
  if (id === "magmastorm") {
    // a pool of molten rock with a cracked crust, lava fountains and embers circling above it
    ball(g, z.x, z.y, R * 1.12, "rgba(30,10,6,.6)", "rgba(30,10,6,0)");
    const pulse = 0.75 + Math.sin(t * 5) * 0.12;
    g.fillStyle = texPat(g, "lava", t * 9, t * 5, 1.15);
    g.beginPath(); g.arc(z.x, z.y, R * grow, 0, TAU); g.fill();
    g.globalCompositeOperation = "lighter";
    ball(g, z.x, z.y, R * grow, `rgba(255,170,50,${0.3 * pulse})`, "rgba(220,50,10,.1)");
    g.strokeStyle = "rgba(255,160,40,.95)";
    g.lineCap = "round"; g.lineJoin = "round";
    for (let k = 0; k < 10; k++) {
      const a0 = (k / 10) * TAU + hash(z.id + k) * 0.5;
      g.lineWidth = 3.2;
      g.beginPath();
      let px = z.x, py = z.y;
      g.moveTo(px, py);
      for (let s = 1; s <= 4; s++) { const a = a0 + (hash(z.id * 3 + k * 7 + s) - 0.5) * 0.9; const d = (R * grow * s) / 4; px = z.x + Math.cos(a) * d; py = z.y + Math.sin(a) * d; g.lineTo(px, py); }
      g.stroke();
      g.strokeStyle = "rgba(255,240,170,.8)"; g.lineWidth = 1.2; g.stroke(); g.strokeStyle = "rgba(255,160,40,.95)";
    }
    // fountains
    for (let k = 0; k < 5; k++) {
      const ph = (t * 0.85 + hash(z.id + k * 5)) % 1;
      const a = hash(k * 9 + z.id) * TAU, d = Math.sqrt(hash(k * 4 + 1 + z.id)) * R * 0.7;
      const bx = z.x + Math.cos(a) * d, by = z.y + Math.sin(a) * d * 0.9;
      const h = Math.sin(ph * Math.PI) * (46 + hash(k + z.id) * 40) * grow;
      const w = 7 + hash(k + 3) * 5;
      const gr = g.createLinearGradient(0, by, 0, by - h);
      gr.addColorStop(0, "rgba(255,230,120,.95)"); gr.addColorStop(0.6, "rgba(255,120,30,.8)"); gr.addColorStop(1, "rgba(220,40,10,0)");
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(bx - w, by); g.quadraticCurveTo(bx - w * 0.4, by - h * 0.6, bx, by - h); g.quadraticCurveTo(bx + w * 0.4, by - h * 0.6, bx + w, by); g.closePath(); g.fill();
      ball(g, bx, by - h, w * 1.1, "rgba(255,240,170,.9)", "rgba(255,120,30,0)");
      if (ph > 0.3 && ph < 0.55 && Math.random() < 0.5) add({ kind: "dot", x: bx, y: by - h, vx: rnd(-90, 90), vy: rnd(-200, -60), g: 760, life: 0.8, size: rnd(3, 6), color: pick(["#ff5a1a", "#ffb02e", "#ffe27a"]) });
    }
    // embers circling
    for (let k = 0; k < 14; k++) {
      const a = t * (1.2 + (k % 3) * 0.3) + (k / 14) * TAU;
      const hh = ((t * 0.6 + k * 0.17) % 1) * 70;
      ball(g, z.x + Math.cos(a) * R * 0.95, z.y + Math.sin(a) * R * 0.95 - hh, 3.2, "rgba(255,230,120,.95)", "rgba(255,100,20,0)");
    }
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = "rgba(255,120,30,.9)"; g.lineWidth = 3;
    g.beginPath(); g.arc(z.x, z.y, R, 0, TAU); g.stroke();
    if (Math.random() < 0.25) add({ kind: "smoke", x: z.x + rnd(-R * 0.6, R * 0.6), y: z.y + rnd(-R * 0.4, R * 0.4), vx: rnd(-14, 14), vy: rnd(-90, -50), life: 1.1, size: rnd(10, 16), grow: 22, color: "#2b211e" });
  } else if (id === "whirlpoolprison") {
    // a spinning water disc inside a cage of water jets
    ball(g, z.x, z.y, R * 1.1, "rgba(10,40,90,.55)", "rgba(10,40,90,0)");
    g.save();
    g.beginPath(); g.arc(z.x, z.y, R * grow, 0, TAU); g.clip();
    g.translate(z.x, z.y); g.rotate(t * 0.9);
    g.fillStyle = texPat(g, "water", t * 20, 0, 1.3);
    g.fillRect(-R, -R, R * 2, R * 2);
    g.restore();
    g.lineCap = "round";
    for (let arm = 0; arm < 3; arm++) {
      g.strokeStyle = arm % 2 ? "rgba(255,255,255,.55)" : "rgba(170,225,255,.5)";
      g.lineWidth = 12 - arm * 2.5;
      g.beginPath();
      for (let s = 0; s <= 28; s++) { const u = s / 28; const a = t * 4 + arm * (TAU / 3) + u * 5.2; const d = R * grow * (1 - u * 0.92); const px = z.x + Math.cos(a) * d, py = z.y + Math.sin(a) * d; s ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    }
    ball(g, z.x, z.y, R * 0.2, "rgba(5,20,50,.95)", "rgba(5,20,50,0)");
    // the prison: bars of water leaping around the rim
    const N = 16;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * TAU + t * 0.8;
      const bx = z.x + Math.cos(a) * R, by = z.y + Math.sin(a) * R;
      const h = (34 + Math.sin(t * 6 + k * 1.7) * 7) * grow;
      const gr = g.createLinearGradient(0, by, 0, by - h);
      gr.addColorStop(0, "rgba(120,200,255,.75)"); gr.addColorStop(1, "rgba(220,245,255,0)");
      g.strokeStyle = gr; g.lineWidth = 6;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.sin(t * 5 + k) * 2, by - h); g.stroke();
      ball(g, bx, by - h, 3.2, "rgba(255,255,255,.9)", "rgba(255,255,255,0)");
    }
    g.strokeStyle = "rgba(190,235,255,.95)"; g.lineWidth = 3;
    g.beginPath(); g.arc(z.x, z.y, R, 0, TAU); g.stroke();
    // trapped bubbles
    for (let k = 0; k < 6; k++) {
      const a = -t * 2.2 + k * 1.05, d = R * (0.25 + 0.55 * hash(k + z.id));
      const bx = z.x + Math.cos(a) * d, by = z.y + Math.sin(a) * d - 8 - Math.sin(t * 3 + k) * 5;
      g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 1.6; g.fillStyle = "rgba(190,235,255,.3)";
      g.beginPath(); g.arc(bx, by, 5 + (k % 3) * 2, 0, TAU); g.fill(); g.stroke();
    }
    if (Math.random() < 0.3) add({ kind: "bubble", x: z.x + rnd(-R, R) * 0.8, y: z.y + rnd(-R, R) * 0.6, vx: 0, vy: rnd(-70, -30), g: -10, life: 0.9, size: rnd(2.5, 5), color: "#bfe6ff" });
  } else if (id === "sporegarden") {
    // a patch of grass blooming with mushrooms and flowers that puff drowsy spores
    g.save();
    g.beginPath(); g.arc(z.x, z.y, R * grow, 0, TAU); g.clip();
    g.globalAlpha = fade * 0.92;
    g.fillStyle = texPat(g, "grass", 0, 0, 1.1);
    g.fillRect(z.x - R, z.y - R, R * 2, R * 2);
    g.restore();
    g.strokeStyle = "rgba(190,240,120,.85)"; g.lineWidth = 3;
    g.beginPath(); g.arc(z.x, z.y, R, 0, TAU); g.stroke();
    const items: { x: number; y: number; k: number }[] = [];
    for (let k = 0; k < 9; k++) { const a = hash(k * 2 + z.id) * TAU, d = Math.sqrt(hash(k * 5 + 2 + z.id)) * R * 0.82; items.push({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, k }); }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      const up = ease((age - hash(it.k + 7) * 0.4) / 0.35);
      if (up <= 0) continue;
      const h = (16 + hash(it.k + 11) * 18) * up, sway = Math.sin(t * 2 + it.k) * 2;
      g.strokeStyle = "#4b8a3a"; g.lineWidth = 4; g.lineCap = "round";
      g.beginPath(); g.moveTo(it.x, it.y); g.quadraticCurveTo(it.x + sway, it.y - h * 0.5, it.x + sway, it.y - h); g.stroke();
      const hx = it.x + sway, hy = it.y - h;
      if (it.k % 2) {
        const cr = (9 + hash(it.k) * 6) * up;
        g.fillStyle = it.k % 3 === 1 ? "#d24d7a" : "#8a5be0";
        g.beginPath(); g.ellipse(hx, hy, cr, cr * 0.7, 0, Math.PI, 0); g.closePath(); g.fill();
        g.fillStyle = "#fff"; for (let d = -1; d <= 1; d++) { g.beginPath(); g.arc(hx + d * cr * 0.5, hy - cr * 0.3 - Math.abs(d) * -2, 2, 0, TAU); g.fill(); }
      } else {
        const pr = 5 * up;
        for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU + t * 0.5; g.fillStyle = p % 2 ? "#ffb0e8" : "#ffd1f4"; g.beginPath(); g.arc(hx + Math.cos(a) * pr, hy + Math.sin(a) * pr, pr * 0.75, 0, TAU); g.fill(); }
        g.fillStyle = "#ffe27a"; g.beginPath(); g.arc(hx, hy, pr * 0.6, 0, TAU); g.fill();
      }
      if (up >= 1 && Math.random() < 0.05) for (let s = 0; s < 3; s++) add({ kind: "smoke", x: hx, y: hy - 4, vx: rnd(-30, 30), vy: rnd(-60, -20), life: 1.2, size: rnd(8, 13), grow: 14, color: pick(["#ffb0e8", "#a8e890", "#fff3a0"]) });
    }
    if (Math.random() < 0.2) add({ kind: "spark", x: z.x + rnd(-R, R) * 0.9, y: z.y + rnd(-R, R) * 0.5, vx: rnd(-20, 20), vy: rnd(-60, -20), life: 1.1, size: rnd(1.6, 3), color: pick(["#fff3a0", "#d8ff8a"]) });
    if (Math.random() < 0.05) add({ kind: "text", x: z.x + rnd(-R, R) * 0.6, y: z.y - 10, vx: 0, vy: -40, life: 1.2, size: 14, color: "#cdb8ff", text: "z", weight: 800 });
  } else if (id === "toxicflood") {
    // a glossy pool of venom with slime tendrils and big bubbles that pop
    ball(g, z.x, z.y, R * 1.1, "rgba(20,5,40,.5)", "rgba(20,5,40,0)");
    g.save();
    g.beginPath(); g.arc(z.x, z.y, R * grow, 0, TAU); g.clip();
    g.translate(z.x, z.y); g.rotate(Math.sin(t * 0.7) * 0.5);
    g.fillStyle = texPat(g, "venom", t * 14, t * 8, 1.2);
    g.fillRect(-R, -R, R * 2, R * 2);
    g.restore();
    for (let k = 0; k < 3; k++) { const ph = (t * 0.7 + k / 3) % 1; g.strokeStyle = `rgba(160,255,110,${0.5 * (1 - ph)})`; g.lineWidth = 2; g.beginPath(); g.arc(z.x, z.y, R * ph, 0, TAU); g.stroke(); }
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 4; g.lineCap = "round";
    g.beginPath(); g.arc(z.x, z.y, R * 0.7, 3.5, 4.4); g.stroke();
    g.strokeStyle = "rgba(125,230,80,.95)"; g.lineWidth = 4;
    g.beginPath(); g.arc(z.x, z.y, R, 0, TAU); g.stroke();
    for (let k = 0; k < 6; k++) {
      const ph = (t * 0.8 + hash(k + z.id)) % 1;
      const a = hash(k * 3 + z.id) * TAU, d = Math.sqrt(hash(k * 6 + 3)) * R * 0.78;
      const bx = z.x + Math.cos(a) * d, by = z.y + Math.sin(a) * d - ph * 10;
      const br = 3 + ph * 11;
      g.fillStyle = k % 2 ? "rgba(190,120,255,.5)" : "rgba(150,255,100,.45)"; g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 1.6;
      g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.arc(bx - br * 0.3, by - br * 0.3, br * 0.22, 0, TAU); g.fill();
      if (ph > 0.96 || (ph < 0.03 && Math.random() < 0.3)) for (let s = 0; s < 5; s++) add({ kind: "dot", x: bx, y: by, vx: rnd(-90, 90), vy: rnd(-180, -60), g: 600, life: 0.5, size: rnd(2, 4), color: s % 2 ? "#a855f7" : "#7ed957" });
    }
    for (let k = 0; k < 5; k++) {
      const a = hash(k * 8 + z.id) * TAU, d = R * (0.2 + 0.6 * hash(k * 2 + 1));
      const bx = z.x + Math.cos(a) * d, by = z.y + Math.sin(a) * d;
      const h = (18 + Math.sin(t * 3 + k * 2) * 8) * grow;
      g.strokeStyle = k % 2 ? "#8a3fd0" : "#6cc23a"; g.lineWidth = 6;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.sin(t * 2 + k) * 8, by - h * 0.5, bx + Math.sin(t * 2 + k) * 4, by - h); g.stroke();
      ball(g, bx + Math.sin(t * 2 + k) * 4, by - h, 5, "rgba(255,255,255,.5)", g.strokeStyle as string);
    }
    if (Math.random() < 0.3) add({ kind: "smoke", x: z.x + rnd(-R, R) * 0.7, y: z.y + rnd(-R, R) * 0.4, vx: rnd(-14, 14), vy: rnd(-70, -30), life: 1.1, size: rnd(9, 15), grow: 20, color: Math.random() < 0.5 ? "#6b8c2a" : "#6b21a8" });
  }
  g.restore();
}

/* ------------------------------------------------------------------ the telegraph while a specialty is winding up */

export function specWindup(g: CanvasRenderingContext2D, id: string, z: { x: number; y: number; x2: number; y2: number; r: number; id: number; shape: string }, prog: number, t: number) {
  g.save();
  if (z.shape === "circle") {
    const R = z.r;
    if (id === "rockwrecker") {
      const sy = z.y - (1 - prog) * 380 - 26;
      const s = 18 + prog * 14;
      g.fillStyle = `rgba(0,0,0,${0.15 + prog * 0.35})`;
      g.beginPath(); g.ellipse(z.x, z.y + 4, R * (0.3 + prog * 0.7), R * (0.3 + prog * 0.7) * 0.5, 0, 0, TAU); g.fill();
      g.strokeStyle = "rgba(200,190,170,.4)"; g.lineWidth = 5; g.lineCap = "round";
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(z.x + k * 12, sy - 20); g.lineTo(z.x + k * 12, sy - 70 - Math.abs(k) * 12); g.stroke(); }
      g.translate(z.x, sy); g.rotate((1 - prog) * 3);
      g.fillStyle = "#7d7266"; g.strokeStyle = "#2e2822"; g.lineWidth = 3; g.lineJoin = "round";
      g.beginPath();
      for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU, rr = s * (0.82 + hash(z.id + k) * 0.36); k ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.fillStyle = texPat(g, "rock", 0, 0, 0.7, 0); g.fill();
      g.stroke();
      g.fillStyle = "#a89a88"; g.beginPath(); g.moveTo(-s * 0.5, -s * 0.5); g.lineTo(s * 0.1, -s * 0.75); g.lineTo(-s * 0.1, -s * 0.1); g.closePath(); g.fill();
      g.strokeStyle = "#3a322b"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-s * 0.2, s * 0.1); g.lineTo(s * 0.2, s * 0.5); g.moveTo(s * 0.1, -s * 0.1); g.lineTo(s * 0.55, s * 0.05); g.stroke();
    } else if (id === "magmastorm") {
      g.globalCompositeOperation = "lighter"; g.strokeStyle = `rgba(255,150,40,${0.4 + prog * 0.5})`; g.lineWidth = 2.5;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + hash(z.id + k) * 0.4; g.beginPath(); g.moveTo(z.x, z.y); g.lineTo(z.x + Math.cos(a) * R * prog, z.y + Math.sin(a) * R * prog); g.stroke(); }
      ball(g, z.x, z.y, R * 0.7 * prog, "rgba(255,190,60,.55)", "rgba(255,80,10,0)");
    } else if (id === "whirlpoolprison") {
      g.strokeStyle = `rgba(190,235,255,${0.45 + prog * 0.4})`; g.lineWidth = 3; g.lineCap = "round";
      for (let arm = 0; arm < 3; arm++) { g.beginPath(); for (let s = 0; s <= 20; s++) { const u = s / 20, a = t * 6 + arm * 2.09 + u * 4, d = R * (1 - u * 0.9) * (0.4 + prog * 0.6); s ? g.lineTo(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d) : g.moveTo(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d); } g.stroke(); }
    } else if (id === "sporegarden") {
      for (let k = 0; k < 6; k++) { const a = hash(k + z.id) * TAU, d = Math.sqrt(hash(k + 9)) * R * 0.75, mx = z.x + Math.cos(a) * d, my = z.y + Math.sin(a) * d, cr = (3 + hash(k) * 4) * prog * 2; g.fillStyle = k % 2 ? "rgba(255,150,210,.8)" : "rgba(190,150,255,.8)"; g.beginPath(); g.ellipse(mx, my - cr * 0.5, cr, cr * 0.7, 0, Math.PI, 0); g.fill(); }
    } else if (id === "toxicflood") {
      for (let k = 0; k < 6; k++) { const ph = (t * 1.4 + k / 6) % 1; const a = hash(k + z.id) * TAU, d = hash(k + 4) * R * 0.7; g.strokeStyle = "rgba(170,255,110,.75)"; g.lineWidth = 2; g.beginPath(); g.arc(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d - ph * 8, 2 + ph * 8 * prog, 0, TAU); g.stroke(); }
    }
  } else {
    // lines: cracks creep along the floor, or sparks gather on the rails
    const L = Math.hypot(z.x2 - z.x, z.y2 - z.y), ang = Math.atan2(z.y2 - z.y, z.x2 - z.x);
    g.translate(z.x, z.y); g.rotate(ang);
    if (id === "fissurebreak") {
      g.strokeStyle = `rgba(30,18,8,${0.5 + prog * 0.4})`; g.lineWidth = 3; g.lineJoin = "round";
      g.beginPath(); g.moveTo(0, 0);
      for (let d = 12; d <= L * prog; d += 12) g.lineTo(d, (hash(z.id + d) - 0.5) * 12);
      g.stroke();
    } else if (id === "thundercage") {
      g.strokeStyle = `rgba(255,236,120,${0.35 + prog * 0.5})`; g.lineWidth = 2;
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(0, sd * z.r * 1.15); g.lineTo(L, sd * z.r * 1.15); g.stroke(); }
      for (let d = 30; d < L; d += 46) { g.beginPath(); g.moveTo(d, -z.r * 1.15); g.lineTo(d, z.r * 1.15); g.stroke(); }
    }
  }
  g.restore();
}

/* ------------------------------------------------------------------ the strike of the two line specialties */

export function specStrike(g: CanvasRenderingContext2D, id: string, z: { x: number; y: number; x2: number; y2: number; r: number; id: number }, a: number, t: number, first: boolean, c: SpecCtx) {
  const L = Math.hypot(z.x2 - z.x, z.y2 - z.y);
  const ang = Math.atan2(z.y2 - z.y, z.x2 - z.x);
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const age = (1 - a) * 0.55;
  if (first) {
    if (id === "thundercage") {
      c.flash(0.1); c.shake(6, 0.25);
      for (let i = 0; i < 6; i++) { const d = rnd(0.1, 1) * L; c.add({ kind: "bolt", x: z.x + ux * d + rnd(-30, 30), y: z.y + uy * d - 300, life: 0.32, color: "#ffe14d", x2: z.x + ux * d, y2: z.y + uy * d, seed: i * 11 + 5 }); }
      for (let i = 0; i < 34; i++) { const d = rnd(0, L); c.add({ kind: "spark", x: z.x + ux * d, y: z.y + uy * d, vx: nx * rnd(-240, 240) + rnd(-40, 40), vy: ny * rnd(-240, 240) + rnd(-40, 40), life: rnd(0.3, 0.7), size: rnd(1.6, 3.2), color: i % 2 ? "#ffe14d" : "#ffffff" }); }
      c.ring(z.x + ux * L, z.y + uy * L, "#ffe14d", 90, 0.4);
    } else {
      c.shake(12, 0.45);
      for (let d = 20; d < L; d += 26) {
        const px = z.x + ux * d, py = z.y + uy * d;
        c.later((d / L) * 0.14, () => {
          for (let k = 0; k < 2; k++) c.add({ kind: "plank", x: px + rnd(-10, 10), y: py, vx: rnd(-80, 80), vy: rnd(-460, -180), g: 1000, life: rnd(0.6, 1), size: rnd(4, 9), color: pick(["#8a6a45", "#6b5b4a", "#a98660"]), rot: rnd(0, 6), vr: rnd(-12, 12) });
          c.add({ kind: "smoke", x: px, y: py, vx: rnd(-40, 40), vy: rnd(-90, -30), life: 1, size: rnd(12, 20), grow: 28, color: "#b9a889" });
          if (Math.random() < 0.5) { const sd = Math.random() < 0.5 ? -1 : 1; c.add({ kind: "crack", x: px, y: py, life: 1.6, color: "#000", x2: px + nx * sd * rnd(30, 70), y2: py + ny * sd * rnd(30, 70), seed: Math.floor(rnd(1, 90)) }); }
        });
      }
      c.scorch(z.x + ux * L * 0.5, z.y + uy * L * 0.5, 36, "Rock");
    }
  }
  g.save();
  g.lineCap = "round"; g.lineJoin = "round";
  if (id === "thundercage") {
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = a;
    const seed = Math.floor(t * 28);
    const jag = (k: number, s: number) => hash(k * 1.7 + seed * 3.1 + s) - 0.5;
    const rail = (off: number, amp: number, wd: number, col: string, s: number) => {
      g.strokeStyle = col; g.lineWidth = wd; g.beginPath();
      for (let d = 0, k = 0; d <= L; d += 18, k++) { const j = jag(k, s) * amp * Math.min(1, d / 30) * (d > L - 20 ? 0.3 : 1); const px = z.x + ux * d + nx * (off + j), py = z.y + uy * d + ny * (off + j); d ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    };
    const off = z.r * 1.15;
    rail(0, 22, 28, "rgba(255,225,60,.22)", 1); rail(0, 22, 13, "rgba(255,225,60,.6)", 1); rail(0, 22, 7, "#ffe14d", 1); rail(0, 22, 3, "#ffffff", 1);
    for (const sd of [-1, 1]) { rail(sd * off, 7, 18, "rgba(120,230,255,.28)", 2 + sd); rail(sd * off, 7, 8, "rgba(160,240,255,.8)", 2 + sd); rail(sd * off, 7, 3, "#ffffff", 2 + sd); }
    g.strokeStyle = "#fff6b0"; g.lineWidth = 2;
    for (let d = 26, k = 0; d < L; d += 46, k++) {
      g.beginPath(); g.moveTo(z.x + ux * d + nx * -off, z.y + uy * d + ny * -off);
      for (let s = 1; s <= 4; s++) { const o = -off + (s / 4) * off * 2 + (s < 4 ? jag(k, s) * 9 : 0); g.lineTo(z.x + ux * (d + jag(k, s + 7) * 6) + nx * o, z.y + uy * (d + jag(k, s + 7) * 6) + ny * o); }
      g.stroke();
      for (const sd of [-1, 1]) ball(g, z.x + ux * d + nx * sd * off, z.y + uy * d + ny * sd * off, 7, "rgba(255,255,255,.95)", "rgba(255,225,60,0)");
    }
    ball(g, z.x, z.y, z.r * 1.7, "rgba(255,255,255,.9)", "rgba(255,225,60,0)");
    ball(g, z.x + ux * L, z.y + uy * L, z.r * 2.2, "rgba(255,255,255,.9)", "rgba(255,225,60,0)");
  } else {
    // a chasm: it tears open from the caster outwards, glows from within, then closes up
    g.globalCompositeOperation = "source-over";
    const reveal = Math.min(1, age / 0.13);
    const close = Math.min(1, a * 2.2);
    const steps = Math.max(2, Math.ceil((L * reveal) / 14));
    const w = (d: number, side: number) => z.r * close * (0.8 + hash(z.id + d * 0.17 + side * 9) * 0.7) * (1 - Math.pow(Math.abs((d / L) * 2 - 1), 3) * 0.45) * 1.15;
    const edge = (side: number) => { const pts: [number, number][] = []; for (let s = 0; s <= steps; s++) { const d = (s / steps) * L * reveal; pts.push([z.x + ux * d + nx * side * w(s, side), z.y + uy * d + ny * side * w(s, side)]); } return pts; };
    const E1 = edge(-1), E2 = edge(1).reverse();
    const path = () => { g.beginPath(); E1.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); E2.forEach((p) => g.lineTo(p[0], p[1])); g.closePath(); };
    path(); g.fillStyle = "rgba(10,5,2,.95)"; g.fill();
    g.strokeStyle = texPat(g, "rock", 0, 0, 1); g.lineWidth = 10; g.stroke();
    g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = 2; g.stroke();
    g.globalCompositeOperation = "lighter";
    g.save(); g.translate(z.x, z.y); g.rotate(ang);
    const gl = g.createLinearGradient(0, -z.r, 0, z.r);
    gl.addColorStop(0, "rgba(255,120,30,0)"); gl.addColorStop(0.5, `rgba(255,150,50,${0.65 * a})`); gl.addColorStop(1, "rgba(255,120,30,0)");
    g.fillStyle = gl; g.fillRect(0, -z.r * 0.8, L * reveal, z.r * 1.6);
    g.restore();
  }
  g.restore();
}

/* ------------------------------------------------------------------ shots: wind blades, bugs, a wisp with a face */

export function specShot(g: CanvasRenderingContext2D, p: { mv: string; vx: number; vy: number; r: number; id: number }, age: number, t: number): boolean {
  const ang = Math.atan2(p.vy, p.vx);
  const r = p.r;
  if (p.mv === "hurricanegale") {
    g.rotate(ang);
    g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    const spin = t * 18 + p.id;
    for (const [rad, wd, col, al] of [[r * 2.2, 20, "rgba(190,230,255,", 0.3], [r * 2.2, 8, "rgba(255,255,255,", 0.95], [r * 1.5, 5, "rgba(190,230,255,", 0.8]] as const) {
      g.strokeStyle = `${col}${al})`; g.lineWidth = wd;
      g.beginPath(); g.arc(-r * 0.9, 0, rad, -0.95, 0.95); g.stroke();
    }
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = `rgba(230,246,255,${0.55 - k * 0.14})`; g.lineWidth = 2.4 - k * 0.5;
      g.beginPath();
      for (let s = 0; s <= 10; s++) { const u = s / 10; const px = -r * 1.4 - u * r * 4, py = (k - 1) * r * 0.9 * (0.5 + u) + Math.sin(spin + u * 6 + k) * r * 0.35; s ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    }
    ball(g, r * 0.4, 0, r * 0.9, "rgba(255,255,255,.9)", "rgba(190,230,255,0)");
    return true;
  }
  if (p.mv === "swarmburst") {
    g.rotate(ang);
    const wob = Math.sin(t * 28 + p.id * 3) * 3.2;
    g.translate(0, wob);
    const s = Math.max(5, r * 0.85);
    const flap = Math.sin(t * 70 + p.id) * 0.7;
    g.fillStyle = "rgba(240,250,255,.6)"; g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 1;
    for (const sd of [-1, 1]) { g.save(); g.rotate(sd * (0.9 + flap)); g.beginPath(); g.ellipse(-s * 0.2, sd * -s * 0.9, s * 0.9, s * 0.38, 0.2 * sd, 0, TAU); g.fill(); g.stroke(); g.restore(); }
    g.fillStyle = "#ffd23a";
    g.beginPath(); g.ellipse(-s * 0.2, 0, s * 1.05, s * 0.62, 0, 0, TAU); g.fill();
    g.fillStyle = "#2a2412";
    for (const dx of [-0.55, 0.05]) { g.beginPath(); g.ellipse(-s * 0.2 + dx * s, 0, s * 0.17, s * 0.6, 0, 0, TAU); g.fill(); }
    g.beginPath(); g.arc(s * 0.95, 0, s * 0.42, 0, TAU); g.fill();
    g.fillStyle = "#ff5a3c"; g.beginPath(); g.arc(s * 1.1, -s * 0.12, s * 0.12, 0, TAU); g.arc(s * 1.1, s * 0.12, s * 0.12, 0, TAU); g.fill();
    g.fillStyle = "#2a2412"; g.beginPath(); g.moveTo(-s * 1.2, -s * 0.2); g.lineTo(-s * 1.9, 0); g.lineTo(-s * 1.2, s * 0.2); g.closePath(); g.fill();
    return true;
  }
  if (p.mv === "hauntingcurse") {
    const s = Math.max(9, r * 1.1);
    g.globalCompositeOperation = "lighter";
    ball(g, 0, 0, s * 3, "rgba(150,70,255,.45)", "rgba(80,20,160,0)");
    g.save(); g.rotate(ang);
    const gr = g.createLinearGradient(-s * 4, 0, 0, 0);
    gr.addColorStop(0, "rgba(120,60,220,0)"); gr.addColorStop(1, "rgba(200,150,255,.85)");
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, -s);
    for (let k = 0; k <= 8; k++) { const u = k / 8; g.lineTo(-u * s * 4, -s * (1 - u) * 0.9 + Math.sin(t * 16 + u * 7 + p.id) * s * 0.35); }
    for (let k = 8; k >= 0; k--) { const u = k / 8; g.lineTo(-u * s * 4, s * (1 - u) * 0.9 + Math.sin(t * 16 + u * 7 + p.id + 2) * s * 0.35); }
    g.closePath(); g.fill();
    g.restore();
    ball(g, 0, 0, s * 1.2, "rgba(255,255,255,.95)", "rgba(185,120,255,.6)");
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#1a0830";
    const ex = Math.cos(ang) * s * 0.18, ey = Math.sin(ang) * s * 0.18;
    for (const dx of [-0.42, 0.42]) { g.beginPath(); g.ellipse(dx * s + ex, -s * 0.2 + ey, s * 0.2, s * 0.3, 0, 0, TAU); g.fill(); }
    g.beginPath(); g.ellipse(ex, s * 0.45 + ey, s * 0.28, s * 0.2 + Math.sin(t * 12) * 2, 0, 0, TAU); g.fill();
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) { const a = t * 4 + k * 2.1; ball(g, Math.cos(a) * s * 1.9, Math.sin(a) * s * 1.5, 3, "rgba(230,200,255,.95)", "rgba(150,70,255,0)"); }
    return true;
  }
  void age;
  return false;
}

/** Particles shed by a specialty shot as it flies. Returns false for shots that are not specialties. */
export function specShotTrail(p: { mv: string; x: number; y: number; vx: number; vy: number }, c: SpecCtx): boolean {
  const r = Math.random();
  const bx = p.x + rnd(-4, 4), by = p.y + rnd(-4, 4);
  if (p.mv === "hurricanegale") {
    if (r < 0.5) c.add({ kind: "streak", x: bx, y: by, vx: -p.vx * 0.15 + rnd(-30, 30), vy: -p.vy * 0.15 + rnd(-30, 30), life: 0.3, size: 7, color: "#ffffff" });
    if (r < 0.2) c.add({ kind: "leaf", x: bx, y: by, vx: rnd(-50, 50), vy: rnd(-60, 20), g: 30, life: 0.8, size: rnd(3, 4.5), color: "#eaf6ff", rot: rnd(0, 6), vr: rnd(-10, 10) });
    return true;
  }
  if (p.mv === "swarmburst") {
    if (r < 0.4) c.add({ kind: "dot", x: bx, y: by, vx: rnd(-50, 50), vy: rnd(-50, 50), life: 0.35, size: rnd(1.5, 2.6), color: r < 0.2 ? "#ffd23a" : "#2a2412" });
    return true;
  }
  if (p.mv === "hauntingcurse") {
    if (r < 0.6) c.add({ kind: "smoke", x: bx, y: by, vx: rnd(-20, 20), vy: rnd(-40, 10), life: 0.8, size: rnd(7, 12), grow: 12, color: r < 0.3 ? "#6b3fa0" : "#c9a0ff" });
    if (r < 0.2) c.add({ kind: "star", x: bx, y: by, vx: rnd(-40, 40), vy: rnd(-60, -10), life: 0.7, size: rnd(3, 5), color: "#e9d5ff", rot: 0, vr: 4 });
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ rushes */

export function specDash(id: string, f: { x: number; y: number; r: number; face: number }, c: SpecCtx) {
  const ux = Math.cos(f.face), uy = Math.sin(f.face);
  if (id === "overdriverush") {
    for (let i = 0; i < 3; i++) c.add({ kind: "streak", x: f.x - ux * f.r * rnd(0.5, 2) + rnd(-f.r, f.r) * -uy, y: f.y - uy * f.r * rnd(0.5, 2) + rnd(-f.r, f.r) * ux, vx: -ux * 160, vy: -uy * 160, life: 0.28, size: rnd(9, 15), color: pick(["#ffffff", "#fff3c4", "#ffd54a"]) });
    c.add({ kind: "puff", x: f.x - ux * f.r, y: f.y + f.r * 0.5, vx: -ux * 60 + rnd(-30, 30), vy: rnd(-30, 10), life: 0.45, size: 7, grow: 20, color: "#e8d9b8", edge: "#8f7f66", seed: Math.floor(rnd(0, 99)) });
    if (Math.random() < 0.4) c.ring(f.x + ux * f.r * 1.4, f.y + uy * f.r * 1.4, "#ffffff", 44, 0.25);
    if (Math.random() < 0.5) c.add({ kind: "star", x: f.x + ux * f.r * 1.5, y: f.y + uy * f.r * 1.5, vx: ux * 80 + rnd(-60, 60), vy: uy * 80 + rnd(-60, 60), life: 0.3, size: rnd(5, 9), color: "#ffd54a", rot: 0, vr: 8 });
  } else if (id === "finalflurry") {
    for (let i = 0; i < 4; i++) {
      const a = f.face + rnd(-1.1, 1.1), d = rnd(f.r * 0.8, f.r * 2.3);
      c.add({ kind: i % 2 ? "cross" : "star", x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d - f.r * 0.4, life: 0.22, size: rnd(14, 26), color: pick(["#ffd54a", "#ff5a3c", "#ffffff"]), rot: rnd(0, 3), vr: 0 });
    }
    c.add({ kind: "streak", x: f.x + ux * f.r, y: f.y + uy * f.r, vx: ux * 480 + rnd(-90, 90), vy: uy * 480 + rnd(-90, 90), life: 0.22, size: 9, color: "#ffcf4d" });
    if (Math.random() < 0.28) c.add({ kind: "text", x: f.x + ux * f.r * 2 + rnd(-20, 20), y: f.y - f.r * 1.2 + rnd(-10, 10), vx: ux * 40, vy: -70, life: 0.55, size: 15 + Math.floor(rnd(0, 6)), color: pick(["#ffd54a", "#ff7a3c", "#ffffff"]), text: pick(["HA!", "ORA!", "POW!", "WATA!", "HYAH!"]), weight: 900 });
  }
}

/* ------------------------------------------------------------------ auras around a fighter: armour, moonbeam, the hand of mind power */

export function drawAura(g: CanvasRenderingContext2D, kind: string, f: { x: number; y: number; r: number }, age: number, left: number, t: number, c: SpecCtx) {
  const cx = f.x, cy = f.y - f.r * 0.55;
  const fade = Math.min(1, left / 0.2);
  g.save();
  g.globalAlpha = fade;
  if (kind === "ironfortress") {
    // eight steel plates slam in around the body, then turn slowly with a glint sweeping over them
    const R = f.r * 1.75 * (1 + (1 - ease(age / 0.16)) * 0.9);
    g.globalCompositeOperation = "lighter";
    ball(g, cx, cy, f.r * 2.1, "rgba(190,205,225,.08)", "rgba(190,205,225,.28)");
    g.globalCompositeOperation = "source-over";
    const N = 8;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + age * 0.9;
      g.save();
      g.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.82);
      g.rotate(a + Math.PI / 2);
      const w = f.r * 0.55, h = f.r * 0.8;
      const gr = g.createLinearGradient(-w, -h, w, h);
      gr.addColorStop(0, "#f0f5fb"); gr.addColorStop(0.5, "#98a6ba"); gr.addColorStop(1, "#58657a");
      g.fillStyle = gr; g.strokeStyle = "#2a3342"; g.lineWidth = 2.4; g.lineJoin = "round";
      g.beginPath(); g.moveTo(-w * 0.8, -h); g.lineTo(w * 0.8, -h); g.lineTo(w, h * 0.7); g.lineTo(0, h); g.lineTo(-w, h * 0.7); g.closePath(); g.fill();
      { const ga = g.globalAlpha; g.globalAlpha = ga * 0.6; g.fillStyle = texPat(g, "metal", 0, 0, 0.7, 0); g.fill(); g.globalAlpha = ga; }
      g.stroke();
      g.fillStyle = "#dfe7f2"; for (const [rx, ry] of [[-0.5, -0.6], [0.5, -0.6], [0, 0.5]] as const) { g.beginPath(); g.arc(rx * w, ry * h, 2.2, 0, TAU); g.fill(); }
      const gl = ((t * 1.6 + i / N) % 1);
      if (gl < 0.12) { g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(255,255,255,${0.7 * (1 - gl / 0.12)})`; g.fillRect(-w, -h, w * 2, h * 2); }
      g.restore();
    }
  } else if (kind === "moonlitwish") {
    // a column of moonlight from above, a crescent moon over the head and sparkles rising
    g.globalCompositeOperation = "lighter";
    const top = cy - f.r * 7, w = f.r * 1.7 * (0.9 + Math.sin(t * 5) * 0.06);
    const gr = g.createLinearGradient(0, top, 0, f.y + f.r * 0.7);
    gr.addColorStop(0, "rgba(255,240,190,0)"); gr.addColorStop(0.5, "rgba(255,232,170,.32)"); gr.addColorStop(1, "rgba(255,200,230,.5)");
    g.fillStyle = gr; g.fillRect(cx - w, top, w * 2, f.y + f.r * 0.7 - top);
    g.strokeStyle = "rgba(255,230,170,.7)"; g.lineWidth = 2;
    g.beginPath(); g.ellipse(cx, f.y + f.r * 0.7, w * 1.05, w * 0.4, 0, 0, TAU); g.stroke();
    g.beginPath(); g.ellipse(cx, f.y + f.r * 0.7, w * 0.65, w * 0.25, 0, 0, TAU); g.stroke();
    const my = cy - f.r * 3.1 - ease(age / 0.3) * 6 + Math.sin(t * 3) * 3;
    ball(g, cx, my, f.r * 1.6, "rgba(255,240,190,.5)", "rgba(255,230,160,0)");
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#fff1b8";
    g.beginPath(); g.arc(cx, my, f.r * 0.7, 0, TAU); g.fill();
    g.globalCompositeOperation = "destination-out";
    g.beginPath(); g.arc(cx + f.r * 0.32, my - f.r * 0.1, f.r * 0.62, 0, TAU); g.fill();
    g.globalCompositeOperation = "source-over";
    if (Math.random() < 0.7) c.add({ kind: "star", x: cx + rnd(-w, w), y: f.y + f.r * 0.5, vx: rnd(-12, 12), vy: rnd(-120, -60), life: 1, size: rnd(3.5, 6.5), color: pick(["#ffe27a", "#ffc2e6", "#ffffff"]), rot: 0, vr: 4 });
  } else if (kind === "mindhand") {
    // five curved fingers of mind power close around the foe
    const close = ease(age / 0.25);
    g.globalCompositeOperation = "lighter";
    ball(g, cx, cy + f.r * 0.9, f.r * 1.8, "rgba(255,150,235,.5)", "rgba(150,80,255,0)");
    g.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const sp = (i - 2) / 2;
      const bx = cx + sp * f.r * 1.5, by = cy + f.r * 1.7;
      const tipx = cx + sp * f.r * (1.5 - close * 0.9) + Math.sin(t * 6 + i) * 2, tipy = cy - f.r * (0.6 + (1 - Math.abs(sp)) * 0.9) * (0.7 + close * 0.3);
      for (const [wd, col] of [[12, "rgba(190,100,255,.28)"], [6, "rgba(255,150,235,.8)"], [2.4, "#ffffff"]] as const) {
        g.strokeStyle = col; g.lineWidth = wd;
        g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + sp * f.r * 0.9, cy + f.r * 0.1, tipx, tipy); g.stroke();
      }
    }
    for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,170,240,${0.55 - i * 0.14})`; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, f.r * (1.2 + i * 0.4 + Math.sin(t * 8) * 0.06), f.r * (0.5 + i * 0.18), 0, 0, TAU); g.stroke(); }
    if (Math.random() < 0.5) c.add({ kind: "star", x: cx + rnd(-f.r, f.r), y: cy + rnd(-f.r, f.r), vx: rnd(-30, 30), vy: rnd(-70, -20), life: 0.8, size: rnd(3, 6), color: pick(["#ffd1f4", "#c9a0ff"]), rot: 0, vr: 4 });
  }
  g.restore();
}

/* ------------------------------------------------------------------ timed drawings on the floor */

export function drawDecals(g: CanvasRenderingContext2D, list: Decal[], dt: number): Decal[] {
  const keep: Decal[] = [];
  for (const d of list) {
    d.t += dt;
    if (d.t >= d.life) continue;
    keep.push(d);
    const u = d.t / d.life;
    const fade = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    g.save();
    g.globalAlpha = fade;
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round"; g.lineJoin = "round";
    if (d.kind === "snow") {
      const s = d.r * (0.25 + ease(d.t / 0.4) * 0.75);
      ball(g, d.x, d.y, s * 1.05, "rgba(190,240,255,.35)", "rgba(120,210,255,0)");
      g.save(); g.beginPath(); g.arc(d.x, d.y, s * 0.96, 0, TAU); g.clip(); g.globalCompositeOperation = "source-over"; g.globalAlpha = fade * 0.55; g.fillStyle = texPat(g, "ice", d.t * 10, 0, 1.2); g.fillRect(d.x - s, d.y - s, s * 2, s * 2); g.restore();
      g.translate(d.x, d.y); g.rotate(d.ang + d.t * 0.5);
      for (const [wd, col] of [[17, "rgba(140,225,255,.3)"], [9, texPat(g, "ice", 0, 0, 0.8)], [2.8, "#ffffff"]] as const) {
        g.strokeStyle = col; g.lineWidth = wd;
        for (let k = 0; k < 6; k++) {
          g.save(); g.rotate((k / 6) * TAU);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(s, 0);
          for (const [p, bl] of [[0.4, 0.3], [0.65, 0.22], [0.85, 0.12]] as const) { g.moveTo(s * p, 0); g.lineTo(s * (p + bl), s * bl * 0.9); g.moveTo(s * p, 0); g.lineTo(s * (p + bl), -s * bl * 0.9); }
          g.stroke(); g.restore();
        }
      }
      g.strokeStyle = "rgba(220,250,255,.8)"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, s * 0.98, 0, TAU); g.stroke();
    } else if (d.kind === "night") {
      const s = d.r * (0.2 + ease(d.t / 0.5) * 0.8);
      g.globalCompositeOperation = "source-over";
      const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, s);
      gr.addColorStop(0, "rgba(8,3,22,.8)"); gr.addColorStop(0.75, "rgba(30,10,70,.6)"); gr.addColorStop(1, "rgba(110,60,200,.0)");
      g.fillStyle = gr; g.beginPath(); g.arc(d.x, d.y, s, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(d.x, d.y, s, 0, TAU); g.clip(); g.globalAlpha = fade * 0.6; g.fillStyle = texPat(g, "shade", d.t * 22, d.t * 11, 1.5); g.fillRect(d.x - s, d.y - s, s * 2, s * 2); g.restore();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = "rgba(190,150,255,.9)"; g.lineWidth = 3; g.beginPath(); g.arc(d.x, d.y, s * 0.98, 0, TAU); g.stroke();
      for (let k = 0; k < 22; k++) { const a = hash(d.seed + k) * TAU, rr = Math.sqrt(hash(d.seed + k * 3 + 1)) * s * 0.9; const tw = 0.5 + 0.5 * Math.sin(d.t * 8 + k * 2); ball(g, d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr, 3.5 * tw + 1, "rgba(255,255,255,.95)", "rgba(190,160,255,0)"); }
      g.globalCompositeOperation = "source-over";
      const my = d.y - 30 * ease(d.t / 0.6);
      g.fillStyle = "rgba(255,244,200,.95)"; g.beginPath(); g.arc(d.x, my, 20, 0, TAU); g.fill();
      g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(d.x + 9, my - 3, 18, 0, TAU); g.fill();
    } else if (d.kind === "runes") {
      const s = d.r * (0.3 + ease(d.t / 0.25) * 0.7);
      g.translate(d.x, d.y);
      g.save(); g.beginPath(); g.arc(0, 0, s * 0.8, 0, TAU); g.clip(); g.globalAlpha = fade * 0.32; g.fillStyle = texPat(g, "aura", d.t * 30, 0, 1.2, d.t); g.fillRect(-s, -s, s * 2, s * 2); g.restore();
      for (const [rad, rot, col] of [[1, d.t * 1.6, "#ffd54a"], [0.8, -d.t * 2.2, "#8b5cf6"]] as const) {
        g.save(); g.rotate(rot + d.ang);
        g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, s * rad, 0, TAU); g.stroke();
        g.lineWidth = 4;
        for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * s * rad * 0.88, Math.sin(a) * s * rad * 0.88); g.lineTo(Math.cos(a) * s * rad * 0.98, Math.sin(a) * s * rad * 0.98); if (k % 2) g.lineTo(Math.cos(a + 0.08) * s * rad * 0.9, Math.sin(a + 0.08) * s * rad * 0.9); g.stroke(); }
        g.restore();
      }
      g.save(); g.rotate(d.t * 1.1 + d.ang); g.strokeStyle = "#c9a0ff"; g.lineWidth = 2.5; g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = (k * 2 / 6) * TAU; const px = Math.cos(a) * s * 0.62, py = Math.sin(a) * s * 0.62; k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke(); g.restore();
      ball(g, 0, 0, s * 0.4, "rgba(255,255,255,.55)", "rgba(139,92,246,0)");
    } else if (d.kind === "claws") {
      const s = d.r * 1.15;
      g.translate(d.x, d.y); g.rotate(-0.7 + d.ang);
      const reveal = ease(d.t / 0.13);
      for (let k = -1; k <= 1; k++) {
        const ox = k * 30;
        const x0 = -s * 0.5 * reveal, x1 = s * 0.5 * reveal;
        for (const [wd, col] of [[18, "rgba(123,92,255,.35)"], [9, "rgba(190,150,255,.9)"], [3, "#ffffff"]] as const) {
          g.strokeStyle = col; g.lineWidth = wd * (1 - Math.abs(k) * 0.12);
          g.beginPath(); g.moveTo(x0, ox - 26); g.quadraticCurveTo(0, ox + 22, x1, ox - 20); g.stroke();
        }
      }
    }
    g.restore();
  }
  return keep;
}
