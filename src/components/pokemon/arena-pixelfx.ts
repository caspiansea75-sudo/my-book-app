/**
 * Pixel-art effects (the open-source "pixelfx" library, copied into lib/pixelfx) played over the arena.
 *
 * Built to stay smooth:
 *  - one-shot effects (hits, blasts, KOs) are drawn live into a small canvas, about 30 times a second, and at most a few at once;
 *  - looping effects (shots in flight, status marks, pickups) are drawn ONCE into a strip of frames ("sheet"), a frame or two at a time,
 *    and after that cost one drawImage each, however many are on screen;
 *  - the full-screen weather is drawn live at a low frame rate and only while the game runs well;
 *  - a small governor watches the real frame time and switches the heavier things off in steps (tier 0 to 3), and back on when it recovers.
 */
// @ts-ignore — plain JS module
import { createFrame, clearFrame, createFx, composite } from "@/lib/pixelfx/core/index.js";

type Mod = { meta: { size: [number, number]; origin: [number, number]; duration: number; loop?: boolean; actor?: unknown; options?: { palette?: string[] } } };

const L = (p: Promise<unknown>) => p as Promise<Mod>;
const LOAD: Record<string, () => Promise<Mod>> = {
  "impacts/hit-spark": () => L(import("@/lib/pixelfx/fx/impacts/hit-spark.js")),
  "impacts/blunt-hit": () => L(import("@/lib/pixelfx/fx/impacts/blunt-hit.js")),
  "impacts/crit-hit": () => L(import("@/lib/pixelfx/fx/impacts/crit-hit.js")),
  "impacts/ground-slam": () => L(import("@/lib/pixelfx/fx/impacts/ground-slam.js")),
  "impacts/parry": () => L(import("@/lib/pixelfx/fx/impacts/parry.js")),
  "lightning/zap-hit": () => L(import("@/lib/pixelfx/fx/lightning/zap-hit.js")),
  "lightning/lightning-strike": () => L(import("@/lib/pixelfx/fx/lightning/lightning-strike.js")),
  "lightning/ball-lightning": () => L(import("@/lib/pixelfx/fx/lightning/ball-lightning.js")),
  "explosions/small-explosion": () => L(import("@/lib/pixelfx/fx/explosions/small-explosion.js")),
  "explosions/big-explosion": () => L(import("@/lib/pixelfx/fx/explosions/big-explosion.js")),
  "explosions/dirt-explosion": () => L(import("@/lib/pixelfx/fx/explosions/dirt-explosion.js")),
  "explosions/plasma-explosion": () => L(import("@/lib/pixelfx/fx/explosions/plasma-explosion.js")),
  "explosions/cartoon-pow": () => L(import("@/lib/pixelfx/fx/explosions/cartoon-pow.js")),
  "water/splash": () => L(import("@/lib/pixelfx/fx/water/splash.js")),
  "water/geyser": () => L(import("@/lib/pixelfx/fx/water/geyser.js")),
  "water/water-orb": () => L(import("@/lib/pixelfx/fx/water/water-orb.js")),
  "nature/spore-burst": () => L(import("@/lib/pixelfx/fx/nature/spore-burst.js")),
  "nature/acid-splash": () => L(import("@/lib/pixelfx/fx/nature/acid-splash.js")),
  "nature/healing-bloom": () => L(import("@/lib/pixelfx/fx/nature/healing-bloom.js")),
  "ice/snowflake-burst": () => L(import("@/lib/pixelfx/fx/ice/snowflake-burst.js")),
  "ice/ice-shatter": () => L(import("@/lib/pixelfx/fx/ice/ice-shatter.js")),
  "ice/ice-lance": () => L(import("@/lib/pixelfx/fx/ice/ice-lance.js")),
  "shadow/dark-explosion": () => L(import("@/lib/pixelfx/fx/shadow/dark-explosion.js")),
  "shadow/void-orb": () => L(import("@/lib/pixelfx/fx/shadow/void-orb.js")),
  "arcane/mana-burst": () => L(import("@/lib/pixelfx/fx/arcane/mana-burst.js")),
  "arcane/star-fall": () => L(import("@/lib/pixelfx/fx/arcane/star-fall.js")),
  "holy/feather-burst": () => L(import("@/lib/pixelfx/fx/holy/feather-burst.js")),
  "holy/smite": () => L(import("@/lib/pixelfx/fx/holy/smite.js")),
  "scifi/emp-blast": () => L(import("@/lib/pixelfx/fx/scifi/emp-blast.js")),
  "spawn/poof": () => L(import("@/lib/pixelfx/fx/spawn/poof.js")),
  "spawn/soul-rise": () => L(import("@/lib/pixelfx/fx/spawn/soul-rise.js")),
  "spawn/shatter-death": () => L(import("@/lib/pixelfx/fx/spawn/shatter-death.js")),
  "spawn/respawn-beam": () => L(import("@/lib/pixelfx/fx/spawn/respawn-beam.js")),
  "spawn/spawn-portal": () => L(import("@/lib/pixelfx/fx/spawn/spawn-portal.js")),
  "pickups/collect-burst": () => L(import("@/lib/pixelfx/fx/pickups/collect-burst.js")),
  "pickups/potion": () => L(import("@/lib/pixelfx/fx/pickups/potion.js")),
  "pickups/heart-pickup": () => L(import("@/lib/pixelfx/fx/pickups/heart-pickup.js")),
  "pickups/power-star": () => L(import("@/lib/pixelfx/fx/pickups/power-star.js")),
  "pickups/xp-orb": () => L(import("@/lib/pixelfx/fx/pickups/xp-orb.js")),
  "pickups/loot-beam": () => L(import("@/lib/pixelfx/fx/pickups/loot-beam.js")),
  "pickups/chest-open": () => L(import("@/lib/pixelfx/fx/pickups/chest-open.js")),
  "projectiles/plasma-shot": () => L(import("@/lib/pixelfx/fx/projectiles/plasma-shot.js")),
  "projectiles/energy-disc": () => L(import("@/lib/pixelfx/fx/projectiles/energy-disc.js")),
  "projectiles/magic-missile": () => L(import("@/lib/pixelfx/fx/projectiles/magic-missile.js")),
  "projectiles/laser-bolt": () => L(import("@/lib/pixelfx/fx/projectiles/laser-bolt.js")),
  "fire/fireball": () => L(import("@/lib/pixelfx/fx/fire/fireball.js")),
  "status/burning": () => L(import("@/lib/pixelfx/fx/status/burning.js")),
  "status/frozen": () => L(import("@/lib/pixelfx/fx/status/frozen.js")),
  "status/poisoned": () => L(import("@/lib/pixelfx/fx/status/poisoned.js")),
  "status/stunned": () => L(import("@/lib/pixelfx/fx/status/stunned.js")),
  "status/sleep": () => L(import("@/lib/pixelfx/fx/status/sleep.js")),
  "status/confused": () => L(import("@/lib/pixelfx/fx/status/confused.js")),
  "status/haste": () => L(import("@/lib/pixelfx/fx/status/haste.js")),
  "status/charmed": () => L(import("@/lib/pixelfx/fx/status/charmed.js")),
  "status/cursed": () => L(import("@/lib/pixelfx/fx/status/cursed.js")),
  "status/rage": () => L(import("@/lib/pixelfx/fx/status/rage.js")),
  "status/slowed": () => L(import("@/lib/pixelfx/fx/status/slowed.js")),
  "weather/rain": () => L(import("@/lib/pixelfx/fx/weather/rain.js")),
  "weather/snow": () => L(import("@/lib/pixelfx/fx/weather/snow.js")),
  "weather/blizzard": () => L(import("@/lib/pixelfx/fx/weather/blizzard.js")),
  "weather/storm": () => L(import("@/lib/pixelfx/fx/weather/storm.js")),
  "weather/fog": () => L(import("@/lib/pixelfx/fx/weather/fog.js")),
  "weather/god-rays": () => L(import("@/lib/pixelfx/fx/weather/god-rays.js")),
  "ui/combo-counter": () => L(import("@/lib/pixelfx/fx/ui/combo-counter.js")),
  "ui/quest-complete": () => L(import("@/lib/pixelfx/fx/ui/quest-complete.js")),
};
export type PxId = keyof typeof LOAD;

export type PxOpts = {
  /** World units per effect pixel. */
  scale: number;
  flip?: boolean;
  angle?: number;
  /** Recolour it with a dark-to-bright ramp made from this colour. */
  tint?: string;
  /** Play faster (long effects have slow tails). */
  speed?: number;
  /** Stop after this many seconds (it fades out). */
  max?: number;
  /** Lift it off the floor (body height), in world units. */
  lift?: number;
  /** Extra options for the effect itself (a label, a count…). */
  extra?: Record<string, unknown>;
};

const cache = new Map<string, Mod>();
const loading = new Set<string>();

/** Start loading effects so the first one of a match doesn't wait. With no list it loads the small, common ones. */
export function preloadPixelfx(ids?: string[]) {
  for (const id of ids ?? Object.keys(LOAD).filter((k) => !k.startsWith("weather/"))) {
    if (cache.has(id) || loading.has(id)) continue;
    loading.add(id);
    LOAD[id]!().then((m) => cache.set(id, m)).catch(() => {}).finally(() => loading.delete(id));
  }
}

const hx = (s: string) => {
  const n = parseInt(s.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
/** Colours from near-black to white that pass through the given colour in the middle. */
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

/** A stand-in body for the status marks to hug: a plump creature, 26 x 30 pixels, feet at the origin. */
let BLOB: unknown = null;
function blobActor() {
  if (BLOB) return BLOB;
  const w = 26, h = 30, data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const bx = (x - 12.5) / 12.5, by = (y - 19.5) / 10.5; // the body
      const hx2 = (x - 12.5) / 7.5, hy = (y - 7.5) / 7.5; // the head
      if (bx * bx + by * by <= 1 || hx2 * hx2 + hy * hy <= 1) data[y * w + x] = 1;
    }
  BLOB = { mask: { w, h, data }, pixels: null, x: -13, y: -h, w, h, k: 2, head: [0, -h], chest: [0, -16] };
  return BLOB;
}

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

/** A loop drawn once into a strip of frames. */
export type Sheet = {
  key: string;
  w: number;
  h: number;
  ox: number;
  oy: number;
  n: number;
  fps: number;
  frames: HTMLCanvasElement[];
  ready: boolean;
  bad: boolean;
  fx: ReturnType<typeof createFx> | null;
  frame: ReturnType<typeof createFrame> | null;
  img: ImageData | null;
  mod: Mod;
  step: number;
};

const STEP = 1 / 30;
const MAX_SHEETS = 40;

export class PixelFxLayer {
  live: Live[] = [];
  sheets = new Map<string, Sheet>();
  private queue: Sheet[] = [];

  /** 0: everything. 1: no weather. 2: also no status marks or pickups, fewer one-shots. 3: only shots and hits. */
  tier = 0;
  private ema = 16;
  private slowFor = 0;
  private fastFor = 0;
  /** Milliseconds spent by this layer in the last second, for a quick check. */
  ms = 0;
  private msAcc = 0;
  private msT = 0;

  get cap() {
    return [8, 6, 4, 3][this.tier]!;
  }

  /** Watch the real frame time and move between tiers. Call once a frame with the real elapsed seconds. */
  govern(dtRaw: number) {
    if (!(dtRaw > 0) || dtRaw > 0.5) return; // a pause or a tab switch says nothing
    this.ema += (dtRaw * 1000 - this.ema) * 0.06;
    if (this.ema > 26) {
      this.slowFor += dtRaw;
      this.fastFor = 0;
      if (this.slowFor > 1.2 && this.tier < 3) {
        this.tier++;
        this.slowFor = 0;
        this.trim();
      }
    } else if (this.ema < 19) {
      this.fastFor += dtRaw;
      this.slowFor = 0;
      if (this.fastFor > 8 && this.tier > 0) {
        this.tier--;
        this.fastFor = 0;
      }
    } else {
      this.slowFor = this.fastFor = 0;
    }
  }

  private trim() {
    while (this.live.length > this.cap) this.live.shift();
    if (this.tier >= 1) this.weather = null;
  }

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
    const opts: Record<string, unknown> = { x: ox, y: oy, seed: (Math.random() * 1e6) | 0, flip: !!o.flip, angle: o.angle ?? 0, ...(o.extra ?? {}) };
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
    while (this.live.length > this.cap) this.live.shift();
  }

  /* ------------------------------------------------------------ sheets */

  /**
   * The looping effect `id`, drawn into frames. Returns it at once; `ready` turns true once every frame is drawn
   * (a frame or two at a time, see pump). `blob` makes the status marks hug a stand-in body.
   */
  sheet(id: PxId, tint?: string): Sheet | null {
    const key = id + "|" + (tint ?? "");
    const got = this.sheets.get(key);
    if (got) return got.bad ? null : got;
    const mod = cache.get(id);
    if (!mod) {
      preloadPixelfx([id]);
      return null;
    }
    if (typeof document === "undefined" || this.sheets.size >= MAX_SHEETS) return null;
    const [w, h] = mod.meta.size;
    const [ox, oy] = mod.meta.origin;
    const n = Math.max(8, Math.min(24, Math.round(mod.meta.duration * 12)));
    const opts: Record<string, unknown> = { x: ox, y: oy, seed: 3 };
    if (mod.meta.actor) opts.actor = blobActor();
    if (tint && mod.meta.options?.palette) opts.palette = rampOf(tint, mod.meta.options.palette.length);
    let fx: ReturnType<typeof createFx> | null = null;
    try {
      fx = createFx(mod, opts);
    } catch {
      fx = null;
    }
    const sh: Sheet = { key, w, h, ox, oy, n, fps: n / mod.meta.duration, frames: [], ready: false, bad: !fx, fx, frame: fx ? createFrame(w, h) : null, img: fx ? new ImageData(w, h) : null, mod, step: 0 };
    this.sheets.set(key, sh);
    if (fx) this.queue.push(sh);
    return sh.bad ? null : sh;
  }

  /** Draw frames of the sheets that are still being made, for at most `ms` milliseconds (always at least one). */
  pump(ms: number) {
    const t0 = performance.now();
    while (this.queue.length) {
      const sh = this.queue[0]!;
      try {
        const sub = sh.mod.meta.duration / sh.n;
        for (let u = sub; u > 1e-6; u -= STEP) sh.fx!.update(Math.min(STEP, u)); // advance in small steps, as the effect expects
        clearFrame(sh.frame);
        sh.fx!.draw(sh.frame);
        composite(sh.frame, sh.img!.data, null);
        const cv = document.createElement("canvas");
        cv.width = sh.w;
        cv.height = sh.h;
        cv.getContext("2d")!.putImageData(sh.img!, 0, 0);
        sh.frames.push(cv);
      } catch {
        sh.bad = true;
        this.queue.shift();
        continue;
      }
      if (sh.frames.length >= sh.n) {
        sh.ready = true;
        sh.fx = sh.frame = sh.img = null;
        this.queue.shift();
      }
      if (performance.now() - t0 >= ms) break;
    }
    this.msAcc += performance.now() - t0;
  }

  /** Draw a ready sheet at the current origin: its own origin lands there, `k` world units per pixel, `t` seconds into the loop. */
  drawSheet(g: CanvasRenderingContext2D, sh: Sheet, t: number, k: number, angle = 0, flip = false, dx = 0, dy = 0) {
    if (!sh.ready) return false;
    const f = sh.frames[Math.floor(t * sh.fps) % sh.n]!;
    g.save();
    g.imageSmoothingEnabled = false;
    if (angle) g.rotate(angle);
    if (flip) g.scale(-1, 1);
    g.drawImage(f, -sh.ox * k + dx, -sh.oy * k + dy, sh.w * k, sh.h * k);
    g.restore();
    return true;
  }

  /* ------------------------------------------------------------ weather */

  private weather: { id: string; fx: ReturnType<typeof createFx>; frame: ReturnType<typeof createFrame>; img: ImageData; cv: HTMLCanvasElement; cx: CanvasRenderingContext2D; acc: number } | null = null;
  private weatherId = "";

  /** Which weather to run (null for none). It only runs at tier 0. */
  setWeather(id: PxId | null, tint?: string) {
    const want = this.tier === 0 && id ? id + "|" + (tint ?? "") : "";
    if (want === this.weatherId) return;
    this.weatherId = want;
    this.weather = null;
    if (!want || !id || typeof document === "undefined") return;
    const mod = cache.get(id);
    if (!mod) {
      preloadPixelfx([id]);
      this.weatherId = ""; // try again next time
      return;
    }
    const [w, h] = mod.meta.size;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d");
    if (!cx) return;
    const opts: Record<string, unknown> = { x: mod.meta.origin[0], y: mod.meta.origin[1], seed: 11 };
    if (tint && mod.meta.options?.palette) opts.palette = rampOf(tint, mod.meta.options.palette.length);
    this.weather = { id, fx: createFx(mod, opts), frame: createFrame(w, h), img: new ImageData(w, h), cv, cx, acc: 1 };
  }

  get hasWeather() {
    return !!this.weather && this.tier === 0;
  }

  /** The weather over the whole screen (the picture is stretched across it). */
  drawWeather(g: CanvasRenderingContext2D, W: number, H: number, alpha = 1) {
    const wx = this.weather;
    if (!wx || this.tier > 0) return;
    g.save();
    g.imageSmoothingEnabled = false;
    g.globalAlpha *= alpha;
    g.drawImage(wx.cv, 0, 0, W, H);
    g.restore();
  }

  /* ------------------------------------------------------------ update and draw */

  update(dt: number) {
    const t0 = performance.now();
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
    const wx = this.weather;
    if (wx && this.tier === 0) {
      wx.acc += dt;
      if (wx.acc >= 0.1) {
        // weather moves slowly: ten pictures a second is plenty, and it is the costliest thing here
        wx.fx.update(Math.min(wx.acc, 0.2));
        wx.acc = 0;
        clearFrame(wx.frame);
        wx.fx.draw(wx.frame);
        composite(wx.frame, wx.img.data, null);
        wx.cx.putImageData(wx.img, 0, 0);
      }
    }
    this.msAcc += performance.now() - t0;
    this.msT += dt;
    if (this.msT >= 1) {
      this.ms = this.msAcc / this.msT;
      this.msAcc = this.msT = 0;
    }
  }

  private paint(l: Live) {
    if (!l.dirty) return;
    const t0 = performance.now();
    clearFrame(l.frame);
    l.fx.draw(l.frame);
    composite(l.frame, l.img.data, null);
    l.cx.putImageData(l.img, 0, 0);
    l.dirty = false;
    this.msAcc += performance.now() - t0;
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
    this.weather = null;
    this.weatherId = "";
  }
}
