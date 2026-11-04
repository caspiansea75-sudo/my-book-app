// Floor hazards: Spikes (steel caltrops), Toxic Spikes (a poison puddle with purple spikes) and Stealth Rock (sharp
// rocks hanging in the air). Drawn flat on the floor under the fighters.
import { organic, smooth } from "./arena-shape";
import { texPat } from "./arena-tex";

type G = CanvasRenderingContext2D;
type Hz = { id: number; kind: "spikes" | "toxic" | "rocks"; x: number; y: number; r: number; life: number; max: number; team: number };

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function caltrop(g: G, x: number, y: number, s: number, rot: number, body: string, tip: string, edge: string) {
  // four points of a caltrop seen from above: three splayed spikes and one pointing at the viewer
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(a), cy = Math.sin(a);
    const gr = g.createLinearGradient(0, 0, cx * s, cy * s);
    gr.addColorStop(0, body); gr.addColorStop(1, tip);
    g.fillStyle = gr;
    g.strokeStyle = edge; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-cy * s * 0.18, cx * s * 0.18);
    g.lineTo(cx * s, cy * s);
    g.lineTo(cy * s * 0.18, -cx * s * 0.18);
    g.closePath(); g.fill(); g.stroke();
  }
  g.fillStyle = tip;
  g.beginPath(); g.arc(0, 0, s * 0.16, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function drawHazard(g: G, h: Hz, t: number, enemy: boolean, flat = false) {
  const age = h.max - h.life;
  const a = Math.min(1, age / 0.4) * Math.min(1, h.life / 1.6);
  if (a <= 0) return;
  const sd = h.id * 7 + 3;
  g.save();
  g.globalAlpha = a;
  // a scuffed patch of floor and a faint boundary (red for foes' hazards, green for your own)
  smooth(g, organic(h.x, h.y, h.r, h.r * 0.78, sd, 0.2, t * 0.2, 30));
  g.fillStyle = h.kind === "toxic" ? "rgba(70,20,90,.28)" : "rgba(20,14,10,.2)";
  g.fill();
  g.setLineDash([7, 8]); g.lineDashOffset = -t * 8;
  g.strokeStyle = enemy ? "rgba(255,95,80,.55)" : "rgba(120,235,140,.4)"; g.lineWidth = 1.6; g.stroke();
  g.setLineDash([]);

  if (flat && h.kind !== "toxic") {
    // the player views: the spikes and rocks stand up out of the floor, and the renderer draws them upright
  } else if (h.kind === "spikes") {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const ang = hash(sd + i) * 6.28, d = Math.sqrt(hash(sd + i * 3)) * 0.82;
      const x = h.x + Math.cos(ang) * h.r * d, y = h.y + Math.sin(ang) * h.r * 0.78 * d;
      g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(x + 2, y + 3, 9, 4, 0, 0, 6.3); g.fill();
      caltrop(g, x, y, 9 + hash(sd + i * 5) * 4, hash(sd + i * 9) * 6.28, "#8d96a3", "#e4eaf2", "#2c323b");
      if (Math.sin(t * 2.2 + i * 1.7) > 0.93) { g.fillStyle = "#fff"; g.fillRect(x - 1, y - 6, 2, 2); }
    }
  } else if (h.kind === "toxic") {
    g.save();
    smooth(g, organic(h.x, h.y, h.r * 0.86, h.r * 0.66, sd + 5, 0.3, t * 0.3, 26)); g.clip();
    g.globalAlpha = a * 0.85;
    g.fillStyle = "#5b1f7a"; g.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    g.globalAlpha = a * 0.6; g.fillStyle = texPat(g, "venom", t * 8, t * 4, 1); g.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    g.restore();
    g.globalAlpha = a;
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.5 + hash(sd + i) * 3) % 1.3;
      if (k > 1) continue;
      const bx = h.x + (hash(sd + i * 7) - 0.5) * h.r * 1.3, by = h.y + (hash(sd + i * 11) - 0.5) * h.r * 0.9;
      g.strokeStyle = `rgba(230,170,255,${1 - k})`; g.fillStyle = `rgba(200,120,255,${0.3 * (1 - k)})`; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(bx, by - k * 6, 2 + k * 6, 2 + k * 5, 0, 0, 6.3); g.fill(); g.stroke();
    }
    for (let i = 0; i < (flat ? 0 : 8); i++) {
      const ang = hash(sd + i * 13) * 6.28, d = 0.25 + hash(sd + i * 17) * 0.6;
      caltrop(g, h.x + Math.cos(ang) * h.r * d, h.y + Math.sin(ang) * h.r * 0.7 * d, 8 + hash(i) * 3, hash(sd + i) * 6.28, "#6a3a8c", "#e08bff", "#2a0f3a");
    }
  } else {
    // hanging rocks: they bob, turn slowly, and glow a little along their edges
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 6.28 + hash(sd + i) * 0.8, d = 0.3 + hash(sd + i * 3) * 0.55;
      const x = h.x + Math.cos(ang) * h.r * d, y0 = h.y + Math.sin(ang) * h.r * 0.7 * d;
      const bob = Math.sin(t * 1.8 + i * 1.3) * 4, up = 12 + hash(sd + i * 5) * 8;
      const y = y0 - up + bob;
      const s = 8 + hash(sd + i * 7) * 7;
      g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x, y0 + 2, s * 0.9, s * 0.35, 0, 0, 6.3); g.fill();
      const poly = organic(x, y, s, s * 0.9, sd + i * 31, 0.45, t * 0.3 + i, 7);
      smooth(g, poly);
      g.fillStyle = "#6f6458"; g.fill();
      g.save(); g.clip(); g.globalAlpha = a * 0.7; g.fillStyle = texPat(g, "rock", x * 2, y * 2, 0.6); g.fillRect(x - s, y - s, s * 2, s * 2); g.restore();
      g.globalAlpha = a;
      g.strokeStyle = "rgba(255,200,110,.75)"; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.moveTo(x - s * 0.5, y - s * 0.2); g.lineTo(x - s * 0.05, y - s * 0.65); g.lineTo(x + s * 0.1, y - s * 0.3); g.closePath(); g.fill();
    }
  }
  g.restore();
}
