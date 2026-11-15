/** The Water Shuriken: a sharp four-point star of rippling water with a hole in the middle, and the water blade Greninja holds. */
type G = CanvasRenderingContext2D;

export type Hue = "water" | "fire";

// ---- the water: a tileable texture of rippling blobs with bright light-lines (caustics) running between them
const PAL: Record<Hue, { base: [number, number, number]; blob: [number, number, number]; vein: [number, number, number]; glow: string; rim: string; mid: string }> = {
  water: { base: [90, 196, 255], blob: [6, 110, 235], vein: [208, 248, 255], glow: "rgba(110,200,255,.5)", rim: "rgba(225,250,255,.95)", mid: "#7fd0ff" },
  fire: { base: [255, 150, 40], blob: [226, 66, 8], vein: [255, 244, 176], glow: "rgba(255,150,50,.5)", rim: "rgba(255,246,200,.95)", mid: "#ffa040" },
};
const TEX = new Map<string, HTMLCanvasElement>();
function mk(n: number): HTMLCanvasElement { const c = document.createElement("canvas"); c.width = c.height = n; return c; }
/** `body`: the opaque water; `veins`: just the light-lines on a clear ground, drawn over it moving the other way. */
function tex(hue: Hue, veins: boolean): HTMLCanvasElement {
  const key = hue + (veins ? "v" : "b");
  const hit = TEX.get(key);
  if (hit) return hit;
  const N = 96, c = mk(N), x = c.getContext("2d")!, im = x.createImageData(N, N), P = PAL[hue], TAU = Math.PI * 2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N;
    const a = Math.sin(TAU * (2 * u) + 1.7 * Math.sin(TAU * v + 0.7));
    const b = Math.sin(TAU * (2 * v) + 1.7 * Math.sin(TAU * u + 2.1));
    const d = Math.sin(TAU * (u + v) * 2 + 1.2 * Math.sin(TAU * (u - v) + 1.3));
    const f = (a + b + d) / 3; // 0 along the lines
    const line = Math.pow(Math.max(0, 1 - Math.abs(f) * 3.2), 2.2);
    const blob = Math.min(1, Math.max(0, 0.5 + 0.5 * Math.sin(TAU * (u * 1) + 2 * Math.sin(TAU * v * 2)) * Math.cos(TAU * v + 1.4 * Math.sin(TAU * u))));
    const k = (j * N + i) * 4;
    if (veins) {
      im.data[k] = P.vein[0]; im.data[k + 1] = P.vein[1]; im.data[k + 2] = P.vein[2]; im.data[k + 3] = Math.round(255 * Math.min(1, line * 1.1));
    } else {
      for (let q = 0; q < 3; q++) {
        const col = P.base[q]! * (1 - blob) + P.blob[q]! * blob;
        im.data[k + q] = Math.round(col * (1 - line * 0.55) + P.vein[q]! * line * 0.55);
      }
      im.data[k + 3] = 255;
    }
  }
  x.putImageData(im, 0, 0);
  TEX.set(key, c);
  return c;
}
/** Fills the current path with moving water of a hue (a body layer and a counter-moving layer of light-lines). */
function fillWater(g: G, hue: Hue, t: number, scale: number, ox = 0, oy = 0) {
  const A = g.createPattern(tex(hue, false), "repeat"), B = g.createPattern(tex(hue, true), "repeat");
  if (!A || !B) return;
  g.save();
  g.clip();
  const s = Math.max(0.05, scale);
  A.setTransform(new DOMMatrix().translate(ox + t * 14 * s, oy + t * 6 * s).scale(s));
  g.fillStyle = A;
  g.fillRect(-9999, -9999, 19998, 19998);
  B.setTransform(new DOMMatrix().translate(ox - t * 18 * s, oy + t * 10 * s).scale(s * 1.35));
  g.globalAlpha *= 0.85;
  g.fillStyle = B;
  g.fillRect(-9999, -9999, 19998, 19998);
  g.restore();
}
/** A four-point glint. */
function glint(g: G, x: number, y: number, r: number, a: number) {
  if (r < 0.6 || a <= 0) return;
  g.save();
  g.globalAlpha *= a;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.moveTo(x - r, y); g.lineTo(x - r * 0.12, y - r * 0.12); g.lineTo(x, y - r); g.lineTo(x + r * 0.12, y - r * 0.12);
  g.lineTo(x + r, y); g.lineTo(x + r * 0.12, y + r * 0.12); g.lineTo(x, y + r); g.lineTo(x - r * 0.12, y + r * 0.12);
  g.closePath();
  g.fill();
  g.restore();
}
function starPath(g: G, R: number) {
  const ri = R * 0.3;
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2, r = k % 2 ? ri : R;
    if (k) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
}

/**
 * One water shuriken centred on (x, y): a sharp four-point star with a round hole in the middle, filled with rippling water whose bright
 * light-lines keep moving, a bright edge, glints on the points and a few droplets. `R` is the radius to the tips, `spin` the turn in radians.
 * `wet` (0..1) is how much the water shows round it; `hue` turns it from water to a glowing orange.
 */
export function drawShuriken(g: G, x: number, y: number, R: number, spin: number, t: number, wet = 1, alpha = 1, hue: Hue = "water") {
  if (R < 1) return;
  const P = PAL[hue];
  g.save();
  g.translate(x, y);
  g.globalAlpha *= alpha;
  // a faint glow behind it
  g.save();
  g.globalCompositeOperation = "lighter";
  const gl = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.35);
  gl.addColorStop(0, P.glow);
  gl.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha *= 0.55 * Math.max(0.3, wet);
  g.fillStyle = gl;
  g.beginPath();
  g.arc(0, 0, R * 1.35, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.rotate(spin);
  // the star, with the hole cut through the middle
  const shape = () => {
    starPath(g, R);
    g.moveTo(R * 0.15, 0);
    g.arc(0, 0, R * 0.15, 0, Math.PI * 2, true);
  };
  g.save();
  shape();
  g.clip("evenodd");
  g.beginPath();
  g.rect(-R, -R, R * 2, R * 2);
  fillWater(g, hue, t, Math.max(0.12, R / 150));
  g.restore();
  // the edge: a bright line round the star and round the hole
  g.lineJoin = "miter";
  g.miterLimit = 6;
  shape();
  g.lineWidth = Math.max(1, R * 0.028);
  g.strokeStyle = P.rim;
  g.stroke();
  g.rotate(-spin);
  // glints running round the tips
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * Math.PI) / 2 - Math.PI / 2;
    const tw = Math.max(0, Math.sin(t * 7 + k * 1.9));
    glint(g, Math.cos(a) * R * 0.96, Math.sin(a) * R * 0.96, R * 0.2 * tw, 0.95);
  }
  // droplets circling it
  if (wet > 0.05 && R > 14) {
    g.fillStyle = hue === "fire" ? "#ffe2a8" : "#d6f3ff";
    for (let i = 0; i < 6; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 6;
      const rr = R * (1.12 + 0.09 * Math.sin(t * 6 + i * 2));
      g.beginPath();
      g.arc(Math.cos(a) * rr, Math.sin(a) * rr, Math.max(1.1, R * 0.035), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

/**
 * A kunai-like blade of water, as Greninja holds in the anime: a ring at the grip (where it is held), a long leaf-shaped crystal of
 * rippling water ending in a sharp point, a bright ridge and a glint at the tip. Drawn along +x from the ring; `L` is its length.
 */
export function drawWaterKunai(g: G, L: number, t: number, hue: Hue = "water", alpha = 1) {
  const P = PAL[hue], W = L * 0.16, ring = L * 0.12;
  g.save();
  g.globalAlpha *= alpha;
  // glow
  g.save();
  g.globalCompositeOperation = "lighter";
  const gl = g.createLinearGradient(0, 0, L, 0);
  gl.addColorStop(0, P.glow);
  gl.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gl;
  g.globalAlpha *= 0.3;
  g.beginPath();
  g.ellipse(L * 0.45, 0, L * 0.5, W * 1.35, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  const blade = () => {
    g.beginPath();
    g.moveTo(ring * 0.95, 0);
    g.quadraticCurveTo(L * 0.2, -W * 1.2, L * 0.5, -W * 0.55);
    g.lineTo(L, 0);
    g.lineTo(L * 0.5, W * 0.55);
    g.quadraticCurveTo(L * 0.2, W * 1.2, ring * 0.95, 0);
    g.closePath();
  };
  g.save();
  blade();
  fillWater(g, hue, t, Math.max(0.1, L / 170), 0, 0);
  g.restore();
  g.lineJoin = "miter";
  blade();
  g.lineWidth = Math.max(1, L * 0.022);
  g.strokeStyle = P.rim;
  g.stroke();
  // the ridge down the middle
  g.beginPath();
  g.moveTo(ring * 1.7, 0);
  g.lineTo(L * 0.97, 0);
  g.strokeStyle = "rgba(255,255,255,.75)";
  g.lineWidth = Math.max(0.8, L * 0.014);
  g.stroke();
  // the ring at the grip
  g.beginPath();
  g.arc(0, 0, ring, 0, Math.PI * 2);
  g.strokeStyle = P.rim;
  g.lineWidth = Math.max(1.4, L * 0.05);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, ring, 0, Math.PI * 2);
  g.strokeStyle = P.mid;
  g.lineWidth = Math.max(0.8, L * 0.022);
  g.stroke();
  // glints on the ring and the point
  glint(g, 0, 0, L * 0.2 * (0.55 + 0.45 * Math.sin(t * 9)), 0.95);
  glint(g, L * 0.99, 0, L * 0.2 * (0.5 + 0.5 * Math.sin(t * 7 + 1.3)), 0.95);
  g.restore();
}

/**
 * The Battle Bond shuriken: a huge four-pointed star of glowing water-energy with long sharp blades, a hollow hub, a bright rim
 * and crackling light running through it, like the one Ash-Greninja throws.
 */
export function drawBondShuriken(g: G, x: number, y: number, R: number, spin: number, t: number, alpha = 1) {
  if (R < 1) return;
  g.save();
  g.translate(x, y);
  g.globalAlpha *= alpha;
  // wide cyan glow
  g.save();
  g.globalCompositeOperation = "lighter";
  const gl = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.5);
  gl.addColorStop(0, "rgba(90,200,255,.5)");
  gl.addColorStop(0.5, "rgba(30,110,255,.22)");
  gl.addColorStop(1, "rgba(0,60,255,0)");
  g.fillStyle = gl;
  g.beginPath();
  g.arc(0, 0, R * 1.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.rotate(spin);
  const blade = () => {
    g.beginPath();
    g.moveTo(R * 0.17, -R * 0.2);
    g.quadraticCurveTo(R * 0.34, -R * 0.07, R, 0);
    g.quadraticCurveTo(R * 0.34, R * 0.07, R * 0.17, R * 0.2);
    g.closePath();
  };
  // body of the star: deep blue to bright cyan, translucent
  g.save();
  for (let k = 0; k < 4; k++) {
    g.save();
    g.rotate((k * Math.PI) / 2);
    blade();
    const bg = g.createLinearGradient(R * 0.1, 0, R, 0);
    bg.addColorStop(0, "rgba(12,60,200,.92)");
    bg.addColorStop(0.55, "rgba(30,120,255,.88)");
    bg.addColorStop(1, "rgba(150,235,255,.95)");
    g.fillStyle = bg;
    g.fill();
    // crackling light inside the blade: a jagged line that changes several times a second
    g.save();
    g.clip();
    const seed = Math.floor(t * 14) + k * 17;
    const hs = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    for (let l = 0; l < 3; l++) {
      g.beginPath();
      let px = R * (0.2 + 0.1 * l), py = (hs(seed + l) - 0.5) * R * 0.1;
      g.moveTo(px, py);
      for (let s = 0; s < 7; s++) {
        px += R * (0.09 + 0.05 * hs(seed + s * 3 + l));
        py = (hs(seed * 1.3 + s * 5 + l * 9) - 0.5) * R * 0.14 * (1 - px / R);
        g.lineTo(px, py);
      }
      g.strokeStyle = l ? "rgba(190,245,255,.8)" : "rgba(255,255,255,.95)";
      g.lineWidth = Math.max(1, R * (l ? 0.012 : 0.02));
      g.stroke();
    }
    g.restore();
    // bright rim
    blade();
    g.lineJoin = "round";
    g.strokeStyle = "rgba(170,240,255,.95)";
    g.lineWidth = Math.max(1.4, R * 0.022);
    g.stroke();
    // a hot streak along each edge
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = "rgba(120,220,255,.6)";
    g.lineWidth = Math.max(2, R * 0.05);
    g.stroke();
    g.globalCompositeOperation = "source-over";
    g.restore();
  }
  g.restore();
  // the hub: a hollow ring with a dark centre
  g.beginPath();
  g.arc(0, 0, R * 0.2, 0, Math.PI * 2);
  g.fillStyle = "rgba(10,40,150,.95)";
  g.fill();
  g.lineWidth = Math.max(1.5, R * 0.03);
  g.strokeStyle = "rgba(190,245,255,.95)";
  g.stroke();
  g.beginPath();
  g.arc(0, 0, R * 0.11, 0, Math.PI * 2);
  g.fillStyle = "rgba(2,14,70,.95)";
  g.fill();
  g.strokeStyle = "rgba(120,220,255,.7)";
  g.lineWidth = Math.max(1, R * 0.015);
  g.stroke();
  // tip glints
  g.fillStyle = "#ffffff";
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const tw = 0.6 + 0.4 * Math.sin(t * 14 + k * 2);
    g.beginPath();
    g.arc(Math.cos(a) * R * 0.99, Math.sin(a) * R * 0.99, Math.max(1, R * 0.025 * tw), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
