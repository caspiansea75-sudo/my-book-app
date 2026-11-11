// Shaped, textured forms for the arena: ponds, pits, lava lakes and the warning marks on the ground.
// Nothing here is a plain circle: every outline is an irregular, slowly moving shape (kept inside the
// patch's ellipse so collisions still match), filled with a texture and edged with rocks, foam, shards or runes.
import { texPat, type TexKind } from "./arena-tex";
import { fxBlur } from "./arena-lod";

type G = CanvasRenderingContext2D;
type Patch = { x: number; y: number; rx: number; ry: number };

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** An irregular closed outline: a few sine harmonics so it reads as a natural shape, never an ellipse.
 *  `amp` only ever shrinks the radius, so the shape stays inside the ellipse it was given. */
export function organic(cx: number, cy: number, rx: number, ry: number, seed: number, amp = 0.14, t = 0, n = 44): [number, number][] {
  const h1 = hash(seed + 1), h2 = hash(seed + 2), h3 = hash(seed + 3), h4 = hash(seed + 4);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 0.5 + 0.5 * (0.5 * Math.sin(a * 2 + h1 * 6.3 + t * 0.35) + 0.3 * Math.sin(a * 3 + h2 * 6.3 - t * 0.5) + 0.2 * Math.sin(a * 5 + h3 * 6.3 + t * 0.8 + h4));
    const k = 1 - amp * (1 - w);
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}

/** Smooth closed curve through the points (midpoint quadratic smoothing). */
export function smooth(g: G, pts: [number, number][]) {
  const n = pts.length;
  g.beginPath();
  const m = (i: number) => pts[(i + n) % n]!;
  g.moveTo((m(0)[0] + m(1)[0]) / 2, (m(0)[1] + m(1)[1]) / 2);
  for (let i = 1; i <= n; i++) {
    const p = m(i), q = m(i + 1);
    g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  g.closePath();
}

/** A jagged crown of spikes around a shape (rocks, ice or crystal teeth). */
function crown(g: G, pts: [number, number][], cx: number, cy: number, out: number, seed: number, fill: string, edge: string, every = 2) {
  for (let i = 0; i < pts.length; i += every) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1;
    const hh = out * (0.5 + hash(seed + i) * 0.9);
    g.fillStyle = fill; g.strokeStyle = edge; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(p[0], p[1]);
    g.lineTo(p[0] + (dx / d) * hh + (hash(seed + i * 3) - 0.5) * 6, p[1] + (dy / d) * hh * 0.8);
    g.lineTo(q[0], q[1]);
    g.closePath(); g.fill(); g.stroke();
  }
}

const sparkle = (g: G, x: number, y: number, s: number, a: number, col = "#fff") => {
  g.globalAlpha = a; g.fillStyle = col;
  g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.22, y - s * 0.22); g.lineTo(x + s, y); g.lineTo(x + s * 0.22, y + s * 0.22);
  g.lineTo(x, y + s); g.lineTo(x - s * 0.22, y + s * 0.22); g.lineTo(x - s, y); g.lineTo(x - s * 0.22, y - s * 0.22); g.closePath(); g.fill();
  g.globalAlpha = 1;
};

const seedOf = (p: Patch) => Math.floor(p.x * 3.1 + p.y * 7.7);

/* ------------------------------------------------------------------ water */

/** A pond: an irregular shore, textured water that gets deeper toward the middle, caustic light,
 *  drifting lily pads, glints and ripples, and a pebbled bank with foam. */
export function pond(g: G, p: Patch, t: number) {
  const sd = seedOf(p);
  const shore = organic(p.x, p.y, p.rx, p.ry, sd, 0.2, t * 0.4);
  const water = organic(p.x, p.y, p.rx * 0.97, p.ry * 0.97, sd, 0.2, t * 0.4);
  // wet bank
  g.save();
  smooth(g, organic(p.x, p.y + 2, p.rx * 1.04, p.ry * 1.05, sd, 0.2, t * 0.4));
  g.fillStyle = "rgba(40,70,60,.35)"; g.fill();
  g.restore();
  g.save();
  smooth(g, water); g.clip();
  const gr = g.createRadialGradient(p.x, p.y, 6, p.x, p.y, p.rx);
  gr.addColorStop(0, "#164f86"); gr.addColorStop(0.55, "#2a78bd"); gr.addColorStop(1, "#58b4dc");
  g.fillStyle = gr; g.fillRect(p.x - p.rx, p.y - p.ry, p.rx * 2, p.ry * 2);
  // rich, layered water like the lava: the texture at full strength, a second copy sliding the other way at another size
  // (so the light nets crawl across each other), dark depth in the middle and a bright shallows near the shore
  g.globalAlpha = 0.7; g.globalCompositeOperation = "overlay";
  g.fillStyle = texPat(g, "water", t * 14, t * 6, 1.1); g.fillRect(p.x - p.rx, p.y - p.ry, p.rx * 2, p.ry * 2);
  g.globalAlpha = 0.42; g.globalCompositeOperation = "soft-light";
  g.fillStyle = texPat(g, "water", -t * 9 + 40, t * 11, 0.62, 0.6); g.fillRect(p.x - p.rx, p.y - p.ry, p.rx * 2, p.ry * 2);
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  const dep = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx);
  dep.addColorStop(0, "rgba(2,22,64,.42)"); dep.addColorStop(0.6, "rgba(4,40,100,.1)"); dep.addColorStop(0.9, "rgba(140,225,255,.18)"); dep.addColorStop(1, "rgba(190,245,255,.34)");
  g.fillStyle = dep; g.fillRect(p.x - p.rx, p.y - p.ry, p.rx * 2, p.ry * 2);
  const hotW = g.createRadialGradient(p.x - p.rx * 0.25, p.y - p.ry * 0.3, 0, p.x - p.rx * 0.25, p.y - p.ry * 0.3, p.rx * 0.8);
  hotW.addColorStop(0, "rgba(200,240,255,.26)"); hotW.addColorStop(1, "rgba(200,240,255,0)");
  g.globalCompositeOperation = "lighter"; g.fillStyle = hotW; g.fillRect(p.x - p.rx, p.y - p.ry, p.rx * 2, p.ry * 2);
  g.globalCompositeOperation = "source-over";
  // caustic light: bright wavy threads
  g.globalCompositeOperation = "lighter";
  g.lineWidth = 1.4;
  for (let k = 0; k < 7; k++) {
    g.strokeStyle = `rgba(170,235,255,${0.1 + 0.08 * Math.sin(t * 1.3 + k)})`;
    g.beginPath();
    const y0 = p.y - p.ry + (k + 0.5) * (p.ry * 2) / 7;
    for (let x = -p.rx; x <= p.rx; x += 10) {
      const y = y0 + Math.sin(x * 0.05 + t * 1.2 + k * 1.7) * 5 + Math.sin(x * 0.11 - t * 0.8 + k) * 2.5;
      if (x === -p.rx) g.moveTo(p.x + x, y); else g.lineTo(p.x + x, y);
    }
    g.stroke();
  }
  g.globalCompositeOperation = "source-over";
  // ripples: shaped rings that widen and fade
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.22 + i / 3) % 1;
    g.strokeStyle = `rgba(225,245,255,${0.5 * (1 - k)})`; g.lineWidth = 2 - k;
    smooth(g, organic(p.x + Math.sin(i * 2.3) * p.rx * 0.2, p.y + Math.cos(i * 1.7) * p.ry * 0.15, p.rx * 0.9 * k, p.ry * 0.9 * k, sd + i, 0.25, t, 24));
    g.stroke();
  }
  // lily pads: a leaf with a notch and a vein
  for (let i = 0; i < 4; i++) {
    const a = hash(sd + i * 9) * 6.28, d = 0.35 + hash(sd + i * 5) * 0.4;
    const lx = p.x + Math.cos(a) * p.rx * d + Math.sin(t * 0.5 + i) * 3;
    const ly = p.y + Math.sin(a) * p.ry * d + Math.cos(t * 0.4 + i) * 2;
    const s = 9 + hash(sd + i) * 7, rot = hash(sd + i * 2) * 6.28 + Math.sin(t * 0.3 + i) * 0.15;
    g.save(); g.translate(lx, ly); g.rotate(rot); g.scale(1, 0.62);
    g.fillStyle = "#3f9a45"; g.strokeStyle = "#245f2b"; g.lineWidth = 1;
    g.beginPath(); g.arc(0, 0, s, 0.35, Math.PI * 2 - 0.35); g.lineTo(0, 0); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "rgba(190,240,150,.7)";
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-s * 0.8, 0); g.stroke();
    g.restore();
    if (i % 2 === 0) { g.fillStyle = "#ffd2e6"; g.beginPath(); g.arc(lx + 1, ly - 3, 2.6, 0, 6.3); g.fill(); }
  }
  for (let i = 0; i < 7; i++) sparkle(g, p.x + (hash(sd + i * 13) - 0.5) * p.rx * 1.6, p.y + (hash(sd + i * 17) - 0.5) * p.ry * 1.5, 3 + hash(sd + i) * 3, Math.max(0, Math.sin(t * 2 + i * 1.9)) * 0.8);
  g.restore();
  // bank: pebbles round the edge and a foamy rim
  for (let i = 0; i < shore.length; i += 1) {
    const q = shore[i]!;
    const dx = q[0] - p.x, dy = q[1] - p.y, d = Math.hypot(dx, dy) || 1;
    const rr = 2.4 + hash(sd + i * 7) * 3.4;
    g.fillStyle = hash(sd + i) > 0.5 ? "#9aa3a8" : "#7c858c";
    g.beginPath(); g.ellipse(q[0] + (dx / d) * 3, q[1] + (dy / d) * 3, rr, rr * 0.7, hash(i) * 3, 0, 6.3); g.fill();
    g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(q[0] + (dx / d) * 3 - 1, q[1] + (dy / d) * 3 - 1, rr * 0.5, rr * 0.3, 0, 0, 6.3); g.fill();
  }
  g.save();
  smooth(g, water);
  g.strokeStyle = "rgba(235,248,255,.8)"; g.lineWidth = 2.6; g.stroke();
  g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3; g.setLineDash([6, 12]); g.lineDashOffset = -t * 10; g.stroke();
  g.restore();
}

/** The tide line on the coast arena: foam that breaks and drifts along the water's edge. */
export function foamEdge(g: G, p: Patch, t: number) {
  const sd = seedOf(p) + 40;
  const edge = organic(p.x, p.y, p.rx + 3, p.ry + 3, seedOf(p), 0.2, t * 0.4);
  g.save();
  smooth(g, edge);
  g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 4; g.setLineDash([14, 9]); g.lineDashOffset = -t * 18; g.stroke();
  g.setLineDash([]);
  for (let i = 0; i < edge.length; i++) {
    const q = edge[i]!;
    const a = 0.4 + 0.5 * Math.sin(t * 2 + i * 1.3);
    g.fillStyle = `rgba(255,255,255,${a * 0.8})`;
    g.beginPath(); g.arc(q[0] + Math.sin(t + i) * 2, q[1] + Math.cos(t * 1.2 + i) * 2, 1.6 + hash(sd + i) * 2.4, 0, 6.3); g.fill();
  }
  g.restore();
}

/* ------------------------------------------------------------------ the void pit */

/** A rift in the floor: a cosmic window with a spiral nebula, twinkling stars and a crown of glowing crystal shards. */
export function riftPit(g: G, h: Patch, t: number) {
  const sd = seedOf(h);
  const inner = organic(h.x, h.y, h.rx * 0.97, h.ry * 0.97, sd, 0.22, t * 0.3);
  const rim = organic(h.x, h.y, h.rx, h.ry, sd, 0.22, t * 0.3, 36);
  g.save();
  smooth(g, inner); g.clip();
  g.fillStyle = "#03040d"; g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  // nebula: texture drifting under a violet wash
  g.globalAlpha = 0.3; g.globalCompositeOperation = "lighter";
  g.fillStyle = texPat(g, "plasma", t * 9, -t * 5, 1.4); g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  g.globalAlpha = 0.55; g.globalCompositeOperation = "color";
  g.fillStyle = "#3a2c9a"; g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  g.globalAlpha = 1;
  // spiral arms
  for (let arm = 0; arm < 3; arm++) {
    g.strokeStyle = `rgba(${arm === 1 ? "90,200,255" : "170,110,255"},.26)`; g.lineWidth = 7 - arm;
    g.beginPath();
    for (let s = 0; s < 40; s++) {
      const r = (s / 40) * 0.95;
      const a = t * 0.35 + arm * 2.09 + r * 4.2;
      const x = h.x + Math.cos(a) * h.rx * r, y = h.y + Math.sin(a) * h.ry * r;
      if (s === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalCompositeOperation = "source-over";
  // a dark core so it reads as depth
  const core = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.rx * 0.55);
  core.addColorStop(0, "rgba(2,2,10,.95)"); core.addColorStop(1, "rgba(2,2,10,0)");
  g.fillStyle = core; g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  for (let i = 0; i < 46; i++) {
    const x = h.x + (hash(sd + i * 3) - 0.5) * h.rx * 2, y = h.y + (hash(sd + i * 5) - 0.5) * h.ry * 2;
    const tw = 0.25 + 0.7 * Math.abs(Math.sin(t * (0.6 + hash(i)) + i));
    if (i % 6 === 0) sparkle(g, x, y, 3.5, tw, "#cfe0ff"); else { g.fillStyle = `rgba(200,220,255,${tw})`; g.fillRect(x, y, 1.8, 1.8); }
  }
  // inner shadow from the rim
  const vg = g.createRadialGradient(h.x, h.y, h.rx * 0.5, h.x, h.y, h.rx);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(30,20,90,.55)");
  g.fillStyle = vg; g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  g.restore();
  // crystal crown
  crown(g, rim, h.x, h.y, 12, sd + 7, "#7fd4ff", "#e7fbff", 2);
  g.save();
  smooth(g, rim);
  g.strokeStyle = "rgba(140,215,255,.9)"; g.lineWidth = 3.5; g.shadowColor = "#4cc3ff"; g.shadowBlur = fxBlur(14); g.stroke();
  g.restore();
}

/* ------------------------------------------------------------------ lava */

/** A lake of molten rock: scrolling lava texture, cooled crust plates drifting on it, bright cracks,
 *  popping bubbles and a rim of blackened basalt with an orange glow. */
export function lavaLake(g: G, h: Patch, t: number) {
  const sd = seedOf(h);
  const inner = organic(h.x, h.y, h.rx * 0.97, h.ry * 0.97, sd, 0.2, t * 0.25);
  const rim = organic(h.x, h.y, h.rx, h.ry, sd, 0.2, t * 0.25, 38);
  g.save();
  smooth(g, inner); g.clip();
  const gr = g.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.rx);
  gr.addColorStop(0, "#fff3a8"); gr.addColorStop(0.35, "#ffa122"); gr.addColorStop(1, "#b02208");
  g.fillStyle = gr; g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  g.globalAlpha = 0.55; g.globalCompositeOperation = "overlay";
  g.fillStyle = texPat(g, "lava", t * 12, t * 7, 1.2); g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  // crust plates: dark irregular slabs that drift and turn
  for (let i = 0; i < 6; i++) {
    const a = hash(sd + i * 4) * 6.28 + t * 0.05 * (i % 2 ? 1 : -1), d = 0.15 + hash(sd + i * 8) * 0.6;
    const cx = h.x + Math.cos(a) * h.rx * d, cy = h.y + Math.sin(a) * h.ry * d;
    const s = 16 + hash(sd + i) * 16;
    const plate = organic(cx, cy, s, s * 0.6, sd + i * 11, 0.45, t * 0.2, 9);
    smooth(g, plate);
    g.fillStyle = "#2a1410"; g.fill();
    g.strokeStyle = "rgba(255,150,50,.85)"; g.lineWidth = 2; g.stroke();
    g.strokeStyle = "rgba(255,110,30,.5)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx - s * 0.5, cy - 1); g.lineTo(cx, cy + s * 0.15); g.lineTo(cx + s * 0.55, cy - s * 0.1); g.stroke();
  }
  // bubbles that swell and pop
  for (let i = 0; i < 6; i++) {
    const k = (t * 0.6 + hash(sd + i) * 3) % 1.4;
    if (k > 1) continue;
    const bx = h.x + (hash(sd + i * 21) - 0.5) * h.rx * 1.4, by = h.y + (hash(sd + i * 31) - 0.5) * h.ry * 1.3;
    g.strokeStyle = `rgba(255,235,150,${1 - k})`; g.fillStyle = `rgba(255,200,90,${0.4 * (1 - k)})`; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(bx, by, 3 + k * 9, 2 + k * 6, 0, 0, 6.3); g.fill(); g.stroke();
  }
  const hot = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.rx);
  hot.addColorStop(0, "rgba(255,240,170,.35)"); hot.addColorStop(1, "rgba(255,240,170,0)");
  g.globalCompositeOperation = "lighter"; g.fillStyle = hot; g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  g.restore();
  crown(g, rim, h.x, h.y, 10, sd + 3, "#2b1b17", "#ff9a3a", 2);
  g.save();
  smooth(g, rim);
  g.strokeStyle = "rgba(255,170,70,.9)"; g.lineWidth = 3.5; g.shadowColor = "#ff6a1a"; g.shadowBlur = fxBlur(18); g.stroke();
  g.restore();
}

/* ------------------------------------------------------------------ warning marks */

/** The ground mark of an incoming strike: a sigil, not a disc. A moving organic outline, a textured fill that
 *  fills in as the strike nears, rune ticks that spin, and a closing star that tightens on the target. */
export function sigil(g: G, x: number, y: number, r: number, prog: number, color: string, edge: string, fill: string, tex: TexKind, t: number, seed = 0) {
  const pulse = 0.5 + Math.sin(t * 14) * 0.5;
  const outline = organic(x, y, r, r, seed, 0.12, t * 0.8, 36);
  g.save();
  smooth(g, outline);
  g.fillStyle = fill; g.fill();
  g.save(); g.clip();
  g.globalAlpha = 0.22 + prog * 0.32;
  g.fillStyle = texPat(g, tex, t * 25, t * 10, 0.9); g.fillRect(x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
  // the filling shape: grows from the middle and follows the same wobble
  const k = Math.max(0.05, Math.min(1, prog));
  smooth(g, organic(x, y, r * k, r * k, seed + 5, 0.18, t * 1.2, 30));
  g.fillStyle = color + "38"; g.fill();
  g.restore();
  g.strokeStyle = edge; g.lineWidth = 2.5 + pulse; g.stroke();
  // rune ticks around the outline
  g.strokeStyle = edge; g.lineWidth = 2;
  const ticks = Math.max(8, Math.min(24, Math.round(r / 6)));
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * 6.283 + t * 0.9;
    const long = i % 3 === 0;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3));
    g.lineTo(x + Math.cos(a) * (r + (long ? 12 : 7)), y + Math.sin(a) * (r + (long ? 12 : 7)));
    g.stroke();
  }
  // a closing star: sharpens as the strike lands
  const sr = r * (0.9 - prog * 0.45);
  g.globalAlpha = 0.5 + prog * 0.4;
  g.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 6.283 - t * 0.7;
    const px = x + Math.cos(a) * sr * (i % 2 ? 0.55 : 1), py = y + Math.sin(a) * sr * (i % 2 ? 0.55 : 1);
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath(); g.stroke();
  g.globalAlpha = 1;
  g.restore();
}
