/**
 * Thirteen showpiece moves, each built layer by layer from its own reference sheet:
 *   profanerain      Profane Rain               Dark      lob    cone beam + rain streaks + shadow tendrils + rune ring + sparks + dark mist
 *   toxicshield      Toxic Shield of Conquest   Poison    nova   crystal barrier + poison miasma + ground rupture + spiked shockwave
 *   smokeshell       Electric Smoke Shell       Electric  nova   smoke-glass shell + lightning arcs + embers + distortion + core glow + ground ring
 *   poisondome       Poison Vortex Dome         Poison    lob    acid dome + swirling miasma + toxic ground decal
 *   inkzone          Ink-paint Water Zone       Water     lob    ink puddle + brush-stroke ripples + ink wisps + water shimmer + splatter
 *   plasmaburst      Plasma Burst               Electric  proj   plasma core + branching arcs + starburst + static cloud + mana sparks
 *   zealousfear      Zealous of Fear            Grass     lob    cone sigil + thorny vines + nature dust + green glow
 *   savagedischarge  Savage Discharge Blaze     Electric  nova   cylindrical arcs + glow mesh sphere + smoke tendrils + directional sparks + ground ring
 *   cosmicrequiem    Cosmic Phantasm Requiem    Psychic   lob    celestial sphere + astral ribbons + rune decal + motes
 *   scorchedtwilight Scorched Twilight of Rage  Fire      proj   fire blade head + twin wisp beam + ice particles
 *   vigilance        Shattered Vengeance        Fairy     lob    runes + energy cylinder + glass shards + rising sparks + shockwave + haze + smoke
 *   rupturehit       Rupturing Hit Impact       Ground    nova   flash mesh + shockwave + sparks and debris + cracked ground
 *   malignantwrath   Malignant Wrath of Light   Rock      lob    hemispherical shockwave + floating earth + corrupted glow + geode shards + fissure + plasma core
 * All upright pieces draw in absolute world coordinates (see `at` in the renderer).
 */
import { decal } from "./arena-dusk";
type G = CanvasRenderingContext2D;
type Emit = (p: Record<string, unknown>) => void;
type Push = (x: number, y: number, dy: number, draw: (g: G) => void) => void;
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export type F13 = { id: string; x: number; y: number; r: number; t: number; life: number; seed: number; acc: number };
export const LIFE13: Record<string, number> = {
  profanerain: 3.0, toxicshield: 2.8, smokeshell: 2.6, poisondome: 3.8, inkzone: 3.8, plasmaburst: 1.7, zealousfear: 3.4,
  savagedischarge: 2.6, cosmicrequiem: 3.4, scorchedtwilight: 1.5, vigilance: 3.2, rupturehit: 2.3, malignantwrath: 3.4,
};
export const FX13_IDS = new Set(Object.keys(LIFE13));
export const SHOT13 = new Set(["plasmaburst", "scorchedtwilight"]);
export const newF13 = (id: string, x: number, y: number, r: number): F13 => ({ id, x, y, r: Math.max(r, 80), t: 0, life: LIFE13[id] ?? 2.5, seed: Math.random() * 90, acc: 0 });

/* ---------- small drawing helpers ---------- */
const puff = (g: G, x: number, y: number, r: number, rgb: string, a: number) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
};
const mistRing = (g: G, R: number, rgb: string, a: number, t: number, seed: number, n: number, hgt: number) => {
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + t * 0.18, rr = R * (0.8 + 0.25 * hs(i + seed));
    puff(g, Math.cos(ang) * rr, Math.sin(ang) * rr * 0.4 - hgt * hs(i * 3 + seed) - 4, R * (0.17 + 0.1 * hs(i + 9)), rgb, a);
  }
};
const bolt = (g: G, x0: number, y0: number, x1: number, y1: number, seed: number, amp: number, col: string, w: number) => {
  const n = 9, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  g.beginPath(); g.moveTo(x0, y0);
  for (let i = 1; i < n; i++) { const k = i / n, j = (hs(seed + i * 3.3) - 0.5) * amp * Math.sin(k * Math.PI); g.lineTo(x0 + dx * k + nx * j, y0 + dy * k + ny * j); }
  g.lineTo(x1, y1);
  g.strokeStyle = col; g.lineWidth = w * 3; g.globalAlpha *= 0.4; g.stroke();
  g.globalAlpha /= 0.4; g.strokeStyle = "#fff"; g.lineWidth = w; g.stroke();
};
const star = (g: G, r: number, spikes: number, rgb: string, a: number, rot = 0) => {
  g.save(); g.rotate(rot); g.globalCompositeOperation = "lighter";
  for (let i = 0; i < spikes; i++) {
    const ang = (i / spikes) * TAU, L = r * (i % 2 ? 0.55 : 1), w = r * 0.06;
    const gr = g.createLinearGradient(0, 0, Math.cos(ang) * L, Math.sin(ang) * L);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(Math.cos(ang + 1.57) * w, Math.sin(ang + 1.57) * w); g.lineTo(Math.cos(ang) * L, Math.sin(ang) * L); g.lineTo(Math.cos(ang - 1.57) * w, Math.sin(ang - 1.57) * w); g.closePath(); g.fill();
  }
  puff(g, 0, 0, r * 0.45, "255,255,255", a);
  g.restore();
};
const dome = (g: G, W: number, H: number, rgb: string, a: number, rim: string, t: number, seed: number, facets: boolean) => {
  g.beginPath(); g.moveTo(-W, 0); g.ellipse(0, 0, W, H, 0, Math.PI, TAU); g.closePath();
  const gr = g.createRadialGradient(0, -H * 0.3, W * 0.1, 0, -H * 0.2, W * 1.05);
  gr.addColorStop(0, `rgba(${rgb},${0.08 * a})`); gr.addColorStop(0.7, `rgba(${rgb},${0.25 * a})`); gr.addColorStop(1, `rgba(${rgb},${0.6 * a})`);
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  g.globalCompositeOperation = "lighter"; g.strokeStyle = rim; g.lineWidth = 1.2; g.globalAlpha = a * 0.6;
  if (facets) {
    // sharp crystal facets: crossing straight lines between points on the shell
    g.beginPath();
    for (let i = 0; i < 12; i++) {
      const a0 = Math.PI + hs(i + seed) * Math.PI, a1 = Math.PI + hs(i * 5 + seed + 2) * Math.PI;
      g.moveTo(Math.cos(a0) * W * (0.95 - hs(i) * 0.3), Math.sin(a0) * H * (0.95 - hs(i + 7) * 0.3));
      g.lineTo(Math.cos(a1) * W * (0.95 - hs(i + 3) * 0.3), Math.sin(a1) * H * (0.95 - hs(i + 11) * 0.3));
    }
    g.stroke();
  } else {
    for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(0, 0, W * (k / 4), H * (k / 4) * 1.0, 0, Math.PI, TAU); g.stroke(); }
  }
  g.restore();
  g.globalCompositeOperation = "lighter"; g.strokeStyle = rim; g.lineWidth = 2.5; g.globalAlpha = a * 0.9; g.shadowColor = rim; g.shadowBlur = 12;
  g.beginPath(); g.ellipse(0, 0, W, H, 0, Math.PI, TAU); g.stroke();
  g.beginPath(); g.ellipse(0, 0, W, W * 0.28, 0, 0, Math.PI); g.stroke();
  g.shadowBlur = 0;
};
const sphere = (g: G, cx: number, cy: number, r: number, rgb: string, a: number, rim: string, t: number, mesh: boolean) => {
  g.save(); g.translate(cx, cy);
  const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
  gr.addColorStop(0, `rgba(255,255,255,${0.35 * a})`); gr.addColorStop(0.45, `rgba(${rgb},${0.18 * a})`); gr.addColorStop(1, `rgba(${rgb},${0.55 * a})`);
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.globalCompositeOperation = "lighter"; g.strokeStyle = rim; g.lineWidth = 2; g.globalAlpha = a * 0.85; g.shadowColor = rim; g.shadowBlur = 10; g.stroke(); g.shadowBlur = 0;
  if (mesh) {
    g.lineWidth = 1; g.globalAlpha = a * 0.45;
    for (let k = -2; k <= 2; k++) { const y = k * r * 0.36, rx = Math.sqrt(Math.max(0, r * r - y * y)); g.beginPath(); g.ellipse(0, y, rx, rx * 0.26, 0, 0, TAU); g.stroke(); }
    for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(0, 0, Math.abs(Math.cos(t * 0.8 + j * 0.8)) * r, r, 0, 0, TAU); g.stroke(); }
  }
  g.restore();
};
const shard = (g: G, x: number, y: number, h: number, w: number, rot: number, c1: string, c2: string, edge: string) => {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); g.moveTo(0, -h); g.lineTo(w, -h * 0.2); g.lineTo(w * 0.6, h * 0.5); g.lineTo(0, h); g.lineTo(-w * 0.7, h * 0.3); g.lineTo(-w * 0.6, -h * 0.3); g.closePath();
  const gr = g.createLinearGradient(-w, -h, w, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; g.fill(); g.strokeStyle = edge; g.lineWidth = 1.1; g.stroke();
  g.beginPath(); g.moveTo(0, -h); g.lineTo(w * 0.1, h); g.moveTo(-w * 0.6, -h * 0.3); g.lineTo(w * 0.6, h * 0.5); g.globalAlpha *= 0.5; g.stroke();
  g.restore();
};
/** Ribbons winding up a column, two passes so they pass behind and in front. */
const helix = (g: G, H: number, rad: (k: number) => number, n: number, t: number, cols: string[], w: number, a: number, front: boolean, turns = 4.5, spd = 2.6) => {
  for (let j = 0; j < n; j++) {
    const ph = (j / n) * TAU;
    for (let i = 0; i < 28; i++) {
      const k0 = i / 28, k1 = (i + 1) / 28, a0 = ph + k0 * turns - t * spd, a1 = ph + k1 * turns - t * spd, z = Math.sin((a0 + a1) / 2);
      if ((z > 0) !== front) continue;
      g.strokeStyle = cols[j % cols.length]!; g.lineWidth = w * (0.5 + 0.7 * Math.sin(k0 * Math.PI)) * (front ? 1 : 0.75);
      g.globalAlpha = a * Math.min(1, k0 * 6) * Math.min(1, (1 - k0) * 4) * (front ? 1 : 0.55);
      g.beginPath(); g.moveTo(Math.cos(a0) * rad(k0), -k0 * H + z * 3); g.lineTo(Math.cos(a1) * rad(k1), -k1 * H + z * 3); g.stroke();
    }
  }
};
const cracks = (g: G, R: number, k: number, a: number, glow: string, dark: string, seed: number, n: number, heat = 1) => {
  g.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) {
    g.globalCompositeOperation = pass ? "lighter" : "source-over";
    g.strokeStyle = pass ? glow : dark; g.lineWidth = pass ? 2 : 4.5; g.globalAlpha = a * (pass ? 0.4 + 0.6 * heat : 0.9);
    for (let i = 0; i < n; i++) {
      let ang = hs(seed + i) * TAU, d = R * 0.05;
      g.beginPath(); g.moveTo(Math.cos(ang) * d, Math.sin(ang) * d * 0.9);
      const reach = R * (0.5 + 0.5 * hs(i + 40)) * k;
      while (d < reach) { d += R * 0.1; ang += (hs(seed + i * 13 + d) - 0.5) * 0.4; g.lineTo(Math.cos(ang) * d, Math.sin(ang) * d * 0.9); }
      g.stroke();
    }
  }
  g.globalCompositeOperation = "source-over";
};
const ring = (g: G, R: number, w: number, col: string, a: number, spikes = 0, rot = 0) => {
  g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w;
  if (!spikes) { g.beginPath(); g.ellipse(0, 0, R, R * 0.9, 0, 0, TAU); g.stroke(); return; }
  g.beginPath();
  for (let i = 0; i <= spikes * 2; i++) { const ang = (i / (spikes * 2)) * TAU + rot, rr = R * (i % 2 ? 0.9 : 1.12); const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr * 0.9; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.stroke();
};
const glowDisc = (g: G, R: number, rgb: string, a: number) => { g.globalCompositeOperation = "source-over"; puff(g, 0, 0, R, rgb, a); };
const up = (push: Push, s: F13, dy: number, fn: (g: G) => void) => push(s.x, s.y, dy, (g) => { g.save(); g.translate(s.x, s.y); fn(g); g.restore(); });
const alpha = (u: number, i = 0.08, o = 0.72) => sm(0, i, u) * (1 - sm(o, 1, u));

/* ---------- the floor ---------- */
export function flat13(g: G, s: F13) {
  const u = Math.min(1, s.t / s.life), R = s.r, a = alpha(u), t = s.t, sd = s.seed;
  g.save(); g.translate(s.x, s.y); g.lineJoin = "round"; g.lineCap = "round";
  switch (s.id) {
    case "profanerain":
      glowDisc(g, R * 1.1, "80,20,140", a * 0.7);
      decal(g, R * 0.95, t, a, { lt: "#dcb0ff", md: "#9a40ff" }, sd, true);
      break;
    case "toxicshield": {
      glowDisc(g, R * 1.1, "30,60,20", a * 0.7);
      cracks(g, R, sm(0, 0.2, u), a, "#b6ff40", "#10180a", sd, 16, 1 - sm(0.2, 0.9, u));
      const k = sm(0, 0.3, u);
      g.globalCompositeOperation = "lighter"; ring(g, R * (0.4 + 0.75 * k), 4, "#5dffb0", a * (1 - k * 0.5), 14, t * 0.5); ring(g, R * (0.35 + 0.7 * k), 1.6, "#d8ffe8", a, 0);
      break;
    }
    case "smokeshell": case "savagedischarge": {
      const big = s.id === "savagedischarge";
      glowDisc(g, R, big ? "255,140,50" : "60,120,255", a * 0.4);
      if (big) cracks(g, R, sm(0, 0.15, u), a, "#ffa050", "#0a0e18", sd, 12, 1 - sm(0.1, 0.8, u));
      decal(g, R * 0.95, t * 1.4, a, { lt: "#d8f0ff", md: "#4a9aff" }, sd, big);
      break;
    }
    case "poisondome": {
      // an uneven toxic puddle with a glowing edge and darker middle
      const gp = new Path2D(); const n = 22;
      for (let i = 0; i <= n; i++) { const ang = (i / n) * TAU, rr = R * (0.8 + 0.25 * hs(i + sd)) * sm(0, 0.15, u); const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr * 0.9; i ? gp.lineTo(x, y) : gp.moveTo(x, y); }
      gp.closePath();
      g.globalAlpha = a * 0.8; g.fillStyle = "#14240c"; g.fill(gp);
      g.globalCompositeOperation = "lighter"; g.strokeStyle = "#a6ff3a"; g.lineWidth = 3; g.globalAlpha = a * (0.7 + 0.3 * Math.sin(t * 5)); g.shadowColor = "#7aff20"; g.shadowBlur = 12; g.stroke(gp); g.shadowBlur = 0;
      for (let i = 0; i < 7; i++) { const ang = hs(i + sd) * TAU, rr = R * 0.6 * hs(i + 4); g.globalAlpha = a * 0.4; g.fillStyle = "#d8ff70"; g.beginPath(); g.arc(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.8, 3 + 3 * hs(i), 0, TAU); g.fill(); }
      break;
    }
    case "inkzone": {
      const k = sm(0, 0.25, u);
      // water first, then the black puddle spreading over it, brushed ripples, splatter
      g.globalAlpha = a * 0.75; const wg = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.05); wg.addColorStop(0, "#0a2a3a"); wg.addColorStop(0.8, "#2a8a9a"); wg.addColorStop(1, "rgba(60,160,180,0)");
      g.fillStyle = wg; g.beginPath(); g.arc(0, 0, R * 1.05 * k, 0, TAU); g.fill();
      g.globalAlpha = a * 0.9; g.fillStyle = "#04080e"; g.beginPath();
      for (let i = 0; i <= 24; i++) { const ang = (i / 24) * TAU, rr = R * (0.5 + 0.22 * hs(i + sd) + 0.04 * Math.sin(t * 2 + i)) * k; const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr * 0.9; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath(); g.fill();
      g.strokeStyle = "#05090f"; g.lineCap = "round";
      for (let i = 0; i < 3; i++) { const rr = R * (0.7 + i * 0.2) * k, a0 = t * 0.5 + i * 2, len = 3.2 - i * 0.5; g.lineWidth = 9 - i * 2.5; g.globalAlpha = a * 0.85; g.beginPath(); g.ellipse(0, 0, rr, rr * 0.9, 0, a0, a0 + len); g.stroke(); }
      g.fillStyle = "#04080e";
      for (let i = 0; i < 14; i++) { const ang = hs(i + sd) * TAU, d = R * (0.8 + 0.5 * hs(i + 9)) * k; g.globalAlpha = a * 0.9; g.beginPath(); g.ellipse(Math.cos(ang) * d, Math.sin(ang) * d * 0.9, 2 + 5 * hs(i + 3), 1.5 + 3 * hs(i + 6), ang, 0, TAU); g.fill(); }
      g.globalCompositeOperation = "lighter"; g.strokeStyle = "#8ae8f0"; g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { const p = (t * 0.5 + i / 3) % 1; g.globalAlpha = (1 - p) * 0.3 * a; g.beginPath(); g.ellipse(0, 0, R * (0.2 + p * 0.9), R * (0.2 + p * 0.9) * 0.9, 0, 0, TAU); g.stroke(); }
      break;
    }
    case "plasmaburst": {
      const k = sm(0, 0.4, u); g.globalCompositeOperation = "lighter";
      ring(g, R * (0.3 + 0.8 * k), 3, "#c8c0ff", a * (1 - k), 0); glowDisc(g, R * 0.6, "150,130,255", a * 0.5 * (1 - k));
      break;
    }
    case "zealousfear": {
      glowDisc(g, R, "40,120,40", a * 0.4);
      // the cone sigil: a pentagram in a ring with a triangle of light
      g.globalCompositeOperation = "lighter"; g.strokeStyle = "#d8ffd0"; g.shadowColor = "#6aff5a"; g.shadowBlur = 8; g.globalAlpha = a * 0.9; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, 0, R * 0.9, R * 0.9 * 0.95, 0, 0, TAU); g.stroke();
      g.save(); g.rotate(t * 0.3); g.beginPath(); for (let i = 0; i <= 5; i++) { const ang = ((i * 2) / 5) * TAU - Math.PI / 2; const x = Math.cos(ang) * R * 0.8, y = Math.sin(ang) * R * 0.8; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.beginPath(); g.moveTo(0, -R * 0.35); g.lineTo(R * 0.3, R * 0.2); g.lineTo(-R * 0.3, R * 0.2); g.closePath(); g.globalAlpha = a * 0.6; g.stroke(); g.restore();
      for (let i = 0; i < 12; i++) { const ang = (i / 12) * TAU - t * 0.4; g.globalAlpha = a * 0.7; g.beginPath(); g.arc(Math.cos(ang) * R * 0.9, Math.sin(ang) * R * 0.85, 3, 0, TAU); g.stroke(); }
      g.shadowBlur = 0;
      break;
    }
    case "cosmicrequiem": case "vigilance": {
      const cos = s.id === "cosmicrequiem";
      glowDisc(g, R, cos ? "60,50,160" : "60,120,220", a * 0.5);
      decal(g, R * 0.95, t, a, cos ? { lt: "#c8d8ff", md: "#6a8cff" } : { lt: "#fff0b0", md: "#58a8ff" }, sd, true);
      g.globalCompositeOperation = "lighter"; g.fillStyle = cos ? "#a0b8ff" : "#fff2c0"; g.globalAlpha = a * 0.9; g.font = `bold ${Math.round(R * 0.55)}px serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.save(); g.scale(1, 0.9); g.fillText("R", 0, 0); g.restore();
      break;
    }
    case "scorchedtwilight": {
      const k = sm(0, 0.3, u); g.globalCompositeOperation = "lighter";
      ring(g, R * (0.3 + 0.7 * k), 4, "#ff9a3a", a * (1 - k), 0); ring(g, R * (0.25 + 0.6 * k), 3, "#aaf0ff", a * (1 - k), 0);
      break;
    }
    case "rupturehit": {
      glowDisc(g, R, "40,20,10", a * 0.7);
      cracks(g, R * 1.05, sm(0, 0.12, u), a, "#ff7a2a", "#120a06", sd, 20, 1 - sm(0.05, 0.8, u));
      const k = sm(0, 0.35, u); g.globalCompositeOperation = "lighter";
      ring(g, R * (0.3 + 1.0 * k), 6 * (1 - k) + 2, "#ffd890", a * (1 - k * 0.7), 0);
      break;
    }
    case "malignantwrath": {
      glowDisc(g, R * 1.1, "70,50,20", a * 0.6);
      cracks(g, R, sm(0, 0.15, u), a, "#ffd070", "#120d08", sd, 18, 1 - sm(0.1, 0.8, u));
      g.globalCompositeOperation = "lighter"; ring(g, R * 0.95, 5, "rgba(255,240,200,.9)", a * 0.35, 0); ring(g, R * 0.75, 2, "rgba(255,240,200,.9)", a * 0.3, 0);
      break;
    }
  }
  g.restore();
}

/* ---------- upright pieces ---------- */
export function items13(s: F13, push: Push) {
  const u = Math.min(1, s.t / s.life), R = s.r, a = alpha(u), t = s.t, sd = s.seed;
  const gr = sm(0.02, 0.22, u);
  switch (s.id) {
    case "profanerain": {
      const H = 300;
      up(push, s, 0.2, (g) => {
        // the cone: wide at the top, point on the ground, violet glass with a bright axis
        const w = R * 0.5 * (1 - 0.2 * sm(0.3, 1, u)), top = -H * gr;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-w, top); g.lineTo(w, top); g.closePath();
        const cg = g.createLinearGradient(0, 0, 0, top); cg.addColorStop(0, "rgba(255,255,255,.95)"); cg.addColorStop(0.25, "rgba(170,90,255,.85)"); cg.addColorStop(1, "rgba(50,10,100,.25)");
        g.globalAlpha = a; g.fillStyle = cg; g.fill();
        g.globalCompositeOperation = "lighter"; g.strokeStyle = "#e6c8ff"; g.lineWidth = 2; g.shadowColor = "#a040ff"; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, top); g.lineWidth = 3; g.globalAlpha = a * 0.8; g.strokeStyle = "#fff"; g.stroke();
        // descending rain: thin violet streaks falling through
        for (let i = 0; i < 26; i++) {
          const x = (hs(i + sd) - 0.5) * R * 1.7, ph = (t * (1.2 + hs(i + 3)) + hs(i * 2)) % 1, y = -H * (1 - ph) * 1.05, len = 26 + 40 * hs(i + 5);
          const lg = g.createLinearGradient(x, y - len, x, y); lg.addColorStop(0, "rgba(200,140,255,0)"); lg.addColorStop(1, "rgba(215,170,255,.9)");
          g.strokeStyle = lg; g.lineWidth = 1.6; g.globalAlpha = a; g.beginPath(); g.moveTo(x, y - len); g.lineTo(x, y); g.stroke();
        }
      });
      up(push, s, -0.5, (g) => { g.globalAlpha = a; helix(g, H * 0.9 * gr, (k) => R * (0.12 + 0.3 * k), 2, t, ["#241038", "#4a1a80"], 9, a, false, 3.5, 2.4); });
      up(push, s, 0.6, (g) => { g.globalAlpha = a; helix(g, H * 0.9 * gr, (k) => R * (0.12 + 0.3 * k), 2, t, ["#241038", "#6a30b0"], 9, a, true, 3.5, 2.4); });
      up(push, s, 0.4, (g) => { mistRing(g, R, "42,20,70", a * 0.75, t, sd, 11, 20); });
      break;
    }
    case "toxicshield": {
      up(push, s, 0.3, (g) => { dome(g, R * 0.95 * (0.8 + 0.2 * gr), R * 0.95 * gr, "70,255,170", a, "#8dffd0", t, sd, true); });
      up(push, s, 0.6, (g) => {
        // poison miasma: green and purple cloud rolling round the base
        for (let i = 0; i < 12; i++) { const ang = (i / 12) * TAU + t * 0.4, rr = R * (0.7 + 0.3 * hs(i + sd)); puff(g, Math.cos(ang) * rr, Math.sin(ang) * rr * 0.4 - 10 - 26 * hs(i + 3), R * (0.18 + 0.1 * hs(i)), i % 3 ? "90,230,90" : "150,60,200", a * 0.5); }
      });
      break;
    }
    case "smokeshell": {
      up(push, s, 0.3, (g) => {
        const r0 = R * 0.9 * gr;
        sphere(g, 0, -r0 * 0.95, r0, "170,210,255", a, "#cfe6ff", t, false);
        sphere(g, r0 * 0.12, -r0 * 0.9, r0 * 0.72, "150,190,255", a * 0.8, "#b0d4ff", t, false);
        // lightning arcs crawling inside the shell, re-rolled quickly
        g.globalCompositeOperation = "lighter"; const fr = Math.floor(t * 14);
        for (let i = 0; i < 5; i++) { const a0 = hs(i * 3 + fr) * TAU, a1 = a0 + 1 + hs(i + fr) * 1.5; g.globalAlpha = a; bolt(g, Math.cos(a0) * r0 * 0.9, -r0 * 0.95 + Math.sin(a0) * r0 * 0.9, Math.cos(a1) * r0 * 0.5, -r0 * 0.95 + Math.sin(a1) * r0 * 0.5, fr * 5 + i * 9, r0 * 0.3, "#7ab0ff", 1.4); }
        puff(g, 0, -r0 * 0.15, r0 * 0.5, "200,230,255", a * 0.9); puff(g, 0, -r0 * 0.15, r0 * 0.2, "255,255,255", a);
        g.globalAlpha = a; g.fillStyle = "#fff"; for (let i = 0; i < 26; i++) { const ang = hs(i + sd) * TAU, d = r0 * Math.sqrt(hs(i + 4)) * 0.95, py = -r0 * 0.95 + Math.sin(ang) * d - ((t * 20 + i * 9) % 40) * 0.4; g.fillRect(Math.cos(ang) * d, py, 1.8, 1.8); }
      });
      break;
    }
    case "poisondome": {
      up(push, s, 0.2, (g) => { dome(g, R * 1.0 * (0.85 + 0.15 * gr), R * 0.95 * gr, "110,230,50", a, "#b6ff60", t, sd, false); });
      up(push, s, -0.4, (g) => { g.globalCompositeOperation = "lighter"; helix(g, R * 0.95 * gr, (k) => R * (0.12 + 0.3 * Math.sin(k * 2.2)), 3, t, ["#ffe030", "#a6ff30", "#6acb20"], 8, a, false, 4, 3.4); });
      up(push, s, 0.7, (g) => { g.globalCompositeOperation = "lighter"; helix(g, R * 0.95 * gr, (k) => R * (0.12 + 0.3 * Math.sin(k * 2.2)), 3, t, ["#ffe030", "#a6ff30", "#6acb20"], 8, a, true, 4, 3.4); for (let i = 0; i < 6; i++) { const k = ((t * 0.35 + i / 6) % 1); puff(g, Math.cos(t * 2 + i) * R * 0.25 * k, -k * R * 0.9, R * 0.16, "190,255,70", a * 0.35); } });
      break;
    }
    case "inkzone": {
      up(push, s, 0.5, (g) => {
        // suspended ink: black smoky columns rising and twisting, teal highlights on one side
        for (let c = 0; c < 4; c++) {
          const bx = (c - 1.5) * R * 0.3, H = R * (0.7 + 0.4 * hs(c + sd)) * gr;
          for (let i = 0; i < 14; i++) {
            const k = i / 14, x = bx + Math.sin(k * 6 + t * 1.5 + c * 2) * R * 0.12 * (0.3 + k), y = -k * H, rr = R * (0.07 + 0.1 * Math.sin(k * Math.PI)) * (0.9 + 0.3 * hs(i + c));
            puff(g, x, y, rr, "4,10,16", a * 0.85);
            g.globalCompositeOperation = "lighter"; puff(g, x + rr * 0.35, y - rr * 0.2, rr * 0.55, "40,150,170", a * 0.22); g.globalCompositeOperation = "source-over";
          }
        }
      });
      break;
    }
    case "plasmaburst": {
      up(push, s, 0.6, (g) => {
        const k = sm(0, 0.15, u), f = sm(0.1, 0.8, u);
        g.globalCompositeOperation = "lighter";
        // residual static cloud
        for (let i = 0; i < 9; i++) { const ang = (i / 9) * TAU + t * 0.8, d = R * (0.2 + 0.5 * f) * (0.7 + 0.4 * hs(i + sd)); puff(g, Math.cos(ang) * d, -14 + Math.sin(ang) * d * 0.5, R * (0.28 + 0.1 * hs(i)), "120,100,255", a * 0.4); }
        // branching arcs lashing out
        const fr = Math.floor(t * 16); g.globalAlpha = a * (1 - f * 0.6);
        for (let i = 0; i < 9; i++) { const ang = hs(i * 7 + fr) * TAU, L = R * (0.8 + 1.1 * hs(i + fr * 3)); bolt(g, 0, -10, Math.cos(ang) * L, -10 + Math.sin(ang) * L * 0.6, fr * 11 + i * 5, R * 0.3, "#9aa8ff", 1.6); }
        g.save(); g.translate(0, -10); g.globalAlpha = 1 - sm(0.15, 0.6, u); star(g, R * (0.8 + k * 0.8), 14, "150,130,255", 1, t * 0.3); g.restore();
        puff(g, 0, -10, R * 0.28, "255,255,255", a);
      });
      break;
    }
    case "zealousfear": {
      up(push, s, 0.3, (g) => { puff(g, 0, -R * 0.45, R * 0.85, "90,230,70", a * 0.55); puff(g, 0, -R * 0.45, R * 0.45, "180,255,140", a * 0.4); });
      up(push, s, 0.7, (g) => {
        // three braided thorny vines
        const H = R * 1.7 * gr;
        g.lineCap = "round";
        for (let v = 0; v < 3; v++) {
          const path = (k: number): [number, number] => [Math.sin(k * 8 + t * 0.7 + v * 2.1) * R * 0.28 * (1 - k * 0.45), -k * H];
          g.strokeStyle = "#16240f"; g.lineWidth = 9 * (1 - 0) ; g.globalAlpha = a; g.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = path(i / 30); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
          g.strokeStyle = "#3f6a22"; g.lineWidth = 5; g.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = path(i / 30); i ? g.lineTo(x - 1.5, y) : g.moveTo(x - 1.5, y); } g.stroke();
          g.fillStyle = "#c8d8a0";
          for (let i = 2; i < 30; i += 2) { const [x, y] = path(i / 30), [x2, y2] = path((i + 1) / 30), dir = i % 4 ? 1 : -1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dir * 10, y - 8 + (y2 - y)); g.lineTo(x + dir * 2, y + 4); g.closePath(); g.fill(); }
        }
      });
      up(push, s, 0.8, (g) => {
        // nature energy dust: brown-green streaks swirling round
        g.globalCompositeOperation = "lighter"; g.lineCap = "round";
        for (let i = 0; i < 7; i++) { const a0 = t * 1.8 + i * 0.9, rr = R * (0.5 + 0.25 * hs(i)), yy = -R * (0.2 + 1.1 * hs(i + 3)); g.strokeStyle = i % 2 ? "#b8d070" : "#7ab048"; g.lineWidth = 3; g.globalAlpha = a * 0.55; g.beginPath(); g.ellipse(0, yy, rr, rr * 0.3, 0, a0, a0 + 1.4); g.stroke(); }
      });
      break;
    }
    case "savagedischarge": {
      up(push, s, 0.3, (g) => {
        const r0 = R * 0.85 * gr, cy = -r0 * 0.95;
        sphere(g, 0, cy, r0, "70,150,255", a, "#8fd0ff", t, true);
        g.globalCompositeOperation = "lighter"; puff(g, 0, cy, r0 * 0.6, "255,150,70", a * 0.7); puff(g, 0, cy, r0 * 0.25, "255,230,200", a);
        // two arcs winding up a cylinder
        const fr = Math.floor(t * 18);
        for (let j = 0; j < 2; j++) {
          let px = 0, py = 0; g.globalAlpha = a;
          for (let i = 0; i <= 22; i++) { const k = i / 22, ang = k * 9 + j * Math.PI + t * 4, x = Math.cos(ang) * r0 * 0.38, y = -k * r0 * 2.1 + (hs(i + fr + j * 9) - 0.5) * 8; if (i) bolt(g, px, py, x, y, fr + i * 3 + j, 10, "#8fd0ff", 1.5); px = x; py = y; }
        }
      });
      up(push, s, -0.3, (g) => { for (let i = 0; i < 6; i++) { const k = ((t * 0.3 + i / 6) % 1); puff(g, (hs(i + sd) - 0.5) * R * 0.9, -k * R * 1.7, R * (0.12 + 0.12 * k), "120,130,150", a * 0.35 * (1 - k)); } });
      break;
    }
    case "cosmicrequiem": {
      up(push, s, 0.4, (g) => {
        const r0 = R * 0.5 * gr, cy = -R * 0.6;
        // celestial sphere: deep blue with star points and a tilted orbit ring
        const sg = g.createRadialGradient(-r0 * 0.3, cy - r0 * 0.3, r0 * 0.1, 0, cy, r0); sg.addColorStop(0, "rgba(120,140,255,.9)"); sg.addColorStop(1, "rgba(20,20,90,.9)");
        g.globalAlpha = a; g.fillStyle = sg; g.beginPath(); g.arc(0, cy, r0, 0, TAU); g.fill();
        g.globalCompositeOperation = "lighter"; g.strokeStyle = "#8fa8ff"; g.lineWidth = 1.5; g.shadowColor = "#6a8cff"; g.shadowBlur = 12; g.stroke(); g.shadowBlur = 0;
        g.fillStyle = "#e0eaff"; for (let i = 0; i < 24; i++) { const ang = hs(i + sd) * TAU, d = r0 * Math.sqrt(hs(i + 5)); g.fillRect(Math.cos(ang + t * 0.3) * d, cy + Math.sin(ang) * d, 1.6, 1.6); }
        g.strokeStyle = "#a8c0ff"; g.lineWidth = 1.5; g.globalAlpha = a * 0.7; g.beginPath(); g.ellipse(0, cy, r0 * 1.35, r0 * 0.3, -0.25, 0, TAU); g.stroke();
      });
      up(push, s, -0.4, (g) => { g.globalCompositeOperation = "lighter"; g.lineCap = "round"; helix(g, R * 1.5 * gr, (k) => R * (0.18 + 0.15 * Math.sin(k * 3)), 4, t, ["#7ad8ff", "#c88cff", "#ffd88a", "#8ab0ff"], 5, a, false, 3.2, 2.2); });
      up(push, s, 0.8, (g) => { g.globalCompositeOperation = "lighter"; g.lineCap = "round"; helix(g, R * 1.5 * gr, (k) => R * (0.18 + 0.15 * Math.sin(k * 3)), 4, t, ["#7ad8ff", "#c88cff", "#ffd88a", "#8ab0ff"], 5, a, true, 3.2, 2.2); });
      break;
    }
    case "vigilance": {
      up(push, s, 0.3, (g) => {
        const H = R * 3.2 * gr, w = R * 0.32;
        const cg = g.createLinearGradient(-w, 0, w, 0); cg.addColorStop(0, "rgba(70,150,255,0)"); cg.addColorStop(0.35, "rgba(190,225,255,.75)"); cg.addColorStop(0.5, "rgba(255,255,255,.95)"); cg.addColorStop(0.65, "rgba(190,225,255,.75)"); cg.addColorStop(1, "rgba(70,150,255,0)");
        g.globalCompositeOperation = "lighter"; g.globalAlpha = a; g.fillStyle = cg; g.fillRect(-w, -H, w * 2, H);
        g.strokeStyle = "#d8ecff"; g.lineWidth = 1.6; for (let i = 0; i < 5; i++) { const y = -((t * 140 + i * H / 5) % H); g.globalAlpha = a * 0.7 * (1 - -y / H); g.beginPath(); g.ellipse(0, y, w * 1.05, w * 0.28, 0, 0, TAU); g.stroke(); }
        // glass shards hanging and turning round the beam
        for (let i = 0; i < 10; i++) { const ang = i / 10 * TAU + t * 0.6, rr = R * (0.55 + 0.25 * hs(i)), hh = R * (0.3 + 1.6 * hs(i + 3)) + Math.sin(t * 2 + i) * 6; g.globalAlpha = a * 0.9; shard(g, Math.cos(ang) * rr, -hh + Math.sin(ang) * rr * 0.3, 11 + 8 * hs(i + 4), 5 + 3 * hs(i), t + i, "rgba(220,240,255,.9)", "rgba(120,170,255,.6)", "#ffffff"); }
      });
      up(push, s, 0.6, (g) => {
        // impact shockwave: a low sunburst of pale petals, plus smoke dissolving off it
        g.globalCompositeOperation = "lighter"; const k = sm(0, 0.3, u);
        for (let i = 0; i < 14; i++) { const ang = (i / 14) * TAU, L = R * (0.55 + 0.5 * hs(i)) * k; const px = Math.cos(ang) * L, py = Math.sin(ang) * L * 0.35; g.globalAlpha = a * 0.7; g.fillStyle = "#e8f4ff"; g.beginPath(); g.moveTo(Math.cos(ang) * R * 0.2, Math.sin(ang) * R * 0.07); g.lineTo(px + Math.cos(ang + 1.57) * 6, py - 12 * hs(i + 2)); g.lineTo(px, py - 24 * hs(i + 4)); g.lineTo(px + Math.cos(ang - 1.57) * 6, py - 4); g.closePath(); g.fill(); }
        g.globalCompositeOperation = "source-over"; for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU, p = (t * 0.4 + hs(i)) % 1; puff(g, Math.cos(ang) * R * 0.8, Math.sin(ang) * R * 0.3 - 10 - p * 50, R * 0.15, "150,160,180", a * 0.3 * (1 - p)); }
        // heat distortion: wavering pale strokes
        g.strokeStyle = "rgba(220,235,255,.5)"; g.lineWidth = 1.4; for (let i = 0; i < 4; i++) { g.globalAlpha = a * 0.3; g.beginPath(); for (let k2 = 0; k2 <= 12; k2++) { const x = (k2 / 12 - 0.5) * R * 1.8, y = -40 - i * 22 + Math.sin(k2 * 1.1 + t * 4 + i) * 4; k2 ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      });
      break;
    }
    case "rupturehit": {
      up(push, s, 0.7, (g) => {
        // the impact flash: a spiky mesh that bursts and is gone fast
        const f = sm(0, 0.05, u) * (1 - sm(0.05, 0.3, u)); if (f > 0.01) { g.translate(0, -14); star(g, R * (0.7 + 0.7 * sm(0, 0.25, u)), 16, "255,170,60", f, 0.2); }
      });
      up(push, s, 0.4, (g) => { for (let i = 0; i < 10; i++) { const ang = (i / 10) * TAU, k = sm(0, 0.4, u), d = R * (0.4 + 0.9 * k) * (0.8 + 0.3 * hs(i + sd)); puff(g, Math.cos(ang) * d, Math.sin(ang) * d * 0.45 - 8 - 20 * k, R * (0.2 + 0.12 * hs(i)), "90,80,70", a * 0.45); } });
      break;
    }
    case "malignantwrath": {
      up(push, s, 0.2, (g) => {
        dome(g, R * 1.1 * (0.8 + 0.2 * gr), R * 0.95 * gr, "255,235,190", a * 0.9, "#fff4d0", t, sd, false);
        // corrupted holy glow: black smoky tongue with a gold edge
        for (let i = 0; i < 12; i++) { const k = i / 12, x = Math.sin(k * 6 + t * 2) * R * 0.1 * k, y = -k * R * 0.85 * gr; puff(g, x, y, R * (0.12 - 0.05 * k + 0.03 * Math.sin(t * 5 + i)), "10,6,4", a * 0.9); g.globalCompositeOperation = "lighter"; puff(g, x + 3, y, R * 0.09, "255,200,80", a * 0.3); g.globalCompositeOperation = "source-over"; }
        // geode shards pushing up from the middle
        for (let i = 0; i < 7; i++) { const ang = (hs(i + sd) - 0.5) * 1.6, h = R * (0.3 + 0.35 * hs(i + 4)) * gr; g.save(); g.translate((hs(i + 9) - 0.5) * R * 0.5, 0); g.rotate(ang); g.globalAlpha = a; shard(g, 0, -h * 0.5, h * 0.55, R * 0.06, 0, "rgba(255,255,255,.95)", "rgba(190,180,160,.7)", "#fff6d8"); g.restore(); }
        g.globalCompositeOperation = "lighter"; puff(g, 0, -R * 0.1, R * 0.35, "255,230,150", a * 0.6); puff(g, 0, -R * 0.1, R * 0.14, "255,255,255", a);
      });
      up(push, s, 0.6, (g) => {
        // earth chunks hanging in the air
        for (let i = 0; i < 9; i++) { const ang = i / 9 * TAU + t * 0.3, rr = R * (0.35 + 0.5 * hs(i + sd)), hh = R * (0.3 + 0.8 * hs(i + 5)) * gr + Math.sin(t * 1.6 + i) * 5, sz = R * (0.07 + 0.07 * hs(i + 2)); g.save(); g.translate(Math.cos(ang) * rr, -hh + Math.sin(ang) * rr * 0.3); g.rotate(t * 0.6 + i); g.globalAlpha = a; g.fillStyle = "#3a2e26"; g.strokeStyle = "#a89070"; g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 6; k++) { const aa = (k / 6) * TAU, rr2 = sz * (0.7 + 0.5 * hs(i * 5 + k)); k ? g.lineTo(Math.cos(aa) * rr2, Math.sin(aa) * rr2) : g.moveTo(Math.cos(aa) * rr2, Math.sin(aa) * rr2); } g.closePath(); g.fill(); g.stroke(); g.restore(); }
      });
      break;
    }
  }
}

/* ---------- particles ---------- */
export function boom13(s: F13, emit0: Emit) {
  const emit: Emit = (o) => emit0({ grow: 0, ...o });
  const { x, y, r } = s, R = Math.max(r, 80);
  const spray = (n: number, cols: string[], kind: string, v0: number, v1: number, extra: Record<string, unknown> = {}) => {
    for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(v0, v1); emit({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 60, g: 360, life: rnd(0.5, 1.2), max: 1.2, size: rnd(2, 4.5), color: cols[i % cols.length], ...extra }); }
  };
  const flash = (col: string, k = 1) => { emit({ kind: "glow", x, y, vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, size: R * 0.4 * k, grow: R * 1.6 * k, color: col }); emit({ kind: "ring", x, y, vx: 0, vy: 0, g: 0, life: 0.55, max: 0.55, size: 8, grow: R * 3 * k, color: col }); };
  switch (s.id) {
    case "profanerain": flash("#a040ff"); spray(34, ["#ffb060", "#ffd890", "#c890ff"], "spark", 160, 520); break;
    case "toxicshield": flash("#5dffb0"); spray(24, ["#b6ff40", "#5dffb0"], "spark", 120, 360); break;
    case "smokeshell": case "savagedischarge": flash("#8fd0ff"); spray(30, ["#ffffff", "#7ab0ff", "#ffb060"], "spark", 120, 480); break;
    case "poisondome": flash("#a6ff3a", 0.8); spray(16, ["#d8ff70", "#8aff30"], "bubble", 40, 200, { g: -30 }); break;
    case "inkzone": flash("#4ab0c0", 0.8); spray(40, ["#04080e", "#0a1a24"], "dot", 120, 560, { g: 700, size: rnd(2.5, 6.5) }); break;
    case "plasmaburst": flash("#ffffff", 1.2); spray(36, ["#ffffff", "#a8b0ff", "#ffe66a"], "spark", 160, 600); break;
    case "zealousfear": flash("#6aff5a", 0.8); spray(22, ["#6fcf4a", "#b4f06a"], "leaf", 80, 300, { g: 120, rot: rnd(0, 6), vr: rnd(-10, 10), size: rnd(3.5, 6) }); break;
    case "cosmicrequiem": flash("#8aa8ff"); spray(30, ["#a8c8ff", "#ffd8ff", "#7ad8ff"], "star", 60, 260, { g: -10, rot: rnd(0, 3), vr: rnd(-4, 4), size: rnd(2.5, 5) }); break;
    case "scorchedtwilight": flash("#ff9a3a", 1); spray(20, ["#ff8a1a", "#ffd870"], "spark", 140, 480); spray(16, ["#bff0ff", "#ffffff"], "shard", 120, 420, { g: 300, rot: rnd(0, 6), vr: rnd(-12, 12) }); break;
    case "vigilance": flash("#bcdcff", 1.1); spray(26, ["#ffffff", "#8cc8ff"], "star", 60, 300, { g: -60, rot: rnd(0, 3), vr: rnd(-5, 5) }); break;
    case "rupturehit": flash("#ffb060", 1.2); spray(34, ["#ffc060", "#ff7a2a"], "spark", 160, 620); spray(18, ["#5a4a3a", "#7a6a58"], "plank", 140, 420, { g: 800, rot: rnd(0, 6), vr: rnd(-12, 12), size: rnd(3, 6) }); break;
    case "malignantwrath": flash("#ffe8a0", 1.2); spray(22, ["#ffb060", "#fff0c0"], "spark", 140, 460); spray(14, ["#4a3a2c", "#6a5a48"], "plank", 120, 380, { g: 800, rot: rnd(0, 6), vr: rnd(-12, 12), size: rnd(3.5, 7) }); break;
  }
}

export function tick13(s: F13, dt: number, emit0: Emit) {
  const emit: Emit = (o) => emit0({ grow: 0, ...o });
  s.acc += dt; const step = 0.06; if (s.acc < step) return; s.acc -= step;
  const u = s.t / s.life; if (u > 0.78) return;
  const { x, y, r } = s, R = Math.max(r, 80);
  const px = () => x + rnd(-R, R) * 0.8, py = () => y + rnd(-R, R) * 0.3;
  switch (s.id) {
    case "profanerain": emit({ kind: "spark", x: px(), y: py(), vx: rnd(-40, 40), vy: rnd(-120, -30), g: 200, life: rnd(0.4, 0.8), max: 0.8, size: rnd(1.6, 3), color: Math.random() < 0.5 ? "#ffb060" : "#c890ff" }); break;
    case "toxicshield": emit({ kind: "dot", x: px(), y: py(), vx: rnd(-20, 20), vy: rnd(-90, -30), g: -20, life: rnd(0.6, 1.2), max: 1.2, size: rnd(2, 4), color: Math.random() < 0.5 ? "#8aff40" : "#9a50d0" }); break;
    case "smokeshell": emit({ kind: "glow", x: px(), y: y - rnd(0, R) * 0.9, vx: rnd(-10, 10), vy: rnd(-30, -5), g: 0, life: rnd(0.8, 1.4), max: 1.4, size: rnd(3, 6), color: "#8fb8ff" }); break;
    case "poisondome": emit({ kind: "bubble", x: px(), y: py(), vx: rnd(-10, 10), vy: rnd(-50, -15), g: -10, life: rnd(0.8, 1.5), max: 1.5, size: rnd(3, 6), color: "#b6ff50" }); break;
    case "inkzone": if (Math.random() < 0.5) emit({ kind: "dot", x: px(), y: py(), vx: rnd(-60, 60), vy: rnd(-200, -80), g: 700, life: rnd(0.5, 0.9), max: 0.9, size: rnd(2, 4.5), color: "#04080e" }); break;
    case "plasmaburst": emit({ kind: "spark", x: px(), y: py(), vx: rnd(-30, 30), vy: rnd(-160, -60), g: 0, life: rnd(0.6, 1.1), max: 1.1, size: rnd(1.6, 3), color: Math.random() < 0.5 ? "#c8c0ff" : "#ffffff" }); break;
    case "zealousfear": emit({ kind: "leaf", x: px(), y: py(), vx: rnd(-40, 40), vy: rnd(-90, -30), g: 20, life: rnd(0.8, 1.4), max: 1.4, size: rnd(3, 5.5), rot: rnd(0, 6), vr: rnd(-6, 6), color: Math.random() < 0.5 ? "#6fcf4a" : "#a89050" }); break;
    case "savagedischarge": { const a = rnd(-0.6, 0.6); emit({ kind: "spark", x: x + rnd(-10, 10), y: y - R * 0.5, vx: Math.cos(a) * rnd(200, 460), vy: Math.sin(a) * rnd(100, 200) - 30, g: 120, life: rnd(0.4, 0.8), max: 0.8, size: rnd(1.6, 3), color: Math.random() < 0.5 ? "#ffb04a" : "#7ae8ff" }); break; }
    case "cosmicrequiem": { const a = rnd(0, TAU), d = R * rnd(0.4, 1); emit({ kind: "star", x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.4, vx: Math.cos(a + 1.57) * 30, vy: rnd(-50, -15), g: 0, life: rnd(0.8, 1.5), max: 1.5, size: rnd(2, 4), rot: rnd(0, 3), vr: rnd(-3, 3), color: Math.random() < 0.5 ? "#a8c8ff" : "#ffd8ff" }); break; }
    case "vigilance": emit({ kind: "spark", x: px(), y: py(), vx: rnd(-20, 20), vy: rnd(-200, -80), g: -40, life: rnd(0.7, 1.3), max: 1.3, size: rnd(1.6, 3), color: Math.random() < 0.5 ? "#cfe8ff" : "#ffe9a8" }); break;
    case "rupturehit": if (u < 0.35) emit({ kind: "spark", x: px(), y: py(), vx: rnd(-200, 200), vy: rnd(-300, -60), g: 500, life: rnd(0.4, 0.9), max: 0.9, size: rnd(1.6, 3), color: Math.random() < 0.5 ? "#ffc060" : "#ff7a2a" }); break;
    case "malignantwrath": emit({ kind: "spark", x: px(), y: py(), vx: rnd(-60, 60), vy: rnd(-200, -60), g: 220, life: rnd(0.5, 1), max: 1, size: rnd(1.6, 3), color: Math.random() < 0.6 ? "#ffb060" : "#fff0c0" }); break;
  }
}

/* ---------- projectile art (origin on the shot) ---------- */
export function drawShot13(g: G, id: string, ang: number, r: number, age: number, t: number) {
  const R = Math.max(14, r * 1.5), k = Math.min(1, age / 0.15);
  g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
  if (id === "plasmaburst") {
    // trailing arcs
    const fr = Math.floor(t * 20); g.save(); g.rotate(ang + Math.PI);
    for (let i = 0; i < 5; i++) { g.globalAlpha = 0.9 * k; bolt(g, 0, 0, R * (2.4 + 1.8 * hs(i + fr)), (hs(i * 3 + fr) - 0.5) * R * 2.2, fr * 7 + i * 5, R * 0.6, "#8f9cff", 1.5); }
    g.restore();
    // static cloud, core, radial glints
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 2; puff(g, Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, R * 0.8, "120,100,255", 0.35 * k); }
    puff(g, 0, 0, R * 1.6, "150,150,255", 0.55 * k); puff(g, 0, 0, R * 0.9, "255,255,255", k);
    g.save(); g.rotate(t * 1.4); star(g, R * 1.7, 12, "170,170,255", 0.9 * k); g.restore();
    for (let i = 0; i < 12; i++) { const a = hs(i) * TAU + t * (1 + hs(i + 2)), d = R * (1 + 1.6 * ((hs(i + 5) + t) % 1)); g.globalAlpha = 0.8 * k; g.fillStyle = i % 2 ? "#ffffff" : "#cfd0ff"; g.fillRect(Math.cos(a) * d, Math.sin(a) * d, 2, 2); }
  } else {
    // scorched twilight: a flame blade head, twin wisps of cold beam behind, ice particles tumbling alongside
    g.save(); g.rotate(ang);
    for (let j = 0; j < 2; j++) {
      g.strokeStyle = j ? "rgba(255,170,90,.85)" : "rgba(130,225,255,.9)"; g.lineWidth = 4 - j; g.globalAlpha = k;
      g.beginPath(); for (let i = 0; i <= 18; i++) { const q = i / 18, x = -q * R * 6, y = Math.sin(q * 8 - t * 12 + j * Math.PI) * R * 0.38 * q; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    for (const [col, sx, a] of [["rgba(255,90,20,.8)", 1.15, 1], ["rgba(255,170,50,.95)", 0.8, 1], ["rgba(255,245,200,1)", 0.45, 1]] as const) {
      g.fillStyle = col; g.globalAlpha = a * k; g.beginPath(); g.moveTo(R * 1.7 * sx, 0); g.quadraticCurveTo(R * 0.3 * sx, -R * 1.0 * sx, -R * 2.6 * sx, -R * (0.1 + 0.15 * Math.sin(t * 20)) * sx); g.lineTo(-R * 3.2 * sx, R * 0.05); g.quadraticCurveTo(R * 0.2 * sx, R * 0.9 * sx, R * 1.7 * sx, 0); g.fill();
    }
    g.globalCompositeOperation = "source-over";
    for (let i = 0; i < 9; i++) { const q = (hs(i) + t * 0.9) % 1, x = R * 0.8 - q * R * 6, y = (hs(i + 3) - 0.5) * R * 2.8 * (0.4 + q); g.globalAlpha = k * (1 - q); shard(g, x, y, 5 + 5 * hs(i + 7), 2.5 + 2 * hs(i + 2), t * 4 + i, "rgba(220,245,255,.95)", "rgba(110,190,255,.7)", "#ffffff"); }
    g.restore();
  }
  g.restore();
}
