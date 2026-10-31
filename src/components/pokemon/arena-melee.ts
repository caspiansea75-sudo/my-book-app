/**
 * Physical moves in Arena Brawl: every claw, blade, punch, bite, kick, tail, headbutt, charge, horn and
 * slam gets its own picture, drawn over the Pokémon that is lunging, and it keeps going a moment after
 * the lunge ends so the swing can be seen. Moves that already have their own art (the Dragon moves,
 * Shadow Claw, Drain Punch, Nuzzle, Thunder Punch, Strength) are left to the renderer.
 */
import type { Fighter } from "@/lib/pokemon/arena-engine";
import { TYPE_COLOR } from "@/lib/pokemon/shared";

type Style = "claws" | "blade" | "xslash" | "wing" | "fist" | "jaws" | "kick" | "stomp" | "tail" | "ram" | "speed" | "lance" | "drill" | "bird" | "hammer" | "spin" | "phantom";
/** style, main colour, light colour, flavour (what the particles look like) */
const T: Record<string, [Style, string, string, string]> = {
  slash: ["claws", "#dfe6f2", "#ffffff", "spark"],
  nightslash: ["blade", "#6a35c8", "#e2c8ff", "dark"],
  aerialace: ["xslash", "#8fd3ff", "#ffffff", "wind"],
  leafblade: ["blade", "#4cc24a", "#e6ffb0", "leaf"],
  sacredsword: ["xslash", "#ffd24d", "#ffffff", "holy"],
  behemothblade: ["blade", "#9fb3cc", "#ffffff", "steel"],
  steelwing: ["wing", "#b8c4d4", "#ffffff", "steel"],
  wingattack: ["wing", "#dff0ff", "#ffffff", "wind"],
  firepunch: ["fist", "#ff7a2a", "#ffe08a", "fire"],
  icepunch: ["fist", "#7fd8ff", "#ffffff", "ice"],
  machpunch: ["fist", "#ff9a6a", "#ffffff", "flurry"],
  bulletpunch: ["fist", "#aab7c8", "#ffffff", "steel"],
  meteormash: ["fist", "#8aa0c8", "#fff3a0", "star"],
  skyuppercut: ["fist", "#ff8a4a", "#ffffff", "upper"],
  brickbreak: ["fist", "#ffb066", "#ffffff", "brick"],
  crosschop: ["xslash", "#ff8a4a", "#ffffff", "fight"],
  superpower: ["fist", "#ff5a3a", "#ffe0c0", "power"],
  suckerpunch: ["fist", "#5a3a8a", "#d8b8ff", "dark"],
  plasmafists: ["fist", "#ffe14d", "#ffffff", "bolt"],
  poisonjab: ["fist", "#b259d6", "#f0c8ff", "poison"],
  foulplay: ["fist", "#4a2f6a", "#d8b8ff", "dark"],
  knockoff: ["fist", "#4a2f6a", "#ffffff", "dark"],
  crunch: ["jaws", "#3a2060", "#ffffff", "dark"],
  playrough: ["jaws", "#ff9be6", "#ffffff", "star"],
  lunge: ["jaws", "#8ac43a", "#ffffff", "bug"],
  blazekick: ["kick", "#ff7a2a", "#ffe08a", "fire"],
  highhorsepower: ["stomp", "#b58a56", "#ffe0b0", "dust"],
  irontail: ["tail", "#c0c8d4", "#ffffff", "steel"],
  aquatail: ["tail", "#4aa8ff", "#e8f6ff", "water"],
  zenheadbutt: ["ram", "#ff8be4", "#ffffff", "psychic"],
  ironhead: ["ram", "#c0c8d4", "#ffffff", "steel"],
  headsmash: ["ram", "#a8977a", "#ffffff", "rock"],
  bodyslam: ["stomp", "#eadfc8", "#ffffff", "dust"],
  doubleedge: ["ram", "#ffffff", "#ffe9a0", "star"],
  gigaimpact: ["ram", "#ffffff", "#ffd24d", "star"],
  flareblitz: ["ram", "#ff6a1a", "#ffd84d", "fire"],
  wildcharge: ["ram", "#ffe14d", "#ffffff", "bolt"],
  volttackle: ["ram", "#ffe14d", "#ffffff", "bolt"],
  fusionbolt: ["ram", "#7fd8ff", "#ffffff", "bolt"],
  spark: ["ram", "#ffe14d", "#ffffff", "bolt"],
  quickattack: ["speed", "#ffffff", "#ffe9a0", "star"],
  extremespeed: ["speed", "#ffffff", "#ffd24d", "star"],
  accelerock: ["speed", "#b8a98a", "#ffffff", "rock"],
  aquajet: ["speed", "#6cc4ff", "#ffffff", "water"],
  shadowsneak: ["speed", "#7a3fc0", "#e0c0ff", "dark"],
  pursuit: ["speed", "#4a2f6a", "#d8b8ff", "dark"],
  uturn: ["speed", "#9bd33a", "#ffffff", "bug"],
  waterfall: ["speed", "#3da0ff", "#ffffff", "water"],
  megahorn: ["lance", "#9bd33a", "#ffffff", "bug"],
  drillrun: ["drill", "#c9a46a", "#ffffff", "dust"],
  drillpeck: ["drill", "#e8f0ff", "#ffffff", "wind"],
  bravebird: ["bird", "#8fd3ff", "#ffffff", "wind"],
  skyattack: ["bird", "#ffe9a0", "#ffffff", "holy"],
  dragonascent: ["bird", "#7cf0c8", "#ffffff", "wind"],
  woodhammer: ["hammer", "#7bc84a", "#e6ffb0", "leaf"],
  gyroball: ["spin", "#b8c4d4", "#ffffff", "steel"],
  flamewheel: ["spin", "#ff7a2a", "#ffe08a", "fire"],
  phantomforce: ["phantom", "#7a3fc0", "#f0d8ff", "dark"],
  shadowforce: ["phantom", "#5a2a9a", "#f0d8ff", "dark"],
  poltergeist: ["phantom", "#8a5ad0", "#f0d8ff", "dark"],
  spectralthief: ["phantom", "#9a6ae0", "#ffffff", "dark"],
};
const LIFE: Record<Style, number> = { claws: 0.55, blade: 0.5, xslash: 0.45, wing: 0.55, fist: 0.5, jaws: 0.6, kick: 0.5, stomp: 0.75, tail: 0.55, ram: 0.55, speed: 0.4, lance: 0.55, drill: 0.55, bird: 0.6, hammer: 0.75, spin: 0.55, phantom: 0.65 };

/** Moves drawn by the renderer itself. */
export const MELEE_OWN = new Set(["shadowclaw", "drainpunch", "nuzzle", "thunderpunch", "strength"]);

type Fx = { fid: number; id: string; type: string; ang: number; t0: number; style: Style; c1: string; c2: string; flav: string; shook: boolean; seed: number };
type Emit = (p: Record<string, unknown>) => void;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const easeOut = (k: number) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const PI2 = Math.PI * 2;

export class MeleeFx {
  private list: Fx[] = [];
  private seen = new Map<number, unknown>();

  /** Called each frame for a fighter: starts the picture when a new lunge begins. */
  watch(f: Fighter, t: number) {
    const d = f.dash;
    if (!d || d.under) {
      if (!d) this.seen.delete(f.id);
      return;
    }
    if (this.seen.get(f.id) === d) return;
    this.seen.set(f.id, d);
    const id = d.mv.fx ?? d.mv.id;
    if (d.mv.type === "Dragon" || MELEE_OWN.has(id) || MELEE_OWN.has(d.mv.id)) return;
    const row = T[d.mv.id] ?? T[id];
    const c = TYPE_COLOR[d.mv.type] ?? "#ffffff";
    const [style, c1, c2, flav] = row ?? (["ram", c, "#ffffff", "star"] as [Style, string, string, string]);
    this.list.push({ fid: f.id, id: d.mv.id, type: d.mv.type, ang: Math.atan2(d.dy, d.dx), t0: t, style, c1, c2, flav, shook: false, seed: Math.random() * 100 });
  }

  draw(g: CanvasRenderingContext2D, f: Fighter, t: number, emit: Emit, shake: (a: number, s: number) => void) {
    if (!this.list.length) return;
    this.list = this.list.filter((e) => t - e.t0 < LIFE[e.style] + 0.05);
    for (const e of this.list) {
      if (e.fid !== f.id) continue;
      const p = clamp((t - e.t0) / LIFE[e.style], 0, 1);
      const s = Math.max(34, f.r * 2.1);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      g.lineJoin = "round";
      const cx = f.x, cy = f.y - f.r * 0.3;
      const tipx = cx + Math.cos(e.ang) * f.r * 1.8, tipy = cy + Math.sin(e.ang) * f.r * 1.8;
      switch (e.style) {
        case "claws": claws(g, e, tipx, tipy, s, p, emit); break;
        case "blade": swing(g, e, cx, cy, f.r * 2.4, -1.35, 1.35, p, 15, emit, 0.5); break;
        case "kick": swing(g, e, cx, cy, f.r * 2.1, 1.1, -0.55, p, 22, emit, 0.4); impactAt(g, e, cx + Math.cos(e.ang - 0.5) * f.r * 2.1, cy + Math.sin(e.ang - 0.5) * f.r * 2.1, s, p, 0.75, emit, 0.7); break;
        case "tail": swing(g, e, cx, cy, f.r * 2.2, -2.7, 0.5, p, 18, emit, 0.45); break;
        case "wing":
          swing(g, e, cx, cy, f.r * 2.2, -0.2, -1.9, p, 20, emit, 0.4);
          swing(g, e, cx, cy, f.r * 2.2, 0.2, 1.9, p, 20, emit, 0.4);
          break;
        case "hammer": swing(g, e, cx, cy, f.r * 2.4, -2.3, 0.0, p, 28, emit, 0.45); stomp(g, e, tipx, tipy, s, p, 0.45, emit, shake); break;
        case "phantom": phantom(g, e, cx, cy, tipx, tipy, s, p, emit); break;
        case "xslash": xslash(g, e, tipx, tipy, s, p, emit); break;
        case "fist": fist(g, e, tipx, tipy, s, p, emit, shake); break;
        case "jaws": jaws(g, e, tipx, tipy, s, p, emit); break;
        case "stomp": stomp(g, e, tipx, tipy, s, p, 0.2, emit, shake); break;
        case "ram": ram(g, e, f, cx, cy, tipx, tipy, s, p, emit, shake); break;
        case "speed": speed(g, e, cx, cy, s, p, emit); break;
        case "lance": lance(g, e, cx, cy, s, p, emit); break;
        case "drill": drill(g, e, cx, cy, s, p, t); break;
        case "bird": bird(g, e, cx, cy, s, p, emit); break;
        case "spin": spin(g, e, cx, cy, f.r, p, t, emit); break;
      }
      g.restore();
    }
  }
}

/* ------------------------------------------------------------------ shared pieces */

function flavour(e: Fx, x: number, y: number, emit: Emit, n = 1) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, PI2), v = rnd(40, 200);
    const base = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: rnd(0.3, 0.7), max: 0.7, size: rnd(2, 4), grow: 0, color: i % 2 ? e.c1 : e.c2 };
    switch (e.flav) {
      case "fire": emit({ ...base, kind: "flame", vy: base.vy - 80, g: -40, size: rnd(6, 11), color: i % 2 ? "#ff6a1a" : "#ffb02e", seed: Math.floor(rnd(0, 99)) }); break;
      case "ice": emit({ ...base, kind: "shard", g: 240, rot: rnd(0, 6), vr: rnd(-10, 10), color: i % 2 ? "#bff0ff" : "#ffffff" }); break;
      case "bolt": emit({ ...base, kind: "bolt", life: 0.2, max: 0.2, x2: x + Math.cos(a) * 40, y2: y + Math.sin(a) * 40, color: "#ffe14d", seed: Math.floor(rnd(1, 99)) }); break;
      case "leaf": emit({ ...base, kind: "leaf", g: 120, rot: rnd(0, 6), vr: rnd(-10, 10), size: rnd(3.5, 6), color: i % 2 ? "#6fcf4a" : "#b4f06a" }); break;
      case "water": emit({ ...base, kind: "dot", g: 420, color: i % 2 ? "#8fd3ff" : "#ffffff" }); break;
      case "dark": emit({ ...base, kind: "smoke", size: rnd(7, 12), grow: 20, life: 0.6, color: i % 2 ? "#3a2060" : "#7a3fc0" }); break;
      case "psychic": emit({ ...base, kind: "star", size: rnd(4, 7), rot: rnd(0, 3), vr: rnd(-6, 6), color: "#ffb0ec" }); break;
      case "poison": emit({ ...base, kind: "bubble", g: -10, size: rnd(3, 6), color: i % 2 ? "#d28bff" : "#9be07a" }); break;
      case "rock": case "brick": case "dust": emit({ ...base, kind: "plank", g: 800, vy: base.vy - 140, size: rnd(2.5, 5), rot: rnd(0, 6), vr: rnd(-12, 12), color: i % 2 ? "#8a7a68" : "#b5a58a" }); break;
      case "steel": emit({ ...base, kind: "spark", g: 300, color: i % 2 ? "#ffffff" : "#c7d0dc" }); break;
      case "star": case "holy": case "power": case "fight": emit({ ...base, kind: "star", size: rnd(4, 7), rot: rnd(0, 3), vr: rnd(-8, 8), color: i % 2 ? e.c2 : e.c1 }); break;
      case "bug": emit({ ...base, kind: "spark", g: 160, color: i % 2 ? "#b6e04a" : "#7fbf2a" }); break;
      case "wind": emit({ ...base, kind: "streak", life: 0.3, max: 0.3, size: 6, color: "#ffffff" }); break;
      default: emit({ ...base, kind: "spark", g: 200 });
    }
  }
}

/** A flash and a spiky burst at the point of contact. */
function burstStar(g: CanvasRenderingContext2D, e: Fx, x: number, y: number, r: number, k: number, spikes = 10) {
  const a = 1 - k;
  g.save();
  g.translate(x, y);
  g.globalAlpha = a;
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
  gr.addColorStop(0, "#ffffff");
  gr.addColorStop(0.45, e.c1);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, r * 1.2, 0, PI2);
  g.fill();
  g.fillStyle = e.c2;
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rr = i % 2 ? r * 0.35 : r * (0.9 + 0.3 * Math.sin(i * 3 + e.seed));
    const an = (i / (spikes * 2)) * PI2 + e.seed;
    g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
  }
  g.closePath();
  g.fill();
  g.restore();
}

/** Contact: starburst, a ring and flavour particles, once the swing reaches `at`. */
function impactAt(g: CanvasRenderingContext2D, e: Fx, x: number, y: number, s: number, p: number, at: number, emit: Emit, strength = 1) {
  if (p < at) return;
  const k = clamp((p - at) / 0.3, 0, 1);
  if (k >= 1) return;
  burstStar(g, e, x, y, s * (0.55 + 0.5 * strength) * (0.6 + k * 0.6), k);
  g.save();
  g.globalAlpha = 1 - k;
  g.strokeStyle = e.c2;
  g.lineWidth = 3 * (1 - k) + 1;
  g.beginPath();
  g.ellipse(x, y, s * (0.3 + k * 1.1), s * (0.3 + k * 1.1) * 0.7, 0, 0, PI2);
  g.stroke();
  g.restore();
  if (k < 0.2) flavour(e, x, y, emit, 2);
}

/** A sweeping arc that thins out behind its leading edge, like a blade, leg or tail swinging. */
function swing(g: CanvasRenderingContext2D, e: Fx, cx: number, cy: number, R: number, a0: number, a1: number, p: number, wMax: number, emit: Emit, dur: number) {
  const k = easeOut(p / dur);
  const head = e.ang + a0 + (a1 - a0) * k;
  const fade = 1 - smooth(dur, 1, p);
  const dir = Math.sign(a1 - a0) || 1;
  for (let i = 0; i < 8; i++) {
    const w = wMax * (1 - i / 8);
    const from = head - dir * (0.2 + i * 0.17) * Math.min(1, k * 2.5), to = head - dir * i * 0.17 * Math.min(1, k * 2.5);
    g.globalAlpha = fade * (1 - i / 9);
    g.strokeStyle = i < 3 ? e.c2 : e.c1;
    g.lineWidth = Math.max(1.5, w * (i < 3 ? 0.55 : 1));
    g.beginPath();
    g.arc(cx, cy, R, Math.min(from, to), Math.max(from, to));
    g.stroke();
  }
  const tx = cx + Math.cos(head) * R, ty = cy + Math.sin(head) * R;
  if (k < 1) {
    g.globalAlpha = fade;
    const gr = g.createRadialGradient(tx, ty, 0, tx, ty, wMax * 1.5);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.5, e.c1);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(tx, ty, wMax * 1.5, 0, PI2);
    g.fill();
    if (Math.random() < 0.7) flavour(e, tx, ty, emit, 1);
  }
}

/* ------------------------------------------------------------------ styles */

function claws(g: CanvasRenderingContext2D, e: Fx, x: number, y: number, s: number, p: number, emit: Emit) {
  g.translate(x, y);
  g.rotate(e.ang);
  for (let i = -1; i <= 1; i++) {
    const k = clamp((p - (i + 1) * 0.1) / 0.28, 0, 1);
    if (k <= 0) continue;
    const oy = i * s * 0.5;
    const fade = 1 - smooth(0.45, 1, p);
    // each gash is a curve drawn from its top to wherever the claw has got to, then it glows away
    for (const [w, col, al] of [[10, e.c1, 0.5], [5, e.c1, 1], [2.2, e.c2, 1]] as [number, string, number][]) {
      g.globalAlpha = fade * al;
      g.strokeStyle = col;
      g.lineWidth = w * (1 - 0.3 * Math.abs(i));
      g.beginPath();
      for (let u = 0; u <= 1.001; u += 0.1) {
        const uu = u * k;
        const px = (1 - uu) * (1 - uu) * (-s * 0.25) + 2 * (1 - uu) * uu * (s * 0.8) + uu * uu * (-s * 0.25);
        const py = oy - s * 0.95 + uu * s * 1.9;
        if (u === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
    if (k < 1) {
      const uu = k;
      const px = 2 * (1 - uu) * uu * (s * 0.8) - s * 0.25 * ((1 - uu) ** 2 + uu * uu);
      const wx = x + Math.cos(e.ang) * px - Math.sin(e.ang) * (oy - s * 0.95 + uu * s * 1.9);
      const wy = y + Math.sin(e.ang) * px + Math.cos(e.ang) * (oy - s * 0.95 + uu * s * 1.9);
      emit({ kind: "spark", x: wx, y: wy, vx: rnd(-90, 90), vy: rnd(-90, 90), g: 200, life: 0.4, max: 0.4, size: rnd(1.5, 3), grow: 0, color: e.c2 });
    }
  }
}

function xslash(g: CanvasRenderingContext2D, e: Fx, x: number, y: number, s: number, p: number, emit: Emit) {
  g.translate(x, y);
  const fade = 1 - smooth(0.4, 1, p);
  for (const [sg, delay] of [[1, 0], [-1, 0.12]] as const) {
    const k = easeOut((p - delay) / 0.25);
    if (k <= 0) continue;
    const L = s * 2 * k;
    const an = e.ang + sg * 0.75;
    const dx = Math.cos(an), dy = Math.sin(an);
    for (const [w, col, al] of [[12, e.c1, 0.45], [5, e.c1, 1], [2.2, e.c2, 1]] as [number, string, number][]) {
      g.globalAlpha = fade * al;
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(-dx * L * 0.5, -dy * L * 0.5);
      g.lineTo(dx * L * 0.5, dy * L * 0.5);
      g.stroke();
    }
    if (k < 1) flavour(e, x + dx * L * 0.5, y + dy * L * 0.5, emit, 1);
  }
  burstStar(g, e, 0, 0, s * 0.9, clamp((p - 0.15) / 0.4, 0, 1), 8);
}

function fist(g: CanvasRenderingContext2D, e: Fx, x: number, y: number, s: number, p: number, emit: Emit, shake: (a: number, s: number) => void) {
  const upper = e.flav === "upper";
  const flurry = e.flav === "flurry";
  const heavy = e.flav === "power" || e.flav === "brick" || e.flav === "star";
  g.translate(x, y);
  g.rotate(upper ? -Math.PI / 2 : e.ang);
  const draw = (ox: number, oy: number, k: number, size: number) => {
    const a = 1 - smooth(0.55, 1, p);
    const sz = s * size * (0.5 + 0.55 * easeOut(k));
    g.save();
    g.translate(ox + (1 - easeOut(k)) * -s * 0.9 * (upper ? 0 : 1), oy + (upper ? (1 - easeOut(k)) * s * 1.3 : 0));
    g.globalAlpha = a;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, sz * 1.5);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.4, e.c1);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, sz * 1.5, 0, PI2);
    g.fill();
    // the fist: a block with four knuckles on the front edge
    g.globalCompositeOperation = "source-over";
    g.fillStyle = e.c1;
    g.strokeStyle = e.c2;
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(-sz * 0.55, -sz * 0.42, sz * 0.9, sz * 0.84, sz * 0.2);
    g.fill();
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(sz * 0.38, -sz * 0.33 + i * sz * 0.22, sz * 0.13, 0, PI2);
      g.fill();
      g.stroke();
    }
    g.globalCompositeOperation = "lighter";
    g.restore();
  };
  if (flurry) {
    for (let i = 0; i < 3; i++) draw(i * s * 0.08, (i - 1) * s * 0.55, (p - i * 0.1) / 0.18, 0.55);
  } else draw(0, 0, p / 0.22, heavy ? 1.25 : 1);
  const hit = clamp((p - 0.2) / 0.35, 0, 1);
  if (hit > 0 && hit < 1) {
    g.globalAlpha = 1 - hit;
    g.strokeStyle = e.c2;
    for (let i = 0; i < 9; i++) {
      const an = (i / 9) * PI2 + e.seed;
      g.lineWidth = 3 * (1 - hit) + 1;
      g.beginPath();
      g.moveTo(Math.cos(an) * s * (0.5 + hit * 0.4), Math.sin(an) * s * (0.5 + hit * 0.4));
      g.lineTo(Math.cos(an) * s * (0.9 + hit * 1.0), Math.sin(an) * s * (0.9 + hit * 1.0));
      g.stroke();
    }
    g.lineWidth = 4 * (1 - hit) + 1;
    g.beginPath();
    g.arc(0, 0, s * (0.4 + hit * 1.3), 0, PI2);
    g.stroke();
    if (hit < 0.35) flavour(e, x, y, emit, flurry ? 3 : 2);
  }
  if (!e.shook && p > 0.2 && heavy) {
    e.shook = true;
    shake(7, 0.2);
  }
}

function jaws(g: CanvasRenderingContext2D, e: Fx, x: number, y: number, s: number, p: number, emit: Emit) {
  g.translate(x, y);
  g.rotate(e.ang);
  const open = p < 0.3 ? smooth(0, 0.3, p) : p < 0.45 ? 1 - smooth(0.3, 0.45, p) : 0;
  const gap = s * (0.12 + 0.95 * open);
  const fade = 1 - smooth(0.65, 1, p);
  g.globalAlpha = fade;
  for (const sg of [-1, 1]) {
    // the dark jaw
    const gr = g.createLinearGradient(0, sg * gap, 0, sg * (gap + s * 0.8));
    gr.addColorStop(0, e.c1);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(0, sg * (gap + s * 0.35), s * 1.05, s * 0.5, 0, 0, PI2);
    g.fill();
    // the teeth
    g.fillStyle = e.c2;
    g.strokeStyle = e.c1;
    g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const tx = -s * 0.9 + i * s * 0.3;
      const big = i % 3 === 1;
      g.beginPath();
      g.moveTo(tx - s * 0.12, sg * gap);
      g.lineTo(tx, sg * (gap - s * (big ? 0.5 : 0.34)) * 1);
      g.lineTo(tx + s * 0.12, sg * gap);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
  // the snap
  if (p > 0.42) {
    const k = clamp((p - 0.42) / 0.3, 0, 1);
    burstStar(g, e, 0, 0, s * 0.8, k, 8);
    g.globalAlpha = (1 - k) * fade;
    g.strokeStyle = e.c2;
    g.lineWidth = 2.5;
    for (let i = 0; i < 7; i++) {
      const tx = -s * 0.9 + i * s * 0.3;
      g.beginPath();
      g.moveTo(tx, -s * 0.18);
      g.lineTo(tx, s * 0.18);
      g.stroke();
    }
    if (k < 0.25) flavour(e, x, y, emit, 3);
  }
}

function stomp(g: CanvasRenderingContext2D, e: Fx, x: number, y: number, s: number, p: number, at: number, emit: Emit, shake: (a: number, s: number) => void) {
  if (p < at) return;
  const k = clamp((p - at) / 0.5, 0, 1);
  g.save();
  g.translate(x, y + s * 0.25);
  g.globalCompositeOperation = "source-over";
  for (let r = 0; r < 3; r++) {
    g.globalAlpha = (1 - k) * (0.9 - r * 0.25);
    g.strokeStyle = r ? e.c1 : "#ffffff";
    g.lineWidth = 5 - r * 1.3;
    g.beginPath();
    g.ellipse(0, 0, s * (0.4 + k * 1.5 + r * 0.25), s * (0.4 + k * 1.5 + r * 0.25) * 0.42, 0, 0, PI2);
    g.stroke();
  }
  // cracks running out of the point of impact
  g.globalAlpha = (1 - k * 0.8);
  g.strokeStyle = "#2a1c10";
  g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const an = (i / 8) * PI2 + e.seed;
    g.beginPath();
    g.moveTo(0, 0);
    let px = 0, py = 0;
    for (let j = 1; j <= 4; j++) {
      px += Math.cos(an + Math.sin(i * 9 + j) * 0.4) * s * 0.4 * easeOut(k * 1.3);
      py += Math.sin(an + Math.sin(i * 9 + j) * 0.4) * s * 0.4 * 0.5 * easeOut(k * 1.3);
      g.lineTo(px, py);
    }
    g.stroke();
  }
  g.restore();
  g.globalCompositeOperation = "lighter";
  if (!e.shook) {
    e.shook = true;
    shake(9, 0.25);
    for (let i = 0; i < 12; i++) flavour(e, x + rnd(-s * 0.5, s * 0.5), y + s * 0.2, emit, 1);
    for (let i = 0; i < 8; i++) emit({ kind: "smoke", x: x + rnd(-s * 0.6, s * 0.6), y: y + s * 0.3, vx: rnd(-80, 80), vy: rnd(-40, -5), g: 0, life: rnd(0.6, 1), max: 1, size: rnd(9, 15), grow: 26, color: i % 2 ? "#d4c7b0" : "#a89b86" });
  }
  burstStar(g, e, x, y, s * 0.9, clamp((p - at) / 0.25, 0, 1), 12);
}

function ram(g: CanvasRenderingContext2D, e: Fx, f: Fighter, cx: number, cy: number, tx: number, ty: number, s: number, p: number, emit: Emit, shake: (a: number, s: number) => void) {
  const fade = 1 - smooth(0.4, 1, p);
  // an aura wrapped around the body and speed lines streaming behind it
  g.save();
  g.translate(cx, cy);
  g.rotate(e.ang);
  g.globalAlpha = fade * 0.75;
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, s * 1.7);
  gr.addColorStop(0, e.c2);
  gr.addColorStop(0.35, e.c1);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(-s * 0.4, 0, s * 2.1, s * 1.15, 0, 0, PI2);
  g.fill();
  g.strokeStyle = e.c2;
  for (let i = 0; i < 6; i++) {
    const oy = (i - 2.5) * s * 0.28;
    const L = s * (1.6 + (i % 3) * 0.8);
    g.globalAlpha = fade * 0.7;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-s * 0.9, oy);
    g.lineTo(-s * 0.9 - L, oy);
    g.stroke();
  }
  g.restore();
  // each kind of charge has its own flourish
  if (Math.random() < 0.6) {
    if (e.flav === "fire" || e.flav === "bolt" || e.flav === "rock" || e.flav === "steel") flavour(e, cx + rnd(-f.r, f.r), cy + rnd(-f.r, f.r), emit, 1);
    if (e.flav === "psychic" || e.flav === "star") flavour(e, cx + Math.cos(e.ang) * f.r, cy + Math.sin(e.ang) * f.r, emit, 1);
  }
  if (e.flav === "psychic") {
    g.save();
    g.strokeStyle = e.c1;
    for (let r = 0; r < 3; r++) {
      const k = (p * 2 + r / 3) % 1;
      g.globalAlpha = (1 - k) * fade;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(tx, ty, s * (0.3 + k * 1.2), e.ang - 1.2, e.ang + 1.2);
      g.stroke();
    }
    g.restore();
  }
  impactAt(g, e, tx, ty, s * 1.1, p, 0.22, emit, 1.3);
  if (!e.shook && p > 0.22) {
    e.shook = true;
    shake(8, 0.22);
  }
}

function speed(g: CanvasRenderingContext2D, e: Fx, cx: number, cy: number, s: number, p: number, emit: Emit) {
  g.translate(cx, cy);
  g.rotate(e.ang);
  const fade = 1 - smooth(0.2, 1, p);
  g.strokeStyle = e.c2;
  for (let i = 0; i < 9; i++) {
    const oy = ((i * 37) % 100 / 100 - 0.5) * s * 1.7;
    const L = s * (1.4 + ((i * 53) % 100) / 100 * 2.2) * (0.5 + p);
    g.globalAlpha = fade * (0.9 - (i % 3) * 0.2);
    g.lineWidth = 3.5 - (i % 3);
    g.beginPath();
    g.moveTo(-s * 0.7, oy);
    g.lineTo(-s * 0.7 - L, oy);
    g.stroke();
  }
  g.globalAlpha = fade;
  const gr = g.createLinearGradient(-s * 2, 0, s * 0.6, 0);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, e.c1);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(s * 0.6, 0);
  g.lineTo(-s * 2.2, -s * 0.5);
  g.lineTo(-s * 2.2, s * 0.5);
  g.closePath();
  g.fill();
  if (Math.random() < 0.5) flavour(e, cx - Math.cos(e.ang) * s, cy - Math.sin(e.ang) * s, emit, 1);
}

function lance(g: CanvasRenderingContext2D, e: Fx, cx: number, cy: number, s: number, p: number, emit: Emit) {
  g.save();
  g.translate(cx, cy);
  g.rotate(e.ang);
  const k = easeOut(p / 0.25);
  const fade = 1 - smooth(0.5, 1, p);
  const L = s * (0.9 + 2.2 * k);
  g.globalAlpha = fade;
  const gr = g.createLinearGradient(s * 0.6, 0, L, 0);
  gr.addColorStop(0, e.c1);
  gr.addColorStop(1, e.c2);
  g.fillStyle = gr;
  g.strokeStyle = e.c2;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(s * 0.5, -s * 0.3);
  g.quadraticCurveTo(L * 0.6, -s * 0.22, L, 0);
  g.quadraticCurveTo(L * 0.6, s * 0.22, s * 0.5, s * 0.3);
  g.closePath();
  g.fill();
  g.stroke();
  g.globalAlpha = fade * 0.5;
  g.fillStyle = e.c1;
  g.beginPath();
  g.ellipse(s * 0.9, 0, s * 1.2, s * 0.6, 0, 0, PI2);
  g.fill();
  g.restore();
  const tx = cx + Math.cos(e.ang) * L, ty = cy + Math.sin(e.ang) * L;
  impactAt(g, e, tx, ty, s, p, 0.25, emit, 1);
}

function drill(g: CanvasRenderingContext2D, e: Fx, cx: number, cy: number, s: number, p: number, t: number) {
  g.translate(cx, cy);
  g.rotate(e.ang);
  const k = easeOut(p / 0.25);
  const fade = 1 - smooth(0.5, 1, p);
  const L = s * (1 + 1.9 * k);
  g.globalAlpha = fade;
  g.fillStyle = e.c1;
  g.globalAlpha = fade * 0.55;
  g.beginPath();
  g.moveTo(s * 0.4, -s * 0.5);
  g.lineTo(L, 0);
  g.lineTo(s * 0.4, s * 0.5);
  g.closePath();
  g.fill();
  g.globalAlpha = fade;
  g.strokeStyle = e.c2;
  g.lineWidth = 3;
  for (let j = 0; j < 4; j++) {
    g.beginPath();
    for (let u = 0; u <= 1.001; u += 0.08) {
      const x = s * 0.4 + (L - s * 0.4) * u;
      const r = s * 0.5 * (1 - u);
      const y = Math.sin(u * 7 - t * 34 + j * 1.57) * r;
      if (u === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
}

function bird(g: CanvasRenderingContext2D, e: Fx, cx: number, cy: number, s: number, p: number, emit: Emit) {
  g.translate(cx, cy);
  g.rotate(e.ang);
  const fade = 1 - smooth(0.5, 1, p);
  const k = easeOut(p / 0.3);
  // swept-back wings and a comet's tail in front
  for (const sg of [-1, 1]) {
    g.globalAlpha = fade * 0.85;
    const gr = g.createLinearGradient(0, 0, -s * 2.2, sg * s * 1.5);
    gr.addColorStop(0, e.c2);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-s * 0.1, sg * s * 0.2);
    g.quadraticCurveTo(-s * 1.2, sg * s * (0.5 + 1.1 * k), -s * 2.4, sg * s * 1.8 * k);
    g.quadraticCurveTo(-s * 1.4, sg * s * 0.6, -s * 0.6, sg * s * 0.2);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = fade;
  const hg = g.createRadialGradient(s * 0.8, 0, 0, s * 0.8, 0, s * 1.6);
  hg.addColorStop(0, "#ffffff");
  hg.addColorStop(0.4, e.c1);
  hg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = hg;
  g.beginPath();
  g.arc(s * 0.8, 0, s * 1.6, 0, PI2);
  g.fill();
  if (Math.random() < 0.7) flavour(e, cx - Math.cos(e.ang) * s * 1.2 + rnd(-s, s) * 0.3, cy - Math.sin(e.ang) * s * 1.2 + rnd(-s, s) * 0.3, emit, 1);
}

function spin(g: CanvasRenderingContext2D, e: Fx, cx: number, cy: number, r: number, p: number, t: number, emit: Emit) {
  g.translate(cx, cy + r * 0.2);
  const fade = 1 - smooth(0.6, 1, p);
  for (let i = 0; i < 3; i++) {
    const R = r * (1.35 + i * 0.35);
    const a0 = t * (16 - i * 3) + i * 2.1;
    g.globalAlpha = fade * (0.95 - i * 0.2);
    g.strokeStyle = i === 0 ? e.c2 : e.c1;
    g.lineWidth = 9 - i * 2;
    g.beginPath();
    g.ellipse(0, 0, R, R * 0.8, 0, a0, a0 + 3.4);
    g.stroke();
  }
  if (Math.random() < 0.7) flavour(e, cx + Math.cos(t * 16) * r * 1.5, cy + Math.sin(t * 16) * r * 1.2, emit, 1);
}

function phantom(g: CanvasRenderingContext2D, e: Fx, cx: number, cy: number, tx: number, ty: number, s: number, p: number, emit: Emit) {
  // it dissolves into a swirl of dark mist, then tears out of it with a slash
  if (p < 0.4) {
    const k = p / 0.4;
    g.globalAlpha = 1 - k * 0.6;
    g.strokeStyle = e.c1;
    g.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.ellipse(cx, cy, s * (1.5 - k * 1.1 + i * 0.2), s * (1.5 - k * 1.1 + i * 0.2) * 0.6, k * 5 + i, 0, PI2);
      g.stroke();
    }
    if (Math.random() < 0.8) flavour(e, cx + rnd(-s, s), cy + rnd(-s * 0.6, s * 0.6), emit, 1);
  }
  if (p > 0.25) {
    g.save();
    g.translate(tx, ty);
    g.rotate(e.ang);
    const k = clamp((p - 0.25) / 0.3, 0, 1);
    const fade = 1 - smooth(0.65, 1, p);
    for (let i = -1; i <= 1; i++) {
      const oy = i * s * 0.45;
      for (const [w, col, al] of [[9, e.c1, 0.55], [4, e.c1, 1], [1.8, e.c2, 1]] as [number, string, number][]) {
        g.globalAlpha = fade * al;
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(-s * 0.2, oy - s * 0.9 * k);
        g.quadraticCurveTo(s * 0.8 * k, oy, -s * 0.2, oy + s * 0.9 * k);
        g.stroke();
      }
    }
    g.restore();
    impactAt(g, e, tx, ty, s, p, 0.35, emit, 0.9);
  }
}
