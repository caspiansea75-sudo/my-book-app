/**
 * What each lobbed move looks like while it is still in the air and coming down on its warning circle. Before, most of them were the
 * same glowing orb on a short tail; now each one is a different object: a lumpy sludge ball, a spiked seed pod, a falling icicle, a crescent
 * moon, a burning sun... Drawn upright in the "sky" queue; (z.x, z.y) is the landing spot, prog runs 0 -> 1 as it falls.
 */
type Z = { x: number; y: number; r: number; id: number };
const TAU = Math.PI * 2;
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export const FALL_IDS = new Set([
  "sludgebomb", "gunkshot", "seedbomb", "moonblast", "focusblast", "iciclecrash", "photongeyser", "lightofruin", "rocktomb", "eruption", "blastburn", "fusionflare",
  "sleeppowder", "stunspore", "leafstorm", "hurricane", "futuresight", "doomdesire", "boltstrike", "waterspout",
]);

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, mid: string, a = 1) {
  const rg = g.createRadialGradient(x, y, 0, x, y, r);
  rg.addColorStop(0, inner); rg.addColorStop(0.4, mid); rg.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha = a; g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

export function drawFall(g: CanvasRenderingContext2D, id: string, z: Z, prog: number, t: number, c: string) {
  const R = Math.max(14, z.r * 0.2);
  const H = 320;
  const oy = z.y - (1 - prog) * H - 24;
  const x = z.x;
  g.save();
  g.globalCompositeOperation = "lighter";
  switch (id) {
    case "sludgebomb": case "gunkshot": {
      // a lumpy ball of muck with drips running off it; Gunk Shot is a bigger, darker, faster one trailing three smaller lumps
      const big = id === "gunkshot";
      const rr = R * (big ? 1.5 : 1.1);
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + t * 2; glow(g, x + Math.cos(a) * rr * 0.5, oy + Math.sin(a) * rr * 0.45, rr * 0.7, big ? "#7a3a9e" : "#b070d8", big ? "#2e1046" : "#5a2a80"); }
      g.fillStyle = "#c9a0e8"; g.globalAlpha = 0.9; g.beginPath(); g.arc(x - rr * 0.3, oy - rr * 0.3, rr * 0.18, 0, TAU); g.fill();
      g.strokeStyle = big ? "#2e1046" : "#6a2f93"; g.lineWidth = 5; g.lineCap = "round";
      for (let i = 0; i < 4; i++) { const dx = (i - 1.5) * rr * 0.5; g.beginPath(); g.moveTo(x + dx, oy); g.lineTo(x + dx, oy - 30 - hash(i + z.id) * 50); g.stroke(); }
      if (big) for (let k = 1; k <= 3; k++) { glow(g, x + (k % 2 ? -1 : 1) * 12 * k, oy - k * 34, rr * 0.35, "#a060c8", "#2e1046", 0.8); }
      break;
    }
    case "seedbomb": {
      // a brown seed pod covered in spikes, spinning, with a green sap trail
      g.globalCompositeOperation = "source-over";
      g.translate(x, oy); g.rotate(t * 9);
      g.fillStyle = "#6b4a22"; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      g.fillStyle = "#9ad04a";
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.moveTo(Math.cos(a - 0.14) * R * 0.9, Math.sin(a - 0.14) * R * 0.9); g.lineTo(Math.cos(a) * R * 1.65, Math.sin(a) * R * 1.65); g.lineTo(Math.cos(a + 0.14) * R * 0.9, Math.sin(a + 0.14) * R * 0.9); g.fill(); }
      g.rotate(-t * 9); g.translate(-x, -oy);
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 6; k++) glow(g, x + (hash(k + z.id) - 0.5) * 14, oy - 22 - k * 16, 5, "#d6ff7a", "#58a32a", 0.8 - k * 0.1);
      break;
    }
    case "moonblast": {
      // a crescent moon with a pale halo, scattering stars
      glow(g, x, oy, R * 3, "#ffffff", "#ff9ad8", 0.7);
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "#fff2fb"; g.beginPath(); g.arc(x, oy, R * 1.3, 0, TAU); g.fill();
      g.fillStyle = "#c04a98"; g.globalAlpha = 0.95; g.beginPath(); g.arc(x + R * 0.55, oy - R * 0.15, R * 1.15, 0, TAU); g.fill();
      g.globalCompositeOperation = "lighter"; g.fillStyle = "#fff"; g.globalAlpha = 0.9;
      for (let k = 0; k < 9; k++) { const p = (t * 1.2 + k * 0.11) % 1; const sx = x + (hash(k) - 0.5) * R * 5, sy = oy - p * 120; g.beginPath(); g.arc(sx, sy, 2.4 * (1 - p) + 0.6, 0, TAU); g.fill(); }
      break;
    }
    case "focusblast": {
      // a tight white-hot sphere with converging rings, spinning energy
      glow(g, x, oy, R * 2.6, "#ffffff", "#ff7a3a", 0.8);
      g.strokeStyle = "#ffd0a0"; g.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const p = (t * 2 + i / 3) % 1; g.globalAlpha = p; g.beginPath(); g.arc(x, oy, R * (3 - p * 2), 0, TAU); g.stroke(); }
      g.strokeStyle = "#fff"; g.globalAlpha = 0.8;
      for (let i = 0; i < 4; i++) { const a = t * 10 + i * TAU / 4; g.beginPath(); g.arc(x, oy, R * 1.2, a, a + 0.9); g.stroke(); }
      break;
    }
    case "iciclecrash": {
      // one huge icicle, point down, glinting, with falling frost
      g.globalCompositeOperation = "source-over";
      const w = R * 1.1, h = R * 4.4;
      const gr = g.createLinearGradient(x - w, oy, x + w, oy);
      gr.addColorStop(0, "#7fc4ea"); gr.addColorStop(0.5, "#f2fcff"); gr.addColorStop(1, "#5aa8d8");
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, oy - h); g.lineTo(x + w, oy - h); g.lineTo(x + w * 0.2, oy - h * 0.2); g.lineTo(x, oy + h * 0.1); g.lineTo(x - w * 0.2, oy - h * 0.2); g.closePath(); g.fill();
      g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(x - w * 0.3, oy - h * 0.9); g.lineTo(x - w * 0.05, oy - h * 0.2); g.stroke();
      g.globalCompositeOperation = "lighter"; g.fillStyle = "#e8fbff";
      for (let k = 0; k < 10; k++) { const p = (t * 1.5 + k * 0.1) % 1; g.globalAlpha = 1 - p; g.fillRect(x + (hash(k) - 0.5) * R * 3, oy - h * p, 3, 3); }
      break;
    }
    case "photongeyser": {
      // a beam of light dropping from above that grows into a column; cyan rings climb it
      const w = R * (0.6 + prog);
      const gr = g.createLinearGradient(x - w, 0, x + w, 0);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "#aef4ff"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 0.55 * prog + 0.2; g.fillStyle = gr; g.fillRect(x - w, oy - 520, w * 2, 520 + (z.y - oy));
      glow(g, x, oy, R * 2.4, "#ffffff", "#5ad8ff", 0.9);
      g.strokeStyle = "#fff"; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const p = (t * 1.4 + i / 4) % 1; g.globalAlpha = 1 - p; g.beginPath(); g.ellipse(x, oy - p * 160, w * 1.2, w * 0.35, 0, 0, TAU); g.stroke(); }
      break;
    }
    case "lightofruin": {
      // a blazing star with long rotating rays, wings of light folded out either side
      glow(g, x, oy, R * 3.4, "#ffffff", "#ff6aa8", 0.9);
      g.strokeStyle = "#ffe6f2"; g.lineWidth = 3;
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * 2; const L = R * (i % 2 ? 3 : 5); g.globalAlpha = 0.8; g.beginPath(); g.moveTo(x + Math.cos(a) * R, oy + Math.sin(a) * R); g.lineTo(x + Math.cos(a) * L, oy + Math.sin(a) * L); g.stroke(); }
      for (const s of [-1, 1]) { g.fillStyle = "#ffc0dc"; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(x + s * R, oy); g.quadraticCurveTo(x + s * R * 4, oy - R * 2.4, x + s * R * 5, oy + R * 0.6); g.quadraticCurveTo(x + s * R * 3, oy, x + s * R, oy); g.fill(); }
      break;
    }
    case "rocktomb": {
      // five boulders dropping one after another in a ring around the target
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 6; i++) {
        const ph = Math.min(1, Math.max(0, prog * 1.6 - i * 0.12));
        const a = i / 6 * TAU, rx = x + Math.cos(a) * z.r * 0.7, ry = z.y + Math.sin(a) * z.r * 0.5 - (1 - ph) * 260;
        g.fillStyle = i % 2 ? "#8c7a66" : "#6d5f50"; g.beginPath();
        for (let k = 0; k < 7; k++) { const aa = k / 7 * TAU, rr = R * (0.8 + hash(i * 7 + k) * 0.5); const px = rx + Math.cos(aa) * rr, py = ry + Math.sin(aa) * rr; if (k) g.lineTo(px, py); else g.moveTo(px, py); }
        g.closePath(); g.fill();
      }
      break;
    }
    case "eruption": {
      // a cluster of lava bombs thrown up and falling, each trailing smoke
      for (let i = 0; i < 7; i++) {
        const a = hash(i + z.id) * TAU, d = hash(i * 3 + z.id) * z.r * 0.8;
        const ph = Math.min(1, Math.max(0, prog * 1.4 - i * 0.07));
        const bx = z.x + Math.cos(a) * d, by = z.y + Math.sin(a) * d * 0.6 - (1 - ph) * (200 + i * 20);
        glow(g, bx, by, R * 1.3, "#ffe08a", "#ff5a1a", 0.9);
        g.strokeStyle = "#ff8a3a"; g.lineWidth = 4; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 4, by - 46); g.stroke();
      }
      break;
    }
    case "blastburn": {
      // a comet: a white-hot head dragging a long tail of flame, slanting in from the side
      const sx = x - (1 - prog) * 180, sy = z.y - (1 - prog) * 300 - 20;
      const ax = -(1 - prog) * 180, ay = -(1 - prog) * 300; const l = Math.hypot(ax, ay) || 1;
      for (let k = 1; k <= 12; k++) glow(g, sx - (ax / l) * k * 14, sy - (ay / l) * k * 14, R * (1.8 - k * 0.12), k < 3 ? "#fff1b0" : "#ff9a2a", "#c8300a", 0.7 - k * 0.04);
      glow(g, sx, sy, R * 2.2, "#ffffff", "#ffb040", 1);
      break;
    }
    case "fusionflare": {
      // a small sun: a white core, a rotating corona, two intertwined flare arms
      glow(g, x, oy, R * 3.6, "#ffffff", "#ffb04a", 0.8);
      glow(g, x, oy, R * 1.6, "#ffffff", "#fff0c0", 1);
      g.strokeStyle = "#ffd08a"; g.lineWidth = 4;
      for (const ph of [0, Math.PI]) { g.globalAlpha = 0.85; g.beginPath(); for (let k = 0; k <= 40; k++) { const a = ph + t * 3 + k * 0.16, r = R * (1.2 + k * 0.1); const px = x + Math.cos(a) * r, py = oy + Math.sin(a) * r * 0.9; if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
      break;
    }
    case "sleeppowder": case "stunspore": {
      // a drifting cloud of dust sprinkling grains down; pink-green for sleep, yellow for stun
      const A = id === "sleeppowder" ? ["#ffb0e8", "#a8e890"] : ["#ffe14d", "#fff3a0"];
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 6; i++) { glow(g, x + (i - 2.5) * R * 0.8, oy - 40 + Math.sin(t * 2 + i) * 6, R * 1.6, A[i % 2]!, "rgba(255,255,255,0)", 0.5); }
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 16; k++) { const p = (t * 0.8 + k * 0.0625) % 1; g.globalAlpha = 1 - p; g.fillStyle = A[k % 2]!; g.fillRect(x + (hash(k + z.id) - 0.5) * R * 5, oy - 30 + p * 50, 3, 3); }
      break;
    }
    case "leafstorm": {
      // a spinning ring of leaves tightening as it descends
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU + t * 6, rr = R * (3 - prog * 1.4);
        const lx = x + Math.cos(a) * rr, ly = oy - 20 + Math.sin(a) * rr * 0.4 + Math.sin(a * 2 + i) * 8;
        g.save(); g.translate(lx, ly); g.rotate(a * 2); g.fillStyle = i % 2 ? "#5cc04a" : "#9be06a"; g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, TAU); g.fill(); g.restore();
      }
      break;
    }
    case "hurricane": {
      // a funnel of wind: stacked ellipses widening upward, each rotating
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 9; i++) {
        const w = R * (0.7 + i * 0.5), yy = oy - i * 18;
        g.strokeStyle = i % 2 ? "#e8f4ff" : "#a8d8ff"; g.lineWidth = 3; g.globalAlpha = 0.8;
        g.beginPath(); g.ellipse(x, yy, w, w * 0.28, 0, t * 6 + i, t * 6 + i + 4.2); g.stroke();
      }
      break;
    }
    case "futuresight": {
      // a closed eye opening in the air above the target, with a thin beam waiting
      glow(g, x, oy - 40, R * 3, "#ffd0ff", "#c040e0", 0.5);
      g.strokeStyle = "#ffe8ff"; g.lineWidth = 3; g.globalAlpha = 0.95;
      const op = Math.min(1, prog * 1.4);
      g.beginPath(); g.moveTo(x - R * 2.4, oy - 40); g.quadraticCurveTo(x, oy - 40 - R * 1.8 * op, x + R * 2.4, oy - 40); g.quadraticCurveTo(x, oy - 40 + R * 1.8 * op, x - R * 2.4, oy - 40); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(x, oy - 40, R * 0.6 * op, 0, TAU); g.fill();
      break;
    }
    case "doomdesire": {
      // a steel-bright star, many points, plunging
      glow(g, x, oy, R * 3, "#ffffff", "#ffe27a", 0.8);
      g.fillStyle = "#fff6c8"; g.globalAlpha = 0.95; g.beginPath();
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - t * 2, rr = i % 2 ? R * 0.8 : R * 2.6; const px = x + Math.cos(a) * rr, py = oy + Math.sin(a) * rr; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.closePath(); g.fill();
      break;
    }
    case "boltstrike": {
      // a thick blue-white bolt that stabs from the clouds, branching
      g.strokeStyle = "#cfe6ff"; g.lineWidth = 5; g.globalAlpha = 0.5 + prog * 0.5; g.beginPath(); g.moveTo(x + 40, oy - 500);
      for (let k = 1; k <= 10; k++) g.lineTo(x + 40 * (1 - k / 10) + (hash(k + Math.floor(t * 14)) - 0.5) * 36, oy - 500 + (500 + (z.y - oy)) * k / 10);
      g.stroke(); glow(g, x, oy, R * 2.4, "#ffffff", "#5aa8ff", 0.9);
      break;
    }
    case "waterspout": {
      // a twisting column of water standing over the target, widening to a cloud-top
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 12; i++) {
        const yy = oy - i * 22, w = R * (0.7 + i * 0.22), ph = t * 8 + i * 0.9;
        g.strokeStyle = i % 2 ? "#e0f6ff" : "#58b8f0"; g.lineWidth = 4; g.globalAlpha = 0.85;
        g.beginPath(); g.ellipse(x + Math.sin(ph) * 6, yy, w, w * 0.3, 0, ph, ph + 4); g.stroke();
      }
      break;
    }
  }
  g.restore();
}
