/**
 * The big falling fire moves, built like the "Torrential Legacy of Hell" reference: a core beam of fire pouring down, an ornate shield barrier
 * on the floor, runes of magma orbiting it, dark smoke rising, a cracked-lava scorch decal where it lands, and shimmering heat.
 * Each move arranges them differently:
 *   Blast Burn  - one huge red-orange beam, a heavy barrier with eight points, thick smoke
 *   Fusion Flare - two gold-white beams braided together, a sun-ray barrier, drifting white vapour
 *   Eruption    - a lava geyser (wide at the foot, ragged, throwing rocks), a cracked crater, black smoke
 *   Fire Blast  - a slim hot beam, a six-pointed star barrier
 */
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export type HellSig = { x: number; y: number; r: number; t: number; life: number; seed: number; mv?: string };
export const HELL_IDS = new Set(["blastburn", "fusionflare", "eruption", "fireblast"]);

type Look = { dk: string; md: string; lt: string; core: string; beam: "one" | "twin" | "geyser" | "slim"; points: number; runes: number; smoke: number; vapour: boolean; w: number };
const LOOK: Record<string, Look> = {
  blastburn: { dk: "#3a0c04", md: "#ff4a14", lt: "#ffa030", core: "#fff0c0", beam: "one", points: 8, runes: 12, smoke: 1, vapour: false, w: 0.3 },
  fusionflare: { dk: "#6a3a08", md: "#ffb020", lt: "#ffe28a", core: "#ffffff", beam: "twin", points: 24, runes: 10, smoke: 0.5, vapour: true, w: 0.2 },
  eruption: { dk: "#240804", md: "#e03010", lt: "#ff8a22", core: "#ffd870", beam: "geyser", points: 0, runes: 8, smoke: 1.4, vapour: false, w: 0.36 },
  fireblast: { dk: "#481004", md: "#ff6a22", lt: "#ffc060", core: "#fff2d0", beam: "slim", points: 6, runes: 8, smoke: 0.6, vapour: false, w: 0.16 },
};
const lookOf = (s: HellSig) => LOOK[s.mv ?? "blastburn"] ?? LOOK.blastburn!;

/** A rune: a few strokes that look like a carved glyph, chosen by index. */
function rune(g: G, i: number, size: number) {
  g.beginPath();
  const k = Math.floor(hs(i * 3.1) * 5);
  const a = size;
  if (k === 0) { g.moveTo(-a * 0.5, -a); g.lineTo(-a * 0.5, a); g.moveTo(-a * 0.5, -a * 0.2); g.lineTo(a * 0.6, -a * 0.8); g.moveTo(-a * 0.5, a * 0.1); g.lineTo(a * 0.6, a * 0.7); }
  else if (k === 1) { g.moveTo(0, -a); g.lineTo(a * 0.6, 0); g.lineTo(0, a); g.lineTo(-a * 0.6, 0); g.closePath(); g.moveTo(0, -a * 0.4); g.lineTo(0, a * 0.4); }
  else if (k === 2) { g.moveTo(-a * 0.6, -a); g.lineTo(a * 0.6, -a); g.moveTo(0, -a); g.lineTo(0, a); g.moveTo(-a * 0.5, a * 0.3); g.lineTo(a * 0.5, a * 0.3); }
  else if (k === 3) { g.arc(0, -a * 0.3, a * 0.55, Math.PI * 0.9, Math.PI * 2.1); g.moveTo(0, a * 0.25); g.lineTo(0, a); g.moveTo(-a * 0.4, a * 0.6); g.lineTo(a * 0.4, a * 0.6); }
  else { g.moveTo(-a * 0.6, a); g.lineTo(0, -a); g.lineTo(a * 0.6, a); g.moveTo(-a * 0.3, a * 0.2); g.lineTo(a * 0.3, a * 0.2); }
  // a cheap glow: a wide faint stroke under the sharp one (canvas shadowBlur is very slow on the big floor layer)
  const lw = g.lineWidth, ga = g.globalAlpha;
  g.lineWidth = lw * 3.2; g.globalAlpha = ga * 0.28; g.stroke();
  g.lineWidth = lw; g.globalAlpha = ga; g.stroke();
}

/** On the floor: the scorched cracked decal, the shield barrier, the runes turning round it, shimmering heat. */
export function hellFlat(g: G, s: HellSig) {
  const L = lookOf(s);
  const u = Math.min(1, s.t / s.life);
  const R = s.r;
  g.save();
  g.translate(s.x, s.y);
  g.lineCap = "round";
  g.lineJoin = "round";
  const decalA = sm(0, 0.06, u) * (1 - sm(0.7, 1, u));
  const ringA = sm(0, 0.1, u) * (1 - sm(0.62, 0.95, u));

  // the scorched ground: a dark burnt disc with a cracked network that glows like magma and cools
  const dg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.95);
  dg.addColorStop(0, "rgba(20,6,2,.85)"); dg.addColorStop(0.7, "rgba(30,10,4,.6)"); dg.addColorStop(1, "rgba(30,10,4,0)");
  g.globalAlpha = decalA; g.fillStyle = dg; g.beginPath(); g.arc(0, 0, R * 0.95, 0, TAU); g.fill();
  const heat = 1 - sm(0.1, 0.8, u);
  for (let pass = 0; pass < 2; pass++) {
    g.globalCompositeOperation = pass ? "lighter" : "source-over";
    g.strokeStyle = pass ? L.lt : "#150502";
    g.lineWidth = pass ? 2.2 : 4.5;
    g.globalAlpha = decalA * (pass ? 0.35 + 0.65 * heat : 0.9);
    for (let i = 0; i < 18; i++) {
      let a = hs(s.seed + i) * TAU, d = R * 0.06, x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
      g.beginPath(); g.moveTo(x, y);
      const reach = R * (0.55 + 0.45 * hs(i + 40)) * sm(0, 0.18, u);
      while (d < reach) {
        d += R * 0.075; a += (hs(s.seed + i * 13 + d) - 0.5) * 0.7;
        x = Math.cos(a) * d; y = Math.sin(a) * d * 0.9; g.lineTo(x, y);
        if (hs(s.seed + d * 3 + i) > 0.8) { g.moveTo(x, y); g.lineTo(x + Math.cos(a + 1) * R * 0.08, y + Math.sin(a + 1) * R * 0.07); g.moveTo(x, y); }
      }
      g.stroke();
    }
  }
  g.globalCompositeOperation = "lighter";
  const cg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.55);
  cg.addColorStop(0, "rgba(255,235,170,.95)"); cg.addColorStop(0.35, "rgba(255,130,40,.55)"); cg.addColorStop(1, "rgba(255,60,10,0)");
  g.globalAlpha = (1 - sm(0.05, 0.5, u)) * sm(0, 0.03, u); g.fillStyle = cg; g.beginPath(); g.arc(0, 0, R * 0.55, 0, TAU); g.fill();

  // the shield barrier: a double ring with notches, an inner ring of arcs and gems, and a pointed star (or sun rays) turning slowly
  g.save();
  g.globalAlpha = ringA;
  g.strokeStyle = L.lt; g.fillStyle = L.core;
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R * 0.82, 0, TAU); g.stroke();
  g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, R * 0.75, 0, TAU); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R * 0.46, 0, TAU); g.stroke();
  g.rotate(s.t * 0.35);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75); g.lineTo(Math.cos(a) * R * (i % 2 ? 0.82 : 0.88), Math.sin(a) * R * (i % 2 ? 0.82 : 0.88)); g.stroke(); }
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * TAU;
    g.save(); g.translate(Math.cos(a) * R * 0.785, Math.sin(a) * R * 0.785); g.rotate(a + Math.PI / 2);
    g.beginPath(); g.moveTo(0, -R * 0.05); g.lineTo(R * 0.03, 0); g.lineTo(0, R * 0.05); g.lineTo(-R * 0.03, 0); g.closePath(); g.fill(); g.restore();
  }
  g.rotate(-s.t * 0.8);
  g.lineWidth = 2;
  if (L.points >= 24) {
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.46, Math.sin(a) * R * 0.46); g.lineTo(Math.cos(a) * R * (i % 2 ? 0.58 : 0.68), Math.sin(a) * R * (i % 2 ? 0.58 : 0.68)); g.stroke(); }
  } else if (L.points > 0) {
    const n = L.points;
    g.beginPath();
    for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * TAU; const rr = R * (i % 2 ? 0.34 : 0.6); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.stroke();
  } else {
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, R * (0.3 + i * 0.09), i, i + 2.2); g.stroke(); }
  }
  g.restore();

  // runes running round the barrier, each one glowing and flickering
  g.save();
  g.rotate(s.t * 0.9);
  g.strokeStyle = L.lt; g.lineWidth = 1.8;
  for (let i = 0; i < L.runes + 4; i++) {
    const a = (i / (L.runes + 4)) * TAU;
    g.save(); g.translate(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66); g.rotate(a + Math.PI / 2);
    g.globalAlpha = ringA * (0.55 + 0.45 * Math.sin(s.t * 9 + i * 2));
    rune(g, i + Math.floor(s.seed), R * 0.045);
    g.restore();
  }
  g.restore();

  // heat shimmer: wide pale rings rising off the floor and thinning out
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const p = (s.t * 0.7 + i / 3) % 1;
    g.globalAlpha = (1 - p) * 0.22 * decalA; g.strokeStyle = L.lt; g.lineWidth = 6 - p * 4;
    g.beginPath(); g.arc(0, 0, R * (0.3 + p * 0.7), 0, TAU); g.stroke();
  }
  g.restore();
}

/** A wavering column of flame: both edges move, a bright core runs up the middle. */
function column(g: G, L: Look, w: number, h: number, t: number, seed: number, al: number, off = 0) {
  const N = 22;
  const edge = (side: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N, y = -k * h;
      const wob = Math.sin(t * 16 + k * 9 + seed + side * 1.7) * w * 0.1 + Math.sin(t * 7 + k * 5 + side) * w * 0.07;
      pts.push([off + side * (w * (0.7 + 0.5 * Math.pow(1 - k, 0.7)) * (0.5 + 0.5 * (1 - k * 0.15)) + wob), y]);
    }
    return pts;
  };
  const poly = (shrink: number) => {
    const a = edge(-1), b = edge(1);
    g.beginPath();
    a.forEach(([x, y], i) => (i ? g.lineTo(off + (x - off) * shrink, y) : g.moveTo(off + (x - off) * shrink, y)));
    for (let i = b.length - 1; i >= 0; i--) g.lineTo(off + (b[i]![0] - off) * shrink, b[i]![1]);
    g.closePath();
  };
  const layers: [number, string, number][] = [[1.15, L.dk, 0.55], [1, L.md, 0.9], [0.66, L.lt, 0.95], [0.34, L.core, 1]];
  for (const [k, c, a] of layers) { g.globalAlpha = al * a; g.fillStyle = c; poly(k); g.fill(); }
}

/** Upright pieces: the beam, the smoke, the sparks' glow, runes spiralling up the beam, the heat haze. */
export function hellItems(s: HellSig, push: (x: number, y: number, dy: number, draw: (g: G) => void) => void) {
  const L = lookOf(s);
  const u = Math.min(1, s.t / s.life);
  const R = s.r;
  const H = 520;
  // the beam: arrives in a flash, holds, then thins and goes out
  const grow = sm(0, 0.05, u);
  const hold = 1 - sm(0.26, 0.55, u);
  if (hold > 0.01) {
    push(s.x, s.y, 0.2, (g) => {
      g.save();
      g.translate(s.x, s.y);
      g.globalCompositeOperation = "lighter";
      const w = R * L.w * (0.6 + 0.4 * hold) * (1.5 - 0.5 * grow);
      if (L.beam === "twin") {
        for (const sg of [-1, 1]) column(g, L, w * 0.55, H * grow, s.t, s.seed + sg * 5, hold, Math.sin(s.t * 6) * w * 0.5 * sg);
      } else if (L.beam === "geyser") {
        // wide at the foot, ragged, with the top breaking into tongues
        column(g, L, w * 1.15, H * 0.8 * grow, s.t, s.seed, hold);
        for (let i = 0; i < 4; i++) column(g, L, w * 0.35, H * (0.45 + 0.35 * hs(i + s.seed)) * grow, s.t, s.seed + i * 3, hold * 0.9, (i - 1.5) * w * 0.9);
      } else column(g, L, w * (L.beam === "slim" ? 0.7 : 1), H * grow, s.t, s.seed, hold);
      // the flare where it meets the ground
      const fr = R * 0.5;
      const rg = g.createRadialGradient(0, -8, 0, 0, -8, fr);
      rg.addColorStop(0, "rgba(255,255,255,.95)"); rg.addColorStop(0.3, L.lt); rg.addColorStop(1, "rgba(255,80,10,0)");
      g.globalAlpha = hold; g.fillStyle = rg; g.beginPath(); g.ellipse(0, -8, fr, fr * 0.55, 0, 0, TAU); g.fill();
      // heat haze: pale wavering strokes rising alongside the beam
      g.strokeStyle = "rgba(255,230,190,.5)"; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1, x0 = side * (w * 1.6 + (i >> 1) * 14);
        g.globalAlpha = 0.28 * hold;
        g.beginPath();
        for (let k = 0; k <= 14; k++) { const y = -k * 30 - ((s.t * 120 + i * 40) % 60); const x = x0 + Math.sin(k * 0.9 + s.t * 5 + i) * 7; k ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      g.restore();
    });
  }
  // runes spiralling up round the beam
  const ra = sm(0.03, 0.14, u) * (1 - sm(0.5, 0.8, u));
  if (ra > 0.02) {
    const n = L.runes;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + s.t * (1.6 + (i % 3) * 0.2);
      const rad = R * (0.3 + 0.07 * hs(i + 3));
      const hgt = 40 + ((i / n) * 230 + s.t * 40) % 230;
      const px = s.x + Math.cos(ang) * rad, py = s.y + Math.sin(ang) * rad * 0.45;
      push(px, py, Math.sin(ang) > 0 ? 0.5 : -0.5, (g) => {
        g.save(); g.translate(px, py - hgt); g.globalCompositeOperation = "lighter";
        g.strokeStyle = L.lt; g.lineWidth = 1.8;
        g.globalAlpha = ra * (0.5 + 0.5 * Math.sin(s.t * 8 + i)) * (Math.sin(ang) > 0 ? 1 : 0.6);
        rune(g, i + Math.floor(s.seed), 7); g.restore();
      });
    }
  }
  // dark smoke climbing from the impact, widening and thinning as it rises
  const nS = Math.round(7 * L.smoke);
  for (let i = 0; i < nS; i++) {
    const start = 0.04 + 0.5 * (i / nS);
    const p = (u - start) / 0.6;
    if (p <= 0 || p >= 1) continue;
    const px = s.x + (hs(s.seed + i) - 0.5) * R * 0.45 + Math.sin(p * 4 + i) * 10;
    push(px, s.y, 0.7, (g) => {
      g.save(); g.translate(px, s.y - 20 - p * 280 * (0.7 + 0.5 * hs(i)));
      const rr = R * (0.14 + 0.2 * p) * (0.8 + 0.4 * hs(i + 5));
      const sg = g.createRadialGradient(0, 0, 0, 0, 0, rr);
      const dark = L.vapour ? "235,235,240" : "26,18,16";
      sg.addColorStop(0, `rgba(${dark},.75)`); sg.addColorStop(0.6, `rgba(${dark},.4)`); sg.addColorStop(1, `rgba(${dark},0)`);
      g.globalAlpha = Math.sin(p * Math.PI) * (L.vapour ? 0.55 : 0.85); g.fillStyle = sg;
      g.beginPath(); g.ellipse(0, 0, rr, rr * 0.85, 0, 0, TAU); g.fill();
      // a hot rim lit from below
      g.globalCompositeOperation = "lighter"; g.globalAlpha *= (1 - p) * 0.35; g.fillStyle = L.md;
      g.beginPath(); g.ellipse(0, rr * 0.5, rr * 0.7, rr * 0.25, 0, 0, TAU); g.fill();
      g.restore();
    });
  }
}
