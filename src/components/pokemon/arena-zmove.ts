/**
 * The Z-Move cinematic: one hand-built show per type (18), all drawn in layers over a darkened, push-in backdrop with
 * textured surfaces (lava, water, bark, ice, stone, scales, shade…), glow, particles and a type-coloured finale.
 * Everything here is defensive: every radius/width is clamped, every value is checked finite, the whole scene runs
 * inside save()/restore() with a try/catch, and nothing leaves the canvas with a changed blend mode or alpha. Nothing
 * ever fills the screen with white: the strongest overlay is a tinted bloom capped well below full strength.
 */
import { texPat, type TexKind } from "./arena-tex";
import type { SpecCtx, SP } from "./arena-spec";
import { layeredBurst } from "./arena-layers";
import { typePal } from "./arena-vfx";

const TAU = Math.PI * 2;
const W = 960, H = 600;
const hs = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const cl = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a);
const sm = (a: number, b: number, x: number) => { const k = cl((x - a) / (b - a || 1), 0, 1); return k * k * (3 - 2 * k); };
const R = (r: number) => Math.max(0.5, Number.isFinite(r) ? r : 0.5);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

type Z = { g: CanvasRenderingContext2D; t: number; p: number; a: number; x: number; y: number };

/* ----------------------------------------------------------------- building blocks */

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, c0: string, c1: string, alpha: number) {
  const rr = R(r);
  const gr = g.createRadialGradient(x, y, 0, x, y, rr);
  gr.addColorStop(0, c0);
  gr.addColorStop(0.45, c1);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.save();
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = cl(alpha, 0, 1);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, rr, 0, TAU);
  g.fill();
  g.restore();
}

/** A sphere with a texture through it, light from the top left and a hot rim. */
function texBall(g: CanvasRenderingContext2D, x: number, y: number, r: number, tex: TexKind, t: number, alpha: number, rim: string) {
  const rr = R(r);
  g.save();
  g.globalAlpha = cl(alpha, 0, 1);
  g.beginPath();
  g.arc(x, y, rr, 0, TAU);
  g.clip();
  g.fillStyle = texPat(g, tex, x + t * 90, y + t * 40, rr / 38, t * 0.4);
  g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  const sh = g.createRadialGradient(x - rr * 0.35, y - rr * 0.4, rr * 0.1, x, y, rr * 1.05);
  sh.addColorStop(0, "rgba(255,255,255,.5)");
  sh.addColorStop(0.5, "rgba(255,255,255,0)");
  sh.addColorStop(1, "rgba(0,0,0,.55)");
  g.fillStyle = sh;
  g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  g.restore();
  g.save();
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = cl(alpha * 0.8, 0, 1);
  g.strokeStyle = rim;
  g.lineWidth = Math.max(1, rr * 0.07);
  g.beginPath();
  g.arc(x, y, rr, 0, TAU);
  g.stroke();
  g.restore();
}

/** A filled band along a wavy line, textured. */
function band(g: CanvasRenderingContext2D, tex: TexKind, pts: [number, number][], thick: number, alpha: number, t: number, scale = 0.8) {
  if (pts.length < 2) return;
  g.save();
  g.globalAlpha = cl(alpha, 0, 1);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = texPat(g, tex, t * 60, t * 25, scale, 0);
  g.lineWidth = Math.max(1, thick);
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  g.restore();
}

function streaks(Zc: Z, n: number, color: string, len: number, speed: number, ang: number, width = 1.6, alpha = 0.7) {
  const { g, t, a } = Zc;
  g.save();
  g.globalCompositeOperation = "lighter";
  g.strokeStyle = color;
  g.lineCap = "round";
  const ux = Math.cos(ang), uy = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const ph = (t * speed * (0.6 + hs(i + 3)) + hs(i)) % 1;
    const x = hs(i + 1) * (W + 200) - 100 + ux * ph * 700 - ux * 350, y = hs(i + 2) * (H + 200) - 100 + uy * ph * 700 - uy * 350;
    g.globalAlpha = cl(a * alpha * Math.sin(ph * Math.PI), 0, 1);
    g.lineWidth = width * (0.5 + hs(i + 4));
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + ux * len * (0.5 + hs(i + 5)), y + uy * len * (0.5 + hs(i + 5)));
    g.stroke();
  }
  g.restore();
}

function ringGlyph(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot: number, alpha: number, ticks = 12) {
  g.save();
  g.translate(x, y);
  g.scale(1, 0.55);
  g.rotate(rot);
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = cl(alpha, 0, 1);
  g.strokeStyle = color;
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(0, 0, R(r), 0, TAU); g.stroke();
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(0, 0, R(r * 0.82), 0, TAU); g.stroke();
  for (let i = 0; i < ticks; i++) { const a = (i / ticks) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
  g.beginPath();
  for (let i = 0; i <= 5; i++) { const a = ((i * 2) / 5) * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * r * 0.64, Math.sin(a) * r * 0.64); }
  g.stroke();
  g.restore();
}

function bolt(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number, color: string, w: number, alpha: number, depth = 3) {
  const pts: [number, number][] = [[x1, y1]];
  const seg = 9;
  const nx = -(y2 - y1), ny = x2 - x1;
  const nl = Math.hypot(nx, ny) || 1;
  for (let i = 1; i < seg; i++) {
    const k = i / seg;
    const off = (hs(seed + i * 3.1) - 0.5) * 70 * Math.sin(k * Math.PI);
    pts.push([x1 + (x2 - x1) * k + (nx / nl) * off, y1 + (y2 - y1) * k + (ny / nl) * off]);
  }
  pts.push([x2, y2]);
  g.save();
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round"; g.lineJoin = "round";
  for (const [lw, c, al] of [[w * 4, color, 0.18], [w * 1.6, color, 0.6], [w * 0.6, "#ffffff", 1]] as const) {
    g.globalAlpha = cl(alpha * al, 0, 1);
    g.strokeStyle = c;
    g.lineWidth = Math.max(0.5, lw);
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }
  g.restore();
  if (depth > 0) {
    const k = 3 + Math.floor(hs(seed) * 3);
    const [bx, by] = pts[k]!;
    bolt(g, bx, by, bx + (hs(seed + 7) - 0.5) * 260, by + hs(seed + 9) * 140 + 30, seed + 11, color, w * 0.6, alpha * 0.7, depth - 1);
  }
}

/* ----------------------------------------------------------------- the 18 shows */

const SCENES: Record<string, (Zc: Z, c: string) => void> = {
  Normal(Zc) {
    const { g, t, p, a, x, y } = Zc;
    streaks(Zc, 60, "#fff4c8", 220, 1.6, Math.atan2(y - H / 2, x - W / 2) + Math.PI, 2.2, 0.9);
    for (let i = 0; i < 3; i++) {
      const k = sm(0.05 + i * 0.12, 0.7 + i * 0.1, p);
      ringGlyph(g, x, y + 30, 70 + k * 330, i % 2 ? "#ffffff" : "#ffd54a", t * (1 + i * 0.4) * (i % 2 ? -1 : 1), a * 0.8);
    }
    const k = sm(0.2, 1, p);
    glow(g, x, y, 60 + k * 180, "#ffffff", "#ffd54a", a * 0.85);
    // a ring of puffed cloud kicked outward
    for (let i = 0; i < 18; i++) {
      const an = (i / 18) * TAU, d = 90 + k * 260;
      glow(g, x + Math.cos(an) * d, y + 30 + Math.sin(an) * d * 0.45, 34 + k * 22, "#ffffff", "#c8c8d8", a * 0.35);
    }
  },

  Fire(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // the meteor: a textured lava sphere crashing in from the upper left, with a long flame tail
    const k = sm(0.08, 0.9, p);
    const sl = STRAIGHT ? 0 : 1;
    // in the player views it drops straight down and burns as a flat pit on the floor, not as a ball standing in the air
    const gy = cl(y + 10, H * 0.42, H * 0.78);
    const land = STRAIGHT ? sm(0.06, 0.58, p) : k;
    const fx = x + (W / 2 - x) * 0.4 - (1 - k) * 380 * sl, fy = STRAIGHT ? -140 + (gy + 140) * land : -140 + (H * 0.52 + 140) * k;
    const r = 60 + k * 110;
    const pit = STRAIGHT ? sm(0.55, 0.78, p) : 0;
    const ball = a * (STRAIGHT ? 1 - sm(0.5, 0.62, p) : 1);
    for (let i = 0; i < 26; i++) {
      const tk = i / 26;
      const tx = fx - (190 * tk * (1 - k * 0.2) + 40 * tk) * sl, ty = fy - 300 * tk * (1 - k * 0.2) - 40 * tk;
      glow(g, tx + Math.sin(t * 20 + i) * 8, ty, r * (1 - tk * 0.6), i % 2 ? "#ffb02e" : "#ff5a1a", "#7a1604", ball * (0.55 - tk * 0.5));
    }
    if (ball > 0.02) {
      texBall(g, fx, fy, r, "lava", t, ball, "#ffd36a");
      glow(g, fx, fy, r * 2.2, "#fff2b0", "#ff6a1a", ball * 0.7);
    }
    if (pit > 0.01) {
      // the pit: the same lava seen lying flat on the floor, with a bright rim and heat shimmer, flames licking up from it
      const pr = 60 + pit * 80;
      g.save();
      g.translate(fx, gy);
      g.scale(1, 0.3);
      glow(g, 0, 0, pr * 1.7, "#ff8a1f", "#7a1604", a * pit * 0.6);
      texBall(g, 0, 0, pr, "lava", t, a * pit, "#ffd36a");
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = a * pit * 0.8;
      g.strokeStyle = "#ffe27a";
      g.lineWidth = 6;
      g.beginPath();
      g.arc(0, 0, pr * (1 + 0.04 * Math.sin(t * 9)), 0, TAU);
      g.stroke();
      g.restore();
      for (let i = 0; i < 14; i++) {
        const an = hs(i + 40) * TAU, d = Math.sqrt(hs(i + 50)) * pr * 0.9, ph = (t * (1.2 + hs(i + 60)) + hs(i)) % 1;
        glow(g, fx + Math.cos(an) * d, gy + Math.sin(an) * d * 0.3 - ph * 70, 10 + hs(i + 70) * 10, i % 2 ? "#ffb02e" : "#fff2b0", "#ff5a1a", a * pit * (1 - ph) * 0.8);
      }
    }
    // heat rings off the sphere and a river of lava glowing on the ground below
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) { g.globalAlpha = ball * 0.3 * (1 - i / 3); g.strokeStyle = "#ffb02e"; g.lineWidth = 3; g.beginPath(); g.ellipse(fx, fy, R(r * (1.3 + i * 0.35 + (t * 1.4) % 0.35)), R(r * (1.3 + i * 0.35) * 0.9), 0, 0, TAU); g.stroke(); }
    g.restore();
    glow(g, W / 2, H * 0.92, 520 * k, "#ff8a1f", "#7a1604", a * 0.5);
    for (let i = 0; i < 64; i++) {
      const ex = hs(i) * W, ey = H - ((t * (110 + hs(i + 9) * 240) + hs(i + 3) * H) % (H + 40)) + 20;
      glow(g, ex + Math.sin(t * 3 + i) * 12, ey, 3 + hs(i + 5) * 5, i % 3 ? "#ffb02e" : "#fff2b0", "#ff5a1a", a * 0.9);
    }
  },

  Water(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a tsunami wall sweeping across, layered textured bands with foam, and a whirl at the caster
    const k = sm(0.05, 0.95, p);
    for (let l = 0; l < 5; l++) {
      const baseY = H * (0.9 - k * 0.6) + l * 26;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 24; i++) { const px = (i / 24) * (W + 80) - 40; pts.push([px, baseY + Math.sin(px * 0.02 + t * (3 + l) + l) * (24 + l * 6) * (1 + k * 0.4)]); }
      band(g, "water", pts, 90 + l * 16, a * (0.55 - l * 0.07), t * (1 + l * 0.2), 0.9);
    }
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 90; i++) {
      const px = hs(i) * W, py = H * (0.9 - k * 0.6) + Math.sin(px * 0.02 + t * 3) * 24 - hs(i + 2) * 50;
      g.globalAlpha = a * 0.8; g.fillStyle = i % 3 ? "#e8f7ff" : "#8fd3ff"; g.beginPath(); g.arc(px, py, 1.5 + hs(i + 4) * 3.5, 0, TAU); g.fill();
    }
    for (let i = 0; i < 6; i++) { g.save(); g.translate(x, y + 36); g.scale(1, 0.5); g.rotate(t * (2 + i * 0.3) * (i % 2 ? -1 : 1)); g.globalAlpha = a * 0.7; g.strokeStyle = i % 2 ? "#bfe9ff" : "#3da0ff"; g.lineWidth = 6 - i * 0.6; g.setLineDash([50 + i * 12, 34]); g.beginPath(); g.arc(0, 0, R(70 + i * 46 * (0.4 + p)), 0, TAU); g.stroke(); g.restore(); }
    g.restore();
    glow(g, x, y, 200, "#e8f7ff", "#2f86e0", a * 0.5);
  },

  Electric(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a bruised storm ceiling, forking bolts that hammer the field, and a plasma ball at the caster
    for (let i = 0; i < 22; i++) glow(g, hs(i) * W, 30 + hs(i + 3) * 60, 90 + hs(i + 6) * 60, "#6a5aa8", "#1a1840", a * 0.55);
    const strikes = Math.floor(t * 9);
    for (let s = Math.max(0, strikes - 3); s <= strikes; s++) {
      const age = (t * 9 - s) / 3;
      if (age < 0 || age > 1) continue;
      const sx = hs(s * 7 + 1) * W * 0.9 + W * 0.05;
      bolt(g, sx + (STRAIGHT ? 0 : (hs(s) - 0.5) * 120), 20, sx, H * (0.5 + hs(s + 3) * 0.4), s * 13 + 5, "#ffe14d", 3.2, a * (1 - age), 2);
      glow(g, sx, H * (0.6 + hs(s + 3) * 0.3), 120, "#ffffff", "#ffd21a", a * (1 - age) * 0.7);
    }
    const k = sm(0.1, 1, p);
    glow(g, x, y, 60 + k * 120, "#ffffff", "#6aa0ff", a * 0.9);
    for (let i = 0; i < 7; i++) { const an = t * 6 + i * 0.9; bolt(g, x, y, x + Math.cos(an) * (110 + k * 160), y + Math.sin(an) * (80 + k * 110), i * 5 + Math.floor(t * 14), "#9ad0ff", 2, a * 0.8, 0); }
    // crackling frame on the screen edge
    for (let i = 0; i < 6; i++) bolt(g, i % 2 ? 0 : W, hs(i + Math.floor(t * 10)) * H, i % 2 ? 90 : W - 90, hs(i + 9 + Math.floor(t * 10)) * H, i * 9 + Math.floor(t * 10), "#ffe14d", 1.6, a * 0.5, 0);
  },

  Grass(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // vines climbing from the bottom with leaves, and a giant flower opening behind the caster
    for (let v = 0; v < 7; v++) {
      const bx = (v + 0.5) * (W / 7) + (hs(v) - 0.5) * 40;
      const k = sm(0.05 + v * 0.03, 0.85, p);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 18; i++) { const q = (i / 18) * k; pts.push([bx + Math.sin(q * 9 + v + t) * 34 * q, H - q * H * 0.95]); }
      band(g, "grass", pts, 14 - v * 0.5, a * 0.9, t, 0.5);
      for (let i = 2; i < pts.length; i += 2) { const [lx, ly] = pts[i]!; g.save(); g.translate(lx, ly); g.rotate((i % 4 ? 1 : -1) * 0.9); g.globalAlpha = a * 0.9; g.fillStyle = texPat(g, "grass", t * 30, 0, 0.5, 0); g.beginPath(); g.ellipse(18, 0, 22, 8, 0, 0, TAU); g.fill(); g.restore(); }
    }
    const open = sm(0.25, 0.9, p);
    g.save(); g.translate(W / 2, H * 0.4); g.globalAlpha = a * 0.85;
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 10; i++) {
      g.save(); g.rotate((i / 10) * TAU + ring * 0.3 + t * 0.2); g.fillStyle = ring % 2 ? "#ff9ad0" : "#ffd0ea"; g.beginPath(); g.ellipse(0, -(40 + ring * 34) * open - 20, (16 + ring * 6) * open, (46 + ring * 14) * open, 0, 0, TAU); g.fill(); g.restore();
    }
    g.restore();
    glow(g, W / 2, H * 0.4, 70 + open * 70, "#fff7c2", "#ffd21a", a * 0.9);
    for (let i = 0; i < 46; i++) { g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * 0.8; g.fillStyle = i % 2 ? "#c9f08a" : "#ffffff"; g.beginPath(); g.ellipse(hs(i) * W + Math.sin(t * 2 + i) * 20, ((t * 90 + hs(i + 4) * H) % (H + 20)) - 10, 5, 3, t + i, 0, TAU); g.fill(); g.restore(); }
    glow(g, x, y, 130, "#e8ffd0", "#6bd45a", a * 0.55);
  },

  Ice(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a frost circle freezing outward, ice spires thrusting up, snow and a frozen vignette
    const k = sm(0.05, 0.8, p);
    ringGlyph(g, W / 2, H * 0.62, 120 + k * 520, "#bfefff", t * 0.4, a * 0.9, 18);
    ringGlyph(g, W / 2, H * 0.62, 80 + k * 360, "#ffffff", -t * 0.6, a * 0.7, 10);
    for (let i = 0; i < 17; i++) {
      const bx = (i + 0.5) * (W / 17) + (hs(i) - 0.5) * 20, kk = sm(0.1 + hs(i + 1) * 0.35, 0.8, p), hgt = (110 + hs(i + 2) * 260) * kk;
      g.save(); g.globalAlpha = a * 0.92;
      g.beginPath(); g.moveTo(bx - 20, H); g.lineTo(bx - 4, H - hgt); g.lineTo(bx + 20, H); g.closePath();
      g.fillStyle = texPat(g, "ice", bx, 0, 0.7, 0.3); g.fill();
      g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.moveTo(bx - 20, H); g.lineTo(bx - 4, H - hgt); g.lineTo(bx - 6, H); g.closePath(); g.fill();
      g.globalCompositeOperation = "lighter"; g.strokeStyle = "#e8fbff"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx - 20, H); g.lineTo(bx - 4, H - hgt); g.lineTo(bx + 20, H); g.stroke(); g.restore();
    }
    for (let i = 0; i < 110; i++) { g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * 0.85; g.fillStyle = "#ffffff"; g.beginPath(); g.arc((hs(i) * W + t * 40 * (1 + hs(i + 3))) % W, (t * 130 * (0.5 + hs(i + 2)) + hs(i + 7) * H) % H, 1.2 + hs(i + 5) * 2.4, 0, TAU); g.fill(); g.restore(); }
    const gr = g.createRadialGradient(W / 2, H / 2, 240, W / 2, H / 2, 640);
    gr.addColorStop(0, "rgba(120,200,255,0)"); gr.addColorStop(1, `rgba(120,200,255,${0.45 * a})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    glow(g, x, y, 120, "#ffffff", "#7ad0f0", a * 0.6);
  },

  Fighting(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // manga speed-lines closing on the middle, a flurry of impact starbursts with shockwaves and flying rubble
    g.save(); g.globalCompositeOperation = "lighter"; g.strokeStyle = "#ffd0a0";
    for (let i = 0; i < 70; i++) { const an = hs(i) * TAU, d0 = 260 + hs(i + 1) * 200 - ((t * 700 + i * 31) % 380) * 0.4, d1 = d0 + 120 + hs(i + 2) * 200; g.globalAlpha = a * 0.55; g.lineWidth = 1 + hs(i + 3) * 2.2; g.beginPath(); g.moveTo(W / 2 + Math.cos(an) * d0 * 1.5, H / 2 + Math.sin(an) * d0 * 0.95); g.lineTo(W / 2 + Math.cos(an) * d1 * 1.5, H / 2 + Math.sin(an) * d1 * 0.95); g.stroke(); }
    g.restore();
    const n = Math.floor(t * 14);
    for (let s = Math.max(0, n - 4); s <= n; s++) {
      const age = (t * 14 - s) / 4; if (age < 0 || age > 1) continue;
      const sx = W / 2 + (hs(s * 3 + 1) - 0.5) * 380, sy = H / 2 + (hs(s * 3 + 2) - 0.5) * 220, r = 40 + (1 - age) * 70;
      g.save(); g.translate(sx, sy); g.rotate(hs(s) * TAU); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * (1 - age);
      g.fillStyle = s % 2 ? "#ffd54a" : "#ff7a3c"; g.beginPath();
      for (let i = 0; i < 16; i++) { const rr = i % 2 ? r * 0.45 : r * 1.4; g.lineTo(Math.cos((i / 16) * TAU) * rr, Math.sin((i / 16) * TAU) * rr); }
      g.closePath(); g.fill(); g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.stroke(); g.restore();
      g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * (1 - age) * 0.6; g.strokeStyle = "#ffe9c0"; g.lineWidth = 3; g.beginPath(); g.ellipse(sx, sy + 20, R(r * 2 * age + 10), R(r * 0.9 * age + 5), 0, 0, TAU); g.stroke(); g.restore();
    }
    for (let i = 0; i < 26; i++) { const ph = (t * 1.2 + hs(i)) % 1; g.save(); g.translate(W / 2 + (hs(i + 1) - 0.5) * 700 * ph, H * 0.6 - Math.sin(ph * Math.PI) * 260 * hs(i + 2)); g.rotate(t * 4 + i); g.globalAlpha = a * (1 - ph); g.fillStyle = texPat(g, "rock", i * 11, 0, 0.5, 0); g.fillRect(-7, -5, 14, 10); g.restore(); }
    glow(g, x, y, 110, "#fff0d0", "#ff7a3c", a * 0.6);
  },

  Poison(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // toxic rain, a bubbling venom pool rising from the bottom and drifting gas
    g.save(); g.globalCompositeOperation = "lighter"; g.strokeStyle = "#8dff5a"; g.lineCap = "round";
    for (let i = 0; i < 80; i++) { const ph = (t * (1.1 + hs(i + 3)) + hs(i)) % 1; g.globalAlpha = a * 0.7 * Math.sin(ph * Math.PI); g.lineWidth = 1.4 + hs(i + 4) * 1.4; const px = hs(i + 1) * W; const sl = STRAIGHT ? 0 : 1; g.beginPath(); g.moveTo(px - 30 * ph * sl, ph * H * 1.1 - 40); g.lineTo(px - 38 * ph * sl, ph * H * 1.1 + 4); g.stroke(); }
    g.restore();
    const k = sm(0.05, 0.9, p);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 30; i++) { const px = (i / 30) * (W + 60) - 30; pts.push([px, H - k * 190 + Math.sin(px * 0.03 + t * 3) * 10]); }
    band(g, "venom", pts, 220 * k + 20, a * 0.9, t, 0.9);
    for (let i = 0; i < 38; i++) { const ph = (t * (0.5 + hs(i + 2)) + hs(i)) % 1; const bx = hs(i + 5) * W, by = H - k * 170 - ph * 280, r = 6 + hs(i + 7) * 20 * (1 - ph * 0.5); g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * 0.7 * (1 - ph); g.strokeStyle = "#b8ff7a"; g.fillStyle = "rgba(120,255,80,.18)"; g.lineWidth = 1.6; g.beginPath(); g.arc(bx, by, R(r), 0, TAU); g.fill(); g.stroke(); g.restore(); }
    for (let i = 0; i < 12; i++) glow(g, hs(i) * W + Math.sin(t + i) * 40, H * 0.5 + hs(i + 3) * 200, 100, "#9a3ad8", "#2a0a4a", a * 0.32);
    glow(g, x, y, 130, "#e0ffc0", "#5ac22a", a * 0.55);
  },

  Ground(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // the floor splits: glowing fissures race outward, stone pillars thrust up, dust and falling gravel
    const k = sm(0.05, 0.75, p);
    g.save(); g.lineCap = "round"; g.lineJoin = "round";
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * TAU + hs(i) * 0.3; let px = W / 2, py = H * 0.62;
      g.beginPath(); g.moveTo(px, py);
      const steps = Math.floor(14 * k);
      for (let s = 1; s <= steps; s++) { px += Math.cos(an + (hs(i * 7 + s) - 0.5) * 0.9) * 46; py += Math.sin(an + (hs(i * 7 + s + 3) - 0.5) * 0.9) * 28; g.lineTo(px, py); }
      for (const [w, c, al] of [[10, "#1a0e06", 0.9], [5, "#d8a050", 0.9], [2, "#fff0b0", 1]] as const) { g.globalAlpha = a * al; g.strokeStyle = c; g.lineWidth = w; g.stroke(); }
    }
    g.restore();
    for (let i = 0; i < 9; i++) {
      const bx = (i + 0.5) * (W / 9), kk = sm(0.15 + hs(i) * 0.3, 0.8, p), hgt = (120 + hs(i + 1) * 220) * kk, w = 46 + hs(i + 2) * 30;
      g.save(); g.globalAlpha = a; g.fillStyle = texPat(g, "rock", bx, t * 20, 0.8, 0); g.beginPath(); g.moveTo(bx - w / 2, H); g.lineTo(bx - w / 2 + 6, H - hgt); g.lineTo(bx + w / 2 - 8, H - hgt - 14); g.lineTo(bx + w / 2, H); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,240,200,.2)"; g.fillRect(bx - w / 2 + 6, H - hgt, 7, hgt); g.strokeStyle = "#2a1a0a"; g.lineWidth = 2; g.stroke(); g.restore();
    }
    for (let i = 0; i < 6; i++) glow(g, hs(i) * W, H - 30, 130 + 40 * Math.sin(t * 2 + i), "#d8b88a", "#7a5a38", a * 0.4);
    for (let i = 0; i < 40; i++) { const ph = (t * 1.3 + hs(i)) % 1; g.save(); g.globalAlpha = a * 0.9; g.fillStyle = "#9b8a6a"; g.beginPath(); g.arc(hs(i + 1) * W, ph * H, 2 + hs(i + 2) * 4, 0, TAU); g.fill(); g.restore(); }
    glow(g, x, y, 110, "#fff0c0", "#c89a2a", a * 0.5);
  },

  Flying(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a rushing tunnel of cloud, razor wind streaks, feathers and a vortex of wind around the caster
    streaks(Zc, 70, "#eaf6ff", 260, 2.2, -0.35, 2, 0.85);
    for (let i = 0; i < 16; i++) { const ph = (t * 1.4 + hs(i)) % 1; glow(g, W * (1.15 - ph * 1.4), hs(i + 1) * H, 90 + hs(i + 2) * 60, "#ffffff", "#9ab8d8", a * 0.4 * Math.sin(ph * Math.PI)); }
    for (let i = 0; i < 5; i++) { g.save(); g.translate(x, y + 20); g.scale(1, 0.5); g.rotate(t * 3 * (i % 2 ? -1 : 1)); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * 0.7; g.strokeStyle = "#ffffff"; g.lineWidth = 4; g.setLineDash([80, 60]); g.beginPath(); g.arc(0, 0, R(70 + i * 55 + p * 120), 0, TAU); g.stroke(); g.restore(); }
    for (let i = 0; i < 18; i++) { const ph = (t * 0.8 + hs(i)) % 1; g.save(); g.translate(W * (1 - ph) + 40, hs(i + 1) * H + Math.sin(t * 4 + i) * 30); g.rotate(-0.4 + Math.sin(t * 5 + i) * 0.4); g.globalAlpha = a * 0.9 * Math.sin(ph * Math.PI); g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(0, 0, 22, 5, 0, 0, TAU); g.fill(); g.restore(); }
    glow(g, x, y, 160, "#ffffff", "#7ac8e8", a * 0.55);
  },

  Psychic(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a vast psychic eye opening, concentric force rings, a rune sphere and hovering shards
    const k = sm(0.05, 0.6, p);
    g.save(); g.translate(W / 2, H * 0.45); g.globalCompositeOperation = "lighter";
    g.globalAlpha = a * 0.8; g.strokeStyle = "#ffb0f0"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-260 * k, 0); g.quadraticCurveTo(0, -150 * k, 260 * k, 0); g.quadraticCurveTo(0, 150 * k, -260 * k, 0); g.stroke();
    g.fillStyle = "rgba(255,120,220,.15)"; g.fill();
    glow(g, 0, 0, 90 * k + 4, "#ffffff", "#ff5ac0", a);
    g.fillStyle = "#1a0420"; g.beginPath(); g.arc(0, 0, R(26 * k), 0, TAU); g.fill();
    g.restore();
    for (let i = 0; i < 5; i++) { const q = ((t * 0.7 + i / 5) % 1); g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * (1 - q) * 0.8; g.strokeStyle = i % 2 ? "#ff7ad9" : "#c9a0ff"; g.lineWidth = 5 * (1 - q) + 1; g.beginPath(); g.arc(W / 2, H * 0.45, R(40 + q * 560), 0, TAU); g.stroke(); g.restore(); }
    ringGlyph(g, W / 2, H * 0.78, 200 + p * 100, "#ffb0f0", t * 0.7, a * 0.9, 16);
    for (let i = 0; i < 14; i++) { const an = t * 0.6 + (i / 14) * TAU, d = 190 + 40 * Math.sin(t * 2 + i); g.save(); g.translate(W / 2 + Math.cos(an) * d * 1.5, H * 0.45 + Math.sin(an) * d * 0.7); g.rotate(an * 2); g.globalAlpha = a * 0.9; g.fillStyle = i % 2 ? "#ffb0f0" : "#c9a0ff"; g.beginPath(); g.moveTo(0, -16); g.lineTo(7, 0); g.lineTo(0, 16); g.lineTo(-7, 0); g.closePath(); g.fill(); g.restore(); }
    glow(g, x, y, 130, "#ffffff", "#ff7ad9", a * 0.6);
  },

  Bug(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a swarm streaming across the screen in curling lanes, over an amber honeycomb that lights up
    const k = sm(0.05, 0.6, p);
    g.save(); g.globalCompositeOperation = "lighter"; g.strokeStyle = "#ffd05a"; g.lineWidth = 2;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 14; c++) {
      const cx = c * 78 + (r % 2 ? 39 : 0), cy = r * 68, d = Math.hypot(cx - W / 2, cy - H / 2);
      g.globalAlpha = a * 0.3 * cl(k * 3 - d / 420, 0, 1) * (0.6 + 0.4 * Math.sin(t * 4 + c + r));
      g.beginPath(); for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + Math.PI / 6; g.lineTo(cx + Math.cos(an) * 40, cy + Math.sin(an) * 40); } g.closePath(); g.stroke();
    }
    g.restore();
    for (let i = 0; i < 160; i++) {
      const ph = (t * (0.5 + hs(i + 2) * 0.5) + hs(i)) % 1, lane = hs(i + 1) * H;
      const bx = -40 + ph * (W + 80), by = lane + Math.sin(ph * 9 + i) * 40, ang = Math.cos(ph * 9 + i) * 0.7;
      g.save(); g.translate(bx, by); g.rotate(ang); g.globalAlpha = a * 0.9;
      g.fillStyle = i % 3 ? "#1a1208" : "#c8e04a"; g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.ellipse(-1, -3, 4, 1.8 + Math.sin(t * 60 + i) * 1.2, 0, 0, TAU); g.fill(); g.restore();
    }
    glow(g, x, y, 140, "#fff0a0", "#c8a02a", a * 0.5);
  },

  Rock(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // boulders crash down on a slant, trailing flame, with dust blooming where they land
    for (let i = 0; i < 18; i++) {
      const start = hs(i) * 0.5, k = sm(start, start + 0.5, p);
      const sl = STRAIGHT ? 0 : 1;
      const bx = hs(i + 1) * W * 1.1 - 100 + (1 - k) * 360 * sl, by = -80 + (H * (0.35 + hs(i + 2) * 0.55) + 80) * k, r = 22 + hs(i + 3) * 34;
      if (k <= 0) continue;
      for (let j = 0; j < 8; j++) glow(g, bx - j * 18 * sl, by - j * 30, r * (1 - j * 0.08), "#ffb02e", "#7a2a0a", a * 0.35 * (1 - j / 8));
      g.save(); g.translate(bx, by); g.rotate(t * 3 + i);
      g.globalAlpha = a; g.beginPath(); for (let s = 0; s < 8; s++) { const rr = r * (0.75 + 0.35 * hs(i * 9 + s)); g.lineTo(Math.cos((s / 8) * TAU) * rr, Math.sin((s / 8) * TAU) * rr); } g.closePath();
      g.fillStyle = texPat(g, "rock", i * 17, 0, r / 40, 0); g.fill(); g.strokeStyle = "#ffb02e"; g.lineWidth = 2; g.stroke(); g.restore();
      if (k > 0.9) glow(g, bx, by + r, 130, "#d8c096", "#7a5a38", a * 0.5);
    }
    for (let i = 0; i < 5; i++) glow(g, hs(i + 20) * W, H - 40, 200, "#bba888", "#5a4a30", a * 0.35 * sm(0.3, 0.9, p));
    glow(g, x, y, 120, "#fff0c0", "#ffb02e", a * 0.5);
  },

  Ghost(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a haunted fog, spectres rising with hollow faces, chains of light and a pale moon-eye
    for (let i = 0; i < 18; i++) glow(g, hs(i) * W + Math.sin(t * 0.8 + i) * 50, H * (0.3 + hs(i + 2) * 0.7), 130 + hs(i + 4) * 90, "#6a3ac0", "#1a0a38", a * 0.4);
    for (let i = 0; i < 9; i++) {
      const ph = (t * 0.55 + hs(i)) % 1, sx = hs(i + 1) * W, sy = H + 40 - ph * (H + 140), s = 26 + hs(i + 2) * 28;
      g.save(); g.translate(sx + Math.sin(t * 2 + i) * 20, sy); g.globalAlpha = a * 0.8 * Math.sin(ph * Math.PI);
      glow(g, 0, 0, s * 2.6, "#c9a0ff", "#4a2a90", 0.55);
      g.globalCompositeOperation = "lighter"; g.fillStyle = "#e4d4ff"; g.beginPath(); g.moveTo(-s, s * 1.4); g.quadraticCurveTo(-s * 1.1, -s * 0.6, 0, -s); g.quadraticCurveTo(s * 1.1, -s * 0.6, s, s * 1.4); for (let w = 0; w < 4; w++) g.quadraticCurveTo(s * (0.8 - w * 0.5), s * 1.9, s * (0.5 - w * 0.5), s * 1.4); g.closePath(); g.fill();
      g.globalCompositeOperation = "source-over"; g.fillStyle = "#1a0a38"; g.beginPath(); g.ellipse(-s * 0.35, -s * 0.2, s * 0.17, s * 0.28, 0, 0, TAU); g.ellipse(s * 0.35, -s * 0.2, s * 0.17, s * 0.28, 0, 0, TAU); g.ellipse(0, s * 0.35, s * 0.2, s * 0.32, 0, 0, TAU); g.fill();
      g.restore();
    }
    for (let c = 0; c < 3; c++) { const pts: [number, number][] = []; for (let i = 0; i <= 20; i++) pts.push([(i / 20) * W, H * (0.35 + c * 0.18) + Math.sin(i * 0.7 + t * 2 + c * 2) * 60]); g.save(); g.globalCompositeOperation = "lighter"; g.setLineDash([16, 8]); g.strokeStyle = "#b58cff"; g.lineWidth = 3; g.globalAlpha = a * 0.7; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); g.restore(); }
    glow(g, x, y, 150, "#ece0ff", "#7a4ad0", a * 0.6);
  },

  Dragon(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a serpent dragon of scaled light coiling across the screen, with a glowing eye, horns and storm lightning
    const k = sm(0.05, 0.55, p);
    const pts: [number, number][] = [];
    const N = 40;
    for (let i = 0; i < N * k; i++) { const q = i / N; pts.push([W * (0.08 + q * 0.84) + Math.sin(q * 7 + t * 2) * 18, H * 0.5 + Math.sin(q * 9 - t * 3) * 150 * (0.4 + q * 0.6)]); }
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!, [x1, y1] = pts[i]!, w = 8 + (i / N) * 46;
      g.save(); g.lineCap = "round"; g.globalAlpha = a * 0.95;
      g.strokeStyle = "#1a1a4a"; g.lineWidth = w + 6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = texPat(g, "shade", i * 9, t * 20, 0.6, 0); g.lineWidth = w; g.stroke();
      g.globalCompositeOperation = "lighter"; g.strokeStyle = i % 2 ? "#6ac0ff" : "#9a6aff"; g.globalAlpha = a * 0.5; g.lineWidth = Math.max(1, w * 0.18); g.beginPath(); g.moveTo(x0, y0 - w * 0.25); g.lineTo(x1, y1 - w * 0.25); g.stroke(); g.restore();
    }
    const hd = pts[pts.length - 1];
    if (hd) {
      const [hx, hy] = hd; g.save(); g.translate(hx, hy); g.globalAlpha = a;
      g.fillStyle = "#2a2a8a"; g.beginPath(); g.moveTo(-10, -46); g.lineTo(78, -4); g.lineTo(-10, 46); g.closePath(); g.fill();
      g.strokeStyle = "#6ac0ff"; g.lineWidth = 3; g.stroke();
      g.fillStyle = "#ffd05a"; g.beginPath(); g.moveTo(-6, -40); g.lineTo(-50, -86); g.lineTo(10, -50); g.fill(); g.beginPath(); g.moveTo(-6, 40); g.lineTo(-50, 86); g.lineTo(10, 50); g.fill();
      glow(g, 22, -10, 22, "#ffffff", "#ffd05a", 1); g.restore();
      glow(g, hx + 90, hy, 150 + 40 * Math.sin(t * 20), "#9ad0ff", "#6a4aff", a * 0.7);
    }
    for (let i = 0; i < 5; i++) bolt(g, hs(i + Math.floor(t * 8)) * W, 0, hs(i + 9 + Math.floor(t * 8)) * W, H * 0.6, i * 7 + Math.floor(t * 8), "#9a8aff", 2, a * 0.6, 1);
    glow(g, x, y, 130, "#e8e0ff", "#6a4aff", a * 0.55);
  },

  Dark(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a black hole: matter spiralling in through a bright accretion ring, the light bending around it
    const k = sm(0.05, 0.6, p), cx = W / 2, cy = H * 0.5;
    glow(g, cx, cy, 340 * k + 20, "#8a5be0", "#1a0a38", a * 0.7);
    for (let i = 0; i < 220; i++) {
      const ph = (t * (0.35 + hs(i + 2) * 0.5) + hs(i)) % 1, an = hs(i + 1) * TAU + (1 - ph) * 9, d = (30 + ph * 330) * (0.4 + k * 0.6);
      g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * 0.85 * (1 - ph * 0.7); g.fillStyle = i % 3 ? "#c9a0ff" : "#ff6a8a"; g.beginPath(); g.arc(cx + Math.cos(an) * d * 1.5, cy + Math.sin(an) * d * 0.62, 1.2 + hs(i + 3) * 2.2, 0, TAU); g.fill(); g.restore();
    }
    g.save(); g.translate(cx, cy); g.scale(1, 0.42); g.globalCompositeOperation = "lighter";
    for (const [rr, c, w] of [[120, "#ffd0e8", 10], [150, "#c9a0ff", 6], [190, "#6a3ac0", 4]] as const) { g.globalAlpha = a * 0.8; g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(0, 0, R(rr * (0.5 + k * 0.6)), 0, TAU); g.stroke(); }
    g.restore();
    // a hole in the floor, so lying flat (not a ball standing in the air) in the player views
    g.save(); g.globalAlpha = a; g.fillStyle = "#000"; g.beginPath(); if (STRAIGHT) g.ellipse(cx, cy, R(70 * k + 6) * 1.5, R(70 * k + 6) * 0.63, 0, 0, TAU); else g.arc(cx, cy, R(70 * k + 6), 0, TAU); g.fill(); g.restore();
    glow(g, x, y, 120, "#e4d8f8", "#8a5be0", a * 0.5);
  },

  Steel(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a spinning metal drill-storm: gleaming gears and blades, sparks flying off the cutting edge
    const cx = W / 2, cy = H * 0.52;
    for (let i = 0; i < 3; i++) {
      const r = 90 + i * 70, n = 10 + i * 4;
      g.save(); g.translate(cx + (i - 1) * 40, cy + (i - 1) * 20); g.rotate(t * (2.2 - i * 0.6) * (i % 2 ? -1 : 1)); g.globalAlpha = a * (0.95 - i * 0.12);
      g.beginPath(); for (let s = 0; s < n * 2; s++) { const rr = s % 2 ? r * 0.82 : r; const an = (s / (n * 2)) * TAU; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath();
      g.fillStyle = texPat(g, "metal", i * 31, 0, 0.9, 0); g.fill(); g.strokeStyle = "#eaf2ff"; g.lineWidth = 3; g.stroke();
      g.fillStyle = "#1a2230"; g.beginPath(); g.arc(0, 0, R(r * 0.32), 0, TAU); g.fill(); g.restore();
    }
    for (let i = 0; i < 5; i++) { g.save(); g.translate(cx, cy); g.rotate(t * 5 + (i / 5) * TAU); g.globalCompositeOperation = "lighter"; const gr = g.createLinearGradient(0, 0, 420, 0); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(120,170,255,0)"); g.fillStyle = gr; g.globalAlpha = a * 0.55; g.beginPath(); g.moveTo(0, -6); g.lineTo(420, -2); g.lineTo(420, 2); g.lineTo(0, 6); g.closePath(); g.fill(); g.restore(); }
    for (let i = 0; i < 70; i++) { const ph = (t * 1.6 + hs(i)) % 1, an = hs(i + 1) * TAU; g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * (1 - ph); g.strokeStyle = i % 2 ? "#fff0b0" : "#ffffff"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + Math.cos(an) * 160 * ph * 1.5, cy + Math.sin(an) * 160 * ph); g.lineTo(cx + Math.cos(an) * (160 * ph + 26) * 1.5, cy + Math.sin(an) * (160 * ph + 26)); g.stroke(); g.restore(); }
    glow(g, x, y, 130, "#ffffff", "#9aa8be", a * 0.5);
  },

  Fairy(Zc) {
    const { g, t, p, a, x, y } = Zc;
    // a pastel starfield bursting out: rainbow ribbons, a giant sparkling star and drifting hearts and glitter
    const k = sm(0.05, 0.7, p), cx = W / 2, cy = H * 0.5;
    const cols = ["#ff8ac8", "#ffd86a", "#8ae8c8", "#8ac8ff", "#c8a0ff"];
    for (let c = 0; c < 5; c++) { const pts: [number, number][] = []; for (let i = 0; i <= 28; i++) { const q = i / 28; pts.push([W * q, H * 0.78 - Math.sin(q * Math.PI) * 250 * k - c * 14 + Math.sin(q * 8 + t * 2) * 6]); } g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * 0.6; g.strokeStyle = cols[c]!; g.lineWidth = 12; g.lineCap = "round"; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); g.restore(); }
    g.save(); g.translate(cx, cy); g.rotate(t * 0.8); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * 0.9; g.fillStyle = "#ffe4f4"; g.strokeStyle = "#ffffff"; g.lineWidth = 3;
    g.beginPath(); for (let i = 0; i < 16; i++) { const rr = i % 2 ? 36 * k : 190 * k; g.lineTo(Math.cos((i / 16) * TAU) * rr, Math.sin((i / 16) * TAU) * rr); } g.closePath(); g.fill(); g.stroke(); g.restore();
    glow(g, cx, cy, 120 + k * 80, "#ffffff", "#ff8ac8", a * 0.8);
    for (let i = 0; i < 90; i++) { const ph = (t * 0.6 + hs(i)) % 1, sx = hs(i + 1) * W, sy = H - ph * (H + 60); g.save(); g.translate(sx + Math.sin(t * 2 + i) * 20, sy); g.rotate(t + i); g.globalCompositeOperation = "lighter"; g.globalAlpha = a * 0.9 * Math.sin(ph * Math.PI); g.fillStyle = cols[i % 5]!; const s = 3 + hs(i + 2) * 5; g.beginPath(); for (let q = 0; q < 8; q++) { const rr = q % 2 ? s * 0.4 : s; g.lineTo(Math.cos((q / 8) * TAU) * rr, Math.sin((q / 8) * TAU) * rr); } g.closePath(); g.fill(); g.restore(); }
    glow(g, x, y, 140, "#ffffff", "#ff8ac8", a * 0.5);
  },
};

/** Per-type colour of the finale bloom and its palette. */
export const Z_TINT: Record<string, string> = {
  Normal: "#ffe9a8", Fire: "#ff8a1f", Water: "#4aa8ff", Electric: "#ffe14d", Grass: "#6bd45a", Ice: "#9fe8ff", Fighting: "#ff7a3c", Poison: "#a24be0",
  Ground: "#d8a050", Flying: "#bfe3ff", Psychic: "#ff7ad9", Bug: "#c8e04a", Rock: "#c0a070", Ghost: "#9a6aff", Dragon: "#6a7aff", Dark: "#8a5be0", Steel: "#c8d4e8", Fairy: "#ffa0d8",
};

/**
 * Draw the type's show over the darkened backdrop. `t` is seconds since the cinematic began, `p` its 0..1 progress and `a` the
 * fade envelope. Never throws and always leaves the canvas state as it found it. Returns false for an unknown type.
 */
/** In the player views whatever falls in a finishing move comes straight down from the sky, not in on a slant from the side. */
let STRAIGHT = false;
export function setZSky(on: boolean) {
  STRAIGHT = on;
}

export function drawZScene(g: CanvasRenderingContext2D, type: string, t: number, p: number, a: number, at: { x: number; y: number }): boolean {
  const fn = SCENES[type];
  if (!fn) return false;
  g.save();
  try {
    const Zc: Z = { g, t: cl(t, 0, 3), p: cl(p, 0, 1), a: cl(a, 0, 1), x: cl(at.x, -200, W + 200), y: cl(at.y, -200, H + 200) };
    // push in slowly for a cinematic feel
    const s = 1 + 0.05 * Zc.p;
    g.translate(W / 2, H / 2);
    g.scale(s, s);
    g.translate(-W / 2, -H / 2);
    fn(Zc, Z_TINT[type] ?? "#ffffff");
  } catch {
    /* a failed show must never break the frame */
  } finally {
    g.restore();
  }
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.setLineDash([]);
  return true;
}

/* ----------------------------------------------------------------- the finale */

type FP = Partial<SP> & { kind: string; color: string };

/** The type-specific blow that lands on each foe: layered particles and a big textured mark on the floor. */
export function zFinale(type: string, x: number, y: number, c: SpecCtx) {
  const tint = Z_TINT[type] ?? "#ffffff";
  const P = (o: FP) => c.add({ x, y, vx: 0, vy: 0, g: 0, life: 0.8, size: 5, grow: 0, ...o } as SP);
  c.ring(x, y, tint, 210, 0.7);
  c.ring(x, y, "#ffffff", 130, 0.45);
  P({ kind: "glow", life: 0.6, size: 40, grow: 260, color: tint });
  const burst = (n: number, f: (i: number) => FP) => { for (let i = 0; i < n; i++) P(f(i)); };
  // the layers of its type under the finale's own show (dome, rune ring, orbiting / rising pieces)
  layeredBurst(type, x, y, 150, "rest", typePal(type), c);
  switch (type) {
    case "Fire":
      burst(22, (i) => ({ kind: "flame", x: x + rnd(-40, 40), y: y + rnd(-10, 14), vx: rnd(-70, 70), vy: rnd(-380, -140), life: rnd(0.7, 1.2), size: rnd(12, 22), color: i % 2 ? "#ffb02e" : "#ff5a1a" }));
      burst(24, () => ({ kind: "spark", vx: rnd(-420, 420), vy: rnd(-460, -60), g: 520, life: 1, size: rnd(2, 3.6), color: "#ffe27a" }));
      c.decal({ kind: "vfx", x, y: y + 6, r: 110, life: 4, seed: Math.random() * 9, ang: 0, vfx: { style: "splat", motif: "bomb", pal: ["#5a1004", "#ff5a1a", "#ffb02e", "#fff3b0"], tex: "lava" } });
      break;
    case "Water":
      burst(34, () => ({ kind: "dot", vx: rnd(-260, 260), vy: rnd(-620, -240), g: 1000, life: 1, size: rnd(2.5, 6), color: Math.random() < 0.5 ? "#bfe9ff" : "#3da0ff" }));
      c.decal({ kind: "vfx", x, y: y + 6, r: 120, life: 3.6, seed: Math.random() * 9, ang: 0, vfx: { style: "splat", motif: "drop", pal: ["#12408a", "#2f86e0", "#79c8ff", "#e6f6ff"], tex: "water" } });
      break;
    case "Electric":
      burst(8, () => { const a = rnd(0, TAU); return { kind: "bolt", x2: x + Math.cos(a) * rnd(70, 150), y2: y + Math.sin(a) * rnd(50, 110), life: 0.35, color: "#ffe14d", seed: (Math.random() * 99) | 0 }; });
      c.scorch(x, y + 6, 70, "Electric");
      break;
    case "Grass":
      burst(26, () => ({ kind: "leaf", vx: rnd(-260, 260), vy: rnd(-380, -60), g: 220, life: 1.2, size: rnd(4, 8), rot: rnd(0, 6), vr: rnd(-12, 12), color: Math.random() < 0.5 ? "#6bd45a" : "#c9f08a" }));
      c.decal({ kind: "vfx", x, y: y + 6, r: 110, life: 4, seed: Math.random() * 9, ang: 0, vfx: { style: "rays", motif: "spike", pal: ["#1d5a24", "#3fae48", "#9be06a", "#f0ffc8"], tex: "grass" } });
      break;
    case "Ice":
      burst(22, () => ({ kind: "shard", vx: rnd(-300, 300), vy: rnd(-420, -80), g: 560, life: 1.1, size: rnd(3, 7), rot: rnd(0, 6), vr: rnd(-10, 10), color: Math.random() < 0.5 ? "#bfefff" : "#ffffff" }));
      c.decal({ kind: "snow", x, y: y + 6, r: 130, life: 4, seed: Math.random() * 9, ang: 0 });
      break;
    case "Fighting":
      burst(14, () => ({ kind: "star", vx: rnd(-360, 360), vy: rnd(-360, 360), life: 0.7, size: rnd(7, 13), vr: 8, rot: 0, color: Math.random() < 0.5 ? "#ffd54a" : "#ff5a3c" }));
      c.decal({ kind: "crater", x, y: y + 6, r: 100, life: 4, seed: Math.random() * 9, ang: 0 });
      break;
    case "Poison":
      burst(14, () => ({ kind: "smoke", vx: rnd(-60, 60), vy: rnd(-150, -40), life: 1.3, size: rnd(14, 24), grow: 26, color: Math.random() < 0.5 ? "#a24be0" : "#6bd45a" }));
      c.decal({ kind: "vfx", x, y: y + 6, r: 120, life: 4.5, seed: Math.random() * 9, ang: 0, vfx: { style: "splat", motif: "cloud", pal: ["#4a1478", "#9a3ad8", "#d08aff", "#f6e0ff"], tex: "venom" } });
      break;
    case "Ground":
      burst(14, () => ({ kind: "plank", vx: rnd(-260, 260), vy: rnd(-520, -180), g: 1100, life: 1.1, size: rnd(5, 11), rot: rnd(0, 6), vr: rnd(-10, 10), color: Math.random() < 0.5 ? "#9b8a6a" : "#6b5b4a" }));
      c.decal({ kind: "quake", x, y, r: 200, life: 3, seed: 0, ang: 0 });
      c.decal({ kind: "crater", x, y, r: 110, life: 4, seed: Math.random() * 9, ang: 0 });
      break;
    case "Flying":
      burst(16, () => ({ kind: "streak", vx: rnd(-120, 120), vy: rnd(-700, -300), life: 0.5, size: 12, color: "#eaf6ff" }));
      burst(10, () => ({ kind: "puff", vx: rnd(-160, 160), vy: rnd(-90, 20), life: 0.9, size: 12, grow: 30, color: "#ffffff" }));
      break;
    case "Psychic":
      for (let i = 0; i < 4; i++) c.ring(x, y, i % 2 ? "#ff7ad9" : "#c9a0ff", 160 + i * 70, 0.6 + i * 0.2);
      c.decal({ kind: "vfx", x, y: y + 6, r: 130, life: 3.5, seed: Math.random() * 9, ang: 0, vfx: { style: "glyph", motif: "rune", pal: ["#8a1a70", "#ff5ac0", "#ffb0e4", "#fff0fa"], tex: "aura" } });
      break;
    case "Bug":
      burst(22, () => ({ kind: "dot", vx: rnd(-240, 240), vy: rnd(-260, 60), g: 200, life: 1, size: rnd(2.5, 4.5), color: Math.random() < 0.5 ? "#1a1208" : "#c8e04a" }));
      break;
    case "Rock":
      burst(18, () => ({ kind: "plank", vx: rnd(-300, 300), vy: rnd(-540, -200), g: 1200, life: 1.2, size: rnd(5, 12), rot: rnd(0, 6), vr: rnd(-12, 12), color: Math.random() < 0.5 ? "#9b8a6a" : "#6b5b4a" }));
      c.decal({ kind: "crater", x, y: y + 6, r: 120, life: 4.5, seed: Math.random() * 9, ang: 0 });
      break;
    case "Ghost":
      burst(14, () => ({ kind: "smoke", vx: rnd(-60, 60), vy: rnd(-180, -60), life: 1.4, size: rnd(12, 22), grow: 24, color: Math.random() < 0.5 ? "#6b3fa0" : "#c9a0ff" }));
      c.decal({ kind: "runes", x, y: y + 6, r: 120, life: 3.5, seed: Math.random() * 9, ang: 0 });
      break;
    case "Dragon":
      burst(18, (i) => ({ kind: "streak", vx: Math.cos(i) * 560, vy: Math.sin(i) * 560, life: 0.6, size: 12, color: i % 2 ? "#7b5cff" : "#4aa8ff" }));
      c.decal({ kind: "runes", x, y: y + 6, r: 140, life: 3.5, seed: Math.random() * 9, ang: 0 });
      break;
    case "Dark":
      burst(18, (i) => { const a = (i / 18) * TAU; return { kind: "smoke", x: x + Math.cos(a) * 110, y: y + Math.sin(a) * 80, vx: -Math.cos(a) * 200, vy: -Math.sin(a) * 150, life: 0.7, size: 14, color: i % 2 ? "#2a1a45" : "#8a5be0" }; });
      c.decal({ kind: "night", x, y, r: 150, life: 3.5, seed: Math.random() * 9, ang: 0 });
      break;
    case "Steel":
      burst(26, () => ({ kind: "shard", vx: rnd(-460, 460), vy: rnd(-460, 140), g: 640, life: 0.9, size: rnd(2.5, 5.5), rot: rnd(0, 6), vr: rnd(-14, 14), color: Math.random() < 0.5 ? "#c8d4e0" : "#ffe9a0" }));
      break;
    case "Fairy":
      burst(24, (i) => ({ kind: "star", vx: rnd(-280, 280), vy: rnd(-340, -40), g: 220, life: 1.2, size: rnd(6, 11), vr: 4, rot: 0, color: ["#ffc2e6", "#ffffff", "#ffe27a"][i % 3]! }));
      break;
    default:
      burst(18, () => ({ kind: "star", vx: rnd(-300, 300), vy: rnd(-300, 300), life: 0.8, size: rnd(6, 10), vr: 6, rot: 0, color: Math.random() < 0.5 ? "#ffd54a" : "#ffffff" }));
  }
  c.shake(14, 0.45);
}
