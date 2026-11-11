/**
 * Electro Ball, built like the "Thunder Whip Song" sheet: a white-hot glow core, lightning arcs crackling out of it,
 * electric sparks in yellow and cyan, a radial air shockwave ring with air distortion, and a purple ribbon trail behind.
 * `drawElectroBall` draws with the origin on the ball (drawShot has already translated there).
 */
import { fxBlur } from "./arena-lod";
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function arc(g: G, x0: number, y0: number, len: number, a: number, seed: number, depth: number) {
  // a forked jagged bolt: a main path with a couple of short branches
  let x = x0, y = y0, ang = a;
  g.moveTo(x, y);
  const n = 7;
  for (let i = 0; i < n; i++) {
    ang += (hs(seed + i * 3.7) - 0.5) * 1.1;
    const step = len / n * (0.8 + 0.4 * hs(seed + i));
    x += Math.cos(ang) * step; y += Math.sin(ang) * step;
    g.lineTo(x, y);
    if (depth > 0 && i > 1 && hs(seed + i * 11) > 0.62) { const sx = x, sy = y; arc(g, x, y, len * 0.4, ang + (hs(seed + i) > 0.5 ? 0.9 : -0.9), seed + i * 17, depth - 1); g.moveTo(sx, sy); }
  }
}

export function drawElectroBall(g: G, ang: number, r: number, age: number, t: number) {
  const R = Math.max(18, r * 1.7);
  const k = Math.min(1, age / 0.2);
  g.save();
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round"; g.lineJoin = "round";
  // the ribbon: a tapering purple-white streak that curls in behind the ball
  g.save(); g.rotate(ang + Math.PI);
  for (const [w, col, a] of [[R * 0.55, "rgba(120,80,255,.45)", 1], [R * 0.28, "rgba(190,170,255,.8)", 1], [R * 0.1, "#ffffff", 1]] as const) {
    g.strokeStyle = col; g.globalAlpha = a * k;
    const L = R * 6.5;
    g.beginPath();
    for (let i = 0; i <= 18; i++) { const q = i / 18; const x = q * L, y = Math.sin(q * 3 + t * 9) * R * 0.25 * q + q * q * R * 0.9; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    // draw as a taper by stroking short segments with shrinking width
    g.lineWidth = w; g.stroke();
  }
  g.restore();
  // radial air shockwave: pale wavering rings tilted round the ball, turning
  g.save(); g.rotate(ang + Math.sin(t * 2) * 0.2);
  for (let i = 0; i < 3; i++) {
    g.globalAlpha = 0.28 - i * 0.07; g.strokeStyle = "rgba(230,240,255,1)"; g.lineWidth = 3 - i * 0.7;
    g.beginPath(); g.ellipse(-R * 0.4, 0, R * (2.3 + i * 0.45), R * (0.85 + i * 0.25), t * (1.3 - i * 0.3), 0, TAU * 0.82); g.stroke();
  }
  g.restore();
  // lightning arcs, re-rolled many times a second so they crawl
  const frame = Math.floor(t * 20);
  g.shadowColor = "#7aa8ff"; g.shadowBlur = fxBlur(10);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + hs(frame + i) * 0.6;
    const len = R * (2.0 + 2.2 * hs(frame * 3 + i * 5));
    g.beginPath(); arc(g, Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3, len, a, frame * 7 + i * 13, 1);
    g.strokeStyle = "#8fb4ff"; g.lineWidth = 3; g.globalAlpha = 0.55; g.stroke();
    g.strokeStyle = "#ffffff"; g.lineWidth = 1.2; g.globalAlpha = 1; g.stroke();
  }
  g.shadowBlur = 0;
  // electric sparks flitting around in yellow and cyan
  for (let i = 0; i < 22; i++) {
    const a = hs(i) * TAU + t * (1 + hs(i + 2)), d = R * (0.9 + 1.9 * ((hs(i + 5) + t * 1.5) % 1));
    g.globalAlpha = 1 - (d / (R * 2.8)) * 0.6; g.fillStyle = i % 2 ? "#ffe66a" : "#7ae8ff";
    g.fillRect(Math.cos(a) * d - 1, Math.sin(a) * d - 1, 2.2, 2.2);
  }
  // the glow core: a white heart in a blue halo, pulsing
  const pulse = 1 + Math.sin(t * 30) * 0.06;
  const hg = g.createRadialGradient(0, 0, 0, 0, 0, R * 2.4 * pulse);
  hg.addColorStop(0, "rgba(255,255,255,1)"); hg.addColorStop(0.18, "rgba(210,230,255,.95)"); hg.addColorStop(0.45, "rgba(90,130,255,.55)"); hg.addColorStop(1, "rgba(60,60,255,0)");
  g.globalAlpha = 1; g.fillStyle = hg; g.beginPath(); g.arc(0, 0, R * 2.4 * pulse, 0, TAU); g.fill();
  g.restore();
}

/** The big burst where it lands: a flash, forked bolts in all directions, sparks and a shock ring. */
export function electroBoom(emit0: (p: Record<string, unknown>) => void, x: number, y: number, r: number) {
  const emit = (o: Record<string, unknown>) => emit0({ grow: 0, ...o });
  const R = Math.max(r, 70);
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  emit({ kind: "glow", x, y, vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, size: R * 0.4, grow: R * 1.7, color: "#ffffff" });
  emit({ kind: "glow", x, y, vx: 0, vy: 0, g: 0, life: 0.7, max: 0.7, size: R * 0.5, grow: R * 1.3, color: "#6f8cff" });
  emit({ kind: "ring", x, y, vx: 0, vy: 0, g: 0, life: 0.5, max: 0.5, size: 8, grow: R * 3.2, color: "#e8f0ff" });
  emit({ kind: "gring", x, y: y + 6, vx: 0, vy: 0, g: 0, life: 0.65, max: 0.65, size: 8, grow: R * 3.6, color: "#8fa8ff" });
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + rnd(-0.1, 0.1), d = R * rnd(0.8, 1.7); emit({ kind: "bolt", x, y, life: rnd(0.2, 0.4), max: 0.4, color: i % 2 ? "#ffffff" : "#9bb8ff", x2: x + Math.cos(a) * d, y2: y + Math.sin(a) * d * 0.7, seed: i * 17 }); }
  for (let i = 0; i < 36; i++) { const a = rnd(0, TAU), v = rnd(120, 520); emit({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 40, g: 200, life: rnd(0.35, 0.9), max: 0.9, size: rnd(1.6, 3.4), color: i % 2 ? "#ffe66a" : "#7ae8ff" }); }
}
