/**
 * One look per big line strike. Before, every one of them (Hyper Beam, Overheat, Hydro Cannon, Zap Cannon, Prismatic Laser, Steel Beam...)
 * was the same twin-spiral beam in a different colour. Each id below draws its own body: a different shape, rhythm and ornament along the line.
 * The caller has saved the canvas; these functions translate and rotate it themselves, like the beams in the renderer do.
 */
type Z = { x: number; y: number; x2: number; y2: number; r: number; id: number };
type Pal = [string, string, string];

export const BEAM_STYLE = new Set(["solarbeam", "thunderbolt", "hyperbeam", "overheat", "hydrocannon", "zapcannon", "prismaticlaser", "aeroblast", "moongeistbeam", "steelbeam", "fleurcannon", "judgment"]);

const TAU = Math.PI * 2;
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function drawBeamStyle(g: CanvasRenderingContext2D, id: string, z: Z, a: number, t: number, pal: Pal): boolean {
  if (!BEAM_STYLE.has(id)) return false;
  const [c0, c1, c2] = pal;
  const ang = Math.atan2(z.y2 - z.y, z.x2 - z.x);
  const L = Math.hypot(z.x2 - z.x, z.y2 - z.y);
  const grow = a > 0.8 ? 1 : 0.35 + a * 0.8;
  const W = z.r * grow;
  g.translate(z.x, z.y);
  g.rotate(ang);
  g.lineCap = "round";
  g.lineJoin = "round";
  const halo = (col: string, k = 1.8, al = 0.5) => {
    const cg = g.createLinearGradient(0, -W * k, 0, W * k);
    cg.addColorStop(0, "rgba(0,0,0,0)"); cg.addColorStop(0.5, col); cg.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a * al; g.fillStyle = cg; g.fillRect(0, -W * k, L, W * k * 2);
  };
  const orb = (x: number, r: number, inner = "#fff", mid = c1) => {
    const rg = g.createRadialGradient(x, 0, 0, x, 0, r);
    rg.addColorStop(0, inner); rg.addColorStop(0.4, mid); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a; g.fillStyle = rg; g.beginPath(); g.arc(x, 0, r, 0, TAU); g.fill();
  };
  const seed = Math.floor(t * 18);

  switch (id) {
    case "solarbeam": {
      // a broad column of sunlight: soft, wide, with light rays crossing it and motes pulled in from the sides
      halo(c0, 2.4, 0.5);
      g.globalAlpha = a * 0.85; g.fillStyle = c1; g.fillRect(0, -W * 0.8, L, W * 1.6);
      g.globalAlpha = a; g.fillStyle = c2; g.fillRect(0, -W * 0.35, L, W * 0.7);
      g.strokeStyle = c2; g.lineWidth = 2;
      for (let d = (t * 260) % 44 - 44; d < L; d += 44) { g.globalAlpha = a * 0.6; g.beginPath(); g.moveTo(d, -W * 1.5); g.lineTo(d + 30, W * 1.5); g.stroke(); }
      for (let k = 0; k < 16; k++) { const d = ((k * 53 + t * 200) % Math.max(40, L)); const s = (k % 2 ? 1 : -1) * W * (2.2 - ((t * 1.5 + k * 0.13) % 1) * 1.9); g.globalAlpha = a * 0.8; g.fillStyle = "#e4ff9a"; g.beginPath(); g.arc(d, s, 2.4, 0, TAU); g.fill(); }
      for (let i = 0; i < 12; i++) { const aa = (i / 12) * TAU + t * 3; g.globalAlpha = a * 0.7; g.strokeStyle = c2; g.beginPath(); g.moveTo(Math.cos(aa) * W * 1.2, Math.sin(aa) * W * 1.2); g.lineTo(Math.cos(aa) * W * 3.4, Math.sin(aa) * W * 3.4); g.stroke(); }
      orb(0, W * 3); orb(L, W * 2.4);
      break;
    }
    case "thunderbolt": {
      // three jagged forks that re-strike every few frames, with a white hot flicker core
      halo(c0, 1.6, 0.35);
      for (let f = 0; f < 3; f++) {
        g.strokeStyle = f === 0 ? "#ffffff" : c1; g.lineWidth = f === 0 ? W * 0.28 : W * 0.14; g.globalAlpha = a * (f === 0 ? 1 : 0.85);
        g.beginPath(); g.moveTo(0, 0);
        const steps = Math.max(6, Math.round(L / 26));
        for (let i = 1; i <= steps; i++) { const d = (i / steps) * L; const j = i === steps ? 0 : (hash(seed * 31 + i * 7 + f * 13 + z.id) - 0.5) * W * (f === 0 ? 1.6 : 2.8); g.lineTo(d, j); }
        g.stroke();
      }
      for (let k = 0; k < 7; k++) { const d = hash(seed + k * 3) * L; const dir = hash(seed + k) > 0.5 ? 1 : -1; g.strokeStyle = c1; g.lineWidth = 2; g.globalAlpha = a * 0.8; g.beginPath(); g.moveTo(d, 0); g.lineTo(d + 14, dir * W * 1.6); g.lineTo(d + 4, dir * W * 2.3); g.stroke(); }
      orb(0, W * 2); orb(L, W * 2.6);
      break;
    }
    case "hyperbeam": {
      // a hard-edged block of light: square pulses, white inside, shock rings that run ahead of it
      halo(c0, 2, 0.45);
      g.globalAlpha = a; g.fillStyle = c0; g.fillRect(0, -W * 0.95, L, W * 1.9);
      g.fillStyle = c1; g.fillRect(0, -W * 0.7, L, W * 1.4);
      g.fillStyle = "#fff"; g.fillRect(0, -W * 0.4, L, W * 0.8);
      g.fillStyle = c0;
      for (let d = (t * 600) % 70 - 70; d < L; d += 70) g.fillRect(d, -W * 0.95, 14, W * 1.9);
      g.strokeStyle = "#fff"; g.lineWidth = 3;
      for (let d = (t * 420) % 90; d < L; d += 90) { g.globalAlpha = a * 0.9; g.strokeRect(d, -W * 1.25, 8, W * 2.5); }
      orb(0, W * 2.8, "#fff", c0); orb(L, W * 3.2, "#fff", c0);
      break;
    }
    case "overheat": {
      // a torrent of flame: a fan of tongues licking along the line, red at the edges and white in the middle
      halo(c0, 2.6, 0.5);
      for (let k = 0; k < 5; k++) {
        const col = k === 0 ? "#b81e08" : k === 1 ? c0 : k === 2 ? c1 : k === 3 ? "#ffefb0" : "#ffffff";
        const w = W * (1.5 - k * 0.27);
        g.globalAlpha = a * (k < 2 ? 0.8 : 0.95); g.fillStyle = col;
        g.beginPath(); g.moveTo(0, 0);
        const n = Math.max(8, Math.round(L / 22));
        for (let i = 1; i <= n; i++) { const d = (i / n) * L; g.lineTo(d, -w * (0.7 + 0.45 * Math.sin(i * 1.9 + t * (28 + k * 5)) * (0.5 + 0.5 * hash(i + k))) * (1 + i / n * 0.25)); }
        for (let i = n; i >= 1; i--) { const d = (i / n) * L; g.lineTo(d, w * (0.7 + 0.45 * Math.sin(i * 2.3 + t * (26 + k * 4) + 2) * (0.5 + 0.5 * hash(i * 3 + k))) * (1 + i / n * 0.25)); }
        g.closePath(); g.fill();
      }
      for (let k = 0; k < 14; k++) { const d = (k * 47 + t * 340) % Math.max(40, L); g.globalAlpha = a * 0.8; g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(d, Math.sin(k * 5 + t * 12) * W * 1.7, 2.2, 0, TAU); g.fill(); }
      orb(0, W * 2.6, "#fff", c1); orb(L, W * 3, "#fff", c0);
      break;
    }
    case "hydrocannon": {
      // a thick cylinder of water: banded like a rotating drum, foam at the edges, spray thrown off the far end
      halo(c0, 2, 0.4);
      const grd = g.createLinearGradient(0, -W, 0, W);
      grd.addColorStop(0, c0); grd.addColorStop(0.35, c1); grd.addColorStop(0.5, "#ffffff"); grd.addColorStop(0.65, c1); grd.addColorStop(1, c0);
      g.globalAlpha = a; g.fillStyle = grd; g.fillRect(0, -W, L, W * 2);
      g.strokeStyle = "#ffffff"; g.lineWidth = 2.4;
      for (let d = (t * 480) % 38 - 38; d < L; d += 38) { g.globalAlpha = a * 0.7; g.beginPath(); g.moveTo(d, -W); g.quadraticCurveTo(d + 18, 0, d, W); g.stroke(); }
      for (const s of [-1, 1]) for (let d = (t * 300 + (s > 0 ? 17 : 0)) % 26; d < L; d += 26) { g.globalAlpha = a * 0.9; g.fillStyle = "#f4fcff"; g.beginPath(); g.arc(d, s * W * (1 + 0.1 * Math.sin(d + t * 20)), 4, 0, TAU); g.fill(); }
      for (let k = 0; k < 18; k++) { const p = ((t * 1.7 + k * 0.057) % 1); g.globalAlpha = a * (1 - p); g.fillStyle = "#e8f8ff"; g.beginPath(); g.arc(L + p * W * 3.5, (hash(k + seed) - 0.5) * W * 3 * p, 3 + (k % 3), 0, TAU); g.fill(); }
      orb(0, W * 2.2, "#fff", c1);
      break;
    }
    case "zapcannon": {
      // a chain of crackling balls strung on thin arcs, each ball ringed by a spark halo
      halo(c0, 1.5, 0.3);
      const n = Math.max(3, Math.round(L / 80));
      g.strokeStyle = c1; g.lineWidth = 3; g.globalAlpha = a * 0.9;
      g.beginPath(); g.moveTo(0, 0);
      for (let i = 1; i <= n * 4; i++) { const d = (i / (n * 4)) * L; g.lineTo(d, i === n * 4 ? 0 : (hash(seed * 17 + i + z.id) - 0.5) * W * 1.1); }
      g.stroke();
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * L, r = W * (0.55 + 0.18 * Math.sin(t * 24 + i * 2));
        orb(x, r * 2.2, "#fff", c1);
        g.strokeStyle = c2; g.lineWidth = 2; g.globalAlpha = a;
        for (let k = 0; k < 6; k++) { const aa = (k / 6) * TAU + t * 9 + i; g.beginPath(); g.moveTo(x + Math.cos(aa) * r, Math.sin(aa) * r); g.lineTo(x + Math.cos(aa) * r * 1.9, Math.sin(aa) * r * 1.9); g.stroke(); }
      }
      break;
    }
    case "prismaticlaser": {
      // seven thin bands of the rainbow lying side by side, fanning out a little towards the far end
      const bands = ["#ff4a4a", "#ff9a3a", "#ffe94a", "#5cf06a", "#4ac8ff", "#6a6aff", "#c05cff"];
      halo("#ffffff", 1.8, 0.25);
      for (let i = 0; i < 7; i++) {
        const off = (i - 3) * W * 0.26;
        g.strokeStyle = bands[i]!; g.lineWidth = W * 0.3; g.globalAlpha = a * 0.92;
        g.beginPath(); g.moveTo(0, off * 0.35); g.lineTo(L, off * (1 + 0.5 * Math.sin(t * 8 + i)));
        g.stroke();
      }
      g.strokeStyle = "#fff"; g.lineWidth = W * 0.16; g.globalAlpha = a; g.beginPath(); g.moveTo(0, 0); g.lineTo(L, 0); g.stroke();
      for (let k = 0; k < 14; k++) { const d = (k * 59 + t * 420) % Math.max(40, L); g.fillStyle = bands[k % 7]!; g.globalAlpha = a * 0.9; g.beginPath(); g.arc(d, (hash(k) - 0.5) * W * 2.2, 2.6, 0, TAU); g.fill(); }
      orb(0, W * 2.2, "#fff", "#ffd0f2"); orb(L, W * 2.4, "#fff", "#c8e8ff");
      break;
    }
    case "aeroblast": {
      // a column of wind: nested chevrons sweeping down the line and a white corkscrew through the middle
      halo(c0, 2.2, 0.4);
      g.strokeStyle = c1; g.lineWidth = 5;
      for (let d = (t * 520) % 60 - 60; d < L; d += 60) { g.globalAlpha = a * 0.9; g.beginPath(); g.moveTo(d - 20, -W * 1.2); g.lineTo(d + 14, 0); g.lineTo(d - 20, W * 1.2); g.stroke(); }
      g.strokeStyle = c2; g.lineWidth = 3;
      for (const ph of [0, Math.PI]) { g.globalAlpha = a; g.beginPath(); for (let d = 0; d <= L; d += 5) { const y = Math.sin(d * 0.07 - t * 34 + ph) * W * 0.8; if (d === 0) g.moveTo(d, y); else g.lineTo(d, y); } g.stroke(); }
      g.globalAlpha = a * 0.7; g.fillStyle = "#fff"; g.fillRect(0, -W * 0.15, L, W * 0.3);
      orb(0, W * 2.2, "#fff", c1); orb(L, W * 2.8, "#fff", c0);
      break;
    }
    case "moongeistbeam": {
      // a dark violet beam with crescent moons drifting along it and pale stars in its wake
      halo(c0, 2.2, 0.55);
      g.globalAlpha = a * 0.9; g.fillStyle = "#2b0a4a"; g.fillRect(0, -W * 0.8, L, W * 1.6);
      g.fillStyle = c0; g.globalAlpha = a * 0.7; g.fillRect(0, -W * 0.45, L, W * 0.9);
      for (let d = (t * 260) % 120 - 120; d < L; d += 120) {
        g.globalAlpha = a; g.fillStyle = c2; g.beginPath(); g.arc(d, 0, W * 0.9, 0, TAU); g.fill();
        g.fillStyle = "#2b0a4a"; g.beginPath(); g.arc(d + W * 0.4, -W * 0.1, W * 0.85, 0, TAU); g.fill();
      }
      for (let k = 0; k < 16; k++) { const d = (k * 47 + t * 150) % Math.max(40, L); g.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * 6 + k))); g.fillStyle = c1; g.beginPath(); g.arc(d, (hash(k * 2) - 0.5) * W * 3, 1.8 + (k % 3), 0, TAU); g.fill(); }
      orb(0, W * 2.4, c2, c0); orb(L, W * 2.8, c2, c0);
      break;
    }
    case "steelbeam": {
      // a polished metal shaft: angular edges, riveted segments, sparks scraping off its sides
      halo(c0, 1.6, 0.35);
      g.globalAlpha = a; g.fillStyle = c0;
      g.beginPath(); g.moveTo(0, -W * 0.5); g.lineTo(L * 0.92, -W * 0.8); g.lineTo(L, 0); g.lineTo(L * 0.92, W * 0.8); g.lineTo(0, W * 0.5); g.closePath(); g.fill();
      g.fillStyle = c1; g.beginPath(); g.moveTo(0, -W * 0.3); g.lineTo(L * 0.9, -W * 0.45); g.lineTo(L * 0.95, 0); g.lineTo(L * 0.9, W * 0.45); g.lineTo(0, W * 0.3); g.closePath(); g.fill();
      g.fillStyle = "#fff"; g.fillRect(0, -W * 0.08, L * 0.95, W * 0.16);
      g.strokeStyle = "#5b6b78"; g.lineWidth = 2; g.globalAlpha = a * 0.8;
      for (let d = 40; d < L * 0.9; d += 40) { g.beginPath(); g.moveTo(d, -W * 0.55); g.lineTo(d, W * 0.55); g.stroke(); }
      for (let k = 0; k < 14; k++) { const d = (k * 61 + t * 320) % Math.max(40, L); const s = k % 2 ? 1 : -1; g.strokeStyle = "#fff3c4"; g.lineWidth = 2; g.globalAlpha = a; g.beginPath(); g.moveTo(d, s * W * 0.7); g.lineTo(d - 10, s * W * 1.3); g.stroke(); }
      orb(0, W * 2, "#fff", c1); orb(L, W * 2.2, "#fff", c1);
      break;
    }
    case "fleurcannon": {
      // pink light carrying blossoms: a flower opens every so often along the line, petals and sparkles stream off
      halo(c0, 2.3, 0.5);
      g.globalAlpha = a * 0.85; g.fillStyle = c0; g.fillRect(0, -W * 0.7, L, W * 1.4);
      g.fillStyle = c1; g.globalAlpha = a; g.fillRect(0, -W * 0.38, L, W * 0.76);
      g.fillStyle = "#fff"; g.fillRect(0, -W * 0.12, L, W * 0.24);
      for (let d = (t * 240) % 110 - 110; d < L; d += 110) {
        for (let p = 0; p < 6; p++) { const aa = (p / 6) * TAU + t * 3; g.fillStyle = p % 2 ? "#ffc4ec" : "#fff"; g.globalAlpha = a; g.beginPath(); g.ellipse(d + Math.cos(aa) * W * 0.6, Math.sin(aa) * W * 0.6, W * 0.42, W * 0.22, aa, 0, TAU); g.fill(); }
        g.fillStyle = "#ffe97a"; g.beginPath(); g.arc(d, 0, W * 0.24, 0, TAU); g.fill();
      }
      for (let k = 0; k < 14; k++) { const d = (k * 53 + t * 190) % Math.max(40, L); g.globalAlpha = a * 0.8; g.fillStyle = "#fff"; const y = Math.sin(k * 4 + t * 7) * W * 1.7; g.save(); g.translate(d, y); g.rotate(k + t * 4); g.fillRect(-4, -1, 8, 2); g.fillRect(-1, -4, 2, 8); g.restore(); }
      orb(0, W * 2.4, "#fff", c1); orb(L, W * 2.6, "#fff", c1);
      break;
    }
    case "judgment": {
      // a pillar of gold-white light: haloed rings stacked along it and bars of light crossing it from both sides
      halo("#ffe9a0", 2.6, 0.45);
      g.globalAlpha = a; g.fillStyle = "#fff6cf"; g.fillRect(0, -W * 0.55, L, W * 1.1);
      g.fillStyle = "#ffffff"; g.fillRect(0, -W * 0.25, L, W * 0.5);
      for (let d = (t * 220) % 64 - 64; d < L; d += 64) {
        g.strokeStyle = "#ffd96b"; g.lineWidth = 3; g.globalAlpha = a * 0.95; g.beginPath(); g.ellipse(d, 0, W * 0.22, W * 1.5, 0, 0, TAU); g.stroke();
        g.strokeStyle = "#fff"; g.lineWidth = 1.6; g.beginPath(); g.ellipse(d, 0, W * 0.14, W * 1.1, 0, 0, TAU); g.stroke();
      }
      for (let k = 0; k < 8; k++) { const d = (k * 71 + t * 130) % Math.max(40, L); g.globalAlpha = a * 0.8; g.fillStyle = "#ffe9a0"; g.fillRect(d, -W * 2.4 * (0.5 + hash(k)), 3, W * 4.8 * (0.5 + hash(k))); }
      for (let i = 0; i < 12; i++) { const aa = (i / 12) * TAU - t * 2; g.strokeStyle = "#fff"; g.lineWidth = 2; g.globalAlpha = a * 0.8; g.beginPath(); g.moveTo(L + Math.cos(aa) * W, Math.sin(aa) * W); g.lineTo(L + Math.cos(aa) * W * 3.2, Math.sin(aa) * W * 3.2); g.stroke(); }
      orb(0, W * 2.4, "#fff", "#ffe08a"); orb(L, W * 3, "#fff", "#ffe08a");
      break;
    }
  }
  return true;
}
