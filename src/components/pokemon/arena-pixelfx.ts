/**
 * Pixel-art effects (the open-source "pixelfx" library, copied into lib/pixelfx) played over the arena:
 * hits, blasts, heals, power-ups and knock-outs. Each effect is a tiny pixel picture that is drawn into its own
 * small canvas and then stretched, unsmoothed, into the world, so it keeps its chunky pixels at any zoom.
 */
// @ts-ignore — plain JS module
import { createFrame, clearFrame, createFx, composite } from "@/lib/pixelfx/core/index.js";

type Mod = { meta: { size: [number, number]; origin: [number, number]; duration: number; loop?: boolean; actor?: unknown; options?: { palette?: string[] } } };

const LOAD: Record<string, () => Promise<Mod>> = {
  "impacts/hit-spark": () => import("@/lib/pixelfx/fx/impacts/hit-spark.js") as Promise<Mod>,
  "impacts/blunt-hit": () => import("@/lib/pixelfx/fx/impacts/blunt-hit.js") as Promise<Mod>,
  "impacts/crit-hit": () => import("@/lib/pixelfx/fx/impacts/crit-hit.js") as Promise<Mod>,
  "impacts/ground-slam": () => import("@/lib/pixelfx/fx/impacts/ground-slam.js") as Promise<Mod>,
  "impacts/parry": () => import("@/lib/pixelfx/fx/impacts/parry.js") as Promise<Mod>,
  "lightning/zap-hit": () => import("@/lib/pixelfx/fx/lightning/zap-hit.js") as Promise<Mod>,
  "lightning/lightning-strike": () => import("@/lib/pixelfx/fx/lightning/lightning-strike.js") as Promise<Mod>,
  "explosions/small-explosion": () => import("@/lib/pixelfx/fx/explosions/small-explosion.js") as Promise<Mod>,
  "explosions/big-explosion": () => import("@/lib/pixelfx/fx/explosions/big-explosion.js") as Promise<Mod>,
  "explosions/dirt-explosion": () => import("@/lib/pixelfx/fx/explosions/dirt-explosion.js") as Promise<Mod>,
  "explosions/plasma-explosion": () => import("@/lib/pixelfx/fx/explosions/plasma-explosion.js") as Promise<Mod>,
  "explosions/cartoon-pow": () => import("@/lib/pixelfx/fx/explosions/cartoon-pow.js") as Promise<Mod>,
  "water/splash": () => import("@/lib/pixelfx/fx/water/splash.js") as Promise<Mod>,
  "water/geyser": () => import("@/lib/pixelfx/fx/water/geyser.js") as Promise<Mod>,
  "nature/spore-burst": () => import("@/lib/pixelfx/fx/nature/spore-burst.js") as Promise<Mod>,
  "nature/acid-splash": () => import("@/lib/pixelfx/fx/nature/acid-splash.js") as Promise<Mod>,
  "nature/healing-bloom": () => import("@/lib/pixelfx/fx/nature/healing-bloom.js") as Promise<Mod>,
  "ice/snowflake-burst": () => import("@/lib/pixelfx/fx/ice/snowflake-burst.js") as Promise<Mod>,
  "ice/ice-shatter": () => import("@/lib/pixelfx/fx/ice/ice-shatter.js") as Promise<Mod>,
  "shadow/dark-explosion": () => import("@/lib/pixelfx/fx/shadow/dark-explosion.js") as Promise<Mod>,
  "arcane/mana-burst": () => import("@/lib/pixelfx/fx/arcane/mana-burst.js") as Promise<Mod>,
  "arcane/star-fall": () => import("@/lib/pixelfx/fx/arcane/star-fall.js") as Promise<Mod>,
  "holy/feather-burst": () => import("@/lib/pixelfx/fx/holy/feather-burst.js") as Promise<Mod>,
  "holy/smite": () => import("@/lib/pixelfx/fx/holy/smite.js") as Promise<Mod>,
  "scifi/emp-blast": () => import("@/lib/pixelfx/fx/scifi/emp-blast.js") as Promise<Mod>,
  "spawn/poof": () => import("@/lib/pixelfx/fx/spawn/poof.js") as Promise<Mod>,
  "pickups/collect-burst": () => import("@/lib/pixelfx/fx/pickups/collect-burst.js") as Promise<Mod>,
};
export type PxId = keyof typeof LOAD;

export type PxOpts = {
  /** World units per effect pixel. */
  scale: number;
  /** Mirror it left-right. */
  flip?: boolean;
  /** Rotate it about its origin (radians). */
  angle?: number;
  /** Recolour it with a dark-to-bright ramp made from this colour. */
  tint?: string;
  /** Play faster (long effects have slow tails). */
  speed?: number;
  /** Stop after this many seconds (it fades out). */
  max?: number;
  /** Lift it off the floor (body height), in world units. */
  lift?: number;
};

type Live = {
  fx: ReturnType<typeof createFx>;
  frame: ReturnType<typeof createFrame>;
  img: ImageData;
  cv: HTMLCanvasElement;
  cx: CanvasRenderingContext2D;
  ox: number;
  oy: number;
  x: number;
  y: number;
  o: PxOpts;
  t: number;
  life: number;
  acc: number;
  dirty: boolean;
  stopped: boolean;
};

const MAX_LIVE = 8;
const STEP = 1 / 30;
const cache = new Map<string, Mod>();
const loading = new Set<string>();

/** Start loading the effects so the first hit of a match doesn't wait for them. */
export function preloadPixelfx(ids: string[] = Object.keys(LOAD)) {
  for (const id of ids) {
    if (cache.has(id) || loading.has(id)) continue;
    loading.add(id);
    LOAD[id]!().then((m) => cache.set(id, m)).catch(() => {}).finally(() => loading.delete(id));
  }
}

const hx = (s: string) => {
  const n = parseInt(s.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
/** Seven colours from near-black to white that pass through the given colour in the middle. */
export function rampOf(color: string, n = 7): string[] {
  const [r, g, b] = hx(color);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const k = u < 0.55 ? u / 0.55 : 1;
    const w = u < 0.55 ? 0 : (u - 0.55) / 0.45;
    const c = [r, g, b].map((v) => Math.round(v * (0.12 + 0.88 * k) + (255 - v) * w * 0.85));
    out.push("#" + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join(""));
  }
  return out;
}

export class PixelFxLayer {
  live: Live[] = [];

  /** Play an effect with its origin at world (x, y). Does nothing until the effect has loaded. */
  spawn(id: PxId, x: number, y: number, o: PxOpts) {
    const mod = cache.get(id);
    if (!mod) {
      preloadPixelfx([id]);
      return;
    }
    if (mod.meta.actor) return; // those draw a stand-in character
    if (typeof document === "undefined") return;
    const [w, h] = mod.meta.size;
    const [ox, oy] = mod.meta.origin;
    const opts: Record<string, unknown> = { x: ox, y: oy, seed: (Math.random() * 1e6) | 0, flip: !!o.flip, angle: o.angle ?? 0 };
    if (o.tint && mod.meta.options?.palette) opts.palette = rampOf(o.tint, mod.meta.options.palette.length);
    const fx = createFx(mod, opts);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d");
    if (!cx) return;
    const speed = o.speed ?? 1;
    const life = Math.min(mod.meta.duration / speed, o.max ?? 99);
    this.live.push({ fx, frame: createFrame(w, h), img: new ImageData(w, h), cv, cx, ox, oy, x, y, o, t: 0, life, acc: STEP, dirty: true, stopped: false });
    if (this.live.length > MAX_LIVE) this.live.shift();
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i]!;
      l.t += dt;
      l.acc += dt;
      if (!l.stopped && l.t >= l.life) {
        l.fx.stop();
        l.stopped = true;
      }
      if (l.t >= l.life + 0.35 || l.fx.done()) {
        this.live.splice(i, 1);
        continue;
      }
      if (l.acc >= STEP) {
        // the effect keeps its own clock; a picture is only redrawn about 30 times a second
        l.fx.update(l.acc * (l.o.speed ?? 1));
        l.acc = 0;
        l.dirty = true;
      }
    }
  }

  private paint(l: Live) {
    if (!l.dirty) return;
    clearFrame(l.frame);
    l.fx.draw(l.frame);
    composite(l.frame, l.img.data, null);
    l.cx.putImageData(l.img, 0, 0);
    l.dirty = false;
  }

  /** What to put among the sorted things: one entry per live effect. `draw` runs with the world position already set. */
  items(add: (x: number, y: number, lift: number, draw: (g: CanvasRenderingContext2D) => void) => void) {
    for (const l of this.live) {
      add(l.x, l.y, l.o.lift ?? 0, (g) => {
        this.paint(l);
        const k = l.o.scale;
        g.save();
        g.imageSmoothingEnabled = false;
        g.drawImage(l.cv, -l.ox * k, -l.oy * k, l.cv.width * k, l.cv.height * k);
        g.restore();
      });
    }
  }

  clear() {
    this.live.length = 0;
  }
}
