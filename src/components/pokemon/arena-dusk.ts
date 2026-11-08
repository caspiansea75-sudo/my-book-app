/**
 * Dark and Ghost blasts, built like the two reference sheets:
 *   "chains" (Dark Void, Astral Barrage, Moongeist Beam): a dark-energy dome over a runic ground decal, shadow chains orbiting it,
 *     cursed embers floating up and a distortion wave rolling out.
 *   "smoke"  (Shadow Ball, Hex, Shadow Blast, Dark Pulse, Night Daze): an expanding smoke dome, a ground curse decal,
 *     chaotic swirling motes and a shadow-energy glow on the floor.
 * Everything here draws in absolute world coordinates (see `at` in the renderer).
 */
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export type DuskSig = { x: number; y: number; r: number; t: number; life: number; seed: number; mv: string; ghost: boolean; big: boolean };
export const DUSK_BIG = new Set(["darkvoid", "astralbarrage", "moongeistbeam"]);
export const DUSK_IDS = new Set(["darkvoid", "astralbarrage", "moongeistbeam", "shadowball", "hex", "shadowblast", "darkpulse", "nightdaze"]);
export const duskIsGhost = (type?: string) => type === "Ghost";

const PAL = {
  dark: { lt: "#d9a8ff", md: "#9a40ff", dk: "#3a0a6a", smoke: "34,28,40", glow: "130,50,230" },
  ghost: { lt: "#e6c8ff", md: "#b060ff", dk: "#46107a", smoke: "44,32,58", glow: "170,80,255" },
};

/** The runic ground decal: ringed circles, a star, tick marks and carved glyphs. */
export function decal(g: G, R: number, t: number, a: number, p: { lt: string; md: string }, seed: number, rich: boolean) {
  g.save();
  g.globalAlpha = a * 0.8; g.strokeStyle = "#1c0636"; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(0, 0, R * 0.55, 0, TAU); g.stroke();
  g.globalCompositeOperation = "lighter";
  g.strokeStyle = p.md; g.fillStyle = p.lt; g.shadowColor = p.md; g.shadowBlur = 10; g.lineCap = "round";
  g.globalAlpha = a;
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
  g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, R * 0.9, 0, TAU); g.stroke();
  g.beginPath(); g.arc(0, 0, R * 0.55, 0, TAU); g.stroke();
  g.save(); g.rotate(t * 0.25);
  for (let i = 0; i < 40; i++) { const k = (i / 40) * TAU, r0 = R * 0.9, r1 = R * (i % 5 === 0 ? 0.97 : 0.93); g.beginPath(); g.moveTo(Math.cos(k) * r0, Math.sin(k) * r0); g.lineTo(Math.cos(k) * r1, Math.sin(k) * r1); g.stroke(); }
  g.restore();
  g.save(); g.rotate(-t * 0.4); g.lineWidth = 2;
  const pts = rich ? 7 : 5, step = rich ? 3 : 2;
  g.beginPath();
  for (let i = 0; i <= pts; i++) { const k = ((i * step) / pts) * TAU - Math.PI / 2; const x = Math.cos(k) * R * 0.88, y = Math.sin(k) * R * 0.88; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.restore();
  // little carved glyphs between the rings
  g.save(); g.rotate(t * 0.15); g.lineWidth = 1.6;
  for (let i = 0; i < 14; i++) {
    const k = (i / 14) * TAU;
    g.save(); g.translate(Math.cos(k) * R * 0.72, Math.sin(k) * R * 0.72); g.rotate(k + Math.PI / 2);
    g.globalAlpha = a * (0.55 + 0.45 * Math.sin(t * 5 + i * 1.7));
    const s = R * 0.04, q = Math.floor(hs(i + seed) * 4);
    g.beginPath();
    if (q === 0) { g.moveTo(-s, -s); g.lineTo(s, s); g.moveTo(s, -s); g.lineTo(-s, s); }
    else if (q === 1) { g.moveTo(0, -s * 1.3); g.lineTo(s, s); g.lineTo(-s, s); g.closePath(); }
    else if (q === 2) { g.moveTo(-s, 0); g.lineTo(s, 0); g.moveTo(0, -s * 1.3); g.lineTo(0, s * 1.3); }
    else { g.arc(0, 0, s, 0, TAU); g.moveTo(0, s); g.lineTo(0, s * 2); }
    g.stroke(); g.restore();
  }
  g.restore();
  g.restore();
}

/** On the floor: shadow glow, the decal, distortion rings. */
export function duskFlat(g: G, s: DuskSig) {
  const p = s.ghost ? PAL.ghost : PAL.dark;
  const u = Math.min(1, s.t / s.life);
  const R = s.r * (s.big ? 1.1 : 1);
  const a = sm(0, 0.08, u) * (1 - sm(0.68, 1, u));
  g.save();
  g.translate(s.x, s.y);
  // the shadow energy pooled on the floor
  const gg = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.05);
  gg.addColorStop(0, `rgba(${p.glow},.45)`); gg.addColorStop(0.55, "rgba(30,8,60,.55)"); gg.addColorStop(1, "rgba(10,0,20,0)");
  g.globalAlpha = a; g.fillStyle = gg; g.beginPath(); g.arc(0, 0, R * 1.05, 0, TAU); g.fill();
  decal(g, R * 0.86 * (0.7 + 0.3 * sm(0, 0.12, u)), s.t, a, p, s.seed, s.big);
  // distortion wave: a pale ring rolls outwards and fades
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < (s.big ? 3 : 2); i++) {
    const k = sm(0, 0.5, u - i * 0.07);
    if (k <= 0 || k >= 1) continue;
    g.globalAlpha = (1 - k) * 0.5; g.strokeStyle = p.lt; g.lineWidth = 7 - k * 5;
    g.beginPath(); g.arc(0, 0, R * (0.3 + k * 1.1), 0, TAU); g.stroke();
  }
  g.restore();
}

/** A tilted ring of chain links around the dome; `front` picks which half is drawn. */
function chainRing(g: G, R: number, Hc: number, tilt: number, th: number, links: number, front: boolean, al: number, p: typeof PAL.dark) {
  for (let i = 0; i < links; i++) {
    const a = (i / links) * TAU;
    const X = Math.cos(a), Y = Math.sin(a) * Math.sin(tilt), Z = Math.sin(a) * Math.cos(tilt);
    const x = X * Math.cos(th) + Z * Math.sin(th), z = -X * Math.sin(th) + Z * Math.cos(th);
    if ((z > 0) !== front) continue;
    const sx = x * R, sy = -(Hc + Y * R * 0.9) + z * R * 0.3;
    const nx = Math.cos(a + 0.05), nz = Math.sin(a + 0.05);
    const ang = Math.atan2(-(Math.sin(a + 0.05) - Math.sin(a)) * Math.sin(tilt) * 0.9 + (nz * Math.cos(tilt) - Z) * 0.3, (nx * Math.cos(th) + nz * Math.cos(tilt) * Math.sin(th)) - x);
    g.save(); g.translate(sx, sy); g.rotate(ang);
    g.globalAlpha = al * (front ? 1 : 0.55);
    const w = R * 0.07, h = R * 0.045, odd = i % 2;
    g.fillStyle = "#17121f"; g.strokeStyle = odd ? p.lt : "#6d5a8c"; g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(0, 0, odd ? w * 0.6 : w, odd ? h * 1.4 : h, 0, 0, TAU); g.fill(); g.stroke();
    g.restore();
  }
}

/** Upright pieces. */
export function duskItems(s: DuskSig, push: (x: number, y: number, dy: number, draw: (g: G) => void) => void) {
  const p = s.ghost ? PAL.ghost : PAL.dark;
  const u = Math.min(1, s.t / s.life);
  const R = s.r * (s.big ? 1.1 : 1);
  const grow = sm(0, 0.18, u), fade = 1 - sm(0.7, 1, u);

  if (s.big) {
    // the dome with chains orbiting it
    push(s.x, s.y, 0.2, (g) => {
      g.save(); g.translate(s.x, s.y);
      const Hd = R * 0.9 * grow, Wd = R * 0.86 * (0.85 + 0.15 * grow);
      const th = s.t * 0.9;
      g.globalCompositeOperation = "source-over";
      // chains behind the dome
      for (let k = 0; k < 3; k++) chainRing(g, Wd * 1.04, Hd * 0.6, 0.55 + k * 0.55, th + k * 2.1, 30, false, fade * grow, p);
      // the barrier: a glassy hemisphere, lit at the rim
      g.beginPath(); g.moveTo(-Wd, 0); g.bezierCurveTo(-Wd, -Hd * 1.35, Wd, -Hd * 1.35, Wd, 0); g.ellipse(0, 0, Wd, Wd * 0.3, 0, 0, Math.PI); g.closePath();
      const dg = g.createRadialGradient(0, -Hd * 0.35, Wd * 0.1, 0, -Hd * 0.3, Wd * 1.1);
      dg.addColorStop(0, `rgba(${p.glow},.12)`); dg.addColorStop(0.75, `rgba(${p.glow},.3)`); dg.addColorStop(1, `rgba(${p.glow},.7)`);
      g.globalAlpha = fade; g.fillStyle = dg; g.fill();
      g.globalCompositeOperation = "lighter"; g.strokeStyle = p.lt; g.lineWidth = 2.5; g.shadowColor = p.md; g.shadowBlur = 14; g.globalAlpha = fade * 0.85; g.stroke();
      // a few crackles of dark energy crawling on the surface
      g.shadowBlur = 6; g.lineWidth = 1.2; g.strokeStyle = "#f0d8ff";
      for (let i = 0; i < 4; i++) {
        if (Math.sin(s.t * 11 + i * 3) < 0.2) continue;
        let x = (hs(i + s.seed) - 0.5) * Wd * 1.4, y = -Hd * (0.2 + 0.5 * hs(i + 9));
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (hs(i * 7 + k + Math.floor(s.t * 10)) - 0.5) * 30; y += (hs(i * 5 + k + 3) - 0.5) * 24; g.lineTo(x, y); }
        g.stroke();
      }
      g.shadowBlur = 0; g.globalCompositeOperation = "source-over";
      // chains in front
      for (let k = 0; k < 3; k++) chainRing(g, Wd * 1.04, Hd * 0.6, 0.55 + k * 0.55, th + k * 2.1, 30, true, fade * grow, p);
      g.restore();
    });
  } else {
    // the smoke dome: heaps of dark smoke that billow out and up, edged in violet, with a swirl in the top
    push(s.x, s.y, 0.2, (g) => {
      g.save(); g.translate(s.x, s.y);
      const ex = sm(0, 0.35, u);
      const n = 16;
      for (let i = 0; i < n; i++) {
        const k = i / n, a = k * TAU + hs(i + s.seed) * 0.4;
        const lay = i % 3;                      // three tiers: low rim, mid, crown
        const rad = R * (0.62 - lay * 0.18) * ex;
        const px = Math.cos(a) * rad * (lay === 2 ? 0.45 : 1), py = Math.sin(a) * rad * 0.28 - R * (0.1 + lay * 0.24) * ex + Math.sin(s.t * 2 + i) * 3;
        const rr = R * (0.3 - lay * 0.05) * (0.8 + 0.4 * hs(i + 4)) * ex;
        const sg = g.createRadialGradient(px, py - rr * 0.2, rr * 0.1, px, py, rr);
        sg.addColorStop(0, `rgba(${p.smoke},.95)`); sg.addColorStop(0.7, `rgba(${p.smoke},.7)`); sg.addColorStop(1, `rgba(${p.smoke},0)`);
        g.globalAlpha = fade * 0.9; g.fillStyle = sg; g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill();
        // violet light catching the rim from the energy below
        g.globalCompositeOperation = "lighter"; g.globalAlpha = fade * 0.25 * (lay === 0 ? 1 : 0.5); g.strokeStyle = p.md; g.lineWidth = 3;
        g.beginPath(); g.arc(px, py, rr * 0.85, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
        g.globalCompositeOperation = "source-over";
      }
      // the swirl on top
      g.globalAlpha = fade * 0.5; g.strokeStyle = `rgba(${p.smoke},1)`; g.lineWidth = 5; g.lineCap = "round";
      g.beginPath();
      for (let k = 0; k < 30; k++) { const q = k / 30, a = q * 9 + s.t * 1.4, r = q * R * 0.32 * ex; const x = Math.cos(a) * r, y = -R * 0.55 * ex + Math.sin(a) * r * 0.35; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.restore();
    });
  }

  // chaotic swirling motes and floating cursed embers: shards that drift up in loose spirals
  const n = s.big ? 20 : 14;
  const ma = sm(0.04, 0.2, u) * fade;
  if (ma > 0.02) for (let i = 0; i < n; i++) {
    const ph = (u * (s.big ? 1.6 : 2.2) + hs(i + s.seed)) % 1;
    const ang = hs(i * 3 + s.seed) * TAU + s.t * (1 + hs(i) * 1.5) * (i % 2 ? 1 : -1);
    const rad = R * (0.25 + 0.7 * hs(i + 20)) * (0.6 + 0.6 * ph);
    const px = s.x + Math.cos(ang) * rad, py = s.y + Math.sin(ang) * rad * 0.4;
    const hgt = 10 + ph * R * (s.big ? 1.3 : 1.0);
    push(px, py, Math.sin(ang) > 0 ? 0.6 : -0.6, (g) => {
      g.save(); g.translate(px, py - hgt); g.rotate(s.t * 3 + i);
      const sz = (2.5 + 3.5 * hs(i + 8)) * (1 - ph * 0.5);
      g.globalAlpha = ma * Math.sin(ph * Math.PI);
      const dark = i % 3 === 0;
      g.fillStyle = dark ? "#1a1024" : p.lt;
      if (!dark) { g.globalCompositeOperation = "lighter"; g.shadowColor = p.md; g.shadowBlur = 8; }
      g.beginPath(); g.moveTo(0, -sz * 1.6); g.lineTo(sz, 0); g.lineTo(0, sz * 1.6); g.lineTo(-sz, 0); g.closePath(); g.fill();
      g.restore();
    });
  }
}
