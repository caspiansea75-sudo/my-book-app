/** Fight Showdown: the four backgrounds. Drawn with plain shapes, in the 1200 x 560 picture space, with a little parallax. */
import type { StageId } from "./sd-data";

export const VW = 1200;
export const VH = 560;
export const GROUND_Y = 470;

type G = CanvasRenderingContext2D;
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function sky(g: G, stops: [number, string][], y1 = VH) {
  const gr = g.createLinearGradient(0, 0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr;
  g.fillRect(0, 0, VW, VH);
}

/** Repeat something across the picture, scrolling at `par` of the camera speed. */
function band(cam: number, par: number, step: number, fn: (x: number, i: number) => void) {
  const off = (cam * par) % step;
  const first = Math.floor((cam * par) / step);
  for (let i = -1; i * step - off < VW + step; i++) fn(i * step - off, first + i);
}

function floor(g: G, gy: number, top: string, bottom: string) {
  const gr = g.createLinearGradient(0, gy - 70, 0, VH);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillRect(0, gy - 70, VW, VH - gy + 70);
}

function stadium(g: G, cam: number, gy: number, t: number) {
  sky(g, [[0, "#f08a52"], [0.45, "#ffc27a"], [1, "#fbe6b8"]]);
  // the great wall of the arena with its arches
  g.fillStyle = "#d9a46a";
  g.fillRect(0, 120, VW, 210);
  g.fillStyle = "#c28a52";
  g.fillRect(0, 120, VW, 14);
  band(cam, 0.22, 150, (x, i) => {
    g.fillStyle = "#b07a44";
    g.fillRect(x + 6, 134, 14, 196);
    g.fillStyle = "#7a4d2a";
    g.beginPath();
    g.arc(x + 80, 330, 48, Math.PI, 0);
    g.fill();
    if (i % 3 === 0) { g.fillStyle = ["#e8453c", "#2f6fd6", "#f2c230"][((i % 9) + 9) % 3 === 0 ? 0 : 1]!; g.fillRect(x + 30, 150, 100, 34); g.fillStyle = "rgba(255,255,255,.65)"; g.fillRect(x + 40, 160, 80, 6); }
  });
  // crowd: rows of cheering blobs
  const pal = ["#e8453c", "#2f6fd6", "#f2c230", "#3aa65a", "#9a4fd1", "#ee7bb0", "#ffffff", "#25c6c0"];
  for (let row = 0; row < 3; row++) {
    const y = 322 + row * 28 - (row === 2 ? 0 : 0);
    band(cam, 0.38 + row * 0.08, 34, (x, i) => {
      const h = hash(i * 7 + row * 31);
      const bob = Math.sin(t * (3 + h * 3) + i) * (h > 0.5 ? 4 : 1.5);
      g.fillStyle = pal[Math.floor(h * 8) % 8]!;
      g.fillRect(x - 11, y + 8 + bob, 22, 34);
      g.fillStyle = "#f3cf9e";
      g.beginPath();
      g.arc(x, y + bob, 12, 0, Math.PI * 2);
      g.fill();
      if (h > 0.82) { g.fillStyle = pal[Math.floor(h * 17) % 8]!; g.fillRect(x - 15, y - 34 + bob, 30, 20); }
    });
  }
  floor(g, gy, "#f3d9a8", "#caa56a");
  // checkered tiles with the ball emblem in the middle
  const cx = VW / 2 - (cam - 800) * 0.95;
  for (let r = 0; r < 6; r++) {
    const y0 = gy - 70 + r * r * 4.2 + r * 8, y1 = gy - 70 + (r + 1) * (r + 1) * 4.2 + (r + 1) * 8;
    const tw = 70 + r * 26;
    const off = (cam * 0.95) % (tw * 2);
    for (let x = -tw * 2 - off; x < VW + tw * 2; x += tw) {
      const k = Math.round((x + off) / tw + r);
      g.fillStyle = k % 2 === 0 ? "rgba(255,255,255,.28)" : "rgba(120,70,30,.14)";
      g.fillRect(x, y0, tw, Math.max(1, y1 - y0));
    }
  }
  g.save();
  g.translate(cx, gy + 26);
  g.scale(1, 0.22);
  g.fillStyle = "rgba(0,0,0,.18)";
  g.beginPath(); g.arc(0, 0, 232, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e0392f"; g.beginPath(); g.arc(0, 0, 220, Math.PI, 0); g.fill();
  g.fillStyle = "#f4f4f4"; g.beginPath(); g.arc(0, 0, 220, 0, Math.PI); g.fill();
  g.fillStyle = "#222"; g.fillRect(-220, -14, 440, 28);
  g.fillStyle = "#f4f4f4"; g.beginPath(); g.arc(0, 0, 54, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#222"; g.lineWidth = 12; g.stroke();
  g.restore();
}

function volcano(g: G, cam: number, gy: number, t: number) {
  sky(g, [[0, "#150404"], [0.5, "#5c1409"], [0.82, "#d6481a"], [1, "#f58a2a"]]);
  const vx = 600 - cam * 0.12;
  g.fillStyle = "#2a0d09";
  g.beginPath(); g.moveTo(vx - 520, 340); g.lineTo(vx - 70, 110); g.lineTo(vx + 70, 110); g.lineTo(vx + 520, 340); g.closePath(); g.fill();
  const glow = g.createRadialGradient(vx, 110, 10, vx, 110, 260);
  glow.addColorStop(0, `rgba(255,170,60,${0.75 + Math.sin(t * 5) * 0.12})`);
  glow.addColorStop(1, "rgba(255,80,20,0)");
  g.fillStyle = glow; g.fillRect(vx - 300, -150, 600, 520);
  g.fillStyle = "#ffb347"; g.beginPath(); g.ellipse(vx, 112, 70, 12, 0, 0, Math.PI * 2); g.fill();
  band(cam, 0.35, 190, (x, i) => {
    const h = 60 + hash(i) * 90;
    g.fillStyle = "#1c0907";
    g.beginPath(); g.moveTo(x, 360); g.lineTo(x + 60, 360 - h); g.lineTo(x + 100, 360 - h * 0.5); g.lineTo(x + 150, 360 - h * 0.9); g.lineTo(x + 190, 360); g.closePath(); g.fill();
  });
  for (let i = 0; i < 40; i++) {
    const h = hash(i * 3.3), x = (h * 1400 + t * 18 * (0.3 + hash(i))) % 1300 - 50;
    const y = VH - ((t * (40 + h * 70) + i * 77) % (VH + 60));
    g.fillStyle = `rgba(255,${150 + h * 90 | 0},60,${0.35 + h * 0.5})`;
    g.fillRect(x, y, 2 + h * 3, 2 + h * 3);
  }
  floor(g, gy, "#2d1612", "#120807");
  g.lineWidth = 3;
  band(cam, 0.95, 230, (x, i) => {
    g.strokeStyle = `rgba(255,${110 + Math.sin(t * 3 + i) * 40 | 0},30,${0.55 + Math.sin(t * 2 + i) * 0.2})`;
    g.beginPath(); g.moveTo(x, gy - 50); g.lineTo(x + 40, gy - 20); g.lineTo(x + 20, gy + 20); g.lineTo(x + 70, gy + 60); g.stroke();
  });
  const lava = g.createLinearGradient(0, VH - 30, 0, VH);
  lava.addColorStop(0, "rgba(255,120,30,0)"); lava.addColorStop(1, "rgba(255,160,40,.8)");
  g.fillStyle = lava; g.fillRect(0, VH - 30, VW, 30);
}

function harbor(g: G, cam: number, gy: number, t: number) {
  sky(g, [[0, "#2b1a4a"], [0.35, "#a8325e"], [0.62, "#ff6f61"], [0.78, "#ffb36b"], [1, "#ffd9a0"]]);
  const sx = 760 - cam * 0.05;
  const sun = g.createRadialGradient(sx, 300, 10, sx, 300, 230);
  sun.addColorStop(0, "rgba(255,240,200,1)"); sun.addColorStop(0.25, "rgba(255,200,120,.8)"); sun.addColorStop(1, "rgba(255,120,80,0)");
  g.fillStyle = sun; g.fillRect(sx - 240, 60, 480, 480);
  // the sea and the sun's glitter on it
  g.fillStyle = "#3b2552"; g.fillRect(0, 330, VW, 90);
  for (let i = 0; i < 14; i++) {
    const y = 336 + i * 6, w = 150 - i * 6 + Math.sin(t * 2 + i) * 14;
    g.fillStyle = `rgba(255,200,130,${0.55 - i * 0.03})`;
    g.fillRect(sx - w / 2, y, w, 2);
  }
  band(cam, 0.18, 360, (x, i) => {
    g.fillStyle = "#1f1230";
    g.fillRect(x + 40, 190, 10, 150); g.fillRect(x + 40, 190, 110, 8); g.fillRect(x + 140, 190, 6, 40);
    if (i % 2 === 0) { g.beginPath(); g.moveTo(x + 190, 340); g.lineTo(x + 330, 340); g.lineTo(x + 300, 292); g.lineTo(x + 220, 292); g.closePath(); g.fill(); g.fillRect(x + 240, 250, 40, 42); }
  });
  band(cam, 0.5, 120, (x, i) => {
    const h = hash(i * 5);
    g.fillStyle = ["#7a2f2f", "#2f5d7a", "#7a6a2f"][Math.floor(h * 3)]!;
    g.fillRect(x + 10, 392 - 36, 70, 36);
    if (h > 0.5) { g.fillStyle = ["#2f5d7a", "#7a2f2f", "#5d7a2f"][Math.floor(h * 3)]!; g.fillRect(x + 22, 392 - 70, 56, 34); }
  });
  floor(g, gy, "#8a5a3a", "#4a2c1a");
  g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 2;
  for (let r = 0; r < 7; r++) { const y = gy - 70 + r * r * 4.4 + r * 8; g.beginPath(); g.moveTo(0, y); g.lineTo(VW, y); g.stroke(); }
  band(cam, 0.95, 170, (x) => { g.beginPath(); g.moveTo(x, gy - 70); g.lineTo(x - 50, VH); g.stroke(); });
}

function forest(g: G, cam: number, gy: number, t: number) {
  sky(g, [[0, "#04081c"], [0.55, "#0d2740"], [1, "#16443f"]]);
  g.fillStyle = "#f4f1d8"; g.beginPath(); g.arc(300 - cam * 0.04, 120, 48, 0, Math.PI * 2); g.fill();
  const mg = g.createRadialGradient(300 - cam * 0.04, 120, 40, 300 - cam * 0.04, 120, 230);
  mg.addColorStop(0, "rgba(220,235,255,.35)"); mg.addColorStop(1, "rgba(220,235,255,0)");
  g.fillStyle = mg; g.fillRect(0, 0, VW, 400);
  const trees = (par: number, step: number, base: number, hmin: number, col: string) => band(cam, par, step, (x, i) => {
    const h = hmin + hash(i * 3 + par * 10) * hmin * 0.8;
    g.fillStyle = col;
    for (let k = 0; k < 4; k++) { const w = (step * 0.55) * (1 - k * 0.2); g.beginPath(); g.moveTo(x + step / 2 - w, base - k * h * 0.22); g.lineTo(x + step / 2, base - h * (0.4 + k * 0.2)); g.lineTo(x + step / 2 + w, base - k * h * 0.22); g.closePath(); g.fill(); }
    g.fillRect(x + step / 2 - 6, base - 10, 12, 24);
  });
  trees(0.18, 120, 380, 190, "#0a1c2a");
  trees(0.45, 170, 420, 260, "#06121c");
  for (let i = 0; i < 26; i++) {
    const h = hash(i * 9.1), x = (h * 1500 + Math.sin(t * 0.4 + i) * 40 - cam * 0.5 + 3000) % 1300 - 40;
    const y = 250 + hash(i * 2.2) * 220 + Math.sin(t * 0.8 + i * 2) * 14;
    const a = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 3));
    g.fillStyle = `rgba(210,255,120,${a})`; g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(210,255,120,${a * 0.18})`; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill();
  }
  floor(g, gy, "#1f4a38", "#0b1f19");
  band(cam, 0.95, 90, (x, i) => { g.fillStyle = "rgba(120,220,150,.18)"; const h = 10 + hash(i) * 14; g.fillRect(x, gy - 40 + hash(i * 3) * 80, 3, -h); });
  const mist = g.createLinearGradient(0, gy - 40, 0, gy + 40);
  mist.addColorStop(0, "rgba(200,230,255,0)"); mist.addColorStop(0.5, `rgba(200,230,255,${0.1 + Math.sin(t * 0.7) * 0.03})`); mist.addColorStop(1, "rgba(200,230,255,0)");
  g.fillStyle = mist; g.fillRect(0, gy - 40, VW, 80);
}

export function drawStage(g: G, id: StageId, cam: number, gy: number, t: number) {
  if (id === "volcano") volcano(g, cam, gy, t);
  else if (id === "harbor") harbor(g, cam, gy, t);
  else if (id === "forest") forest(g, cam, gy, t);
  else stadium(g, cam, gy, t);
}
