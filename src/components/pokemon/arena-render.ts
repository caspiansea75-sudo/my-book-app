/**
 * Draws an Arena Brawl fight on a canvas. It reads the engine's state and turns the engine's events into the
 * extras that make it feel good: sparks, rings, floating numbers, screen shake, a slow-motion tint.
 */
import { decodeGif, frameAt, type GifFrames } from "./gif-frames";
import { ARENA, type Ev, type Fighter, type State } from "@/lib/pokemon/arena-engine";
import { blob, drawHole, drawLightning, drawObstacle, drawPool, drawShot, stageBackground } from "@/components/pokemon/arena-art";
import { FIELDS, ITEMS, MOVES, moveReach, type MoveDef } from "@/lib/pokemon/arena-data";
import { TYPE_COLOR, spriteChain } from "@/lib/pokemon/shared";

type Parti = { kind: "dot" | "streak" | "ring" | "glow" | "smoke" | "text" | "puff" | "plank" | "crack" | "bolt"; x2?: number; y2?: number; seed?: number; rot?: number; vr?: number; edge?: string; x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; grow: number; color: string; text?: string; weight?: number };

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
  private anims = new Map<string, GifFrames | "loading" | "fail">();
  private poses = new Map<number, { clock: number; atk: number; atkDir: number; hurt: number; hx: number; hy: number }>();
  private dtr = 0;
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
    const next = (i: number) => {
      if (i >= urls.length) {
        this.imgs.set(id, "fail");
        this.failAt.set(id, performance.now());
        return;
      }
      const im = new Image();
      im.onload = () => this.imgs.set(id, im);
      im.onerror = () => next(i + 1);
      im.src = urls[i]!;
    };
    next(0);
    return null;
  }

  /** The animated sprite (the one that really moves its legs, wings and tail), loaded once; null until it is ready. */
  private loadAnim(id: string, back: boolean): GifFrames | null {
    const key = `${id}|${back ? "b" : "f"}`;
    const hit = this.anims.get(key);
    if (hit && typeof hit === "object") return hit;
    if (hit) return null;
    this.anims.set(key, "loading");
    const url = spriteChain({ id }, { back })[0];
    if (!url || typeof fetch !== "function") {
      this.anims.set(key, "fail");
      return null;
    }
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("http"))))
      .then((b) => this.anims.set(key, decodeGif(b)))
      .catch(() => this.anims.set(key, "fail"));
    return null;
  }

  /** A solid-colour copy of a sprite (for the white hit flash and the freeze tint), made once. */
  private tinted(_id: string, im: Pic, color: string): HTMLCanvasElement {
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
        }
          this.ring(e.x, e.y, col(e.type), 44, 0.35);
          this.burst(e.x, e.y, col(e.type), 6, 120);
          break;
        case "hit": {
          const c = col(e.type);
          if (e.dmg > 0) {
            const ps = this.poses.get(e.id) ?? { clock: 0, atk: 0, atkDir: 0, hurt: 0, hx: 0, hy: 0 };
            ps.hurt = 0.26;
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
          break;
        }
        case "crate": {
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
          this.say("AWAKEN!", "#ffe08a");
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
          this.say(e.name.toUpperCase() + "!", e.z ? "#ffd54a" : "#ff9be6");
          break;
        }
        case "zstart":
          this.z = { t: 0, name: e.name, type: e.type, x: e.x, y: e.y };
          if (mine && Math.hypot(e.x - mine.x, e.y - mine.y) < 10) this.ultimate(e.name, "#ffd54a");
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
          this.say(e.gmax ? "GIGANTAMAX!" : "DYNAMAX!", "#ff6a86");
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
          this.say(`TERASTALLIZE! ${e.type.toUpperCase()}`, c);
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
        case "buff":
          this.ring(e.x, e.y, "#ffb04d", 70, 0.5);
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
        break;
      case "thunder":
        this.parts.push({ kind: "bolt", x: x + rnd(-50, 50), y: -60, vx: 0, vy: 0, g: 0, life: 0.32, max: 0.32, size: 1, grow: 0, color: "#ffe14d", x2: x, y2: y, seed: Math.floor(x) });
        this.flashT = Math.max(this.flashT, 0.12);
        break;
      case "surf":
        // a wave of foam rolling out
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
      if (h.length > 20) h.pop();
      this.hist.set(f.id, h);
    }
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
    if (this.ultBanner) {
      const u = this.ultBanner;
      const age = 1.7 - u.t;
      const slide = Math.min(1, age * 5);
      const out = Math.min(1, u.t * 4);
      g.save();
      g.globalAlpha = out;
      const bh = 74;
      const by = ARENA.CY - 120;
      const grad = g.createLinearGradient(0, 0, ARENA.W, 0);
      grad.addColorStop(0, "rgba(6,10,22,0)");
      grad.addColorStop(0.15, "rgba(6,10,22,.86)");
      grad.addColorStop(0.85, "rgba(6,10,22,.86)");
      grad.addColorStop(1, "rgba(6,10,22,0)");
      g.fillStyle = grad;
      g.fillRect(0, by, ARENA.W, bh);
      g.fillStyle = u.color;
      g.fillRect(0, by, ARENA.W, 2);
      g.fillRect(0, by + bh - 2, ARENA.W, 2);
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      const x = ARENA.CX + (1 - slide) * -260;
      g.font = "900 34px system-ui, sans-serif";
      g.lineWidth = 6;
      g.strokeStyle = "rgba(0,0,0,.6)";
      g.strokeText("ULTIMATE ATTACK", x, by + 38);
      g.fillStyle = u.color;
      g.fillText("ULTIMATE ATTACK", x, by + 38);
      g.font = "700 17px system-ui, sans-serif";
      g.fillStyle = "#ffffff";
      g.fillText(u.sub, ARENA.CX + (1 - slide) * 260, by + 62);
      g.restore();
    }
    if (this.banner) {
      const a = Math.min(1, this.banner.t * 2.5, (1.6 - this.banner.t) * 6);
      g.globalAlpha = Math.max(0, a);
      g.font = "900 54px system-ui, sans-serif";
      g.textAlign = "center";
      g.lineWidth = 8;
      g.strokeStyle = "rgba(0,0,0,.7)";
      const y = ARENA.CY - 70 + (1 - Math.min(1, (1.6 - this.banner.t) * 4)) * 20;
      g.strokeText(this.banner.text, ARENA.CX, y);
      g.fillStyle = this.banner.color;
      g.fillText(this.banner.text, ARENA.CX, y);
    }
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
    // rays turning around the caster
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
    const slide = (1 - Math.min(1, z.t / 0.35)) * 400;
    g.save();
    g.globalAlpha = a;
    g.textAlign = "center";
    g.font = "800 15px system-ui, sans-serif";
    g.fillStyle = "#ffd54a";
    g.fillText("Z - M O V E", ARENA.CX - slide, ARENA.CY - 70);
    g.font = "italic 900 46px system-ui, sans-serif";
    g.lineWidth = 8;
    g.strokeStyle = "rgba(0,0,0,.8)";
    g.strokeText(z.name, ARENA.CX + slide, ARENA.CY - 24);
    g.fillStyle = "#fff";
    g.fillText(z.name, ARENA.CX + slide, ARENA.CY - 24);
    g.restore();
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
          // meteors, boulders and lightning fall toward the circle before they land
          if (z.mv.id === "dracometeor" || z.mv.id === "rockslide") {
            for (let i = 0; i < 5; i++) {
              const mx = z.x + (i - 2) * z.r * 0.42;
              const my = z.y - (1 - prog) * 420 - i * 34 + 10;
              g.save();
              g.globalCompositeOperation = "lighter";
              g.strokeStyle = z.mv.id === "dracometeor" ? "rgba(255,150,60,.6)" : "rgba(200,205,215,.5)";
              g.lineWidth = 6;
              g.beginPath();
              g.moveTo(mx, my);
              g.lineTo(mx - 10, my - 46);
              g.stroke();
              g.restore();
              g.fillStyle = z.mv.id === "dracometeor" ? "#ff9a3c" : "#8a8f99";
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
        }
        g.restore();
      }
    }
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
    for (const p of S.projs) {
      const c = col(p.type);
      drawShot(g, p, S.time - p.born, this.t);
      // a trail of the shot's own colour: embers for fire, droplets for water, sparks for the rest
      if (Math.random() < 0.7) {
        const ember = p.type === "Fire";
        this.parts.push({ kind: "dot", x: p.x + rnd(-3, 3), y: p.y + rnd(-3, 3), vx: -p.vx * 0.08 + rnd(-24, 24), vy: -p.vy * 0.08 + rnd(ember ? -50 : -20, 20), g: ember ? -60 : 0, life: ember ? 0.5 : 0.3, max: ember ? 0.5 : 0.3, size: rnd(2, ember ? 5 : 4), grow: 0, color: ember && Math.random() < 0.5 ? "#ffd84d" : c });
      }
    }
  }

  /** Draws a Pokémon's picture at a place, turned, stretched and tinted as asked. */
  private body(g: CanvasRenderingContext2D, im: Pic, id: string, x: number, y: number, size: number, faceLeft: boolean, sx: number, sy: number, rot: number, tint?: string, alpha = 1) {
    g.save();
    g.globalAlpha *= alpha;
    g.translate(x, y);
    g.rotate(rot);
    g.scale((faceLeft ? 1 : -1) * sx, sy);
    const k = size / Math.max(picW(im), picH(im), 1);
    const w = picW(im) * k;
    const h = picH(im) * k;
    g.imageSmoothingEnabled = false;
    g.drawImage(tint ? this.tinted(id, im, tint) : im, -w / 2, -h / 2 - size * 0.05, w, h);
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
    // the moving picture: a Showdown animation, front or back view by where it faces; the still one stays as the fallback
    const ps = this.poses.get(f.id) ?? { clock: 0, atk: 0, atkDir: 0, hurt: 0, hx: 0, hy: 0 };
    this.poses.set(f.id, ps);
    ps.clock += this.dtr * (moving ? 1 + Math.min(1.3, speed / 240) : 0.85);
    ps.atk = Math.max(0, ps.atk - this.dtr);
    ps.hurt = Math.max(0, ps.hurt - this.dtr);
    const wantBack = Math.sin(f.face) < -0.6;
    const gif = this.loadAnim(usedId, wantBack) ?? (wantBack ? this.loadAnim(usedId, false) : null);
    const animated = !!gif && !formMissing;
    if (gif && animated) im = frameAt(gif, ps.clock).el;
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
    }
    // attack lunge (leans and darts toward the target, then settles) and hit recoil (knocked back, tilted)
    let ox = 0;
    let oy = 0;
    if (ps.atk > 0) {
      const k = Math.sin((1 - ps.atk / 0.32) * Math.PI);
      ox += Math.cos(ps.atkDir) * f.r * 0.85 * k;
      oy += Math.sin(ps.atkDir) * f.r * 0.5 * k;
      sx *= 1 + 0.12 * k;
      sy *= 1 - 0.09 * k;
      rot += (Math.cos(ps.atkDir) < 0 ? -1 : 1) * 0.2 * k;
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
    const stretch = f.dash && !under ? 1.18 : 1;

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
    // afterimages behind a rush or a roll, and the long body of a serpent
    const hist = this.hist.get(f.id) ?? [];
    if (im && !under && ((f.dash && !f.dash.under) || rolling)) {
      for (const idx of [3, 6, 9]) {
        const h = hist[idx];
        if (h) this.body(g, im, usedId, h.x, h.y - f.r * 0.6 - lift, size, faceLeft, sx, sy, rot + spin, c, 0.34 - idx * 0.02);
      }
    }
    if (im && f.loco === "slither" && !under) {
      [[5, 0.94], [10, 0.88], [15, 0.8]].forEach(([idx, k]) => {
        const h = hist[idx!];
        if (h) {
          this.body(g, im!, usedId, h.x, h.y - f.r * 0.5, size * k!, faceLeft, sx, sy, rot, undefined, 0.95);
          this.body(g, im!, usedId, h.x, h.y - f.r * 0.5, size * k!, faceLeft, sx, sy, rot, "#04121e", 0.22);
        }
      });
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
    if (under) {
      // nothing above ground
    } else if (im) {
      this.body(g, im, usedId, px, py, size, faceLeft, sxx, syy, rot + spin);
      if (f.flash > 0) this.body(g, im, usedId, px, py, size, faceLeft, sxx, syy, rot + spin, "#ffffff", Math.min(1, f.flash * 9));
      else if (f.status.frz > 0) this.body(g, im, usedId, px, py, size, faceLeft, sxx, syy, rot + spin, "#8ee8ff", 0.55);
      else if (f.tera) this.body(g, im, usedId, px, py, size, faceLeft, sxx, syy, rot + spin, col(f.tera.type), 0.3 + Math.sin(t * 4) * 0.08);
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
