/**
 * The stands round the pitch, as in the reference match: stepped terraces packed with spectators, advertising boards
 * and a hazard-striped kerb along the edge of the floor, dark aisles, rails and floodlights. The crowd is baked into a
 * few frames in which the arms go up and down in a wave and cameras flash, and the renderer cycles through them.
 */
import { ARENA, type StageKind } from "@/lib/pokemon/arena-engine";

export type Pad = { l: number; r: number; t: number; b: number };

const SC = 0.6; // canvas pixels per world unit (people are small, so this is plenty)
export const CROWD_FRAMES = 4;
const KERB = 10; // hazard stripe
const BOARD = 24; // advertising boards
const EDGE = KERB + BOARD; // where the stands begin
const ROW = 15.6;
const GAP = 15;
const TAU = Math.PI * 2;

function rng(seed: number) {
  let s = (Math.floor(seed) % 2147483647) + 11;
  return () => ((s = (s * 48271) % 2147483647) / 2147483647);
}

type Look = { steps: [string, string]; rail: string; tint: string; shirts: string[]; boards: string[]; glow: string; skin: string[]; hair: string[] };
const SKIN = ["#f2c9a0", "#e0a878", "#c68a5a", "#a06a40", "#7a4a2a", "#f8d9b8"];
const HAIR = ["#1a1410", "#3a2616", "#6a4020", "#c89a40", "#d8d0c0", "#a02a1a", "#2a1a3a", "#e8c860"];
const BRIGHT = ["#e23b3b", "#2f6fe0", "#f2c230", "#2fb55a", "#e8e8f0", "#ff7a2a", "#9a4fd8", "#e85aa0", "#27b8c8", "#222833"];
const LOOKS: Record<StageKind, Look> = {
  grass: { steps: ["#2b3342", "#252c39"], rail: "#7b8497", tint: "rgba(0,0,0,0)", shirts: BRIGHT, boards: ["#12264a", "#7a1f2a", "#0f5a58"], glow: "rgba(255,240,200,.28)", skin: SKIN, hair: HAIR },
  stone: { steps: ["#33363f", "#2b2d35"], rail: "#8a8d99", tint: "rgba(10,14,30,.1)", shirts: ["#5a6a8a", "#8a4a4a", "#4a7a6a", "#a89a5a", "#d8d8e0", "#3a3f4f", "#7a5a9a", "#c0b8a0"], boards: ["#1a1f33", "#3a2a2a", "#233a3a"], glow: "rgba(255,230,190,.22)", skin: SKIN, hair: HAIR },
  dirt: { steps: ["#5a4330", "#4c3828"], rail: "#b89a74", tint: "rgba(255,160,70,.1)", shirts: ["#d8622a", "#f2c230", "#8a2f1a", "#e8d8b8", "#2f6a8a", "#c04a2a", "#6a8a3a", "#f08a4a"], boards: ["#5a2a14", "#7a4a1a", "#3a2a1a"], glow: "rgba(255,200,120,.3)", skin: SKIN, hair: HAIR },
  crystal: { steps: ["#2a2347", "#221c3c"], rail: "#a98bff", tint: "rgba(150,90,255,.14)", shirts: ["#a98bff", "#ff8be4", "#6fd8ff", "#5b4aa0", "#e8e0ff", "#ff6aa8", "#3a2a6a", "#8affc8"], boards: ["#241a4a", "#4a1a5a", "#1a3a5a"], glow: "rgba(190,150,255,.32)", skin: SKIN, hair: ["#d8a8ff", "#6fd8ff", "#ff8be4", ...HAIR] },
  ice: { steps: ["#3a4f6a", "#324560"], rail: "#cfe8ff", tint: "rgba(160,210,255,.12)", shirts: ["#e8f4ff", "#7fc0f0", "#ffffff", "#3a78c0", "#b8dcff", "#e23b3b", "#2a4a8a", "#9ad8ff"], boards: ["#1a3a6a", "#2a5a8a", "#164a5a"], glow: "rgba(210,235,255,.32)", skin: SKIN, hair: ["#e8f0ff", ...HAIR] },
  lava: { steps: ["#2a1510", "#22100c"], rail: "#c0603a", tint: "rgba(255,90,30,.16)", shirts: ["#e23b2a", "#ff7a1a", "#2a1a1a", "#ffb030", "#8a1f1a", "#3a2a2a", "#d8461a", "#f2c860"], boards: ["#4a1208", "#6a2a0a", "#2a0e0a"], glow: "rgba(255,130,50,.36)", skin: SKIN, hair: ["#1a0e0a", "#8a1a0a", ...HAIR] },
  meadow: { steps: ["#2b3342", "#252c39"], rail: "#7b8497", tint: "rgba(255,255,200,.05)", shirts: BRIGHT, boards: ["#12264a", "#2a6a2a", "#0f5a58"], glow: "rgba(255,245,200,.3)", skin: SKIN, hair: HAIR },
  glacier: { steps: ["#3a4f6a", "#324560"], rail: "#cfe8ff", tint: "rgba(160,210,255,.12)", shirts: ["#e8f4ff", "#7fc0f0", "#ffffff", "#3a78c0", "#b8dcff", "#e23b3b", "#2a4a8a", "#9ad8ff"], boards: ["#1a3a6a", "#2a5a8a", "#164a5a"], glow: "rgba(210,235,255,.32)", skin: SKIN, hair: ["#e8f0ff", ...HAIR] },
  ocean: { steps: ["#7a6446", "#6c583c"], rail: "#e6d8b0", tint: "rgba(120,200,255,.07)", shirts: ["#ff6a5a", "#2fb8e8", "#f2e04a", "#ffffff", "#3ac88a", "#ff9ad0", "#2a6ad8", "#ff9a3a"], boards: ["#0f4a7a", "#c0502a", "#1a7a6a"], glow: "rgba(255,245,210,.3)", skin: SKIN, hair: HAIR },
  coast: { steps: ["#7a6446", "#6c583c"], rail: "#e6d8b0", tint: "rgba(255,235,170,.06)", shirts: ["#ff6a5a", "#2fb8e8", "#f2e04a", "#ffffff", "#3ac88a", "#ff9ad0", "#2a6ad8", "#ff9a3a"], boards: ["#0f4a7a", "#c0502a", "#1a7a6a"], glow: "rgba(255,245,210,.3)", skin: SKIN, hair: HAIR },
};

type Person = { x: number; y: number; face: 1 | -1; shirt: string; skin: string; hair: string; ph: number; sign: string | null; wave: boolean; flash: number };
type Built = { frames: HTMLCanvasElement[] };
const cache = new Map<string, Built>();

/** The crowd for this stage, one canvas per animation frame; each covers the arena plus its margin (pad), at SC pixels per unit. */
export function crowdFrames(stage: StageKind, pad: Pad): HTMLCanvasElement[] {
  const key = stage + pad.l + pad.t;
  let b = cache.get(key);
  if (b) return b.frames;
  b = { frames: build(stage, pad) };
  cache.set(key, b);
  return b.frames;
}

function build(stage: StageKind, pad: Pad): HTMLCanvasElement[] {
  const look = LOOKS[stage] ?? LOOKS.stone;
  const W = ARENA.W, H = ARENA.H;
  const cw = Math.round((W + pad.l + pad.r) * SC), ch = Math.round((H + pad.t + pad.b) * SC);
  const mk = () => { const c = document.createElement("canvas"); c.width = cw; c.height = ch; return c; };
  const R = rng(stage.length * 977 + 13);

  // ---- where the stands are: four terraces, each described by how a row runs and which way it faces
  type Side = { name: "top" | "bottom" | "left" | "right"; rows: number; len: number };
  const sides: Side[] = [
    { name: "top", rows: Math.floor((pad.t - EDGE) / ROW), len: W + pad.l + pad.r },
    { name: "bottom", rows: Math.floor((pad.b - EDGE) / ROW), len: W + pad.l + pad.r },
    { name: "left", rows: Math.floor((pad.l - EDGE) / ROW), len: H + 2 * EDGE },
    { name: "right", rows: Math.floor((pad.r - EDGE) / ROW), len: H + 2 * EDGE },
  ];
  // u runs along the row, k is the row number counted outward from the pitch; this turns them into a point on the page
  const P = (s: Side, u: number, k: number): [number, number] => {
    const d = EDGE + k * ROW;
    switch (s.name) {
      case "top": return [-pad.l + u, -d];
      case "bottom": return [-pad.l + u, H + d];
      case "left": return [-d, -EDGE + u];
      default: return [W + d, -EDGE + u];
    }
  };

  // ---- the people, placed once so that every frame shows the same crowd
  const people: Person[] = [];
  const aisle = (u: number, len: number) => { const a = (u / (len / Math.max(2, Math.round(len / 330)))) % 1; return a < 0.045 || a > 0.955; };
  for (const s of sides) {
    for (let k = s.rows - 1; k >= 0; k--) {
      for (let u = 8 + (k % 2) * GAP * 0.5; u < s.len - 8; u += GAP) {
        if (aisle(u, s.len) || R() < 0.06) continue; // aisles, and the odd empty seat
        const [x0, y0] = P(s, u + (R() - 0.5) * 3, k);
        const rooted = R() < 0.26;
        people.push({
          x: x0, y: y0 + (R() - 0.5) * 2, face: s.name === "bottom" ? -1 : 1,
          shirt: look.shirts[Math.floor(R() * look.shirts.length)]!, skin: look.skin[Math.floor(R() * look.skin.length)]!, hair: look.hair[Math.floor(R() * look.hair.length)]!,
          ph: (u / 340 + k * 0.07 + R() * 0.18) % 1, sign: R() < 0.05 ? look.shirts[Math.floor(R() * look.shirts.length)]! : null, wave: rooted || R() < 0.5, flash: R(),
        });
      }
    }
  }

  // ---- the structure: terraces, aisles, rails, boards and the kerb (the same in every frame)
  const base = mk();
  const g = base.getContext("2d")!;
  g.setTransform(SC, 0, 0, SC, pad.l * SC, pad.t * SC);
  g.fillStyle = look.steps[1];
  g.fillRect(-pad.l, -pad.t, W + pad.l + pad.r, H + pad.t + pad.b);
  for (const s of sides) {
    for (let k = 0; k < s.rows; k++) {
      // a step: its tread, and a darker riser in front of it
      const a = P(s, 0, k), c = P(s, s.len, k);
      g.save();
      g.fillStyle = k % 2 ? look.steps[0] : look.steps[1];
      if (s.name === "top" || s.name === "bottom") {
        const y = a[1], dir = s.name === "top" ? -1 : 1;
        g.fillRect(a[0], Math.min(y, y + dir * ROW), c[0] - a[0], ROW);
        g.fillStyle = "rgba(0,0,0,.28)";
        g.fillRect(a[0], dir > 0 ? y : y - 2, c[0] - a[0], 2);
      } else {
        const x = a[0], dir = s.name === "left" ? -1 : 1;
        g.fillRect(Math.min(x, x + dir * ROW), a[1], ROW, c[1] - a[1]);
        g.fillStyle = "rgba(0,0,0,.28)";
        g.fillRect(dir > 0 ? x : x - 2, a[1], 2, c[1] - a[1]);
      }
      g.restore();
    }
    // dark aisles with their own steps
    const n = Math.max(2, Math.round(s.len / 330));
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * s.len, w = (s.len / n) * 0.045 * 2;
      const a = P(s, u - w / 2, 0), c = P(s, u + w / 2, s.rows);
      g.fillStyle = "rgba(6,8,14,.82)";
      g.fillRect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]) || w, Math.abs(c[1] - a[1]) || w);
      g.strokeStyle = "rgba(255,255,255,.1)";
      g.lineWidth = 1;
      for (let k = 0; k < s.rows; k++) {
        const p0 = P(s, u - w / 2, k), p1 = P(s, u + w / 2, k);
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      }
    }
    // a handrail every few rows
    g.strokeStyle = look.rail;
    g.globalAlpha = 0.5;
    g.lineWidth = 1.4;
    for (let k = 3; k < s.rows; k += 5) {
      const p0 = P(s, 0, k), p1 = P(s, s.len, k);
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    }
    g.globalAlpha = 1;
  }
  // advertising boards and the hazard-striped kerb, all the way round the floor
  const board = (name: Side["name"]) => {
    g.save();
    if (name === "top") g.translate(0, 0);
    const horiz = name === "top" || name === "bottom";
    const L = horiz ? W : H;
    // work in a frame where the board runs along +x and the stands lie toward -y
    if (name === "top") { g.translate(0, 0); }
    else if (name === "bottom") { g.translate(W, H); g.rotate(Math.PI); }
    else if (name === "left") { g.translate(0, H); g.rotate(Math.PI / 2); g.scale(1, 1); }
    else { g.translate(W, 0); g.rotate(-Math.PI / 2); }
    const x0 = name === "left" || name === "right" ? 0 : 0;
    const total = L;
    // the panels
    const pw = 150;
    for (let x = x0; x < total; x += pw) {
      const col = look.boards[Math.floor(x / pw) % look.boards.length]!;
      g.fillStyle = "#06080e";
      g.fillRect(x, -EDGE, pw, BOARD);
      g.fillStyle = col;
      g.fillRect(x + 2, -EDGE + 2, pw - 4, BOARD - 4);
      g.fillStyle = "rgba(255,255,255,.08)";
      g.fillRect(x + 2, -EDGE + 2, pw - 4, (BOARD - 4) * 0.4);
      g.fillStyle = "#f4f0e0";
      g.font = "bold 13px 'Trebuchet MS', Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(Math.floor(x / pw) % 3 === 1 ? "★ ARENA LEAGUE ★" : "ARENA BRAWL", x + pw / 2, -EDGE + BOARD / 2 + 0.5);
    }
    // the kerb: diagonal yellow and black
    g.save();
    g.beginPath();
    g.rect(0, -KERB, total, KERB);
    g.clip();
    g.fillStyle = "#14161c";
    g.fillRect(0, -KERB, total, KERB);
    g.fillStyle = "#f2c230";
    for (let x = -KERB; x < total + KERB; x += 16) {
      g.beginPath();
      g.moveTo(x, 0); g.lineTo(x + 8, 0); g.lineTo(x + 8 + KERB, -KERB); g.lineTo(x + KERB, -KERB);
      g.closePath(); g.fill();
    }
    g.restore();
    g.restore();
  };
  (["top", "bottom", "left", "right"] as const).forEach(board);
  // the board's corner pieces and floodlights at the four corners
  for (const [cx, cy] of [[-EDGE, -EDGE], [W + EDGE, -EDGE], [-EDGE, H + EDGE], [W + EDGE, H + EDGE]] as const) {
    g.fillStyle = "#06080e";
    g.fillRect(cx - EDGE / 2, cy - EDGE / 2, EDGE, EDGE);
  }

  // the floor itself stays clear: only the stands are in this picture
  g.clearRect(0, 0, W, H);

  // ---- one frame: the structure, then the people with their arms up or down, then the stage's tint and floodlight glow
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < CROWD_FRAMES; f++) {
    const c = mk();
    const x = c.getContext("2d")!;
    x.drawImage(base, 0, 0);
    x.setTransform(SC, 0, 0, SC, pad.l * SC, pad.t * SC);
    // far rows first, so a row in front covers the one behind it
    for (const p of people) {
      const up = p.wave && Math.sin(TAU * (f / CROWD_FRAMES + p.ph)) > 0.15;
      x.save();
      x.translate(p.x, p.y);
      // shadow on the step
      x.fillStyle = "rgba(0,0,0,.3)";
      x.beginPath(); x.ellipse(0, 4.4, 5.6, 2, 0, 0, TAU); x.fill();
      // arms: raised in a cheer, or at the sides
      x.strokeStyle = up ? p.skin : p.shirt;
      x.lineWidth = 2;
      x.lineCap = "round";
      x.beginPath();
      if (up) { x.moveTo(-4, 0); x.lineTo(-6, -8); x.moveTo(4, 0); x.lineTo(6, -8); } else { x.moveTo(-4.4, -0.5); x.lineTo(-4.8, 3.4); x.moveTo(4.4, -0.5); x.lineTo(4.8, 3.4); }
      x.stroke();
      if (up) { x.fillStyle = p.skin; x.beginPath(); x.arc(-6, -8.6, 1.5, 0, TAU); x.arc(6, -8.6, 1.5, 0, TAU); x.fill(); }
      // body
      x.fillStyle = p.shirt;
      x.beginPath(); x.roundRect(-4.6, -1.8, 9.2, 7, 2.4); x.fill();
      x.fillStyle = "rgba(0,0,0,.18)";
      x.fillRect(-4.6, 3.4, 9.2, 1.8);
      // head and hair (the back of the head when they face away)
      x.fillStyle = p.skin;
      x.beginPath(); x.arc(0, -4.6, 3.9, 0, TAU); x.fill();
      x.fillStyle = p.hair;
      x.beginPath();
      if (p.face < 0) x.arc(0, -4.6, 4, 0, TAU); else x.arc(0, -5, 4, Math.PI * 1.02, Math.PI * 1.98);
      x.fill();
      if (p.face > 0) { x.fillStyle = "rgba(20,12,8,.7)"; x.fillRect(-1.9, -4.4, 1, 1); x.fillRect(1, -4.4, 1, 1); }
      // a held sign
      if (p.sign && up) { x.fillStyle = p.sign; x.fillRect(-6.5, -15, 13, 6.4); x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = 0.8; x.strokeRect(-6.5, -15, 13, 6.4); }
      x.restore();
    }
    // the stage's colour wash over the stands only
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = "source-atop";
    x.fillStyle = look.tint;
    x.fillRect(0, 0, cw, ch);
    x.globalCompositeOperation = "source-atop";
    x.setTransform(SC, 0, 0, SC, pad.l * SC, pad.t * SC);
    // fade toward the outer edge so the stands do not end in a hard line
    const vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.7, W / 2, H / 2, Math.hypot(W / 2 + pad.l, H / 2 + pad.t));
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(2,4,10,.55)");
    x.fillStyle = vg;
    x.fillRect(-pad.l, -pad.t, W + pad.l + pad.r, H + pad.t + pad.b);
    x.globalCompositeOperation = "source-over";
    frames.push(c);
  }
  return frames;
}
