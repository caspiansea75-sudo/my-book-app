/**
 * The big Psychic moves, built from the nine energy layers of the reference sheet:
 *   core energy beam · wispy energy tendrils · source ground runes · distortion shockwave · ember debris particles
 *   anamorphic lens flare · impact plasma splash · atmospheric haze glow · trailing ribbon sparks
 * Each move weights them differently. Nothing here uses shadowBlur (it is slow on the big floor layer): glow is a wide faint stroke under a sharp one.
 * Everything draws in absolute world coordinates (see `at` in the renderer).
 */
import { lodN } from "./arena-lod";
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export type PsySig = { x: number; y: number; r: number; t: number; life: number; seed: number; mv?: string };
export const PSY_IDS = new Set(["psychic", "extrasensory", "futuresight", "photongeyser", "psychoboost", "psystrike"]);

type Look = {
  md: string; lt: string; core: string; acc: string; life: number;
  beam: number; rune: number; star: number; wave: number; splash: number; tend: number; rib: number; flare: number; haze: number; ember: number;
};
const LOOK: Record<string, Look> = {
  psychic: { md: "#c04aff", lt: "#f0a0ff", core: "#fff4ff", acc: "#5ad0ff", life: 2.3, beam: 0, rune: 1, star: 5, wave: 1, splash: 0.5, tend: 1, rib: 0.7, flare: 0.6, haze: 1, ember: 0.8 },
  extrasensory: { md: "#e04ae0", lt: "#ffb0f4", core: "#ffffff", acc: "#6ae0ff", life: 2.1, beam: 0, rune: 0.6, star: 6, wave: 1.4, splash: 0.3, tend: 0.7, rib: 1, flare: 1, haze: 0.8, ember: 0.6 },
  futuresight: { md: "#9a4aff", lt: "#d0a8ff", core: "#f6eeff", acc: "#ff7ad8", life: 3.0, beam: 0.22, rune: 1.4, star: 7, wave: 0.6, splash: 0.3, tend: 1, rib: 0.6, flare: 0.8, haze: 1.3, ember: 1, },
  photongeyser: { md: "#ff7ad8", lt: "#ffd0f2", core: "#ffffff", acc: "#9ad8ff", life: 2.4, beam: 0.34, rune: 0.7, star: 6, wave: 1, splash: 0.5, tend: 0.4, rib: 0.6, flare: 1.4, haze: 0.6, ember: 1 },
  psychoboost: { md: "#b83aff", lt: "#ee90ff", core: "#fff0ff", acc: "#ff8a5a", life: 2.4, beam: 0.15, rune: 0.5, star: 5, wave: 1.4, splash: 1.3, tend: 0.5, rib: 1.2, flare: 1, haze: 0.8, ember: 1.2 },
  psystrike: { md: "#a04aff", lt: "#e0a0ff", core: "#faf0ff", acc: "#5ad8ff", life: 2.1, beam: 0.12, rune: 0.4, star: 5, wave: 1, splash: 1, tend: 0.8, rib: 1.4, flare: 1, haze: 0.6, ember: 0.8 },
};
const lookOf = (s: PsySig) => LOOK[s.mv ?? "psychic"] ?? LOOK.psychic!;
export const psyLife = (mv: string) => (LOOK[mv] ?? LOOK.psychic!).life;

/** a carved glyph, one of five, chosen by index */
function glyph(g: G, i: number, a: number) {
  g.beginPath();
  const k = Math.floor(hs(i * 3.7) * 5);
  if (k === 0) { g.arc(0, 0, a * 0.7, 0, TAU); g.moveTo(0, -a); g.lineTo(0, a); }
  else if (k === 1) { g.moveTo(-a * 0.7, -a); g.lineTo(a * 0.7, -a); g.lineTo(0, a); g.closePath(); g.moveTo(0, -a * 0.2); g.lineTo(0, a * 0.5); }
  else if (k === 2) { g.moveTo(-a * 0.6, a); g.lineTo(0, -a); g.lineTo(a * 0.6, a); g.moveTo(-a * 0.4, a * 0.25); g.lineTo(a * 0.4, a * 0.25); g.moveTo(0, -a); g.lineTo(0, -a * 1.35); }
  else if (k === 3) { g.arc(-a * 0.4, 0, a * 0.5, -1.2, 1.2); g.arc(a * 0.4, 0, a * 0.5, Math.PI - 1.2, Math.PI + 1.2); }
  else { g.moveTo(-a, 0); g.lineTo(0, -a * 0.6); g.lineTo(a, 0); g.lineTo(0, a * 0.6); g.closePath(); g.moveTo(-a * 0.35, 0); g.lineTo(a * 0.35, 0); }
  const lw = g.lineWidth, ga = g.globalAlpha;
  g.lineWidth = lw * 3; g.globalAlpha = ga * 0.25; g.stroke();
  g.lineWidth = lw; g.globalAlpha = ga; g.stroke();
}

/** A ring with a faint wide stroke under a sharp one (a cheap glow). */
function ring(g: G, r: number, w: number, a: number, col: string) {
  g.strokeStyle = col;
  g.globalAlpha = a * 0.25; g.lineWidth = w * 3.4; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  g.globalAlpha = a; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
}

/** On the floor: the source runes, the distortion shockwaves, and the plasma splash with its residue. */
export function psyFlat(g: G, s: PsySig) {
  const L = lookOf(s);
  const u = Math.min(1, s.t / s.life);
  const R = s.r;
  g.save();
  g.translate(s.x, s.y);
  g.lineCap = "round"; g.lineJoin = "round";
  g.globalCompositeOperation = "lighter";

  // --- plasma splash: a ragged puddle of energy that flashes, then cools, with droplets thrown out
  if (L.splash > 0.05) {
    const a = sm(0, 0.03, u) * (1 - sm(0.12, 0.8, u)) * Math.min(1, L.splash);
    const grow = 0.55 + 0.45 * sm(0, 0.12, u);
    const N = 16;
    g.beginPath();
    for (let i = 0; i < N * 2; i++) {
      const an = (i / (N * 2)) * TAU, rr = R * 0.62 * grow * (i % 2 ? 0.45 + 0.15 * hs(i + s.seed) : 0.85 + 0.4 * hs(i * 2 + s.seed));
      const x = Math.cos(an) * rr, y = Math.sin(an) * rr * 0.86;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.globalAlpha = a * 0.55; g.fillStyle = L.md; g.fill();
    g.globalAlpha = a * 0.9; g.strokeStyle = L.lt; g.lineWidth = 1.6; g.stroke();
    const cg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.4);
    cg.addColorStop(0, "rgba(255,255,255,.95)"); cg.addColorStop(0.4, L.lt); cg.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a * sm(0, 0.02, u) * (1 - sm(0.05, 0.4, u)); g.fillStyle = cg; g.beginPath(); g.arc(0, 0, R * 0.4, 0, TAU); g.fill();
    // droplets flung out across the floor
    const dp = sm(0, 0.35, u);
    for (let i = 0; i < lodN(22, 10); i++) {
      const an = hs(i * 4 + s.seed) * TAU, d = R * (0.45 + 1.0 * hs(i + 70)) * (1 - Math.pow(1 - dp, 2));
      g.globalAlpha = (1 - sm(0.2, 0.6, u)) * 0.9 * Math.min(1, L.splash);
      g.fillStyle = i % 3 ? L.lt : L.acc;
      g.beginPath(); g.arc(Math.cos(an) * d, Math.sin(an) * d * 0.86, 1.2 + 2.6 * hs(i + 9), 0, TAU); g.fill();
    }
  }

  // --- source ground runes: a glowing disc with rings, a turning star and glyphs running round
  if (L.rune > 0.05) {
    const a = sm(0, 0.1, u) * (1 - sm(0.62, 0.98, u)) * Math.min(1, L.rune);
    const dg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.95);
    dg.addColorStop(0, "rgba(0,0,0,0)"); dg.addColorStop(0.55, L.md); dg.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a * 0.3; g.fillStyle = dg; g.beginPath(); g.arc(0, 0, R * 0.95, 0, TAU); g.fill();
    ring(g, R * 0.86, 2.6, a, L.lt);
    ring(g, R * 0.78, 1.3, a * 0.8, L.lt);
    ring(g, R * 0.42, 1.6, a * 0.8, L.lt);
    g.save();
    g.rotate(s.t * 0.3);
    g.strokeStyle = L.lt; g.lineWidth = 1.4; g.globalAlpha = a * 0.9;
    for (let i = 0, N36 = lodN(36, 18); i < N36; i++) { const an = (i / N36) * TAU; g.beginPath(); g.moveTo(Math.cos(an) * R * 0.78, Math.sin(an) * R * 0.78); g.lineTo(Math.cos(an) * R * (i % 3 ? 0.82 : 0.86), Math.sin(an) * R * (i % 3 ? 0.82 : 0.86)); g.stroke(); }
    g.rotate(-s.t * 0.75);
    // the star, drawn as one stroke {n/2}
    const n = L.star;
    g.globalAlpha = a; g.strokeStyle = L.core; g.lineWidth = 1.8;
    g.beginPath();
    for (let i = 0; i <= n; i++) { const an = ((i * 2) % n) / n * TAU; const x = Math.cos(an) * R * 0.74, y = Math.sin(an) * R * 0.74; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.stroke();
    g.restore();
    g.save();
    g.rotate(s.t * 0.55);
    g.strokeStyle = L.lt; g.lineWidth = 1.5;
    const nr = lodN(10, 6);
    for (let i = 0; i < nr; i++) {
      const an = (i / nr) * TAU;
      g.save(); g.translate(Math.cos(an) * R * 0.6, Math.sin(an) * R * 0.6); g.rotate(an + Math.PI / 2);
      g.globalAlpha = a * (0.55 + 0.45 * Math.sin(s.t * 8 + i * 2));
      glyph(g, i + Math.floor(s.seed), R * 0.045);
      g.restore();
    }
    g.restore();
  }

  // --- distortion shockwaves: expanding rings with a colour split at the edge, and a faint lens inside
  if (L.wave > 0.05) {
    for (let k = 0; k < 2; k++) {
      const p = Math.max(0, Math.min(1, (u - k * 0.11) / 0.5));
      if (p <= 0 || p >= 1) continue;
      const r0 = R * (0.2 + 1.2 * (1 - Math.pow(1 - p, 2)));
      const a = Math.pow(1 - p, 1.5) * Math.min(1, L.wave) * (k ? 0.7 : 1);
      const w = 6 * (1 - p) + 1.5;
      g.strokeStyle = L.acc; g.globalAlpha = a * 0.5; g.lineWidth = w;
      g.beginPath(); g.arc(2.4, 0, r0, 0, TAU); g.stroke();
      g.strokeStyle = L.md; g.globalAlpha = a * 0.55;
      g.beginPath(); g.arc(-2.4, 0, r0, 0, TAU); g.stroke();
      g.strokeStyle = "#fff"; g.globalAlpha = a * 0.6; g.lineWidth = Math.max(1, w * 0.4);
      g.beginPath(); g.arc(0, 0, r0, 0, TAU); g.stroke();
      const lg = g.createRadialGradient(0, 0, r0 * 0.7, 0, 0, r0);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(1, "rgba(255,255,255,.14)");
      g.globalAlpha = a; g.fillStyle = lg; g.beginPath(); g.arc(0, 0, r0, 0, TAU); g.fill();
    }
  }
  g.restore();
}

/** One wavering column: soft edges, a hot core and a few forked strands of lightning down its length. */
function beamCol(g: G, L: Look, w: number, h: number, t: number, seed: number, al: number) {
  const N = 16;
  const edge = (side: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) { const k = i / N; pts.push([side * w * (1 - 0.35 * k) * (1 + Math.sin(t * 14 + k * 9 + seed + side) * 0.08), -k * h]); }
    return pts;
  };
  const A = edge(-1), B = edge(1).reverse();
  const poly = (sc: number) => { g.beginPath(); A.forEach((p, i) => (i ? g.lineTo(p[0] * sc, p[1]) : g.moveTo(p[0] * sc, p[1]))); B.forEach((p) => g.lineTo(p[0] * sc, p[1])); g.closePath(); };
  const lg = g.createLinearGradient(0, 0, 0, -h);
  lg.addColorStop(0, L.lt); lg.addColorStop(0.5, L.md); lg.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha = al * 0.5; g.fillStyle = lg; poly(1.25); g.fill();
  g.globalAlpha = al * 0.85; g.fillStyle = L.lt; poly(0.62); g.fill();
  g.globalAlpha = al; g.fillStyle = L.core; poly(0.26); g.fill();
  // lightning strands, re-rolled a few times a second so they crackle
  const fl = Math.floor(t * 16);
  g.lineWidth = 1.5; g.strokeStyle = L.core;
  for (let s2 = 0; s2 < 3; s2++) {
    g.beginPath();
    let x = (s2 - 1) * w * 0.4;
    g.moveTo(x, 0);
    for (let i = 1; i <= 9; i++) { x += (hs(fl * 7 + i * 3 + s2 * 11 + seed) - 0.5) * w * 0.8; x = Math.max(-w * 1.3, Math.min(w * 1.3, x)); g.lineTo(x, -(i / 9) * h * 0.9); }
    g.globalAlpha = al * 0.25; g.lineWidth = 5; g.stroke();
    g.globalAlpha = al * 0.9; g.lineWidth = 1.4; g.stroke();
  }
}

/** The parts that stand up: beam, haze, tendrils, embers, ribbons and the lens flare. */
export function psyItems(s: PsySig, push: (x: number, y: number, dy: number, draw: (g: G) => void) => void) {
  const L = lookOf(s);
  const u = Math.min(1, s.t / s.life);
  const R = s.r;
  const fade = sm(0, 0.08, u) * (1 - sm(0.6, 1, u));

  // atmospheric haze: big soft puffs of tinted mist behind everything
  if (L.haze > 0.05 && fade > 0.01) {
    push(s.x, s.y, -0.3, (g) => {
      g.save(); g.translate(s.x, s.y); g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const an = hs(i * 5 + s.seed) * TAU, d = R * 0.5 * hs(i + 20);
        const px = Math.cos(an) * d + Math.sin(s.t * 0.6 + i) * 10, py = Math.sin(an) * d * 0.5 - R * 0.18 - sm(0, 1, u) * R * 0.3 * (0.5 + hs(i));
        const rr = R * (0.55 + 0.35 * hs(i + 40));
        const hg = g.createRadialGradient(px, py, 0, px, py, rr);
        hg.addColorStop(0, "rgba(190,90,255,.5)"); hg.addColorStop(0.6, "rgba(130,50,210,.2)"); hg.addColorStop(1, "rgba(80,20,150,0)");
        g.globalAlpha = fade * 0.4 * Math.min(1.2, L.haze); g.fillStyle = hg; g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill();
      }
      g.restore();
    });
  }

  // core energy beam
  if (L.beam > 0.05) {
    const grow = sm(0, 0.05, u), hold = 1 - sm(0.22, 0.55, u);
    if (hold > 0.01) push(s.x, s.y, 0.2, (g) => {
      g.save(); g.translate(s.x, s.y); g.globalCompositeOperation = "lighter";
      beamCol(g, L, R * L.beam * (0.6 + 0.4 * hold) * (1.4 - 0.4 * grow), 470 * grow, s.t, s.seed, hold);
      g.restore();
    });
  }

  // wispy energy tendrils curling up off the floor
  if (L.tend > 0.05 && fade > 0.01) {
    push(s.x, s.y, 0.4, (g) => {
      g.save(); g.translate(s.x, s.y); g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
      const n = lodN(Math.round(6 * L.tend + 2), 3);
      for (let i = 0; i < n; i++) {
        const a0 = hs(i * 6 + s.seed) * TAU, r0 = R * (0.25 + 0.45 * hs(i + 11)), H = R * (0.9 + 0.9 * hs(i + 31)) * sm(0, 0.25, u);
        const sp = 0.6 + hs(i + 3), ph = s.seed + i * 1.9;
        const pts: [number, number][] = [];
        for (let k = 0; k <= 14; k++) { const q = k / 14; pts.push([Math.cos(a0) * r0 * (1 - q * 0.4) + Math.sin(s.t * 2.4 * sp + q * 7 + ph) * R * 0.17 * q, Math.sin(a0) * r0 * 0.5 - q * H + Math.sin(s.t * 1.7 + q * 4 + ph) * 6 * q]); }
        const path = () => { g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); };
        g.strokeStyle = L.md; g.globalAlpha = fade * 0.2; g.lineWidth = 6; path(); g.stroke();
        g.strokeStyle = L.lt; g.globalAlpha = fade * 0.75; g.lineWidth = 1.5; path(); g.stroke();
      }
      g.restore();
    });
  }

  // trailing ribbon sparks: bright streaks spiralling out and up, thick at the head and tapering behind it
  if (L.rib > 0.05 && fade > 0.01) {
    push(s.x, s.y, 0.7, (g) => {
      g.save(); g.translate(s.x, s.y); g.globalCompositeOperation = "lighter"; g.lineCap = "round";
      const n = lodN(Math.round(3 + 2 * L.rib), 2);
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU + hs(i + s.seed) * 0.6, dir = i % 2 ? 1 : -1;
        const head = Math.min(1.1, s.t * (0.9 + 0.3 * hs(i + 8)) + i * 0.04);
        const SEG = lodN(14, 7);
        for (let k = 0; k < SEG; k++) {
          const q = head - (k / SEG) * 0.4; if (q < 0 || q > 1) continue;
          const q2 = head - ((k + 1) / SEG) * 0.4;
          const pos = (qq: number): [number, number] => { const an = a0 + dir * qq * 2.6, rr = R * (0.15 + 1.0 * qq); return [Math.cos(an) * rr, Math.sin(an) * rr * 0.5 - qq * R * 0.85]; };
          const p1 = pos(q), p2 = pos(Math.max(0, q2));
          const f = 1 - k / SEG;
          g.globalAlpha = fade * f * 0.9; g.strokeStyle = k < 2 ? L.core : f > 0.5 ? L.lt : L.md; g.lineWidth = 0.8 + f * 2.6;
          g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
        }
      }
      g.restore();
    });
  }

  // ember debris: small hot sparks drifting up
  if (L.ember > 0.05 && fade > 0.01) {
    push(s.x, s.y, 0.5, (g) => {
      g.save(); g.translate(s.x, s.y); g.globalCompositeOperation = "lighter";
      const n = lodN(Math.round(26 * L.ember), 6);
      for (let i = 0; i < n; i++) {
        const p = (s.t * (0.4 + 0.3 * hs(i + 2)) + hs(i * 3)) % 1;
        const x = (hs(i * 3 + 1) - 0.5) * R * 1.5 + Math.sin(s.t * 2 + i) * 8, y = -p * R * (0.6 + 0.9 * hs(i + 9)) + R * 0.05;
        g.globalAlpha = fade * (1 - p) * (0.5 + 0.5 * Math.sin(s.t * 12 + i));
        g.fillStyle = i % 3 === 0 ? "#ffb060" : i % 3 === 1 ? L.lt : "#ff7ad0";
        g.beginPath(); g.arc(x, y, 0.9 + 1.7 * hs(i + 5), 0, TAU); g.fill();
      }
      g.restore();
    });
  }

  // anamorphic lens flare: a long thin horizontal streak with a colour fringe, flashing at the moment of impact
  if (L.flare > 0.05) {
    const a = sm(0, 0.03, u) * (1 - sm(0.1, 0.42, u)) * Math.min(1.2, L.flare);
    if (a > 0.01) push(s.x, s.y, 0.9, (g) => {
      g.save(); g.translate(s.x, s.y - R * 0.12); g.globalCompositeOperation = "lighter";
      const W = R * (1.5 + 0.5 * L.flare);
      const mk = (col: string) => { const lg = g.createLinearGradient(-W, 0, W, 0); lg.addColorStop(0, "rgba(0,0,0,0)"); lg.addColorStop(0.35, col); lg.addColorStop(0.5, "#fff"); lg.addColorStop(0.65, col); lg.addColorStop(1, "rgba(0,0,0,0)"); return lg; };
      g.globalAlpha = a * 0.55; g.fillStyle = mk(L.acc); g.fillRect(-W, -4, W * 2, 3);
      g.fillStyle = mk(L.md); g.fillRect(-W, 1, W * 2, 3);
      g.globalAlpha = a; g.fillStyle = mk(L.lt); g.fillRect(-W * 0.7, -1, W * 1.4, 2);
      const cg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.36);
      cg.addColorStop(0, "rgba(255,255,255,.95)"); cg.addColorStop(0.3, L.lt); cg.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = a * 0.9; g.fillStyle = cg; g.beginPath(); g.arc(0, 0, R * 0.36, 0, TAU); g.fill();
      g.restore();
    });
  }
}
