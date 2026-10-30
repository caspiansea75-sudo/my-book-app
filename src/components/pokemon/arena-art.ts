/**
 * Pictures for Arena Brawl that are drawn in code: the four stage floors, crates, pillars, crystals, rocks,
 * water and pits, and the look of each kind of projectile (a fire stream is a chain of cartoon fireballs,
 * lightning is a jagged chain, a shadow ball is a glossy dark sphere…).
 */
import { ARENA, type Obstacle, type Patch, type Proj, type StageKind } from "@/lib/pokemon/arena-engine";
import { TYPE_COLOR } from "@/lib/pokemon/shared";

const { W, H } = ARENA;
export const col = (t: string) => TYPE_COLOR[t] ?? "#ffffff";

/** A small deterministic random-number generator, so a stage looks the same every time it is drawn. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ stage floors */

function canvas() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
}

/** The stands around the pitch: a dark ring with a crowd of coloured dots. */
function stands(g: CanvasRenderingContext2D, r: () => number, crowd = true) {
  g.fillStyle = "#070b14";
  g.fillRect(0, 0, W, H);
  if (!crowd) return;
  for (let i = 0; i < 900; i++) {
    const x = r() * W;
    const y = r() * H;
    if (x > 26 && x < W - 26 && y > 26 && y < H - 26) continue;
    g.fillStyle = `hsl(${Math.floor(r() * 360)} 38% ${20 + r() * 32}%)`;
    g.fillRect(x, y, 3, 3);
  }
}

function vignette(g: CanvasRenderingContext2D, strength = 0.55) {
  const lp = g.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 620);
  lp.addColorStop(0, "rgba(255,255,255,.05)");
  lp.addColorStop(1, `rgba(0,0,12,${strength})`);
  g.fillStyle = lp;
  g.fillRect(0, 0, W, H);
}

/** Painted lines on the floor, like a football pitch (as in the video). */
function pitchLines(g: CanvasRenderingContext2D, color: string, width = 3) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.arc(W / 2, H / 2, 105, 0, Math.PI * 2);
  g.moveTo(W / 2, 30);
  g.lineTo(W / 2, H - 30);
  g.stroke();
  g.strokeRect(30, H / 2 - 135, 120, 270);
  g.strokeRect(W - 150, H / 2 - 135, 120, 270);
  g.strokeRect(30, H / 2 - 62, 52, 124);
  g.strokeRect(W - 82, H / 2 - 62, 52, 124);
  g.beginPath();
  g.arc(W / 2, H / 2, 5, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.strokeRect(30, 30, W - 60, H - 60);
}

function buildGrass(): HTMLCanvasElement {
  const c = canvas();
  const g = c.getContext("2d")!;
  const r = rng(11);
  stands(g, r);
  g.fillStyle = "#2f6b2c";
  g.fillRect(30, 30, W - 60, H - 60);
  // mown stripes
  for (let x = 30; x < W - 30; x += 60) {
    g.fillStyle = (x / 60) % 2 ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.07)";
    g.fillRect(x, 30, 60, H - 60);
  }
  // blades and flecks
  for (let i = 0; i < 2600; i++) {
    const x = 30 + r() * (W - 60);
    const y = 30 + r() * (H - 60);
    g.fillStyle = r() < 0.5 ? "rgba(20,70,20,.35)" : "rgba(130,190,90,.22)";
    g.fillRect(x, y, 2, 2 + r() * 3);
  }
  pitchLines(g, "rgba(240,248,235,.78)", 3);
  vignette(g, 0.42);
  return c;
}

function buildStone(): HTMLCanvasElement {
  const c = canvas();
  const g = c.getContext("2d")!;
  const r = rng(23);
  stands(g, r);
  g.fillStyle = "#1b2231";
  g.fillRect(30, 30, W - 60, H - 60);
  // irregular rows of stone slabs, as in the video
  let y = 30;
  while (y < H - 30) {
    const h = 40 + Math.floor(r() * 40);
    let x = 30;
    while (x < W - 30) {
      const w = 54 + Math.floor(r() * 90);
      const ww = Math.min(w, W - 30 - x);
      const v = 54 + Math.floor(r() * 26);
      g.fillStyle = `rgb(${v} ${v + 6} ${v + 22})`;
      g.fillRect(x + 1, y + 1, ww - 2, Math.min(h, H - 30 - y) - 2);
      g.fillStyle = "rgba(255,255,255,.07)";
      g.fillRect(x + 3, y + 3, ww - 6, 3);
      if (r() < 0.35) {
        g.strokeStyle = "rgba(10,14,24,.55)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + r() * ww, y + 4);
        g.lineTo(x + r() * ww, y + h - 4);
        g.stroke();
      }
      if (r() < 0.18) {
        g.fillStyle = "rgba(80,130,70,.35)";
        g.fillRect(x + r() * (ww - 8), y + h - 6, 6 + r() * 6, 3);
      }
      x += ww;
    }
    y += h;
  }
  pitchLines(g, "rgba(12,16,28,.8)", 4);
  g.strokeStyle = "rgba(130,170,255,.45)";
  g.lineWidth = 4;
  g.strokeRect(30, 30, W - 60, H - 60);
  vignette(g, 0.5);
  return c;
}

function buildDirt(): HTMLCanvasElement {
  const c = canvas();
  const g = c.getContext("2d")!;
  const r = rng(37);
  stands(g, r, false);
  g.fillStyle = "#7a5a3b";
  g.fillRect(30, 30, W - 60, H - 60);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(60,40,22,.22)" : "rgba(170,130,90,.2)";
    g.beginPath();
    g.ellipse(30 + r() * (W - 60), 30 + r() * (H - 60), 14 + r() * 50, 8 + r() * 28, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(40,28,16,.5)" : "rgba(200,170,130,.45)";
    g.fillRect(30 + r() * (W - 60), 30 + r() * (H - 60), 2 + r() * 2, 2);
  }
  pitchLines(g, "rgba(240,225,195,.72)", 3);
  vignette(g, 0.48);
  return c;
}

function buildCrystal(): HTMLCanvasElement {
  const c = canvas();
  const g = c.getContext("2d")!;
  const r = rng(53);
  g.fillStyle = "#0b0a16";
  g.fillRect(0, 0, W, H);
  // cracked cave rock
  for (let i = 0; i < 90; i++) {
    const x = r() * W;
    const y = r() * H;
    const n = 5 + Math.floor(r() * 3);
    const rad = 40 + r() * 70;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.5;
      const rr = rad * (0.6 + r() * 0.5);
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75);
    }
    g.closePath();
    const v = 22 + Math.floor(r() * 22);
    g.fillStyle = `rgb(${v} ${v} ${v + 18})`;
    g.fill();
    g.strokeStyle = "rgba(0,0,10,.7)";
    g.lineWidth = 2;
    g.stroke();
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(180,150,255,${0.15 + r() * 0.3})`;
    g.fillRect(r() * W, r() * H, 2, 2);
  }
  g.strokeStyle = "rgba(160,120,255,.35)";
  g.lineWidth = 4;
  g.strokeRect(30, 30, W - 60, H - 60);
  vignette(g, 0.62);
  return c;
}

const bgCache = new Map<StageKind, HTMLCanvasElement>();
export function stageBackground(kind: StageKind): HTMLCanvasElement {
  let c = bgCache.get(kind);
  if (!c) {
    c = { grass: buildGrass, stone: buildStone, dirt: buildDirt, crystal: buildCrystal }[kind]();
    bgCache.set(kind, c);
  }
  return c;
}

/* ------------------------------------------------------------- pools and pits */

/** A pool of water: still blue with slow rings moving across it. */
export function drawPool(g: CanvasRenderingContext2D, p: Patch, t: number) {
  g.save();
  g.beginPath();
  g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
  g.clip();
  const gr = g.createRadialGradient(p.x, p.y, 10, p.x, p.y, p.rx);
  gr.addColorStop(0, "#3f8fd0");
  gr.addColorStop(1, "#1f5f9e");
  g.fillStyle = gr;
  g.fillRect(p.x - p.rx, p.y - p.ry, p.rx * 2, p.ry * 2);
  g.strokeStyle = "rgba(220,240,255,.35)";
  g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const k = Math.max(0, (((t * 0.25 + i / 4) % 1) + 1) % 1) * 0.95;
    g.beginPath();
    g.ellipse(p.x + Math.sin(t + i) * 6, p.y, p.rx * k, p.ry * k, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,.22)";
  for (let i = 0; i < 10; i++) g.fillRect(p.x - p.rx + ((i * 53 + t * 18) % (p.rx * 2)), p.y - p.ry + ((i * 37) % (p.ry * 2)), 8, 2);
  g.restore();
  g.strokeStyle = "rgba(210,235,255,.65)";
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
  g.stroke();
}

/** A bottomless pit: a window onto the stars, edged with a glowing rim (flyers can cross it). */
export function drawHole(g: CanvasRenderingContext2D, h: Patch, t: number) {
  g.save();
  g.beginPath();
  g.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = "#02030a";
  g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  const r = rng(91);
  for (let i = 0; i < 90; i++) {
    const x = h.x - h.rx + r() * h.rx * 2;
    const y = h.y - h.ry + r() * h.ry * 2;
    g.fillStyle = `rgba(190,210,255,${0.25 + 0.6 * Math.abs(Math.sin(t * (0.6 + r()) + i))})`;
    g.fillRect(x, y, 2, 2);
  }
  const gr = g.createRadialGradient(h.x, h.y, h.rx * 0.2, h.x, h.y, h.rx);
  gr.addColorStop(0, "rgba(60,40,140,.0)");
  gr.addColorStop(1, "rgba(60,40,140,.35)");
  g.fillStyle = gr;
  g.fillRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2);
  g.restore();
  g.strokeStyle = "rgba(120,200,255,.85)";
  g.lineWidth = 4;
  g.shadowColor = "#4cc3ff";
  g.shadowBlur = 14;
  g.beginPath();
  g.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.shadowBlur = 0;
}

/* ------------------------------------------------------------------ obstacles */

export function drawObstacle(g: CanvasRenderingContext2D, o: Obstacle, t: number) {
  g.save();
  g.translate(o.x, o.y);
  // shadow
  g.fillStyle = "rgba(0,0,0,.38)";
  g.beginPath();
  g.ellipse(4, o.r * 0.7, o.r * 1.05, o.r * 0.42, 0, 0, Math.PI * 2);
  g.fill();
  const flash = o.hit > 0;
  if (o.kind === "crate") {
    const s = o.r;
    g.fillStyle = flash ? "#fff" : "#b9854a";
    g.strokeStyle = "#5e3c1c";
    g.lineWidth = 3;
    g.fillRect(-s, -s, s * 2, s * 2);
    g.strokeRect(-s, -s, s * 2, s * 2);
    g.strokeStyle = "rgba(94,60,28,.75)";
    g.lineWidth = 2;
    for (const k of [-s * 0.33, s * 0.33]) {
      g.beginPath();
      g.moveTo(-s, k);
      g.lineTo(s, k);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-s, -s);
    g.lineTo(s, s);
    g.moveTo(s, -s);
    g.lineTo(-s, s);
    g.stroke();
    g.fillStyle = "rgba(255,230,180,.35)";
    g.fillRect(-s + 3, -s + 3, s * 2 - 6, 4);
  } else if (o.kind === "pillar") {
    const s = o.r;
    const gr = g.createLinearGradient(-s, 0, s, 0);
    gr.addColorStop(0, "#5b6376");
    gr.addColorStop(0.5, "#98a1b8");
    gr.addColorStop(1, "#4a5266");
    g.fillStyle = flash ? "#fff" : gr;
    g.fillRect(-s * 0.8, -s * 1.4, s * 1.6, s * 2.1);
    g.fillStyle = "#b7bfd3";
    g.beginPath();
    g.ellipse(0, -s * 1.4, s * 0.95, s * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(20,26,40,.8)";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = "#7b8399";
    g.beginPath();
    g.ellipse(0, s * 0.7, s * 0.95, s * 0.36, 0, 0, Math.PI * 2);
    g.fill();
  } else if (o.kind === "crystal") {
    const glow = 0.6 + Math.sin(t * 2 + o.id) * 0.2;
    const gr = g.createRadialGradient(0, -8, 2, 0, -8, o.r * 2.4);
    gr.addColorStop(0, `rgba(190,140,255,${0.55 * glow})`);
    gr.addColorStop(1, "rgba(120,80,255,0)");
    g.fillStyle = gr;
    g.fillRect(-o.r * 3, -o.r * 3, o.r * 6, o.r * 6);
    const shard = (x: number, h: number, w: number, c1: string, c2: string) => {
      g.beginPath();
      g.moveTo(x - w, 8);
      g.lineTo(x - w * 0.55, -h * 0.72);
      g.lineTo(x, -h);
      g.lineTo(x + w * 0.55, -h * 0.72);
      g.lineTo(x + w, 8);
      g.closePath();
      const lg = g.createLinearGradient(x - w, 0, x + w, 0);
      lg.addColorStop(0, c1);
      lg.addColorStop(1, c2);
      g.fillStyle = flash ? "#fff" : lg;
      g.fill();
      g.strokeStyle = "rgba(235,215,255,.8)";
      g.lineWidth = 1.5;
      g.stroke();
    };
    shard(-10, 38, 9, "#6b3fd0", "#a77bff");
    shard(10, 30, 8, "#7d4fe0", "#c6a2ff");
    shard(0, 50, 11, "#8a5cf0", "#e0c8ff");
  } else {
    // a boulder
    g.fillStyle = flash ? "#fff" : "#7d8088";
    g.strokeStyle = "#3b3e46";
    g.lineWidth = 3;
    g.beginPath();
    const pts = [-1, -0.2, -0.6, -0.9, 0.2, -1, 0.9, -0.5, 1, 0.3, 0.5, 0.9, -0.5, 0.85];
    for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i]! * o.r, pts[i + 1]! * o.r * 0.9);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "rgba(255,255,255,.18)";
    g.fillRect(-o.r * 0.5, -o.r * 0.6, o.r * 0.7, 4);
  }
  g.restore();
}

/* ------------------------------------------------------- the look of each shot */

export function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, fill: string, edge: string) {
  // a lumpy cartoon puff: several overlapping circles with a darker outline, like the fire in the video
  const rr = rng(seed);
  const lobes = 5;
  g.fillStyle = edge;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + rr();
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.62 + 2, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(x, y, r * 0.72 + 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = fill;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + rr();
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.62, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(x, y, r * 0.72, 0, Math.PI * 2);
  g.fill();
}

function leaf(g: CanvasRenderingContext2D, size: number) {
  g.beginPath();
  g.moveTo(-size, 0);
  g.quadraticCurveTo(0, -size * 0.8, size, 0);
  g.quadraticCurveTo(0, size * 0.8, -size, 0);
  g.fillStyle = "#4ade80";
  g.fill();
  g.strokeStyle = "#166534";
  g.lineWidth = 1.5;
  g.stroke();
  g.beginPath();
  g.moveTo(-size, 0);
  g.lineTo(size, 0);
  g.stroke();
}

/** Draws one projectile the way that move looks. `t` is the time on the clock, `age` how long the shot has flown. */
export function drawShot(g: CanvasRenderingContext2D, p: Proj, age: number, t: number) {
  const ang = Math.atan2(p.vy, p.vx);
  const c = col(p.type);
  g.save();
  g.translate(p.x, p.y);
  const r = p.r;

  if (p.beam) {
    // streams: the shot grows as it travels
    const k = Math.min(1, age / 0.35);
    const size = (7 + k * 16) * (r / 10);
    if (p.type === "Fire") {
      g.rotate(0);
      blob(g, 0, 0, size, p.id, "#ff9a2e", "#b8360d");
      blob(g, 0, 0, size * 0.55, p.id + 7, "#ffd84d", "#ff8a1f");
    } else if (p.type === "Water") {
      g.fillStyle = "#1e6fd0";
      g.beginPath();
      g.arc(0, 0, size * 0.85 + 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#59b4ff";
      g.beginPath();
      g.arc(0, 0, size * 0.85, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.85)";
      g.beginPath();
      g.arc(-size * 0.28, -size * 0.3, size * 0.25, 0, Math.PI * 2);
      g.fill();
    } else if (p.type === "Ice") {
      g.rotate(t * 6 + p.id);
      g.fillStyle = "#d8f6ff";
      g.strokeStyle = "#5cc8f0";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -size);
      g.lineTo(size * 0.55, 0);
      g.lineTo(0, size);
      g.lineTo(-size * 0.55, 0);
      g.closePath();
      g.fill();
      g.stroke();
    } else {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, size * 1.3);
      gr.addColorStop(0, "#fff");
      gr.addColorStop(0.4, c);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.globalCompositeOperation = "lighter";
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, size * 1.3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    return;
  }

  switch (p.mv) {
    case "energyball": {
      // a green orb of living energy, leaves circling it
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
      gr.addColorStop(0, "#f4ffd0"); gr.addColorStop(0.35, "#7be04a"); gr.addColorStop(1, "rgba(60,180,60,0)");
      g.globalCompositeOperation = "lighter";
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 2.6, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = "source-over";
      for (let k = 0; k < 4; k++) {
        const an = t * 8 + k * 1.571; const rr = r * 1.9;
        g.save(); g.translate(Math.cos(an) * rr, Math.sin(an) * rr); g.rotate(an + 1.2);
        g.fillStyle = k % 2 ? "#9be05a" : "#4fbf4a"; g.beginPath(); g.ellipse(0, 0, r * 0.7, r * 0.3, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
      break;
    }
    case "gigadrain": {
      // a sprouting green-gold orb with curling tendrils
      g.rotate(ang);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
      gr.addColorStop(0, "#fffbd0"); gr.addColorStop(0.4, "#a8e04a"); gr.addColorStop(1, "rgba(80,200,60,0)");
      g.globalCompositeOperation = "lighter";
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 2.4, 0, Math.PI * 2); g.fill();
      g.lineCap = "round"; g.strokeStyle = "#7be04a"; g.lineWidth = 2.2;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        for (let i = 0; i <= 8; i++) { const u = i / 8; const x = -u * r * 4.2, y = Math.sin(u * 6 + t * 12 + k * 1.6) * r * (0.4 + u * 0.9) * (k % 2 ? 1 : -1); i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      break;
    }
    case "signalbeam": {
      // a flickering bug-signal: a bright pod and stripes cycling through colours
      g.rotate(ang);
      g.globalCompositeOperation = "lighter";
      const cs = ["#ff5a5a", "#ffe14d", "#7be04a", "#4fc3ff"];
      for (let k = 0; k < 4; k++) {
        g.fillStyle = cs[(k + Math.floor(t * 14)) % 4]!;
        g.globalAlpha = 0.9 - k * 0.15;
        g.beginPath(); g.ellipse(-k * r * 1.25, 0, r * (1.5 - k * 0.2), r * (0.9 - k * 0.12), 0, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(r * 0.4, 0, r * 0.55, 0, Math.PI * 2); g.fill();
      break;
    }
    case "willowisp": {
      // three blue-violet ghost flames dancing round a pale core
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 3);
      gr.addColorStop(0, "rgba(160,200,255,.7)"); gr.addColorStop(1, "rgba(110,80,255,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 3, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 3; k++) {
        const an = t * 5 + k * 2.094; const px = Math.cos(an) * r * 1.5, py = Math.sin(an) * r * 1.1;
        for (const [sc, cc] of [[1, "#6a7cff"], [0.62, "#9fd4ff"], [0.3, "#ffffff"]] as const) {
          g.fillStyle = cc; g.beginPath();
          g.moveTo(px, py - r * 1.7 * sc * (1 + Math.sin(t * 22 + k) * 0.15));
          g.quadraticCurveTo(px + r * 0.9 * sc, py, px, py + r * 0.7 * sc);
          g.quadraticCurveTo(px - r * 0.9 * sc, py, px, py - r * 1.7 * sc);
          g.fill();
        }
      }
      break;
    }
    case "dragonpulse": {
      // a shockwave in the shape of a dragon's roar: nested crescents opening backward, a bright core and a spinning ring
      g.rotate(ang);
      g.globalCompositeOperation = "lighter";
      const halo = g.createRadialGradient(0, 0, 0, 0, 0, r * 3.4);
      halo.addColorStop(0, "rgba(120,200,255,.55)");
      halo.addColorStop(1, "rgba(90,60,255,0)");
      g.fillStyle = halo;
      g.beginPath();
      g.arc(0, 0, r * 3.4, 0, Math.PI * 2);
      g.fill();
      g.lineCap = "round";
      const cols = ["#7a5cff", "#4fe3ff", "#ffffff"];
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = cols[k]!;
        g.lineWidth = Math.max(2, r * (0.9 - k * 0.25));
        g.globalAlpha = 1 - k * 0.12;
        g.beginPath();
        g.arc(-k * r * 1.1 - r * 0.2, 0, r * (1.5 + k * 0.7), -1.05, 1.05);
        g.stroke();
      }
      g.globalAlpha = 1;
      const core = g.createRadialGradient(r * 0.3, 0, 0, r * 0.3, 0, r * 1.2);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.5, "#7fe8ff");
      core.addColorStop(1, "rgba(100,80,255,0)");
      g.fillStyle = core;
      g.beginPath();
      g.arc(r * 0.3, 0, r * 1.2, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(r * 0.3, 0);
      g.rotate(t * 9);
      g.strokeStyle = "#e8f7ff";
      g.lineWidth = 1.6;
      g.beginPath();
      g.ellipse(0, 0, r * 0.45, r * 1.5, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      break;
    }
    case "dragonbreath": {
      // a licking teardrop of violet-cyan flame
      g.rotate(ang);
      g.globalCompositeOperation = "lighter";
      const L = r * 4.2;
      for (const [k, cc] of [[1, "rgba(122,92,255,.85)"], [0.7, "#4fe3ff"], [0.38, "#ffffff"]] as const) {
        g.fillStyle = cc;
        g.beginPath();
        g.moveTo(r * 1.1 * k + r * 0.5, 0);
        for (let i = 0; i <= 8; i++) {
          const u = i / 8;
          const w = Math.sin(u * Math.PI) * r * 1.15 * k * (1 - u * 0.4);
          g.lineTo(-u * L * k - r * 0.2, -w + Math.sin(t * 40 + u * 7) * 1.5);
        }
        for (let i = 8; i >= 0; i--) {
          const u = i / 8;
          const w = Math.sin(u * Math.PI) * r * 1.15 * k * (1 - u * 0.4);
          g.lineTo(-u * L * k - r * 0.2, w + Math.sin(t * 40 + u * 7 + 2) * 1.5);
        }
        g.closePath();
        g.fill();
      }
      break;
    }
    case "shadowball": {
      // a purple vortex: a dark core with three spiral arms turning round a glowing eye, in a violet haze
      const gr0 = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 3);
      gr0.addColorStop(0, "rgba(168,85,247,.75)");
      gr0.addColorStop(1, "rgba(168,85,247,0)");
      g.globalCompositeOperation = "lighter";
      g.fillStyle = gr0; g.beginPath(); g.arc(0, 0, r * 3, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "#1d0a38"; g.beginPath(); g.arc(0, 0, r * 1.45, 0, Math.PI * 2); g.fill();
      g.lineCap = "round";
      for (let arm = 0; arm < 3; arm++) {
        g.strokeStyle = arm % 2 ? "#c77dff" : "#8b4bff"; g.lineWidth = Math.max(2, r * 0.32);
        g.beginPath();
        for (let i = 0; i <= 14; i++) { const u = i / 14; const an = t * 7 + arm * 2.094 + u * 4.2; const rr = r * (0.2 + u * 1.45); i ? g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : g.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
        g.stroke();
      }
      g.strokeStyle = "#e9c9ff"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * 1.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#ffffff"; g.globalCompositeOperation = "lighter"; g.beginPath(); g.arc(0, 0, r * 0.38, 0, Math.PI * 2); g.fill();
      break;
    }
    case "shadowball_old": {
      // a glossy dark sphere in a violet aura, as in the video
      const gr = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.6);
      gr.addColorStop(0, "rgba(168,85,247,.7)");
      gr.addColorStop(1, "rgba(168,85,247,0)");
      g.globalCompositeOperation = "lighter";
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r * 2.6, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "#2a1248";
      g.beginPath();
      g.arc(0, 0, r * 1.25, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#a855f7";
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = "rgba(255,255,255,.65)";
      g.beginPath();
      g.ellipse(-r * 0.4, -r * 0.45, r * 0.38, r * 0.22, -0.6, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "aurasphere": {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.35, "#4dc3ff");
      gr.addColorStop(1, "rgba(40,100,255,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r * 2.4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(180,235,255,.9)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, r * (1.2 + Math.sin(t * 12) * 0.12), 0, Math.PI * 2);
      g.stroke();
      break;
    }
    case "razorleaf":
    case "leafstorm": {
      g.rotate(t * 14 + p.id);
      leaf(g, r * 1.3);
      break;
    }
    case "stoneedge": {
      g.rotate(ang);
      g.fillStyle = "#8a8f99";
      g.strokeStyle = "#454a55";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(r * 1.6, 0);
      g.lineTo(-r, -r * 0.8);
      g.lineTo(-r * 0.5, 0);
      g.lineTo(-r, r * 0.8);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }
    case "psybeam":
    case "psystrike": {
      g.strokeStyle = "#ff8be4";
      g.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = 1 - i * 0.28;
        g.beginPath();
        g.arc(0, 0, r * (0.8 + i * 0.7 + Math.sin(t * 10 - i) * 0.12), 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "dragonpulse": {
      g.rotate(ang);
      g.strokeStyle = "#a78bfa";
      g.lineWidth = 4;
      g.shadowColor = "#7c5cff";
      g.shadowBlur = 14;
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = 1 - i * 0.3;
        g.beginPath();
        g.arc(-i * r * 0.9, 0, r * (1.4 + i * 0.25), -1, 1);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.shadowBlur = 0;
      break;
    }
    case "thundershock": {
      // a yellow orb with little arcs around it
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
      gr.addColorStop(0, "#fff");
      gr.addColorStop(0.4, "#ffe14d");
      gr.addColorStop(1, "rgba(255,200,0,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r * 2.2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#fff6a8";
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = t * 20 + i * 1.26;
        g.beginPath();
        g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        g.lineTo(Math.cos(a + 0.3) * r * 1.8, Math.sin(a + 0.3) * r * 1.8);
        g.lineTo(Math.cos(a - 0.1) * r * 2.4, Math.sin(a - 0.1) * r * 2.4);
        g.stroke();
      }
      break;
    }
    case "waterpulse": {
      g.fillStyle = "#1e6fd0";
      g.beginPath();
      g.arc(0, 0, r * 1.5 + 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#59b4ff";
      g.beginPath();
      g.arc(0, 0, r * 1.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.85)";
      g.beginPath();
      g.arc(-r * 0.5, -r * 0.5, r * 0.45, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "flashcannon": {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
      gr.addColorStop(0, "#fff");
      gr.addColorStop(0.45, "#cfd8e6");
      gr.addColorStop(1, "rgba(180,200,230,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r * 2.2, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "airslash": {
      // a blue crescent of wind: thick glowing blade, a pale edge, and curling wind streaks behind it
      g.rotate(ang);
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      for (const [w, cc] of [[r * 1.7, "rgba(70,150,255,.45)"], [r * 1.0, "#6fb4ff"], [r * 0.4, "#eaf6ff"]] as const) {
        g.strokeStyle = cc; g.lineWidth = w;
        g.beginPath(); g.arc(-r * 0.6, 0, r * 2.3, -1.05, 1.05); g.stroke();
      }
      g.strokeStyle = "rgba(200,230,255,.8)"; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const sw = (k - 1) * r * 1.2;
        g.beginPath();
        for (let i = 0; i <= 6; i++) { const u = i / 6; const x = -r * 1.2 - u * r * 4.5, y = sw + Math.sin(t * 22 + u * 5 + k) * r * 0.35; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      break;
    }
    case "darkpulse": {
      g.rotate(ang);
      g.strokeStyle = p.mv === "airslash" ? "#eaf6ff" : "#8b5cf6";
      g.lineWidth = 4;
      g.shadowColor = p.mv === "airslash" ? "#9fd0ff" : "#4c1d95";
      g.shadowBlur = 10;
      g.beginPath();
      g.arc(-r, 0, r * 2, -0.9, 0.9);
      g.stroke();
      g.shadowBlur = 0;
      break;
    }
    case "moonblast":
    case "tera":
    default: {
      // a bright core in a coloured halo (everything else)
      g.globalCompositeOperation = "lighter";
      const halo = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
      halo.addColorStop(0, "#fff");
      halo.addColorStop(0.3, c);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = halo;
      g.beginPath();
      g.arc(0, 0, r * 2.2, 0, Math.PI * 2);
      g.fill();
      break;
    }
  }
  g.restore();
}

/** Lightning drawn as a jagged chain between two points with bright orbs at each end (as in the video). */
export function drawLightning(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, alpha: number, seed: number, width = 4) {
  const rr = rng(seed);
  const L = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(6, Math.round(L / 28));
  const nx = -(y2 - y1) / L;
  const ny = (x2 - x1) / L;
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = "lighter";
  for (const [lw, c] of [[width * 3, color], [width, "#ffffff"]] as const) {
    g.strokeStyle = c;
    g.lineWidth = lw;
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const off = (rr() - 0.5) * 34;
      g.lineTo(x1 + (x2 - x1) * k + nx * off, y1 + (y2 - y1) * k + ny * off);
    }
    g.lineTo(x2, y2);
    g.stroke();
  }
  for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
    const gr = g.createRadialGradient(x, y, 0, x, y, 26);
    gr.addColorStop(0, "#fff");
    gr.addColorStop(0.4, color);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, 26, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
