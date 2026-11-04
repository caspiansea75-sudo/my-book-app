/**
 * Lasting damage on the floor, as in the reference match: every blast leaves a dirt crater with chipped rubble,
 * quakes leave webs of hairline cracks, big beams leave a dark trench, and none of it fades. The marks are baked
 * once into a canvas the size of the pitch, which is laid on the floor under everything that moves.
 */
import { ARENA, type StageKind } from "@/lib/pokemon/arena-engine";

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
  ice: { pit: "#6d8aa3", deep: "#3d566d", rim: "rgba(235,248,255,.7)", dust: "rgba(180,210,230,.3)", chip: ["#dff3ff", "#bfe0f5", "#9ec6e2", "#ffffff"] },
  lava: { pit: "#150f0e", deep: "#0a0707", rim: "rgba(255,120,40,.35)", dust: "rgba(20,12,10,.45)", chip: ["#3a3030", "#2a2222", "#4a3a36", "#1c1616"] },
  crystal: { pit: "#2a2040", deep: "#150f26", rim: "rgba(190,160,255,.5)", dust: "rgba(60,40,100,.32)", chip: ["#a98bff", "#7f66d6", "#cdb8ff", "#5b4aa0"] },
  coast: { pit: "#6a5a3c", deep: "#3a2f1d", rim: "rgba(230,210,160,.5)", dust: "rgba(140,120,80,.3)", chip: ["#c9b98a", "#a89a70", "#8d8260", "#d8caa0"] },
  stone: { pit: "#2a2c33", deep: "#14151a", rim: "rgba(160,165,180,.45)", dust: "rgba(60,62,72,.34)", chip: ["#7d828d", "#5b606b", "#9aa0ab", "#464a54"] },
};
/** types whose blasts burn the ground rather than dig it */
const BURNS = new Set(["Fire", "Electric", "Dragon", "Dark", "Ghost", "Psychic", "Poison"]);
/** a trench's colour: Dragon / Ghost / Poison / Psychic / Dark all cut dark purple, like the beam in the reference */
const TRENCH: Record<string, [string, string]> = {
  Dragon: ["#2a0f4a", "#8a3fd0"], Ghost: ["#241040", "#7a46c8"], Poison: ["#2e0f3a", "#a448c0"], Psychic: ["#38103f", "#d058b8"], Dark: ["#1a0f26", "#5a3a86"],
  Fire: ["#2a0e08", "#e0662a"], Electric: ["#1d1a08", "#d8c43a"], Ice: ["#16324a", "#9ad8f2"], Water: ["#0e2a3c", "#4a9ad0"], Grass: ["#102a12", "#5a9a3a"], Ground: ["#2a1a0e", "#a47a46"], Rock: ["#26231e", "#8a8678"],
};

export class Scars {
  private cv: HTMLCanvasElement | null = null;
  private g: CanvasRenderingContext2D | null = null;
  private stage: StageKind = "grass";
  private n = 0;
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
    if (!g) return;
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

  /** a long, wide cut through the ground: a dark channel with a ragged lighter edge, coloured by the move's type */
  trench(x1: number, y1: number, x2: number, y2: number, type: string, w = 16, seed = Math.random() * 999) {
    const R = rng(seed);
    const [dark, edge] = TRENCH[type] ?? TRENCH.Dragon!;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 20) return;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    const steps = Math.max(5, Math.round(len / 18));
    const mid: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      mid.push([x1 + (x2 - x1) * k + nx * (R() - 0.5) * 8, y1 + (y2 - y1) * k + ny * (R() - 0.5) * 8]);
    }
    const band = (wd: number, col: string, jit: number) => {
      this.with((g) => {
        g.fillStyle = col;
        g.beginPath();
        const side = (sgn: number) => mid.map((p, i) => {
          const taper = Math.sin((i / steps) * Math.PI) * 0.4 + 0.6;
          const j = 1 + (R() - 0.5) * jit;
          return [p[0] + nx * sgn * wd * taper * j, p[1] + ny * sgn * wd * taper * j] as [number, number];
        });
        const A = side(1), B = side(-1).reverse();
        A.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        B.forEach((p) => g.lineTo(p[0], p[1]));
        g.closePath();
        g.fill();
      });
    };
    band(w * 1.25, "rgba(0,0,0,.28)", 0.5); // the scuffed ground around it
    band(w * 0.95, edge + "99", 0.55); // its lit lip
    band(w * 0.78, dark, 0.35); // the cut
    band(w * 0.36, "rgba(0,0,0,.55)", 0.3); // the bottom of it
    // rubble along the edge
    for (let i = 0; i < Math.round(len / 40); i++) {
      const p = mid[Math.floor(R() * mid.length)]!;
      this.rubble(p[0] + nx * (R() - 0.5) * w * 2, p[1] + ny * (R() - 0.5) * w * 2, 14, 2, seed + i);
    }
    this.crack(mid[0]![0], mid[0]![1], mid[steps]![0], mid[steps]![1], seed + 9, 1.2, 1);
  }
}
