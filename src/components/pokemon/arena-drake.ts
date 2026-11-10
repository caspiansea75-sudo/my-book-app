/**
 * Dragons made of light, shared by the two Dragon looks:
 *   the coiling spirit of "Draconic Prayer" (area moves, see arena-wyrm.ts)  - dragonHead, meshBand, legs
 *   the running low-poly dragon of the second sheet (shooting moves)         - core dragon, energy fill, glowing helix trails,
 *                                                                              wake field and circuit-rune ground decals
 * Nothing here uses shadowBlur: a glow is a wide faint stroke under a sharp one. Draws in whatever frame the caller sets up.
 */
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
export const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export type Pal = { lt: string; md: string; body: string; core: string };
export const PAL_CYAN: Pal = { lt: "#d8fbff", md: "#40d8ff", body: "60,200,255", core: "#ffffff" };
export const PAL_VIOLET: Pal = { lt: "#f0d8ff", md: "#b070ff", body: "150,90,255", core: "#ffffff" };

/** stroke the current path twice: wide and faint, then sharp (a glow without shadowBlur) */
function glow(g: G, col: string, lw: number, a: number) {
  const ga = g.globalAlpha;
  g.strokeStyle = col;
  g.lineWidth = lw * 3.4; g.globalAlpha = ga * a * 0.22; g.stroke();
  g.lineWidth = lw; g.globalAlpha = ga * a; g.stroke();
  g.globalAlpha = ga;
}

export type Pt = { x: number; y: number; w: number };

/* ---------------------------------------------------------------- hand-made outlines, triangulated into a low-poly mesh */
type V = [number, number];
type Mesh = { P: V[]; T: [number, number, number][]; n: number };

const inPoly = (x: number, y: number, o: V[]) => {
  let c = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [xi, yi] = o[i]!, [xj, yj] = o[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Bowyer-Watson Delaunay triangulation (small point sets only). */
function delaunay(P: V[]): [number, number, number][] {
  const n = P.length;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const d = Math.max(x1 - x0, y1 - y0) * 20, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const Q: V[] = [...P, [cx - d, cy - d], [cx, cy + d], [cx + d, cy - d]];
  let tris: [number, number, number][] = [[n, n + 1, n + 2]];
  const inCircle = (t: [number, number, number], px: number, py: number) => {
    const [a, b, c] = t.map((i) => Q[i]!) as [V, V, V];
    const ax = a[0] - px, ay = a[1] - py, bx = b[0] - px, by = b[1] - py, ccx = c[0] - px, ccy = c[1] - py;
    const det = (ax * ax + ay * ay) * (bx * ccy - ccx * by) - (bx * bx + by * by) * (ax * ccy - ccx * ay) + (ccx * ccx + ccy * ccy) * (ax * by - bx * ay);
    const orient = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return orient > 0 ? det > 0 : det < 0;
  };
  for (let i = 0; i < n; i++) {
    const bad = tris.filter((t) => inCircle(t, Q[i]![0], Q[i]![1]));
    const edges = new Map<string, [number, number, number]>();
    for (const t of bad) for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]] as [number, number][]) {
      const k = u < v ? u + "," + v : v + "," + u;
      edges.has(k) ? edges.delete(k) : edges.set(k, [u, v, 0]);
    }
    tris = tris.filter((t) => !bad.includes(t));
    for (const [u, v] of edges.values()) tris.push([u, v, i]);
  }
  return tris.filter((t) => t[0] < n && t[1] < n && t[2] < n);
}

const MESHES = new Map<string, Mesh>();
/** An outline, with a scatter of inner points, cut into triangles (made once and kept). */
function meshOf(key: string, outline: V[], spacing: number): Mesh {
  const hit = MESHES.get(key); if (hit) return hit;
  const P: V[] = outline.map((q) => [q[0], q[1]]);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of outline) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  let k = 0;
  for (let gy = y0; gy <= y1; gy += spacing) for (let gx = x0; gx <= x1; gx += spacing) {
    const x = gx + (hs(k++ * 1.7 + key.length) - 0.5) * spacing * 0.8, y = gy + (hs(k++ * 2.3 + key.length) - 0.5) * spacing * 0.8;
    if (!inPoly(x, y, outline)) continue;
    if (outline.some((q) => Math.hypot(q[0] - x, q[1] - y) < spacing * 0.5)) continue;
    P.push([x, y]);
  }
  const T = delaunay(P).filter((t) => inPoly((P[t[0]]![0] + P[t[1]]![0] + P[t[2]]![0]) / 3, (P[t[0]]![1] + P[t[1]]![1] + P[t[2]]![1]) / 3, outline));
  const m = { P, T, n: outline.length };
  MESHES.set(key, m);
  return m;
}

/** Draw a mesh: every triangle shaded on its own, thin lit edges, a glowing outline and a few bright nodes. `wob` can move the vertices. */
function drawMesh(g: G, m: Mesh, p: Pal, al: number, unit: number, wob?: (x: number, y: number) => V) {
  const Q = wob ? m.P.map((q) => wob(q[0], q[1])) : m.P;
  g.lineJoin = "round";
  for (let i = 0; i < m.T.length; i++) {
    const [a, b, c] = m.T[i]!;
    const A = Q[a]!, B = Q[b]!, C = Q[c]!;
    g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]); g.closePath();
    const top = 1 - Math.max(0, Math.min(1, ((A[1] + B[1] + C[1]) / 3 + 0.6) / 0.9));
    g.globalAlpha = al * (0.1 + 0.36 * hs(i * 3.1 + m.n) + 0.12 * top);
    g.fillStyle = `rgba(${p.body},1)`; g.fill();
    g.globalAlpha = al * 0.55; g.strokeStyle = p.lt; g.lineWidth = unit * 0.7; g.stroke();
  }
  g.beginPath(); for (let i = 0; i < m.n; i++) { const q = Q[i]!; i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.closePath();
  g.globalAlpha = al; glow(g, p.lt, unit * 1.8, 0.95);
  g.fillStyle = p.core;
  for (let i = 0; i < Q.length; i += 4) { g.globalAlpha = al * 0.8; g.beginPath(); g.arc(Q[i]![0], Q[i]![1], unit * 1.2, 0, TAU); g.fill(); }
}

const HEAD_SKULL: V[] = [[-0.35, -0.05], [-0.15, -0.32], [0.25, -0.4], [0.6, -0.3], [0.95, -0.2], [1.25, -0.12], [1.34, 0.0], [1.2, 0.06], [0.95, 0.08], [0.6, 0.1], [0.25, 0.14], [-0.05, 0.2], [-0.3, 0.18], [-0.4, 0.08]];
const HEAD_JAW: V[] = [[0.1, 0.16], [0.55, 0.2], [1.0, 0.3], [1.22, 0.34], [1.14, 0.42], [0.8, 0.44], [0.4, 0.38], [0.05, 0.3]];
const HEAD_HORN1: V[] = [[-0.12, -0.3], [-0.45, -0.62], [-0.95, -0.98], [-0.5, -0.46], [0.08, -0.36]];
const HEAD_HORN2: V[] = [[0.12, -0.36], [-0.1, -0.7], [-0.58, -1.04], [-0.2, -0.54], [0.3, -0.4]];

/** The dragon's head, facing +x with the origin at the back of the skull and one unit about the length of the skull: a faceted horned skull,
 *  a lower jaw that opens and shuts, swept-back horns, a frill, teeth, a glowing eye and long drifting whiskers. `sc` is the size in pixels of one unit. */
export function dragonHead(g: G, sc: number, t: number, p: Pal, al: number, outer = 1) {
  const un = 1 / (sc * outer);
  const open = 0.05 + 0.09 * (0.5 + 0.5 * Math.sin(t * 4));
  g.save(); g.scale(sc, sc); g.lineJoin = "round"; g.lineCap = "round";
  // frill: spikes streaming back off the skull
  for (let i = 0; i < 4; i++) {
    const y0 = -0.18 + i * 0.1, wv = Math.sin(t * 5 + i) * 0.04;
    g.beginPath(); g.moveTo(-0.3, y0); g.lineTo(-1.0 - i * 0.05, y0 - 0.12 + i * 0.1 + wv); g.lineTo(-0.28, y0 + 0.11); g.closePath();
    g.globalAlpha = al * 0.65; g.fillStyle = `rgba(${p.body},.7)`; g.fill(); g.globalAlpha = al * 0.8; g.strokeStyle = p.lt; g.lineWidth = un * 1.1; g.stroke();
  }
  drawMesh(g, meshOf("horn1", HEAD_HORN1, 0.22), p, al, un);
  drawMesh(g, meshOf("horn2", HEAD_HORN2, 0.22), p, al, un);
  g.save(); g.translate(0.0, 0.16); g.rotate(open); g.translate(0.0, -0.16); drawMesh(g, meshOf("jaw", HEAD_JAW, 0.17), p, al, un); g.restore();
  drawMesh(g, meshOf("skull", HEAD_SKULL, 0.2), p, al, un);
  // teeth
  g.fillStyle = p.core; g.globalAlpha = al;
  for (let i = 0; i < 6; i++) { const x = 0.55 + i * 0.12; g.beginPath(); g.moveTo(x, 0.09); g.lineTo(x + 0.05, 0.09 + 0.1 + open * 0.3); g.lineTo(x + 0.1, 0.085); g.closePath(); g.fill(); }
  // brow ridge, nostril, eye
  g.strokeStyle = p.core; g.lineWidth = un * 1.6; g.globalAlpha = al * 0.9;
  g.beginPath(); g.moveTo(0.1, -0.3); g.lineTo(0.5, -0.24); g.lineTo(0.85, -0.12); g.stroke();
  g.fillStyle = p.core; g.beginPath(); g.arc(1.24, -0.05, 0.03, 0, TAU); g.fill();
  g.globalAlpha = al * 0.55; g.fillStyle = p.md; g.beginPath(); g.arc(0.46, -0.14, 0.13, 0, TAU); g.fill();
  g.globalAlpha = al; g.fillStyle = p.core; g.beginPath(); g.moveTo(0.33, -0.15); g.quadraticCurveTo(0.46, -0.27, 0.62, -0.14); g.quadraticCurveTo(0.46, -0.08, 0.33, -0.15); g.fill();
  // whiskers
  for (let i = 0; i < 2; i++) {
    g.beginPath(); g.moveTo(1.28, -0.02 + i * 0.04);
    g.bezierCurveTo(1.7, 0.12 + Math.sin(t * 5 + i) * 0.1, 2.0, -0.12 + Math.sin(t * 4 + i * 2) * 0.16, 2.6, 0.1 + i * 0.1 + Math.sin(t * 3 + i) * 0.12);
    g.globalAlpha = al * 0.85; glow(g, p.lt, un * 1.2, 0.8);
  }
  g.restore();
}

/** A tapered low-poly band along a spine: triangular facets with their own shade, glowing edges, and a row of spines on the top edge. */
export function meshBand(g: G, pts: Pt[], p: Pal, al: number, seed: number, spines = true, spineLen = 1) {
  const N = pts.length - 1;
  const edge = (sg: number) => pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(N, i + 1)]!;
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + (sg * Math.PI) / 2;
    return { x: q.x + Math.cos(ang) * q.w, y: q.y + Math.sin(ang) * q.w };
  });
  const L = edge(-1), R = edge(1);
  g.lineJoin = "round"; g.lineCap = "round";
  // facets
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < 2; j++) {
      g.beginPath();
      if (j) { g.moveTo(R[i]!.x, R[i]!.y); g.lineTo(R[i + 1]!.x, R[i + 1]!.y); g.lineTo(L[i + 1]!.x, L[i + 1]!.y); }
      else { g.moveTo(L[i]!.x, L[i]!.y); g.lineTo(R[i]!.x, R[i]!.y); g.lineTo(L[i + 1]!.x, L[i + 1]!.y); }
      g.closePath();
      g.globalAlpha = al * (0.14 + 0.4 * hs(i * 2 + j + seed));
      g.fillStyle = `rgba(${p.body},1)`; g.fill();
      g.globalAlpha = al * 0.5; g.strokeStyle = p.lt; g.lineWidth = 0.9; g.stroke();
    }
  }
  // outline, glowing
  g.beginPath(); L.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
  g.globalAlpha = al; glow(g, p.lt, 1.6, 0.9);
  g.beginPath(); R.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
  g.globalAlpha = al; glow(g, p.lt, 1.3, 0.7);
  // spine ridge down the middle
  g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
  g.globalAlpha = al * 0.55; g.strokeStyle = p.core; g.lineWidth = 0.9; g.stroke();
  if (spines) {
    g.fillStyle = `rgba(${p.body},.75)`; g.strokeStyle = p.lt; g.lineWidth = 1;
    for (let i = 1; i < N - 1; i++) {
      const a = L[i]!, b = L[i + 1]!, c = pts[i]!;
      const nx = a.x - c.x, ny = a.y - c.y, nl = Math.hypot(nx, ny) || 1, h = (3 + pts[i]!.w * 0.9) * spineLen;
      const tx = b.x - a.x, ty = b.y - a.y;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x + (nx / nl) * h + tx * 0.7, a.y + (ny / nl) * h + ty * 0.7); g.lineTo(b.x, b.y);
      g.globalAlpha = al * 0.85; g.fill(); g.globalAlpha = al * 0.8; g.stroke();
    }
  }
}

/** A clawed leg: thigh, knee, shin, foot with three claws. `ang` points the thigh, `bend` folds the knee. */
export function leg(g: G, x: number, y: number, len: number, ang: number, bend: number, p: Pal, al: number, w = 1) {
  const kx = x + Math.cos(ang) * len * 0.55, ky = y + Math.sin(ang) * len * 0.55;
  const a2 = ang + bend, fx = kx + Math.cos(a2) * len * 0.5, fy = ky + Math.sin(a2) * len * 0.5;
  g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(x, y); g.lineTo(kx, ky); g.lineTo(fx, fy);
  g.globalAlpha = al * 0.5; g.strokeStyle = `rgba(${p.body},1)`; g.lineWidth = len * 0.16 * w; g.stroke();
  g.globalAlpha = al; glow(g, p.lt, Math.max(1, len * 0.04 * w), 0.9);
  for (let i = -1; i <= 1; i++) {
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a2 + i * 0.5) * len * 0.2, fy + Math.sin(a2 + i * 0.5) * len * 0.2 + len * 0.03);
    g.globalAlpha = al * 0.9; g.strokeStyle = p.core; g.lineWidth = Math.max(0.8, len * 0.03); g.stroke();
  }
}

/** The running dragon's body in profile, facing right: heavy chest, thick neck, long tail. Units: body length about 2.4, y down. */
const BODY: V[] = [
  [-1.2, 0.04], [-0.95, -0.03], [-0.7, -0.1], [-0.45, -0.2], [-0.2, -0.28], [0.05, -0.31], [0.28, -0.29], [0.42, -0.38], [0.52, -0.54], [0.62, -0.7],
  [0.74, -0.66], [0.84, -0.5], [0.88, -0.3], [0.78, -0.1], [0.58, 0.04], [0.3, 0.14], [0.0, 0.18], [-0.3, 0.14], [-0.5, 0.05], [-0.75, 0.0], [-0.98, 0.05],
];
const HEAD_AT: V = [0.58, -0.7];

/** One leg: thick thigh, knee, shin and a clawed foot as faceted polygons. */
function drakeLeg(g: G, x: number, y: number, ang: number, bend: number, p: Pal, al: number, sz: number, un: number) {
  const l1 = 0.3 * sz, l2 = 0.3 * sz;
  const kx = x + Math.cos(ang) * l1, ky = y + Math.sin(ang) * l1;
  const a2 = ang + bend, fx = kx + Math.cos(a2) * l2, fy = ky + Math.sin(a2) * l2;
  const seg = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, sd: number) => {
    const an = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2, nx = Math.cos(an), ny = Math.sin(an);
    g.beginPath(); g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.lineTo(x0 - nx * w0, y0 - ny * w0); g.closePath();
    g.globalAlpha = al * (0.3 + 0.25 * hs(sd)); g.fillStyle = `rgba(${p.body},1)`; g.fill();
    g.globalAlpha = al; glow(g, p.lt, un * 1.6, 0.9);
    g.beginPath(); g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.moveTo(x0 - nx * w0, y0 - ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1);
    g.globalAlpha = al * 0.5; g.strokeStyle = p.lt; g.lineWidth = un * 0.8; g.stroke();
  };
  seg(x, y, kx, ky, 0.085 * sz, 0.06 * sz, 1);
  seg(kx, ky, fx, fy, 0.06 * sz, 0.035 * sz, 2);
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a2 + i * 0.55 + 0.2) * 0.11 * sz, fy + Math.sin(a2 + i * 0.55 + 0.2) * 0.11 * sz); g.globalAlpha = al; g.strokeStyle = p.core; g.lineWidth = un * 1.8; g.stroke(); }
}

let RUN_IMG: HTMLImageElement | null = null;
/** The painted running dragon (a glowing low-poly dragon on black, drawn as light so the black drops away); null until it has loaded. */
function runSprite(): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (!RUN_IMG) { RUN_IMG = new Image(); RUN_IMG.src = new URL("./dragon-runner.webp", import.meta.url).href; }
  return RUN_IMG.complete && RUN_IMG.naturalWidth > 0 ? RUN_IMG : null;
}

let COIL_IMG: HTMLImageElement | null = null;
/** The painted coiling spirit dragon (glowing, on black, drawn as light); null until it has loaded. */
export function coilSprite(): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (!COIL_IMG) { COIL_IMG = new Image(); COIL_IMG.src = new URL("./dragon-coil.webp", import.meta.url).href; }
  return COIL_IMG.complete && COIL_IMG.naturalWidth > 0 ? COIL_IMG : null;
}

/** The core dragon running to the right. L is its length in pixels. */
export function drakeRunner(g: G, L: number, t: number, p: Pal, al: number, seed = 0) {
  const im = runSprite();
  if (im) {
    const w = L * 1.45, h = w * (im.naturalHeight / im.naturalWidth), ph0 = t * 9;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.translate(0, Math.sin(ph0) * L * 0.015 - L * 0.02);
    g.rotate(Math.sin(ph0 + 0.6) * 0.035);
    g.scale(1 + Math.sin(ph0 * 2) * 0.012, 1 - Math.sin(ph0 * 2) * 0.012);
    g.globalAlpha = al; g.drawImage(im, -w * 0.5, -h * 0.5, w, h);
    g.globalAlpha = al * 0.3; g.drawImage(im, -w * 0.5, -h * 0.5, w, h); // a second pass lifts the glow
    g.restore();
    return;
  }
  const sc = L / 2.4, un = 1 / sc, ph = t * 9;
  g.save();
  g.scale(sc, sc); g.translate(-0.05, 0.12);
  g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
  // far legs, dimmer
  drakeLeg(g, 0.3, 0.04, 1.3 + Math.sin(ph + Math.PI) * 0.8, 0.5 + 0.7 * Math.max(0, Math.cos(ph + Math.PI)), p, al * 0.45, 1, un);
  drakeLeg(g, -0.4, 0.02, 1.5 + Math.sin(ph + 1.2) * 0.8, 0.5 + 0.7 * Math.max(0, Math.cos(ph + 1.2)), p, al * 0.45, 1.05, un);
  // energy fill inside the body
  for (let i = 0; i < 4; i++) {
    const cx = -0.55 + i * 0.35, cy = -0.15 - (i === 3 ? 0.18 : 0), rr = 0.34 + 0.06 * hs(i + seed);
    const eg = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
    eg.addColorStop(0, `rgba(${p.body},.6)`); eg.addColorStop(1, `rgba(${p.body},0)`);
    g.globalAlpha = al * 0.7; g.fillStyle = eg; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill();
  }
  // dorsal spines along the back
  for (let i = 0; i < 11; i++) {
    const x = -0.85 + i * 0.145, yb = i < 7 ? -0.1 - (x + 0.85) * 0.19 - 0.0 : -0.3 - (i - 6) * 0.045, h = 0.08 + 0.05 * Math.sin((i / 10) * Math.PI);
    g.beginPath(); g.moveTo(x, yb + 0.02); g.lineTo(x - 0.05, yb - h); g.lineTo(x + 0.06, yb + 0.03); g.closePath();
    g.globalAlpha = al * 0.8; g.fillStyle = `rgba(${p.body},.85)`; g.fill(); g.strokeStyle = p.lt; g.lineWidth = un; g.stroke();
  }
  drawMesh(g, meshOf("body", BODY, 0.2), p, al, un, (x, y) => [x, y + Math.sin(t * 10 - x * 5) * 0.025 * Math.max(0, 0.6 - x)]);
  // tail blade
  g.beginPath(); g.moveTo(-1.2, 0.04); g.lineTo(-1.42, -0.02 + Math.sin(t * 12) * 0.05); g.lineTo(-1.24, 0.1); g.closePath();
  g.globalAlpha = al * 0.9; g.fillStyle = `rgba(${p.body},.85)`; g.fill(); g.strokeStyle = p.lt; g.lineWidth = un * 1.3; g.stroke();
  // near legs
  drakeLeg(g, 0.3, 0.06, 1.3 + Math.sin(ph) * 0.8, 0.5 + 0.7 * Math.max(0, Math.cos(ph)), p, al, 1.05, un);
  drakeLeg(g, -0.4, 0.04, 1.5 + Math.sin(ph + 1.2 + Math.PI) * 0.8, 0.5 + 0.7 * Math.max(0, Math.cos(ph + 1.2 + Math.PI)), p, al, 1.1, un);
  // the head, at the top of the neck
  g.save(); g.translate(HEAD_AT[0], HEAD_AT[1]); g.rotate(0.28 + Math.sin(ph) * 0.04); dragonHead(g, 0.55, t, p, al, sc); g.restore();
  g.restore();
}

/** Two glowing ribbons winding round the dragon's path behind it (x runs back along -x). */
export function helixTrails(g: G, L: number, len: number, t: number, p: Pal, al: number) {
  g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
  for (let k = 0; k < 2; k++) {
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      for (let i = 0; i <= 36; i++) {
        const q = i / 36, x = L * 0.35 - q * len, env = Math.sin(Math.min(1, q * 6) * Math.PI * 0.5) * (1 - q * 0.45);
        const a = q * 9 - t * 11 + k * Math.PI;
        const y = Math.sin(a) * L * 0.3 * env, depth = Math.cos(a);
        // only the half of the turn that is in front / behind is drawn on each pass, so the ribbon looks like it goes round the dragon
        if ((pass === 0) !== (depth > 0)) { i && g.moveTo(x, y); continue; }
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.globalAlpha = al * (pass ? 0.95 : 0.45); glow(g, pass ? p.core : p.lt, pass ? 2.4 : 1.6, 0.8);
    }
  }
  g.restore();
}

/** The wake: soft cool mist streaming off behind. */
export function wakeField(g: G, L: number, len: number, t: number, p: Pal, al: number, seed = 0) {
  g.save(); g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 9; i++) {
    const q = (i + (t * 1.6 % 1)) / 9, x = -L * 0.4 - q * len, rr = L * (0.2 + 0.28 * q) * (0.8 + 0.4 * hs(i + seed)), y = Math.sin(t * 6 + i * 1.7) * L * 0.1 * q + (hs(i * 3 + seed) - 0.5) * L * 0.18;
    const wg = g.createRadialGradient(x, y, 0, x, y, rr);
    wg.addColorStop(0, `rgba(${p.body},.35)`); wg.addColorStop(1, `rgba(${p.body},0)`);
    g.globalAlpha = al * (1 - q) * 0.9; g.fillStyle = wg; g.beginPath(); g.ellipse(x, y, rr * 1.4, rr * 0.8, 0, 0, TAU); g.fill();
  }
  g.restore();
}

/** Circuit-rune decal laid along the ground: a spine of parallel lines, right-angled branches, nodes and chevrons. Runs from x=0 back to x=-len. */
export function circuitStrip(g: G, len: number, w: number, t: number, p: Pal, al: number, seed = 0) {
  g.save();
  g.scale(1, 0.5);
  g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
  const fadeAt = (x: number) => Math.pow(Math.max(0, 1 - -x / len), 0.9);
  // parallel runs, fading with distance
  const run = (y: number, lw: number, a: number) => {
    const N = 10;
    for (let i = 0; i < N; i++) {
      const x0 = -(i / N) * len, x1 = -((i + 0.9) / N) * len;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y);
      g.globalAlpha = al * a * fadeAt(x0); g.strokeStyle = p.lt; g.lineWidth = lw; g.stroke();
    }
  };
  run(0, 2, 0.9); run(-w * 0.2, 1.2, 0.7); run(w * 0.2, 1.2, 0.7); run(-w * 0.4, 1, 0.5); run(w * 0.4, 1, 0.5);
  const nb = Math.round(len / 16);
  for (let i = 0; i < nb; i++) {
    const x = -hs(i * 3 + seed) * len, side = i % 2 ? 1 : -1, d = w * (0.18 + 0.32 * hs(i + 9 + seed)), dx = (hs(i + 17 + seed) - 0.5) * 26;
    const a = al * fadeAt(x) * (0.55 + 0.45 * Math.sin(t * 6 + i));
    g.globalAlpha = a; g.strokeStyle = p.md; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, side * d); g.lineTo(x + dx, side * d); g.stroke();
    g.fillStyle = p.core; g.beginPath(); g.arc(x + dx, side * d, 2, 0, TAU); g.fill();
  }
  for (let i = 0; i < 5; i++) {
    const x = -(i + 0.6) * (len / 5.5), a = al * fadeAt(x);
    g.globalAlpha = a * 0.9; g.strokeStyle = p.core; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x - 7, -w * 0.12); g.lineTo(x, 0); g.lineTo(x - 7, w * 0.12); g.stroke();
  }
  g.restore();
}

/* ------------------------------------------------------------------------- the shooting moves */

export const DRAKE_SHOTS = new Set(["dragonpulse", "dragonbreath"]);
const SHOT_L: Record<string, number> = { dragonpulse: 124, dragonbreath: 88 };

/** One flying shot: the running dragon with its helix trails and wake, over a short strip of circuit runes on the ground behind it. */
export function drawDrakeShot(g: G, mv: string, ang: number, age: number, t: number) {
  const L = SHOT_L[mv] ?? 80, p = PAL_CYAN;
  const grow = sm(0, 0.12, age);
  const dx = Math.cos(ang), dy = Math.sin(ang), face = dx >= 0 ? 1 : -1;
  const tilt = Math.atan2(dy, Math.abs(dx)) * 0.55;
  // ground decal behind the shot, lying along its path
  g.save(); g.translate(0, L * 0.22); g.rotate(ang); circuitStrip(g, L * 1.9, L * 0.55, t, p, grow * 0.9, mv.length); g.restore();
  g.save(); g.scale(face, 1); g.rotate(tilt);
  wakeField(g, L, L * 1.5, t, p, grow, mv.length);
  helixTrails(g, L, L * 1.6, t, p, grow * 0.9);
  drakeRunner(g, L, t, p, grow, mv.length);
  g.restore();
}

/* ------------------------------------------------------------------------- beams: the dragon runs the whole line */

export type DrakeSig = { x: number; y: number; dir: number; len: number; t: number; life: number; seed: number; mv: string };
export const DRAKE_BOLTS = new Set(["spacialrend", "roaroftime", "coreenforcer", "eternabeam"]);
const VIOLET_B = new Set(["spacialrend", "roaroftime"]);
const palB = (s: DrakeSig) => (VIOLET_B.has(s.mv) ? PAL_VIOLET : PAL_CYAN);
const runK = (s: DrakeSig) => 1 - Math.pow(1 - Math.min(1, s.t / (s.life * 0.45)), 2.2);

/** On the floor: the circuit-rune decal along the whole line, brightest where the dragon has just been. */
export function drakeFlat(g: G, s: DrakeSig) {
  const p = palB(s), u = Math.min(1, s.t / s.life), k = runK(s);
  const a = sm(0, 0.05, u) * (1 - sm(0.6, 1, u));
  if (a < 0.01) return;
  g.save(); g.translate(s.x, s.y); g.rotate(s.dir);
  // the strip is drawn from the dragon's current position back to the start
  g.translate(s.len * k, 0);
  circuitStrip(g, s.len * k, 96, s.t, p, a, s.seed);
  g.restore();
}

/** Upright: the big dragon racing down the line with its trails and wake. */
export function drakeItems(s: DrakeSig, push: (x: number, y: number, dy: number, draw: (g: G) => void) => void) {
  const p = palB(s), u = Math.min(1, s.t / s.life), k = runK(s);
  const a = sm(0, 0.04, u) * (1 - sm(0.5, 0.95, u));
  if (a < 0.01) return;
  const px = s.x + Math.cos(s.dir) * s.len * k, py = s.y + Math.sin(s.dir) * s.len * k;
  push(px, py, 0.6, (g) => {
    const dx = Math.cos(s.dir), dy = Math.sin(s.dir), face = dx >= 0 ? 1 : -1;
    const L = 215;
    g.save(); g.translate(px, py - L * 0.14); g.scale(face, 1); g.rotate(Math.atan2(dy, Math.abs(dx)) * 0.5);
    wakeField(g, L, Math.min(s.len * k, 380), s.t, p, a, s.seed);
    helixTrails(g, L, Math.min(s.len * k + 60, 420), s.t, p, a);
    drakeRunner(g, L, s.t, p, a, s.seed);
    g.restore();
  });
}
