/**
 * Scenery for the Arena Brawl floors: forests and flowers on the grass, snow, pines and mountains on the ice,
 * basalt and lava on the crater, palms and tide lines on the coast, cacti and canyon walls on the dirt, glowing
 * mushrooms in the cave, torches and runes in the stone arena. Three parts:
 *   - dressBackground: painted once into the floor picture (ground details and the walls around the arena)
 *   - drawSceneObstacle: the trees, pines, ice boulders, basalt columns, palms and cacti that stand in the way
 *   - drawAmbient: things drifting over the whole arena (snow, embers, leaves, sparks, glints)
 */
import { ARENA, type Obstacle, type State, type StageKind } from "@/lib/pokemon/arena-engine";

const { W, H } = ARENA;
const PI2 = Math.PI * 2;
const M = 46; // the width of the band round the playing floor

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type G = CanvasRenderingContext2D;
type R = () => number;

const ell = (g: G, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) => {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, PI2);
  g.fill();
};
const glow = (g: G, x: number, y: number, r: number, c: string) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, c);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, PI2);
  g.fill();
};
/** Positions along the four sides of the band round the floor. */
function around(step: number, r: R, fn: (x: number, y: number, side: number) => void) {
  for (let x = -10; x < W + 10; x += step) {
    fn(x + (r() - 0.5) * step * 0.4, M * 0.45 + (r() - 0.5) * 14, 0);
    fn(x + (r() - 0.5) * step * 0.4, H - M * 0.45 + (r() - 0.5) * 14, 1);
  }
  for (let y = M; y < H - M; y += step) {
    fn(M * 0.45 + (r() - 0.5) * 14, y + (r() - 0.5) * step * 0.4, 2);
    fn(W - M * 0.45 + (r() - 0.5) * 14, y + (r() - 0.5) * step * 0.4, 3);
  }
}
const scatter = (r: R, n: number, fn: (x: number, y: number, i: number) => void) => {
  for (let i = 0; i < n; i++) fn(M + 20 + r() * (W - 2 * M - 40), M + 20 + r() * (H - 2 * M - 40), i);
};
/** Keep the middle of the pitch (the centre circle) clean enough to read. */
const nearCentre = (x: number, y: number, r = 90) => Math.hypot(x - W / 2, y - H / 2) < r;

/* =========================================================================== backgrounds */

export function dressBackground(kind: StageKind, c: HTMLCanvasElement) {
  const g = c.getContext("2d")!;
  const r = rng({ grass: 101, stone: 202, dirt: 303, crystal: 404, ice: 505, lava: 606, coast: 707 }[kind]);
  switch (kind) {
    case "grass": return forest(g, r);
    case "stone": return ruins(g, r);
    case "dirt": return canyon(g, r);
    case "crystal": return cave(g, r);
    case "ice": return snow(g, r);
    case "lava": return crater(g, r);
    case "coast": return beach(g, r);
  }
}

function treeCrown(g: G, x: number, y: number, rad: number, dark: string, mid: string, light: string, r: R) {
  ell(g, x + 3, y + rad * 0.5, rad * 1.05, rad * 0.45, "rgba(0,0,0,.28)");
  for (const [c, k] of [[dark, 1], [mid, 0.82], [light, 0.56]] as [string, number][]) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI2 + r();
      g.fillStyle = c;
      g.beginPath();
      g.arc(x + Math.cos(a) * rad * 0.42 * k, y + Math.sin(a) * rad * 0.34 * k - (1 - k) * rad * 0.2, rad * 0.62 * k + 2, 0, PI2);
      g.fill();
    }
  }
  g.fillStyle = "rgba(255,255,200,.25)";
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(x - rad * 0.25 + r() * rad * 0.5, y - rad * 0.35 + r() * rad * 0.3, 2 + r() * 2.5, 0, PI2); g.fill(); }
}

function forest(g: G, r: R) {
  // a winding dirt path
  g.strokeStyle = "rgba(122,92,56,.5)";
  g.lineWidth = 34;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(M, H * 0.72);
  g.bezierCurveTo(W * 0.3, H * 0.9, W * 0.45, H * 0.5, W * 0.62, H * 0.62);
  g.bezierCurveTo(W * 0.78, H * 0.72, W * 0.85, H * 0.35, W - M, H * 0.28);
  g.stroke();
  g.strokeStyle = "rgba(60,40,20,.25)";
  g.lineWidth = 2;
  g.setLineDash([6, 10]);
  g.stroke();
  g.setLineDash([]);
  // tall grass, clover and flowers
  scatter(r, 90, (x, y) => {
    if (nearCentre(x, y, 60)) return;
    g.strokeStyle = r() < 0.5 ? "#1f5a24" : "#7fcf55";
    g.lineWidth = 1.6;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 3, y); g.quadraticCurveTo(x + k * 5, y - 7, x + k * 8 + (r() - 0.5) * 4, y - 12 - r() * 5); g.stroke(); }
  });
  const petals = ["#ffe14d", "#ff9be6", "#ffffff", "#9bd8ff", "#ff7a7a"];
  scatter(r, 14, (x, y) => {
    if (nearCentre(x, y, 100)) return;
    const pc = petals[Math.floor(r() * petals.length)]!;
    for (let k = 0; k < 7; k++) {
      const fx = x + (r() - 0.5) * 46, fy = y + (r() - 0.5) * 30;
      g.strokeStyle = "#2c7a2e"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy + 6); g.stroke();
      g.fillStyle = pc;
      for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(fx + Math.cos(p * 1.256) * 2.6, fy + Math.sin(p * 1.256) * 2.6, 1.9, 0, PI2); g.fill(); }
      g.fillStyle = "#ffd84d"; g.beginPath(); g.arc(fx, fy, 1.5, 0, PI2); g.fill();
    }
  });
  // mushrooms, fallen logs and bushes
  scatter(r, 8, (x, y) => {
    if (nearCentre(x, y, 110)) return;
    ell(g, x, y + 5, 7, 2.5, "rgba(0,0,0,.25)");
    g.fillStyle = "#f2ead8"; g.fillRect(x - 1.6, y - 2, 3.2, 7);
    ell(g, x, y - 3, 7, 4.5, "#d6402e");
    g.fillStyle = "#fff"; for (const d of [-3, 0, 3]) { g.beginPath(); g.arc(x + d, y - 4 + Math.abs(d) * 0.3, 1.1, 0, PI2); g.fill(); }
  });
  for (let i = 0; i < 2; i++) {
    const x = 120 + r() * (W - 240), y = M + 40 + r() * (H - 2 * M - 80);
    if (nearCentre(x, y, 120)) continue;
    g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.6);
    ell(g, 2, 8, 34, 7, "rgba(0,0,0,.25)");
    g.fillStyle = "#6a4528"; g.beginPath(); g.roundRect(-34, -8, 68, 16, 8); g.fill();
    g.strokeStyle = "#3d2713"; g.lineWidth = 1.5; g.stroke();
    ell(g, 34, 0, 6, 8, "#c79a62"); g.strokeStyle = "#7a5530"; g.beginPath(); g.ellipse(34, 0, 3, 5, 0, 0, PI2); g.stroke();
    g.restore();
  }
  scatter(r, 10, (x, y) => {
    if (nearCentre(x, y, 120)) return;
    ell(g, x + 2, y + 7, 17, 5, "rgba(0,0,0,.25)");
    for (let k = 0; k < 4; k++) ell(g, x + (k - 1.5) * 8, y - (k % 2) * 4, 11, 9, k % 2 ? "#2f8a38" : "#3da04a");
    g.fillStyle = "#e0405a"; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x - 12 + r() * 24, y - 6 + r() * 8, 1.8, 0, PI2); g.fill(); }
  });
  // the forest wall round the pitch: two rows of crowns
  around(30, r, (x, y) => treeCrown(g, x, y, 25 + r() * 8, "#14451d", "#1f6a2a", "#3fa044", r));
  around(30, r, (x, y, side) => treeCrown(g, x + (side < 2 ? 14 : 0), y + (side < 2 ? (side ? -7 : 7) : 0), 17 + r() * 6, "#1b5a25", "#2a8a35", "#62c25a", r));
}

function ruins(g: G, r: R) {
  // moss and cracks
  scatter(r, 22, (x, y) => { if (!nearCentre(x, y, 80)) { ell(g, x, y, 14 + r() * 26, 6 + r() * 10, "rgba(70,120,60,.2)", r() * 3); } });
  g.strokeStyle = "rgba(8,12,22,.55)";
  g.lineWidth = 1.6;
  scatter(r, 16, (x, y) => { g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) g.lineTo(x + (r() - 0.5) * 70, y + (r() - 0.5) * 50); g.stroke(); });
  // a rune circle glowing in the centre
  g.save();
  g.translate(W / 2, H / 2);
  g.globalCompositeOperation = "lighter";
  for (const [rad, a] of [[170, 0.32], [150, 0.22]] as const) { g.strokeStyle = `rgba(120,190,255,${a})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, rad, 0, PI2); g.stroke(); }
  g.strokeStyle = "rgba(150,210,255,.4)";
  g.lineWidth = 2;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * PI2; g.beginPath(); g.moveTo(Math.cos(a) * 152, Math.sin(a) * 152); g.lineTo(Math.cos(a) * 168, Math.sin(a) * 168); g.stroke(); if (i % 3 === 0) { g.beginPath(); g.arc(Math.cos(a) * 138, Math.sin(a) * 138, 3, 0, PI2); g.stroke(); } }
  g.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI2 - Math.PI / 2; g.lineTo(Math.cos(a) * 120, Math.sin(a) * 120); }
  g.closePath(); g.stroke();
  g.restore();
  // the stands' wall: banners and torches
  const cols = ["#8a1f2e", "#1f4a8a", "#2a7a4a", "#8a6a1f"];
  for (let x = 90; x < W - 60; x += 130) {
    for (const y of [2, H - 40]) {
      g.fillStyle = cols[Math.floor(x / 130) % cols.length]!;
      g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x + 14, y); g.lineTo(x + 14, y + 34); g.lineTo(x, y + 26); g.lineTo(x - 14, y + 34); g.closePath(); g.fill();
      g.strokeStyle = "#e6d28a"; g.lineWidth = 1.5; g.stroke();
      ell(g, x, y + 13, 4, 4, "#e6d28a");
    }
  }
  for (const [x, y] of [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40], [W / 2, 22], [W / 2, H - 22]] as [number, number][]) {
    g.fillStyle = "#2b2f3a"; g.fillRect(x - 4, y - 2, 8, 20);
    g.fillStyle = "#44495a"; g.beginPath(); g.moveTo(x - 9, y - 2); g.lineTo(x + 9, y - 2); g.lineTo(x + 5, y + 6); g.lineTo(x - 5, y + 6); g.closePath(); g.fill();
    glow(g, x, y - 8, 30, "rgba(255,170,70,.45)");
    ell(g, x, y - 7, 4.5, 8, "#ffb04d"); ell(g, x, y - 5, 2.5, 5, "#fff2a0");
  }
}

function canyon(g: G, r: R) {
  // ripples of sand, cracked mud, bones and ruts
  g.lineWidth = 1.4;
  scatter(r, 60, (x, y) => { if (nearCentre(x, y, 60)) return; g.strokeStyle = r() < 0.5 ? "rgba(255,225,170,.25)" : "rgba(70,40,20,.22)"; g.beginPath(); g.arc(x, y, 14 + r() * 22, 3.4, 5.9); g.stroke(); });
  g.strokeStyle = "rgba(50,28,14,.45)"; g.lineWidth = 1.8;
  scatter(r, 12, (x, y) => { if (nearCentre(x, y, 100)) return; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { const nx = x + (r() - 0.5) * 50, ny = y + (r() - 0.5) * 36; g.lineTo(nx, ny); g.moveTo(nx, ny); g.lineTo(nx + (r() - 0.5) * 26, ny + (r() - 0.5) * 20); x = nx; y = ny; } g.stroke(); });
  g.strokeStyle = "rgba(60,36,18,.35)"; g.lineWidth = 3;
  for (const off of [-6, 6]) { g.beginPath(); g.moveTo(M, H * 0.3 + off); g.bezierCurveTo(W * 0.3, H * 0.2 + off, W * 0.55, H * 0.45 + off, W - M, H * 0.38 + off); g.stroke(); }
  scatter(r, 6, (x, y) => { if (nearCentre(x, y, 120)) return; g.save(); g.translate(x, y); g.rotate(r() * 3); g.fillStyle = "#efe6d2"; g.fillRect(-12, -2, 24, 4); ell(g, -12, 0, 4, 4, "#efe6d2"); ell(g, 12, 0, 4, 4, "#efe6d2"); g.restore(); });
  scatter(r, 14, (x, y) => { if (nearCentre(x, y, 70)) return; g.strokeStyle = "#8a7a3a"; g.lineWidth = 1.4; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 4, y - 9 - r() * 4); g.stroke(); } });
  scatter(r, 20, (x, y) => ell(g, x, y, 2 + r() * 3, 1.5 + r() * 2, r() < 0.5 ? "#8a6a4a" : "#b89a76"));
  // layered canyon walls
  const strata = ["#7a3a22", "#9a4a28", "#b8602e", "#8a4426", "#a85a30"];
  const wall = (side: number) => {
    const L = side < 2 ? W : H, d = side < 2 ? 46 : 46;
    for (let layer = 0; layer < 5; layer++) {
      g.fillStyle = strata[layer]!;
      g.beginPath();
      const rr = rng(layer * 31 + side * 7);
      const pts: [number, number][] = [];
      for (let u = -10; u <= L + 10; u += 24) pts.push([u, d * (0.55 + layer * 0.07) + (rr() - 0.5) * 12 - layer * 4]);
      const P = (u: number, v: number): [number, number] => (side === 0 ? [u, v] : side === 1 ? [u, H - v] : side === 2 ? [v, u] : [W - v, u]);
      const first = P(pts[0]![0], 0);
      g.moveTo(first[0], first[1]);
      for (const [u, v] of pts) { const q = P(u, v); g.lineTo(q[0], q[1]); }
      const last = P(pts[pts.length - 1]![0], 0);
      g.lineTo(last[0], last[1]);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(40,18,8,.35)"; g.lineWidth = 1.5; g.stroke();
    }
  };
  for (let s = 0; s < 4; s++) wall(s);
}

function cave(g: G, r: R) {
  // luminous veins and puddles
  g.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    let x = M + r() * (W - 2 * M), y = M + r() * (H - 2 * M);
    const pts: [number, number][] = [[x, y]];
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 100; y += (r() - 0.5) * 70; pts.push([x, y]); }
    for (const [w, c] of [[8, "rgba(120,80,255,.16)"], [3, "rgba(170,130,255,.5)"], [1.2, "rgba(230,215,255,.85)"]] as [number, string][]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    }
  }
  scatter(r, 6, (x, y) => { if (nearCentre(x, y, 200)) return; ell(g, x, y, 30 + r() * 24, 12 + r() * 8, "rgba(80,60,170,.22)"); ell(g, x - 8, y - 3, 14, 3, "rgba(200,190,255,.18)"); });
  // glowing mushrooms
  scatter(r, 16, (x, y) => {
    if (nearCentre(x, y, 190)) return;
    const c = r() < 0.5 ? "#59e6ff" : "#c98bff";
    glow(g, x, y - 4, 26, c.replace("#", "#") + "55");
    g.fillStyle = "#26224a"; g.fillRect(x - 1.5, y - 2, 3, 8);
    g.fillStyle = c; g.beginPath(); g.ellipse(x, y - 3, 8, 5, 0, Math.PI, 0); g.fill();
    g.fillStyle = "rgba(255,255,255,.8)"; for (const d of [-3, 2]) { g.beginPath(); g.arc(x + d, y - 5, 1.1, 0, PI2); g.fill(); }
  });
  // stalactites above and stalagmites below
  const spike = (x: number, y: number, h: number, w: number, dir: number) => {
    const gr = g.createLinearGradient(x, y, x, y + dir * h);
    gr.addColorStop(0, "#1a1730"); gr.addColorStop(1, "#4a4478");
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + (r() - 0.5) * 4, y + dir * h); g.lineTo(x + w, y); g.closePath(); g.fill();
    g.strokeStyle = "rgba(190,170,255,.4)"; g.lineWidth = 1; g.stroke();
  };
  for (let x = 0; x < W; x += 26) { spike(x + r() * 12, 0, 20 + r() * 44, 8 + r() * 8, 1); spike(x + r() * 12, H, 16 + r() * 34, 8 + r() * 7, -1); }
  for (let y = 0; y < H; y += 34) { spike(0, y + r() * 14, 14 + r() * 22, 8, 1); g.save(); g.translate(0, 0); g.restore(); }
  // crystal clusters in the four corners
  for (const [cx, cy] of [[22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]] as [number, number][]) {
    glow(g, cx, cy, 70, "rgba(150,110,255,.4)");
    for (let k = 0; k < 4; k++) {
      const a = r() * PI2, h = 22 + r() * 24;
      g.save(); g.translate(cx, cy); g.rotate(a);
      const lg = g.createLinearGradient(0, 0, 0, -h); lg.addColorStop(0, "#6b3fd0"); lg.addColorStop(1, "#d8c4ff");
      g.fillStyle = lg; g.beginPath(); g.moveTo(-6, 0); g.lineTo(0, -h); g.lineTo(6, 0); g.closePath(); g.fill();
      g.strokeStyle = "rgba(240,225,255,.8)"; g.lineWidth = 1; g.stroke();
      g.restore();
    }
  }
}

function peak(g: G, x: number, base: number, h: number, w: number, body: string, shade: string, cap: string) {
  g.fillStyle = body;
  g.beginPath(); g.moveTo(x - w, base); g.lineTo(x - w * 0.12, base - h * 0.92); g.lineTo(x, base - h); g.lineTo(x + w * 0.2, base - h * 0.86); g.lineTo(x + w, base); g.closePath(); g.fill();
  g.fillStyle = shade;
  g.beginPath(); g.moveTo(x, base - h); g.lineTo(x + w * 0.2, base - h * 0.86); g.lineTo(x + w, base); g.lineTo(x + w * 0.1, base); g.lineTo(x + w * 0.05, base - h * 0.5); g.closePath(); g.fill();
  g.fillStyle = cap;
  g.beginPath(); g.moveTo(x, base - h); g.lineTo(x - w * 0.12, base - h * 0.92); g.lineTo(x - w * 0.3, base - h * 0.66); g.lineTo(x - w * 0.12, base - h * 0.72); g.lineTo(x + w * 0.02, base - h * 0.62); g.lineTo(x + w * 0.17, base - h * 0.74); g.lineTo(x + w * 0.3, base - h * 0.68); g.lineTo(x + w * 0.2, base - h * 0.86); g.closePath(); g.fill();
}
function pineShape(g: G, x: number, y: number, s: number, snow: boolean) {
  ell(g, x + 2, y + 2, s * 0.5, s * 0.16, "rgba(0,0,0,.25)");
  g.fillStyle = "#4a3320"; g.fillRect(x - s * 0.06, y - s * 0.25, s * 0.12, s * 0.28);
  for (let k = 0; k < 3; k++) {
    const by = y - s * 0.18 - k * s * 0.32, w = s * (0.52 - k * 0.12);
    g.fillStyle = k % 2 ? "#1f5a46" : "#27704f";
    g.beginPath(); g.moveTo(x - w, by); g.lineTo(x, by - s * 0.5); g.lineTo(x + w, by); g.closePath(); g.fill();
    if (snow) { g.fillStyle = "#f4fbff"; g.beginPath(); g.moveTo(x - w * 0.55, by - s * 0.2); g.lineTo(x, by - s * 0.5); g.lineTo(x + w * 0.55, by - s * 0.2); g.quadraticCurveTo(x + w * 0.2, by - s * 0.08, x, by - s * 0.18); g.quadraticCurveTo(x - w * 0.2, by - s * 0.08, x - w * 0.55, by - s * 0.2); g.fill(); }
  }
}

function snow(g: G, r: R) {
  // frozen ponds, drifts and footprints
  scatter(r, 9, (x, y) => { if (nearCentre(x, y, 110)) return; ell(g, x, y, 28 + r() * 38, 12 + r() * 14, "rgba(190,235,255,.35)", r() * 0.6); ell(g, x - 6, y - 3, 16, 3, "rgba(255,255,255,.55)", -0.3); });
  scatter(r, 22, (x, y) => { if (nearCentre(x, y, 90)) return; ell(g, x + 4, y + 5, 26 + r() * 20, 8 + r() * 6, "rgba(90,140,190,.28)"); ell(g, x, y, 26 + r() * 20, 9 + r() * 6, "rgba(255,255,255,.8)"); });
  g.fillStyle = "rgba(70,110,160,.3)";
  for (let k = 0; k < 14; k++) { const x = W * 0.25 + k * 24, y = H * 0.62 + Math.sin(k * 0.7) * 20 + (k % 2) * 8; ell(g, x, y, 4, 2.4, "rgba(70,110,160,.3)", 0.2); }
  scatter(r, 30, (x, y) => { g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke(); });
  // pines round the sides and bottom
  around(34, r, (x, y, side) => { if (side !== 0) pineShape(g, x, y + 12, 44 + r() * 20, true); });
  // the mountain range along the top: two rows of peaks with snow caps
  for (let x = -20; x < W + 40; x += 110) peak(g, x + r() * 30, 58, 70 + r() * 30, 70 + r() * 20, "#7f9bbf", "#5d7aa0", "#e9f6ff");
  for (let x = 30; x < W + 40; x += 130) peak(g, x + r() * 30, 66, 52 + r() * 24, 62 + r() * 18, "#9db8d8", "#7893b6", "#ffffff");
  g.fillStyle = "rgba(255,255,255,.9)";
  for (let x = 0; x < W; x += 12) { g.beginPath(); g.ellipse(x, 62 + Math.sin(x * 0.07) * 3, 16, 7, 0, 0, PI2); g.fill(); }
  const gr = g.createLinearGradient(0, 66, 0, 96); gr.addColorStop(0, "rgba(255,255,255,.4)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 66, W, 30);
}

function crater(g: G, r: R) {
  // lava rivers, scorched ground and ash
  const river = (pts: [number, number][], w: number) => {
    g.lineCap = "round"; g.lineJoin = "round";
    for (const [lw, c] of [[w * 2.2, "rgba(255,70,10,.18)"], [w * 1.4, "rgba(255,110,20,.55)"], [w, "rgba(255,170,50,.85)"], [w * 0.4, "rgba(255,240,170,.95)"]] as [number, string][]) {
      g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
  };
  river([[M, 120], [160, 140], [240, 100], [330, 70], [420, M]], 12);
  river([[W - M, H - 130], [W - 170, H - 150], [W - 260, H - 100], [W - 340, H - 70], [W - 430, H - M]], 12);
  river([[M, H - 90], [110, H - 110], [170, H - M]], 7);
  scatter(r, 18, (x, y) => { if (nearCentre(x, y, 100)) return; ell(g, x, y, 20 + r() * 40, 8 + r() * 14, "rgba(10,5,5,.4)", r() * 3); });
  scatter(r, 40, (x, y) => { const k = r(); g.fillStyle = k < 0.5 ? "rgba(90,80,80,.5)" : "rgba(40,36,36,.6)"; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y + 3); g.lineTo(x - 4, y + 3); g.closePath(); g.fill(); });
  // the crater wall: dark rock with glowing seams, volcanoes on the horizon
  for (let x = -10; x < W + 20; x += 150) {
    const hx = x + r() * 50, h = 54 + r() * 26;
    g.fillStyle = "#2a1c1a"; g.beginPath(); g.moveTo(hx - 90, 56); g.lineTo(hx - 18, 56 - h); g.lineTo(hx + 18, 56 - h); g.lineTo(hx + 90, 56); g.closePath(); g.fill();
    g.fillStyle = "#3a2622"; g.beginPath(); g.moveTo(hx + 18, 56 - h); g.lineTo(hx + 90, 56); g.lineTo(hx + 30, 56); g.closePath(); g.fill();
    glow(g, hx, 56 - h, 34, "rgba(255,120,30,.7)");
    ell(g, hx, 56 - h, 16, 4, "#ffb04d");
    g.strokeStyle = "rgba(255,110,30,.9)"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(hx - 3, 56 - h); g.lineTo(hx - 24, 56 - h * 0.45); g.lineTo(hx - 18, 56); g.stroke();
    for (let k = 0; k < 4; k++) ell(g, hx + k * 6, 56 - h - 14 - k * 11, 10 + k * 5, 8 + k * 3, `rgba(70,60,60,${0.5 - k * 0.1})`);
  }
  around(24, r, (x, y, side) => { if (side === 0) return; g.fillStyle = "#1c1210"; g.beginPath(); g.moveTo(x - 16, y + 14); g.lineTo(x - 6, y - 14 - r() * 10); g.lineTo(x + 8, y - 8); g.lineTo(x + 18, y + 14); g.closePath(); g.fill(); g.strokeStyle = "rgba(255,100,30,.7)"; g.lineWidth = 1.4; g.stroke(); });
  g.fillStyle = "rgba(255,90,20,.12)"; g.fillRect(0, H - 60, W, 60);
}

function beach(g: G, r: R) {
  // tide lines, ripples in the sand, shells and starfish
  g.lineWidth = 2;
  for (let k = 0; k < 4; k++) { g.strokeStyle = `rgba(120,95,55,${0.22 - k * 0.04})`; g.beginPath(); g.moveTo(M, M + 60 + k * 14); for (let x = M; x <= W - M; x += 20) g.lineTo(x, M + 60 + k * 14 + Math.sin(x * 0.03 + k) * 6); g.stroke(); }
  g.strokeStyle = "rgba(150,120,70,.3)"; g.lineWidth = 1.2;
  scatter(r, 40, (x, y) => { if (nearCentre(x, y, 60)) return; g.beginPath(); g.moveTo(x - 18, y); g.quadraticCurveTo(x, y - 5, x + 18, y); g.stroke(); });
  scatter(r, 12, (x, y) => { if (nearCentre(x, y, 110)) return; g.fillStyle = "#ffd9c8"; g.strokeStyle = "#c98a6a"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 6); g.arc(x, y, 7, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x + k * 2.6, y - 6); g.stroke(); } });
  scatter(r, 6, (x, y) => { if (nearCentre(x, y, 120)) return; g.fillStyle = "#ff8a3d"; g.strokeStyle = "#a04a1a"; g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * PI2 - Math.PI / 2, rr = k % 2 ? 3.5 : 9; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke(); });
  scatter(r, 3, (x, y) => { if (nearCentre(x, y, 130)) return; g.save(); g.translate(x, y); g.rotate(r() * 3); ell(g, 2, 6, 34, 5, "rgba(0,0,0,.2)"); g.fillStyle = "#8a6a44"; g.beginPath(); g.roundRect(-34, -5, 68, 10, 5); g.fill(); g.strokeStyle = "#5a4228"; g.stroke(); g.restore(); });
  scatter(r, 8, (x, y) => { if (nearCentre(x, y, 100)) return; ell(g, x, y + 3, 7, 2.5, "rgba(0,0,0,.22)"); ell(g, x, y, 6, 4.5, "#e3523a"); g.strokeStyle = "#e3523a"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 6, y - 1); g.lineTo(x - 10, y - 5); g.moveTo(x + 6, y - 1); g.lineTo(x + 10, y - 5); g.stroke(); ell(g, x - 2, y - 4, 1, 1, "#111"); ell(g, x + 2, y - 4, 1, 1, "#111"); });
  scatter(r, 14, (x, y) => { if (nearCentre(x, y, 90)) return; g.strokeStyle = "#3f8a4a"; g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + k * 6, y - 8, x + k * 9, y - 14); g.stroke(); } });
  // the sea along the top with white surf, dunes along the bottom
  const sea = g.createLinearGradient(0, 0, 0, 74);
  sea.addColorStop(0, "#0f6f9a"); sea.addColorStop(0.6, "#2da7c8"); sea.addColorStop(1, "#8fe0e8");
  g.fillStyle = sea;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); for (let x = W; x >= 0; x -= 10) g.lineTo(x, 52 + Math.sin(x * 0.045) * 7 + Math.sin(x * 0.11) * 3); g.closePath(); g.fill();
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 4;
  g.beginPath(); for (let x = 0; x <= W; x += 10) { const y = 54 + Math.sin(x * 0.045) * 7 + Math.sin(x * 0.11) * 3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 2;
  for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x <= W; x += 14) { const y = 14 + k * 12 + Math.sin(x * 0.05 + k * 2) * 4; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  for (let x = -20; x < W + 20; x += 70) { ell(g, x + r() * 30, H - 22, 50, 20, "#e9d9a8"); ell(g, x + r() * 30 + 6, H - 28, 34, 11, "#f3e8c0"); }
  around(46, r, (x, y, side) => { if (side < 2) return; g.fillStyle = "#6f6a60"; g.beginPath(); g.moveTo(x - 18, y + 14); g.lineTo(x - 9, y - 12); g.lineTo(x + 12, y - 8); g.lineTo(x + 20, y + 14); g.closePath(); g.fill(); g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(x - 6, y - 9, 10, 3); });
}

/* =========================================================================== obstacles */

export function drawSceneObstacle(g: G, o: Obstacle, t: number): boolean {
  const flash = o.hit > 0;
  const sway = Math.sin(t * 1.4 + o.id) * 0.035;
  const R = o.r;
  switch (o.kind) {
    case "tree": {
      g.save(); g.translate(o.x, o.y);
      ell(g, 6, R * 0.55, R * 1.5, R * 0.55, "rgba(0,0,0,.34)");
      g.fillStyle = flash ? "#fff" : "#6a4426"; g.fillRect(-R * 0.26, -R * 0.9, R * 0.52, R * 1.6);
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(R * 0.05, -R * 0.9, R * 0.21, R * 1.6);
      g.translate(0, -R * 1.5); g.rotate(sway);
      const rr = rng(o.id * 13 + 1);
      for (const [c, k, dy] of [["#14532d", 1.1, 4], ["#1f7a3a", 0.95, 0], ["#34a853", 0.75, -4], ["#6fcf5a", 0.5, -7]] as [string, number, number][]) {
        for (let i = 0; i < 5; i++) { const a = (i / 5) * PI2 + rr(); g.fillStyle = flash ? "#fff" : c; g.beginPath(); g.arc(Math.cos(a) * R * 0.55 * k, Math.sin(a) * R * 0.42 * k + dy, R * 0.72 * k, 0, PI2); g.fill(); }
      }
      g.fillStyle = "rgba(255,255,190,.3)"; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(-R * 0.5 + rr() * R, -R * 0.7 + rr() * R * 0.5, 2.5, 0, PI2); g.fill(); }
      g.restore();
      return true;
    }
    case "pine": {
      g.save(); pineShape(g, o.x, o.y + R * 0.7, R * 3.0, true); if (flash) { g.globalAlpha = 0.5; pineShape(g, o.x, o.y + R * 0.7, R * 3.0, false); } g.restore();
      return true;
    }
    case "iceboulder": {
      g.save(); g.translate(o.x, o.y);
      ell(g, 4, R * 0.7, R * 1.2, R * 0.45, "rgba(20,50,90,.35)");
      const pts: [number, number][] = [[-1, 0.1], [-0.75, -0.55], [-0.2, -1.05], [0.5, -0.9], [1, -0.2], [0.85, 0.5], [0.1, 0.8], [-0.6, 0.65]];
      const lg = g.createLinearGradient(-R, -R, R, R); lg.addColorStop(0, "#e9fbff"); lg.addColorStop(0.5, "#8fd0f0"); lg.addColorStop(1, "#4f95cf");
      g.fillStyle = flash ? "#fff" : lg; g.strokeStyle = "#e8f8ff"; g.lineWidth = 2.5;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * R, y * R * 1.05) : g.moveTo(x * R, y * R * 1.05))); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.moveTo(-R * 0.75, -R * 0.55); g.lineTo(-R * 0.2, -R * 1.0); g.lineTo(0.05 * R, -R * 0.3); g.lineTo(-R * 0.5, -R * 0.05); g.closePath(); g.fill();
      g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-R * 0.1, -R * 0.1); g.lineTo(R * 0.4, R * 0.35); g.lineTo(R * 0.2, R * 0.7); g.moveTo(R * 0.4, R * 0.35); g.lineTo(R * 0.85, R * 0.1); g.stroke();
      g.restore();
      return true;
    }
    case "basalt": {
      g.save(); g.translate(o.x, o.y);
      ell(g, 4, R * 0.7, R * 1.3, R * 0.45, "rgba(0,0,0,.4)");
      glow(g, 0, R * 0.5, R * 1.7, `rgba(255,100,20,${0.35 + Math.sin(t * 3 + o.id) * 0.1})`);
      for (const [dx, h, w] of [[-R * 0.6, R * 1.0, R * 0.42], [R * 0.55, R * 1.2, R * 0.42], [0, R * 1.75, R * 0.5]] as [number, number, number][]) {
        g.fillStyle = flash ? "#fff" : "#2e2a2c"; g.strokeStyle = "#151112"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(dx - w, R * 0.6); g.lineTo(dx - w, R * 0.6 - h); g.lineTo(dx + w, R * 0.6 - h); g.lineTo(dx + w, R * 0.6); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = flash ? "#fff" : "#4a4346"; g.beginPath(); g.ellipse(dx, R * 0.6 - h, w, w * 0.4, 0, 0, PI2); g.fill(); g.stroke();
        g.strokeStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.moveTo(dx, R * 0.6 - h + w * 0.4); g.lineTo(dx, R * 0.6); g.stroke();
        g.fillStyle = "rgba(255,110,30,.8)"; g.fillRect(dx - w, R * 0.52, w * 2, 4);
      }
      g.restore();
      return true;
    }
    case "palm": {
      g.save(); g.translate(o.x, o.y);
      ell(g, 8, R * 0.6, R * 1.9, R * 0.5, "rgba(0,0,0,.28)");
      const topX = R * 0.7, topY = -R * 3.2;
      g.strokeStyle = flash ? "#fff" : "#8a6234"; g.lineWidth = R * 0.5; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, R * 0.6); g.quadraticCurveTo(-R * 0.3, -R * 1.4, topX, topY); g.stroke();
      g.strokeStyle = "rgba(60,36,14,.5)"; g.lineWidth = 2;
      for (let k = 1; k < 7; k++) { const u = k / 7; const px = (1 - u) * (1 - u) * 0 + 2 * (1 - u) * u * -R * 0.3 + u * u * topX, py = (1 - u) * (1 - u) * R * 0.6 + 2 * (1 - u) * u * -R * 1.4 + u * u * topY; g.beginPath(); g.moveTo(px - R * 0.25, py); g.lineTo(px + R * 0.25, py + 2); g.stroke(); }
      g.translate(topX, topY);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI2 + sway * 4, len = R * 2.5;
        g.save(); g.rotate(a);
        const lg = g.createLinearGradient(0, 0, len, 0); lg.addColorStop(0, "#2f8a3a"); lg.addColorStop(1, "#7fd04a");
        g.fillStyle = flash ? "#fff" : lg; g.strokeStyle = "#1c5a26"; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -R * 0.9, len, R * 0.45); g.quadraticCurveTo(len * 0.5, -R * 0.1, 0, 0); g.fill(); g.stroke();
        g.restore();
      }
      g.fillStyle = "#5a3a1a"; for (const [dx, dy] of [[-3, 4], [3, 5], [0, 8]]) { g.beginPath(); g.arc(dx, dy, 3.4, 0, PI2); g.fill(); }
      g.restore();
      return true;
    }
    case "cactus": {
      g.save(); g.translate(o.x, o.y);
      ell(g, 4, R * 0.6, R * 1.0, R * 0.38, "rgba(0,0,0,.3)");
      const body = flash ? "#fff" : "#3f9a4a";
      g.fillStyle = body; g.strokeStyle = "#1f5a2a"; g.lineWidth = 2;
      const arm = (x: number, y: number, h: number, w: number) => { g.beginPath(); g.roundRect(x - w, y - h, w * 2, h, w); g.fill(); g.stroke(); };
      arm(0, R * 0.6, R * 2.3, R * 0.42);
      g.beginPath(); g.roundRect(-R * 1.1, -R * 0.5, R * 0.7, R * 0.4, R * 0.2); g.fill(); g.stroke(); arm(-R * 0.9, -R * 0.2, R * 0.9, R * 0.22);
      g.beginPath(); g.roundRect(R * 0.35, -R * 0.9, R * 0.8, R * 0.4, R * 0.2); g.fill(); g.stroke(); arm(R * 0.95, -R * 0.6, R * 0.9, R * 0.22);
      g.strokeStyle = "rgba(20,70,30,.6)"; g.lineWidth = 1.2;
      for (const k of [-0.2, 0.2]) { g.beginPath(); g.moveTo(k * R, R * 0.55); g.lineTo(k * R, -R * 1.6); g.stroke(); }
      g.fillStyle = "#ff7aa8"; g.beginPath(); g.arc(0, -R * 1.7, 4, 0, PI2); g.fill(); g.fillStyle = "#ffe14d"; g.beginPath(); g.arc(0, -R * 1.7, 1.6, 0, PI2); g.fill();
      g.restore();
      return true;
    }
    default:
      return false;
  }
}

/* =========================================================================== ambient */

export function drawAmbient(g: G, S: State, t: number) {
  lights(g, S, t);
  g.save();
  switch (S.stage) {
    case "ice": {
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 90; i++) {
        const x = ((i * 97 + Math.sin(t * 0.7 + i) * 24 + t * 14) % (W + 40)) - 20;
        const y = ((i * 53 + t * (36 + (i % 5) * 9)) % (H + 20)) - 10;
        g.globalAlpha = 0.45 + (i % 4) * 0.12;
        g.beginPath(); g.arc(x, y, 1.1 + (i % 3) * 0.7, 0, PI2); g.fill();
      }
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 12; i++) { const x = (i * 211) % W, y = M + ((i * 131) % (H - 2 * M)); const k = Math.max(0, Math.sin(t * 2.4 + i * 1.9)); g.globalAlpha = k * 0.9; g.strokeStyle = "#ffffff"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke(); }
      break;
    }
    case "lava": {
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 46; i++) {
        const x = (i * 131 + Math.sin(t * 0.9 + i) * 18) % W;
        const y = H + 10 - ((t * (26 + (i % 6) * 9) + i * 71) % (H + 30));
        g.globalAlpha = 0.5 + 0.4 * Math.sin(t * 5 + i);
        glow(g, x, y, 5 + (i % 3) * 2, "rgba(255,150,40,.9)");
      }
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "#4a4040";
      for (let i = 0; i < 26; i++) { const x = ((i * 89 + t * 12) % (W + 20)) - 10, y = ((i * 61 + t * 22) % (H + 20)) - 10; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(x, y, 2.2, 1.2, i, 0, PI2); g.fill(); }
      break;
    }
    case "grass": {
      for (let i = 0; i < 16; i++) {
        const x = ((i * 151 + t * (16 + (i % 4) * 4)) % (W + 40)) - 20, y = M + ((i * 89 + Math.sin(t * 0.8 + i) * 30 + t * 8) % (H - 2 * M));
        g.save(); g.translate(x, y); g.rotate(t * 1.2 + i); g.globalAlpha = 0.75; g.fillStyle = i % 3 ? "#8fd45a" : "#e8c64a"; g.beginPath(); g.ellipse(0, 0, 5, 2.4, 0, 0, PI2); g.fill(); g.restore();
      }
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 14; i++) { const x = (i * 173 + Math.sin(t * 0.5 + i) * 40) % W, y = M + ((i * 97 + Math.cos(t * 0.4 + i) * 30) % (H - 2 * M)); glow(g, x, y, 7, `rgba(255,255,160,${0.25 + 0.35 * Math.max(0, Math.sin(t * 2 + i * 2))})`); }
      break;
    }
    case "coast": {
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 24; i++) { const x = (i * 197) % W, y = (i * 83) % (H - 2 * M) + M; const k = Math.max(0, Math.sin(t * 2.2 + i * 1.3)); g.globalAlpha = k * 0.8; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x, y, 1.6, 0, PI2); g.fill(); }
      g.globalCompositeOperation = "source-over";
      for (let k = 0; k < 2; k++) {
        const x = ((t * (24 + k * 9) + k * 480) % (W + 200)) - 100, y = 150 + k * 260 + Math.sin(t * 0.6 + k) * 18;
        g.globalAlpha = 0.18; g.strokeStyle = "#000"; g.lineWidth = 4; g.lineCap = "round";
        const fl = Math.sin(t * 6 + k) * 5;
        g.beginPath(); g.moveTo(x - 18, y - fl); g.quadraticCurveTo(x - 8, y - 6, x, y); g.quadraticCurveTo(x + 8, y - 6, x + 18, y - fl); g.stroke();
      }
      break;
    }
    case "dirt": {
      g.fillStyle = "#e0c090";
      for (let i = 0; i < 20; i++) { const x = ((i * 101 + t * (30 + (i % 4) * 10)) % (W + 80)) - 40, y = M + ((i * 67 + Math.sin(t + i) * 12) % (H - 2 * M)); g.globalAlpha = 0.16; g.beginPath(); g.ellipse(x, y, 26, 4, 0, 0, PI2); g.fill(); }
      const tx = ((t * 55) % (W + 240)) - 120, ty = H * 0.78 + Math.abs(Math.sin(t * 5)) * -12;
      g.globalAlpha = 0.55; g.strokeStyle = "#7a5a30"; g.lineWidth = 1.4; g.save(); g.translate(tx, ty); g.rotate(t * 6);
      for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(0, 0, 11, 8, k * 0.55, 0, PI2); g.stroke(); }
      g.restore();
      break;
    }
    case "crystal": {
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 30; i++) { const x = (i * 139 + Math.sin(t * 0.6 + i) * 22) % W, y = H - ((t * (10 + (i % 5) * 4) + i * 77) % H); g.globalAlpha = 0.45 + 0.4 * Math.sin(t * 2 + i); glow(g, x, y, 5, i % 2 ? "rgba(120,230,255,.9)" : "rgba(200,140,255,.9)"); }
      break;
    }
    case "stone": {
      g.globalCompositeOperation = "lighter";
      for (const [sx, sy] of [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40], [W / 2, 22], [W / 2, H - 22]] as [number, number][]) {
        glow(g, sx, sy - 8, 34 + Math.sin(t * 9 + sx) * 4, "rgba(255,170,70,.22)");
        for (let k = 0; k < 3; k++) { const ph = (t * 0.8 + k / 3 + sx * 0.01) % 1; g.globalAlpha = 1 - ph; glow(g, sx + Math.sin(ph * 6 + k) * 6, sy - 10 - ph * 40, 3, "rgba(255,200,100,.95)"); }
      }
      g.fillStyle = "#cfd8f0";
      for (let i = 0; i < 20; i++) { g.globalAlpha = 0.12 + 0.1 * Math.sin(t + i); g.beginPath(); g.arc((i * 151 + t * 6) % W, M + ((i * 89 + t * 4) % (H - 2 * M)), 1.4, 0, PI2); g.fill(); }
      break;
    }
  }
  g.restore();
}


/* =========================================================================== glows and light */

const soft = (g: G, x: number, y: number, r: number, c: string, a: number) => {
  g.globalAlpha = a;
  glow(g, x, y, r, c);
};

/** Light that sits on the floor and on the scenery: it breathes, drifts and sparkles. Everything here is additive. */
function lights(g: G, S: State, t: number) {
  g.save();
  g.globalCompositeOperation = "lighter";
  // halos round glowing scenery
  for (const o of S.obs) {
    if (o.hp <= 0) continue;
    const p = 0.65 + 0.35 * Math.sin(t * 2.2 + o.id);
    if (o.kind === "iceboulder") {
      soft(g, o.x, o.y - o.r * 0.2, o.r * 2.6, "rgba(130,220,255,.55)", 0.5 * p);
      const k = Math.max(0, Math.sin(t * 3 + o.id * 2));
      g.globalAlpha = k; g.strokeStyle = "#fff"; g.lineWidth = 1.6; const sx = o.x - o.r * 0.3, sy = o.y - o.r * 0.7;
      g.beginPath(); g.moveTo(sx - 7, sy); g.lineTo(sx + 7, sy); g.moveTo(sx, sy - 7); g.lineTo(sx, sy + 7); g.stroke();
    } else if (o.kind === "basalt") soft(g, o.x, o.y + o.r * 0.4, o.r * 2.8, "rgba(255,110,30,.6)", 0.55 * p);
    else if (o.kind === "crystal") soft(g, o.x, o.y - 10, o.r * 3.2, "rgba(170,120,255,.7)", 0.8 * p);
    else if (o.kind === "tree") soft(g, o.x - 6, o.y - o.r * 1.9, o.r * 1.5, "rgba(255,255,170,.35)", 0.3 + 0.2 * Math.sin(t * 0.9 + o.id));
    else if (o.kind === "palm") soft(g, o.x + o.r * 0.7, o.y - o.r * 3.2, o.r * 2.2, "rgba(255,245,170,.35)", 0.35);
    else if (o.kind === "pine") soft(g, o.x, o.y - o.r * 1.3, o.r * 2.2, "rgba(210,240,255,.4)", 0.3 * p);
  }
  for (const h of S.holes) {
    if (S.stage === "lava") {
      const p = 0.7 + 0.3 * Math.sin(t * 2.6);
      soft(g, h.x, h.y, h.rx * 2.1, "rgba(255,110,20,.7)", 0.8 * p);
      soft(g, h.x, h.y, h.rx * 1.1, "rgba(255,220,120,.7)", 0.4 * p);
      // bubbles popping on the lava
      for (let i = 0; i < 7; i++) {
        const ph = (t * 0.7 + i * 0.37) % 1, a = i * 2.4 + Math.floor(t * 0.7 + i * 0.37) * 1.7;
        const bx = h.x + Math.cos(a) * h.rx * 0.7 * ((i % 3) / 3 + 0.2), by = h.y + Math.sin(a) * h.ry * 0.7 * ((i % 3) / 3 + 0.2);
        g.globalAlpha = Math.sin(ph * Math.PI) * 0.9; g.strokeStyle = "#ffe9a0"; g.lineWidth = 2; g.beginPath(); g.ellipse(bx, by, 3 + ph * 9, (3 + ph * 9) * 0.6, 0, 0, PI2); g.stroke();
      }
      // a plume of sparks now and then
      for (let i = 0; i < 12; i++) {
        const ph = (t * 0.9 + i * 0.083) % 1; const a = i * 0.9;
        g.globalAlpha = (1 - ph) * 0.9;
        glow(g, h.x + Math.cos(a) * h.rx * 0.4 * ph * 2, h.y - ph * 90 + Math.sin(a) * 8, 3.5, "rgba(255,190,70,1)");
      }
    } else if (S.stage === "crystal") {
      // the pit: stars spiralling in and the occasional shooting star
      for (let i = 0; i < 18; i++) {
        const a = t * (0.5 + (i % 4) * 0.12) + i * 0.35, k = ((t * 0.12 + i * 0.057) % 1);
        g.globalAlpha = Math.sin(k * Math.PI) * 0.9;
        glow(g, h.x + Math.cos(a) * h.rx * (1 - k) * 0.95, h.y + Math.sin(a) * h.ry * (1 - k) * 0.95, 4, i % 2 ? "rgba(150,220,255,1)" : "rgba(210,160,255,1)");
      }
      const ph = (t * 0.35) % 1;
      g.globalAlpha = Math.sin(ph * Math.PI);
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.moveTo(h.x - h.rx * 0.6 + ph * h.rx * 1.2, h.y - h.ry * 0.5 + ph * h.ry); g.lineTo(h.x - h.rx * 0.6 + ph * h.rx * 1.2 - 24, h.y - h.ry * 0.5 + ph * h.ry - 8); g.stroke();
      soft(g, h.x, h.y, h.rx * 1.3, "rgba(110,90,255,.5)", 0.25 + 0.1 * Math.sin(t * 1.8));
    }
  }
  for (const v of S.vents ?? []) {
    const hot = S.zones.some((z) => !z.struck && Math.hypot(z.x - v.x, z.y - v.y) < 4);
    soft(g, v.x, v.y, hot ? 80 : 46, "rgba(255,120,30,.8)", hot ? 0.9 : 0.35 + 0.15 * Math.sin(t * 4 + v.x));
    for (let i = 0; i < (hot ? 7 : 3); i++) { const ph = (t * 1.3 + i * 0.31 + v.x) % 1; g.globalAlpha = (1 - ph) * 0.9; glow(g, v.x + Math.sin(ph * 9 + i) * 8, v.y - ph * (hot ? 80 : 44), 3 + (hot ? 2 : 0), "rgba(255,200,90,1)"); }
  }
  for (const p of S.pools) if (S.stage === "coast" || S.stage === "grass") {
    // caustics: light webs wobbling over the water and sparkles riding on it
    g.save();
    g.beginPath(); g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, PI2); g.clip();
    g.strokeStyle = "rgba(220,250,255,.5)"; g.lineWidth = 1.4; g.globalAlpha = 0.5;
    for (let i = 0; i < 7; i++) { g.beginPath(); for (let k = 0; k <= 12; k++) { const u = k / 12; const x = p.x - p.rx + u * p.rx * 2, y = p.y - p.ry * 0.8 + (i / 6) * p.ry * 1.6 + Math.sin(u * 9 + t * 1.6 + i * 1.3) * 7; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    for (let i = 0; i < 9; i++) { const k = Math.max(0, Math.sin(t * 2.6 + i * 2.1)); g.globalAlpha = k; glow(g, p.x + Math.cos(i * 2.4) * p.rx * 0.7, p.y + Math.sin(i * 3.1) * p.ry * 0.6, 5, "rgba(255,255,255,1)"); }
    g.restore();
  }
  switch (S.stage) {
    case "grass": {
      // sunbeams through the leaves, and soft patches of light sliding over the ground
      for (let i = 0; i < 4; i++) {
        const x0 = 150 + i * 220 + Math.sin(t * 0.35 + i) * 24;
        g.globalAlpha = 0.12 + 0.05 * Math.sin(t * 0.8 + i * 2);
        const gr = g.createLinearGradient(x0, 0, x0 + 150, H); gr.addColorStop(0, "rgba(255,250,190,1)"); gr.addColorStop(1, "rgba(255,250,190,0)");
        g.fillStyle = gr; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 70, 0); g.lineTo(x0 + 250, H); g.lineTo(x0 + 120, H); g.closePath(); g.fill();
      }
      for (let i = 0; i < 9; i++) soft(g, (i * 211 + t * 9) % W, M + ((i * 137 + Math.sin(t * 0.3 + i) * 40 + 600) % (H - 2 * M)), 50, "rgba(255,255,170,.7)", 0.1);
      break;
    }
    case "ice": {
      // an aurora curtain above the peaks
      for (let b = 0; b < 3; b++) {
        const col = ["rgba(90,255,190,", "rgba(110,200,255,", "rgba(190,130,255,"][b]!;
        for (let x = 0; x <= W; x += 16) {
          const y = 34 + b * 7 + Math.sin(x * 0.014 + t * 0.7 + b * 1.7) * 14 + Math.sin(x * 0.04 - t * 0.5) * 5;
          const h = 22 + Math.sin(x * 0.02 + t * 0.9 + b) * 10;
          const gr = g.createLinearGradient(0, y - h, 0, y + 10);
          gr.addColorStop(0, col + "0)"); gr.addColorStop(0.7, col + "0.48)"); gr.addColorStop(1, col + "0)");
          g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(x, y - h, 17, h + 10);
        }
      }
      // diamond dust glittering on the ice and a cold mist along the floor
      for (let i = 0; i < 26; i++) { const k = Math.max(0, Math.sin(t * 3 + i * 1.7)); g.globalAlpha = k; glow(g, (i * 233) % W, M + ((i * 149) % (H - 2 * M)), 6, "rgba(220,245,255,1)"); }
      for (let i = 0; i < 6; i++) soft(g, ((i * 190 + t * 18) % (W + 200)) - 100, H - 90 + Math.sin(t * 0.5 + i) * 20, 110, "rgba(220,240,255,.8)", 0.1);
      break;
    }
    case "lava": {
      g.globalAlpha = 0.5 + 0.25 * Math.sin(t * 1.6);
      const gr = g.createLinearGradient(0, H, 0, H - 150); gr.addColorStop(0, "rgba(255,90,20,.35)"); gr.addColorStop(1, "rgba(255,60,0,0)"); g.fillStyle = gr; g.fillRect(0, H - 150, W, 150);
      for (const [rx, ry] of [[240, 100], [W - 260, H - 100], [110, H - 110]] as [number, number][]) { soft(g, rx, ry, 70, "rgba(255,140,40,.9)", 0.4 + 0.2 * Math.sin(t * 3 + rx)); const ph = (t * 0.8 + rx) % 1; g.globalAlpha = (1 - ph); glow(g, rx + Math.sin(ph * 7) * 12, ry - ph * 80, 4, "rgba(255,200,90,1)"); }
      // heat shimmer lines
      g.strokeStyle = "rgba(255,170,80,.12)"; g.lineWidth = 2; g.globalAlpha = 1;
      for (let i = 0; i < 5; i++) { g.beginPath(); for (let x = 0; x <= W; x += 20) { const y = H * 0.3 + i * 90 + Math.sin(x * 0.03 + t * 2 + i) * 6; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      break;
    }
    case "coast": {
      // sun glitter on the sea, long soft swells of light
      for (let i = 0; i < 40; i++) { const x = (i * 83) % W, y = 6 + ((i * 29) % 44); const k = Math.max(0, Math.sin(t * 3 + i * 1.7)); g.globalAlpha = k; glow(g, x, y, 5, "rgba(255,255,255,1)"); }
      g.globalAlpha = 0.14; const gr = g.createLinearGradient(0, 0, 0, 90); gr.addColorStop(0, "rgba(255,240,170,1)"); gr.addColorStop(1, "rgba(255,240,170,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, 90);
      for (let i = 0; i < 3; i++) soft(g, (i * 330 + t * 14) % W, 240 + i * 100, 140, "rgba(255,240,190,.9)", 0.08);
      for (let i = 0; i < 12; i++) { const ph = (t * 0.25 + i * 0.083) % 1; g.globalAlpha = Math.sin(ph * Math.PI) * 0.6; glow(g, (i * 79 + ph * 40) % W, 60 + ph * 20, 4, "rgba(255,255,255,1)"); }
      break;
    }
    case "dirt": {
      const gr = g.createRadialGradient(80, 40, 10, 80, 40, 700); gr.addColorStop(0, "rgba(255,210,120,.28)"); gr.addColorStop(1, "rgba(255,160,60,0)"); g.globalAlpha = 0.85 + 0.15 * Math.sin(t * 0.6); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + t * 1.8; const cx = ((t * 24 + i * 260) % (W + 120)) - 60, cy = 220 + (i % 2) * 190; for (let k = 0; k < 14; k++) { const u = k / 14; g.globalAlpha = 0.5 * (1 - u); glow(g, cx + Math.cos(a + u * 9) * (6 + u * 16), cy - u * 60, 4, "rgba(255,225,170,1)"); } }
      for (let i = 0; i < 18; i++) { const k = Math.max(0, Math.sin(t * 2.8 + i * 1.9)); g.globalAlpha = k * 0.8; glow(g, (i * 227) % W, M + ((i * 113) % (H - 2 * M)), 4, "rgba(255,240,190,1)"); }
      break;
    }
    case "crystal": {
      for (let i = 0; i < 3; i++) { const x0 = 220 + i * 260 + Math.sin(t * 0.3 + i) * 20; g.globalAlpha = 0.06 + 0.03 * Math.sin(t + i); const gr = g.createLinearGradient(x0, 0, x0, H * 0.8); gr.addColorStop(0, "rgba(190,160,255,1)"); gr.addColorStop(1, "rgba(190,160,255,0)"); g.fillStyle = gr; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 40, 0); g.lineTo(x0 + 90, H * 0.8); g.lineTo(x0 - 30, H * 0.8); g.closePath(); g.fill(); }
      for (let i = 0; i < 16; i++) { const k = Math.max(0, Math.sin(t * 2.4 + i * 1.3)); g.globalAlpha = k; const x = (i * 181) % W, y = M + ((i * 97) % (H - 2 * M)); g.strokeStyle = "#e0d0ff"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke(); }
      break;
    }
    case "stone": {
      for (const [sx, sy] of [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40], [W / 2, 22], [W / 2, H - 22]] as [number, number][]) soft(g, sx, sy, 150 + Math.sin(t * 8 + sx) * 10, "rgba(255,160,60,.8)", 0.14);
      const p = 0.5 + 0.5 * Math.sin(t * 1.3);
      soft(g, W / 2, H / 2, 190, "rgba(110,190,255,.9)", 0.1 + 0.08 * p);
      g.globalAlpha = 0.25 + 0.2 * p; g.strokeStyle = "rgba(150,215,255,1)"; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, H / 2, 170, 0, PI2); g.stroke();
      // runes drift up off the circle
      for (let i = 0; i < 14; i++) { const ph = (t * 0.3 + i / 14) % 1, a = i * 0.9; g.globalAlpha = Math.sin(ph * Math.PI) * 0.8; glow(g, W / 2 + Math.cos(a) * 160, H / 2 + Math.sin(a) * 160 * 0.95 - ph * 60, 4, "rgba(150,215,255,1)"); }
      break;
    }
  }
  g.restore();
}
