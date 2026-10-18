/**
 * Draws an Arena Brawl fight on a canvas. It reads the engine's state and turns the engine's events into the
 * extras that make it feel good: sparks, rings, floating numbers, screen shake, a slow-motion tint.
 */
import { ARENA, type Ev, type Fighter, type State } from "@/lib/pokemon/arena-engine";
import { FIELDS, ITEMS, MOVES } from "@/lib/pokemon/arena-data";
import { TYPE_COLOR, spriteChain } from "@/lib/pokemon/shared";

type Parti = { kind: "dot" | "streak" | "ring" | "glow" | "smoke" | "text"; x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; grow: number; color: string; text?: string; weight?: number };

const col = (t: string) => TYPE_COLOR[t] ?? "#ffffff";
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export type SpriteSource = (id: string, num: number) => string[];
const defaultSources: SpriteSource = (id, num) => {
  const chain = spriteChain({ id, num }, { still: true });
  // pixel sprites first (they match the arena), then the larger pictures
  return [chain[1], chain[0], ...chain.slice(2)].filter(Boolean) as string[];
};

export class ArenaRenderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private parts: Parti[] = [];
  private shake = 0;
  private shakeT = 0;
  private zoomPulse = 0;
  private flashT = 0;
  private perfectT = 0;
  private imgs = new Map<string, HTMLImageElement | "fail" | "loading">();
  private tints = new Map<string, HTMLCanvasElement>();
  private t = 0;
  private scale = 1;
  private banner: { text: string; t: number; color: string } | null = null;
  private zoom = 1;
  private camX = ARENA.CX;
  private camY = ARENA.CY;

  constructor(private canvas: HTMLCanvasElement, private sources: SpriteSource = defaultSources) {
    this.ctx = canvas.getContext("2d")!;
    this.bg = this.buildBackground();
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

  private buildBackground(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = ARENA.W;
    c.height = ARENA.H;
    const g = c.getContext("2d")!;
    // stands around the pitch
    g.fillStyle = "#0a0e18";
    g.fillRect(0, 0, ARENA.W, ARENA.H);
    for (let i = 0; i < 700; i++) {
      const x = Math.random() * ARENA.W;
      const y = Math.random() * ARENA.H;
      if (x > 30 && x < ARENA.W - 30 && y > 30 && y < ARENA.H - 30) continue;
      g.fillStyle = `hsl(${Math.floor(rnd(0, 360))} 40% ${rnd(22, 50)}%)`;
      g.fillRect(x, y, 3, 3);
    }
    // stone tiles
    const x0 = 30;
    const y0 = 30;
    const tw = 48;
    for (let y = y0; y < ARENA.H - 30; y += tw)
      for (let x = x0; x < ARENA.W - 30; x += tw) {
        const v = Math.floor(rnd(34, 46));
        g.fillStyle = `rgb(${v} ${v + 4} ${v + 14})`;
        g.fillRect(x, y, tw - 2, tw - 2);
        if (Math.random() < 0.25) {
          g.fillStyle = "rgba(255,255,255,.035)";
          g.fillRect(x + 3, y + 3, tw - 8, 6);
        }
      }
    // markings: centre circle, halfway line, goal boxes
    g.strokeStyle = "rgba(190,215,255,.34)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(ARENA.CX, ARENA.CY, 110, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(ARENA.CX, 30);
    g.lineTo(ARENA.CX, ARENA.H - 30);
    g.stroke();
    g.strokeRect(30, ARENA.CY - 130, 120, 260);
    g.strokeRect(ARENA.W - 150, ARENA.CY - 130, 120, 260);
    g.fillStyle = "rgba(190,215,255,.4)";
    g.beginPath();
    g.arc(ARENA.CX, ARENA.CY, 6, 0, Math.PI * 2);
    g.fill();
    // glowing edge
    g.strokeStyle = "rgba(120,170,255,.55)";
    g.lineWidth = 4;
    g.strokeRect(30, 30, ARENA.W - 60, ARENA.H - 60);
    // light pools and shade
    const lp = g.createRadialGradient(ARENA.CX, ARENA.CY, 60, ARENA.CX, ARENA.CY, 560);
    lp.addColorStop(0, "rgba(120,160,255,.10)");
    lp.addColorStop(1, "rgba(0,0,10,.62)");
    g.fillStyle = lp;
    g.fillRect(0, 0, ARENA.W, ARENA.H);
    return c;
  }

  /* ------------------------------------------------------------------ sprites */

  private load(id: string, num: number): HTMLImageElement | null {
    const hit = this.imgs.get(id);
    if (hit instanceof HTMLImageElement) return hit;
    if (hit) return null;
    this.imgs.set(id, "loading");
    const urls = this.sources(id, num);
    const next = (i: number) => {
      if (i >= urls.length) {
        this.imgs.set(id, "fail");
        return;
      }
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => this.imgs.set(id, im);
      im.onerror = () => next(i + 1);
      im.src = urls[i]!;
    };
    next(0);
    return null;
  }

  /** A solid-colour copy of a sprite (for the white hit flash and the freeze tint), made once. */
  private tinted(id: string, im: HTMLImageElement, color: string): HTMLCanvasElement {
    const key = `${id}|${color}`;
    let c = this.tints.get(key);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = im.naturalWidth || 96;
    c.height = im.naturalHeight || 96;
    const g = c.getContext("2d")!;
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    this.tints.set(key, c);
    return c;
  }

  /* ------------------------------------------------------------------- events */

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
        case "cast":
          this.ring(e.x, e.y, col(e.type), 44, 0.35);
          this.burst(e.x, e.y, col(e.type), 6, 120);
          break;
        case "hit": {
          const c = col(e.type);
          this.burst(e.x, e.y, c, e.heavy ? 18 : 9, e.heavy ? 280 : 190);
          for (let i = 0; i < (e.heavy ? 8 : 3); i++) {
            const a = Math.atan2(e.dy, e.dx) + rnd(-0.6, 0.6);
            const v = rnd(200, 420);
            this.parts.push({ kind: "streak", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: 0.3, max: 0.3, size: rnd(5, 9), grow: 0, color: i % 2 ? "#fff" : c });
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
          break;
        }
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

  /* -------------------------------------------------------------------- frame */

  render(S: State, dtReal: number, you: Fighter | undefined) {
    const g = this.ctx;
    const dt = dtReal * (S.slow > 0 ? 0.4 : 1);
    this.t += dtReal;
    this.shakeT = Math.max(0, this.shakeT - dtReal);
    this.zoomPulse = Math.max(0, this.zoomPulse - dtReal * 3);
    this.flashT = Math.max(0, this.flashT - dtReal);
    this.perfectT = Math.max(0, this.perfectT - dtReal);
    if (this.banner) {
      this.banner.t -= dtReal;
      if (this.banner.t <= 0) this.banner = null;
    }

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
    g.drawImage(this.bg, 0, 0);

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

    const list = [...S.fighters].sort((a, b) => a.y - b.y);
    for (const f of list) if (f.alive || f.koT < 0.01) this.drawFighter(g, f, S, f === you);
    this.drawProjs(g, S);

    // particles
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.size += p.grow * dt;
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
        const total = z.team === -1 ? 1.1 : Math.max(0.2, z.mv.windup ?? 0.55);
        const prog = 1 - Math.max(0, z.delay) / (z.player ? total * 0.6 : total);
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
      const sp = Math.hypot(p.vx, p.vy) || 1;
      g.save();
      g.globalCompositeOperation = "lighter";
      // a soft tail
      const tail = p.beam ? 18 : 34;
      const gr = g.createLinearGradient(p.x, p.y, p.x - (p.vx / sp) * tail, p.y - (p.vy / sp) * tail);
      gr.addColorStop(0, c);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.strokeStyle = gr;
      g.lineWidth = p.r * 1.7;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - (p.vx / sp) * tail, p.y - (p.vy / sp) * tail);
      g.stroke();
      // the core: a bright centre inside a coloured halo
      const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.1);
      halo.addColorStop(0, "#fff");
      halo.addColorStop(0.3, c);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = halo;
      g.beginPath();
      g.arc(p.x, p.y, p.r * 2.1, 0, Math.PI * 2);
      g.fill();
      g.restore();
      if (Math.random() < 0.7) this.parts.push({ kind: "dot", x: p.x + rnd(-3, 3), y: p.y + rnd(-3, 3), vx: -p.vx * 0.08 + rnd(-20, 20), vy: -p.vy * 0.08 + rnd(-20, 20), g: 0, life: 0.3, max: 0.3, size: rnd(2, 4), grow: 0, color: c });
    }
  }

  private drawFighter(g: CanvasRenderingContext2D, f: Fighter, S: State, isYou: boolean) {
    const im = this.load(f.sp.id, f.sp.num);
    const size = f.r * 4.1;
    const bob = Math.sin(this.t * 6 + f.id) * 2 * (Math.hypot(f.vx, f.vy) > 20 ? 1.6 : 0.8);
    const c = col(f.sp.types[0] ?? "Normal");
    const faceLeft = Math.cos(f.face) < 0;

    // shadow and the ring that tells you whose side they are on
    g.save();
    g.fillStyle = "rgba(0,0,0,.4)";
    g.beginPath();
    g.ellipse(f.x, f.y + f.r * 0.75, f.r * 1.15, f.r * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = isYou ? "rgba(120,255,160,.9)" : "rgba(255,110,100,.75)";
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(f.x, f.y + f.r * 0.75, f.r * 1.3, f.r * 0.5, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();

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

    g.save();
    if (!f.alive) {
      g.globalAlpha = Math.max(0, 1 - f.koT * 3);
    }
    if (f.dodge.t > 0) g.globalAlpha *= 0.5;
    const stretch = f.dash ? 1.18 : 1;
    g.translate(f.x, f.y - f.r * 0.6 + bob);
    g.scale((faceLeft ? 1 : -1) * stretch, 1 / (stretch * 0.95 + 0.05));
    if (im) {
      const w = size;
      const h = size * (im.naturalHeight / (im.naturalWidth || 1));
      g.imageSmoothingEnabled = false;
      g.drawImage(im, -w / 2, -h / 2 - f.r * 0.2, w, h);
      if (f.flash > 0) {
        g.globalAlpha = Math.min(1, f.flash * 9);
        g.drawImage(this.tinted(f.sp.id, im, "#ffffff"), -w / 2, -h / 2 - f.r * 0.2, w, h);
      } else if (f.status.frz > 0) {
        g.globalAlpha = 0.55;
        g.drawImage(this.tinted(f.sp.id, im, "#8ee8ff"), -w / 2, -h / 2 - f.r * 0.2, w, h);
      }
    } else {
      g.fillStyle = c;
      g.beginPath();
      g.arc(0, 0, f.r * 1.1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.font = `800 ${f.r}px system-ui`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(f.sp.name[0] ?? "?", 0, 1);
    }
    g.restore();

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
    }
    void S;
  }
}
