/**
 * The fine detail of each stage's ground: blades of grass, grit, pebbles, hairline cracks, scratches and sparkles.
 *
 * The big floor picture (arena-floor.ts) is baked once at about one pixel per unit, which is plenty from far away but turns soft
 * when the camera is low and close to the ground. This detail picture is a small tile that repeats over the floor and is drawn
 * on top of it, in the same perspective as the floor, at the screen's own sharpness, so the ground has fine texture wherever you look.
 * It is drawn with the "overlay" blend: the mid-grey of the tile changes nothing, lighter marks brighten the floor and darker ones darken it.
 */
import type { StageKind } from "@/lib/pokemon/arena-engine";

/** The tile covers this many units of the arena. */
export const DETAIL_WORLD = 100;
const N = 256;

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

const OFFS = [-N, 0, N];

type Ctx = CanvasRenderingContext2D;

/** Draw something so that it also shows on the far side of the tile where it runs off an edge (the tile must repeat without a seam). */
function wrapped(x: number, y: number, reach: number, draw: (dx: number, dy: number) => void) {
  for (const ox of OFFS) {
    if ((ox < 0 && x > reach) || (ox > 0 && x < N - reach)) continue;
    for (const oy of OFFS) {
      if ((oy < 0 && y > reach) || (oy > 0 && y < N - reach)) continue;
      draw(ox, oy);
    }
  }
}

function dots(g: Ctx, r: () => number, count: number, light: string, dark: string, size = 1) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = r() < 0.5 ? dark : light;
    g.fillRect(Math.floor(r() * N), Math.floor(r() * N), size, size);
  }
}

function line(g: Ctx, x: number, y: number, a: number, len: number, w: number, color: string) {
  wrapped(x, y, len + 2, (ox, oy) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x + ox, y + oy);
    g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
    g.stroke();
  });
}

function blob(g: Ctx, x: number, y: number, rx: number, ry: number, rot: number, fill: string, edge?: string) {
  wrapped(x, y, Math.max(rx, ry) + 2, (ox, oy) => {
    g.beginPath();
    g.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    if (edge) {
      g.strokeStyle = edge;
      g.lineWidth = 1;
      g.stroke();
    }
  });
}

/** A pebble: a dark shadow below and to the right, the stone itself, and a bright catch of light on its upper left. */
function pebble(g: Ctx, x: number, y: number, s: number, tone: number) {
  blob(g, x + s * 0.3, y + s * 0.35, s, s * 0.8, 0.3, "rgba(0,0,0,.55)");
  blob(g, x, y, s, s * 0.8, 0.3, `rgb(${tone},${tone - 6},${tone - 14})`);
  blob(g, x - s * 0.3, y - s * 0.3, s * 0.45, s * 0.3, 0.3, "rgba(255,255,255,.55)");
}

function crack(g: Ctx, r: () => number, color: string, len: number, w = 1) {
  let x = r() * N, y = r() * N, a = r() * 6.28;
  for (let i = 0; i < len / 6; i++) {
    const na = a + (r() - 0.5) * 0.9;
    line(g, x, y, na, 6, w, color);
    x = (x + Math.cos(na) * 6 + N) % N;
    y = (y + Math.sin(na) * 6 + N) % N;
    a = na;
  }
}

const BUILD: Partial<Record<StageKind, (g: Ctx, r: () => number) => void>> = {
  grass(g, r) {
    // a tuft's worth of blades, leaning mostly upward, light on one side and dark on the other
    for (let i = 0; i < 2600; i++) {
      const x = r() * N, y = r() * N;
      const a = -Math.PI / 2 + (r() - 0.5) * 1.5;
      const len = 4 + r() * 8;
      const lightSide = r() < 0.5;
      line(g, x, y, a, len, 1 + r() * 0.7, lightSide ? `rgba(${185 + r() * 40},${225 + r() * 25},${120 + r() * 40},${0.5 + r() * 0.4})` : `rgba(${14 + r() * 24},${40 + r() * 30},${10 + r() * 18},${0.5 + r() * 0.4})`);
    }
    // bare soil showing between them, and a few seed heads and clover flowers
    for (let i = 0; i < 70; i++) blob(g, r() * N, r() * N, 0.8 + r() * 1.6, 0.6 + r() * 1.0, r() * 3, `rgba(${70 + r() * 30},${48 + r() * 20},${24},.55)`);
    for (let i = 0; i < 18; i++) blob(g, r() * N, r() * N, 1.2, 1.2, 0, r() < 0.5 ? "rgba(255,255,235,.85)" : "rgba(255,226,110,.85)");
    dots(g, r, 3200, "rgba(150,170,110,.35)", "rgba(20,36,16,.35)");
  },
  stone(g, r) {
    dots(g, r, 6500, "rgba(200,205,220,.35)", "rgba(10,12,22,.4)");
    for (let i = 0; i < 90; i++) {
      // a chip: a dark pit with a bright lip on its lower side
      const x = r() * N, y = r() * N, s = 0.8 + r() * 2;
      blob(g, x, y, s, s * 0.8, r() * 3, "rgba(8,10,20,.65)");
      blob(g, x + 0.5, y + 1, s * 0.8, s * 0.35, 0, "rgba(230,235,250,.35)");
    }
    for (let i = 0; i < 7; i++) crack(g, r, "rgba(8,10,18,.75)", 50 + r() * 60);
    for (let i = 0; i < 40; i++) line(g, r() * N, r() * N, r() * 6.28, 8 + r() * 30, 1, "rgba(235,240,255,.18)");
  },
  dirt(g, r) {
    dots(g, r, 9000, "rgba(220,190,150,.38)", "rgba(30,18,8,.42)");
    for (let i = 0; i < 55; i++) pebble(g, r() * N, r() * N, 1.4 + r() * 3.2, 120 + Math.floor(r() * 70));
    for (let i = 0; i < 10; i++) crack(g, r, "rgba(34,20,8,.7)", 40 + r() * 70);
    for (let i = 0; i < 14; i++) blob(g, r() * N, r() * N, 5 + r() * 9, 2 + r() * 3, r() * 3, "rgba(40,24,10,.12)");
  },
  crystal(g, r) {
    for (let i = 0; i < 70; i++) {
      // tiny facets of glassy rock
      const x = r() * N, y = r() * N, s = 3 + r() * 9, a = r() * 6.28;
      wrapped(x, y, s + 2, (ox, oy) => {
        g.beginPath();
        g.moveTo(x + ox + Math.cos(a) * s, y + oy + Math.sin(a) * s);
        g.lineTo(x + ox + Math.cos(a + 2.1) * s * 0.8, y + oy + Math.sin(a + 2.1) * s * 0.8);
        g.lineTo(x + ox + Math.cos(a + 4.1) * s * 0.9, y + oy + Math.sin(a + 4.1) * s * 0.9);
        g.closePath();
        g.fillStyle = r() < 0.5 ? "rgba(190,170,255,.22)" : "rgba(4,2,16,.3)";
        g.fill();
      });
    }
    dots(g, r, 3500, "rgba(190,170,255,.3)", "rgba(2,1,12,.4)");
    for (let i = 0; i < 70; i++) { const x = Math.floor(r() * N), y = Math.floor(r() * N); g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(x, y, 1, 1); }
    for (let i = 0; i < 12; i++) { const x = r() * N, y = r() * N; line(g, x - 3, y, 0, 6, 1, "rgba(235,225,255,.7)"); line(g, x, y - 3, Math.PI / 2, 6, 1, "rgba(235,225,255,.7)"); }
  },
  ice(g, r) {
    dots(g, r, 3200, "rgba(255,255,255,.3)", "rgba(40,90,150,.3)");
    for (let i = 0; i < 130; i++) line(g, r() * N, r() * N, r() * 6.28, 18 + r() * 70, 1, r() < 0.65 ? "rgba(255,255,255,.34)" : "rgba(30,80,140,.28)");
    for (let i = 0; i < 55; i++) {
      const x = r() * N, y = r() * N, s = 1.2 + r() * 3.4;
      wrapped(x, y, s + 2, (ox, oy) => { g.beginPath(); g.arc(x + ox, y + oy, s, 0, 6.28); g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1; g.stroke(); });
    }
    for (let i = 0; i < 5; i++) crack(g, r, "rgba(40,100,170,.55)", 60 + r() * 60);
  },
  lava(g, r) {
    dots(g, r, 5000, "rgba(255,170,90,.35)", "rgba(8,3,2,.5)");
    for (let i = 0; i < 420; i++) blob(g, r() * N, r() * N, 0.7 + r() * 1.5, 0.7 + r() * 1.1, 0, `rgba(255,${120 + Math.floor(r() * 90)},${30 + Math.floor(r() * 40)},${0.45 + r() * 0.4})`);
    for (let i = 0; i < 8; i++) crack(g, r, "rgba(255,120,30,.6)", 40 + r() * 60);
    for (let i = 0; i < 160; i++) blob(g, r() * N, r() * N, 1 + r() * 2, 0.8 + r() * 1.2, r() * 3, "rgba(120,100,90,.3)");
  },
  coast(g, r) {
    dots(g, r, 9000, "rgba(255,244,214,.4)", "rgba(110,86,50,.38)");
    // long soft ripples, drawn so that they join up across the tile
    for (let k = 0; k < 28; k++) {
      const y0 = r() * N, amp = 1 + r() * 2.2, ph = r() * 6.28, f = 1 + Math.floor(r() * 3);
      g.strokeStyle = k % 2 ? "rgba(255,248,225,.3)" : "rgba(120,92,52,.3)";
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= N; x += 4) {
        const y = y0 + Math.sin((x / N) * Math.PI * 2 * f + ph) * amp;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 22; i++) blob(g, r() * N, r() * N, 1.2 + r() * 2.2, 0.8 + r() * 1.3, r() * 3, r() < 0.6 ? "rgba(255,246,232,.8)" : "rgba(150,132,112,.7)", "rgba(80,60,40,.5)");
  },
};

const cache = new Map<StageKind, HTMLCanvasElement>();

/** The detail tile for a stage (mid-grey with marks on it), built once. */
export function detailTile(kind: StageKind): HTMLCanvasElement {
  let c = cache.get(kind);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgb(128,128,128)";
  g.fillRect(0, 0, N, N);
  g.lineCap = "round";
  // stages that share a ground with another use its detail; open water has none
  const alias: Partial<Record<StageKind, StageKind>> = { meadow: "grass", glacier: "ice" };
  (BUILD[kind] ?? BUILD[alias[kind] ?? "grass"])!(g, rng(kind.length * 7919 + kind.charCodeAt(0) * 31));
  cache.set(kind, c);
  return c;
}

/** How strongly the detail is laid over the floor for a stage (0..1). */
export const DETAIL_STRENGTH: Record<StageKind, number> = { grass: 0.62, stone: 0.5, dirt: 0.6, crystal: 0.5, ice: 0.45, lava: 0.5, coast: 0.55, meadow: 0.62, glacier: 0.45, ocean: 0 };
