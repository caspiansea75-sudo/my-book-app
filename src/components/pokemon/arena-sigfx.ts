/**
 * Signature looks for the moves whose names say what they are: a Hurricane is a tornado, a Surf is a wave of water rolling out,
 * a Blizzard is a wall of snow, a Heat Wave is a wall of heat, a Pulse is rings of energy travelling along.
 *
 * Every look is split in two layers, so it keeps its shape from any camera:
 *   `sigFlat`   what lies on the floor (foam rings, frost, scorch swirls, dust), drawn with the floor's perspective;
 *   `sigItems`  what stands up (a funnel, a crest of water, a wall of flame, crystals), handed out one piece at a time with the world
 *               point it stands on, so the renderer puts each piece upright there and sorts it against the Pokémon in front or behind.
 * Everything is drawn in world coordinates; each upright piece translates to its own foot first.
 */

const TAU = Math.PI * 2;
const hs = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const sm = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a || 1))); return k * k * (3 - 2 * k); };
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export type SigStyle = "hurricane" | "waterspout" | "magmastorm" | "blizzard" | "diamondstorm" | "surf" | "heatwave" | "sludgewave" | "leafstorm" | "sandstorm";

/** Moves that get a signature look, by move id. */
export const SIG_MOVES: Record<string, SigStyle> = {
  hurricane: "hurricane", waterspout: "waterspout", magmastorm: "magmastorm",
  blizzard: "blizzard", diamondstorm: "diamondstorm",
  surf: "surf", heatwave: "heatwave", sludgewave: "sludgewave",
  leafstorm: "leafstorm", whirlpool: "waterspout", firespin: "magmastorm", whirlpoolprison: "waterspout", sandtomb: "sandstorm", hurricanegale: "hurricane",
};

export const isTall = (st: SigStyle) => st === "hurricane" || st === "waterspout" || st === "magmastorm" || st === "leafstorm" || st === "sandstorm";

export type Sig = { style: SigStyle; x: number; y: number; r: number; t: number; life: number; seed: number; mk?: number };

export function newSig(style: SigStyle, x: number, y: number, r: number, life?: number): Sig {
  const base: Record<SigStyle, number> = { hurricane: 1.9, waterspout: 1.9, magmastorm: 4, blizzard: 2.6, diamondstorm: 1.5, surf: 1.15, heatwave: 1.1, sludgewave: 1.15, leafstorm: 2.2, sandstorm: 2.2 };
  return { style, x, y, r, t: 0, life: life ?? base[style], seed: Math.random() * 1000 };
}

type Pal = { dk: string; md: string; lt: string; core: string };
const PAL: Record<SigStyle, Pal> = {
  hurricane: { dk: "#4b5870", md: "#9fb0c8", lt: "#dfe9f6", core: "#ffffff" },
  waterspout: { dk: "#124a98", md: "#2f86e0", lt: "#9fdcff", core: "#ffffff" },
  magmastorm: { dk: "#5a1004", md: "#ff5a1a", lt: "#ffb02e", core: "#fff3b0" },
  blizzard: { dk: "#6fa8d8", md: "#bfe8ff", lt: "#f2fbff", core: "#ffffff" },
  diamondstorm: { dk: "#6a86c8", md: "#a8d8ff", lt: "#eaf8ff", core: "#ffffff" },
  surf: { dk: "#124a98", md: "#2f86e0", lt: "#9fdcff", core: "#ffffff" },
  heatwave: { dk: "#8a1c08", md: "#ff6a1f", lt: "#ffc04a", core: "#fff3b0" },
  sandstorm: { dk: "#7a5a2c", md: "#c89a50", lt: "#ecd29a", core: "#fff2cc" },
  leafstorm: { dk: "#1f5a22", md: "#4fb83a", lt: "#b8f07a", core: "#f4ffd8" },
  sludgewave: { dk: "#3a1458", md: "#8a3ac8", lt: "#c8ff6a", core: "#f0ffd0" },
};

/* ------------------------------------------------------------------ flat layer */

type G = CanvasRenderingContext2D;
import { iceFlat, iceItems } from "./arena-ice";
import { isVortex, vortexFlat, vortexItems } from "./arena-vortex";

export function sigFlat(g: G, s: Sig) {
  if (isVortex(s.style)) { vortexFlat(g, s); return; }
  if (s.style === "blizzard") { iceFlat(g, s); return; }
  const u = Math.min(1, s.t / s.life);
  const p = PAL[s.style];
  const fade = sm(0, 0.1, u) * (1 - sm(0.7, 1, u));
  g.save();
  g.translate(s.x, s.y);
  if (isTall(s.style)) {
    // a swirl of wind, water or fire turning on the floor round the foot of the funnel, and a ring of dust or spray thrown out
    g.globalCompositeOperation = s.style === "magmastorm" ? "lighter" : "source-over";
    g.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const rr = s.r * (0.35 + i * 0.28) * (0.8 + 0.2 * sm(0, 0.25, u));
      g.strokeStyle = i % 2 ? p.lt : p.md;
      g.globalAlpha = fade * (0.5 - i * 0.08);
      g.lineWidth = 4 - i * 0.6;
      g.setLineDash([rr * 0.9, rr * 0.55]);
      g.lineDashOffset = -s.t * rr * (2.4 - i * 0.4);
      g.beginPath();
      g.arc(0, 0, rr, 0, TAU);
      g.stroke();
    }
    g.setLineDash([]);
    if (s.style === "magmastorm") {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, s.r * 1.3);
      gr.addColorStop(0, "rgba(255,170,60,.55)");
      gr.addColorStop(1, "rgba(255,90,20,0)");
      g.globalAlpha = fade;
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, s.r * 1.3, 0, TAU);
      g.fill();
    }
  } else {
    // the rings of a wave: the edge rolling out over the floor, a lighter band behind it
    const rho = s.r * (0.25 + 0.8 * sm(0, 1, u));
    g.lineCap = "round";
    const wide = s.style === "blizzard" || s.style === "diamondstorm";
    g.globalCompositeOperation = s.style === "heatwave" || s.style === "diamondstorm" ? "lighter" : "source-over";
    g.globalAlpha = (1 - sm(0.45, 1, u)) * 0.85;
    g.strokeStyle = p.md;
    g.lineWidth = 10 + (wide ? 6 : 0);
    g.beginPath();
    g.arc(0, 0, rho, 0, TAU);
    g.stroke();
    g.strokeStyle = p.lt;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, rho * 1.02, 0, TAU);
    g.stroke();
    g.globalAlpha = (1 - sm(0.3, 1, u)) * 0.3;
    g.fillStyle = p.md;
    g.beginPath();
    g.arc(0, 0, rho, 0, TAU);
    g.fill();
    if (s.style === "blizzard") {
      // frost cracks
      g.strokeStyle = "#ffffff";
      g.lineWidth = 1.5;
      g.globalAlpha = (1 - sm(0.5, 1, u)) * 0.8;
      for (let i = 0; i < 12; i++) {
        const a = hs(s.seed + i) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * rho * 0.2, Math.sin(a) * rho * 0.2);
        g.lineTo(Math.cos(a + 0.12) * rho * 0.6, Math.sin(a + 0.12) * rho * 0.6);
        g.lineTo(Math.cos(a - 0.05) * rho * 0.95, Math.sin(a - 0.05) * rho * 0.95);
        g.stroke();
      }
    }
  }
  g.restore();
}

/* ------------------------------------------------------------------ upright pieces */

/** Called once a frame; `push(x, y, depth, draw)` hands out one upright piece standing at the world point (x, y). */
export function sigItems(s: Sig, push: (x: number, y: number, dy: number, draw: (g: G) => void) => void) {
  if (isVortex(s.style)) { vortexItems(s, push); return; }
  if (s.style === "blizzard") { iceItems(s, push); return; }
  if (isTall(s.style)) {
    push(s.x, s.y, -0.6, (g) => tornadoBack(g, s));
    push(s.x, s.y, 0, (g) => tornadoBody(g, s));
    push(s.x, s.y, 0.6, (g) => tornadoFront(g, s));
    return;
  }
  // the others are a ring of upright pieces that rolls out from the caster
  const u = Math.min(1, s.t / s.life);
  const rho = s.r * (0.25 + 0.8 * sm(0, 1, u));
  const n = Math.max(14, Math.min(34, Math.round((TAU * rho) / 20)));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hs(s.seed) * 0.4;
    const px = s.x + Math.cos(a) * rho;
    const py = s.y + Math.sin(a) * rho;
    push(px, py, 0, (g) => wallPiece(g, s, i, px, py, TAU * rho / n, u));
  }
}

/** The bits that travel round a funnel: where each one is, how high, how far round. */
function debris(s: Sig, i: number, H: number, rad: (u: number) => number) {
  const u0 = 0.08 + hs(s.seed + i * 3.1) * 0.9;
  const phase = hs(s.seed + i * 7.7) * TAU;
  const ang = phase + s.t * (4.2 - u0 * 2.2) * (1 + hs(i) * 0.3);
  const rr = rad(u0) * (1.05 + hs(i + 9) * 0.4);
  return { u: u0, x: Math.cos(ang) * rr, y: -u0 * H + Math.sin(ang) * rr * 0.3, front: Math.sin(ang) > 0, size: 2.2 + hs(i + 4) * 3.2, ang };
}

function tornadoShape(s: Sig) {
  const u = Math.min(1, s.t / s.life);
  const grow = sm(0, 0.18, u);
  const out = 1 - sm(0.8, 1, u);
  const H = (s.style === "waterspout" ? 150 : 170) * grow * (0.6 + 0.4 * out) + 8;
  const R = s.r;
  const rad = (v: number) => R * (0.13 + 0.72 * Math.pow(v, 1.25)) * (0.55 + 0.45 * grow);
  const sway = (v: number) => Math.sin(s.t * 3.2 - v * 5 + s.seed) * R * 0.16 * v;
  return { u, grow, out, H, R, rad, sway, alpha: Math.min(1, grow * 1.4) * out };
}

function tornadoBack(g: G, s: Sig) {
  const T = tornadoShape(s);
  const p = PAL[s.style];
  g.save();
  g.translate(s.x, s.y);
  g.globalAlpha = T.alpha;
  const nd = 18;
  for (let i = 0; i < nd; i++) {
    const d = debris(s, i, T.H, T.rad);
    if (d.front) continue;
    drawBit(g, s.style, d.x + T.sway(d.u), d.y, d.size, d.ang, p, 0.6);
  }
  // the dark cloud the funnel hangs from
  if (s.style === "hurricane" || s.style === "waterspout") {
    for (let i = 0; i < 5; i++) {
      const cx = (hs(s.seed + i) - 0.5) * T.R * 1.5 + T.sway(1);
      g.fillStyle = i % 2 ? "rgba(70,84,108,.55)" : "rgba(50,62,84,.6)";
      g.beginPath();
      g.ellipse(cx, -T.H - 4 + hs(i + 2) * 8, T.R * (0.62 + hs(i + 3) * 0.3), T.R * 0.26, 0, 0, TAU);
      g.fill();
    }
  }
  g.restore();
}

function tornadoBody(g: G, s: Sig) {
  const T = tornadoShape(s);
  const p = PAL[s.style];
  if (T.alpha <= 0.01) return;
  g.save();
  g.translate(s.x, s.y);
  g.globalAlpha = T.alpha;
  const N = 16;
  const pts: { x: number; y: number; rx: number; ry: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const v = i / N;
    const rx = T.rad(v);
    pts.push({ x: T.sway(v), y: -v * T.H, rx, ry: rx * 0.3 });
  }
  // the body: a dark funnel, lighter in the middle
  g.beginPath();
  pts.forEach((q, i) => (i ? g.lineTo(q.x - q.rx, q.y) : g.moveTo(q.x - q.rx, q.y)));
  for (let i = N; i >= 0; i--) g.lineTo(pts[i]!.x + pts[i]!.rx, pts[i]!.y);
  g.closePath();
  const gr = g.createLinearGradient(-T.R, 0, T.R, 0);
  gr.addColorStop(0, p.dk);
  gr.addColorStop(0.5, p.md);
  gr.addColorStop(1, p.dk);
  g.globalAlpha = T.alpha * (s.style === "magmastorm" ? 0.85 : 0.72);
  g.fillStyle = gr;
  g.fill();
  if (s.style === "magmastorm") {
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = T.alpha * 0.45;
    g.fillStyle = p.lt;
    g.fill();
    g.globalCompositeOperation = "source-over";
  }
  // streaks winding up the funnel: dashes that run round each ring
  g.lineCap = "round";
  for (let i = 1; i <= N; i++) {
    const q = pts[i]!;
    g.strokeStyle = i % 2 ? p.lt : p.core;
    g.globalAlpha = T.alpha * (0.28 + 0.4 * (i / N));
    g.lineWidth = 2.2;
    g.setLineDash([q.rx * 0.8, q.rx * 0.9]);
    g.lineDashOffset = -s.t * q.rx * (3.4 - (i / N) * 1.4) + i * 7;
    g.beginPath();
    g.ellipse(q.x, q.y, q.rx, q.ry, 0, 0, Math.PI); // the near side
    g.stroke();
    g.strokeStyle = p.dk;
    g.globalAlpha = T.alpha * 0.25;
    g.beginPath();
    g.ellipse(q.x, q.y, q.rx, q.ry, 0, Math.PI, TAU); // the far side, darker
    g.stroke();
  }
  g.setLineDash([]);
  g.restore();
}

function tornadoFront(g: G, s: Sig) {
  const T = tornadoShape(s);
  const p = PAL[s.style];
  if (T.alpha <= 0.01) return;
  g.save();
  g.translate(s.x, s.y);
  g.globalAlpha = T.alpha;
  for (let i = 0; i < 18; i++) {
    const d = debris(s, i, T.H, T.rad);
    if (!d.front) continue;
    drawBit(g, s.style, d.x + T.sway(d.u), d.y, d.size, d.ang, p, 1);
  }
  // spray, dust or fire round the foot
  g.globalCompositeOperation = s.style === "magmastorm" ? "lighter" : "source-over";
  for (let i = 0; i < 7; i++) {
    const a = hs(s.seed + i) * TAU + s.t * 3;
    const rr = T.R * (0.2 + hs(i + 5) * 0.25);
    g.globalAlpha = T.alpha * 0.5;
    g.fillStyle = i % 2 ? p.lt : p.md;
    g.beginPath();
    g.ellipse(Math.cos(a) * rr, Math.sin(a) * rr * 0.3 - 2, 10 + hs(i) * 8, 6, 0, 0, TAU);
    g.fill();
  }
  g.restore();
}

/** One thing carried round in the wind: a leaf, a drop, an ember, a flake, a crystal. */
function drawBit(g: G, style: SigStyle, x: number, y: number, size: number, ang: number, p: Pal, a: number) {
  g.save();
  g.translate(x, y);
  g.rotate(ang * 2);
  g.globalAlpha *= a;
  if (style === "waterspout") {
    g.fillStyle = "#cfeeff";
    g.beginPath();
    g.arc(0, 0, size * 0.8, 0, TAU);
    g.fill();
  } else if (style === "leafstorm") {
    g.fillStyle = size > 4 ? "#4fb83a" : "#b8f07a";
    g.beginPath();
    g.moveTo(-size * 1.6, 0);
    g.quadraticCurveTo(0, -size * 1.1, size * 1.6, 0);
    g.quadraticCurveTo(0, size * 1.1, -size * 1.6, 0);
    g.fill();
    g.strokeStyle = "#1f5a22";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(-size * 1.6, 0);
    g.lineTo(size * 1.6, 0);
    g.stroke();
  } else if (style === "magmastorm") {
    g.globalCompositeOperation = "lighter";
    g.fillStyle = size > 4 ? "#ff8a2e" : "#ffe27a";
    g.beginPath();
    g.arc(0, 0, size * 0.9, 0, TAU);
    g.fill();
  } else {
    // wind: leaves and bits of rubble
    g.fillStyle = size > 4 ? "#6b7a58" : "#9a8a6a";
    g.beginPath();
    g.ellipse(0, 0, size * 1.1, size * 0.5, 0, 0, TAU);
    g.fill();
  }
  g.restore();
}

/* ------------------------------------------------------------------ walls and waves round the caster */

function wallPiece(g: G, s: Sig, i: number, px: number, py: number, w0: number, u: number) {
  const p = PAL[s.style];
  const env = sm(0, 0.3, u) * (1 - sm(0.55, 1, u));
  if (env <= 0.02) return;
  const w = w0 * 1.25 + 4;
  const jit = hs(s.seed + i * 5.3);
  g.save();
  g.translate(px, py);
  g.globalAlpha = Math.min(1, env * 1.2);
  if (s.style === "surf" || s.style === "sludgewave") {
    // a crest of water: swells from the floor, curls over at the top, foam along the edge, spray flying off
    const h = (24 + jit * 14) * env * (s.r / 110) + 8;
    const sludge = s.style === "sludgewave";
    const gr = g.createLinearGradient(0, 0, 0, -h);
    gr.addColorStop(0, p.dk);
    gr.addColorStop(0.55, p.md);
    gr.addColorStop(1, sludge ? "#b8e84a" : "#bfe9ff");
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-w / 2, 2);
    g.quadraticCurveTo(-w * 0.45, -h * 0.85, w * 0.05, -h);
    g.quadraticCurveTo(w * 0.42, -h * 1.02, w * 0.5, -h * 0.62);
    g.quadraticCurveTo(w * 0.3, -h * 0.7, w * 0.5, 2);
    g.closePath();
    g.fill();
    g.strokeStyle = sludge ? "#e8ffa8" : "#ffffff";
    g.lineWidth = 2.2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-w * 0.4, -h * 0.82);
    g.quadraticCurveTo(w * 0.05, -h * 1.04, w * 0.46, -h * 0.66);
    g.stroke();
    g.fillStyle = sludge ? "#d8ff80" : "#ffffff";
    for (let k = 0; k < 3; k++) {
      const ph = (s.t * 1.8 + k / 3 + jit) % 1;
      g.globalAlpha = Math.min(1, env * 1.2) * (1 - ph);
      g.beginPath();
      g.arc((hs(i * 3 + k) - 0.5) * w, -h - ph * 22, 1.6 + hs(k + i) * 1.6, 0, TAU);
      g.fill();
    }
  } else if (s.style === "heatwave") {
    // a wall of flame: tongues that lick up and flicker, with a hot shimmer behind
    const h = (34 + jit * 20) * env * (s.r / 120) + 10;
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      const ox = (k - 1) * w * 0.32;
      const fl = 0.8 + 0.3 * Math.sin(s.t * 18 + i * 1.7 + k * 2.1);
      const hh = h * fl * (k === 1 ? 1 : 0.72);
      const gr = g.createLinearGradient(0, 0, 0, -hh);
      gr.addColorStop(0, "rgba(138,28,8,.9)");
      gr.addColorStop(0.45, "rgba(255,106,31,.85)");
      gr.addColorStop(1, "rgba(255,226,120,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(ox - w * 0.2, 0);
      g.quadraticCurveTo(ox - w * 0.28, -hh * 0.5, ox + Math.sin(s.t * 9 + i) * w * 0.06, -hh);
      g.quadraticCurveTo(ox + w * 0.28, -hh * 0.5, ox + w * 0.2, 0);
      g.closePath();
      g.fill();
    }
  } else if (s.style === "blizzard") {
    // a gust of snow leaning along the way the storm is turning: slanted streaks and flakes
    const h = (46 + jit * 22) * env * (s.r / 130) + 10;
    g.strokeStyle = "#ffffff";
    g.lineCap = "round";
    for (let k = 0; k < 4; k++) {
      const ox = (hs(i * 4 + k) - 0.5) * w;
      const ph = (s.t * 1.6 + hs(i + k)) % 1;
      g.globalAlpha = env * (0.55 + 0.4 * Math.sin(ph * Math.PI));
      g.lineWidth = 1.8 + (k % 2);
      g.beginPath();
      g.moveTo(ox - 8, -h * ph * 0.2);
      g.lineTo(ox + 14, -h * (0.35 + ph * 0.6));
      g.stroke();
    }
    g.fillStyle = "rgba(220,244,255,.35)";
    g.beginPath();
    g.ellipse(0, -h * 0.35, w * 0.55, h * 0.4, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#ffffff";
    for (let k = 0; k < 4; k++) {
      g.globalAlpha = env * 0.9;
      g.beginPath();
      g.arc((hs(i * 7 + k) - 0.5) * w * 1.4 + Math.sin(s.t * 5 + k) * 4, -((s.t * 40 + hs(k + i) * h) % h), 1.4 + hs(k) * 1.2, 0, TAU);
      g.fill();
    }
  } else {
    // diamond storm: faceted crystals hanging in the air, turning, with a glint
    const h = 22 + jit * 22;
    const turn = Math.cos(s.t * 5 + i);
    const cw = 7 + jit * 4;
    g.translate(0, -h * (0.6 + 0.4 * env));
    g.globalCompositeOperation = "lighter";
    g.fillStyle = i % 2 ? "rgba(168,216,255,.9)" : "rgba(234,248,255,.9)";
    g.beginPath();
    g.moveTo(0, -cw * 1.8);
    g.lineTo(cw * turn, 0);
    g.lineTo(0, cw * 1.8);
    g.lineTo(-cw * turn, 0);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,.95)";
    g.beginPath();
    g.moveTo(0, -cw * 1.8);
    g.lineTo(cw * 0.3 * turn, 0);
    g.lineTo(0, cw * 0.9);
    g.closePath();
    g.fill();
    const tw = Math.max(0, Math.sin(s.t * 9 + i * 2.3));
    g.strokeStyle = "#ffffff";
    g.lineWidth = 1.4;
    g.globalAlpha = env * tw;
    g.beginPath();
    g.moveTo(-cw * 1.6, 0);
    g.lineTo(cw * 1.6, 0);
    g.moveTo(0, -cw * 2.4);
    g.lineTo(0, cw * 2.4);
    g.stroke();
  }
  g.restore();
}

/* ------------------------------------------------------------------ pulses (shots) */

export const PULSE_MOVES = new Set(["waterpulse", "darkpulse", "dragonpulse", "originpulse"]);

const PULSE_PAL: Record<string, Pal & { rings: number }> = {
  waterpulse: { dk: "#124a98", md: "#3da0ff", lt: "#b8e8ff", core: "#ffffff", rings: 4 },
  darkpulse: { dk: "#1a0a38", md: "#8b5cf6", lt: "#d0a8ff", core: "#ff9ad8", rings: 4 },
  dragonpulse: { dk: "#2a2a8a", md: "#6a7aff", lt: "#9ad0ff", core: "#ffd05a", rings: 5 },
  originpulse: { dk: "#0a4a8a", md: "#3fd0ff", lt: "#d8f6ff", core: "#ffffff", rings: 5 },
};

/**
 * A pulse: a glowing core with rings of energy leaving it one after another, each a curved wavefront across the line of flight that
 * widens and fades as it falls behind. Drawn flat along the flight, so it turns with the camera like a shot does.
 */
export function drawPulse(g: G, mv: string, p: { x: number; y: number; vx: number; vy: number; r: number; id: number }, t: number) {
  const pal = PULSE_PAL[mv];
  if (!pal) return;
  const ang = Math.atan2(p.vy, p.vx);
  const r = Math.max(6, p.r);
  g.save();
  g.translate(p.x, p.y);
  g.rotate(ang);
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round";
  for (let k = 0; k < pal.rings; k++) {
    const ph = (t * 1.9 + k / pal.rings + hs(p.id) * 0.3) % 1;
    const back = ph * r * 8;
    const span = (0.55 + ph * 0.55) * Math.PI / 2 * 1.5;
    const rr = r * (1.25 + ph * 3.2);
    g.globalAlpha = (1 - ph) * 0.85;
    g.strokeStyle = k % 2 ? pal.lt : pal.md;
    g.lineWidth = Math.max(1.2, r * (0.62 - ph * 0.45));
    g.beginPath();
    g.arc(-back + rr * 0.7, 0, rr, Math.PI - span, Math.PI + span);
    g.stroke();
  }
  // the core
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2);
  gr.addColorStop(0, pal.core);
  gr.addColorStop(0.35, pal.lt);
  gr.addColorStop(0.7, pal.md);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha = 1;
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, r * 2, 0, TAU);
  g.fill();
  if (mv === "darkpulse") {
    g.globalCompositeOperation = "source-over";
    g.fillStyle = pal.dk;
    g.beginPath();
    g.arc(0, 0, r * 0.85, 0, TAU);
    g.fill();
  }
  g.restore();
}
