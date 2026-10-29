/**
 * Draws an Arena Brawl fight on a canvas. It reads the engine's state and turns the engine's events into the
 * extras that make it feel good: sparks, rings, floating numbers, screen shake, a slow-motion tint.
 */
import { decodeGif, frameAt, type GifFrames } from "./gif-frames";
import { ARENA, type Ev, type Fighter, type Proj, type State } from "@/lib/pokemon/arena-engine";
import { blob, drawHole, drawLightning, drawObstacle, drawPool, drawShot, stageBackground } from "@/components/pokemon/arena-art";
import { FIELDS, ITEMS, MOVES, moveReach, type MoveDef } from "@/lib/pokemon/arena-data";
import { TYPE_COLOR, spriteChain } from "@/lib/pokemon/shared";

type Parti = { kind: "dot" | "streak" | "ring" | "glow" | "smoke" | "text" | "puff" | "plank" | "crack" | "bolt" | "shard" | "star" | "arc" | "cross"; x2?: number; y2?: number; seed?: number; rot?: number; vr?: number; edge?: string; x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; grow: number; color: string; text?: string; weight?: number };

const col = (t: string) => TYPE_COLOR[t] ?? "#ffffff";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeOutBack = (k: number) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
const smooth = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

type Pic = HTMLImageElement | HTMLCanvasElement;
const picW = (p: Pic) => (p instanceof HTMLImageElement ? p.naturalWidth : p.width) || 96;
const picH = (p: Pic) => (p instanceof HTMLImageElement ? p.naturalHeight : p.height) || 96;

export type SpriteSource = (id: string, num: number) => string[];
const probe = spriteChain({ id: "pikachu", num: 25 }, { still: true });
const defaultSources: SpriteSource = (id, num) => {
  if (id.includes("-")) {
    // Mega and Gigantamax forms live only in some folders of the picture server; try each name they might have
    const flat = id.replace(/-/g, "");
    const dex = (probe[0] ?? "").replace("pikachu", id);
    const gen5 = (probe[1] ?? "").replace("pikachu", id);
    const ani = dex.replace("/dex/", "/ani/").replace(".png", ".gif");
    return [dex, gen5, ani, dex.replace(id, flat), ani.replace(id, flat)].filter((u) => u.length > 10);
  }
  const chain = spriteChain({ id, num }, { still: true });
  // pixel sprites first (they match the arena), then the larger pictures
  const ani = chain[0]!.replace("/dex/", "/ani/").replace(".png", ".gif");
  return [chain[1], chain[0], ...chain.slice(2), ani].filter(Boolean) as string[];
};

/** One colour per seat in a multiplayer fight, so every name can be told apart. */
const NAME_COLORS = ["#ff8a8a", "#74c0fc", "#ffe066", "#d0bfff", "#69dbb2"];

export class ArenaRenderer {
  private ctx: CanvasRenderingContext2D;
  private parts: Parti[] = [];
  private shake = 0;
  private shakeT = 0;
  private zoomPulse = 0;
  private flashT = 0;
  private perfectT = 0;
  private imgs = new Map<string, HTMLImageElement | "fail" | "loading">();
  private tints = new WeakMap<object, Map<string, HTMLCanvasElement>>();
  /** Animated (limb-moving) sprites, front and back views, and how far each fighter's animation has played. */
  private anims = new Map<string, GifFrames | HTMLImageElement | "loading" | "fail">();
  private poses = new Map<number, { clock: number; atk: number; atkDir: number; hurt: number; hx: number; hy: number; aura?: { c: string; t: number } }>();
  private dtr = 0;
  /** Scorch marks left on the floor by blasts; they fade slowly. */
  private clones = new Map<number, number>();
  /** Rocks lifted off the floor by a psychic pulse. */
  private rocks: { x: number; y: number; h: number; hMax: number; rot: number; vr: number; size: number; t: number; max: number; seed: number }[] = [];
  private scorch: { x: number; y: number; r: number; seed: number; t: number; max: number; type: string }[] = [];
  private later: { t: number; fn: () => void }[] = [];
  private failAt = new Map<string, number>();
  private t = 0;
  private scale = 1;
  private banner: { text: string; t: number; color: string } | null = null;
  /** The "ULTIMATE ATTACK" band that sweeps across the screen. */
  private ultBanner: { sub: string; t: number; color: string } | null = null;
  /** The aim line or circle shown while a move is being aimed, and the reticle under the mouse. */
  private aimShow: { from: Fighter; mv: MoveDef; x: number; y: number } | null = null;
  private reticle: { x: number; y: number } | null = null;
  private zoom = 1;
  /** The Z-Move cinematic playing right now. */
  private z: { t: number; name: string; type: string; x: number; y: number } | null = null;
  /** A transformation in progress for a fighter: the old body, a build-up, then the new one. */
  private morphs = new Map<number, { kind: "mega" | "dyna" | "tera" | "awaken"; t: number; max: number; swap: number; color: string; z?: boolean; gmax?: boolean }>();
  private hist = new Map<number, { x: number; y: number }[]>();
  private debris: { x: number; y: number; seed: number; t: number }[] = [];
  private camX = ARENA.CX;
  private camY = ARENA.CY;

  constructor(readonly canvas: HTMLCanvasElement, private sources: SpriteSource = defaultSources) {
    this.ctx = canvas.getContext("2d")!;
  }

  /** Fit the drawing to the size the page gives the canvas, crisp on high-density screens. */
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || ARENA.W;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(w * (ARENA.H / ARENA.W) * dpr);
    this.scale = this.canvas.width / ARENA.W;
  }

  /** How close the view is: 1 shows the whole floor, more follows the player, less shows the stands around it. */
  setZoom(z: number) {
    this.zoom = Math.max(0.8, Math.min(2.2, z));
  }
  getZoom() {
    return this.zoom;
  }
  /** Turns a point on the canvas (in arena units, 0–960 by 0–600) into a place on the floor, whatever the zoom. */
  toWorld(px: number, py: number) {
    return { x: this.camX + (px - ARENA.CX) / this.zoom, y: this.camY + (py - ARENA.CY) / this.zoom };
  }
  private toCanvas(x: number, y: number) {
    return { x: (x - this.camX) * this.zoom + ARENA.CX, y: (y - this.camY) * this.zoom + ARENA.CY };
  }
  private followCamera(you: Fighter | undefined, dt: number) {
    let tx = ARENA.CX;
    let ty = ARENA.CY;
    if (this.zoom > 1 && you) {
      const hw = ARENA.W / (2 * this.zoom);
      const hh = ARENA.H / (2 * this.zoom);
      tx = Math.max(hw, Math.min(ARENA.W - hw, you.x));
      ty = Math.max(hh, Math.min(ARENA.H - hh, you.y));
    }
    const k = 1 - Math.exp(-dt * 9);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
  }

  /* --------------------------------------------------------------- the floor */

  /* ------------------------------------------------------------------ sprites */

  private load(id: string, num: number): HTMLImageElement | null {
    const hit = this.imgs.get(id);
    if (hit instanceof HTMLImageElement) return hit;
    if (hit === "fail" && performance.now() - (this.failAt.get(id) ?? 0) > 4000) this.imgs.delete(id); // try again now and then
    else if (hit) return null;
    this.imgs.set(id, "loading");
    const urls = this.sources(id, num);
    // every address is tried at the same time; the best one that works wins, so one slow or missing file does not hold the rest up
    const got: (HTMLImageElement | null | undefined)[] = urls.map(() => undefined);
    let done = false;
    const settle = () => {
      if (done) return;
      for (let k = 0; k < got.length; k++) {
        if (got[k] === undefined) return; // a better one may still arrive
        if (got[k]) {
          done = true;
          this.imgs.set(id, got[k]!);
          return;
        }
      }
      done = true;
      this.imgs.set(id, "fail");
      this.failAt.set(id, performance.now());
      console.warn("[arena] no picture could be loaded for", id, urls);
    };
    urls.forEach((u, k) => {
      const im = new Image();
      im.onload = () => {
        got[k] = im;
        // do not wait for the better ones forever: after a moment, take what has arrived
        if (!done) {
          setTimeout(() => {
            if (done) return;
            const first = got.findIndex((x) => x);
            if (first >= 0) {
              done = true;
              this.imgs.set(id, got[first]!);
            }
          }, 900);
        }
        settle();
      };
      im.onerror = () => {
        got[k] = null;
        settle();
      };
      im.src = u;
    });
    return null;
  }

  /** The animated sprite (the one that really moves its legs, wings and tail), loaded once; null until it is ready. */
  private loadAnim(id: string, back: boolean): GifFrames | HTMLImageElement | null {
    const key = `${id}|${back ? "b" : "f"}`;
    const hit = this.anims.get(key);
    if (hit && typeof hit === "object") return hit;
    if (hit === "fail" && performance.now() - (this.failAt.get(key) ?? 0) > 6000) this.anims.delete(key);
    else if (hit) return null;
    this.anims.set(key, "loading");
    const direct = spriteChain({ id }, { back })[0];
    // first through this site (works in every browser), then straight from the picture server
    const url = `/api/sprite?k=${back ? "ani-back" : "ani"}&id=${encodeURIComponent(id)}`;
    const fail = () => {
      this.anims.set(key, "fail");
      this.failAt.set(key, performance.now());
    };
    if (!direct) {
      fail();
      return null;
    }
    // the browser's own animated picture: needs no permission from the picture server, and plays by itself
    const viaImg = () => {
      const im = new Image();
      im.onload = () => this.anims.set(key, im);
      im.onerror = fail;
      im.src = direct ?? url;
    };
    const get = (u: string) => fetch(u).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("http"))));
    if (typeof fetch !== "function") viaImg();
    else
      get(url)
        .catch(() => get(direct!))
        .then((b) => this.anims.set(key, decodeGif(b)))
        .catch(viaImg);
    return null;
  }

  /** A solid-colour copy of a sprite (for the white hit flash and the freeze tint), made once. */
  private tinted(_id: string, im: Pic, color: string): HTMLCanvasElement {
    if (im instanceof HTMLImageElement && /\.gif/.test(im.src)) {
      // a picture the browser animates itself changes every moment, so it is tinted fresh each time
      const c = document.createElement("canvas");
      c.width = picW(im);
      c.height = picH(im);
      const g = c.getContext("2d")!;
      g.drawImage(im, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = color;
      g.fillRect(0, 0, c.width, c.height);
      return c;
    }
    let m = this.tints.get(im);
    if (!m) this.tints.set(im, (m = new Map()));
    let c = m.get(color);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = picW(im);
    c.height = picH(im);
    const g = c.getContext("2d")!;
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
    return c;
  }

  /* ------------------------------------------------------------------- events */

  /** What the player is aiming right now (null for nothing). The picture is drawn with the next frame. */
  setAim(show: { from: Fighter; mv: MoveDef; x: number; y: number } | null, reticle: { x: number; y: number } | null = null) {
    this.aimShow = show;
    this.reticle = reticle;
  }

  ultimate(sub: string, color = "#ffd54a") {
    this.ultBanner = { sub, t: 1.7, color };
  }

  say(text: string, color = "#ffffff") {
    this.banner = { text, t: 1.6, color };
  }

  private burst(x: number, y: number, color: string, n: number, speed: number, kind: Parti["kind"] = "dot") {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rnd(speed * 0.4, speed);
      this.parts.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 160, life: rnd(0.35, 0.8), max: 0.8, size: rnd(2, 5), grow: 0, color: i % 4 === 0 ? "#fff" : color });
    }
  }

  private ring(x: number, y: number, color: string, r: number, life = 0.5) {
    this.parts.push({ kind: "ring", x, y, vx: 0, vy: 0, g: 0, life, max: life, size: 8, grow: r / life, color });
  }

  private pop(x: number, y: number, text: string, color: string, size = 16, weight = 800) {
    this.parts.push({ kind: "text", x, y: y - 24, vx: rnd(-14, 14), vy: -70, g: 90, life: 0.95, max: 0.95, size, grow: 0, color, text, weight });
  }

  feed(events: Ev[], mine: Fighter | undefined) {
    for (const e of events) {
      switch (e.t) {
        case "cast": {
          const ps = this.poses.get(e.id) ?? { clock: 0, atk: 0, atkDir: 0, hurt: 0, hx: 0, hy: 0 };
          ps.atk = 0.32;
          ps.atkDir = e.dir;
          this.poses.set(e.id, ps);
          this.specialCast(e);
        }
          this.ring(e.x, e.y, col(e.type), 44, 0.35);
          this.burst(e.x, e.y, col(e.type), 6, 120);
          break;
        case "hit": {
          const c = col(e.type);
          if (e.dmg > 0) {
            const ps = this.poses.get(e.id) ?? { clock: 0, atk: 0, atkDir: 0, hurt: 0, hx: 0, hy: 0 };
            ps.hurt = 0.26;
            if (e.type === "Psychic" || e.type === "Ghost" || e.type === "Fairy") ps.aura = { c: e.type === "Ghost" ? "#b58cff" : "#ff8be4", t: 0.7 };
            ps.hx = e.dx;
            ps.hy = e.dy;
            this.poses.set(e.id, ps);
          }
          this.burst(e.x, e.y, c, e.heavy ? 18 : 9, e.heavy ? 280 : 190);
          for (let i = 0; i < (e.heavy ? 8 : 3); i++) {
            const a = Math.atan2(e.dy, e.dx) + rnd(-0.6, 0.6);
            const v = rnd(200, 420);
            this.parts.push({ kind: "streak", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: 0.3, max: 0.3, size: rnd(5, 9), grow: 0, color: i % 2 ? "#fff" : c });
          }
          if (e.dmg === 0) {
            this.pop(e.x, e.y, e.toPlayer ? "CRYSTAL" : "BLOCKED", "#8fd8ff", 13, 800);
            break;
          }
          const mag = e.crit ? 24 : e.heavy ? 19 : 15;
          const color = e.toPlayer ? "#ff6a6a" : e.crit ? "#ffd54a" : e.eff > 1 ? "#ff9a3c" : e.eff < 1 ? "#a8b3c2" : "#ffffff";
          this.pop(e.x, e.y, `${e.dmg}${e.crit ? "!" : ""}`, color, mag);
          if (e.eff > 1 && !e.toPlayer) this.pop(e.x + 8, e.y - 12, "SUPER", "#ffb066", 11, 700);
          if (e.eff === 0 && !e.toPlayer) this.pop(e.x, e.y - 12, "NO EFFECT", "#9aa6b5", 11, 700);
          if (e.toPlayer || e.heavy) {
            this.shake = Math.max(this.shake, e.toPlayer ? 9 : 6);
            this.shakeT = 0.22;
          }
          break;
        }
        case "explode": {
          const c = col(e.type);
          this.ring(e.x, e.y, c, e.r * 1.1, 0.45);
          this.parts.push({ kind: "glow", x: e.x, y: e.y, vx: 0, vy: 0, g: 0, life: 0.4, max: 0.4, size: e.r, grow: e.r * 0.8, color: c });
          this.burst(e.x, e.y, c, Math.round(8 + e.r / 8), 120 + e.r * 2.2);
          if (e.r >= 100) {
            this.shake = Math.max(this.shake, 8);
            this.shakeT = 0.3;
          }
          this.moveFx(e);
          if (e.r >= 55) {
            // dust, rubble and a dark scorch mark, as in the video
            for (let i = 0; i < Math.round(3 + e.r / 28); i++) this.parts.push({ kind: "smoke", x: e.x + rnd(-e.r * 0.4, e.r * 0.4), y: e.y + rnd(-e.r * 0.25, e.r * 0.25), vx: rnd(-40, 40), vy: rnd(-70, -20), g: 0, life: rnd(0.7, 1.2), max: 1.2, size: rnd(9, 16), grow: 30, color: i % 2 ? "#cfc2aa" : "#9a8f80" });
            for (let i = 0; i < Math.round(e.r / 22); i++) this.parts.push({ kind: "plank", x: e.x, y: e.y, vx: rnd(-220, 220), vy: rnd(-380, -120), g: 900, life: rnd(0.5, 0.9), max: 0.9, size: rnd(2.5, 5), grow: 0, color: i % 2 ? "#6b5b4a" : "#8c7b66", rot: rnd(0, 6), vr: rnd(-14, 14) });
            this.scorch.push({ x: e.x, y: e.y, r: e.r * 0.62, seed: Math.random() * 100, t: 9, max: 9, type: e.type });
            if (this.scorch.length > 28) this.scorch.shift();
          }
          break;
        }
        case "crate": {
          if (e.kind && e.kind !== "crate") {
            // a rock, pillar or crystal crumbles: a heavy cloud of dust, chunks, and rubble that stays
            const chunk = e.kind === "crystal" ? "#a98bff" : "#8a8f99";
            for (let i = 0; i < 16; i++) {
              const a = rnd(0, Math.PI * 2);
              const v = rnd(120, 360);
              this.parts.push({ kind: "plank", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, g: 700, life: rnd(0.7, 1.3), max: 1.3, size: rnd(4, 8), grow: 0, color: i % 3 ? chunk : "#5b606b", rot: rnd(0, 6), vr: rnd(-12, 12) });
            }
            for (let i = 0; i < 11; i++) this.parts.push({ kind: "smoke", x: e.x + rnd(-16, 16), y: e.y + rnd(-10, 10), vx: rnd(-50, 50), vy: rnd(-80, -20), g: 0, life: rnd(0.9, 1.5), max: 1.5, size: rnd(12, 22), grow: 34, color: i % 2 ? "#cfc2aa" : "#9a8f80" });
            this.debris.push({ x: e.x, y: e.y, seed: Math.random() * 5, t: 20 });
            this.scorch.push({ x: e.x, y: e.y, r: 34, seed: Math.random() * 100, t: 14, max: 14, type: "Rock" });
            this.shake = Math.max(this.shake, 7);
            this.shakeT = 0.3;
            break;
          }
          for (let i = 0; i < 11; i++) {
            const a = rnd(0, Math.PI * 2);
            const v = rnd(90, 300);
            this.parts.push({ kind: "plank", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 420, life: rnd(0.6, 1.2), max: 1.2, size: rnd(3.5, 6), grow: 0, color: i % 3 ? "#b9854a" : "#7a4f26", rot: rnd(0, 6), vr: rnd(-12, 12) });
          }
          for (let i = 0; i < 7; i++) this.parts.push({ kind: "smoke", x: e.x + rnd(-10, 10), y: e.y + rnd(-6, 8), vx: rnd(-50, 50), vy: rnd(-40, 10), g: 0, life: 0.6, max: 0.6, size: rnd(7, 12), grow: 26, color: "#d6c3a0" });
          this.debris.push({ x: e.x, y: e.y, seed: Math.random() * 5, t: 6 });
          this.shake = Math.max(this.shake, 3);
          this.shakeT = 0.15;
          break;
        }
        case "fall":
          this.pop(e.x, e.y - 8, "FELL IN!", "#9ad0ff", 14, 900);
          for (let i = 0; i < 12; i++) this.parts.push({ kind: "smoke", x: e.x + rnd(-14, 14), y: e.y + rnd(-4, 10), vx: rnd(-40, 40), vy: rnd(-70, -10), g: 0, life: 0.7, max: 0.7, size: 8, grow: 22, color: "#8892b0" });
          this.shake = Math.max(this.shake, e.player ? 8 : 4);
          this.shakeT = 0.25;
          break;
        case "dig":
          if (e.phase === "down") {
            for (let i = 0; i < 16; i++) this.parts.push({ kind: "dot", x: e.x + rnd(-14, 14), y: e.y + rnd(0, 14), vx: rnd(-90, 90), vy: rnd(-200, -60), g: 520, life: rnd(0.4, 0.8), max: 0.8, size: rnd(2.5, 5), grow: 0, color: i % 2 ? "#7a5a3b" : "#a98660" });
            this.ring(e.x, e.y + 8, "#a98660", 50, 0.45);
          } else {
            for (let i = 0; i < 26; i++) this.parts.push({ kind: "dot", x: e.x + rnd(-18, 18), y: e.y + rnd(-6, 10), vx: rnd(-220, 220), vy: rnd(-340, -80), g: 620, life: rnd(0.6, 1.0), max: 1.0, size: rnd(3, 6.5), grow: 0, color: i % 2 ? "#7a5a3b" : "#c2a074" });
            this.ring(e.x, e.y, "#d9b98a", 120, 0.6);
            this.scorch.push({ x: e.x, y: e.y, r: 38, seed: Math.random() * 100, t: 10, max: 10, type: "Rock" });
            for (let i = 0; i < 9; i++) {
              const a = (i / 9) * Math.PI * 2 + rnd(-0.2, 0.2);
              this.parts.push({ kind: "crack", x: e.x, y: e.y, vx: 0, vy: 0, g: 0, life: 1.1, max: 1.1, size: 1, grow: 0, color: "#000", x2: e.x + Math.cos(a) * 85, y2: e.y + Math.sin(a) * 60, seed: 3 + i });
            }
            this.shake = Math.max(this.shake, 9);
            this.shakeT = 0.35;
          }
          break;
        case "stage":
          this.say({ grass: "GRASS PITCH", stone: "STONE ARENA", dirt: "DIRT FIELD", crystal: "CRYSTAL CAVE" }[e.kind], "#ffffff");
          break;
        case "dodge":
          for (let i = 0; i < 8; i++) this.parts.push({ kind: "smoke", x: e.x + rnd(-8, 8), y: e.y + rnd(0, 14), vx: rnd(-40, 40), vy: rnd(-30, 10), g: 0, life: 0.5, max: 0.5, size: rnd(8, 14), grow: 22, color: "#cfd8e8" });
          break;
        case "perfect":
          this.perfectT = 0.8;
          this.ring(e.x, e.y, "#7fe3ff", 150, 0.6);
          this.pop(e.x, e.y - 30, "PERFECT DODGE!", "#7fe3ff", 20, 900);
          break;
        case "ko": {
          const c = col(e.type);
          this.burst(e.x, e.y, c, e.boss ? 60 : 30, e.boss ? 460 : 340);
          this.ring(e.x, e.y, "#fff", e.boss ? 260 : 150, 0.6);
          this.ring(e.x, e.y, c, e.boss ? 200 : 110, 0.8);
          this.shake = e.boss ? 16 : 10;
          this.shakeT = 0.4;
          this.zoomPulse = 1;
          this.flashT = e.boss || e.player ? 0.25 : 0;
          break;
        }
        case "combo":
          if (mine) this.pop(mine.x, mine.y - 38, e.finish ? "COMBO FINISH!" : `COMBO ×${e.n}`, e.finish ? "#ffd54a" : "#ffffff", e.finish ? 20 : 16, 900);
          break;
        case "awaken":
          if (mine?.id === e.id) this.ultimate("Awakening", "#ffe08a");
          this.morphs.set(e.id, { kind: "awaken", t: 0, max: 0.6, swap: 0.2, color: "#ffe08a" });
          this.ring(e.x, e.y, "#fff2a8", 260, 0.7);
          this.ring(e.x, e.y, "#ffcf4d", 190, 0.9);
          this.burst(e.x, e.y, "#ffe08a", 40, 420);
          this.shake = 14;
          this.shakeT = 0.45;
          this.flashT = 0.3;
          if (mine?.id !== e.id) this.say("AWAKEN!", "#ffe08a");
          break;
        case "item": {
          const it = ITEMS[e.kind];
          this.burst(e.x, e.y, it.color, 14, 220);
          this.ring(e.x, e.y, it.color, 70, 0.5);
          this.pop(e.x, e.y - 10, it.name.toUpperCase(), it.color, 13, 900);
          break;
        }
        case "field":
          if (e.kind !== "none") this.say(`${FIELDS[e.kind].icon} ${FIELDS[e.kind].name}`, "#ffffff");
          break;
        case "mega": {
          if (mine?.id === e.id) this.ultimate(e.name, e.z ? "#ffd54a" : "#ff9be6");
          const c = col(e.type);
          this.morphs.set(e.id, { kind: "mega", t: 0, max: 1.4, swap: 0.62, color: e.z ? "#ffd54a" : "#ff9be6", z: e.z });
          this.ring(e.x, e.y, "#ffffff", 280, 0.7);
          this.ring(e.x, e.y, e.z ? "#ffd54a" : "#ff9be6", 210, 0.9);
          this.ring(e.x, e.y, "#7fe3ff", 150, 1.0);
          for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            this.parts.push({ kind: i % 3 ? "dot" : "streak", x: e.x, y: e.y, vx: Math.cos(a) * rnd(140, 420), vy: Math.sin(a) * rnd(140, 420), g: 0, life: 0.8, max: 0.8, size: rnd(3, 6), grow: 0, color: ["#ffffff", "#ff9be6", "#7fe3ff", c][i % 4]! });
          }
          this.shake = 14;
          this.shakeT = 0.45;
          this.flashT = 0.35;
          this.zoomPulse = 1;
          if (mine?.id !== e.id) this.say(e.name.toUpperCase() + "!", e.z ? "#ffd54a" : "#ff9be6");
          break;
        }
        case "zstart":
          this.z = { t: 0, name: e.name, type: e.type, x: e.x, y: e.y };
          break;
        case "clash": {
          // two beams met: a white burst and a plume of steam
          this.ring(e.x, e.y, "#ffffff", 70, 0.35);
          this.parts.push({ kind: "glow", x: e.x, y: e.y, vx: 0, vy: 0, g: 0, life: 0.3, max: 0.3, size: 20, grow: 120, color: "#ffffff" });
          for (let i = 0; i < 5; i++) this.parts.push({ kind: "smoke", x: e.x + rnd(-10, 10), y: e.y + rnd(-6, 6), vx: rnd(-40, 40), vy: rnd(-110, -50), g: 0, life: rnd(0.7, 1.1), max: 1.1, size: rnd(9, 14), grow: 30, color: "#e8f1ff" });
          this.burst(e.x, e.y, "#ffffff", 5, 220, "streak");
          break;
        }
        case "zhit": {
          const c = col(e.type);
          this.zImpact(e.x, e.y, e.type);
          this.ring(e.x, e.y, "#ffffff", 220, 0.6);
          this.ring(e.x, e.y, c, 160, 0.9);
          this.parts.push({ kind: "glow", x: e.x, y: e.y, vx: 0, vy: 0, g: 0, life: 0.7, max: 0.7, size: 60, grow: 220, color: c });
          this.burst(e.x, e.y, c, 34, 460);
          this.shake = 18;
          this.shakeT = 0.5;
          this.flashT = 0.35;
          break;
        }
        case "dynamax":
          if (mine?.id === e.id) this.ultimate(e.gmax ? "Gigantamax" : "Dynamax", "#ff4d73");
          this.morphs.set(e.id, { kind: "dyna", t: 0, max: 1.5, swap: 0.5, color: "#ff3b5c", gmax: e.gmax });
          this.ring(e.x, e.y, "#ff3b5c", 300, 0.8);
          this.ring(e.x, e.y, "#ffffff", 200, 0.6);
          this.burst(e.x, e.y, "#ff5c7a", 40, 380);
          this.shake = 16;
          this.shakeT = 0.5;
          this.flashT = 0.3;
          this.zoomPulse = 1;
          if (mine?.id !== e.id) this.say(e.gmax ? "GIGANTAMAX!" : "DYNAMAX!", "#ff6a86");
          break;
        case "tera": {
          if (mine?.id === e.id) this.ultimate(`Terastallize: ${e.type}`, "#8fe3ff");
          const c = col(e.type);
          this.morphs.set(e.id, { kind: "tera", t: 0, max: 1.3, swap: 0.5, color: c });
          this.ring(e.x, e.y, c, 260, 0.8);
          this.ring(e.x, e.y, "#ffffff", 170, 0.6);
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            this.parts.push({ kind: "dot", x: e.x, y: e.y, vx: Math.cos(a) * rnd(120, 380), vy: Math.sin(a) * rnd(120, 380) - 40, g: 120, life: 0.9, max: 0.9, size: rnd(3, 7), grow: 0, color: i % 2 ? c : "#ffffff" });
          }
          this.shake = 12;
          this.shakeT = 0.4;
          this.flashT = 0.25;
          if (mine?.id !== e.id) this.say(`TERASTALLIZE! ${e.type.toUpperCase()}`, c);
          break;
        }
        case "gimmickEnd":
          this.ring(e.x, e.y, "#aab4c8", 90, 0.5);
          break;
        case "heal":
          break;
        case "status":
          this.pop(e.x, e.y - 20, { brn: "BURN", psn: "POISON", par: "PARALYSIS", frz: "FROZEN" }[e.kind], { brn: "#ff8a3d", psn: "#c070e0", par: "#ffe14d", frz: "#8ee8ff" }[e.kind], 12, 800);
          break;
        case "shield":
          this.ring(e.x, e.y, "#9fd0ff", 60, 0.4);
          break;
        case "grab":
          this.ring(e.x, e.y, "#ff9be6", 70, 0.5);
          for (let i = 0; i < 12; i++) this.parts.push({ kind: "dot", x: e.x + rnd(-20, 20), y: e.y + rnd(-10, 14), vx: rnd(-30, 30), vy: rnd(-160, -60), g: 0, life: 0.7, max: 0.7, size: rnd(2, 4), grow: 0, color: i % 2 ? "#ffd1f4" : "#c77dff" });
          break;
        case "throw":
          for (let i = 0; i < 10; i++) this.parts.push({ kind: "streak", x: e.x ?? 0, y: e.y ?? 0, vx: e.dx * 700 + rnd(-60, 60), vy: e.dy * 700 + rnd(-60, 60), g: 0, life: 0.3, max: 0.3, size: 7, grow: 0, color: i % 2 ? "#ffffff" : "#ff9be6" });
          break;
        case "buff":
          if (e.fx === "clones") this.clones.set(e.id, this.t + 6);
          this.ring(e.x, e.y, e.fx === "clones" ? "#9dffb0" : "#ffb04d", 70, 0.5);
          for (let i = 0; i < 8; i++) this.parts.push({ kind: "text", x: e.x + rnd(-24, 24), y: e.y + 6, vx: 0, vy: -60, g: 0, life: 0.9, max: 0.9, size: 14, grow: 0, color: "#ffb04d", text: "▲", weight: 800 });
          break;
        default:
          break;
      }
    }
  }

  /** Extra art for particular moves, taken from how they look in the video: embers, cracks, waves, lightning from the sky. */
  private moveFx(e: Extract<Ev, { t: "explode" }>) {
    const { x, y, r } = e;
    switch (e.fx) {
      case "fireblast":
        // a ring of fire puffs and embers
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2;
          this.parts.push({ kind: "puff", x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8, vx: Math.cos(a) * r * 2.4, vy: Math.sin(a) * r * 2.4, g: 0, life: 0.65, max: 0.65, size: 9, grow: 8, color: "#ff9a2e", edge: "#b8360d", seed: i });
        }
        this.parts.push({ kind: "puff", x, y, vx: 0, vy: 0, g: 0, life: 0.6, max: 0.6, size: r * 0.5, grow: 40, color: "#ffd84d", edge: "#ff8a1f", seed: 4 });
        // a column of red fireballs piling upward
        for (let i = 0; i < 5; i++) this.parts.push({ kind: "puff", x: x + rnd(-10, 10), y: y - i * 12, vx: rnd(-14, 14), vy: -70 - i * 18, g: 0, life: 0.8, max: 0.8, size: 14 + i * 3, grow: 14, color: i % 2 ? "#e63a1e" : "#ff6a2a", edge: "#7a1408", seed: 10 + i });
        break;
      case "thunder":
        this.parts.push({ kind: "bolt", x: x + rnd(-50, 50), y: -60, vx: 0, vy: 0, g: 0, life: 0.32, max: 0.32, size: 1, grow: 0, color: "#ffe14d", x2: x, y2: y, seed: Math.floor(x) });
        this.flashT = Math.max(this.flashT, 0.12);
        break;
      case "surf":
        // curved blades of water spinning outward, then a wave of foam rolling out
        for (let i = 0; i < 4; i++) {
          const a0 = (i / 4) * Math.PI * 2;
          const rad = r * 0.35;
          this.parts.push({ kind: "arc", x: x + Math.cos(a0) * rad, y: y + Math.sin(a0) * rad, vx: Math.cos(a0) * r * 1.5, vy: Math.sin(a0) * r * 1.5, g: 0, life: 0.65, max: 0.65, size: 9 + r * 0.04, grow: 0, color: i % 2 ? "#3da0ff" : "#8fd3ff", rot: a0, vr: 5 });
        }
        this.ring(x, y, "#e8f6ff", r * 1.2, 0.7);
        for (let i = 0; i < 34; i++) {
          const a = (i / 34) * Math.PI * 2;
          const v = rnd(r * 1.4, r * 2.6);
          this.parts.push({ kind: "dot", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 160, life: rnd(0.5, 0.9), max: 0.9, size: rnd(3, 6), grow: 0, color: i % 3 ? "#bfe6ff" : "#ffffff" });
        }
        this.shake = Math.max(this.shake, 6);
        this.shakeT = 0.3;
        break;
      case "earthquake":
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + rnd(-0.15, 0.15);
          this.parts.push({ kind: "crack", x, y, vx: 0, vy: 0, g: 0, life: 1.3, max: 1.3, size: 1, grow: 0, color: "#000", x2: x + Math.cos(a) * r * 1.15, y2: y + Math.sin(a) * r * 0.9, seed: 7 + i });
        }
        for (let i = 0; i < 14; i++) this.parts.push({ kind: "dot", x: x + rnd(-r * 0.6, r * 0.6), y: y + rnd(-r * 0.4, r * 0.4), vx: rnd(-80, 80), vy: rnd(-260, -80), g: 600, life: rnd(0.5, 1.0), max: 1.0, size: rnd(3, 6), grow: 0, color: "#8a6a45" });
        this.shake = Math.max(this.shake, 11);
        this.shakeT = 0.5;
        break;
      case "blizzard":
        for (let i = 0; i < 46; i++) {
          const a = rnd(0, Math.PI * 2);
          const v = rnd(60, r * 2.4);
          this.parts.push({ kind: "dot", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 30, life: rnd(0.7, 1.3), max: 1.3, size: rnd(2, 5), grow: 0, color: i % 2 ? "#ffffff" : "#aeeaff" });
        }
        break;
      case "closecombat":
      case "dynamicpunch":
      case "outrage":
      case "xscissor":
        if (e.fx === "xscissor") this.parts.push({ kind: "cross", x, y, vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, size: Math.max(70, r * 1.1), grow: 0, color: "#6dff7a" });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          this.parts.push({ kind: "streak", x, y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, g: 0, life: 0.28, max: 0.28, size: 9, grow: 0, color: i % 2 ? "#ffffff" : "#ffcf4d" });
        }
        break;
      case "dracometeor":
      case "rockslide":
        for (let i = 0; i < 12; i++) this.parts.push({ kind: "dot", x: x + rnd(-r * 0.6, r * 0.6), y, vx: rnd(-160, 160), vy: rnd(-300, -100), g: 700, life: rnd(0.5, 0.9), max: 0.9, size: rnd(3.5, 7), grow: 0, color: e.fx === "rockslide" ? "#8a8f99" : "#ff8a3d" });
        this.shake = Math.max(this.shake, 8);
        this.shakeT = 0.35;
        break;
      case "levitate": {
        this.ring(x, y, "#ff9be6", Math.max(60, r * 1.4), 0.6);
        const n = 11;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
          const d = rnd(70, 300);
          const hMax = rnd(26, 70);
          this.rocks.push({ x: clamp(x + Math.cos(a) * d, 70, ARENA.W - 70), y: clamp(y + Math.sin(a) * d * 0.75, 70, ARENA.H - 70), h: 0, hMax, rot: rnd(0, 6.28), vr: rnd(-1.2, 1.2), size: rnd(10, 22), t: 0, max: rnd(3.2, 4.4), seed: Math.random() * 100 });
        }
        if (this.rocks.length > 40) this.rocks.splice(0, this.rocks.length - 40);
        break;
      }
      case "slam":
        this.scorch.push({ x, y, r: 46, seed: Math.random() * 100, t: 12, max: 12, type: "Rock" });
        for (let i = 0; i < 16; i++) this.parts.push({ kind: "dot", x: x + rnd(-14, 14), y: y + rnd(-6, 8), vx: rnd(-240, 240), vy: rnd(-380, -110), g: 760, life: rnd(0.5, 0.9), max: 0.9, size: rnd(3, 6.5), grow: 0, color: i % 2 ? "#8a7a68" : "#c9b79a" });
        this.ring(x, y, "#ff9be6", r * 1.3, 0.45);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + rnd(-0.2, 0.2);
          this.parts.push({ kind: "crack", x, y, vx: 0, vy: 0, g: 0, life: 1.2, max: 1.2, size: 1, grow: 0, color: "#000", x2: x + Math.cos(a) * 80, y2: y + Math.sin(a) * 56, seed: 5 + i });
        }
        this.shake = Math.max(this.shake, 12);
        this.shakeT = 0.4;
        break;
      case "sludgebomb":
        for (let i = 0; i < 16; i++) this.parts.push({ kind: "dot", x, y, vx: rnd(-150, 150), vy: rnd(-200, -40), g: 420, life: rnd(0.5, 0.9), max: 0.9, size: rnd(3, 6), grow: 0, color: i % 2 ? "#a855f7" : "#6b21a8" });
        break;
      default:
        break;
    }
  }

  /* -------------------------------------------------------------------- frame */

  render(S: State, dtRaw: number, you: Fighter | undefined) {
    const g = this.ctx;
    // Time only moves forward. (The first frame's timestamp can be a hair older than the moment the game
    // started, which gave a negative step and made the water pools draw with a negative radius.)
    const dtReal = Number.isFinite(dtRaw) && dtRaw > 0 ? dtRaw : 0;
    const dt = dtReal * (S.slow > 0 ? 0.4 : 1);
    this.t += dtReal;
    this.dtr = dtReal;
    if (this.later.length) {
      for (const l of this.later) l.t -= dtReal;
      const due = this.later.filter((l) => l.t <= 0);
      this.later = this.later.filter((l) => l.t > 0);
      for (const l of due) l.fn();
    }
    this.shakeT = Math.max(0, this.shakeT - dtReal);
    this.zoomPulse = Math.max(0, this.zoomPulse - dtReal * 3);
    this.flashT = Math.max(0, this.flashT - dtReal);
    this.perfectT = Math.max(0, this.perfectT - dtReal);
    if (this.z) {
      this.z.t += dtReal;
      if (this.z.t > 1.4) this.z = null;
    }
    if (this.banner) {
      this.banner.t -= dtReal;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.ultBanner) {
      this.ultBanner.t -= dtReal;
      if (this.ultBanner.t <= 0) this.ultBanner = null;
    }

    for (const [id, m] of this.morphs) {
      m.t += dtReal;
      if (m.t > m.max) this.morphs.delete(id);
    }
    for (const f of S.fighters) {
      const h = this.hist.get(f.id) ?? [];
      h.unshift({ x: f.x, y: f.y });
      if (h.length > 34) h.pop();
      this.hist.set(f.id, h);
    }
    for (const sc of this.scorch) sc.t -= dtReal;
    this.scorch = this.scorch.filter((sc) => sc.t > 0);
    for (const d of this.debris) d.t -= dtReal;
    this.debris = this.debris.filter((d) => d.t > 0);
    this.followCamera(you, dtReal);
    g.save();
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.fillStyle = "#04070d";
    g.fillRect(0, 0, ARENA.W, ARENA.H);
    const k = this.shakeT > 0 ? this.shake * (this.shakeT / 0.3) : 0;
    const zoom = this.zoom * (1 + this.zoomPulse * 0.025);
    g.translate(ARENA.CX, ARENA.CY);
    g.scale(zoom, zoom);
    g.translate(-this.camX + rnd(-k, k), -this.camY + rnd(-k, k));
    g.drawImage(stageBackground(S.stage), 0, 0);
    for (const pool of S.pools) drawPool(g, pool, this.t);
    for (const hole of S.holes) drawHole(g, hole, this.t);
    // blast marks: a dark patch with a glowing rim that cools
    for (const sc of this.scorch) {
      const k = sc.t / sc.max;
      g.save();
      g.translate(sc.x, sc.y);
      g.scale(1, 0.72);
      g.globalAlpha = Math.min(1, k * 1.6) * 0.5;
      g.fillStyle = "#14100e";
      g.beginPath();
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const rr = sc.r * (0.78 + 0.28 * Math.sin(sc.seed + i * 2.3) * Math.cos(sc.seed * 0.7 + i));
        if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      if (k > 0.7 && (sc.type === "Fire" || sc.type === "Electric")) {
        g.globalAlpha = (k - 0.7) * 2.2 * 0.5;
        g.strokeStyle = sc.type === "Fire" ? "#ff7a2a" : "#ffe14d";
        g.lineWidth = 2.5;
        g.stroke();
      }
      g.restore();
    }
    // the remains of broken crates stay on the floor for a while
    for (const d of this.debris) {
      g.save();
      g.globalAlpha = Math.min(1, d.t / 2);
      g.translate(d.x, d.y);
      g.strokeStyle = "#8a5a2b";
      g.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = d.seed * 7 + i * 1.7;
        g.beginPath();
        g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        g.lineTo(Math.cos(a) * 8 + Math.cos(a + 0.6) * 14, Math.sin(a) * 8 + Math.sin(a + 0.6) * 14);
        g.stroke();
      }
      g.restore();
    }

    // the storm ring in a royale
    if (S.storm.on) {
      g.save();
      g.beginPath();
      g.rect(0, 0, ARENA.W, ARENA.H);
      g.arc(ARENA.CX, ARENA.CY, S.storm.r, 0, Math.PI * 2, true);
      g.fillStyle = "rgba(150,60,200,.28)";
      g.fill("evenodd");
      g.strokeStyle = `rgba(210,130,255,${0.6 + Math.sin(this.t * 5) * 0.2})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(ARENA.CX, ARENA.CY, S.storm.r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    this.drawItems(g, S);
    this.drawZones(g, S);
    this.drawTelegraphs(g, S);
    this.drawRocks(g, dt);
    this.drawTethers(g, S);

    // crates, pillars and Pokémon are drawn back to front so they stand behind and in front of each other
    const things: { y: number; draw: () => void }[] = [];
    for (const o of S.obs) if (o.hp > 0) things.push({ y: o.y, draw: () => drawObstacle(g, o, this.t) });
    for (const f of S.fighters) if (f.alive || f.koT < 0.01) things.push({ y: f.y, draw: () => this.drawFighter(g, f, S, f === you) });
    things.sort((a, b) => a.y - b.y);
    for (const th of things) th.draw();
    this.drawProjs(g, S);
    this.drawAim(g);

    // particles
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.size += p.grow * dt;
      if (p.vr) p.rot = (p.rot ?? 0) + p.vr * dt;
      const a = Math.max(0, p.life / p.max);
      g.globalAlpha = a;
      if (p.kind === "dot") {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
        g.fill();
      } else if (p.kind === "cross") {
        // two crossing slashes that flash in and thin out (X-Scissor)
        const k = 1 - a;
        const L = p.size * (0.5 + Math.min(1, k * 4) * 0.5);
        g.strokeStyle = p.color;
        g.lineCap = "round";
        for (const sg of [1, -1]) {
          g.lineWidth = 9 * a + 2;
          g.beginPath();
          g.moveTo(p.x - L * 0.7, p.y - L * 0.7 * sg);
          g.lineTo(p.x + L * 0.7, p.y + L * 0.7 * sg);
          g.stroke();
        }
        g.strokeStyle = "#ffffff";
        for (const sg of [1, -1]) {
          g.lineWidth = 3 * a + 1;
          g.beginPath();
          g.moveTo(p.x - L * 0.7, p.y - L * 0.7 * sg);
          g.lineTo(p.x + L * 0.7, p.y + L * 0.7 * sg);
          g.stroke();
        }
        g.lineCap = "butt";
      } else if (p.kind === "streak") {
        g.strokeStyle = p.color;
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        g.stroke();
      } else if (p.kind === "ring") {
        g.strokeStyle = p.color;
        g.lineWidth = 4 * a + 1;
        g.beginPath();
        g.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
        g.stroke();
      } else if (p.kind === "glow") {
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(2, p.size));
        gr.addColorStop(0, "rgba(255,255,255,.9)");
        gr.addColorStop(0.35, p.color);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.globalCompositeOperation = "lighter";
        g.fillStyle = gr;
        g.beginPath();
        g.arc(p.x, p.y, Math.max(2, p.size), 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = "source-over";
      } else if (p.kind === "smoke") {
        g.fillStyle = p.color;
        g.globalAlpha = a * 0.35;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      } else if (p.kind === "puff") {
        blob(g, p.x, p.y, Math.max(1, p.size), p.seed ?? 1, p.color, p.edge ?? "#000");
      } else if (p.kind === "plank") {
        p.rot = (p.rot ?? 0) + (p.vr ?? 0) * dt;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        g.fillRect(-p.size * 1.6, -p.size * 0.4, p.size * 3.2, p.size * 0.8);
        g.restore();
      } else if (p.kind === "crack" && p.x2 !== undefined && p.y2 !== undefined) {
        const n = 7;
        const len = Math.hypot(p.x2 - p.x, p.y2 - p.y);
        const nx = -(p.y2 - p.y) / (len || 1);
        const ny = (p.x2 - p.x) / (len || 1);
        for (const [lw, c] of [[5, "#1a1008"], [2, "#d9b98a"]] as const) {
          g.strokeStyle = c;
          g.lineWidth = lw;
          g.beginPath();
          g.moveTo(p.x, p.y);
          for (let i = 1; i <= n; i++) {
            const k = i / n;
            const off = (((p.seed ?? 1) * (i * 9301 + 49297)) % 233) / 233 - 0.5;
            g.lineTo(p.x + (p.x2 - p.x) * k * Math.min(1, (p.max - p.life) * 8) + nx * off * 18, p.y + (p.y2 - p.y) * k * Math.min(1, (p.max - p.life) * 8) + ny * off * 18);
          }
          g.stroke();
        }
      } else if (p.kind === "bolt" && p.x2 !== undefined && p.y2 !== undefined) {
        drawLightning(g, p.x, p.y, p.x2, p.y2, p.color, a, (p.seed ?? 1) + Math.floor(this.t * 22), 5);
      } else if (p.kind === "shard") {
        // a crystal splinter
        p.rot = (p.rot ?? 0) + (p.vr ?? 0) * dt;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        g.strokeStyle = "#ffffff";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(0, -p.size * 1.8);
        g.lineTo(p.size * 0.8, 0);
        g.lineTo(0, p.size * 1.8);
        g.lineTo(-p.size * 0.8, 0);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      } else if (p.kind === "arc") {
        // a curved blade of water
        p.rot = (p.rot ?? 0) + (p.vr ?? 0) * dt;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.lineCap = "round";
        for (const [w, cc] of [[p.size * 0.5, p.color], [p.size * 0.18, "#ffffff"]] as const) {
          g.strokeStyle = cc;
          g.lineWidth = w;
          g.beginPath();
          g.arc(0, 0, p.size * 5, -0.7, 0.7);
          g.stroke();
        }
        g.restore();
      } else if (p.kind === "star") {
        p.rot = (p.rot ?? 0) + (p.vr ?? 0) * dt;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const rr = k % 2 ? p.size * 0.35 : p.size;
          const aa = (k / 8) * Math.PI * 2;
          g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
        }
        g.closePath();
        g.fill();
        g.restore();
      } else if (p.kind === "text" && p.text) {
        const pop = Math.min(1, (p.max - p.life) * 9);
        const s = p.size * (0.6 + pop * 0.5 + (pop < 1 ? 0.35 * (1 - pop) : 0));
        g.font = `${p.weight ?? 800} ${s}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.lineWidth = 4;
        g.strokeStyle = "rgba(0,0,0,.75)";
        g.strokeText(p.text, p.x, p.y);
        g.fillStyle = p.color;
        g.fillText(p.text, p.x, p.y);
      }
    }
    g.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 700) this.parts.splice(0, this.parts.length - 700);
    g.restore();

    // screen tints (not shaken)
    g.save();
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.drawField(g, S);
    this.drawZ(g);
    if (this.perfectT > 0) {
      const a = Math.min(1, this.perfectT / 0.8);
      const gr = g.createRadialGradient(ARENA.CX, ARENA.CY, 140, ARENA.CX, ARENA.CY, 560);
      gr.addColorStop(0, "rgba(80,200,255,0)");
      gr.addColorStop(1, `rgba(60,170,255,${0.4 * a})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, ARENA.W, ARENA.H);
    }
    if (this.flashT > 0) {
      g.fillStyle = `rgba(255,255,255,${this.flashT * 1.6})`;
      g.fillRect(0, 0, ARENA.W, ARENA.H);
    }
    // the player is in danger: the edges glow red
    if (you && you.alive && you.hp < you.maxHp * 0.25) {
      const pulse = 0.5 + Math.sin(this.t * 6) * 0.5;
      const gr = g.createRadialGradient(ARENA.CX, ARENA.CY, 260, ARENA.CX, ARENA.CY, 580);
      gr.addColorStop(0, "rgba(255,40,40,0)");
      gr.addColorStop(1, `rgba(255,40,40,${0.18 + pulse * 0.16})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, ARENA.W, ARENA.H);
    }
    // short notices sit in a small tag near the top, out of the way of the fight
    let ty = ARENA.H * 0.125;
    if (this.ultBanner) {
      const u = this.ultBanner;
      this.toastTag(g, u.sub, "ULTIMATE", u.color, 1.7 - u.t, u.t, ty);
      ty += 46;
    }
    if (this.banner) {
      this.toastTag(g, this.banner.text, "", this.banner.color, 1.6 - this.banner.t, this.banner.t, ty);
    }
    g.restore();
  }

  /** The effects of the special moves that come with Mega Evolution, Dynamax / Gigantamax and Terastallization. */
  private specialCast(e: Extract<Ev, { t: "cast" }>) {
    const c = col(e.type);
    if (e.mv === "megaburst") {
      this.ring(e.x, e.y, "#ffffff", 250, 0.45);
      this.ring(e.x, e.y, c, 200, 0.7);
      this.ring(e.x, e.y, "#ff9be6", 150, 0.9);
      this.parts.push({ kind: "glow", x: e.x, y: e.y, vx: 0, vy: 0, g: 0, life: 0.5, max: 0.5, size: 40, grow: 360, color: c });
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2;
        this.parts.push({ kind: "streak", x: e.x, y: e.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, g: 0, life: 0.45, max: 0.45, size: 8, grow: 0, color: i % 2 ? "#ffffff" : c });
      }
      // a double spiral of sparks turning outward
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 4;
        const sp = 90 + i * 8;
        this.parts.push({ kind: "star", x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: 0.8, max: 0.8, size: 5, grow: 0, color: i % 2 ? "#ff9be6" : "#7fe3ff", rot: 0, vr: 6 });
      }
      this.shake = Math.max(this.shake, 9);
      this.shakeT = Math.max(this.shakeT, 0.3);
      this.flashT = Math.max(this.flashT, 0.12);
    } else if (e.mv === "maxstrike" || e.mv === "gmaxblast") {
      const g = e.mv === "gmaxblast";
      const reach = 400;
      const dx = e.tx - e.x;
      const dy = e.ty - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = d > reach ? reach / d : 1;
      const x = e.x + dx * k;
      const y = e.y + dy * k;
      // a giant bolt of its type drops onto the target
      for (let i = 0; i < 20; i++) this.parts.push({ kind: "streak", x: x + rnd(-40, 40), y: y - 520 - rnd(0, 120), vx: 0, vy: 1500, g: 0, life: 0.34, max: 0.34, size: rnd(10, 18), grow: 0, color: i % 2 ? "#ffffff" : c });
      this.later.push({
        t: 0.34,
        fn: () => {
          this.ring(x, y, "#ffffff", 240, 0.5);
          this.ring(x, y, c, 190, 0.8);
          this.parts.push({ kind: "glow", x, y, vx: 0, vy: 0, g: 0, life: 0.6, max: 0.6, size: 50, grow: 330, color: c });
          for (let i = 0; i < 26; i++) this.parts.push({ kind: "dot", x: x + rnd(-30, 30), y, vx: rnd(-130, 130), vy: rnd(-520, -200), g: 700, life: rnd(0.5, 0.9), max: 0.9, size: rnd(3, 7), grow: 0, color: i % 3 ? c : "#ffffff" });
          for (let i = 0; i < 8; i++) this.parts.push({ kind: "plank", x, y, vx: rnd(-240, 240), vy: rnd(-420, -160), g: 900, life: 0.8, max: 0.8, size: rnd(4, 8), grow: 0, color: "#6b5b4a", rot: rnd(0, 6), vr: rnd(-12, 12) });
          if (g) for (let i = 0; i < 14; i++) this.parts.push({ kind: "star", x, y, vx: rnd(-320, 320), vy: rnd(-420, -80), g: 300, life: 1, max: 1, size: rnd(6, 11), grow: 0, color: i % 2 ? "#ff4d73" : "#ffd54a", rot: 0, vr: 5 });
          this.shake = Math.max(this.shake, 14);
          this.shakeT = Math.max(this.shakeT, 0.45);
          this.flashT = Math.max(this.flashT, 0.15);
        },
      });
    } else if (e.mv === "terablast") {
      this.ring(e.x, e.y, c, 120, 0.4);
      for (let i = 0; i < 18; i++) {
        const a = e.dir + rnd(-0.35, 0.35);
        const v = rnd(300, 760);
        this.parts.push({ kind: "shard", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: rnd(0.4, 0.8), max: 0.8, size: rnd(3, 6), grow: 0, color: i % 3 ? c : "#ffffff", rot: rnd(0, 6), vr: rnd(-10, 10) });
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.parts.push({ kind: "shard", x: e.x, y: e.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, g: 0, life: 0.5, max: 0.5, size: 5, grow: 0, color: "#ffffff", rot: a, vr: 8 });
      }
    }
  }

  /** What each type of Z-Move does to a target when it lands. */
  private zImpact(x: number, y: number, type: string) {
    const c = col(type);
    const P = (o: Partial<Parti> & Pick<Parti, "kind" | "color">) => this.parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 0.7, max: 0.7, size: 5, grow: 0, ...o });
    switch (type) {
      case "Fire":
        for (let i = 0; i < 14; i++) P({ kind: "puff", vx: rnd(-60, 60), vy: rnd(-180, -60), g: -80, size: rnd(8, 14), grow: 10, color: i % 2 ? "#ffb02e" : "#ff5a1a", edge: "#7a2a0a", seed: i + 3 });
        break;
      case "Water":
        for (let i = 0; i < 26; i++) P({ kind: "dot", vx: rnd(-180, 180), vy: rnd(-520, -200), g: 900, color: i % 2 ? "#bfe9ff" : "#3da0ff", size: rnd(2, 5) });
        break;
      case "Electric":
        for (let i = 0; i < 4; i++) P({ kind: "bolt", x: x + rnd(-60, 60), y: y - 260, x2: x + rnd(-14, 14), y2: y, color: "#ffe14d", life: 0.45, max: 0.45, seed: i * 7 + 2 });
        break;
      case "Grass":
        for (let i = 0; i < 24; i++) P({ kind: "dot", vx: rnd(-200, 200), vy: rnd(-300, -60), g: 300, color: i % 2 ? "#6bd45a" : "#c9f08a", size: rnd(3, 6) });
        break;
      case "Ice":
        for (let i = 0; i < 16; i++) P({ kind: "shard", vx: rnd(-260, 260), vy: rnd(-380, -80), g: 520, color: i % 2 ? "#bfefff" : "#ffffff", size: rnd(3, 6), rot: rnd(0, 6), vr: rnd(-10, 10), life: 0.9, max: 0.9 });
        break;
      case "Fighting":
        for (let i = 0; i < 10; i++) P({ kind: "star", vx: rnd(-300, 300), vy: rnd(-300, 300), color: i % 2 ? "#ffd54a" : "#ff5a3c", size: rnd(6, 12), rot: 0, vr: 6 });
        break;
      case "Poison":
        for (let i = 0; i < 10; i++) P({ kind: "smoke", vx: rnd(-40, 40), vy: rnd(-120, -40), color: i % 2 ? "#a24be0" : "#6bd45a", size: rnd(8, 14), grow: 18, life: 1, max: 1 });
        break;
      case "Ground":
        for (let i = 0; i < 6; i++) P({ kind: "crack", x2: x + rnd(-90, 90), y2: y + rnd(-60, 60), color: "#d9b98a", seed: i + 1, life: 0.9, max: 0.9 });
        for (let i = 0; i < 10; i++) P({ kind: "plank", vx: rnd(-200, 200), vy: rnd(-420, -140), g: 900, color: "#7a5a38", size: rnd(4, 8), rot: 0, vr: rnd(-10, 10) });
        break;
      case "Flying":
        for (let i = 0; i < 12; i++) P({ kind: "streak", vx: rnd(-80, 80), vy: rnd(-600, -300), color: "#eaf6ff", size: 8, life: 0.4, max: 0.4 });
        break;
      case "Psychic":
        for (let i = 0; i < 3; i++) this.ring(x, y, i % 2 ? "#ff7ad9" : "#c9a0ff", 140 + i * 70, 0.6 + i * 0.2);
        break;
      case "Bug":
        for (let i = 0; i < 5; i++) P({ kind: "crack", x2: x + rnd(-100, 100), y2: y + rnd(-100, 100), color: "#b8e04a", seed: i + 2, life: 0.8, max: 0.8 });
        break;
      case "Rock":
        for (let i = 0; i < 12; i++) P({ kind: "plank", vx: rnd(-260, 260), vy: rnd(-460, -160), g: 1000, color: i % 2 ? "#9b8a6a" : "#6b5b4a", size: rnd(4, 9), rot: 0, vr: rnd(-12, 12) });
        break;
      case "Ghost":
        for (let i = 0; i < 10; i++) P({ kind: "smoke", vx: rnd(-50, 50), vy: rnd(-160, -50), color: i % 2 ? "#6b3fa0" : "#c9a0ff", size: rnd(8, 13), grow: 22, life: 1, max: 1 });
        break;
      case "Dragon":
        this.ring(x, y, "#7b5cff", 260, 0.8);
        for (let i = 0; i < 14; i++) P({ kind: "streak", vx: Math.cos(i) * 520, vy: Math.sin(i) * 520, color: i % 2 ? "#7b5cff" : "#4aa8ff", size: 9, life: 0.5, max: 0.5 });
        break;
      case "Dark":
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * 6.28;
          P({ kind: "smoke", x: x + Math.cos(a) * 90, y: y + Math.sin(a) * 90, vx: -Math.cos(a) * 160, vy: -Math.sin(a) * 160, color: i % 2 ? "#2a1a45" : "#8a5be0", size: 10, grow: -4, life: 0.6, max: 0.6 });
        }
        break;
      case "Steel":
        for (let i = 0; i < 16; i++) P({ kind: "shard", vx: rnd(-420, 420), vy: rnd(-420, 120), g: 600, color: i % 2 ? "#c8d4e0" : "#ffe9a0", size: rnd(2, 5), rot: rnd(0, 6), vr: rnd(-14, 14) });
        break;
      case "Fairy":
        for (let i = 0; i < 14; i++) P({ kind: "star", vx: rnd(-240, 240), vy: rnd(-300, -40), g: 200, color: ["#ffc2e6", "#ffffff", "#ffe27a"][i % 3]!, size: rnd(5, 10), rot: 0, vr: 4, life: 1, max: 1 });
        break;
      default:
        break;
    }
  }

  /** A small rounded tag with a coloured edge: a title, and a smaller line above it when there is one. */
  private toastTag(g: CanvasRenderingContext2D, title: string, label: string, color: string, age: number, left: number, y: number) {
    const inK = Math.min(1, age * 6);
    const outK = Math.min(1, left * 3);
    g.save();
    g.globalAlpha = Math.max(0, Math.min(inK, outK));
    g.font = "800 19px system-ui, sans-serif";
    const tw = g.measureText(title).width;
    g.font = "800 10px system-ui, sans-serif";
    const lw = label ? g.measureText(label).width : 0;
    const w = Math.max(tw, lw) + 34;
    const h = label ? 40 : 30;
    const x = ARENA.CX - w / 2;
    const yy = y - (1 - inK) * 14;
    g.fillStyle = "rgba(6,10,22,.66)";
    g.beginPath();
    g.roundRect(x, yy, w, h, 10);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(x, yy, 5, h, [10, 0, 0, 10]);
    g.fill();
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (label) {
      g.font = "800 10px system-ui, sans-serif";
      g.fillStyle = "rgba(255,255,255,.7)";
      g.fillText(label.split("").join(" "), ARENA.CX + 2, yy + 11);
    }
    g.font = "800 19px system-ui, sans-serif";
    g.fillStyle = color;
    g.fillText(title, ARENA.CX + 2, yy + (label ? 28 : h / 2 + 1));
    g.restore();
  }

  /* ---------------------------------------------------------------- the parts */

  private drawItems(g: CanvasRenderingContext2D, S: State) {
    for (const it of S.items) {
      const d = ITEMS[it.kind];
      const bob = Math.sin(this.t * 4 + it.id) * 3;
      const fade = it.life < 3 ? (Math.sin(this.t * 14) > 0 ? 1 : 0.3) : 1;
      g.save();
      g.globalAlpha = fade;
      g.fillStyle = "rgba(0,0,0,.35)";
      g.beginPath();
      g.ellipse(it.x, it.y + 14, 13, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(it.x, it.y + bob, 0, it.x, it.y + bob, 34);
      gr.addColorStop(0, d.color);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.globalAlpha = fade * 0.55;
      g.beginPath();
      g.arc(it.x, it.y + bob, 34, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = fade;
      g.fillStyle = "#101826";
      g.strokeStyle = d.color;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(it.x, it.y + bob, 15, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = d.color;
      g.font = "900 17px system-ui";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(d.icon, it.x, it.y + bob + 1);
      g.restore();
    }
  }

  /** The Z-Move cinematic: the screen darkens, light rays turn from the caster, and the move's name sweeps in. */
  private drawZ(g: CanvasRenderingContext2D) {
    const z = this.z;
    if (!z) return;
    const c = col(z.type);
    const T = 1.2;
    const p = Math.min(1, z.t / T);
    const inA = Math.min(1, z.t / 0.25);
    const outA = z.t > T ? Math.max(0, 1 - (z.t - T) / 0.2) : 1;
    const a = inA * outA;
    const at = this.toCanvas(z.x, z.y);
    g.save();
    g.fillStyle = `rgba(0,0,8,${0.72 * a})`;
    g.fillRect(0, 0, ARENA.W, ARENA.H);
    g.restore();
    // each type has its own show; Normal keeps the turning rays
    g.save();
    if (!this.zScene(g, z.type, z.t, p, a, at, c)) {
    g.translate(at.x, at.y);
    g.rotate(z.t * 1.4);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 18; i++) {
      g.rotate((Math.PI * 2) / 18);
      const gr = g.createLinearGradient(0, 0, 900, 0);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.15, c);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.globalAlpha = a * (i % 2 ? 0.35 : 0.18);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(900, -26 - p * 30);
      g.lineTo(900, 26 + p * 30);
      g.closePath();
      g.fill();
    }
    }
    g.restore();
    // a growing glow and pose rings around the caster
    g.save();
    g.globalCompositeOperation = "lighter";
    const rad = 40 + p * 150;
    const gl = g.createRadialGradient(at.x, at.y, 0, at.x, at.y, rad);
    gl.addColorStop(0, "#ffffff");
    gl.addColorStop(0.4, c);
    gl.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gl;
    g.globalAlpha = a * 0.9;
    g.beginPath();
    g.arc(at.x, at.y, rad, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // letterbox bars and the name
    const bar = 70 * Math.min(1, z.t / 0.2) * outA;
    g.fillStyle = "#000";
    g.fillRect(0, 0, ARENA.W, bar);
    g.fillRect(0, ARENA.H - bar, ARENA.W, bar);
    // the name sits in the top bar, so the middle stays clear for the show
    const slide = (1 - Math.min(1, z.t / 0.35)) * 300;
    g.save();
    g.globalAlpha = a;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 12px system-ui, sans-serif";
    g.fillStyle = "#ffd54a";
    g.fillText("Z - M O V E", ARENA.CX - slide, bar * 0.28);
    g.font = "italic 900 26px system-ui, sans-serif";
    g.lineWidth = 5;
    g.strokeStyle = "rgba(0,0,0,.8)";
    g.strokeText(z.name, ARENA.CX + slide, bar * 0.66);
    g.fillStyle = "#fff";
    g.fillText(z.name, ARENA.CX + slide, bar * 0.66);
    g.restore();
  }

  /** The Z-Move show for each type. Returns false when the type has none (the turning rays are used). */
  private zScene(g: CanvasRenderingContext2D, type: string, t: number, p: number, a: number, at: { x: number; y: number }, c: string): boolean {
    const W = ARENA.W;
    const H = ARENA.H;
    const hs = (n: number) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    g.globalCompositeOperation = "lighter";
    switch (type) {
      case "Fire": {
        // a huge fireball falls from the sky, embers rising all around
        const k = smooth(0.1, 0.85, p);
        const fx = at.x + (W * 0.5 - at.x) * 0.3;
        const fy = -120 + (H * 0.55 + 120) * k;
        const r = 70 + k * 90;
        const gr = g.createRadialGradient(fx, fy, 0, fx, fy, r);
        gr.addColorStop(0, "#fff7c2");
        gr.addColorStop(0.35, "#ffb02e");
        gr.addColorStop(0.75, "#ff4a1a");
        gr.addColorStop(1, "rgba(255,60,0,0)");
        g.globalAlpha = a;
        g.fillStyle = gr;
        g.beginPath();
        g.arc(fx, fy, r, 0, Math.PI * 2);
        g.fill();
        for (let i = 0; i < 46; i++) {
          const x = hs(i) * W;
          const y = H - ((t * (120 + hs(i + 9) * 200) + hs(i + 3) * H) % (H + 40)) + 20;
          g.fillStyle = i % 3 ? "#ff9a2e" : "#ffe066";
          g.globalAlpha = a * 0.8;
          g.beginPath();
          g.arc(x + Math.sin(t * 3 + i) * 10, y, 2 + hs(i + 5) * 3, 0, Math.PI * 2);
          g.fill();
        }
        return true;
      }
      case "Water": {
        // a whirlpool turning around the middle
        g.translate(W / 2, H * 0.55);
        g.globalAlpha = a * 0.8;
        for (let i = 0; i < 7; i++) {
          g.save();
          g.rotate(t * (1.6 + i * 0.25) * (i % 2 ? -1 : 1));
          g.strokeStyle = i % 2 ? "#bfe9ff" : "#3da0ff";
          g.lineWidth = 8 - i * 0.7;
          g.setLineDash([60 + i * 14, 40]);
          g.beginPath();
          g.ellipse(0, 0, 90 + i * 55 * (0.4 + p), (90 + i * 55 * (0.4 + p)) * 0.55, 0, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
        g.setLineDash([]);
        for (let i = 0; i < 30; i++) {
          const ang = hs(i) * 6.28 + t * 2;
          const rr = 60 + hs(i + 2) * 380;
          g.fillStyle = "#e8f7ff";
          g.beginPath();
          g.arc(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.55 - ((t * 120 + i * 30) % 90), 2.5, 0, Math.PI * 2);
          g.fill();
        }
        return true;
      }
      case "Electric": {
        // lightning strikes everywhere, flickering
        const f = Math.floor(t * 14);
        g.globalAlpha = a;
        for (let b = 0; b < 6; b++) {
          let x = hs(f * 7 + b) * W;
          let y = 0;
          g.strokeStyle = b % 2 ? "#fff6a8" : "#ffe14d";
          g.lineWidth = 4 - (b % 3);
          g.shadowColor = "#ffe14d";
          g.shadowBlur = 16;
          g.beginPath();
          g.moveTo(x, y);
          while (y < H) {
            y += 40 + hs(f + b + y) * 30;
            x += (hs(f * 3 + b + y * 0.1) - 0.5) * 90;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        g.shadowBlur = 0;
        if (f % 3 === 0) {
          g.fillStyle = "rgba(255,255,200,.18)";
          g.fillRect(0, 0, W, H);
        }
        return true;
      }
      case "Grass": {
        // vines grow up from below, petals drift down
        g.globalAlpha = a;
        for (let i = 0; i < 9; i++) {
          const bx = (i + 0.5) * (W / 9);
          const len = smooth(0, 0.8, p) * (H * (0.5 + hs(i) * 0.4));
          g.strokeStyle = "#3fa84a";
          g.lineWidth = 7;
          g.beginPath();
          g.moveTo(bx, H);
          for (let y = 0; y <= len; y += 12) g.lineTo(bx + Math.sin(y * 0.03 + i + t * 2) * 26, H - y);
          g.stroke();
          g.fillStyle = "#8be07a";
          for (let y = 30; y < len; y += 46) {
            g.beginPath();
            g.ellipse(bx + Math.sin(y * 0.03 + i + t * 2) * 26 + (y % 92 ? 12 : -12), H - y, 12, 5, y % 92 ? 0.6 : -0.6, 0, Math.PI * 2);
            g.fill();
          }
        }
        for (let i = 0; i < 40; i++) {
          g.fillStyle = i % 2 ? "#ffb7d5" : "#ffe3ef";
          g.beginPath();
          g.ellipse(hs(i) * W + Math.sin(t * 2 + i) * 20, ((t * 90 + hs(i + 4) * H) % (H + 20)) - 10, 5, 3, t + i, 0, Math.PI * 2);
          g.fill();
        }
        return true;
      }
      case "Ice": {
        // spikes of ice burst up from the bottom, snow swirls
        g.globalAlpha = a;
        const k = smooth(0.05, 0.6, p);
        for (let i = 0; i < 14; i++) {
          const bx = (i + 0.5) * (W / 14) + (hs(i) - 0.5) * 30;
          const h = (90 + hs(i + 1) * 230) * k;
          const gr = g.createLinearGradient(bx, H, bx, H - h);
          gr.addColorStop(0, "#9fd8ff");
          gr.addColorStop(1, "#ffffff");
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(bx - 24, H);
          g.lineTo(bx, H - h);
          g.lineTo(bx + 24, H);
          g.closePath();
          g.fill();
        }
        g.fillStyle = "#ffffff";
        for (let i = 0; i < 70; i++) {
          g.beginPath();
          g.arc((hs(i) * W + t * 60 * (1 + hs(i + 3))) % W, ((t * 140 * (0.5 + hs(i + 2)) + hs(i + 7) * H) % H), 1.5 + hs(i + 5) * 2, 0, Math.PI * 2);
          g.fill();
        }
        return true;
      }
      case "Fighting": {
        // a flurry of punches: impact stars popping up one after another
        g.globalAlpha = a;
        const n = Math.floor(t * 18);
        for (let j = Math.max(0, n - 6); j <= n; j++) {
          const x = W * (0.2 + hs(j) * 0.6);
          const y = H * (0.25 + hs(j + 9) * 0.5);
          const age = t * 18 - j;
          const r = 30 + age * 24;
          g.fillStyle = j % 2 ? "#ffd54a" : "#ff5a3c";
          g.globalAlpha = a * Math.max(0, 1 - age / 7);
          g.beginPath();
          for (let k = 0; k < 16; k++) {
            const rr = k % 2 ? r * 0.55 : r;
            const aa = (k / 16) * Math.PI * 2 + j;
            g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
          }
          g.closePath();
          g.fill();
        }
        g.globalAlpha = a * 0.4;
        g.strokeStyle = "#fff";
        g.lineWidth = 2;
        for (let i = 0; i < 26; i++) {
          const ang = hs(i) * 6.28;
          g.beginPath();
          g.moveTo(W / 2 + Math.cos(ang) * 420, H / 2 + Math.sin(ang) * 300);
          g.lineTo(W / 2 + Math.cos(ang) * 160, H / 2 + Math.sin(ang) * 110);
          g.stroke();
        }
        return true;
      }
      case "Poison": {
        // toxic rain and bubbling sludge
        g.globalAlpha = a;
        g.strokeStyle = "#c46bff";
        g.lineWidth = 3;
        g.beginPath();
        for (let i = 0; i < 80; i++) {
          const x = (hs(i) * (W + 200) + t * 80) % (W + 200) - 100;
          const y = ((t * 700 * (0.7 + hs(i + 4) * 0.6) + hs(i + 8) * H) % (H + 40)) - 20;
          g.moveTo(x, y);
          g.lineTo(x - 8, y + 24);
        }
        g.stroke();
        for (let i = 0; i < 16; i++) {
          const k = (t * 0.7 + hs(i)) % 1;
          g.fillStyle = i % 2 ? "rgba(150,70,220,.55)" : "rgba(90,200,80,.5)";
          g.beginPath();
          g.arc(hs(i + 3) * W, H - k * 90, 10 + hs(i + 6) * 22 * (1 - k * 0.3), 0, Math.PI * 2);
          g.fill();
        }
        return true;
      }
      case "Ground": {
        // the floor splits open and rock rises
        g.globalAlpha = a;
        g.strokeStyle = "#ffcf7a";
        g.lineWidth = 5;
        const k = smooth(0, 0.5, p);
        for (let i = 0; i < 10; i++) {
          let x = at.x;
          let y = at.y + 40;
          const ang = (i / 10) * 6.28 + hs(i);
          g.beginPath();
          g.moveTo(x, y);
          for (let s = 0; s < 9 * k; s++) {
            x += Math.cos(ang + (hs(i * 3 + s) - 0.5) * 0.9) * 58;
            y += Math.sin(ang + (hs(i * 3 + s) - 0.5) * 0.9) * 36;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        g.fillStyle = "#8a6a45";
        for (let i = 0; i < 22; i++) {
          const x = hs(i) * W;
          const base = H * (0.45 + hs(i + 2) * 0.5);
          const y = base - Math.abs(Math.sin(t * 3 + i)) * 120 * k;
          g.globalAlpha = a;
          g.fillRect(x, y, 20 + hs(i + 4) * 20, 18 + hs(i + 5) * 14);
        }
        return true;
      }
      case "Flying": {
        // fast wind streaks and a dive
        g.globalAlpha = a * 0.85;
        g.strokeStyle = "#ffffff";
        for (let i = 0; i < 40; i++) {
          const y0 = hs(i) * H;
          const x0 = ((t * 1900 * (0.6 + hs(i + 3)) + hs(i + 5) * W) % (W + 500)) - 250;
          g.lineWidth = 1.5 + hs(i + 1) * 3;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x0 - 160 - hs(i) * 140, y0 + 36);
          g.stroke();
        }
        g.strokeStyle = "#bfe0ff";
        g.lineWidth = 6;
        g.beginPath();
        g.arc(at.x, at.y, 60 + p * 300, 0.3, 2.2);
        g.stroke();
        return true;
      }
      case "Psychic": {
        // pulsing rings and a turning pattern
        g.translate(at.x, at.y);
        g.globalAlpha = a * 0.8;
        for (let i = 0; i < 6; i++) {
          const k = (t * 0.8 + i / 6) % 1;
          g.strokeStyle = i % 2 ? "#ff7ad9" : "#c9a0ff";
          g.lineWidth = 5 * (1 - k) + 1;
          g.beginPath();
          g.arc(0, 0, 40 + k * 520, 0, Math.PI * 2);
          g.stroke();
        }
        g.rotate(t * 1.1);
        g.strokeStyle = "#ffffff";
        g.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
          g.rotate(Math.PI / 6);
          g.beginPath();
          g.ellipse(120, 0, 120 + p * 120, 40, 0, 0, Math.PI * 2);
          g.stroke();
        }
        return true;
      }
      case "Bug": {
        // slashes cut across the screen and a web spreads
        g.globalAlpha = a;
        g.strokeStyle = "#b8e04a";
        g.lineWidth = 3;
        for (let i = 0; i < 14; i++) {
          const k = smooth(i * 0.045, i * 0.045 + 0.15, p);
          const x = W * hs(i);
          const y = H * hs(i + 5);
          g.lineWidth = 6 * (1 - k * 0.5);
          g.beginPath();
          g.moveTo(x - 150 * k, y - 90 * k);
          g.lineTo(x + 150 * k, y + 90 * k);
          g.stroke();
        }
        g.strokeStyle = "rgba(255,255,255,.7)";
        g.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * 6.28;
          g.beginPath();
          g.moveTo(at.x, at.y);
          g.lineTo(at.x + Math.cos(ang) * 600 * p, at.y + Math.sin(ang) * 420 * p);
          g.stroke();
        }
        for (let r = 1; r <= 5; r++) {
          g.beginPath();
          for (let i = 0; i <= 12; i++) {
            const ang = (i / 12) * 6.28;
            g.lineTo(at.x + Math.cos(ang) * r * 110 * p, at.y + Math.sin(ang) * r * 76 * p);
          }
          g.stroke();
        }
        return true;
      }
      case "Rock": {
        // boulders crash down from above
        g.globalAlpha = a;
        for (let i = 0; i < 16; i++) {
          const start = i * 0.045;
          const k = clamp((p - start) / 0.35, 0, 1);
          const x = W * (0.08 + hs(i) * 0.84);
          const y = -80 + k * (H * (0.4 + hs(i + 3) * 0.5) + 80);
          const r = 22 + hs(i + 6) * 26;
          g.fillStyle = i % 2 ? "#9b8a6a" : "#7d7060";
          g.beginPath();
          for (let s = 0; s < 7; s++) {
            const aa = (s / 7) * 6.28 + t + i;
            const rr = r * (0.75 + hs(i * 9 + s) * 0.4);
            g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
          }
          g.closePath();
          g.fill();
          if (k >= 1) {
            g.fillStyle = "rgba(220,200,160,.35)";
            g.beginPath();
            g.arc(x, y + r * 0.4, r * (1 + (p - start - 0.35) * 5), 0, 6.28);
            g.fill();
          }
        }
        return true;
      }
      case "Ghost": {
        // spirits drift around with glowing eyes
        g.globalAlpha = a * 0.7;
        g.fillStyle = "rgba(60,20,110,.35)";
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 9; i++) {
          const ang = t * (0.6 + hs(i) * 0.5) + i;
          const x = W / 2 + Math.cos(ang) * (180 + hs(i + 2) * 260);
          const y = H / 2 + Math.sin(ang * 1.3) * (90 + hs(i + 4) * 150);
          const s = 34 + hs(i + 6) * 30;
          const gr = g.createRadialGradient(x, y, 0, x, y, s * 1.6);
          gr.addColorStop(0, "rgba(220,190,255,.9)");
          gr.addColorStop(1, "rgba(120,60,200,0)");
          g.globalAlpha = a * 0.85;
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x, y, s * 1.6, 0, 6.28);
          g.fill();
          g.fillStyle = "#1a0a2e";
          g.beginPath();
          g.arc(x - s * 0.3, y - s * 0.1, 4, 0, 6.28);
          g.arc(x + s * 0.3, y - s * 0.1, 4, 0, 6.28);
          g.fill();
        }
        return true;
      }
      case "Dragon": {
        // a serpent of energy sweeps across, with a roaring burst
        g.globalAlpha = a;
        const head = smooth(0, 0.8, p) * (W + 300) - 150;
        for (let i = 0; i < 40; i++) {
          const x = head - i * 22;
          const y = H * 0.5 + Math.sin(x * 0.012 + t * 5) * 130;
          const r = 34 - i * 0.6;
          if (r <= 2) continue;
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, "#ffffff");
          gr.addColorStop(0.4, i % 2 ? "#7b5cff" : "#4aa8ff");
          gr.addColorStop(1, "rgba(80,40,200,0)");
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x, y, r, 0, 6.28);
          g.fill();
        }
        g.strokeStyle = "#b9a4ff";
        g.lineWidth = 5;
        g.beginPath();
        g.arc(at.x, at.y, 40 + p * 360, 0, 6.28);
        g.stroke();
        return true;
      }
      case "Dark": {
        // a black hole opens and pulls everything in
        g.globalCompositeOperation = "source-over";
        const cx = W / 2;
        const cy = H * 0.5;
        const r = 20 + smooth(0, 0.6, p) * 150;
        g.globalAlpha = a;
        for (let i = 0; i < 50; i++) {
          const k = (t * 0.9 + hs(i)) % 1;
          const ang = hs(i + 3) * 6.28 + k * 4;
          const rr = 520 * (1 - k) + r;
          g.fillStyle = i % 3 ? "#9b6bff" : "#ffffff";
          g.beginPath();
          g.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.6, 2.5, 0, 6.28);
          g.fill();
        }
        const gr = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.9);
        gr.addColorStop(0, "#000000");
        gr.addColorStop(0.5, "rgba(130,60,220,.9)");
        gr.addColorStop(1, "rgba(130,60,220,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, cy, r * 1.9, 0, 6.28);
        g.fill();
        g.fillStyle = "#000";
        g.beginPath();
        g.arc(cx, cy, r, 0, 6.28);
        g.fill();
        return true;
      }
      case "Steel": {
        // a spinning drill of metal with sparks
        g.translate(at.x, at.y);
        g.globalAlpha = a;
        g.rotate(t * 9);
        for (let i = 0; i < 10; i++) {
          g.rotate(Math.PI / 5);
          const gr = g.createLinearGradient(0, 0, 420 * (0.4 + p), 0);
          gr.addColorStop(0, "#ffffff");
          gr.addColorStop(1, "#7f95aa");
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(0, -12);
          g.lineTo(420 * (0.4 + p), -2);
          g.lineTo(420 * (0.4 + p), 2);
          g.lineTo(0, 12);
          g.closePath();
          g.fill();
        }
        g.rotate(-t * 9);
        for (let i = 0; i < 28; i++) {
          const ang = hs(i + Math.floor(t * 20)) * 6.28;
          const rr = 60 + hs(i + 9) * 340;
          g.fillStyle = "#ffe9a0";
          g.fillRect(Math.cos(ang) * rr, Math.sin(ang) * rr, 3, 3);
        }
        return true;
      }
      case "Fairy": {
        // twinkling stars and a rainbow ring
        g.globalAlpha = a;
        for (let i = 0; i < 40; i++) {
          const tw = 0.5 + 0.5 * Math.sin(t * 8 + i * 2);
          const x = hs(i) * W;
          const y = hs(i + 7) * H;
          const r = (6 + hs(i + 3) * 14) * tw;
          g.fillStyle = ["#ffc2e6", "#ffffff", "#ffe27a", "#c8b6ff"][i % 4]!;
          g.beginPath();
          for (let k = 0; k < 8; k++) {
            const rr = k % 2 ? r * 0.25 : r;
            const aa = (k / 8) * 6.28;
            g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
          }
          g.closePath();
          g.fill();
        }
        g.lineWidth = 7;
        ["#ff9ad5", "#ffd27a", "#9fe6ff", "#c8a0ff"].forEach((cc, i) => {
          g.strokeStyle = cc;
          g.beginPath();
          g.arc(at.x, at.y, 70 + i * 12 + p * 260, 0, 6.28);
          g.stroke();
        });
        return true;
      }
      default:
        return false;
    }
  }

  /** Weather over the whole screen: a tint and a few things falling or drifting. */
  private drawField(g: CanvasRenderingContext2D, S: State) {
    if (S.field === "none") return;
    g.save();
    if (S.field === "sun") {
      const gr = g.createRadialGradient(ARENA.W * 0.9, 0, 20, ARENA.W * 0.9, 0, 760);
      gr.addColorStop(0, "rgba(255,210,90,.34)");
      gr.addColorStop(1, "rgba(255,180,60,.05)");
      g.fillStyle = gr;
      g.fillRect(0, 0, ARENA.W, ARENA.H);
    } else if (S.field === "rain") {
      g.fillStyle = "rgba(40,70,130,.18)";
      g.fillRect(0, 0, ARENA.W, ARENA.H);
      g.strokeStyle = "rgba(190,215,255,.45)";
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i < 70; i++) {
        const x = (i * 97 + this.t * 140) % (ARENA.W + 80) - 40;
        const y = (i * 53 + this.t * 900) % (ARENA.H + 40) - 20;
        g.moveTo(x, y);
        g.lineTo(x - 7, y + 20);
      }
      g.stroke();
    } else if (S.field === "sand") {
      g.fillStyle = "rgba(190,140,70,.2)";
      g.fillRect(0, 0, ARENA.W, ARENA.H);
      g.fillStyle = "rgba(235,200,140,.5)";
      for (let i = 0; i < 90; i++) {
        const x = (i * 131 + this.t * 420) % (ARENA.W + 40) - 20;
        const y = (i * 71 + Math.sin(this.t * 2 + i) * 14) % ARENA.H;
        g.fillRect(x, y, 3, 2);
      }
    } else {
      g.fillStyle = "rgba(170,220,255,.14)";
      g.fillRect(0, 0, ARENA.W, ARENA.H);
      g.fillStyle = "rgba(240,250,255,.8)";
      for (let i = 0; i < 80; i++) {
        const x = (i * 113 + Math.sin(this.t + i) * 22 + this.t * 30) % ARENA.W;
        const y = (i * 61 + this.t * 120) % (ARENA.H + 20);
        g.beginPath();
        g.arc(x, y, 1.6 + (i % 3) * 0.7, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  private drawZones(g: CanvasRenderingContext2D, S: State) {
    for (const z of S.zones) {
      const c = col(z.type);
      if (!z.struck) {
        const prog = Math.max(0, Math.min(1, 1 - Math.max(0, z.delay) / Math.max(0.05, z.total)));
        const pulse = 0.5 + Math.sin(this.t * 14) * 0.5;
        g.save();
        if (z.shape === "circle") {
          const sky = z.team === -1;
          g.fillStyle = z.player ? `${c}33` : sky ? `rgba(255,225,70,${0.1 + prog * 0.22})` : `rgba(255,70,60,${0.1 + prog * 0.22})`;
          g.strokeStyle = z.player ? c : sky ? `rgba(255,${210 + pulse * 40},60,.95)` : `rgba(255,${90 + pulse * 80},70,.9)`;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(z.x, z.y, z.r, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          if ((z.mv.fx ?? z.mv.id) === "fireblast") {
            // the big blast comes down as a burning "大" of five flames, as in the video
            const sy = z.y - (1 - prog) * 320 - 20;
            const sz = z.r * (0.6 + prog * 0.5);
            g.save();
            g.translate(z.x, sy);
            g.rotate(Math.sin(this.t * 6) * 0.06);
            g.lineCap = "round";
            for (const [w, col2] of [[sz * 0.42, "rgba(255,90,20,.55)"], [sz * 0.24, "#ff8a1f"], [sz * 0.1, "#ffe08a"]] as const) {
              g.strokeStyle = col2;
              g.lineWidth = w;
              g.beginPath();
              g.moveTo(-sz, -sz * 0.18);
              g.lineTo(sz, -sz * 0.18);
              g.moveTo(0, -sz * 0.95);
              g.lineTo(0, sz * 0.2);
              g.moveTo(-sz * 0.05, -sz * 0.05);
              g.lineTo(-sz * 0.85, sz * 0.9);
              g.moveTo(sz * 0.05, -sz * 0.05);
              g.lineTo(sz * 0.85, sz * 0.9);
              g.stroke();
            }
            g.restore();
            if (Math.random() < 0.6) this.parts.push({ kind: "dot", x: z.x + rnd(-sz, sz), y: sy + rnd(-sz, sz), vx: rnd(-30, 30), vy: rnd(-60, 20), g: -40, life: 0.45, max: 0.45, size: rnd(2, 4.5), grow: 0, color: Math.random() < 0.5 ? "#ffd84d" : "#ff7a2a" });
          }
          if (z.type === "Dark" && z.mv.kind === "lob") {
            // a void opens: a black sphere with a violet rim and cracks running out of it
            const rr = z.r * (0.35 + prog * 0.65);
            g.save();
            g.translate(z.x, z.y - rr * 0.35);
            const gr = g.createRadialGradient(0, 0, rr * 0.2, 0, 0, rr * 1.35);
            gr.addColorStop(0, "#07010f");
            gr.addColorStop(0.7, "#1a0630");
            gr.addColorStop(0.86, "rgba(140,70,255,.95)");
            gr.addColorStop(1, "rgba(140,70,255,0)");
            g.fillStyle = gr;
            g.beginPath();
            g.arc(0, 0, rr * 1.35, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = "rgba(200,150,255,.8)";
            g.lineWidth = 1.5;
            for (let i = 0; i < 9; i++) {
              const a0 = (i / 9) * 6.28 + z.id;
              g.beginPath();
              g.moveTo(Math.cos(a0) * rr * 0.9, Math.sin(a0) * rr * 0.9);
              g.lineTo(Math.cos(a0 + 0.1) * rr * 1.5, Math.sin(a0 + 0.1) * rr * 1.3);
              g.lineTo(Math.cos(a0 - 0.05) * rr * 1.9, Math.sin(a0 - 0.05) * rr * 1.6);
              g.stroke();
            }
            g.restore();
          }
          // meteors, boulders and lightning fall toward the circle before they land
          if ((z.mv.fx ?? z.mv.id) === "dracometeor" || (z.mv.fx ?? z.mv.id) === "rockslide") {
            for (let i = 0; i < 5; i++) {
              const mx = z.x + (i - 2) * z.r * 0.42;
              const my = z.y - (1 - prog) * 420 - i * 34 + 10;
              g.save();
              g.globalCompositeOperation = "lighter";
              g.strokeStyle = (z.mv.fx ?? z.mv.id) === "dracometeor" ? "rgba(255,150,60,.6)" : "rgba(200,205,215,.5)";
              g.lineWidth = 6;
              g.beginPath();
              g.moveTo(mx, my);
              g.lineTo(mx - 10, my - 46);
              g.stroke();
              g.restore();
              g.fillStyle = (z.mv.fx ?? z.mv.id) === "dracometeor" ? "#ff9a3c" : "#8a8f99";
              g.beginPath();
              g.arc(mx, my, 10 + (i % 2) * 4, 0, Math.PI * 2);
              g.fill();
            }
          }
          g.fillStyle = z.player ? `${c}55` : z.team === -1 ? "rgba(255,225,70,.4)" : "rgba(255,90,70,.35)";
          g.beginPath();
          g.arc(z.x, z.y, z.r * Math.min(1, prog), 0, Math.PI * 2);
          g.fill();
        } else {
          const ang = Math.atan2(z.y2 - z.y, z.x2 - z.x);
          const L = Math.hypot(z.x2 - z.x, z.y2 - z.y);
          g.translate(z.x, z.y);
          g.rotate(ang);
          g.fillStyle = z.player ? `${c}22` : `rgba(255,70,60,${0.08 + prog * 0.2})`;
          g.fillRect(0, -z.r, L, z.r * 2);
          g.fillStyle = z.player ? `${c}66` : "rgba(255,90,70,.4)";
          g.fillRect(0, -z.r * Math.min(1, prog), L, z.r * 2 * Math.min(1, prog));
          g.strokeStyle = z.player ? c : "rgba(255,120,90,.9)";
          g.lineWidth = 2;
          g.strokeRect(0, -z.r, L, z.r * 2);
        }
        g.restore();
      } else if (z.mv.linger && z.shape === "circle") {
        this.drawWhirl(g, z);
      } else {
        // the strike itself
        const a = Math.max(0, z.life / (z.shape === "line" ? 0.3 : 0.35));
        g.save();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = a;
        g.fillStyle = c;
        if (z.shape === "circle") {
          const gr = g.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r * 1.2);
          gr.addColorStop(0, "#fff");
          gr.addColorStop(0.5, c);
          gr.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = gr;
          g.beginPath();
          g.arc(z.x, z.y, z.r * 1.2, 0, Math.PI * 2);
          g.fill();
          if ((z.mv.fx ?? z.mv.id) === "fireblast") {
            // flames spiking out of the ground in a star
            g.fillStyle = "#ff8a1f";
            g.beginPath();
            for (let i = 0; i < 24; i++) {
              const rr = i % 2 ? z.r * 0.7 : z.r * (1.25 + 0.2 * Math.sin(i * 3 + this.t * 30));
              const aa = (i / 24) * Math.PI * 2;
              g.lineTo(z.x + Math.cos(aa) * rr, z.y + Math.sin(aa) * rr * 0.7);
            }
            g.closePath();
            g.fill();
          }
        } else if ((z.mv.fx ?? z.mv.id) === "laser" && z.shape === "line") {
          // a thin bright laser with a glowing source
          const ang = Math.atan2(z.y2 - z.y, z.x2 - z.x);
          const L = Math.hypot(z.x2 - z.x, z.y2 - z.y);
          g.translate(z.x, z.y);
          g.rotate(ang);
          const w = z.r * 0.5;
          g.globalAlpha = a * 0.3;
          g.fillStyle = c;
          g.fillRect(0, -w * 1.9, L, w * 3.8);
          g.globalAlpha = a * 0.85;
          g.fillRect(0, -w * 0.45, L, w * 0.9);
          g.globalAlpha = a;
          g.fillStyle = "#ffffff";
          g.fillRect(0, -1.6, L, 3.2);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, z.r * 1.3);
          gr.addColorStop(0, "#fff");
          gr.addColorStop(0.4, c);
          gr.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = gr;
          g.beginPath();
          g.arc(0, 0, z.r * 1.3, 0, Math.PI * 2);
          g.fill();
        } else if (z.type === "Electric") {
          drawLightning(g, z.x, z.y, z.x2, z.y2, "#ffe14d", a, z.id + Math.floor(this.t * 20), 5);
        } else {
          const ang = Math.atan2(z.y2 - z.y, z.x2 - z.x);
          const L = Math.hypot(z.x2 - z.x, z.y2 - z.y);
          g.translate(z.x, z.y);
          g.rotate(ang);
          const gr = g.createLinearGradient(0, -z.r, 0, z.r);
          gr.addColorStop(0, "rgba(0,0,0,0)");
          gr.addColorStop(0.5, "#fff");
          gr.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = gr;
          g.fillRect(0, -z.r * 1.3, L, z.r * 2.6);
          g.fillStyle = c;
          g.globalAlpha = a * 0.6;
          g.fillRect(0, -z.r, L, z.r * 2);
          if ((z.mv.fx ?? z.mv.id) === "hyperbeam" || z.type === "Psychic") {
            // bright core and rings travelling along the beam
            g.globalAlpha = a;
            g.fillStyle = "#ffffff";
            g.fillRect(0, -z.r * 0.38, L, z.r * 0.76);
            g.strokeStyle = "#ffffff";
            g.lineWidth = 2.5;
            for (let d = (this.t * 420) % 64; d < L; d += 64) {
              g.beginPath();
              g.ellipse(d, 0, z.r * 0.22, z.r * 1.15, 0, 0, Math.PI * 2);
              g.stroke();
            }
          }
        }
        g.restore();
      }
    }
  }

  /** A real fire tornado: a glowing core, thick turning bands of flame and tongues of fire licking up from every band. */
  private drawFireSpin(g: CanvasRenderingContext2D, z: State["zones"][number], grow: number, fade: number) {
    const R = z.r;
    const H = R * 2.6 * grow;
    const t = this.t;
    g.save();
    g.globalAlpha = fade;
    // scorched footprint and a hot glow on the floor
    g.fillStyle = "rgba(30,8,0,.35)";
    g.beginPath();
    g.ellipse(z.x, z.y + 4, R * 1.1, R * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "lighter";
    const fl = g.createRadialGradient(z.x, z.y, 0, z.x, z.y, R * 1.2);
    fl.addColorStop(0, "rgba(255,200,80,.55)");
    fl.addColorStop(1, "rgba(255,80,0,0)");
    g.fillStyle = fl;
    g.beginPath();
    g.ellipse(z.x, z.y, R * 1.2, R * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    // the bright core column
    const core = g.createLinearGradient(0, z.y, 0, z.y - H);
    core.addColorStop(0, "rgba(255,240,170,.8)");
    core.addColorStop(0.5, "rgba(255,150,40,.45)");
    core.addColorStop(1, "rgba(220,50,10,0)");
    g.fillStyle = core;
    g.beginPath();
    g.moveTo(z.x - R * 0.3, z.y);
    g.lineTo(z.x - R * 0.7, z.y - H);
    g.lineTo(z.x + R * 0.7, z.y - H);
    g.lineTo(z.x + R * 0.3, z.y);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = "source-over";
    const N = 9;
    const flame = (x: number, y: number, w: number, hgt: number, rot: number, c: string) => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(-w, 0);
      g.quadraticCurveTo(-w * 1.05, -hgt * 0.5, 0, -hgt);
      g.quadraticCurveTo(w * 1.05, -hgt * 0.5, w, 0);
      g.closePath();
      g.fill();
      g.restore();
    };
    // bands drawn from the top down, the far half first and the near half over it
    for (let pass = 0; pass < 2; pass++) {
      for (let k = N - 1; k >= 0; k--) {
        const h = k / (N - 1);
        const cy = z.y - h * H;
        const rx = R * (0.4 + 0.72 * h) * Math.max(0.2, grow);
        const ry = rx * 0.32;
        const ph = t * (6.5 - h * 1.5) + k * 0.8;
        const heat = 1 - h;
        const band = heat > 0.66 ? "#ffd05a" : heat > 0.33 ? "#ff8a24" : "#d93a14";
        const dim = heat > 0.66 ? "#ff9a2e" : heat > 0.33 ? "#e5521a" : "#8a1c0a";
        const a0 = ph + pass * Math.PI;
        const a1 = a0 + Math.PI * 0.95;
        // a thick curved band: outer edge out, inner edge back
        const th = 11 - h * 4;
        g.fillStyle = pass ? band : dim;
        g.beginPath();
        g.ellipse(z.x, cy, rx, ry, 0, a0, a1);
        g.ellipse(z.x, cy - th * 0.6, rx * 0.92, ry * 0.92, 0, a1, a0, true);
        g.closePath();
        g.fill();
        // tongues of fire along the band
        const n = 6;
        for (let j = 0; j < n; j++) {
          const aa = a0 + ((j + 0.5) / n) * Math.PI * 0.95;
          const fx2 = z.x + Math.cos(aa) * rx;
          const fy2 = cy + Math.sin(aa) * ry;
          const flick = 0.75 + 0.35 * Math.sin(t * 22 + k * 3 + j * 1.9);
          flame(fx2, fy2, 4.2 + (1 - h) * 2.5, (13 + (1 - h) * 12) * flick, Math.cos(aa) * 0.35, pass ? (j % 2 ? "#ffe27a" : band) : dim);
        }
      }
    }
    g.restore();
    // sparks and smoke rising off the top
    if (Math.random() < 0.7) {
      const an = Math.random() * Math.PI * 2;
      const hh = Math.random();
      this.parts.push({ kind: "dot", x: z.x + Math.cos(an) * R * (0.4 + 0.7 * hh), y: z.y - hh * H, vx: Math.cos(an + 1.6) * 80, vy: rnd(-170, -90), g: -30, life: 0.7, max: 0.7, size: rnd(2, 4.2), grow: 0, color: Math.random() < 0.5 ? "#ffcf4d" : "#ff7a1f" });
    }
    if (Math.random() < 0.12) this.parts.push({ kind: "smoke", x: z.x + rnd(-R * 0.5, R * 0.5), y: z.y - H, vx: rnd(-20, 20), vy: -60, g: 0, life: 0.9, max: 0.9, size: rnd(8, 14), grow: 18, color: "#3a2a24" });
  }

  /** A tornado of fire, water or sand that stays where it landed: stacked turning rings that widen going up. */
  private drawWhirl(g: CanvasRenderingContext2D, z: State["zones"][number]) {
    const fx = z.mv.fx ?? z.mv.id;
    const pal: Record<string, [string, string, string, string]> = {
      firespin: ["#ff5a1a", "#ffa62e", "#ffe27a", "#7a1c0c"],
      whirlpool: ["#2f8fe0", "#8fd2ff", "#ffffff", "#12407a"],
      sandtomb: ["#a8855a", "#d9bd8a", "#efe0b8", "#5c4128"],
    };
    const [c0, c1, c2, dark] = pal[fx] ?? pal.firespin!;
    const total = z.mv.linger ?? 2.5;
    const age = total - z.life;
    const grow = Math.min(1, age / 0.35);
    const fade = Math.min(1, z.life / 0.45);
    const R = z.r;
    if (fx === "firespin") {
      this.drawFireSpin(g, z, grow, fade);
      return;
    }
    g.save();
    g.globalAlpha = fade;
    // the footprint
    g.fillStyle = "rgba(0,0,0,.22)";
    g.beginPath();
    g.ellipse(z.x, z.y + 4, R * 1.05, R * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = c1;
    g.globalAlpha = fade * 0.55;
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(z.x, z.y, R, R * 0.36, 0, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = fade;
    const N = 12;
    for (let k = 0; k < N; k++) {
      const h = k / (N - 1);
      const cy = z.y - h * R * 2.5 * grow;
      const rx = R * (0.32 + 0.7 * h) * grow;
      const ry = rx * 0.3;
      const ph = this.t * (fx === "whirlpool" ? 5 : 7) + k * 0.75;
      g.lineCap = "round";
      g.strokeStyle = k % 3 === 0 ? c2 : k % 2 ? c0 : c1;
      g.lineWidth = 8 - h * 4;
      g.beginPath();
      g.ellipse(z.x, cy, rx, ry, 0, ph, ph + Math.PI * 1.25);
      g.stroke();
      g.strokeStyle = dark;
      g.globalAlpha = fade * 0.45;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(z.x, cy + 4, rx, ry, 0, ph + 0.4, ph + Math.PI * 1.1);
      g.stroke();
      g.globalAlpha = fade;
      if (fx === "firespin") {
        // flames spiking off the edge of each ring
        g.fillStyle = k % 2 ? c1 : c2;
        const ex = z.x + Math.cos(ph + Math.PI * 1.25) * rx;
        const ey = cy + Math.sin(ph + Math.PI * 1.25) * ry;
        g.beginPath();
        g.moveTo(ex - 4, ey);
        g.lineTo(ex + 1, ey - 12 - h * 6);
        g.lineTo(ex + 5, ey + 2);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
    if (Math.random() < 0.5) {
      const an = Math.random() * Math.PI * 2;
      this.parts.push({ kind: "dot", x: z.x + Math.cos(an) * R * 0.9, y: z.y + Math.sin(an) * R * 0.3, vx: Math.cos(an + 1.6) * 90, vy: rnd(-200, -110), g: fx === "firespin" ? -40 : 120, life: 0.7, max: 0.7, size: rnd(2, 4), grow: 0, color: fx === "firespin" ? (Math.random() < 0.5 ? c1 : c2) : c1 });
    }
  }

  /** Rocks rising off the floor in a psychic pulse: they bob for a few seconds, then drop and crumble. */
  private drawRocks(g: CanvasRenderingContext2D, dt: number) {
    if (!this.rocks.length) return;
    for (const r of this.rocks) {
      r.t += dt;
      r.rot += r.vr * dt;
    }
    const keep: typeof this.rocks = [];
    for (const r of this.rocks) {
      const up = smooth(0, 0.8, r.t);
      const down = r.t > r.max - 0.5 ? smooth(r.max - 0.5, r.max, r.t) : 0;
      const h = r.hMax * up * (1 - down) + Math.sin(this.t * 2.2 + r.seed) * 5 * up;
      if (r.t >= r.max) {
        for (let i = 0; i < 6; i++) this.parts.push({ kind: "dot", x: r.x + rnd(-8, 8), y: r.y, vx: rnd(-90, 90), vy: rnd(-160, -40), g: 520, life: 0.6, max: 0.6, size: rnd(2.5, 5), grow: 0, color: "#8a7a68" });
        continue;
      }
      keep.push(r);
      const alpha = Math.min(1, up * 1.6);
      g.save();
      // shadow on the floor
      g.globalAlpha = 0.28 * alpha;
      g.fillStyle = "#000";
      g.beginPath();
      g.ellipse(r.x, r.y + 6, r.size * (1 - h / 260), r.size * 0.4, 0, 0, Math.PI * 2);
      g.fill();
      // the rock
      g.translate(r.x, r.y - h);
      g.rotate(r.rot);
      g.globalAlpha = alpha;
      const pts: [number, number][] = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const rr = r.size * (0.75 + 0.3 * Math.sin(i * 2.7 + r.seed));
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.85]);
      }
      g.fillStyle = "#6d6258";
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.fill();
      g.fillStyle = "#9a8d7e";
      g.beginPath();
      g.moveTo(pts[0]![0], pts[0]![1]);
      g.lineTo(pts[1]![0], pts[1]![1]);
      g.lineTo(pts[2]![0], pts[2]![1]);
      g.lineTo(0, 0);
      g.closePath();
      g.fill();
      g.strokeStyle = "#2f2822";
      g.lineWidth = 1.5;
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.stroke();
      // a purple glow underneath and a few motes
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.16 * alpha;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r.size * 1.6);
      gr.addColorStop(0, "#d28bff");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r.size * 1.6, 0, Math.PI * 2);
      g.fill();
      g.restore();
      if (Math.random() < 0.05) this.parts.push({ kind: "dot", x: r.x + rnd(-r.size, r.size), y: r.y - h + r.size * 0.5, vx: 0, vy: -26, g: 0, life: 0.8, max: 0.8, size: 2, grow: 0, color: "#e0b0ff" });
    }
    this.rocks = keep;
  }

  /** A dotted pink thread from the holder to a foe it is lifting. */
  private drawTethers(g: CanvasRenderingContext2D, S: State) {
    for (const o of S.fighters) {
      if (!(o.grabT > 0)) continue;
      const by = S.fighters.find((x) => x.id === o.grabBy);
      if (!by) continue;
      g.save();
      g.strokeStyle = "#ffb3ee";
      g.lineWidth = 2.2;
      g.globalAlpha = 0.85;
      g.setLineDash([2, 8]);
      g.lineDashOffset = -this.t * 40;
      g.beginPath();
      g.moveTo(by.x, by.y - by.r * 0.6);
      g.lineTo(o.x, o.y - o.r * 0.6 - 24);
      g.stroke();
      g.restore();
    }
  }

  /** Onix and Steelix are drawn here instead of from a picture: a faceted stone head and a body of linked stones. */
  private drawRockSerpent(g: CanvasRenderingContext2D, f: Fighter, px: number, py: number, faceLeft: boolean, hist: { x: number; y: number }[], whiten: number, tint: string | null) {
    const steel = f.sp.id === "steelix";
    const mix = (hex: string, to: string, k: number) => {
      const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
      return `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * k)).join(",")})`;
    };
    let base = steel ? "#8d97a3" : "#7f98a3";
    let light = steel ? "#c9d2db" : "#b9cfd8";
    let dark = steel ? "#4f5964" : "#4a606b";
    if (tint) {
      base = mix(base.startsWith("#") ? base : "#7f98a3", tint, 0.5);
      light = mix(light, tint, 0.4);
    }
    const col2 = (c: string) => (whiten > 0 ? mix(c.startsWith("#") ? c : "#8fa6b0", "#ffffff", Math.min(1, whiten)) : c);
    const dir = faceLeft ? -1 : 1;
    const R = f.r * 1.35;
    const N = 10;
    const t = this.t;
    const moving = Math.hypot((hist[0]?.x ?? 0) - (hist[6]?.x ?? 0), (hist[0]?.y ?? 0) - (hist[6]?.y ?? 0)) > 4;
    const oy = py - f.y;
    const segs: { x: number; y: number; r: number; a: number }[] = [];
    let cx = px;
    let cy = py;
    for (let i = 1; i <= N; i++) {
      const h = hist[Math.min(hist.length - 1, i * 3)];
      let dx = (h?.x ?? cx) - (cx - 0);
      let dy = (h?.y ?? f.y) + oy - cy;
      let d = Math.hypot(dx, dy);
      if (d < 1) {
        dx = -dir;
        dy = 0.15;
        d = Math.hypot(dx, dy);
      }
      const gap = R * 0.88;
      const sway = Math.sin(t * (moving ? 6 : 2) - i * 0.85) * R * (moving ? 0.28 : 0.12);
      cx += (dx / d) * gap;
      cy += (dy / d) * gap;
      segs.push({ x: cx + (-dy / d) * sway, y: cy + (dx / d) * sway, r: R * (1.08 - i * 0.05), a: i });
    }
    g.save();
    g.lineJoin = "round";
    // the shadow under the whole body
    g.fillStyle = "rgba(0,0,0,.22)";
    for (const sg of [{ x: px, y: py, r: R }, ...segs]) {
      g.beginPath();
      g.ellipse(sg.x, sg.y + sg.r * 0.9, sg.r * 0.95, sg.r * 0.33, 0, 0, Math.PI * 2);
      g.fill();
    }
    const block = (x: number, y: number, r: number, k: number) => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + k * 0.5;
        const rr = r * (0.88 + 0.16 * Math.sin(i * 2.1 + k * 1.7));
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92]);
      }
      g.fillStyle = col2(base);
      g.beginPath();
      pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
      g.closePath();
      g.fill();
      g.fillStyle = col2(light);
      g.beginPath();
      g.moveTo(pts[5]![0], pts[5]![1]);
      g.lineTo(pts[6]![0], pts[6]![1]);
      g.lineTo(pts[7]![0], pts[7]![1]);
      g.lineTo(pts[0]![0], pts[0]![1]);
      g.lineTo(x, y);
      g.closePath();
      g.fill();
      g.fillStyle = col2(dark);
      g.beginPath();
      g.moveTo(pts[1]![0], pts[1]![1]);
      g.lineTo(pts[2]![0], pts[2]![1]);
      g.lineTo(pts[3]![0], pts[3]![1]);
      g.lineTo(pts[4]![0], pts[4]![1]);
      g.lineTo(x, y);
      g.closePath();
      g.fill();
      g.strokeStyle = "#26323b";
      g.lineWidth = 2;
      g.beginPath();
      pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
      g.closePath();
      g.stroke();
      if (steel && k % 2 === 0) {
        g.fillStyle = col2(light);
        g.beginPath();
        g.moveTo(x - r * 0.18, y - r * 0.75);
        g.lineTo(x, y - r * 1.25);
        g.lineTo(x + r * 0.18, y - r * 0.75);
        g.closePath();
        g.fill();
        g.stroke();
      }
    };
    for (let i = N - 1; i >= 0; i--) block(segs[i]!.x, segs[i]!.y, segs[i]!.r, i + 1);
    // the head
    g.translate(px, py);
    g.scale(dir, 1);
    const H = R * 0.95;
    const skull: [number, number][] = [[-0.95, 0.15], [-0.6, -0.85], [0.35, -1.0], [1.1, -0.35], [1.35, 0.3], [0.7, 0.75], [-0.55, 0.85]];
    g.fillStyle = col2(base);
    g.beginPath();
    skull.forEach(([a, b], i) => (i ? g.lineTo(a * H, b * H) : g.moveTo(a * H, b * H)));
    g.closePath();
    g.fill();
    g.fillStyle = col2(light);
    g.beginPath();
    g.moveTo(-0.6 * H, -0.85 * H);
    g.lineTo(0.35 * H, -1.0 * H);
    g.lineTo(1.1 * H, -0.35 * H);
    g.lineTo(0.2 * H, -0.2 * H);
    g.closePath();
    g.fill();
    g.fillStyle = col2(dark);
    g.beginPath();
    g.moveTo(-0.95 * H, 0.15 * H);
    g.lineTo(-0.55 * H, 0.85 * H);
    g.lineTo(0.7 * H, 0.75 * H);
    g.lineTo(0.1 * H, 0.3 * H);
    g.closePath();
    g.fill();
    g.strokeStyle = "#26323b";
    g.lineWidth = 2.2;
    g.beginPath();
    skull.forEach(([a, b], i) => (i ? g.lineTo(a * H, b * H) : g.moveTo(a * H, b * H)));
    g.closePath();
    g.stroke();
    // the horn
    g.fillStyle = col2(light);
    g.beginPath();
    g.moveTo(0.0 * H, -0.95 * H);
    g.lineTo(0.3 * H, -1.85 * H);
    g.lineTo(0.55 * H, -0.95 * H);
    g.closePath();
    g.fill();
    g.stroke();
    // a fierce eye, the mouth and two teeth
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(0.45 * H, -0.3 * H);
    g.lineTo(1.0 * H, -0.12 * H);
    g.lineTo(0.55 * H, 0.02 * H);
    g.closePath();
    g.fill();
    g.fillStyle = "#c0392b";
    g.beginPath();
    g.arc(0.72 * H, -0.1 * H, H * 0.07, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#26323b";
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(0.35 * H, -0.42 * H);
    g.lineTo(1.05 * H, -0.2 * H);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-0.1 * H, 0.45 * H);
    g.lineTo(1.2 * H, 0.38 * H);
    g.stroke();
    g.fillStyle = "#f4f4f4";
    for (const tx of [0.45, 0.85]) {
      g.beginPath();
      g.moveTo(tx * H, 0.42 * H);
      g.lineTo((tx + 0.1) * H, 0.62 * H);
      g.lineTo((tx + 0.2) * H, 0.4 * H);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  /** The line, fan or circle that shows where the move being aimed will go. */
  private drawAim(g: CanvasRenderingContext2D) {
    const rt = this.reticle;
    if (rt) {
      g.save();
      g.strokeStyle = "rgba(255,255,255,.55)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(rt.x, rt.y, 9, 0, Math.PI * 2);
      g.moveTo(rt.x - 14, rt.y);
      g.lineTo(rt.x - 5, rt.y);
      g.moveTo(rt.x + 5, rt.y);
      g.lineTo(rt.x + 14, rt.y);
      g.moveTo(rt.x, rt.y - 14);
      g.lineTo(rt.x, rt.y - 5);
      g.moveTo(rt.x, rt.y + 5);
      g.lineTo(rt.x, rt.y + 14);
      g.stroke();
      g.restore();
    }
    const a = this.aimShow;
    if (!a || !a.from.alive) return;
    const { from: f, mv } = a;
    const reach = moveReach(mv);
    const dx = a.x - f.x;
    const dy = a.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const c = TYPE_COLOR[mv.type] ?? "#ffffff";
    const pulse = 0.55 + Math.sin(this.t * 10) * 0.2;
    g.save();
    g.lineCap = "round";
    const line = (ang: number, len: number, w: number, alpha: number) => {
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const ex = f.x + (ux * cs - uy * sn) * len;
      const ey = f.y + (ux * sn + uy * cs) * len;
      g.strokeStyle = c;
      g.globalAlpha = alpha * pulse;
      g.lineWidth = w;
      g.setLineDash([10, 8]);
      g.beginPath();
      g.moveTo(f.x + (ux * cs - uy * sn) * f.r, f.y + (ux * sn + uy * cs) * f.r);
      g.lineTo(ex, ey);
      g.stroke();
      g.setLineDash([]);
      return [ex, ey] as const;
    };
    switch (mv.kind) {
      case "nova":
        g.globalAlpha = 0.18 * pulse;
        g.fillStyle = c;
        g.beginPath();
        g.arc(f.x, f.y, reach, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 0.8 * pulse;
        g.strokeStyle = c;
        g.lineWidth = 2;
        g.setLineDash([8, 6]);
        g.stroke();
        break;
      case "lob": {
        const dist = Math.min(d, reach);
        const tx = f.x + ux * dist;
        const ty = f.y + uy * dist;
        line(0, dist, 2, 0.6);
        g.globalAlpha = 0.2 * pulse;
        g.fillStyle = c;
        g.beginPath();
        g.arc(tx, ty, 66, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 0.9 * pulse;
        g.strokeStyle = c;
        g.lineWidth = 2.5;
        g.setLineDash([8, 6]);
        g.stroke();
        break;
      }
      case "spread":
        for (const off of [-0.42, -0.21, 0, 0.21, 0.42]) line(off, reach, off === 0 ? 3 : 2, off === 0 ? 0.8 : 0.45);
        break;
      case "beam":
      case "bolt":
        line(0, reach, 7, 0.28);
        line(0, reach, 2, 0.9);
        break;
      case "guard":
      case "heal":
      case "buff":
        break;
      default: {
        const [ex, ey] = line(0, reach, 3, 0.85);
        g.globalAlpha = 0.9 * pulse;
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(ex, ey);
        g.lineTo(ex - ux * 14 + uy * 7, ey - uy * 14 - ux * 7);
        g.lineTo(ex - ux * 14 - uy * 7, ey - uy * 14 + ux * 7);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
  }

  /** What a foe is about to do, drawn on the floor so it can be dodged. */
  private drawTelegraphs(g: CanvasRenderingContext2D, S: State) {
    for (const f of S.fighters) {
      if (!f.alive || !f.cast || f.isPlayer) continue;
      const mv = MOVES[f.sp.moves[f.cast.slot]!]!;
      const prog = 1 - f.cast.t / f.cast.total;
      const pulse = 0.5 + Math.sin(this.t * 16) * 0.5;
      g.save();
      g.strokeStyle = `rgba(255,${100 + pulse * 70},80,${0.4 + prog * 0.5})`;
      g.fillStyle = `rgba(255,80,60,${0.06 + prog * 0.16})`;
      g.lineWidth = 3;
      const ang = Math.atan2(f.cast.dy, f.cast.dx);
      g.translate(f.x, f.y);
      if (mv.kind === "nova") {
        g.beginPath();
        g.arc(0, 0, mv.range ?? 130, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      } else if (mv.kind === "dash") {
        g.rotate(ang);
        g.fillRect(0, -f.r, mv.range ?? 200, f.r * 2);
        g.strokeRect(0, -f.r, mv.range ?? 200, f.r * 2);
      } else if (mv.kind === "beam") {
        g.rotate(ang);
        const L = mv.range ?? 260;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(L, -L * 0.14);
        g.lineTo(L, L * 0.14);
        g.closePath();
        g.fill();
        g.stroke();
      } else {
        g.rotate(ang);
        const n = mv.kind === "spread" ? mv.n ?? 3 : 1;
        for (let i = 0; i < n; i++) {
          g.save();
          g.rotate((i - (n - 1) / 2) * 0.17);
          g.setLineDash([10, 8]);
          g.beginPath();
          g.moveTo(f.r, 0);
          g.lineTo(360, 0);
          g.stroke();
          g.restore();
        }
      }
      g.restore();
    }
  }

  private drawProjs(g: CanvasRenderingContext2D, S: State) {
    // streams (Hydro Pump, Flamethrower, Ice Beam...) are drawn as one continuous jet from the mouth, not as separate dots
    const streams = new Map<number, Proj[]>();
    for (const p of S.projs) {
      if (p.beam) {
        const l = streams.get(p.owner) ?? [];
        l.push(p);
        streams.set(p.owner, l);
        continue;
      }
      const c = col(p.type);
      drawShot(g, p, S.time - p.born, this.t);
      // a trail of the shot's own colour: embers for fire, droplets for water, sparks for the rest
      if (Math.random() < 0.7) {
        const ember = p.type === "Fire";
        this.parts.push({ kind: "dot", x: p.x + rnd(-3, 3), y: p.y + rnd(-3, 3), vx: -p.vx * 0.08 + rnd(-24, 24), vy: -p.vy * 0.08 + rnd(ember ? -50 : -20, 20), g: ember ? -60 : 0, life: ember ? 0.5 : 0.3, max: ember ? 0.5 : 0.3, size: rnd(2, ember ? 5 : 4), grow: 0, color: ember && Math.random() < 0.5 ? "#ffd84d" : c });
      }
    }
    for (const [owner, list] of streams) {
      const f = S.fighters.find((x) => x.id === owner);
      if (f) this.drawStream(g, f, list);
    }
  }

  /** One continuous jet from the attacker's mouth to the front-most drop, in the look of its type. */
  private drawStream(g: CanvasRenderingContext2D, f: Fighter, list: Proj[]) {
    const type = list[0]!.type;
    const c = col(type);
    // the line the jet follows: from the mouth through the drops, nearest first
    const sorted = list.map((p) => ({ x: p.x, y: p.y, d: Math.hypot(p.x - f.x, p.y - f.y), p })).sort((a, b) => a.d - b.d);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const ux = (last.x - f.x) / (last.d || 1);
    const uy = (last.y - f.y) / (last.d || 1);
    const mx = f.x + ux * f.r * 0.9;
    const my = f.y - f.r * 0.45 + uy * f.r * 0.5;
    const len = Math.hypot(last.x - mx, last.y - my);
    if (len < 6) return;
    const nx = -uy;
    const ny = ux;
    const t = this.t;
    void first;
    g.save();
    if (type === "Water") {
      // two thin streams twisting round each other, a bright core, spray at the tip
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      g.strokeStyle = "rgba(60,150,255,.3)";
      g.lineWidth = 16;
      g.beginPath();
      g.moveTo(mx, my);
      g.lineTo(last.x, last.y);
      g.stroke();
      for (const ph of [0, Math.PI]) {
        g.strokeStyle = ph ? "#9ddcff" : "#4aa8ff";
        g.lineWidth = 5;
        g.beginPath();
        for (let d = 0; d <= len; d += 8) {
          const w = Math.sin(d * 0.07 - t * 22 + ph) * (4 + Math.min(1, d / 120) * 5);
          const x = mx + ux * d + nx * w;
          const y = my + uy * d + ny * w;
          if (d === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.strokeStyle = "#ffffff";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(mx, my);
      g.lineTo(last.x, last.y);
      g.stroke();
    } else if (type === "Fire") {
      // a rolling tube of flame: stacked blobs, wider toward the end
      for (let d = 0; d <= len; d += 11) {
        const k = d / Math.max(1, len);
        const r = 7 + k * 17;
        const wob = Math.sin(d * 0.09 - t * 16) * 4;
        const x = mx + ux * d + nx * wob;
        const y = my + uy * d + ny * wob;
        blob(g, x, y, r, Math.floor(d / 11) + Math.floor(t * 10), "#ff6a1a", "#a82a08");
      }
      for (let d = 0; d <= len; d += 14) {
        const k = d / Math.max(1, len);
        const x = mx + ux * d + nx * Math.sin(d * 0.11 - t * 20) * 3;
        const y = my + uy * d + ny * Math.sin(d * 0.11 - t * 20) * 3;
        blob(g, x, y, 4 + k * 10, Math.floor(d / 14) + 40 + Math.floor(t * 12), "#ffd84d", "#ff9a2e");
      }
      g.globalCompositeOperation = "lighter";
      const gl = g.createRadialGradient(last.x, last.y, 0, last.x, last.y, 40);
      gl.addColorStop(0, "rgba(255,200,80,.8)");
      gl.addColorStop(1, "rgba(255,80,0,0)");
      g.fillStyle = gl;
      g.beginPath();
      g.arc(last.x, last.y, 40, 0, Math.PI * 2);
      g.fill();
    } else if (type === "Ice") {
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      g.strokeStyle = "rgba(120,210,255,.35)";
      g.lineWidth = 18;
      g.beginPath();
      g.moveTo(mx, my);
      g.lineTo(last.x, last.y);
      g.stroke();
      g.strokeStyle = "#bff0ff";
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(mx, my);
      g.lineTo(last.x, last.y);
      g.stroke();
      g.strokeStyle = "#ffffff";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(mx, my);
      g.lineTo(last.x, last.y);
      g.stroke();
      g.globalCompositeOperation = "source-over";
      for (let d = 14; d < len; d += 26) {
        const sx = mx + ux * d + nx * Math.sin(d + t * 4) * 9;
        const sy = my + uy * d + ny * Math.sin(d + t * 4) * 9;
        g.fillStyle = "#e8fbff";
        g.beginPath();
        g.moveTo(sx, sy - 6);
        g.lineTo(sx + 3.5, sy);
        g.lineTo(sx, sy + 6);
        g.lineTo(sx - 3.5, sy);
        g.closePath();
        g.fill();
      }
    } else {
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      for (const [w, col2, a] of [[18, c, 0.28], [9, c, 0.7], [3.5, "#ffffff", 0.95]] as const) {
        g.strokeStyle = col2;
        g.globalAlpha = a * (0.85 + Math.sin(t * 30) * 0.15);
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(mx, my);
        g.lineTo(last.x, last.y);
        g.stroke();
      }
    }
    g.restore();
    // a flare at the mouth and the glow where it ends
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const [x, y, r] of [[mx, my, 16], [last.x, last.y, 22]] as const) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.4, c);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // steam rises where water, fire and ice end (the white plume in the video); sparks for the rest
    if (Math.random() < 0.55) {
      if (type === "Water" || type === "Fire" || type === "Ice") this.parts.push({ kind: "smoke", x: last.x + rnd(-8, 8), y: last.y + rnd(-6, 6), vx: rnd(-18, 18), vy: rnd(-110, -60), g: 0, life: rnd(0.8, 1.2), max: 1.2, size: rnd(9, 15), grow: 26, color: type === "Fire" ? "#ffe9c8" : "#f2f8ff" });
      else this.parts.push({ kind: "dot", x: last.x, y: last.y, vx: rnd(-160, 160), vy: rnd(-160, 160), g: 0, life: 0.3, max: 0.3, size: rnd(2, 4), grow: 0, color: c });
    }
    if (type === "Water" && Math.random() < 0.5) this.parts.push({ kind: "dot", x: mx + ux * rnd(0, len), y: my + uy * rnd(0, len), vx: nx * rnd(-80, 80), vy: ny * rnd(-80, 80) - 20, g: 200, life: 0.35, max: 0.35, size: rnd(1.5, 3), grow: 0, color: "#e8f7ff" });
  }

  /** Draws a Pokémon's picture at a place, turned, stretched and tinted as asked. */
  private body(g: CanvasRenderingContext2D, im: Pic, id: string, x: number, y: number, size: number, faceLeft: boolean, sx: number, sy: number, rot: number, tint?: string, alpha = 1, wk?: { p: number; a: number }) {
    g.save();
    g.globalAlpha *= alpha;
    g.translate(x, y);
    g.rotate(rot);
    g.scale((faceLeft ? 1 : -1) * sx, sy);
    const k = size / Math.max(picW(im), picH(im), 1);
    const w = picW(im) * k;
    const h = picH(im) * k;
    g.imageSmoothingEnabled = false;
    const src = tint ? this.tinted(id, im, tint) : im;
    const x0 = -w / 2;
    const y0 = -h / 2 - size * 0.05;
    if (wk) {
      // a walking puppet: the body bobs, and the lower part is cut into a left and a right foot that step in turn
      const sw = picW(im);
      const sh = picH(im);
      const cut = 0.6;
      const a = wk.a * size;
      const bob = -Math.abs(Math.sin(wk.p)) * a * 0.5;
      g.drawImage(src, 0, 0, sw, sh * cut, x0, y0 + bob, w, h * cut);
      for (const side of [0, 1]) {
        const sn = Math.sin(wk.p + side * Math.PI);
        const lift = Math.max(0, sn) * a * 1.4;
        const swing = sn * a * 0.5;
        const sx0 = side * (sw / 2) - (side ? 1 : 0);
        const sww = sw / 2 + 1;
        g.drawImage(src, sx0, sh * cut - 1, sww, sh * (1 - cut) + 1, x0 + side * (w / 2) - (side ? w / sw : 0) + swing, y0 + h * cut - lift + bob * 0.4 - 1, sww * (w / sw), h * (1 - cut) + 1);
      }
    } else g.drawImage(src, x0, y0, w, h);
    g.restore();
  }

  private dust(x: number, y: number, color = "#cdb892") {
    this.parts.push({ kind: "smoke", x: x + rnd(-4, 4), y: y + rnd(-2, 3), vx: rnd(-30, 30), vy: rnd(-26, -4), g: 0, life: 0.5, max: 0.5, size: rnd(4, 7), grow: 16, color });
  }

  private drawFighter(g: CanvasRenderingContext2D, f: Fighter, S: State, isYou: boolean) {
    const t = this.t;
    const under = !!f.dash?.under;
    const speed = Math.hypot(f.mvx, f.mvy);
    const moving = speed > 30;
    const morph = this.morphs.get(f.id);
    const mt = morph ? morph.t : 99;

    // the picture: a Mega or Gigantamax form when there is one, and the plain Pokémon until it has loaded (or if there is none)
    let formId = f.dyna > 0 && f.gmax ? `${f.sp.id}-gmax` : f.form ? f.form.sprite : f.sp.id;
    if (morph && morph.kind !== "awaken" && mt < morph.swap) formId = f.sp.id; // the old body, until the change happens
    let usedId = formId;
    let im: Pic | null = this.load(formId, f.sp.num);
    const formMissing = !im && formId !== f.sp.id;
    if (formMissing) {
      usedId = f.sp.id;
      im = this.load(f.sp.id, f.sp.num);
    }
    // load the forms ahead of time, so a Mega or Gigantamax change does not wait for its picture
    if (f.megaForm) {
      this.load(f.megaForm.sprite, f.sp.num);
      this.loadAnim(f.megaForm.sprite, false);
    }
    if (f.gmax) this.load(`${f.sp.id}-gmax`, f.sp.num);
    this.loadAnim(f.sp.id, true);
    // the moving picture: a Showdown animation, front or back view by where it faces; the still one stays as the fallback
    const ps = this.poses.get(f.id) ?? { clock: 0, atk: 0, atkDir: 0, hurt: 0, hx: 0, hy: 0 };
    this.poses.set(f.id, ps);
    ps.clock += this.dtr * (moving ? 1 + Math.min(1.3, speed / 240) : 0.85);
    ps.atk = Math.max(0, ps.atk - this.dtr);
    ps.hurt = Math.max(0, ps.hurt - this.dtr);
    if (ps.aura) {
      ps.aura.t -= this.dtr;
      if (ps.aura.t <= 0) ps.aura = undefined;
    }
    const wantBack = Math.sin(f.face) < -0.6;
    const gif = this.loadAnim(usedId, wantBack) ?? (wantBack ? this.loadAnim(usedId, false) : null);
    const animated = !!gif && !formMissing;
    if (gif && animated) im = gif instanceof HTMLImageElement ? gif : frameAt(gif, ps.clock).el;
    // a transformation starts small (or normal) and grows into its new size
    let grow = 1;
    if (morph && (morph.kind === "dyna" || morph.kind === "mega")) {
      const k = Math.min(1, mt / 0.7);
      const from = morph.kind === "dyna" ? 1 / 1.55 : 1 / 1.12;
      grow = from + (1 - from) * easeOutBack(k);
    }
    const size = f.r * 4.1 * grow;
    const c = col(f.types[0] ?? "Normal");
    const faceLeft = Math.cos(f.face) < 0;

    // ---- how it moves: each kind of mover has its own bounce, lean and dust
    const phase = f.stride * (f.loco === "run" ? 0.085 : 0.06);
    const sway = clamp(f.mvx / 280, -1, 1);
    const idle = Math.sin(t * 2.2 + f.id) * 0.018;
    let lift = 0;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let shadowK = 1;
    switch (f.loco) {
      case "run":
        if (moving) {
          lift = Math.abs(Math.sin(phase * 1.3)) * 5.5;
          sx = 1.05 + Math.sin(phase * 2.6) * 0.07;
          sy = 1 - Math.sin(phase * 2.6) * 0.06;
          rot = sway * 0.17;
          if (Math.sin(phase * 1.3) > 0.97) this.dust(f.x - Math.sign(f.mvx || 1) * f.r * 0.6, f.y + f.r * 0.7);
        } else {
          sx = 1 + idle;
          sy = 1 - idle;
        }
        break;
      case "fly":
        lift = 20 + Math.sin(t * 7 + f.id) * 2.6 + (moving ? 0 : Math.sin(t * 2.4 + f.id) * 2);
        sy = 1 + Math.sin(t * 14 + f.id) * 0.035; // wings beating
        rot = sway * 0.22; // banking into turns
        shadowK = 0.7;
        if (moving && Math.random() < 0.2) this.parts.push({ kind: "streak", x: f.x + rnd(-f.r, f.r), y: f.y + rnd(-4, 8), vx: -f.mvx * 0.3, vy: rnd(-20, 10), g: 0, life: 0.25, max: 0.25, size: 6, grow: 0, color: "#e8f2ff" });
        break;
      case "float":
        lift = 11 + Math.sin(t * 2.3 + f.id) * 5;
        rot = Math.sin(t * 1.7 + f.id) * 0.06 + sway * 0.08;
        shadowK = 0.85;
        if (moving && Math.random() < 0.18) this.parts.push({ kind: "smoke", x: f.x + rnd(-6, 6), y: f.y - f.r * 0.3, vx: -f.mvx * 0.1, vy: rnd(-10, 6), g: 0, life: 0.6, max: 0.6, size: 6, grow: 14, color: "#c7b8ff" });
        break;
      case "slither":
        rot = moving ? Math.sin(phase * 0.9) * 0.2 : Math.sin(t * 1.5) * 0.04;
        sx = 1 + (moving ? Math.sin(phase * 1.8) * 0.05 : 0);
        break;
      case "surf":
        lift = Math.sin(t * 3 + f.id) * 2.5;
        rot = sway * 0.08;
        break;
      default:
        if (moving) {
          lift = Math.abs(Math.sin(phase)) * 3.5;
          sx = 1 + Math.sin(phase * 2) * 0.045;
          sy = 1 - Math.sin(phase * 2) * 0.045;
          rot = Math.sin(phase) * 0.06;
          if (Math.sin(phase) > 0.985) this.dust(f.x, f.y + f.r * 0.75, "#bfae8e");
        } else {
          sx = 1 + idle;
          sy = 1 - idle;
        }
    }
    if (animated) {
      // the real legs and wings are moving now, so the stand-in bounce and squash are turned down
      sx = 1 + (sx - 1) * 0.35;
      sy = 1 + (sy - 1) * 0.35;
      if (f.loco === "run") lift *= 0.55;
    } else if (moving) {
      // no moving picture: make the stand-in read as steps and wingbeats, not a slide
      if (f.loco === "run" || f.loco === "walk") {
        lift *= 2;
        sx = 1 + (sx - 1) * 1.8;
        sy = 1 + (sy - 1) * 1.8;
        rot += Math.sin(phase) * 0.2; // weight shifting from foot to foot
      } else if (f.loco === "fly") {
        sy *= 1 + Math.sin(t * 16 + f.id) * 0.07;
        sx *= 1 - Math.sin(t * 16 + f.id) * 0.05;
        lift += Math.sin(t * 8 + f.id) * 4;
      } else if (f.loco === "slither") rot += Math.sin(phase * 0.9) * 0.1;
    }
    // attack lunge (leans and darts toward the target, then settles) and hit recoil (knocked back, tilted)
    let ox = 0;
    let oy = 0;
    if (ps.atk > 0) {
      const k = Math.sin((1 - ps.atk / 0.32) * Math.PI);
      ox += Math.cos(ps.atkDir) * f.r * 0.85 * k;
      oy += Math.sin(ps.atkDir) * f.r * 0.5 * k;
      // stretches out along the attack, nose toward the target, as in the video
      sx *= 1 + 0.34 * k;
      sy *= 1 - 0.2 * k;
      rot += (faceLeft ? 1 : -1) * -Math.sin(ps.atkDir) * 0.65 * k;
    }
    if (ps.hurt > 0) {
      const k = Math.sin((1 - ps.hurt / 0.26) * Math.PI);
      ox += ps.hx * f.r * 0.55 * k;
      oy += ps.hy * f.r * 0.35 * k;
      rot += (ps.hx >= 0 ? 1 : -1) * 0.25 * k;
      sx *= 1 - 0.1 * k;
      sy *= 1 + 0.08 * k;
    }
    // the roll: flyers spin, floaters blink, burrowers sink, the rest tuck and tumble
    const rolling = f.dodge.t > 0;
    const rollP = rolling ? 1 - f.dodge.t / 0.3 : 0;
    let alpha = 1;
    let spin = 0;
    let sink = 0;
    if (rolling) {
      const dir = faceLeft ? -1 : 1;
      if (f.digger) {
        sink = Math.sin(rollP * Math.PI);
        if (Math.random() < 0.6) this.dust(f.x + rnd(-f.r, f.r), f.y + f.r * 0.7, "#8a6a45");
      } else if (f.loco === "float") alpha = 0.35;
      else if (f.loco === "slither" || f.loco === "surf") {
        sx *= 1.25;
        sy *= 0.8;
      } else spin = rollP * Math.PI * 2 * dir;
    }
    // wading: the legs go under the water and ripples spread
    const wet = f.inWater && !f.canFly && !under;
    if (wet) {
      lift -= f.r * 0.3;
      if (moving && Math.random() < 0.3) this.parts.push({ kind: "dot", x: f.x + rnd(-f.r, f.r), y: f.y + f.r * 0.4, vx: rnd(-40, 40), vy: rnd(-120, -40), g: 360, life: 0.5, max: 0.5, size: rnd(2, 4), grow: 0, color: "#cfeaff" });
    }
    if (f.grabT > 0) lift += 26 + Math.sin(t * 8 + f.id) * 3;
    if (f.flyT > 0) {
      lift += 14;
      spin = t * 18;
    }
    const stretch = f.dash && !under ? 1.18 : 1;

    // riding the water: a wake behind, and for Ice types a sheet of ice that grows along its path
    if (f.loco === "surf" && !under) {
      const hh = this.hist.get(f.id) ?? [];
      const n = Math.min(hh.length, moving ? 15 : 5);
      g.save();
      if (f.types.includes("Ice") && n > 2) {
        g.lineCap = "round";
        g.lineJoin = "round";
        const path = () => {
          g.beginPath();
          g.moveTo(f.x, f.y + f.r * 0.45);
          for (let i = 0; i < n; i += 2) g.lineTo(hh[i]!.x, hh[i]!.y + f.r * 0.45);
          g.stroke();
        };
        g.strokeStyle = "rgba(170,215,255,.9)";
        g.lineWidth = f.r * 2.1;
        path();
        g.strokeStyle = "rgba(232,247,255,.96)";
        g.lineWidth = f.r * 1.7;
        path();
        g.strokeStyle = "rgba(255,255,255,.7)";
        g.lineWidth = 1.5;
        for (let i = 1; i < n; i += 3) {
          const h = hh[i]!;
          g.beginPath();
          g.moveTo(h.x - f.r * 0.6, h.y + f.r * 0.35);
          g.lineTo(h.x + f.r * 0.1, h.y + f.r * 0.6);
          g.lineTo(h.x + f.r * 0.7, h.y + f.r * 0.4);
          g.stroke();
        }
      }
      // ripple rings and quick white dashes on the water
      g.strokeStyle = "rgba(255,255,255,.55)";
      g.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const k = (t * 1.1 + i * 0.5) % 1;
        g.globalAlpha = 1 - k;
        g.beginPath();
        g.ellipse(f.x, f.y + f.r * 0.6, f.r * (1.1 + k * 1.2), f.r * (0.4 + k * 0.5), 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 0.7;
      if (moving) {
        const dx = -f.mvx / (speed || 1);
        const dy = -f.mvy / (speed || 1);
        for (let i = 0; i < 6; i++) {
          const off = ((t * 3 + i * 0.37) % 1) * f.r * 3.2 + f.r;
          const sidew = (i - 2.5) * f.r * 0.45;
          const bx = f.x + dx * off - dy * sidew;
          const by = f.y + f.r * 0.5 + dy * off + dx * sidew;
          g.beginPath();
          g.moveTo(bx, by);
          g.lineTo(bx + dx * f.r * 0.8, by + dy * f.r * 0.8);
          g.stroke();
        }
      }
      g.restore();
    }
    // shadow (smaller and fainter the higher it flies, gone over a pit) and the ring that tells you whose side they are on
    const overPit = f.canFly && S.holes.some((h) => ((f.x - h.x) / h.rx) ** 2 + ((f.y - h.y) / h.ry) ** 2 < 1);
    g.save();
    if (!under && !overPit) {
      const sk = clamp(1 - lift / 90, 0.45, 1) * shadowK;
      g.fillStyle = `rgba(0,0,0,${0.4 * sk})`;
      g.beginPath();
      g.ellipse(f.x, f.y + f.r * 0.75, f.r * 1.15 * sk, f.r * 0.42 * sk, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = isYou ? "rgba(120,255,160,.9)" : "rgba(255,110,100,.75)";
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(f.x, f.y + f.r * 0.75, f.r * 1.3, f.r * 0.5, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // each type of rush leaves its own trail
    if ((f.dash && !under) || rolling) {
      const ty = f.dash?.mv.type ?? f.types[0] ?? "Normal";
      if (Math.random() < 0.8) {
        const trail: Record<string, [string, number, Parti["kind"]]> = {
          Fire: ["#ff9a2e", -40, "puff"],
          Electric: ["#ffe14d", 0, "streak"],
          Water: ["#8fd3ff", 80, "dot"],
          Ghost: ["#6b3fa0", 0, "smoke"],
          Dark: ["#3b2a5a", 0, "smoke"],
          Flying: ["#eaf6ff", 0, "streak"],
          Dragon: ["#8b5cf6", 0, "puff"],
          Ice: ["#bfefff", 40, "dot"],
        };
        const [tc, gv, kind] = trail[ty] ?? ["#ffffff", 0, "streak"];
        this.parts.push({ kind, x: f.x + rnd(-f.r * 0.5, f.r * 0.5), y: f.y + rnd(-f.r * 0.3, f.r * 0.5), vx: -f.mvx * 0.25 + rnd(-30, 30), vy: -f.mvy * 0.25 + rnd(-30, 30), g: gv, life: 0.4, max: 0.4, size: kind === "puff" ? 6 : kind === "smoke" ? 9 : 5, grow: kind === "puff" ? 10 : 10, color: tc, edge: "#7a2a0a", seed: Math.floor(Math.random() * 99) });
      }
    }
    // afterimages behind a rush or a roll
    const hist = this.hist.get(f.id) ?? [];
    // Double Team / Agility: copies circle the Pokémon
    const cloneUntil = this.clones.get(f.id) ?? 0;
    if (im && !under && cloneUntil > this.t) {
      const fade = Math.min(1, (cloneUntil - this.t) / 0.6);
      for (let i = 0; i < 4; i++) {
        const an = this.t * 2.6 + (i * Math.PI) / 2;
        const bob = Math.sin(this.t * 5 + i) * 3;
        this.body(g, im, usedId, f.x + Math.cos(an) * f.r * 2.3, f.y + Math.sin(an) * f.r * 1.1 - f.r * 0.6 - lift + bob, size * 0.92, faceLeft, sx, sy, rot, "#9dffb0", 0.3 * fade);
      }
    }
    if (im && !under && f.loco !== "slither" && ((f.dash && !f.dash.under) || rolling)) {
      for (const idx of [3, 6, 9]) {
        const h = hist[idx];
        if (h) this.body(g, im, usedId, h.x, h.y - f.r * 0.6 - lift, size, faceLeft, sx, sy, rot + spin, c, 0.34 - idx * 0.02);
      }
    }
    // underground: only a moving mound of earth shows
    if (under) {
      g.save();
      g.fillStyle = "#5c4128";
      g.beginPath();
      g.ellipse(f.x, f.y + f.r * 0.45, f.r * 1.5, f.r * 0.62, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#8a6a45";
      g.beginPath();
      g.ellipse(f.x, f.y + f.r * 0.3, f.r * 1.05, f.r * 0.4, 0, 0, Math.PI * 2);
      g.fill();
      for (let i = 1; i < 10; i += 2) {
        const h = hist[i];
        if (h) {
          g.fillStyle = `rgba(92,65,40,${0.5 - i * 0.04})`;
          g.beginPath();
          g.ellipse(h.x, h.y + f.r * 0.5, f.r * (1.2 - i * 0.07), f.r * 0.45, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
      if (Math.random() < 0.7) this.parts.push({ kind: "dot", x: f.x + rnd(-f.r, f.r), y: f.y + f.r * 0.2, vx: rnd(-60, 60), vy: rnd(-180, -60), g: 520, life: 0.5, max: 0.5, size: rnd(2.5, 4.5), grow: 0, color: Math.random() < 0.5 ? "#7a5a3b" : "#b08c5f" });
    }

    // Mega Evolution: orbiting crystal light (gold for the new Z forms)
    if (f.mega > 0) {
      const gold = !!f.form?.z;
      g.save();
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3);
      gr.addColorStop(0, gold ? "rgba(255,225,120,.55)" : "rgba(255,150,230,.5)");
      gr.addColorStop(0.6, gold ? "rgba(255,170,60,.18)" : "rgba(120,220,255,.16)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(f.x - f.r * 4, f.y - f.r * 4, f.r * 8, f.r * 8);
      for (let i = 0; i < 6; i++) {
        const an = this.t * 2.4 + (i / 6) * Math.PI * 2;
        const rr = f.r * 1.9;
        g.save();
        g.translate(f.x + Math.cos(an) * rr, f.y - f.r * 0.3 + Math.sin(an) * rr * 0.45);
        g.rotate(an);
        g.fillStyle = i % 2 ? (gold ? "#ffe08a" : "#7fe3ff") : "#ffffff";
        g.beginPath();
        g.moveTo(0, -6);
        g.lineTo(4, 0);
        g.lineTo(0, 6);
        g.lineTo(-4, 0);
        g.closePath();
        g.fill();
        g.restore();
      }
      g.restore();
    }
    // Dynamax: a swirling red cloud around a giant
    if (f.dyna > 0) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(f.x, f.y, f.r * 0.4, f.x, f.y, f.r * 2.6);
      gr.addColorStop(0, "rgba(255,80,110,.5)");
      gr.addColorStop(0.6, f.gmax ? "rgba(255,200,80,.2)" : "rgba(220,40,90,.2)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(f.x - f.r * 3, f.y - f.r * 3, f.r * 6, f.r * 6);
      g.restore();
      if (Math.random() < 0.7) {
        const an = Math.random() * Math.PI * 2;
        this.parts.push({ kind: "smoke", x: f.x + Math.cos(an) * f.r * 1.3, y: f.y + Math.sin(an) * f.r * 0.8, vx: Math.cos(an) * 30, vy: -50, g: 0, life: 0.8, max: 0.8, size: 10, grow: 24, color: f.gmax ? "#ffb04d" : "#ff4d73" });
      }
    }
    if (f.awaken > 0) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3.2);
      gr.addColorStop(0, "rgba(255,240,170,.7)");
      gr.addColorStop(0.5, "rgba(255,190,70,.28)");
      gr.addColorStop(1, "rgba(255,160,40,0)");
      g.fillStyle = gr;
      g.fillRect(f.x - f.r * 4, f.y - f.r * 4, f.r * 8, f.r * 8);
      g.restore();
      if (Math.random() < 0.6) this.parts.push({ kind: "dot", x: f.x + rnd(-f.r, f.r), y: f.y + f.r * 0.4, vx: rnd(-20, 20), vy: -90, g: 0, life: 0.6, max: 0.6, size: 3.5, grow: 0, color: "#ffd96b" });
    }
    if (f.buffT > 0) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 2.4);
      gr.addColorStop(0, "rgba(255,170,60,.45)");
      gr.addColorStop(1, "rgba(255,170,60,0)");
      g.fillStyle = gr;
      g.fillRect(f.x - f.r * 3, f.y - f.r * 3, f.r * 6, f.r * 6);
      g.restore();
    }

    // the Pokémon itself
    g.save();
    if (!f.alive) g.globalAlpha = Math.max(0, 1 - f.koT * 3);
    g.globalAlpha *= alpha;
    const cutY = wet ? f.y + f.r * 0.15 : sink > 0 ? f.y + f.r * 0.75 - sink * f.r * 1.9 : null;
    if (cutY !== null) {
      g.beginPath();
      g.rect(f.x - 300, f.y - 500, 600, cutY - (f.y - 500));
      g.clip();
    }
    const px = f.x + ox;
    const py = f.y - f.r * 0.6 - lift + oy;
    const sxx = sx * stretch;
    const syy = sy / (stretch * 0.95 + 0.05);
    if ((f.grabT > 0 || f.flyT > 0) && !under) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const gg = g.createRadialGradient(px, py, 0, px, py, f.r * 2.1);
      gg.addColorStop(0, "rgba(255,160,235,.55)");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gg;
      g.beginPath();
      g.arc(px, py, f.r * 2.1, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    if (under) {
      // nothing above ground
    } else if (f.sp.id === "onix" || f.sp.id === "steelix") {
      const tintC = f.status.frz > 0 ? "#8ee8ff" : f.tera ? col(f.tera.type) : null;
      this.drawRockSerpent(g, f, px, py, faceLeft, hist, f.flash > 0 ? Math.min(1, f.flash * 9) : 0, tintC);
    } else if (im) {
      const wk = moving && (f.loco === "run" || f.loco === "walk") && !f.dash && !rolling ? { p: phase * 1.3 * (f.loco === "run" ? 1 : 1.25), a: 0.075 * clamp(speed / 200, 0.6, 1.1) } : undefined;
      this.body(g, im, usedId, px, py, size, faceLeft, sxx, syy, rot + spin, undefined, 1, wk);
      if (f.flash > 0) this.body(g, im, usedId, px, py, size, faceLeft, sxx, syy, rot + spin, "#ffffff", Math.min(1, f.flash * 9), wk);
      else if (f.status.frz > 0) this.body(g, im, usedId, px, py, size, faceLeft, sxx, syy, rot + spin, "#8ee8ff", 0.55, wk);
      else if (f.tera) this.body(g, im, usedId, px, py, size, faceLeft, sxx, syy, rot + spin, col(f.tera.type), 0.3 + Math.sin(t * 4) * 0.08, wk);
      // held by a mind attack: a glowing outline all round
      if (ps.aura) {
        const al = Math.min(1, ps.aura.t * 3) * (0.7 + Math.sin(t * 20) * 0.2);
        for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2], [-2, 2], [2, -2]] as const) this.body(g, im, usedId, px + dx, py + dy, size, faceLeft, sxx, syy, rot + spin, ps.aura.c, al * 0.8);
      }
      // a form whose picture is not there: the plain body, outlined and shimmering so the change still shows
      if (formMissing && !morph) {
        const pulse = 0.55 + Math.sin(t * 5) * 0.25;
        for (const [dx, dy] of [[-2.5, 0], [2.5, 0], [0, -2.5], [0, 2.5]] as const) this.body(g, im, usedId, px + dx, py + dy, size, faceLeft, sxx, syy, rot + spin, f.dyna > 0 ? "#ff3b5c" : f.form?.z ? "#ffd54a" : "#ff9be6", 0.5 * pulse);
      }
      // while it changes: a white (or red, or crystal) silhouette that builds, then fades into the new body
      if (morph) {
        const sw = morph.swap;
        let whiteAmt = mt < sw ? smooth(0.05, sw, mt) : 1 - smooth(sw, sw + 0.5, mt);
        if (morph.kind === "awaken") whiteAmt = 1 - smooth(0, 0.5, mt);
        const tintC = morph.kind === "mega" ? (morph.z ? "#fff1b8" : "#ffffff") : morph.kind === "dyna" ? "#ff3355" : morph.kind === "tera" ? morph.color : "#fff2a8";
        this.body(g, im, usedId, px, py, size * (1 + Math.sin(mt * 28) * 0.02 * whiteAmt), faceLeft, sxx, syy, rot + spin, tintC, clamp(whiteAmt, 0, 1) * 0.95);
        if (morph.kind !== "tera") {
          const flashAmt = smooth(sw - 0.08, sw, mt) * (1 - smooth(sw, sw + 0.16, mt));
          if (flashAmt > 0) this.body(g, im, usedId, px, py, size, faceLeft, sxx, syy, rot + spin, "#ffffff", flashAmt);
        }
      }
    } else {
      g.fillStyle = c;
      g.beginPath();
      g.arc(px, py, f.r * 1.1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.font = `800 ${f.r}px system-ui`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(f.sp.name[0] ?? "?", px, py + 1);
    }
    g.restore();
    // the water around the legs, and a mega gem over the head
    if (wet) {
      g.save();
      g.fillStyle = "rgba(70,150,220,.35)";
      g.beginPath();
      g.ellipse(f.x, f.y + f.r * 0.25, f.r * 1.35, f.r * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(225,242,255,.8)";
      g.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const k = (t * 0.9 + i / 2) % 1;
        g.globalAlpha = 1 - k;
        g.beginPath();
        g.ellipse(f.x, f.y + f.r * 0.25, f.r * (1 + k * 0.7), f.r * (0.4 + k * 0.3), 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }
    if (f.mega > 0 && !under) {
      g.save();
      g.translate(f.x, f.y - f.r * 2.4 - lift * 0.6 + Math.sin(t * 3) * 2);
      g.rotate(Math.sin(t * 2) * 0.2);
      const gem = g.createLinearGradient(-8, -10, 8, 10);
      gem.addColorStop(0, "#ff9be6");
      gem.addColorStop(0.5, "#7fe3ff");
      gem.addColorStop(1, f.form?.z ? "#ffd54a" : "#b49bff");
      g.fillStyle = gem;
      g.strokeStyle = "#fff";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(8, 0);
      g.lineTo(0, 10);
      g.lineTo(-8, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
    if (morph) this.drawMorph(g, f, morph, mt, c);

    if (f.tera) {
      const tc = col(f.tera.type);
      g.save();
      // a jewelled crown over the head
      g.translate(f.x, f.y - f.r * 2.3 + Math.sin(this.t * 3) * 2);
      g.fillStyle = tc;
      g.strokeStyle = "#fff";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, -11);
      g.lineTo(9, -2);
      g.lineTo(5, 9);
      g.lineTo(-5, 9);
      g.lineTo(-9, -2);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      if (f.crystal > 0) {
        // the crystal shield: a faceted hexagon that fades as it takes damage
        const k = Math.min(1, f.crystal / (f.maxHp * 0.3));
        g.save();
        g.translate(f.x, f.y - f.r * 0.3);
        g.rotate(this.t * 0.5);
        g.strokeStyle = tc;
        g.fillStyle = tc + "22";
        g.globalAlpha = 0.35 + k * 0.6;
        g.lineWidth = 3;
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const an = (i / 6) * Math.PI * 2;
          g.lineTo(Math.cos(an) * f.r * 2.1, Math.sin(an) * f.r * 2.1);
        }
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
      if (Math.random() < 0.35) this.parts.push({ kind: "dot", x: f.x + rnd(-f.r, f.r), y: f.y + rnd(-f.r * 2, 0), vx: 0, vy: -26, g: 0, life: 0.7, max: 0.7, size: 2.6, grow: 0, color: "#ffffff" });
    }
    if (f.shield > 0) {
      g.save();
      g.strokeStyle = "rgba(160,215,255,.9)";
      g.fillStyle = "rgba(120,190,255,.2)";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(f.x, f.y - f.r * 0.3, f.r * 1.9, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
    }
    // flames, bubbles and sparks for what is wrong with them
    if (f.alive) {
      if (f.status.brn > 0 && Math.random() < 0.35) this.parts.push({ kind: "dot", x: f.x + rnd(-f.r, f.r), y: f.y, vx: 0, vy: -60, g: 0, life: 0.5, max: 0.5, size: 4, grow: 0, color: "#ff8a3d" });
      if (f.status.psn > 0 && Math.random() < 0.25) this.parts.push({ kind: "ring", x: f.x + rnd(-f.r, f.r), y: f.y, vx: 0, vy: -30, g: 0, life: 0.7, max: 0.7, size: 3, grow: 6, color: "#b259d6" });
      if (f.status.par > 0 && Math.random() < 0.3) this.parts.push({ kind: "streak", x: f.x + rnd(-f.r, f.r), y: f.y - f.r, vx: rnd(-90, 90), vy: rnd(-90, 90), g: 0, life: 0.15, max: 0.15, size: 6, grow: 0, color: "#ffe14d" });
      if (f.heal && Math.random() < 0.4) this.parts.push({ kind: "text", x: f.x + rnd(-f.r, f.r), y: f.y, vx: 0, vy: -50, g: 0, life: 0.8, max: 0.8, size: 13, grow: 0, color: "#6df08a", text: "+", weight: 800 });
      // health bar over foes (the player's is in the HUD)
      if (!isYou) {
        const bw = Math.max(44, f.r * 2.6);
        const x = f.x - bw / 2;
        const y = f.y - f.r * 2.5 - 4;
        g.fillStyle = "rgba(0,0,0,.65)";
        g.fillRect(x - 1.5, y - 1.5, bw + 3, 9);
        g.fillStyle = "rgba(255,255,255,.8)";
        g.fillRect(x, y, (bw * Math.max(0, f.ghost)) / f.maxHp, 6);
        const pct = f.hp / f.maxHp;
        g.fillStyle = pct > 0.5 ? "#4cd964" : pct > 0.25 ? "#ffb020" : "#ff453a";
        g.fillRect(x, y, bw * Math.max(0, pct), 6);
        if (f.boss) {
          g.fillStyle = "#fff";
          g.font = "800 11px system-ui";
          g.textAlign = "center";
          g.fillText(f.sp.name.toUpperCase(), f.x, y - 5);
        }
      }
      // your running combo floats over your own head
      if (isYou && f.combo.n > 1) {
        g.save();
        g.font = "900 15px system-ui, sans-serif";
        g.textAlign = "center";
        g.lineWidth = 4;
        g.strokeStyle = "rgba(0,0,0,.7)";
        const label = `Combo ×${f.combo.n}`;
        const y = f.y - f.r * 2.5 - (f.name ? 22 : 8);
        g.strokeText(label, f.x, y);
        g.fillStyle = "#ffd54a";
        g.fillText(label, f.x, y);
        g.restore();
      }
      // a member's name above their Pokémon (multiplayer): their own one is marked with an arrow
      if (f.name) {
        const base = f.y - f.r * 2.5 - (isYou ? 4 : 10);
        const label = isYou ? `▼ ${f.name}` : f.name;
        g.save();
        g.font = "800 12px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        const w = Math.min(160, g.measureText(label).width) + 12;
        g.fillStyle = "rgba(8,10,20,.62)";
        g.beginPath();
        g.roundRect?.(f.x - w / 2, base - 14, w, 17, 8);
        if (!g.roundRect) g.rect(f.x - w / 2, base - 14, w, 17);
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = "rgba(0,0,0,.75)";
        g.strokeText(label, f.x, base - 1, 150);
        g.fillStyle = isYou ? "#8dffb0" : (NAME_COLORS[f.team % NAME_COLORS.length] ?? "#fff");
        g.fillText(label, f.x, base - 1, 150);
        g.restore();
      }
    }
    void S;
  }

  /** What surrounds a Pokémon while it transforms: a DNA helix and converging light, a pillar of red light, a crystal shell. */
  private drawMorph(g: CanvasRenderingContext2D, f: Fighter, m: { kind: "mega" | "dyna" | "tera" | "awaken"; swap: number; color: string; z?: boolean; gmax?: boolean }, mt: number, c: string) {
    const r = f.r;
    g.save();
    g.globalCompositeOperation = "lighter";
    if (m.kind === "mega") {
      const a = Math.sin(clamp(mt / 1.2, 0, 1) * Math.PI);
      // the Mega Evolution helix: two strands of light winding up around the body
      for (let k = 0; k < 2; k++) {
        for (let i = 0; i < 26; i++) {
          const y = f.y + r - i * r * 0.26 * (1 + mt * 0.4);
          const x = f.x + Math.sin(i * 0.65 + mt * 9 + k * Math.PI) * r * 1.25;
          g.globalAlpha = a * (0.9 - i * 0.03);
          g.fillStyle = k ? (m.z ? "#ffd54a" : "#7fe3ff") : "#ff9be6";
          g.beginPath();
          g.arc(x, y, 3.2, 0, Math.PI * 2);
          g.fill();
        }
      }
      // streaks of light flowing in
      g.strokeStyle = "#ffffff";
      g.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const an = (i / 14) * Math.PI * 2 + mt * 2;
        const d0 = r * (5 - smooth(0, m.swap, mt) * 4.2);
        g.globalAlpha = a * 0.7;
        g.beginPath();
        g.moveTo(f.x + Math.cos(an) * d0, f.y + Math.sin(an) * d0 * 0.6);
        g.lineTo(f.x + Math.cos(an) * (d0 + r * 1.4), f.y + Math.sin(an) * (d0 + r * 1.4) * 0.6);
        g.stroke();
      }
    } else if (m.kind === "dyna") {
      // a column of red light falls from the sky onto the Pokémon
      const k = Math.sin(clamp(mt / 0.9, 0, 1) * Math.PI);
      const gr = g.createLinearGradient(0, 0, 0, f.y);
      gr.addColorStop(0, "rgba(255,60,90,0)");
      gr.addColorStop(1, m.gmax ? "rgba(255,200,90,.85)" : "rgba(255,60,90,.85)");
      g.globalAlpha = k;
      g.fillStyle = gr;
      g.fillRect(f.x - r * 1.1, -50, r * 2.2, f.y + 50);
      g.strokeStyle = m.gmax ? "#ffd27a" : "#ff6a86";
      g.lineWidth = 4;
      for (let i = 0; i < 2; i++) {
        const q = (mt * 1.4 + i / 2) % 1;
        g.globalAlpha = (1 - q) * k;
        g.beginPath();
        g.ellipse(f.x, f.y + r * 0.6, r * (1 + q * 3), r * (0.4 + q * 1.1), 0, 0, Math.PI * 2);
        g.stroke();
      }
    } else if (m.kind === "tera") {
      // a faceted crystal forms around the Pokémon, then bursts into shards
      const grown = smooth(0, m.swap, mt);
      const fade = 1 - smooth(m.swap, m.swap + 0.6, mt);
      g.globalAlpha = (mt < m.swap ? grown : fade) * 0.85;
      g.translate(f.x, f.y - r * 0.4);
      g.rotate(mt * 0.8);
      const rad = r * 2.4 * (0.4 + grown * 0.7 + (mt > m.swap ? (mt - m.swap) * 1.6 : 0));
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * Math.PI * 2;
        g.fillStyle = i % 2 ? m.color : "#ffffff";
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(an) * rad, Math.sin(an) * rad);
        g.lineTo(Math.cos(an + Math.PI / 8) * rad * 0.7, Math.sin(an + Math.PI / 8) * rad * 0.7);
        g.closePath();
        g.globalAlpha *= 0.55;
        g.fill();
        g.globalAlpha /= 0.55;
      }
    }
    g.restore();
    void c;
  }
}
