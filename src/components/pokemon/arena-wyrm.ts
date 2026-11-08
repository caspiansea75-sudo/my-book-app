/**
 * Dragon blasts, built like the "Draconic Prayer" and dragon-spirit sheets: a glowing low-poly dragon spirit coils up out of a runic ring,
 * frost cracks the floor, ice spikes push up round it, shards swirl, freezing mist rolls and glowing helical trails wind round the beast.
 * Draws in absolute world coordinates (see `at` in the renderer).
 */
import { decal } from "./arena-dusk";
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export type WyrmSig = { x: number; y: number; r: number; t: number; life: number; seed: number; mv: string; big: boolean };
export const WYRM_BIG = new Set(["dracometeor", "outrage", "roaroftime", "spacialrend", "eternabeam", "coreenforcer"]);
export const WYRM_IDS = new Set([...WYRM_BIG, "dragonpulse", "clangingscales"]);
const VIOLET = new Set(["spacialrend", "roaroftime", "outrage"]);
const pal = (s: WyrmSig) => (VIOLET.has(s.mv)
  ? { lt: "#f0d8ff", md: "#b070ff", body: "150,90,255", ice: "#d8c4ff", rune: { lt: "#e6d0ff", md: "#9a5cff" } }
  : { lt: "#d8fbff", md: "#40d8ff", body: "60,200,255", ice: "#bff4ff", rune: { lt: "#e0e8ff", md: "#8a78ff" } });

export function wyrmFlat(g: G, s: WyrmSig) {
  const p = pal(s);
  const u = Math.min(1, s.t / s.life), R = s.r * (s.big ? 1.15 : 0.9);
  const a = sm(0, 0.08, u) * (1 - sm(0.7, 1, u));
  g.save(); g.translate(s.x, s.y);
  // frost decal: a pale frozen disc with branching cracks
  const fg = g.createRadialGradient(0, 0, 0, 0, 0, R);
  fg.addColorStop(0, "rgba(170,230,255,.5)"); fg.addColorStop(0.7, "rgba(90,150,210,.35)"); fg.addColorStop(1, "rgba(60,110,170,0)");
  g.globalAlpha = a; g.fillStyle = fg; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
  g.strokeStyle = "rgba(225,245,255,.85)"; g.lineWidth = 1.5; g.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    let ang = hs(s.seed + i) * TAU, d = R * 0.08, x = Math.cos(ang) * d, y = Math.sin(ang) * d * 0.9;
    g.beginPath(); g.moveTo(x, y);
    const reach = R * (0.5 + 0.45 * hs(i + 30)) * sm(0, 0.2, u);
    while (d < reach) { d += R * 0.08; ang += (hs(s.seed + i * 9 + d) - 0.5) * 0.8; x = Math.cos(ang) * d; y = Math.sin(ang) * d * 0.9; g.lineTo(x, y); }
    g.stroke();
  }
  // the runic ring
  decal(g, R * 0.8 * (0.7 + 0.3 * sm(0, 0.12, u)), s.t, a, p.rune, s.seed, s.big);
  // cold refraction: pale rings rolling out
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 2; i++) { const k = sm(0, 0.55, u - i * 0.1); if (k <= 0 || k >= 1) continue; g.globalAlpha = (1 - k) * 0.4; g.strokeStyle = p.lt; g.lineWidth = 6 - k * 4; g.beginPath(); g.arc(0, 0, R * (0.3 + k * 1.1), 0, TAU); g.stroke(); }
  g.restore();
}

/** The dragon spirit: a coiling spine with a low-poly skin, glowing edge, horns, jaw and whiskers. */
function dragon(g: G, H: number, W: number, t: number, al: number, p: ReturnType<typeof pal>, seed: number) {
  const N = 26, spine: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    spine.push({ x: Math.sin(k * 4.6 + t * 1.6 + seed) * W * (0.5 + 0.5 * k) * (1 - k * 0.25), y: -k * H, w: W * 0.22 * (0.25 + 0.75 * Math.sin(Math.min(1, k * 1.06) * Math.PI * 0.92 + 0.15)) });
  }
  const side = (sg: number) => spine.map((q, i) => {
    const a = spine[Math.max(0, i - 1)]!, b = spine[Math.min(N, i + 1)]!;
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + sg * Math.PI / 2;
    return { x: q.x + Math.cos(ang) * q.w, y: q.y + Math.sin(ang) * q.w };
  });
  const L = side(-1), Rr = side(1);
  g.globalCompositeOperation = "lighter"; g.lineJoin = "round"; g.lineCap = "round";
  // glowing body
  g.beginPath(); L.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); for (let i = N; i >= 0; i--) g.lineTo(Rr[i]!.x, Rr[i]!.y); g.closePath();
  const bg = g.createLinearGradient(0, 0, 0, -H);
  bg.addColorStop(0, `rgba(${p.body},.18)`); bg.addColorStop(0.6, `rgba(${p.body},.5)`); bg.addColorStop(1, `rgba(${p.body},.7)`);
  g.globalAlpha = al; g.fillStyle = bg; g.fill();
  g.shadowColor = p.md; g.shadowBlur = 14; g.strokeStyle = p.lt; g.lineWidth = 2; g.globalAlpha = al * 0.9; g.stroke();
  g.shadowBlur = 0;
  // low-poly facets: cross lines and diagonals between the two edges
  g.lineWidth = 1; g.globalAlpha = al * 0.55; g.strokeStyle = p.lt;
  g.beginPath();
  for (let i = 0; i < N; i++) { g.moveTo(L[i]!.x, L[i]!.y); g.lineTo(Rr[i]!.x, Rr[i]!.y); g.moveTo(L[i]!.x, L[i]!.y); g.lineTo(Rr[i + 1]!.x, Rr[i + 1]!.y); }
  g.stroke();
  // spines along the back
  g.lineWidth = 1.6; g.beginPath();
  for (let i = 2; i < N - 1; i += 2) { const q = L[i]!, c = spine[i]!; g.moveTo(q.x, q.y); g.lineTo(q.x + (q.x - c.x) * 0.9, q.y + (q.y - c.y) * 0.9 - 4); }
  g.stroke();
  // the head, looking along the last stretch of the spine, jaw open
  const h = spine[N]!, n = spine[N - 2]!, ang = Math.atan2(h.y - n.y, h.x - n.x);
  g.save(); g.translate(h.x, h.y); g.rotate(ang);
  const hl = W * 0.32;
  g.globalAlpha = al; g.fillStyle = `rgba(${p.body},.55)`; g.strokeStyle = p.lt; g.lineWidth = 2; g.shadowColor = p.md; g.shadowBlur = 12;
  g.beginPath(); g.moveTo(-hl * 0.2, -hl * 0.28); g.lineTo(hl * 0.8, -hl * 0.2); g.lineTo(hl * 1.15, -hl * 0.06); g.lineTo(hl * 0.8, hl * 0.02); g.lineTo(hl * 0.1, hl * 0.12); g.lineTo(-hl * 0.2, hl * 0.28); g.closePath(); g.fill(); g.stroke();
  const open = 0.15 + 0.12 * Math.sin(t * 4);
  g.beginPath(); g.moveTo(hl * 0.1, hl * 0.1); g.lineTo(hl * 0.95, hl * (0.12 + open)); g.lineTo(hl * 0.7, hl * 0.14); g.stroke();
  g.beginPath(); g.moveTo(-hl * 0.1, -hl * 0.24); g.lineTo(-hl * 0.75, -hl * 0.65); g.moveTo(0, -hl * 0.2); g.lineTo(-hl * 0.55, -hl * 0.45); g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = "#fff"; g.beginPath(); g.arc(hl * 0.35, -hl * 0.1, hl * 0.06, 0, TAU); g.fill();
  g.lineWidth = 1.2; g.beginPath(); g.moveTo(hl * 1.05, -hl * 0.04); g.quadraticCurveTo(hl * 1.5, hl * 0.2 + Math.sin(t * 5) * 4, hl * 1.7, hl * 0.05); g.stroke();
  g.restore();
}

function crystal(g: G, x: number, y: number, h: number, w: number, lean: number, p: ReturnType<typeof pal>) {
  g.save(); g.translate(x, y);
  g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w * 0.45 + lean, -h * 0.7); g.lineTo(lean * 1.5, -h); g.lineTo(w * 0.5 + lean, -h * 0.65); g.lineTo(w, 0); g.closePath();
  const gg = g.createLinearGradient(-w, 0, w, 0);
  gg.addColorStop(0, "rgba(40,90,150,.9)"); gg.addColorStop(0.5, "rgba(150,220,255,.9)"); gg.addColorStop(1, "rgba(60,120,190,.9)");
  g.fillStyle = gg; g.fill(); g.strokeStyle = p.ice; g.lineWidth = 1.2; g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(lean * 1.5, -h); g.moveTo(-w * 0.45 + lean, -h * 0.7); g.lineTo(w * 0.1, -h * 0.3); g.strokeStyle = "rgba(255,255,255,.7)"; g.stroke();
  g.restore();
}

export function wyrmItems(s: WyrmSig, push: (x: number, y: number, dy: number, draw: (g: G) => void) => void) {
  const p = pal(s);
  const u = Math.min(1, s.t / s.life), R = s.r * (s.big ? 1.15 : 0.9);
  const grow = sm(0.03, 0.3, u), fade = 1 - sm(0.68, 1, u);
  // ground frost spikes ringing the circle; they thrust up fast and sink as the ice melts
  const ns = s.big ? 11 : 7;
  for (let i = 0; i < ns; i++) {
    const a = (i / ns) * TAU + hs(i + s.seed) * 0.3, rr = R * (0.72 + 0.2 * hs(i + 3));
    const px = s.x + Math.cos(a) * rr, py = s.y + Math.sin(a) * rr * 0.9;
    const k = sm(0.02 + hs(i) * 0.1, 0.2 + hs(i) * 0.1, u) * fade;
    if (k < 0.02) continue;
    const h = R * (0.22 + 0.3 * hs(i + 11)) * k, w = R * 0.05 * (0.6 + 0.4 * k);
    push(px, py, 0.4, (g) => { g.save(); g.globalAlpha = Math.min(1, fade * 1.2); crystal(g, px, py, h, w, (hs(i + 5) - 0.5) * w * 2, p); g.restore(); });
  }
  // freezing mist: low soft clouds rolling outwards
  push(s.x, s.y, -0.3, (g) => {
    g.save(); g.translate(s.x, s.y);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + s.t * 0.3, d = R * (0.35 + 0.5 * sm(0, 0.5, u)) * (0.8 + 0.3 * hs(i));
      const px = Math.cos(a) * d, py = Math.sin(a) * d * 0.45 - 6, rr = R * (0.2 + 0.12 * hs(i + 2));
      const mg = g.createRadialGradient(px, py, 0, px, py, rr);
      mg.addColorStop(0, "rgba(225,245,255,.6)"); mg.addColorStop(1, "rgba(160,210,240,0)");
      g.globalAlpha = fade * 0.8 * sm(0, 0.15, u); g.fillStyle = mg; g.beginPath(); g.ellipse(px, py, rr, rr * 0.6, 0, 0, TAU); g.fill();
    }
    g.restore();
  });
  // the dragon spirit and its glowing helical trails
  push(s.x, s.y, 0.6, (g) => {
    g.save(); g.translate(s.x, s.y - 6);
    const H = R * (s.big ? 1.6 : 1.2) * grow, W = R * (s.big ? 0.8 : 0.6);
    dragon(g, H, W, s.t, fade * Math.min(1, grow * 2), p, s.seed);
    g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    for (let k = 0; k < 2; k++) {
      g.beginPath(); g.strokeStyle = p.lt; g.shadowColor = p.md; g.shadowBlur = 10; g.lineWidth = 2.2 - k * 0.8; g.globalAlpha = fade * 0.75;
      for (let i = 0; i <= 40; i++) { const q = i / 40, a = q * 11 + s.t * 2.6 + k * Math.PI, r = R * (0.5 + 0.25 * Math.sin(q * 3 + s.t)); const x = Math.cos(a) * r, y = -q * H * 1.05 + Math.sin(a) * r * 0.25; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    g.restore();
  });
  // swirling ice shards
  const nh = s.big ? 22 : 14, ma = sm(0.05, 0.2, u) * fade;
  if (ma > 0.02) for (let i = 0; i < nh; i++) {
    const ph = (u * 1.8 + hs(i + s.seed)) % 1, ang = hs(i * 3) * TAU + s.t * (1.3 + hs(i)) * (i % 2 ? 1 : -1);
    const rad = R * (0.3 + 0.55 * hs(i + 20)), px = s.x + Math.cos(ang) * rad, py = s.y + Math.sin(ang) * rad * 0.4, hgt = 8 + ph * R * 1.4;
    push(px, py, Math.sin(ang) > 0 ? 0.7 : -0.7, (g) => {
      g.save(); g.translate(px, py - hgt); g.rotate(s.t * 3 + i); g.globalCompositeOperation = "lighter";
      const sz = (2.5 + 3.5 * hs(i + 8)) * (1 - ph * 0.4); g.globalAlpha = ma * Math.sin(ph * Math.PI); g.fillStyle = p.ice; g.shadowColor = p.md; g.shadowBlur = 8;
      g.beginPath(); g.moveTo(0, -sz * 1.8); g.lineTo(sz * 0.8, 0); g.lineTo(0, sz * 1.8); g.lineTo(-sz * 0.8, 0); g.closePath(); g.fill(); g.restore();
    });
  }
}
