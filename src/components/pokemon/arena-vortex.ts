/**
 * Storm / tornado / spin moves, built like the "fire tornado" reference sheet, with the textures of each move's own type:
 *   layer 1  fractured ground (magma cracks / wet ripples / wind streaks / leaf litter / sand cracks)
 *   layer 2  the first blast of steam, mist or dust
 *   layer 3  projectiles and embers thrown from the base (embers, drops, leaves, grit)
 *   layer 4  the vortex core: twisted ribbons spiralling up a dark funnel
 *   layer 5  a billowing cloud on top, tinted by the type
 * All of it draws in absolute world coordinates (see `at` in the renderer).
 */
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export type VSig = { style: string; x: number; y: number; r: number; t: number; life: number; seed: number };
type Cfg = { dk: string; md: string; lt: string; core: string; add: boolean; ground: "plates" | "ripples" | "gusts"; plate: string; crack: string; smoke: string; glowSmoke: boolean; bit: "ember" | "drop" | "leaf" | "grit" | "dust" };
export const VORTEX: Record<string, Cfg> = {
  magmastorm: { dk: "#3a0c04", md: "#ff5a14", lt: "#ffb030", core: "#fff0b8", add: true, ground: "plates", plate: "#2a1c18", crack: "#ff6a20", smoke: "34,28,26", glowSmoke: true, bit: "ember" },
  waterspout: { dk: "#0d3a80", md: "#2f86e0", lt: "#9fdcff", core: "#ffffff", add: false, ground: "ripples", plate: "#1a4a8a", crack: "#bff0ff", smoke: "205,228,242", glowSmoke: false, bit: "drop" },
  hurricane: { dk: "#6a7a92", md: "#b4c2d8", lt: "#e8f0fa", core: "#ffffff", add: false, ground: "gusts", plate: "#5a6678", crack: "#ffffff", smoke: "210,216,228", glowSmoke: false, bit: "dust" },
  leafstorm: { dk: "#1c5a1f", md: "#4fb83a", lt: "#b8f07a", core: "#f4ffd8", add: false, ground: "plates", plate: "#33281c", crack: "#7ad85a", smoke: "66,96,56", glowSmoke: false, bit: "leaf" },
  sandstorm: { dk: "#7a5a2c", md: "#c89a50", lt: "#ecd29a", core: "#fff2cc", add: false, ground: "plates", plate: "#5a4026", crack: "#e0b878", smoke: "150,120,82", glowSmoke: false, bit: "grit" },
};
export const isVortex = (st: string) => st in VORTEX;

const rim = (c: Cfg) => (c.add ? "lighter" : "source-over") as GlobalCompositeOperation;

export function vortexFlat(g: G, s: VSig) {
  const c = VORTEX[s.style]!;
  const u = Math.min(1, s.t / s.life), R = s.r * 1.05;
  const a = sm(0, 0.06, u) * (1 - sm(0.75, 1, u));
  g.save(); g.translate(s.x, s.y); g.lineJoin = "round"; g.lineCap = "round";
  if (c.ground === "plates") {
    // layer 1: a disc of broken plates with the glow (or dark earth) showing between them
    const gl = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gl.addColorStop(0, c.crack); gl.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a * (c.add ? 0.5 : 0.25); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    const rings = [[0.0, 1, 0.32], [0.32, 7, 0.66], [0.66, 12, 1.0]];
    const grow = sm(0, 0.15, u);
    rings.forEach(([r0, n, r1], ri) => {
      for (let i = 0; i < (n as number); i++) {
        const nn = n as number, a0 = (i / nn) * TAU + ri * 0.4 + hs(i + ri * 9 + s.seed) * 0.2, a1 = ((i + 1) / nn) * TAU + ri * 0.4;
        const j = (k: number) => 0.9 + 0.2 * hs(k + s.seed + ri * 31 + i);
        const ra = (r0 as number) * R * grow, rb = (r1 as number) * R * grow * j(1), gap = 0.03 + 0.01 * ri;
        g.beginPath();
        if (nn === 1) { for (let k = 0; k < 7; k++) { const aa = (k / 7) * TAU, rr = rb * 0.85 * j(k + 40); k ? g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr * 0.9) : g.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr * 0.9); } g.closePath(); }
        else {
          const A0 = a0 + gap, A1 = a1 - gap;
          g.moveTo(Math.cos(A0) * (ra + 2) , Math.sin(A0) * (ra + 2) * 0.9);
          g.lineTo(Math.cos(A0 + 0.02) * rb, Math.sin(A0 + 0.02) * rb * 0.9);
          g.lineTo(Math.cos((A0 + A1) / 2) * rb * j(3), Math.sin((A0 + A1) / 2) * rb * j(3) * 0.9);
          g.lineTo(Math.cos(A1) * rb, Math.sin(A1) * rb * 0.9);
          g.lineTo(Math.cos(A1) * (ra + 2), Math.sin(A1) * (ra + 2) * 0.9);
          g.closePath();
        }
        const lift = hs(i + ri * 5 + s.seed) * 0.15;
        g.globalAlpha = a * 0.95; g.fillStyle = c.plate; g.fill();
        g.globalAlpha = a * (0.5 + lift); g.strokeStyle = c.crack; g.lineWidth = c.add ? 2.4 : 1.6;
        if (c.add) { g.save(); g.globalCompositeOperation = "lighter"; g.stroke(); g.restore(); } else g.stroke();
      }
    });
  } else if (c.ground === "ripples") {
    for (let i = 0; i < 4; i++) {
      const k = (u * 1.5 + i / 4) % 1;
      g.globalAlpha = a * (1 - k) * 0.8; g.strokeStyle = i % 2 ? c.lt : c.md; g.lineWidth = 5 - k * 3;
      g.beginPath(); g.ellipse(0, 0, R * (0.25 + k * 0.85), R * (0.25 + k * 0.85) * 0.9, 0, 0, TAU); g.stroke();
    }
    const wg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.8);
    wg.addColorStop(0, "rgba(20,70,150,.6)"); wg.addColorStop(1, "rgba(20,70,150,0)");
    g.globalAlpha = a; g.fillStyle = wg; g.beginPath(); g.arc(0, 0, R * 0.8, 0, TAU); g.fill();
  } else {
    // wind streaks curling round the base
    g.strokeStyle = c.lt;
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * TAU + s.t * 2.2 * (1 + hs(i) * 0.3), rr = R * (0.3 + 0.7 * hs(i + s.seed));
      g.globalAlpha = a * 0.5; g.lineWidth = 2 + hs(i + 3) * 2;
      g.beginPath(); g.arc(0, 0, rr, a0, a0 + 0.5 + hs(i + 7) * 0.6); g.stroke();
    }
  }
  g.restore();
}

function bit(g: G, kind: Cfg["bit"], size: number, c: Cfg, rot: number) {
  g.rotate(rot);
  if (kind === "ember") { g.globalCompositeOperation = "lighter"; g.fillStyle = c.lt; g.shadowColor = c.md; g.shadowBlur = 8; g.beginPath(); g.moveTo(0, -size * 1.6); g.quadraticCurveTo(size, 0, 0, size); g.quadraticCurveTo(-size, 0, 0, -size * 1.6); g.fill(); }
  else if (kind === "drop") { g.fillStyle = c.lt; g.beginPath(); g.moveTo(0, -size * 1.5); g.quadraticCurveTo(size, 0, 0, size * 0.8); g.quadraticCurveTo(-size, 0, 0, -size * 1.5); g.fill(); }
  else if (kind === "leaf") { g.fillStyle = c.md; g.strokeStyle = c.dk; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -size * 1.8); g.quadraticCurveTo(size * 1.3, 0, 0, size * 1.8); g.quadraticCurveTo(-size * 1.3, 0, 0, -size * 1.8); g.fill(); g.stroke(); }
  else if (kind === "grit") { g.fillStyle = c.dk; g.fillRect(-size * 0.6, -size * 0.6, size * 1.2, size * 1.2); }
  else { g.fillStyle = c.core; g.globalAlpha *= 0.7; g.fillRect(-size * 1.2, -size * 0.3, size * 2.4, size * 0.6); }
}

export function vortexItems(s: VSig, push: (x: number, y: number, dy: number, draw: (g: G) => void) => void) {
  const c = VORTEX[s.style]!;
  const u = Math.min(1, s.t / s.life), R = s.r;
  const grow = sm(0.02, 0.22, u), fade = 1 - sm(0.72, 1, u);
  const H = (150 + R * 0.7) * grow;
  const rad = (k: number) => R * (0.2 + 0.48 * Math.pow(k, 1.15)) * (0.8 + 0.2 * grow);

  // layer 2: the first blast, steam or dust puffing out low and rising
  const bl = sm(0, 0.06, u) * (1 - sm(0.12, 0.42, u));
  if (bl > 0.02) push(s.x, s.y, -0.2, (g) => {
    g.save(); g.translate(s.x, s.y);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + hs(i + s.seed), k = sm(0, 0.35, u), d = R * (0.2 + 0.7 * k) * (0.7 + 0.5 * hs(i)), rr = R * (0.2 + 0.16 * hs(i + 3)) * (0.5 + k);
      const px = Math.cos(a) * d, py = Math.sin(a) * d * 0.5 - k * 40 - 8;
      const sg = g.createRadialGradient(px, py, 0, px, py, rr);
      sg.addColorStop(0, `rgba(${c.glowSmoke ? "190,170,150" : c.smoke},.75)`); sg.addColorStop(1, `rgba(${c.glowSmoke ? "190,170,150" : c.smoke},0)`);
      g.globalAlpha = bl; g.fillStyle = sg; g.beginPath(); g.ellipse(px, py, rr, rr * 0.8, 0, 0, TAU); g.fill();
    }
    g.restore();
  });

  // layer 4: the vortex, drawn in two halves so the ribbons pass behind and in front of the dark funnel
  const ribbons = (g: G, front: boolean) => {
    const N = 5, SEG = 26;
    for (let j = 0; j < N; j++) {
      const ph = (j / N) * TAU;
      for (let i = 0; i < SEG; i++) {
        const k0 = i / SEG, k1 = (i + 1) / SEG;
        const ang0 = ph + k0 * 5.2 - s.t * 3.4, ang1 = ph + k1 * 5.2 - s.t * 3.4;
        const z = Math.sin((ang0 + ang1) / 2);
        if ((z > 0) !== front) continue;
        const wob = (k: number) => (c.add ? Math.sin(s.t * 13 + k * 22 + j * 3) * 3 : 0);
        const x0 = Math.cos(ang0) * rad(k0) + wob(k0), y0 = -k0 * H + z * 3, x1 = Math.cos(ang1) * rad(k1) + wob(k1), y1 = -k1 * H + z * 3;
        const w = (5 + 11 * k0) * (0.6 + 0.4 * Math.abs(Math.sin(ang0 * 0.5 + j))) * (front ? 1 : 0.85);
        const charred = c.add && hs(i * 7 + j * 13 + Math.floor(s.t * 3)) > 0.82;
        const edge = Math.min(1, (1 - k0) * 5) * Math.min(1, k0 * 8 + 0.3);
        g.globalAlpha = fade * edge * (front ? 1 : 0.6);
        g.globalCompositeOperation = charred ? "source-over" : rim(c);
        for (const [m, col, lw] of [[1.5, charred ? "#1a0a06" : c.dk, 1], [1, c.md, 0.9], [0.55, c.lt, 0.9], [0.22, c.core, 1]] as const) {
          g.strokeStyle = col; g.lineWidth = w * (m as number) * (lw as number);
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        }
      }
    }
  };
  push(s.x, s.y, -0.6, (g) => { g.save(); g.translate(s.x, s.y); g.lineCap = "round"; ribbons(g, false); g.restore(); });
  push(s.x, s.y, 0, (g) => {
    g.save(); g.translate(s.x, s.y);
    // the dark core funnel
    g.beginPath(); g.moveTo(-rad(0) * 0.7, 0);
    for (let i = 0; i <= 14; i++) { const k = i / 14; g.lineTo(-rad(k) * 0.8, -k * H); }
    for (let i = 14; i >= 0; i--) { const k = i / 14; g.lineTo(rad(k) * 0.8, -k * H); }
    g.closePath();
    const fg = g.createLinearGradient(0, 0, 0, -H);
    fg.addColorStop(0, `rgba(${c.glowSmoke ? "20,8,4" : c.smoke},.85)`); fg.addColorStop(1, `rgba(${c.glowSmoke ? "30,16,10" : c.smoke},.45)`);
    g.globalAlpha = fade * 0.9; g.fillStyle = fg; g.fill();
    // a hot glow from the base
    if (c.add) { g.globalCompositeOperation = "lighter"; const hg = g.createRadialGradient(0, -8, 0, 0, -8, R * 0.6); hg.addColorStop(0, "rgba(255,200,90,.8)"); hg.addColorStop(1, "rgba(255,70,10,0)"); g.globalAlpha = fade * grow; g.fillStyle = hg; g.beginPath(); g.ellipse(0, -8, R * 0.6, R * 0.3, 0, 0, TAU); g.fill(); }
    g.restore();
  });
  push(s.x, s.y, 0.6, (g) => { g.save(); g.translate(s.x, s.y); g.lineCap = "round"; ribbons(g, true); g.restore(); });

  // layer 5: the cloud riding on top, billowing and lit from below
  push(s.x, s.y, 0.7, (g) => {
    g.save(); g.translate(s.x, s.y - H);
    const ca = fade * sm(0.08, 0.3, u);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + s.t * 0.35, d = R * (0.2 + 0.45 * hs(i + s.seed)), px = Math.cos(a) * d, py = Math.sin(a) * d * 0.35 - hs(i + 9) * R * 0.3 + Math.sin(s.t * 1.5 + i) * 3;
      const rr = R * (0.28 + 0.16 * hs(i + 4)) * (0.8 + 0.2 * Math.sin(s.t + i));
      const sg = g.createRadialGradient(px, py - rr * 0.2, rr * 0.1, px, py, rr);
      sg.addColorStop(0, `rgba(${c.smoke},.9)`); sg.addColorStop(0.7, `rgba(${c.smoke},.6)`); sg.addColorStop(1, `rgba(${c.smoke},0)`);
      g.globalAlpha = ca; g.fillStyle = sg; g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill();
      if (c.glowSmoke) { g.globalCompositeOperation = "lighter"; g.globalAlpha = ca * 0.22; g.fillStyle = c.md; g.beginPath(); g.ellipse(px, py + rr * 0.55, rr * 0.7, rr * 0.22, 0, 0, TAU); g.fill(); g.globalCompositeOperation = "source-over"; }
    }
    g.restore();
  });

  // layer 3: things thrown out from the base, tumbling, plus bits caught in the spin
  const nb = 24;
  for (let i = 0; i < nb; i++) {
    const born = hs(i + s.seed) * 0.5, tau = (u - born) * s.life;
    if (tau <= 0) continue;
    const life = 1.2 + hs(i + 2) * 1.2;
    if (tau > life) continue;
    const spin = i % 2 === 0;
    let px: number, py: number, hz: number;
    if (spin) { const ang = hs(i) * TAU - s.t * 3.4 + tau * 2, k = Math.min(1, tau / life); px = s.x + Math.cos(ang) * rad(k) * 1.1; py = s.y + Math.sin(ang) * rad(k) * 0.3; hz = k * H; }
    else { const a = hs(i * 3) * TAU, v = R * (0.6 + 1.6 * hs(i + 5)); px = s.x + Math.cos(a) * v * tau; py = s.y + Math.sin(a) * v * tau * 0.4; hz = Math.max(0, 260 * tau * (0.6 + hs(i + 8)) - 330 * tau * tau); }
    push(px, py, 0.5, (g) => {
      g.save(); g.translate(px, py - hz); g.globalAlpha = fade * Math.min(1, (life - tau) * 2);
      bit(g, c.bit, 2.5 + 3 * hs(i + 6), c, s.t * 4 + i); g.restore();
    });
  }
}
