/**
 * Lasting damage on the floor, as in the reference match: every blast leaves a dirt crater with chipped rubble,
 * quakes leave webs of hairline cracks, big beams leave a dark trench, and none of it fades. The marks are baked
 * once into a canvas the size of the pitch, which is laid on the floor under everything that moves.
 */
import { ARENA, type StageKind } from "@/lib/pokemon/arena-engine";
import { texPat, typeTex } from "./arena-tex";

const SC = 1.5; // canvas pixels per world unit
const TAU = Math.PI * 2;

/** a small seeded random, so a mark looks the same wherever it is redrawn */
function rng(seed: number) {
  let s = (Math.floor(seed * 1000) % 2147483647) + 7;
  return () => ((s = (s * 48271) % 2147483647) / 2147483647);
}

type Tone = { pit: string; deep: string; rim: string; dust: string; chip: string[] };
const DIRT: Tone = { pit: "#3a2a1b", deep: "#1c130b", rim: "rgba(176,146,98,.55)", dust: "rgba(96,72,44,.34)", chip: ["#6f7480", "#8b909a", "#575c66", "#7a6a56"] };
const TONES: Partial<Record<StageKind, Tone>> = {
  glacier: { pit: "#6d8aa3", deep: "#3d566d", rim: "rgba(235,248,255,.7)", dust: "rgba(180,210,230,.3)", chip: ["#dff3ff", "#bfe0f5", "#9ec6e2", "#ffffff"] },
  ice: { pit: "#6d8aa3", deep: "#3d566d", rim: "rgba(235,248,255,.7)", dust: "rgba(180,210,230,.3)", chip: ["#dff3ff", "#bfe0f5", "#9ec6e2", "#ffffff"] },
  lava: { pit: "#150f0e", deep: "#0a0707", rim: "rgba(255,120,40,.35)", dust: "rgba(20,12,10,.45)", chip: ["#3a3030", "#2a2222", "#4a3a36", "#1c1616"] },
  crystal: { pit: "#2a2040", deep: "#150f26", rim: "rgba(190,160,255,.5)", dust: "rgba(60,40,100,.32)", chip: ["#a98bff", "#7f66d6", "#cdb8ff", "#5b4aa0"] },
  coast: { pit: "#6a5a3c", deep: "#3a2f1d", rim: "rgba(230,210,160,.5)", dust: "rgba(140,120,80,.3)", chip: ["#c9b98a", "#a89a70", "#8d8260", "#d8caa0"] },
  stone: { pit: "#2a2c33", deep: "#14151a", rim: "rgba(160,165,180,.45)", dust: "rgba(60,62,72,.34)", chip: ["#7d828d", "#5b606b", "#9aa0ab", "#464a54"] },
};
/** types whose blasts burn the ground rather than dig it */
const BURNS = new Set(["Fire", "Electric", "Dragon", "Dark", "Ghost", "Psychic", "Poison"]);
/** How a beam of each type marks the ground: the colours of the cut and its lit lip, and what kind of mark it is */
type Fx = "wet" | "char" | "arc" | "frost" | "furrow" | "sludge" | "ditch" | "scour" | "glitter" | "shade";
const TRENCH: Record<string, [string, string, Fx]> = {
  Water: ["#0a2c52", "#5fb8f0", "wet"], Fire: ["#1c0a05", "#ff7a1a", "char"], Electric: ["#14120a", "#ffe14d", "arc"], Ice: ["#2a5a80", "#d8f4ff", "frost"],
  Grass: ["#26180c", "#6fbf4a", "furrow"], Bug: ["#1f220c", "#b4d03a", "furrow"], Poison: ["#2a0f3a", "#b25ad8", "sludge"],
  Rock: ["#221f1a", "#9a9484", "ditch"], Ground: ["#2a190c", "#b08450", "ditch"], Fighting: ["#2a140e", "#c06a48", "ditch"],
  Steel: ["#272b33", "#c2cad6", "scour"], Normal: ["#2a2824", "#cfc8b8", "scour"], Flying: ["#2a3040", "#dfe8f8", "scour"],
  Fairy: ["#3a1a38", "#ffa8e0", "glitter"], Psychic: ["#38103f", "#e060c0", "glitter"],
  Dragon: ["#220d44", "#8a3fd0", "shade"], Ghost: ["#1c0e34", "#7a46c8", "shade"], Dark: ["#120a1e", "#5a3a86", "shade"],
};

export class Scars {
  private cv: HTMLCanvasElement | null = null;
  private g: CanvasRenderingContext2D | null = null;
  private stage: StageKind = "grass";
  private n = 0;
  get stageName() { return this.stage; }
  /** how many marks there are: the renderer uses it to know when to redraw the cache */
  get count() { return this.n; }

  reset(stage: StageKind) {
    this.stage = stage;
    this.n = 0;
    if (typeof document === "undefined") return;
    if (!this.cv) {
      this.cv = document.createElement("canvas");
      this.cv.width = Math.round(ARENA.W * SC);
      this.cv.height = Math.round(ARENA.H * SC);
      this.g = this.cv.getContext("2d");
    }
    this.g?.clearRect(0, 0, this.cv.width, this.cv.height);
  }

  /** the picture of the marks, in world units from the top-left of the pitch (null before anything is marked) */
  get canvas(): HTMLCanvasElement | null { return this.n ? this.cv : null; }

  private get tone(): Tone { return TONES[this.stage] ?? DIRT; }

  private with(fn: (g: CanvasRenderingContext2D) => void) {
    const g = this.g;
    if (!g || this.stage === "ocean") return; // nothing marks open water
    // a long fight never runs out of room: when the floor is crowded with marks the old ones fade a little, so new ones always show
    if (this.n >= 240 && this.cv) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "destination-out";
      g.globalAlpha = 0.35;
      g.fillRect(0, 0, this.cv.width, this.cv.height);
      g.restore();
      this.n = 150;
    }
    g.save();
    g.setTransform(SC, 0, 0, SC, 0, 0);
    fn(g);
    g.restore();
    this.n++;
  }

  /** a ragged, star-shaped splat: the outline of a dirt crater */
  private splat(g: CanvasRenderingContext2D, r: number, R: () => number, arms: number, k = 1) {
    const pts: [number, number][] = [];
    const n = arms * 2;
    const base = R() * TAU;
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * TAU;
      const rr = r * (i % 2 ? 0.55 + R() * 0.25 : 0.95 + R() * 0.45) * k;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.86]);
    }
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i]!, q = pts[(i + 1) % n]!;
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) g.moveTo(mx, my);
      const nx = pts[(i + 1) % n]!, nn = pts[(i + 2) % n]!;
      g.quadraticCurveTo(nx[0], nx[1], (nx[0] + nn[0]) / 2, (nx[1] + nn[1]) / 2);
    }
    g.closePath();
  }

  /** a dirt crater with a lighter lip, a dark floor, loose pebbles and a skirt of dust; burning types blacken the ground around it */
  crater(x: number, y: number, r: number, type: string, seed = Math.random() * 999) {
    const R = rng(seed);
    const t = this.tone;
    const burn = BURNS.has(type) && this.stage !== "lava";
    r *= 1.25;
    this.with((g) => {
      g.translate(x, y);
      // churned, muddy ground around it: soft brown that builds up where the fighting is
      const mud = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.8);
      mud.addColorStop(0, burn ? "rgba(18,12,9,.2)" : "rgba(84,60,34,.2)");
      mud.addColorStop(1, "rgba(84,60,34,0)");
      g.fillStyle = mud;
      g.beginPath(); g.ellipse(0, 0, r * 2.8, r * 2.3, 0, 0, TAU); g.fill();
      for (let i = 0; i < 9; i++) {
        const a = R() * TAU, d = r * (1.2 + R() * 1.5);
        g.fillStyle = `rgba(${60 + R() * 30},${42 + R() * 20},${24 + R() * 12},${0.25 + R() * 0.25})`;
        g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d * 0.8, 1 + R() * 2.2, 0.8 + R() * 1.6, R() * 3, 0, TAU); g.fill();
      }
      // the stain around it
      g.fillStyle = burn ? "rgba(8,6,6,.34)" : t.dust;
      this.splat(g, r * 1.35, R, 6 + Math.floor(R() * 3), 1);
      g.fill();
      // the hole: lip, floor, deep centre
      g.fillStyle = burn ? "#17110f" : t.pit;
      this.splat(g, r, R, 6 + Math.floor(R() * 3));
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = t.rim;
      g.stroke();
      g.fillStyle = burn ? "#0a0706" : t.deep;
      g.globalAlpha = 0.85;
      this.splat(g, r * 0.58, R, 5 + Math.floor(R() * 3));
      g.fill();
      g.globalAlpha = 1;
      // a light edge on the upper side, where the lip catches the light
      g.strokeStyle = "rgba(255,240,210,.18)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(0, 0, r * 0.82, Math.PI * 1.05, Math.PI * 1.7);
      g.stroke();
      if (burn) {
        // soot streaks thrown outward
        g.strokeStyle = "rgba(6,4,4,.4)";
        for (let i = 0; i < 7; i++) {
          const a = R() * TAU;
          g.lineWidth = 1 + R() * 2.2;
          g.beginPath();
          g.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.78);
          g.lineTo(Math.cos(a) * r * (1.5 + R() * 1), Math.sin(a) * r * (1.3 + R() * 0.8));
          g.stroke();
        }
      }
    });
    this.rubble(x, y, r * 1.5, Math.round(3 + r / 6), seed + 1);
  }

  /** loose chips of stone thrown around a point, each with a shadow */
  rubble(x: number, y: number, r: number, n: number, seed = Math.random() * 999) {
    const R = rng(seed);
    const chips = this.tone.chip;
    this.with((g) => {
      g.translate(x, y);
      for (let i = 0; i < n; i++) {
        const a = R() * TAU;
        const d = r * (0.3 + R() * 0.8);
        const s = 1.6 + R() * 3.4;
        const px = Math.cos(a) * d, py = Math.sin(a) * d * 0.8;
        const sides = 4 + Math.floor(R() * 2);
        const rot = R() * TAU;
        const poly = (ox: number, oy: number) => {
          g.beginPath();
          for (let j = 0; j < sides; j++) {
            const aa = rot + (j / sides) * TAU;
            const rr = s * (0.7 + R() * 0.5);
            const X = px + ox + Math.cos(aa) * rr, Y = py + oy + Math.sin(aa) * rr * 0.8;
            if (j) g.lineTo(X, Y); else g.moveTo(X, Y);
          }
          g.closePath();
        };
        g.fillStyle = "rgba(0,0,0,.35)";
        poly(1.4, 1.8); g.fill();
        g.fillStyle = chips[Math.floor(R() * chips.length)]!;
        poly(0, 0); g.fill();
        g.strokeStyle = "rgba(255,255,255,.28)";
        g.lineWidth = 0.7;
        g.stroke();
      }
    });
  }

  /** a jagged hairline crack that thins out and sometimes forks */
  crack(x1: number, y1: number, x2: number, y2: number, seed = Math.random() * 999, w = 1.5, forks = 2) {
    const R = rng(seed);
    this.with((g) => {
      const draw = (ax: number, ay: number, bx: number, by: number, wd: number, depth: number) => {
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 5) return;
        const steps = Math.max(3, Math.round(len / 9));
        const nx = -(by - ay) / len, ny = (bx - ax) / len;
        const pts: [number, number][] = [[ax, ay]];
        for (let i = 1; i <= steps; i++) {
          const k = i / steps;
          const j = (R() - 0.5) * 9 * Math.min(1, k * 3);
          pts.push([ax + (bx - ax) * k + nx * j, ay + (by - ay) * k + ny * j]);
        }
        const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); };
        g.lineCap = "round"; g.lineJoin = "round";
        g.strokeStyle = "rgba(255,255,255,.09)"; g.lineWidth = wd + 1.4; path(); g.translate(0.8, 0.8); g.stroke(); g.translate(-0.8, -0.8);
        g.strokeStyle = "rgba(8,6,5,.82)"; g.lineWidth = wd; path(); g.stroke();
        if (depth < forks) {
          const nf = 1 + (R() < 0.5 ? 1 : 0);
          for (let f = 0; f < nf; f++) {
            const at = pts[Math.floor(steps * (0.3 + R() * 0.5))]!;
            const a = Math.atan2(by - ay, bx - ax) + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6);
            const L = len * (0.3 + R() * 0.3);
            draw(at[0], at[1], at[0] + Math.cos(a) * L, at[1] + Math.sin(a) * L * 0.8, Math.max(0.6, wd * 0.6), depth + 1);
          }
        }
      };
      draw(x1, y1, x2, y2, w, 0);
    });
  }

  /** a web of cracks spreading from a point (a quake, a stomp, something heavy landing) */
  web(x: number, y: number, r: number, seed = Math.random() * 999) {
    const R = rng(seed);
    const n = 5 + Math.floor(R() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R() * 0.5;
      const L = Math.min(75, r * (0.35 + R() * 0.4));
      this.crack(x + Math.cos(a) * 4, y + Math.sin(a) * 3, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.8, seed + i * 3.1, 1.1, 1);
    }
  }

  /** a ring of dust left where a wave went out: a pale rim around darker ground, with a few broken arcs */
  ring(x: number, y: number, r: number, seed = Math.random() * 999) {
    const R = rng(seed);
    const t = this.tone;
    this.with((g) => {
      g.translate(x, y);
      g.scale(1, 0.84);
      g.fillStyle = t.dust;
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.strokeStyle = "rgba(226,206,160,.45)";
      g.lineWidth = 2.4;
      for (let i = 0; i < 5; i++) {
        const a = R() * TAU;
        g.beginPath(); g.arc(0, 0, r * (0.92 + R() * 0.1), a, a + 0.8 + R() * 1.1); g.stroke();
      }
      g.strokeStyle = "rgba(20,14,8,.35)";
      g.lineWidth = 1.4;
      g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.stroke();
    });
  }

  /** a long, wide mark on the ground left by a beam, in the look of its type: a wet channel, a charred seam, a fused line, frost, a torn furrow... */
  trench(x1: number, y1: number, x2: number, y2: number, type: string, w = 14, seed = Math.random() * 999) {
    const R = rng(seed);
    const [dark, edge, fx] = TRENCH[type] ?? TRENCH.Dragon!;
    const tex = typeTex(type);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 20) return;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    const steps = Math.max(5, Math.round(len / 18));
    const mid: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      mid.push([x1 + (x2 - x1) * k + nx * (R() - 0.5) * 8, y1 + (y2 - y1) * k + ny * (R() - 0.5) * 8]);
    }
    // each band is one ragged strip along the line; the same outline is reused so the layers sit exactly on each other
    const outline = (wd: number, jit: number) => {
      const jits = mid.map(() => 1 + (R() - 0.5) * jit);
      return (sgn: number) => mid.map((p, i) => {
        const taper = Math.sin((i / steps) * Math.PI) * 0.4 + 0.6;
        return [p[0] + nx * sgn * wd * taper * jits[i]!, p[1] + ny * sgn * wd * taper * jits[i]!] as [number, number];
      });
    };
    const band = (wd: number, fill: string | ((g: CanvasRenderingContext2D) => string | CanvasPattern), jit: number, alpha = 1, op: GlobalCompositeOperation = "source-over") => {
      const side = outline(wd, jit);
      this.with((g) => {
        g.globalAlpha = alpha;
        g.globalCompositeOperation = op;
        g.fillStyle = typeof fill === "string" ? fill : fill(g);
        g.beginPath();
        const A = side(1), B = side(-1).reverse();
        A.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        B.forEach((p) => g.lineTo(p[0], p[1]));
        g.closePath();
        g.fill();
      });
    };
    const pat = (sc: number) => (g: CanvasRenderingContext2D) => texPat(g, tex, mid[0]![0], mid[0]![1], sc);
    const at = (k: number): [number, number] => mid[Math.min(steps, Math.max(0, Math.round(k * steps)))]!;
    band(w * 1.3, fx === "frost" ? "rgba(210,240,255,.22)" : fx === "wet" ? "rgba(10,40,80,.3)" : "rgba(0,0,0,.26)", 0.5); // what the beam scuffed or soaked around it
    band(w * 0.98, edge + "aa", 0.55); // the lit lip
    band(w * 0.8, dark, 0.35); // the cut
    band(w * 0.8, pat(fx === "wet" ? 0.9 : 0.7), 0.35, fx === "wet" ? 0.7 : fx === "char" || fx === "arc" ? 0.4 : 0.55, "source-over"); // the type's own surface
    band(w * 0.36, "rgba(0,0,0,.5)", 0.3); // the bottom of it
    const dab = (px: number, py: number, rx: number, ry: number, fill: string, rot = 0) => this.with((g) => { g.fillStyle = fill; g.beginPath(); g.ellipse(px, py, rx, ry, rot, 0, TAU); g.fill(); });
    const line = (pts: [number, number][], col: string, wd: number) => this.with((g) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); });
    const along = (off: number) => mid.map((p) => [p[0] + nx * off, p[1] + ny * off] as [number, number]);
    const nDot = Math.round(len / 14);
    if (fx === "wet") {
      line(along(-w * 0.18), "rgba(190,235,255,.5)", 1.6); // a gloss line down the water
      line(along(w * 0.22), "rgba(255,255,255,.22)", 1);
      for (let i = 0; i < nDot; i++) { const p = at(R()); dab(p[0] + nx * (R() - 0.5) * w * 2.2, p[1] + ny * (R() - 0.5) * w * 2.2, 1.5 + R() * 2.6, 1 + R() * 1.6, "rgba(170,225,255,.55)"); } // droplets and puddles
      for (let i = 0; i < 3; i++) { const p = at(0.15 + R() * 0.7); this.with((g) => { g.strokeStyle = "rgba(220,245,255,.45)"; g.lineWidth = 1.2; g.beginPath(); g.ellipse(p[0], p[1], w * (0.7 + R() * 0.6), w * 0.4, Math.atan2(y2 - y1, x2 - x1), 0, TAU); g.stroke(); }); }
    } else if (fx === "char") {
      line(along(0), "rgba(255,110,20,.55)", 5); line(along(0), "rgba(255,170,60,.8)", 2.4); line(along(0), "rgba(255,235,160,.9)", 1); // a glowing seam
      for (let i = 0; i < nDot * 1.5; i++) { const p = at(R()); dab(p[0] + nx * (R() - 0.5) * w * 2, p[1] + ny * (R() - 0.5) * w * 2, 1 + R() * 1.6, 1 + R() * 1.2, R() < 0.5 ? "rgba(255,150,40,.9)" : "rgba(30,20,16,.8)"); } // embers and soot
      for (let i = 0; i < 4; i++) { const p = at(R()); this.crack(p[0], p[1], p[0] + nx * (R() - 0.5) * w * 3, p[1] + ny * (R() - 0.5) * w * 3, seed + i, 1, 0); }
    } else if (fx === "arc") {
      for (let i = 0; i < 3; i++) {
        const pts = mid.map((p, j) => [p[0] + nx * (R() - 0.5) * w * 0.9, p[1] + ny * (R() - 0.5) * w * 0.9 + (j % 2 ? 1.5 : -1.5)] as [number, number]);
        line(pts, i ? "rgba(255,244,170,.85)" : "rgba(255,225,70,.6)", i ? 1 : 2.4);
      }
      for (let i = 0; i < nDot; i++) { const p = at(R()); dab(p[0] + nx * (R() - 0.5) * w * 2.4, p[1] + ny * (R() - 0.5) * w * 2.4, 1 + R() * 1.4, 1 + R() * 1.4, R() < 0.5 ? "rgba(255,240,150,.9)" : "rgba(12,10,8,.8)"); } // sparks and fused specks
    } else if (fx === "frost") {
      for (let i = 0; i < nDot * 1.2; i++) { // ice shards and frost dust
        const p = at(R()), sx = p[0] + nx * (R() - 0.5) * w * 2, sy = p[1] + ny * (R() - 0.5) * w * 2, sz = 2 + R() * 4, a = R() * TAU;
        this.with((g) => { g.fillStyle = R() < 0.5 ? "rgba(235,250,255,.85)" : "rgba(160,215,245,.8)"; g.beginPath(); g.moveTo(sx + Math.cos(a) * sz, sy + Math.sin(a) * sz); g.lineTo(sx + Math.cos(a + 2.4) * sz * 0.5, sy + Math.sin(a + 2.4) * sz * 0.5); g.lineTo(sx + Math.cos(a + 3.9) * sz * 0.5, sy + Math.sin(a + 3.9) * sz * 0.5); g.closePath(); g.fill(); });
      }
      for (let i = 0; i < 4; i++) { const p = at(R()); this.crack(p[0], p[1], p[0] + nx * (R() - 0.5) * w * 3.4, p[1] + ny * (R() - 0.5) * w * 3.4, seed + i, 1, 1); }
    } else if (fx === "furrow") {
      for (let i = 0; i < nDot * 1.4; i++) { // torn blades and leaves thrown to the sides
        const p = at(R()), sx = p[0] + nx * (R() < 0.5 ? -1 : 1) * w * (0.8 + R() * 0.9), sy = p[1] + ny * (R() < 0.5 ? -1 : 1) * w * (0.8 + R() * 0.9);
        dab(sx, sy, 2 + R() * 3, 1 + R() * 1.4, R() < 0.5 ? "#4f9a3a" : "#8acb5a", R() * TAU);
      }
      for (let i = 0; i < nDot; i++) { const p = at(R()); dab(p[0] + nx * (R() - 0.5) * w * 1.6, p[1] + ny * (R() - 0.5) * w * 1.6, 1.5 + R() * 2, 1 + R() * 1.4, "rgba(70,48,26,.8)"); }
    } else if (fx === "sludge") {
      for (let i = 0; i < nDot; i++) { // bubbles with a glint
        const p = at(R()), bx = p[0] + nx * (R() - 0.5) * w * 1.6, by = p[1] + ny * (R() - 0.5) * w * 1.6, rr = 1.6 + R() * 3.4;
        this.with((g) => { g.fillStyle = "rgba(150,70,200,.55)"; g.strokeStyle = "rgba(220,150,250,.8)"; g.lineWidth = 1; g.beginPath(); g.arc(bx, by, rr, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(bx - rr * 0.35, by - rr * 0.35, rr * 0.25, 0, TAU); g.fill(); });
      }
      line(along(w * 0.1), "rgba(120,200,70,.35)", 1.6);
    } else if (fx === "ditch") {
      for (let i = 0; i < Math.round(len / 40); i++) { const p = at(R()); this.rubble(p[0] + nx * (R() - 0.5) * w * 2, p[1] + ny * (R() - 0.5) * w * 2, 14, 3, seed + i); }
      this.crack(mid[0]![0], mid[0]![1], mid[steps]![0], mid[steps]![1], seed + 9, 1.2, 1);
    } else if (fx === "scour") {
      for (let k = -2; k <= 2; k++) line(along(k * w * 0.2), "rgba(235,240,250,.4)", 0.9); // long scratches
      for (let i = 0; i < nDot * 0.6; i++) { const p = at(R()); this.rubble(p[0] + nx * (R() - 0.5) * w * 2, p[1] + ny * (R() - 0.5) * w * 2, 8, 1, seed + i); }
    } else if (fx === "glitter") {
      for (let i = 0; i < nDot * 1.2; i++) {
        const p = at(R()), sx = p[0] + nx * (R() - 0.5) * w * 2.2, sy = p[1] + ny * (R() - 0.5) * w * 2.2, sz = 1.5 + R() * 3;
        this.with((g) => { g.strokeStyle = R() < 0.5 ? "rgba(255,230,250,.9)" : "rgba(255,160,225,.85)"; g.lineWidth = 1; g.beginPath(); g.moveTo(sx - sz, sy); g.lineTo(sx + sz, sy); g.moveTo(sx, sy - sz); g.lineTo(sx, sy + sz); g.stroke(); });
      }
    } else {
      line(along(0), edge + "88", 1.6);
      for (let i = 0; i < nDot; i++) { const p = at(R()); dab(p[0] + nx * (R() - 0.5) * w * 2.2, p[1] + ny * (R() - 0.5) * w * 2.2, 1.4 + R() * 2, 1.1 + R() * 1.4, edge + "66"); }
      this.crack(mid[0]![0], mid[0]![1], mid[steps]![0], mid[steps]![1], seed + 9, 1.2, 1);
    }
  }
}
