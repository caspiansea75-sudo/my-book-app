/**
 * Procedural textures for effects, so pools, impacts, rocks, smoke and so on have a surface instead of being flat
 * colour and thin lines. Every texture is generated once (seamless value noise through a colour ramp) and cached.
 */

export type TexKind = "lava" | "fire" | "water" | "grass" | "rock" | "sand" | "ice" | "metal" | "venom" | "cloud" | "plasma" | "shade" | "aura";

type Def = { pal: string[]; vein?: string; vs?: number; ax?: number; ay?: number; warp?: number };

const DEF: Record<TexKind, Def> = {
  lava: { pal: ["#9c1e08", "#d83e0e", "#ff7f1e", "#ffc548"], vein: "#fff3b0", vs: 0.88, warp: 0.85 },
  fire: { pal: ["#d03a0c", "#ff761a", "#ffb838", "#ffe58a"], vein: "#fffbe0", vs: 0.88, warp: 0.85 },
  water: { pal: ["#14498f", "#1f6fc0", "#3d9be8", "#8fd3ff"], vein: "#ffffff", vs: 0.9, warp: 0.7 },
  grass: { pal: ["#2f6a2c", "#3f8a38", "#5fb04a", "#8fd870"], ay: 6 },
  rock: { pal: ["#3a352f", "#5b544b", "#837a6d", "#aaa090"], vein: "#17120e", vs: 0.9 },
  sand: { pal: ["#a88a5c", "#c2a574", "#dcc592", "#efe0b8"] },
  ice: { pal: ["#6fb8e0", "#a0dcf2", "#d4f2fc", "#ffffff"], vein: "#ffffff", vs: 0.92 },
  metal: { pal: ["#586479", "#8493a8", "#b4c0d0", "#eef3f9"], ay: 14 },
  venom: { pal: ["#2a0a4a", "#5a1f8f", "#8a3fd0", "#6cc23a"], warp: 0.9 },
  cloud: { pal: ["#b9bcc6", "#d8dae2", "#eceef3", "#ffffff"] },
  plasma: { pal: ["#b8860b", "#ffd54a", "#fff3a0", "#ffffff"], vein: "#ffffff", vs: 0.88, warp: 0.5 },
  shade: { pal: ["#0b0418", "#1f0d3a", "#3a1a66", "#6b3fa0"], vein: "#b58cff", vs: 0.9, warp: 0.6 },
  aura: { pal: ["#6a2fa0", "#c04fd0", "#ff8be4", "#ffe0f6"], vein: "#ffffff", vs: 0.9, warp: 0.7 },
};

const TYPE_TEX: Record<string, TexKind> = {
  Fire: "fire", Water: "water", Grass: "grass", Electric: "plasma", Ice: "ice", Rock: "rock", Ground: "sand", Steel: "metal",
  Poison: "venom", Ghost: "shade", Dark: "shade", Psychic: "aura", Fairy: "aura", Dragon: "aura", Fighting: "rock", Flying: "cloud", Bug: "grass", Normal: "cloud",
};
export const typeTex = (type: string): TexKind => TYPE_TEX[type] ?? "cloud";

const SIZE = 128;
const cache = new Map<string, HTMLCanvasElement>();
const pats = new WeakMap<object, Map<string, CanvasPattern>>();
const sprites = new Map<string, HTMLCanvasElement>();

function makeNoise(seed: number, px: number, py: number) {
  const grid = new Float32Array(px * py);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < grid.length; i++) { s = (s * 9301 + 49297) % 233280; grid[i] = s / 233280; }
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    const x = (((u * px) % px) + px) % px, y = (((v * py) % py) + py) % py;
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const fx = sm(x - x0), fy = sm(y - y0);
    const a = grid[y0 * px + x0]!, b = grid[y0 * px + x1]!, c = grid[y1 * px + x0]!, d = grid[y1 * px + x1]!;
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

const parse = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

function build(kind: TexKind): HTMLCanvasElement {
  const d = DEF[kind];
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d")!;
  const img = g.createImageData(SIZE, SIZE);
  const ax = d.ax ?? 1, ay = d.ay ?? 1;
  const octs = [0, 1, 2, 3].map((o) => makeNoise(kind.length * 31 + o * 7 + 3, 4 * 2 ** o * ax, 4 * 2 ** o * ay));
  const warpN = makeNoise(kind.length * 17 + 91, 4, 4);
  const pal = d.pal.map(parse);
  const vein = d.vein ? parse(d.vein) : null;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let u = x / SIZE, v = y / SIZE;
      if (d.warp) { u += (warpN(u, v) - 0.5) * 0.18 * d.warp; v += (warpN(v + 0.37, u) - 0.5) * 0.18 * d.warp; }
      let f = 0, amp = 0.5, tot = 0;
      for (let o = 0; o < 4; o++) { f += octs[o]!(u, v) * amp; tot += amp; amp *= 0.5; }
      f /= tot;
      const t = Math.min(0.999, Math.max(0, (f - 0.2) / 0.6)) * (pal.length - 1);
      const i0 = Math.floor(t), fr = t - i0;
      let r = pal[i0]![0] + (pal[i0 + 1]![0] - pal[i0]![0]) * fr, gg = pal[i0]![1] + (pal[i0 + 1]![1] - pal[i0]![1]) * fr, b = pal[i0]![2] + (pal[i0 + 1]![2] - pal[i0]![2]) * fr;
      if (vein) {
        const ridge = 1 - Math.abs(f * 2 - 1);
        const k = Math.max(0, (ridge - (d.vs ?? 0.9)) / (1 - (d.vs ?? 0.9)));
        if (k > 0) { const m = Math.min(1, k * 1.6); r += (vein[0] - r) * m; gg += (vein[1] - gg) * m; b += (vein[2] - b) * m; }
      }
      const grain = 0.94 + octs[3]!(u * 3.1, v * 3.1) * 0.12;
      const o = (y * SIZE + x) * 4;
      img.data[o] = Math.min(255, r * grain); img.data[o + 1] = Math.min(255, gg * grain); img.data[o + 2] = Math.min(255, b * grain); img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function texCanvas(kind: TexKind): HTMLCanvasElement {
  let c = cache.get(kind);
  if (!c) { c = build(kind); cache.set(kind, c); }
  return c;
}

/** A pattern of this texture for the given context, shifted, scaled and turned. Use it as fillStyle or strokeStyle. */
export function texPat(g: CanvasRenderingContext2D, kind: TexKind, ox = 0, oy = 0, scale = 1, rot = 0): CanvasPattern | string {
  let m = pats.get(g);
  if (!m) { m = new Map(); pats.set(g, m); }
  let p = m.get(kind);
  if (!p) {
    const made = g.createPattern(texCanvas(kind), "repeat");
    if (!made) return "#888";
    p = made;
    m.set(kind, p);
  }
  try { p.setTransform(new DOMMatrix().translate(ox, oy).rotate((rot * 180) / Math.PI).scale(scale)); } catch { /* old browsers: the plain pattern is fine */ }
  return p;
}

/** A soft, lumpy puff in one colour, for smoke, dust and spores. */
export function cloudSprite(color: string): HTMLCanvasElement {
  let s = sprites.get(color);
  if (s) return s;
  const S = 64;
  s = document.createElement("canvas");
  s.width = s.height = S;
  const g = s.getContext("2d")!;
  const img = g.createImageData(S, S);
  const n1 = makeNoise(5, 6, 6), n2 = makeNoise(9, 12, 12);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2);
    const d = Math.hypot(dx, dy);
    const fall = Math.max(0, 1 - d * d);
    const nz = 0.55 + (n1(x / S, y / S) * 0.7 + n2(x / S, y / S) * 0.5 - 0.6);
    const a = Math.max(0, Math.min(1, fall * nz * 1.5));
    const o = (y * S + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    img.data[o + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
  // a lighter top and a darker underside give it volume
  g.globalCompositeOperation = "source-atop";
  const sh = g.createLinearGradient(0, 0, 0, S);
  sh.addColorStop(0, "rgba(255,255,255,.28)");
  sh.addColorStop(1, "rgba(0,0,0,.28)");
  g.fillStyle = sh;
  g.fillRect(0, 0, S, S);
  sprites.set(color, s);
  if (sprites.size > 80) sprites.delete(sprites.keys().next().value as string);
  return s;
}
