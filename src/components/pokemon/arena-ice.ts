/**
 * Ice. Two things live here:
 *  - the trail a surfing Ice Pokémon (Lapras) leaves on the water: a string of real-looking ice plates (thick edge, facets, bubbles, cracks, frost, glints)
 *    joined by a thin frozen sheet, that slowly melts away;
 *  - Blizzard, built like the concept picture: a glacial sigil on the floor, a frost shockwave, a ring of tall crystal spikes bursting out of the ground,
 *    a light burst under the ice, low cold mist, a lens flare, with flying ice chips and glinting frost drawn as particles by the renderer.
 */
import { fxBlur } from "./arena-lod";
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ================================================================== the trail */

export type Plate = { x: number; y: number; r: number; rot: number; age: number; life: number; seed: number };

export function addPlate(list: Plate[], x: number, y: number, r: number, rot: number) {
  list.push({ x, y, r, rot, age: 0, life: 4.2 + Math.random() * 1.2, seed: Math.random() * 1000 });
  if (list.length > 60) list.shift();
}

function outline(p: Plate, k = 1) {
  const n = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + p.rot;
    const rr = p.r * k * (0.72 + 0.38 * hs(p.seed + i * 3.3));
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.78]);
  }
  return pts;
}

export function drawPlates(g: G, list: Plate[], dt: number, t: number) {
  if (!list.length) return;
  for (let i = list.length - 1; i >= 0; i--) { list[i]!.age += dt; if (list[i]!.age >= list[i]!.life) list.splice(i, 1); }
  if (!list.length) return;
  const alphaOf = (p: Plate) => sm(0, 0.12, p.age) * (1 - sm(p.life * 0.55, p.life, p.age));
  g.save();
  g.lineJoin = "round";
  g.lineCap = "round";
  // the thin frozen sheet that joins the plates: cold blue under the surface, a paler skin over it
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]!, b = list[i]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) > a.r * 3.2) continue;
      const al = Math.min(alphaOf(a), alphaOf(b));
      g.globalAlpha = al * (pass ? 0.55 : 0.4);
      g.strokeStyle = pass ? "#dff4ff" : "#4b9ad0";
      g.lineWidth = Math.min(a.r, b.r) * (pass ? 1.15 : 1.55);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
  }
  for (const p of list) {
    const al = alphaOf(p);
    if (al <= 0.01) continue;
    const grow = 0.55 + 0.45 * sm(0, 0.16, p.age);
    const shrink = 1 - 0.18 * sm(p.life * 0.55, p.life, p.age);
    const pts = outline(p, grow * shrink);
    g.save();
    g.translate(p.x, p.y);
    const path = (dx = 0, dy = 0) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy))); g.closePath(); };
    // water showing through, a soft cold glow round the plate
    g.globalAlpha = al * 0.55; g.shadowColor = "rgba(150,215,255,.9)"; g.shadowBlur = fxBlur(12); g.fillStyle = "#3f8cc4"; path(0, 3); g.fill();
    g.shadowBlur = 0;
    // the thick side of the slab
    g.globalAlpha = al * 0.95; g.fillStyle = "#8fc3e6"; path(0, 3.5); g.fill();
    // the top face: pale ice, a little bluer in the middle where it is thick
    const R = p.r;
    const gr = g.createLinearGradient(-R, -R * 0.7, R, R * 0.7);
    gr.addColorStop(0, "#fbfeff"); gr.addColorStop(0.5, "#cfeaff"); gr.addColorStop(1, "#a9d4f2");
    g.globalAlpha = al * 0.93; g.fillStyle = gr; path(); g.fill();
    g.save(); path(); g.clip();
    // facets: the light comes from the upper left, so some wedges are brighter and some darker, like cut glass
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
      const lit = Math.cos((i / pts.length) * TAU + p.rot + 2.2);
      g.globalAlpha = al * Math.abs(lit) * 0.3;
      g.fillStyle = lit > 0 ? "#ffffff" : "#5a9cd0";
      g.beginPath(); g.moveTo(R * 0.06 * Math.cos(p.seed), R * 0.05 * Math.sin(p.seed)); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fill();
    }
    // cracks inside the slab: a pale line with a dark line beside it
    for (let c = 0; c < 3; c++) {
      let x = (hs(p.seed + c) - 0.5) * R * 0.3, y = (hs(p.seed + c * 2) - 0.5) * R * 0.2;
      const a0 = hs(p.seed + c * 5) * TAU;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 1; s <= 4; s++) { x += Math.cos(a0 + (hs(p.seed + c * 9 + s) - 0.5) * 1.3) * R * 0.28; y += Math.sin(a0 + (hs(p.seed + c * 9 + s) - 0.5) * 1.3) * R * 0.22; g.lineTo(x, y); }
      g.globalAlpha = al * 0.55; g.strokeStyle = "#3f7fb0"; g.lineWidth = 1.2; g.stroke();
      g.globalAlpha = al * 0.75; g.strokeStyle = "#ffffff"; g.lineWidth = 0.8; g.translate(0.8, 0.8); g.stroke(); g.translate(-0.8, -0.8);
    }
    // trapped air bubbles and white frost flecks
    for (let b = 0; b < 7; b++) {
      const bx = (hs(p.seed + b * 4.1) - 0.5) * R * 1.3, by = (hs(p.seed + b * 6.7) - 0.5) * R;
      const br = 0.8 + hs(p.seed + b) * 2;
      g.globalAlpha = al * 0.7; g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill();
      g.globalAlpha = al * 0.35; g.strokeStyle = "#5a9cd0"; g.lineWidth = 0.6; g.stroke();
    }
    g.restore();
    // the rim: a bright frozen edge, with ragged white frost growing outwards
    g.globalAlpha = al; g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 1.8; path(); g.stroke();
    g.globalAlpha = al * 0.6; g.strokeStyle = "#ffffff"; g.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const d = Math.hypot(a[0], a[1]) || 1;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0] + (a[0] / d) * (3 + hs(p.seed + i) * 5), a[1] + (a[1] / d) * (3 + hs(p.seed + i) * 5)); g.stroke();
    }
    // a glint that comes and goes
    const tw = Math.max(0, Math.sin(t * 4 + p.seed));
    if (tw > 0.3) {
      const gx = pts[Math.floor(hs(p.seed) * pts.length)]![0] * 0.6, gy = pts[Math.floor(hs(p.seed) * pts.length)]![1] * 0.6;
      g.globalCompositeOperation = "lighter"; g.globalAlpha = al * tw; g.strokeStyle = "#ffffff"; g.lineWidth = 1.4;
      const L = 4 + tw * 5;
      g.beginPath(); g.moveTo(gx - L, gy); g.lineTo(gx + L, gy); g.moveTo(gx, gy - L); g.lineTo(gx, gy + L); g.stroke();
    }
    g.restore();
  }
  g.restore();
}

/* ================================================================== Blizzard */

type Sig = { x: number; y: number; r: number; t: number; life: number; seed: number };

/** On the floor: the sigil, the frost it spreads, the shockwave, the light under the ice and the mist. */
export function iceFlat(g: G, s: Sig) {
  const u = Math.min(1, s.t / s.life);
  const R = s.r;
  g.save();
  g.translate(s.x, s.y);
  g.lineCap = "round";
  g.lineJoin = "round";
  const sigil = sm(0, 0.1, u) * (1 - sm(0.62, 0.95, u));
  const spread = 1 - Math.pow(1 - sm(0, 0.35, u), 3);
  const frostA = sm(0, 0.12, u) * (1 - sm(0.72, 1, u));

  // frost spreading over the floor: a pale disc, a speckled texture, branching cracks
  const fg = g.createRadialGradient(0, 0, R * 0.05, 0, 0, R * 1.05 * spread + 1);
  fg.addColorStop(0, "rgba(226,246,255,.8)"); fg.addColorStop(0.7, "rgba(160,215,245,.45)"); fg.addColorStop(1, "rgba(120,190,235,0)");
  g.globalAlpha = frostA; g.fillStyle = fg; g.beginPath(); g.arc(0, 0, R * 1.05 * spread + 1, 0, TAU); g.fill();
  g.fillStyle = "#ffffff";
  for (let i = 0; i < 90; i++) {
    const a = hs(s.seed + i * 1.7) * TAU, d = Math.sqrt(hs(s.seed + i * 2.9)) * R * spread;
    g.globalAlpha = frostA * (0.25 + 0.6 * hs(i + 7));
    g.fillRect(Math.cos(a) * d, Math.sin(a) * d * 0.9, 1 + hs(i) * 2.2, 1 + hs(i + 3) * 2.2);
  }
  g.strokeStyle = "#f4fcff";
  for (let i = 0; i < 16; i++) {
    let a = hs(s.seed + i) * TAU, d = R * 0.1, x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    g.globalAlpha = frostA * 0.85; g.lineWidth = 1.7 - i * 0.02;
    g.beginPath(); g.moveTo(x, y);
    const reach = R * spread * (0.6 + 0.4 * hs(i + 20));
    while (d < reach) { d += R * 0.09; a += (hs(s.seed + i * 17 + d) - 0.5) * 0.55; x = Math.cos(a) * d; y = Math.sin(a) * d * 0.9; g.lineTo(x, y); if (hs(s.seed + d + i) > 0.82) { const bx = x, by = y; g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + 0.9) * R * 0.09, by + Math.sin(a + 0.9) * R * 0.07); g.moveTo(x, y); } }
    g.stroke();
  }

  // the light under the ice: a bright core that pulses and flares out through the cracks
  g.globalCompositeOperation = "lighter";
  const pulse = 0.75 + 0.25 * Math.sin(s.t * 14);
  const lg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.7);
  lg.addColorStop(0, "rgba(255,255,255,1)"); lg.addColorStop(0.25, "rgba(170,230,255,.8)"); lg.addColorStop(1, "rgba(80,170,255,0)");
  g.globalAlpha = 0.7 * (1 - sm(0.12, 0.5, u)) * pulse * sm(0, 0.04, u); g.fillStyle = lg; g.beginPath(); g.arc(0, 0, R * 0.7, 0, TAU); g.fill();

  // the glacial sigil: concentric rings, a ring of runes, a star turning slowly
  g.save();
  g.rotate(s.t * 0.5);
  g.globalAlpha = sigil;
  g.strokeStyle = "#bfeaff"; g.lineWidth = 2.4;
  for (const k of [0.78, 0.62, 0.34]) { g.beginPath(); g.arc(0, 0, R * k, 0, TAU); g.stroke(); }
  g.lineWidth = 1.4; g.strokeStyle = "#ffffff";
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; const r1 = R * 0.62, r2 = R * (i % 2 ? 0.7 : 0.76); g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = ((i + 0.5) / 12) * TAU; g.beginPath(); g.arc(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, 3.2, 0, TAU); g.stroke(); }
  g.rotate(-s.t);
  for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + k * Math.PI / 3 - Math.PI / 2; const x = Math.cos(a) * R * 0.5, y = Math.sin(a) * R * 0.5; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  g.restore();

  // the frost shockwave: a bright white edge with a pale band behind it and a dark thin line of "bent air"
  const w = sm(0.02, 0.62, u);
  if (w > 0 && w < 1) {
    const rho = R * (0.3 + 1.1 * (1 - Math.pow(1 - w, 2.4)));
    const wa = 1 - sm(0.35, 1, w);
    g.globalAlpha = wa * 0.35; g.lineWidth = R * 0.2; g.strokeStyle = "#8fd4ff"; g.beginPath(); g.arc(0, 0, rho * 0.9, 0, TAU); g.stroke();
    g.globalAlpha = wa * 0.9; g.lineWidth = 7; g.strokeStyle = "#e8f8ff"; g.beginPath(); g.arc(0, 0, rho, 0, TAU); g.stroke();
    g.lineWidth = 2.4; g.strokeStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, rho * 1.015, 0, TAU); g.stroke();
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = wa * 0.3; g.lineWidth = 2; g.strokeStyle = "#1c4f86"; g.beginPath(); g.arc(0, 0, rho * 1.06, 0, TAU); g.stroke();
    g.globalCompositeOperation = "lighter";
    // frost streaks thrown outwards from the edge
    g.strokeStyle = "#ffffff"; g.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) { const a = hs(s.seed + i * 3.3) * TAU; g.globalAlpha = wa * 0.7; g.beginPath(); g.moveTo(Math.cos(a) * rho, Math.sin(a) * rho * 0.9); g.lineTo(Math.cos(a) * rho * (1.06 + hs(i) * 0.14), Math.sin(a) * rho * 0.9 * (1.06 + hs(i) * 0.14)); g.stroke(); }
  }

  // cold mist rolling low over the floor
  g.globalCompositeOperation = "source-over";
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + hs(s.seed + i) * 0.5 + s.t * 0.15;
    const d = R * (0.35 + 0.8 * sm(0, 0.9, u) * (0.6 + 0.5 * hs(i + 4)));
    const mx = Math.cos(a) * d, my = Math.sin(a) * d * 0.8;
    const mr = R * (0.22 + 0.16 * hs(i + 9));
    const mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
    mg.addColorStop(0, "rgba(220,242,255,.34)"); mg.addColorStop(1, "rgba(190,225,250,0)");
    g.globalAlpha = sm(0.04, 0.3, u) * (1 - sm(0.6, 1, u)); g.fillStyle = mg; g.beginPath(); g.ellipse(mx, my, mr, mr * 0.6, 0, 0, TAU); g.fill();
  }
  g.restore();
}

/** One tall crystal: a stack of faceted blades, one lit face, one shaded, bright edges, a glow at the heart. */
function crystal(g: G, w: number, h: number, lean: number, seed: number, al: number) {
  g.save();
  g.rotate(lean);
  const tip = h;
  const w2 = w * (0.9 + 0.2 * hs(seed));
  // outer body: a long blade with a slightly off-centre point
  const side = (k: number) => {
    g.beginPath();
    g.moveTo(-w2, 0);
    g.lineTo(-w2 * 0.85, -h * 0.42);
    g.lineTo(w * 0.1 * k, -tip);
    g.lineTo(w2 * 0.9, -h * 0.4);
    g.lineTo(w2, 0);
    g.closePath();
  };
  side(1);
  const gr = g.createLinearGradient(-w2, 0, w2, 0);
  gr.addColorStop(0, "rgba(90,160,225,.95)"); gr.addColorStop(0.45, "rgba(200,238,255,.97)"); gr.addColorStop(1, "rgba(120,190,240,.95)");
  g.globalAlpha = al; g.fillStyle = gr; g.fill();
  // lit face (left of the ridge) and shaded face (right)
  g.save(); side(1); g.clip();
  g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.moveTo(-w2, 0); g.lineTo(-w2 * 0.85, -h * 0.42); g.lineTo(w * 0.1, -tip); g.lineTo(-w * 0.05, -h * 0.35); g.lineTo(-w2 * 0.15, 0); g.closePath(); g.fill();
  g.fillStyle = "rgba(40,100,170,.38)"; g.beginPath(); g.moveTo(w2, 0); g.lineTo(w2 * 0.9, -h * 0.4); g.lineTo(w * 0.1, -tip); g.lineTo(w * 0.12, -h * 0.3); g.lineTo(w2 * 0.3, 0); g.closePath(); g.fill();
  // internal refraction lines and a bright core
  g.strokeStyle = "rgba(255,255,255,.65)"; g.lineWidth = 1;
  for (let i = 0; i < 3; i++) { const x = (-0.5 + hs(seed + i * 3) * 0.9) * w2; g.beginPath(); g.moveTo(x, -h * 0.05); g.lineTo(x * 0.5 + w * 0.05, -h * (0.5 + 0.3 * hs(seed + i))); g.stroke(); }
  const cg = g.createLinearGradient(0, 0, 0, -h);
  cg.addColorStop(0, "rgba(255,255,255,.9)"); cg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = cg; g.globalAlpha = al * 0.4; g.fillRect(-w2 * 0.12, -h, w2 * 0.24, h);
  g.restore();
  g.globalAlpha = al; g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 1.6; side(1); g.stroke();
  g.strokeStyle = "rgba(40,100,170,.7)"; g.lineWidth = 1; g.beginPath(); g.moveTo(w * 0.1, -tip); g.lineTo(w * 0.12, -h * 0.05); g.stroke();
  g.restore();
}

/** Upright pieces: the ring of crystal spikes breaking out of the floor, and the lens flare at the heart. */
export function iceItems(s: Sig, push: (x: number, y: number, dy: number, draw: (g: G) => void) => void) {
  const u = Math.min(1, s.t / s.life);
  const R = s.r;
  const melt = 1 - sm(0.68, 0.98, u);
  const rings: [number, number, number][] = [[0.9, 15, 0.8], [0.66, 8, 0.45]];
  for (const [rk, n, hk] of rings) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + hs(s.seed + i * 5.1 + rk) * 0.3 + (rk < 0.7 ? 0.2 : 0);
      const px = s.x + Math.cos(a) * R * rk * (0.92 + 0.14 * hs(i + rk * 9));
      const py = s.y + Math.sin(a) * R * rk * (0.92 + 0.14 * hs(i + rk * 9)) * 0.92;
      const delay = 0.05 + hs(s.seed + i * 2.3 + rk) * 0.14 + (1 - rk) * 0.08;
      const grow = 1 - Math.pow(1 - sm(delay, delay + 0.16, u), 3);
      if (grow <= 0.01) continue;
      const hgt = (40 + 52 * hs(s.seed + i * 7 + rk * 3)) * (R / 150) * hk * (0.55 + 0.45 * grow) * (0.35 + 0.65 * melt) + 12;
      const wd = (11 + 9 * hs(i * 3 + rk)) * (R / 130) * (0.7 + 0.3 * hk);
      const lean = Math.cos(a) * 0.32 + (hs(i + rk) - 0.5) * 0.16;
      push(px, py, 0, (g) => {
        // a splash of chipped ice at the foot, then the crystal and two smaller ones beside it
        g.save();
        g.translate(px, py);
        g.fillStyle = "rgba(235,248,255,.8)";
        for (let k = 0; k < 5; k++) { g.globalAlpha = 0.7 * melt * grow; g.beginPath(); g.arc((hs(i + k) - 0.5) * wd * 3, (hs(i * 2 + k) - 0.5) * 6, 1.5 + hs(k + i) * 2.5, 0, TAU); g.fill(); }
        crystal(g, wd, hgt, lean, s.seed + i, melt * 0.92);
        crystal(g, wd * 0.55, hgt * 0.55 * grow, lean + 0.5, s.seed + i * 3, melt);
        crystal(g, wd * 0.45, hgt * 0.42 * grow, lean - 0.55, s.seed + i * 5, melt);
        g.restore();
      });
    }
  }
  // the lens flare: a hard white star with long horizontal streaks, at the moment of the burst
  const fl = sm(0, 0.04, u) * (1 - sm(0.06, 0.34, u));
  if (fl > 0.01) {
    push(s.x, s.y, 0.5, (g) => {
      g.save();
      g.translate(s.x, s.y);
      g.globalCompositeOperation = "lighter";
      const r0 = R * (0.35 + 0.5 * fl);
      const rg = g.createRadialGradient(0, -14, 0, 0, -14, r0);
      rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.2, "rgba(190,235,255,.8)"); rg.addColorStop(1, "rgba(80,170,255,0)");
      g.globalAlpha = fl; g.fillStyle = rg; g.beginPath(); g.arc(0, -14, r0, 0, TAU); g.fill();
      g.strokeStyle = "#ffffff"; g.lineCap = "round";
      g.lineWidth = 2.2; g.globalAlpha = fl * 0.6; g.beginPath(); g.moveTo(-R * 0.9 * fl, -14); g.lineTo(R * 0.9 * fl, -14); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(-R * 0.5 * fl, -14 - R * 0.5 * fl); g.lineTo(R * 0.5 * fl, -14 + R * 0.5 * fl); g.moveTo(R * 0.5 * fl, -14 - R * 0.5 * fl); g.lineTo(-R * 0.5 * fl, -14 + R * 0.5 * fl); g.stroke();
      g.restore();
    });
  }
}
