/**
 * The Ocean arena's moving water, and the sheets of ice that freeze over it when an ice move lands.
 */
import { ARENA, type Frozen } from "@/lib/pokemon/arena-engine";
import { texPat } from "./arena-tex";
import { organic, smooth } from "./arena-shape";

type G = CanvasRenderingContext2D;
const { W, H } = ARENA;
const TAU = Math.PI * 2;
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** The whole floor as open water: rich layered texture, drifting light nets, crests and glints. Drawn over the painted sea floor. */
export function drawOcean(g: G, t: number) {
  g.save();
  g.beginPath();
  g.rect(0, 0, W, H);
  g.clip();
  // the texture at strength, and a second copy sliding the other way at another size
  g.globalAlpha = 0.5; g.globalCompositeOperation = "overlay";
  g.fillStyle = texPat(g, "water", t * 16, t * 7, 2.3, 0.3); g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.4; g.globalCompositeOperation = "soft-light";
  g.fillStyle = texPat(g, "water", -t * 11 + 60, t * 13, 1.37, 1.1); g.fillRect(0, 0, W, H);
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  // slow darker and lighter swells rolling across
  const sw = g.createLinearGradient(0, 0, W, H * 0.4);
  const ph = (t * 0.05) % 1;
  sw.addColorStop(0, "rgba(2,24,70,.16)"); sw.addColorStop(Math.min(1, ph), "rgba(120,210,255,.12)"); sw.addColorStop(1, "rgba(2,24,70,.16)");
  g.fillStyle = sw; g.fillRect(0, 0, W, H);
  // caustic threads and wave crests
  g.globalCompositeOperation = "lighter";
  g.lineWidth = 1.5;
  for (let k = 0; k < 18; k++) {
    g.strokeStyle = `rgba(170,235,255,${0.09 + 0.07 * Math.sin(t * 1.2 + k)})`;
    g.beginPath();
    const y0 = ((k + 0.5) / 18) * H;
    for (let x = 0; x <= W; x += 14) {
      const y = y0 + Math.sin(x * 0.02 + t * 1.1 + k * 1.7) * 9 + Math.sin(x * 0.05 - t * 0.8 + k) * 3.5;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.strokeStyle = "rgba(235,250,255,.2)";
  g.lineWidth = 2;
  for (let k = 0; k < 7; k++) {
    g.beginPath();
    const y0 = ((k + 0.3 + ((t * 0.04 + k * 0.37) % 1) * 0.4) / 7) * H;
    for (let x = 0; x <= W; x += 16) {
      const y = y0 + Math.sin(x * 0.011 + t * 0.6 + k * 2.1) * 16;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  // glints riding on the ripples
  g.globalCompositeOperation = "source-over";
  for (let i = 0; i < 46; i++) {
    const k = Math.max(0, Math.sin(t * 2.2 + i * 2.3));
    if (k < 0.25) continue;
    const x = hash(i * 7.1) * W + Math.sin(t * 0.3 + i) * 18, y = hash(i * 3.3) * H + Math.cos(t * 0.25 + i) * 12;
    g.globalAlpha = k * 0.85;
    g.strokeStyle = "#ffffff";
    g.lineWidth = 1.2;
    const s = 3 + k * 3;
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s * 0.7); g.lineTo(x, y + s * 0.7); g.stroke();
  }
  g.restore();
}

/** A sheet of ice floating on the water: a frosted pale slab with cracks, glints, a bright rim and a dark wet edge. `grow` is 0..1 while it spreads out. */
export function drawIceSheet(g: G, f: Frozen, t: number, grow = 1) {
  const r = f.r * (1 - Math.pow(1 - grow, 3));
  if (r < 3) return;
  const sd = f.id * 3.7;
  const blob = organic(f.x, f.y, r, r * 0.86, sd, 0.1, 0, 36);
  // the water around it goes dark and still
  g.save();
  smooth(g, organic(f.x, f.y, r * 1.1, r * 0.95, sd, 0.1, 0, 36));
  g.fillStyle = "rgba(6,30,70,.35)";
  g.fill();
  g.restore();
  g.save();
  smooth(g, blob);
  g.clip();
  const gr = g.createRadialGradient(f.x - r * 0.25, f.y - r * 0.3, 2, f.x, f.y, r);
  gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, "#dcf3ff"); gr.addColorStop(1, "#a6d6f2");
  g.fillStyle = gr;
  g.fillRect(f.x - r, f.y - r, r * 2, r * 2);
  g.globalAlpha = 0.2; g.globalCompositeOperation = "multiply";
  g.fillStyle = texPat(g, "ice", f.x, f.y, 0.9); g.fillRect(f.x - r, f.y - r, r * 2, r * 2);
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  // cracks running out from a few points
  g.lineCap = "round";
  for (let c = 0; c < 4; c++) {
    let x = f.x + (hash(sd + c) - 0.5) * r * 0.7, y = f.y + (hash(sd + c * 2) - 0.5) * r * 0.5;
    let a = hash(sd + c * 5) * TAU;
    g.strokeStyle = "rgba(90,150,200,.55)"; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { a += (hash(sd + c * 11 + s) - 0.5) * 1.1; x += Math.cos(a) * r * 0.2; y += Math.sin(a) * r * 0.17; g.lineTo(x, y); }
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 0.6; g.stroke();
  }
  // frost patches and glints
  for (let i = 0; i < 6; i++) {
    g.fillStyle = "rgba(255,255,255,.35)";
    g.beginPath(); g.ellipse(f.x + (hash(sd + i * 3) - 0.5) * r * 1.3, f.y + (hash(sd + i * 5) - 0.5) * r, r * (0.08 + hash(sd + i) * 0.1), r * 0.05, hash(i) * 3, 0, TAU); g.fill();
  }
  for (let i = 0; i < 4; i++) {
    const k = Math.max(0, Math.sin(t * 2.4 + i * 1.9 + sd));
    g.globalAlpha = k;
    const x = f.x + (hash(sd + i * 9) - 0.5) * r * 1.2, y = f.y + (hash(sd + i * 4) - 0.5) * r * 0.9;
    g.strokeStyle = "#fff"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.moveTo(x, y - 3); g.lineTo(x, y + 3); g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();
  // the bright rim of the sheet and a thin dark line under it
  g.save();
  smooth(g, blob);
  g.strokeStyle = "rgba(10,50,100,.55)"; g.lineWidth = 3.4; g.stroke();
  g.strokeStyle = "rgba(240,252,255,.95)"; g.lineWidth = 1.9; g.stroke();
  g.restore();
}
