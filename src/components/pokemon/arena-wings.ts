/**
 * Wing attacks, built like the "Sinister Moon Wing" sheet: a cylindrical ice-mesh wing arm with a fan of sharp serrated feathers,
 * a dark mist aura behind it, a core of crackling moonlight along the bone, stylised frost trails following the sweep,
 * crystal shards shed into the air and a ripple of refracted air. Both wings snap open and sweep forward.
 * Draws in the same space as the other melee pictures (centred on the attacker).
 */
import { fxBlur } from "./arena-lod";
type G = CanvasRenderingContext2D;
type Emit = (p: Record<string, unknown>) => void;
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export type WingFx = { ang: number; c1: string; c2: string; flav: string; seed: number };

export function drawWings(g: G, e: WingFx, cx: number, cy: number, R: number, p: number, t: number, emit: Emit) {
  const steel = e.flav === "steel";
  const mist = steel ? "46,52,64" : "40,22,90";
  const body = steel ? "rgba(22,28,40,.92)" : "rgba(8,14,46,.92)";
  const al = sm(0, 0.12, p) * (1 - sm(0.72, 1, p));
  const open = 2.25 - 1.65 * sm(0, 0.42, p) + 0.35 * sm(0.45, 1, p);
  const L = R * 3.4 * (0.45 + 0.55 * sm(0, 0.3, p));
  for (const side of [-1, 1]) {
    const a = e.ang + side * open;
    g.save(); g.translate(cx, cy); g.rotate(a); g.lineJoin = "round"; g.lineCap = "round";
    // the arm's curve: out from the shoulder, bowed backwards
    const P = (k: number): [number, number] => [k * L, -side * Math.sin(k * Math.PI * 0.95) * L * 0.2 * (side === -1 ? 1 : 1)];
    const tan = (k: number) => { const [x0, y0] = P(k - 0.01), [x1, y1] = P(k + 0.01); return Math.atan2(y1 - y0, x1 - x0); };
    // dark mist hanging round the wing
    g.globalCompositeOperation = "source-over";
    for (let i = 0; i < 7; i++) {
      const k = 0.1 + i * 0.13, [x, y] = P(k), rr = L * (0.2 + 0.05 * hs(i + e.seed));
      const mg = g.createRadialGradient(x, y + side * rr * 0.4, 0, x, y + side * rr * 0.4, rr);
      mg.addColorStop(0, `rgba(${mist},.55)`); mg.addColorStop(1, `rgba(${mist},0)`);
      g.globalAlpha = al; g.fillStyle = mg; g.beginPath(); g.arc(x, y + side * rr * 0.4, rr, 0, TAU); g.fill();
    }
    // feathers: a fan of serrated blades along the trailing side
    const nF = 9;
    for (let i = 0; i < nF; i++) {
      const k = 0.1 + (i / (nF - 1)) * 0.82, [bx, by] = P(k), ta = tan(k);
      const fa = ta + side * (0.5 + k * 0.35 + Math.sin(t * 9 + i) * 0.04), len = L * (0.85 - 0.45 * k) * (0.9 + 0.2 * hs(i + e.seed)), wd = L * 0.085;
      g.save(); g.translate(bx, by); g.rotate(fa);
      g.beginPath(); g.moveTo(0, -wd); g.lineTo(len * 0.55, -wd * 0.55); g.lineTo(len, 0); g.lineTo(len * 0.5, wd * 0.5); g.lineTo(0, wd); g.closePath();
      const fg = g.createLinearGradient(0, 0, len, 0);
      fg.addColorStop(0, body); fg.addColorStop(0.7, steel ? "rgba(70,84,104,.9)" : "rgba(20,40,110,.9)"); fg.addColorStop(1, steel ? "rgba(190,205,225,.95)" : "rgba(110,190,255,.95)");
      g.globalAlpha = al; g.fillStyle = fg; g.fill();
      g.globalCompositeOperation = "lighter"; g.strokeStyle = e.c2; g.lineWidth = 1.3; g.globalAlpha = al * 0.8; g.stroke();
      g.beginPath(); g.moveTo(len * 0.1, 0); g.lineTo(len * 0.95, 0); g.globalAlpha = al * 0.5; g.stroke();
      g.restore();
    }
    // the arm: a faceted ice-glass bone with spikes on its leading edge
    g.globalCompositeOperation = "source-over";
    g.beginPath();
    const N = 14, top: [number, number][] = [], bot: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N, [x, y] = P(k), ta = tan(k), w = R * 0.2 * Math.pow(1 - k, 0.8) + 1.5;
      top.push([x + Math.cos(ta - Math.PI / 2) * w, y + Math.sin(ta - Math.PI / 2) * w]); bot.push([x + Math.cos(ta + Math.PI / 2) * w, y + Math.sin(ta + Math.PI / 2) * w]);
    }
    top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (let i = N; i >= 0; i--) g.lineTo(bot[i]![0], bot[i]![1]); g.closePath();
    const ag = g.createLinearGradient(0, -R * 0.3, 0, R * 0.3);
    ag.addColorStop(0, steel ? "#8a98ac" : "#5a9ad8"); ag.addColorStop(0.5, steel ? "#2a3444" : "#16306a"); ag.addColorStop(1, steel ? "#aab6c8" : "#7fc0f0");
    g.globalAlpha = al; g.fillStyle = ag; g.fill();
    g.globalCompositeOperation = "lighter"; g.strokeStyle = e.c2; g.lineWidth = 1.4; g.globalAlpha = al * 0.9; g.stroke();
    g.lineWidth = 1; g.globalAlpha = al * 0.45; g.beginPath(); for (let i = 1; i < N; i += 2) { g.moveTo(top[i]![0], top[i]![1]); g.lineTo(bot[i + 1]![0], bot[i + 1]![1]); } g.stroke();
    // spikes on the leading edge
    g.fillStyle = e.c2; g.globalAlpha = al * 0.85;
    for (let i = 2; i < N; i += 2) { const [x, y] = top[i]!, ta = tan(i / N) - Math.PI / 2 - side * 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ta) * L * 0.1, y + Math.sin(ta) * L * 0.1); g.lineTo(x + Math.cos(ta + 1.2) * 4, y + Math.sin(ta + 1.2) * 4); g.closePath(); g.fill(); }
    // the core moonlight: a jagged bolt crawling along the bone
    g.shadowColor = e.c1; g.shadowBlur = fxBlur(8); g.strokeStyle = "#ffffff"; g.lineWidth = 1.3; g.globalAlpha = al;
    g.beginPath();
    for (let i = 0; i <= 22; i++) { const k = i / 22 * 0.95, [x, y] = P(k), j = (hs(i * 7 + Math.floor(t * 18) + side) - 0.5) * R * 0.22; i ? g.lineTo(x, y + j) : g.moveTo(x, y + j); }
    g.stroke();
    g.strokeStyle = e.c1; g.lineWidth = 2.5; g.globalAlpha = al * 0.4; g.stroke();
    g.shadowBlur = 0;
    g.restore();

    // frost trails: thin curved streaks left behind the sweeping wing tip
    g.save(); g.translate(cx, cy); g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const rr = L * (0.7 + 0.1 * i), a0 = a - side * (0.2 + 0.18 * i), a1 = a0 - side * (0.5 + 0.35 * sm(0, 0.5, p));
      g.strokeStyle = i % 2 ? e.c2 : e.c1; g.lineWidth = 1.5; g.globalAlpha = al * 0.5 * (1 - i * 0.18);
      g.beginPath(); g.arc(0, 0, rr, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
    }
    // refraction: a pale rippled arc sweeping with the wing
    g.strokeStyle = "rgba(235,245,255,.7)"; g.lineWidth = 6; g.globalAlpha = al * 0.12;
    g.beginPath(); g.arc(0, 0, L * 0.95, a - side * 0.9, a); g.stroke();
    g.restore();
    // crystal shards and wisps of dark mist shed from the tips
    if (Math.random() < 0.7 && p < 0.8) {
      const k = rnd(0.5, 1), [px, py] = P(k), c = Math.cos(a), s2 = Math.sin(a);
      const wx = cx + px * c - py * s2, wy = cy + px * s2 + py * c;
      emit({ kind: "spark", x: wx, y: wy, vx: rnd(-80, 80), vy: rnd(-90, 20), g: 90, life: rnd(0.5, 1), max: 1, size: rnd(2, 3.8), grow: 0, color: Math.random() < 0.5 ? e.c2 : "#9fc8ff" });
      if (Math.random() < 0.4) emit({ kind: "smoke", x: wx, y: wy, vx: rnd(-30, 30), vy: rnd(-40, -5), g: 0, life: rnd(0.6, 1), max: 1, size: rnd(8, 14), grow: 20, color: steel ? "#3a4252" : "#2a1a5a" });
    }
  }
}
