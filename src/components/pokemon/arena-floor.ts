/**
 * Realistic arena floors. Each stage's ground is baked once from layered noise: a height map (grass tufts, flagstones,
 * pebbles, ice plates, rock facets, dunes…) is lit from one side so it has relief, then coloured from a palette with
 * the details that make the material believable (moss in the grout, crystal veins, glowing lava between basalt plates,
 * wind ripples in sand, frost cracks in ice). The result is painted into the floor rectangle; lines, edges and scenery
 * are drawn over it by the caller.
 */
import type { StageKind } from "@/lib/pokemon/arena-engine";

/* ------------------------------------------------------------------ noise */

const P = new Uint8Array(512);
{
  let s = 1234567;
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [base[i], base[j]] = [base[j]!, base[i]!];
  }
  for (let i = 0; i < 512; i++) P[i] = base[i & 255]!;
}
const lat = (x: number, y: number, sd: number) => P[(P[(x + sd * 31) & 255]! + y + sd * 17) & 255]! / 255;
const sm = (t: number) => t * t * (3 - 2 * t);

/** Smooth value noise, 0..1. */
function vn(x: number, y: number, sd = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = sm(x - xi), fy = sm(y - yi);
  const a = lat(xi, yi, sd), b = lat(xi + 1, yi, sd), c = lat(xi, yi + 1, sd), d = lat(xi + 1, yi + 1, sd);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x: number, y: number, oct = 5, sd = 0, gain = 0.5): number {
  let f = 0, a = 0.5, t = 0, fr = 1;
  for (let o = 0; o < oct; o++) {
    f += vn(x * fr, y * fr, sd + o) * a;
    t += a;
    a *= gain;
    fr *= 2;
  }
  return f / t;
}
/** Sharp ridges (cracks, veins): 1 along the lines, falling off to 0. */
const ridge = (n: number, k = 0.06) => Math.max(0, 1 - Math.abs(n - 0.5) / k);

/** Jittered-grid cells: distance to the nearest and second nearest point, plus a random id of the nearest cell. */
function vor(x: number, y: number, sd = 0): { d1: number; d2: number; id: number; cx: number; cy: number } {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0, cx = 0, cy = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = xi + i, gy = yi + j;
      const px = gx + 0.15 + 0.7 * lat(gx, gy, sd + 5), py = gy + 0.15 + 0.7 * lat(gx, gy, sd + 9);
      const d = Math.hypot(px - x, py - y);
      if (d < d1) { d2 = d1; d1 = d; id = lat(gx, gy, sd + 13); cx = px; cy = py; } else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, id, cx, cy };
}

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ramp = (stops: RGB[], t: number): RGB => {
  const k = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(k);
  return mix(stops[i]!, stops[i + 1]!, k - i);
};
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------------------------------------------------------------- surfaces */

type Px = { rgb: RGB; h: number; gloss?: number; glow?: number };
type Surface = (x: number, y: number) => Px;

const GR = ramp.bind(null, ["#17421a", "#25602a", "#3b8338", "#68ab48", "#9ccb69"].map(hex));

const grass: Surface = (x, y) => {
  // soft patches of lush and dry grass, a mown-stripe sheen, tufts and a few clover / dirt flecks
  const patch = fbm(x / 170, y / 150, 4, 1);
  // mown stripes: bands of grass laid the other way, so they catch the light differently, each one a little brighter on one edge
  const band = Math.floor(x / 92);
  const stripe = 0.5 + (band % 2 ? 0.5 : -0.5) * 0.46 + ((x % 92) / 92 - 0.5) * 0.1;
  const tuft = fbm(x / 5.2, y / 2.6, 3, 2); // blades are drawn a little longer than wide
  const fine = vn(x / 1.7, y / 1.2, 3);
  let t = 0.28 + patch * 0.5 + (stripe - 0.5) * 0.3 + (tuft - 0.5) * 0.38 + (fine - 0.5) * 0.12;
  const rgb = GR(t);
  // bare earth where it is trodden: in patches, and a worn spot in the middle of the pitch
  const worn = clamp01((fbm(x / 120, y / 100, 3, 6) - 0.62) * 4 + clamp01(1 - Math.hypot(x - CXF, y - CYF) / 150) * 0.7);
  const c = mix(rgb, hex("#6e5a37"), worn * 0.55 * (0.6 + fine * 0.6));
  const clover = vn(x / 9, y / 9, 8) > 0.86 ? 1 : 0;
  if (clover) { c[0] += 22; c[1] += 28; c[2] += 4; }
  return { rgb: c, h: tuft * 1.6 + fine * 0.6 + patch * 0.4 - worn * 0.5 };
};

const stone: Surface = (x, y) => {
  // flagstones laid in offset rows: bevelled slabs, grout with moss, chips, hairline cracks, worn centres
  const row = Math.floor(y / 62);
  const off = (row % 2) * 41 + lat(row, 0, 21) * 60;
  const lx = x + off;
  const colW = 118 + lat(row, 3, 22) * 40;
  const cell = Math.floor(lx / colW);
  const u = (lx % colW) / colW, v = (y % 62) / 62;
  const edge = Math.min(u * colW, (1 - u) * colW, v * 62, (1 - v) * 62); // px from the slab edge
  const id = lat(cell, row, 23);
  const base = 0.34 + id * 0.3;
  const n = fbm(x / 22, y / 22, 4, 7);
  const grain = vn(x / 1.6, y / 1.6, 9);
  const bevel = clamp01(edge / 4.5);
  let rgb: RGB = mix(hex("#2c3344"), hex("#8a91a3"), clamp01(base + (n - 0.5) * 0.5 + (grain - 0.5) * 0.12));
  rgb = mix(rgb, hex("#7d7a6a"), clamp01(fbm(x / 70, y / 60, 3, 11) - 0.45) * 0.6); // lichen-warm patches
  // chips and pits
  if (vn(x / 3.4, y / 3.4, 14) > 0.93) rgb = mix(rgb, hex("#1b2030"), 0.55);
  // hairline cracks across some slabs
  const crack = id > 0.78 ? ridge(fbm(x / 38, y / 30, 3, 15 + cell), 0.03) : 0;
  rgb = mix(rgb, hex("#10131c"), crack * 0.9);
  // grout: dark, with moss growing in it
  const moss = clamp01(fbm(x / 24, y / 24, 3, 17) * 1.6 - 0.55);
  const grout = 1 - bevel;
  rgb = mix(rgb, mix(hex("#0c0f18"), hex("#3d5a2e"), moss), grout * 0.92);
  // soft brightening on the worn middle of each slab
  rgb = mix(rgb, [rgb[0] * 1.12, rgb[1] * 1.12, rgb[2] * 1.14], (1 - Math.abs(u - 0.5) * 2) * 0.25);
  return { rgb, h: bevel * 2.2 + n * 0.9 + grain * 0.35 - crack * 1.2, gloss: 0.12 };
};

const dirt: Surface = (x, y) => {
  // packed earth: warm fBm, scattered pebbles, dry cracks, grit
  const n = fbm(x / 90, y / 80, 5, 20);
  const grit = vn(x / 1.3, y / 1.3, 21);
  const mid = fbm(x / 14, y / 14, 3, 22);
  let rgb: RGB = ramp(["#4a3320", "#6b4a2d", "#8a6540", "#b08a5a", "#cfae7e"].map(hex), 0.22 + n * 0.5 + (mid - 0.5) * 0.3 + (grit - 0.5) * 0.14);
  // pebbles
  const pv = vor(x / 15, y / 15, 24);
  const pebble = pv.id > 0.8 ? clamp01(1 - pv.d1 / (0.14 + (pv.id - 0.8) * 1.4)) : 0;
  if (pebble > 0) rgb = mix(rgb, mix(hex("#6f6256"), hex("#a79a88"), pv.id), clamp01(pebble * 2.2));
  // dry cracks: only in the drier patches
  const dry = clamp01((fbm(x / 160, y / 120, 3, 25) - 0.45) * 3);
  const crack = ridge(fbm(x / 46, y / 36, 3, 26), 0.035) * dry;
  rgb = mix(rgb, hex("#241609"), crack * 0.85);
  // tracks: long worn bands
  const track = clamp01(1 - Math.abs(fbm(x / 240, y / 40, 2, 28) - 0.5) / 0.06) * 0.3;
  rgb = mix(rgb, [rgb[0] * 0.78, rgb[1] * 0.78, rgb[2] * 0.78], track);
  return { rgb, h: n * 1.5 + mid * 0.8 + grit * 0.4 + pebble * 2.6 - crack * 1.6 };
};

const crystal: Surface = (x, y) => {
  // dark cave rock broken into facets, with violet mineral veins and tiny glints
  const f = vor(x / 64, y / 54, 30);
  const facet = f.id;
  const n = fbm(x / 26, y / 26, 4, 31);
  const edge = clamp01((f.d2 - f.d1) * 9);
  let rgb: RGB = mix(hex("#0e0d1c"), hex("#3a3560"), clamp01(0.18 + facet * 0.42 + (n - 0.5) * 0.4));
  rgb = mix(rgb, hex("#05040c"), (1 - edge) * 0.85);
  const vein = ridge(fbm(x / 60 + n * 0.4, y / 52, 3, 32), 0.03);
  rgb = mix(rgb, hex("#b78cff"), vein * 0.85);
  const glint = vn(x / 2.2, y / 2.2, 33) > 0.965 ? 1 : 0;
  if (glint) rgb = mix(rgb, hex("#e8dcff"), 0.9);
  return { rgb, h: facet * 2.4 + edge * 1.6 + n * 0.9, gloss: 0.25, glow: vein * 0.5 };
};

const ice: Surface = (x, y) => {
  // cartoon pack ice: big pale slabs with bevelled edges, thin dark-blue water between them, long diagonal glints and a few hairline cracks
  const wob = fbm(x / 70, y / 60, 3, 40);
  const v = vor((x + wob * 34) / 210, (y + wob * 26) / 160, 42);
  const edge = v.d2 - v.d1; // 0 on the seam between two slabs
  const base = ramp(["#a9d8ef", "#bfe4f6", "#d3eefb", "#e6f7fe"].map(hex), 0.2 + v.id * 0.55 + (fbm(x / 120, y / 90, 2, 43) - 0.5) * 0.25);
  let rgb: RGB = base;
  // long thin glints at a slant, different spacing on each slab, fading in and out along their length
  const sl = (x * 0.92 + y * 0.52) / (13 + v.id * 15);
  const fr = sl - Math.floor(sl);
  const glintMask = clamp01((fbm(x / 110 + v.id * 9, y / 40, 2, 44) - 0.4) * 3.4);
  const glint = (fr < 0.3 ? Math.min(1, (1 - Math.abs(fr - 0.15) / 0.15) * 1.6) : 0) * glintMask;
  rgb = mix(rgb, hex("#ffffff"), glint * 0.85);
  const shade = (vn(x / 40, y / 28, 45) - 0.5) * 0.1;
  rgb = mix(rgb, hex("#8cc4e4"), clamp01(0.12 + shade + (1 - clamp01(edge * 5)) * 0.25));
  // the sunk edge of the slab (its side face), then the gap of dark water
  const bevel = clamp01(1 - edge * 11); // 1 at the seam
  rgb = mix(rgb, hex("#5aa4d2"), clamp01(bevel * 1.2) * 0.7);
  const gap = clamp01(1 - edge * 26);
  rgb = mix(rgb, hex("#1f6aa0"), gap * 0.92);
  return { rgb, h: Math.min(1, edge * 9) * 1.6, gloss: 0.5 };
};

const lava: Surface = (x, y) => {
  // black basalt plates, with glowing magma showing in the gaps and breathing through hot cracks
  const f = vor(x / 78, y / 64, 50);
  const gap = clamp01(1 - (f.d2 - f.d1) * 6.2);
  const n = fbm(x / 20, y / 20, 4, 51);
  const warp = fbm(x / 60 + n * 0.5, y / 48, 4, 52);
  let rgb: RGB = mix(hex("#0f0a09"), hex("#4a3630"), clamp01(0.2 + f.id * 0.35 + (n - 0.5) * 0.5));
  rgb = mix(rgb, hex("#7a5b4a"), clamp01(fbm(x / 8, y / 8, 3, 53) - 0.7) * 1.2); // pale ash on the crust
  const hot = clamp01(gap * (0.7 + warp * 0.6));
  const lavaCol = ramp(["#7a1204", "#d83e0e", "#ff8a1f", "#ffd36a"].map(hex), clamp01(0.15 + warp * 0.9));
  rgb = mix(rgb, lavaCol, clamp01(hot * 1.3));
  const crack = ridge(fbm(x / 36, y / 30, 3, 54), 0.03);
  rgb = mix(rgb, hex("#ff7a1c"), crack * 0.8);
  return { rgb, h: (1 - gap) * 2.2 + n * 0.8 - crack, glow: clamp01(hot + crack * 0.7) };
};

const coast: Surface = (x, y) => {
  // sand: long wind ripples, a wetter darker band toward the sea side, shells and grit
  const warp = fbm(x / 120, y / 90, 3, 60);
  const ripple = 0.5 + 0.5 * Math.sin((y + warp * 70) / 7.5 + Math.sin(x / 90 + warp * 3) * 1.6);
  const n = fbm(x / 60, y / 50, 4, 61);
  const grit = vn(x / 1.1, y / 1.1, 62);
  let rgb: RGB = ramp(["#b89a68", "#d2b987", "#e6d2a4", "#f4e8c4"].map(hex), 0.3 + n * 0.45 + (ripple - 0.5) * 0.2 + (grit - 0.5) * 0.12);
  const wet = clamp01((y - 380) / 150 + (fbm(x / 80, y / 50, 3, 63) - 0.5) * 0.7);
  rgb = mix(rgb, hex("#8d7650"), wet * 0.55);
  // shells and pebbles
  const s = vor(x / 38, y / 38, 64);
  if (s.id > 0.9 && s.d1 < 0.1) rgb = mix(rgb, s.id > 0.95 ? hex("#fff4e8") : hex("#9b8e80"), 0.9);
  if (vn(x / 2.4, y / 2.4, 65) > 0.93) rgb = mix(rgb, hex("#7e6a4a"), 0.6);
  return { rgb, h: ripple * 1.6 + n * 1.2 + grit * 0.4, gloss: wet * 0.3 };
};

/** Open sea: deep blue with swells, sunlit crests and flecks of foam. */
const ocean: Surface = (x, y) => {
  const n = fbm(x / 170, y / 120, 4, 81);
  const w1 = Math.sin(x * 0.021 + n * 6 + y * 0.012) * 0.5 + 0.5;
  const w2 = Math.sin(y * 0.034 + n * 5 - x * 0.008) * 0.5 + 0.5;
  const swell = clamp01(0.25 + n * 0.5 + (w1 - 0.5) * 0.25 + (w2 - 0.5) * 0.15);
  let rgb: RGB = ramp(["#06285c", "#0b4690", "#1368bc", "#2a92de", "#5cc0f2"].map(hex), swell);
  const crest = Math.max(0, w1 * w2 - 0.8) / 0.2;
  rgb = mix(rgb, hex("#d8f6ff"), crest * 0.5);
  if (vn(x / 3, y / 3, 82) > 0.965 && n > 0.6) rgb = mix(rgb, hex("#ffffff"), 0.7);
  return { rgb, h: swell * 1.4 + crest * 0.4, gloss: 0.6 };
};

const SURF: Record<StageKind, Surface> = { grass, stone, dirt, crystal, ice, lava, coast, meadow: grass, glacier: ice, ocean };
/** Light from the upper left; higher values lean the shading harder. */
const RELIEF: Record<StageKind, number> = { grass: 0.9, stone: 1.5, dirt: 1.3, crystal: 1.7, ice: 0.8, lava: 1.4, coast: 1.1, meadow: 0.9, glacier: 0.8, ocean: 0.7 };

/** The middle of the floor being painted (some surfaces wear thin there). */
let CXF = 720, CYF = 450;

const mkCanvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

/** Paint the stage's ground into the rectangle (x0, y0, w, h) of a canvas. */
export function paintFloor(g: CanvasRenderingContext2D, kind: StageKind, x0: number, y0: number, w: number, h: number) {
  const surf = SURF[kind];
  CXF = x0 + w / 2;
  CYF = y0 + h / 2;
  // the relief is baked at half resolution (4x quicker, kind to slow phones) and drawn back up smoothly; fine grit is added at full size after
  const STEP = 2;
  const sw = Math.ceil(w / STEP), sh = Math.ceil(h / STEP);
  const px: Px[] = new Array(sw * sh);
  const H = new Float32Array(sw * sh);
  for (let j = 0; j < sh; j++) {
    for (let i = 0; i < sw; i++) {
      const p = surf(i * STEP + x0, j * STEP + y0);
      px[j * sw + i] = p;
      H[j * sw + i] = p.h;
    }
  }
  const tmp = mkCanvas(sw, sh);
  const tg = tmp.getContext("2d")!;
  const img = tg.createImageData(sw, sh);
  const d = img.data;
  const rel = RELIEF[kind] * 1.25;
  for (let j = 0; j < sh; j++) {
    for (let i = 0; i < sw; i++) {
      const o = j * sw + i;
      const p = px[o]!;
      const hl = H[j * sw + Math.max(0, i - 1)]!, hr = H[j * sw + Math.min(sw - 1, i + 1)]!;
      const hu = H[Math.max(0, j - 1) * sw + i]!, hd = H[Math.min(sh - 1, j + 1) * sw + i]!;
      // a slope facing the light (upper left) is brighter, one facing away darker
      const slope = ((hl - hr) * 0.7 + (hu - hd) * 0.7) * rel;
      const lit = 1 + Math.max(-0.45, Math.min(0.5, slope * 0.55));
      let [r, gg, b] = p.rgb;
      r *= lit; gg *= lit; b *= lit;
      if (p.gloss) {
        const spec = Math.max(0, slope) * p.gloss * 38;
        r += spec; gg += spec; b += spec;
      }
      if (p.glow) {
        r += 55 * p.glow; gg += 24 * p.glow; b += (kind === "crystal" ? 70 : 4) * p.glow;
      }
      const k = o * 4;
      d[k] = r > 255 ? 255 : r; d[k + 1] = gg > 255 ? 255 : gg; d[k + 2] = b > 255 ? 255 : b; d[k + 3] = 255;
    }
  }
  tg.putImageData(img, 0, 0);
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(tmp, 0, 0, sw, sh, x0, y0, w, h);
  // grit: tiny light and dark specks so close-up surfaces are not smooth
  let sd = kind.length * 977 + 13;
  const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const light = kind === "crystal" || kind === "lava" ? "rgba(255,230,200,.10)" : "rgba(255,255,255,.10)";
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,.14)" : light;
    g.fillRect(x0 + rnd() * w, y0 + rnd() * h, 1 + (rnd() < 0.2 ? 1 : 0), 1);
  }
  g.restore();
}
