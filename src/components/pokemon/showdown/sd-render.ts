/**
 * Fight Showdown: draws a World onto a canvas — the stage, the Pokémon, the shots, the sparks and the score bars —
 * and turns the engine's events into sound and effects. The Pokémon are moved with ONE smooth transform around their feet
 * (lean, squash, hop, fall), never cut into strips, so there are no seams.
 */
import { sfx } from "@/components/pokemon/arena-sfx";
import { decodeGif, frameAt, type GifFrames } from "@/components/pokemon/gif-frames";
import { fighterOf, type Fighter, type StageId } from "./sd-data";
import { ROUND_TIME, STAGE_W, type Atk, type Ev, type PState, type Pl, type Proj, type World } from "./sd-engine";
import { GROUND_Y, VH, VW, drawStage } from "./sd-stages";

type G = CanvasRenderingContext2D;
type Sprite = { gif: GifFrames | null; still: HTMLImageElement | null; done: boolean };
type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: "dot" | "ring" | "streak" };
type Pop = { x: number; y: number; t: number; text: string; color: string };
type Ghost = { x: number; y: number; rot: number; sx: number; sy: number; flip: number; born: number; color: string };
/** What is only about looks: smooth turning, landing squash, dust, after-images. The fight rules never see it. */
type Vis = { flip: number; land: number; bounce: number; hover: number; prevY: number; prevSt: PState; dust: number; trail: Ghost[]; trailT: number; star: number; tx: number };
const newVis = (): Vis => ({ flip: 1, land: 0, bounce: 0, hover: 0, prevY: 0, prevSt: "idle", dust: 0, trail: [], trailT: 0, star: 0, tx: 0 });
type Banner = { text: string; sub?: string; t: number; max: number; color: string };

const FONT = `"Noto Sans Bengali", ui-sans-serif, system-ui, sans-serif`;
const HEAD = `900 italic %spx "Arial Black", Impact, ${FONT}`;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeOutBack = (x: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

const BASE_LINES = [
  "Professor Oak: always stretch before a fight!",
  "Gym leaders report record crowds tonight",
  "Poké Ball sales jump after thrilling finals",
  "Weather: clear skies, with a chance of Thunderbolt",
];

export class SdRenderer {
  private g: G;
  private k = 1;
  stage: StageId = "stadium";
  /** which side this screen's player is on (-1: nobody in particular, e.g. two players on one device) */
  local = -1;
  tags: [string, string] = ["", ""];
  lang: "bn" | "en" = "en";
  private sprites = new Map<string, Sprite>();
  private portraits = new Map<string, HTMLImageElement>();
  private parts: Part[] = [];
  private pops: Pop[] = [];
  private banner: Banner | null = null;
  private lastEv = 0;
  private lastLine = 0;
  private lines: string[] = [];
  private tickW = 0;
  private cam = STAGE_W / 2;
  private zoom = 1;
  private gy = GROUND_Y;
  private hpTrail: [number, number] = [1, 1];
  private flash = 0;
  private last = 0;
  private tmp: HTMLCanvasElement | null = null;
  private broken = false;
  private vis: [Vis, Vis] = [newVis(), newVis()];
  private clock = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.g = canvas.getContext("2d")!;
  }

  reset() {
    this.parts = [];
    this.pops = [];
    this.banner = null;
    this.lastEv = 0;
    this.lastLine = 0;
    this.lines = [];
    this.hpTrail = [1, 1];
    this.flash = 0;
    this.last = 0;
    this.cam = STAGE_W / 2;
    this.zoom = 1;
    this.vis = [newVis(), newVis()];
    this.clock = 0;
  }

  /** Fetch the pictures ahead of time so the fight starts with everyone drawn. */
  preload(ids: string[]) {
    for (const id of ids) {
      this.sprite(id);
      this.portrait(id);
    }
  }

  private sprite(id: string): Sprite {
    let s = this.sprites.get(id);
    if (s) return s;
    const sp: Sprite = { gif: null, still: null, done: false };
    this.sprites.set(id, sp);
    const still = new Image();
    still.onload = () => { sp.still = still; };
    still.src = `/api/sprite?k=dex&id=${encodeURIComponent(id)}`;
    fetch(`/api/sprite?k=ani&id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("http"))))
      .then((b) => { sp.gif = decodeGif(b); sp.done = true; })
      .catch(() => { sp.done = true; /* the still picture stays */ });
    s = sp;
    return s;
  }

  /** True once every picture has arrived (or failed), so nobody changes size or pose in the middle of the fight. */
  ready(ids: string[]): boolean {
    return ids.map((id) => this.sprite(id)).every((sp) => sp.done);
  }

  /** What is shown while the pictures are still on their way. */
  loading(now: number) {
    const g = this.g;
    this.resize();
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    g.clearRect(0, 0, VW, VH);
    drawStage(g, this.stage, STAGE_W / 2, GROUND_Y, now / 1000);
    g.fillStyle = "rgba(8,6,20,.55)";
    g.fillRect(0, 0, VW, VH);
    const dots = ".".repeat(1 + (Math.floor(now / 350) % 3));
    this.txt(g, (this.lang === "bn" ? "পোকেমন তৈরি হচ্ছে" : "Getting the Pokémon ready") + dots, VW / 2, VH / 2, 34, "#ffffff", { align: "center", stroke: "rgba(0,0,0,.8)" });
  }

  private portrait(id: string): HTMLImageElement | null {
    let im = this.portraits.get(id);
    if (!im) {
      im = new Image();
      im.src = `/api/sprite?k=dex&id=${encodeURIComponent(id)}`;
      this.portraits.set(id, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }

  /* --------------------------------------------------------------- events */

  private onEvent(e: Ev, w: World) {
    const burst = (n: number, color: string, speed: number, size = 4, up = 0) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
        this.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + up, life: 0.45 + Math.random() * 0.3, max: 0.75, size: size * (0.6 + Math.random() * 0.8), color, kind: "dot" });
      }
    };
    const ring = (color: string, size: number, life = 0.4) => this.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life, max: life, size, color, kind: "ring" });
    switch (e.k) {
      case "hit":
        burst(e.heavy ? 18 : 10, "#fff6c0", e.heavy ? 520 : 340, 4);
        burst(6, e.color ?? "#ffffff", 300, 5);
        ring("#ffffff", e.heavy ? 90 : 55);
        if (e.heavy) this.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 120, color: "#ffffff", kind: "streak" });
        sfx.hit(!!e.heavy, false);
        break;
      case "block":
        burst(6, "#9fd2ff", 260, 3);
        ring("#9fd2ff", 50, 0.3);
        sfx.dodge();
        break;
      case "spec":
        burst(7, e.color ?? "#ffffff", 220, 4);
        sfx.cast("proj");
        break;
      case "super":
        this.flash = 0.35;
        ring(e.color ?? "#ffffff", 220, 0.6);
        burst(24, e.color ?? "#ffffff", 600, 5);
        this.banner = { text: e.text ?? "SUPER!", sub: fighterOf(w.p[(e.slot ?? 0) as 0 | 1].id).name, t: 1.05, max: 1.05, color: e.color ?? "#ffd54a" };
        sfx.zstart();
        break;
      case "boom":
        ring(e.color ?? "#ffb347", 230, 0.55);
        burst(26, e.color ?? "#ffb347", 560, 5, 80);
        sfx.zhit();
        break;
      case "clash":
        burst(10, e.color ?? "#ffffff", 300, 3);
        ring("#ffffff", 40, 0.25);
        sfx.dodge();
        break;
      case "ko":
        this.flash = 0.5;
        burst(30, "#ffffff", 700, 5);
        ring("#ffffff", 260, 0.7);
        this.banner = { text: e.text ?? "K.O.", t: 1.8, max: 1.8, color: e.text === "PERFECT!" ? "#ffd54a" : "#ff5a4a" };
        sfx.ko(false);
        break;
      case "jump":
      case "land":
        for (let i = 0; i < 4; i++) this.parts.push({ x: e.x + (Math.random() - 0.5) * 40, y: 6, vx: (Math.random() - 0.5) * 140, vy: 40 + Math.random() * 60, life: 0.4, max: 0.4, size: 8 + Math.random() * 6, color: "rgba(230,220,200,.55)", kind: "dot" });
        break;
      case "text":
        this.pops.push({ x: e.x, y: e.y, t: 1.1, text: e.text ?? "", color: e.color ?? "#ffffff" });
        break;
      case "ready":
        this.pops.push({ x: e.x, y: e.y + fighterOf(w.p[(e.slot ?? 0) as 0 | 1].id).h + 40, t: 1.2, text: this.lang === "bn" ? "পাওয়ার রেডি!" : "POWER READY!", color: "#ffd54a" });
        sfx.perfect();
        break;
      case "round":
        this.banner = { text: (e.text ?? "").replace("ROUND", this.lang === "bn" ? "রাউন্ড" : "ROUND"), t: 1.3, max: 1.3, color: "#ffffff" };
        sfx.wave(false);
        break;
      case "fight":
        this.banner = { text: this.lang === "bn" ? "লড়াই!" : "FIGHT!", t: 0.9, max: 0.9, color: "#ffd54a" };
        sfx.pick();
        break;
      case "time":
        this.banner = { text: this.lang === "bn" ? "সময় শেষ!" : "TIME!", t: 1.4, max: 1.4, color: "#ffffff" };
        break;
      case "win":
        if (this.local < 0 || w.match === this.local) sfx.win();
        else sfx.lose();
        break;
    }
  }

  /* ----------------------------------------------------------------- draw */

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(2, Math.round(r.width * dpr));
    const ch = Math.max(2, Math.round((r.width * dpr * VH) / VW));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    this.k = cw / VW;
  }

  draw(w: World, now: number) {
    if (this.broken) return;
    try {
      this.frame(w, now);
    } catch (err) {
      this.broken = true;
      console.error("[showdown] draw failed", err);
    }
  }

  private X = (x: number) => (x - this.cam) * this.zoom + VW / 2;
  private Y = (y: number) => this.gy - y * this.zoom;

  private frame(w: World, now: number) {
    const g = this.g;
    this.resize();
    const dt = this.last ? clamp((now - this.last) / 1000, 0, 0.05) : 0.016;
    this.last = now;
    // everything that only sways, breathes or flutters runs on this clock: it advances smoothly on every screen refresh
    // (the fight's own clock moves in 1/60 s steps, which looks uneven on a 120 or 144 Hz screen)
    this.clock += dt;
    const t = this.clock;

    for (const e of w.evs) if (e.n > this.lastEv) { this.lastEv = e.n; this.onEvent(e, w); }
    if (w.lineN !== this.lastLine) { this.lastLine = w.lineN; if (w.line) { this.lines.push(w.line); if (this.lines.length > 5) this.lines.shift(); this.tickW = 0; } }

    // camera: between the two, closer when they are close; on the one using a super move while it plays
    const [A, B] = w.p;
    const dist = Math.abs(A.x - B.x);
    let tz = clamp(950 / (dist + 460), 0.88, 1.4);
    let tx = (A.x + B.x) / 2;
    const sb = w.freeze > 0 && w.superBy !== -1 ? w.p[w.superBy] : null;
    if (sb) { tz = Math.max(tz, 1.35); tx = sb.x; }
    this.zoom += (tz - this.zoom) * Math.min(1, dt * 5);
    this.cam += (tx - this.cam) * Math.min(1, dt * 8);
    const half = VW / (2 * this.zoom);
    this.cam = STAGE_W < half * 2 ? STAGE_W / 2 : clamp(this.cam, half, STAGE_W - half);
    this.gy = GROUND_Y + (this.zoom - 1) * 90;

    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    g.clearRect(0, 0, VW, VH);
    g.save();
    if (w.shake > 0) g.translate((Math.random() - 0.5) * w.shake * 34, (Math.random() - 0.5) * w.shake * 26);
    drawStage(g, this.stage, this.cam * this.zoom, this.gy, t);

    // the super move's dark screen and speed lines
    if (sb) this.cinema(g, w, sb);

    const order = [A, B].sort((p, q) => (p.st === "atk" ? 1 : 0) - (q.st === "atk" ? 1 : 0));
    this.visStep(w, dt);
    for (const p of order) this.shadow(g, p);
    for (const p of order) { this.fighter(g, w, p); this.strike(g, w, p); }
    for (const pr of w.pr) this.proj(g, pr, t);
    this.effects(g, dt);
    g.restore();

    if (this.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${clamp(this.flash * 1.6, 0, 0.8)})`;
      g.fillRect(0, 0, VW, VH);
      this.flash -= dt;
    }
    this.hud(g, w, dt);
    this.bannerDraw(g, w, dt);
  }

  private txt(g: G, s: string, x: number, y: number, size: number, color: string, o: { align?: CanvasTextAlign; stroke?: string; font?: string; lw?: number } = {}) {
    g.font = o.font ?? `700 ${size}px ${FONT}`;
    g.textAlign = o.align ?? "left";
    g.textBaseline = "middle";
    if (o.stroke) { g.lineJoin = "round"; g.lineWidth = o.lw ?? size * 0.18; g.strokeStyle = o.stroke; g.strokeText(s, x, y); }
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  private cinema(g: G, w: World, p: Pl) {
    const f = fighterOf(p.id);
    const k = clamp(w.freeze / 0.62, 0, 1);
    g.fillStyle = `rgba(8,6,20,${0.62 * Math.min(1, (1 - k) * 6 + 0.2)})`;
    g.fillRect(-60, -60, VW + 120, VH + 120);
    const cx = this.X(p.x), cy = this.Y(p.y + f.h * 0.5);
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = f.color;
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + w.time * 0.6, r0 = 120 + ((i * 53) % 90), r1 = 900;
      g.lineWidth = 1 + ((i * 7) % 4);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    }
    g.restore();
  }

  private shadow(g: G, p: Pl) {
    const f = fighterOf(p.id);
    const v = this.vis[p.slot];
    const lift = clamp(p.y / 380, 0, 1) + clamp(v.hover / 90, 0, 0.4);
    const a = 0.34 * (1 - lift) * (p.st === "ko" ? 0.6 : 1);
    g.fillStyle = `rgba(0,0,0,${a})`;
    g.beginPath();
    g.ellipse(this.X(p.x), this.gy + 4, f.bw * 1.5 * this.zoom * (1 - clamp(p.y / 700, 0, 0.4)) * (1 - clamp(v.hover / 160, 0, 0.3)), 11 * this.zoom, 0, 0, Math.PI * 2);
    g.fill();
  }

  /** Per frame, looks only: turning round smoothly, landing squash, dust under running feet, stars for the winner. */
  private visStep(w: World, dt: number) {
    for (const p of w.p) {
      const v = this.vis[p.slot];
      const f = fighterOf(p.id);
      const target = p.face === 1 ? -1 : 1; // the pictures look left; -1 turns them to the right
      v.flip += (target - v.flip) * Math.min(1, dt * 16);
      if (Math.abs(target - v.flip) < 0.02) v.flip = target;
      // landing: squash on touching the floor again; a hard bounce when knocked down
      if (v.prevY > 3 && p.y <= 0) {
        if (p.st === "down" || p.st === "ko") v.bounce = 1;
        else v.land = Math.min(1, 0.45 + v.prevY / 260);
      }
      v.land = Math.max(0, v.land - dt / 0.26);
      v.bounce = Math.max(0, v.bounce - dt / 0.34);
      const hoverGoal = p.st === "down" || p.st === "ko" || p.st === "getup" ? 0 : f.loco === "fly" ? 26 : f.loco === "float" ? 17 : 0;
      v.hover += (hoverGoal - v.hover) * Math.min(1, dt * 9);
      // dust kicked up by feet that run
      if (p.y <= 0.5 && p.st === "walk" && f.loco !== "fly" && f.loco !== "float") {
        v.dust += Math.abs(p.vx) * dt;
        if (v.dust > 62) {
          v.dust = 0;
          for (let i = 0; i < 2; i++) this.parts.push({ x: p.x - Math.sign(p.vx) * (14 + i * 8), y: 5, vx: -Math.sign(p.vx) * (30 + Math.random() * 40), vy: 30 + Math.random() * 40, life: 0.38, max: 0.38, size: 7 + Math.random() * 5, color: "rgba(235,225,205,.55)", kind: "dot" });
        }
      }
      // the winner throws stars
      if (p.st === "win") {
        v.star -= dt;
        if (v.star <= 0) {
          v.star = 0.1;
          this.parts.push({ x: p.x + (Math.random() - 0.5) * f.bw * 2.4, y: p.y + f.h * (0.5 + Math.random() * 0.6), vx: (Math.random() - 0.5) * 160, vy: 160 + Math.random() * 120, life: 0.7, max: 0.7, size: 6, color: "#ffe27a", kind: "dot" });
        }
      }
      v.prevY = p.y;
      v.prevSt = p.st;
    }
  }

  /** One pose = one transform about the feet: lean, squash, stretch, hop, fall, spring. No cuts. */
  private pose(w: World, p: Pl, f: Fighter, v: Vis) {
    const t = this.clock, fc = p.face;
    const slot = p.slot;
    let rot = 0, sx = 1, sy = 1, dx = 0, dy = 0, alpha = 1;
    const loco = f.loco;
    const mv = clamp(Math.abs(p.vx) / f.walk, 0, 1.6);
    const br = Math.sin(t * 3.1 + slot * 1.7);
    // resting stance: breathing and a little sway; each kind of mover has its own
    sy += br * 0.016; sx -= br * 0.009;
    rot += Math.sin(t * 1.9 + slot) * 0.012;
    if (loco === "fly") { sx += Math.sin(t * 19 + slot) * 0.02; rot += Math.sin(t * 2.6 + slot) * 0.03; }
    else if (loco === "float") { rot += Math.sin(t * 1.5 + slot) * 0.05; sy += Math.sin(t * 2.2 + slot) * 0.02; }
    else if (loco === "slither" || loco === "surf") { rot += Math.sin(t * 3.4 + slot) * 0.04; dx += Math.sin(t * 2.6 + slot) * 2.5; }
    // the entrance: a small hop as the round starts
    if (w.phase === "intro" && w.pt < 0.9) dy -= Math.abs(Math.sin(w.pt * Math.PI * 2.4)) * 16 * (1 - w.pt / 0.9);
    const jitter = p.hitstop > 0 ? Math.sin(t * 90) * 3.5 : 0;
    const ease = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
    const back = (x: number) => { const c = 1.9, q = clamp(x, 0, 1); return 1 + (c + 1) * Math.pow(q - 1, 3) + c * Math.pow(q - 1, 2); };

    switch (p.st) {
      case "walk": {
        const fwd = p.vx * fc >= 0;
        const lean = (fwd ? 1 : -0.55) * mv;
        if (loco === "run") {
          const ph = t * 19 + slot;
          dy -= Math.abs(Math.sin(ph)) * 13 * mv; sy += Math.cos(ph * 2) * 0.045 * mv; sx += 0.05 * mv;
          rot += fc * 0.13 * lean + Math.sin(ph) * 0.03;
        } else if (loco === "fly") {
          sx += Math.sin(t * 24) * 0.035; rot += fc * 0.15 * lean; dy -= Math.sin(t * 5) * 4;
        } else if (loco === "float") {
          rot += fc * 0.11 * lean; sy += Math.sin(t * 3) * 0.03; dy -= Math.sin(t * 2.4) * 3;
        } else if (loco === "slither" || loco === "surf") {
          const ph = t * 9 + slot;
          rot += Math.sin(ph) * 0.1 * mv + fc * 0.05 * lean; dx += Math.sin(ph + 1) * 5 * mv; sy += Math.sin(ph * 2) * 0.045 * mv; dy -= Math.abs(Math.sin(ph * 0.5)) * 3;
        } else {
          const ph = t * 13 + slot;
          dy -= Math.abs(Math.sin(ph)) * 10 * mv; sy += Math.cos(ph * 2) * 0.04 * mv; sx -= Math.cos(ph * 2) * 0.02 * mv;
          rot += fc * 0.075 * lean + Math.sin(ph) * 0.05 * mv;
        }
        break;
      }
      case "jump": {
        const air = clamp(p.vy / 4200, -0.1, 0.16);
        sy += air; sx -= air * 0.55;
        rot += clamp(p.vx / 1700, -0.15, 0.15);
        if (loco === "fly") sx += Math.sin(t * 26) * 0.04;
        break;
      }
      case "block": sy = 0.86; sx = 1.07; rot = -fc * 0.08; dx = -fc * 4 + jitter; break;
      case "hurt": {
        const k = clamp(1 - p.t / 0.3, 0, 1);
        rot = -fc * 0.36 * k; dx = -fc * 11 * k + jitter; sx = 1 - 0.09 * k; sy = 1 + 0.07 * k;
        break;
      }
      case "down": {
        const spin = back(p.t / 0.32);
        rot = -fc * 1.45 * spin;
        sy = 0.96 - v.bounce * 0.06; sx = 1 + v.bounce * 0.05;
        dy -= Math.sin((1 - v.bounce) * Math.PI) * 18 * v.bounce;
        break;
      }
      case "ko": {
        rot = -fc * 1.45 * back(p.t / 0.4);
        sy = 0.96; alpha = 1 - clamp((p.t - 1.2) / 1.5, 0, 0.35);
        dy -= Math.sin((1 - v.bounce) * Math.PI) * 18 * v.bounce;
        break;
      }
      case "getup": {
        const k = clamp(p.t / 0.28, 0, 1);
        rot = -fc * 1.45 * (1 - back(k));
        sy = 0.84 + 0.22 * Math.sin(k * Math.PI * 0.9); sx = 1.08 - 0.08 * k;
        dy -= Math.sin(k * Math.PI) * 10;
        break;
      }
      case "win": {
        const ph = t * 6 + slot;
        dy -= Math.abs(Math.sin(ph)) * 30; sy += Math.cos(ph * 2) * 0.07; sx -= Math.cos(ph * 2) * 0.04;
        rot += Math.sin(ph) * 0.12;
        break;
      }
      case "atk": {
        const a = p.atk;
        if (!a) break;
        if (a.kind === "jab") {
          // wind-up, snap forward, ease back
          const q = clamp(a.t / 0.06, 0, 1), s2 = clamp((a.t - 0.06) / 0.07, 0, 1), r2 = clamp((a.t - 0.13) / 0.12, 0, 1);
          const out = a.t < 0.06 ? -q * 0.6 : a.t < 0.13 ? -0.6 + 1.6 * ease(s2) : 1 - ease(r2);
          dx = fc * 26 * out; rot = fc * (a.t < 0.06 ? -0.16 * q : 0.26 * (1 - r2)); sx = 1 + 0.1 * Math.max(0, out); sy = 1 - 0.05 * Math.max(0, out) - 0.03 * q * (a.t < 0.06 ? 1 : 0);
        } else if (a.kind === "kick") {
          const q = clamp(a.t / 0.14, 0, 1), s2 = clamp((a.t - 0.14) / 0.09, 0, 1), r2 = clamp((a.t - 0.23) / 0.26, 0, 1);
          if (a.t < 0.14) { rot = -fc * 0.24 * q; sy = 1 - 0.09 * q; sx = 1 + 0.05 * q; dx = -fc * 10 * q; }
          else { const o = a.t < 0.23 ? ease(s2) : 1 - ease(r2); rot = fc * 0.5 * o; dx = fc * 44 * o; dy -= 15 * o; sx = 1 + 0.12 * o; sy = 1 - 0.06 * o; }
        } else if (a.kind === "spec") {
          const q = clamp(a.t / 0.16, 0, 1), r2 = clamp((a.t - 0.16) / 0.26, 0, 1);
          if (a.t < 0.16) { rot = -fc * 0.17 * q; sy = 1 - 0.08 * q; sx = 1 + 0.05 * q; dx = Math.sin(t * 70) * 1.6 * q; }
          else { rot = fc * 0.15 * (1 - r2); dx = -fc * 12 * (1 - r2); sx = 0.96 + 0.04 * r2; sy = 1.06 - 0.06 * r2; }
        } else {
          if (w.freeze > 0 && w.superBy === slot) { dx = Math.sin(t * 90) * 3; sy = 1.06 + Math.sin(t * 24) * 0.03; sx = 1.04; rot = Math.sin(t * 50) * 0.03; }
          else if (a.rush > 0) { rot = fc * 0.36; sx = 1.2; sy = 0.9; dy -= 4; }
          else { sy = 1.04; sx = 1.04; rot = fc * 0.06 * Math.sin(t * 30); }
        }
        break;
      }
      default: break;
    }
    // squash on landing, and the sprite rides the hover
    sy *= 1 - 0.2 * v.land; sx *= 1 + 0.16 * v.land;
    dy -= v.hover + (loco === "fly" || loco === "float" ? Math.sin(t * (loco === "fly" ? 4 : 2.2) + slot) * (loco === "fly" ? 6 : 7) * clamp(v.hover / 20, 0, 1) : 0);
    return { rot, sx, sy, dx, dy, alpha };
  }

  private fighter(g: G, w: World, p: Pl) {
    const f = fighterOf(p.id);
    const v = this.vis[p.slot];
    const sp = this.sprite(p.id);
    let el: CanvasImageSource | null = null, w0 = 0, h0 = 0;
    if (sp.gif) { el = frameAt(sp.gif, this.clock * 1000).el; w0 = sp.gif.w; h0 = sp.gif.h; }
    else if (sp.still && sp.still.naturalWidth) { el = sp.still; w0 = sp.still.naturalWidth; h0 = sp.still.naturalHeight; }
    const po = this.pose(w, p, f, v);
    const sc = (f.h / (h0 || 96)) * this.zoom;
    const px = this.X(p.x) + po.dx * this.zoom, py = this.Y(p.y) + po.dy * this.zoom;

    // after-images behind quick moves: a kick, a rush, being sent flying
    const a = p.atk;
    const fast = (p.st === "atk" && a && ((a.kind === "kick" && a.t >= 0.12 && a.t < 0.34) || (a.kind === "super" && a.rush > 0))) || ((p.st === "down" || p.st === "hurt") && Math.abs(p.vx) > 320);
    if (fast && this.clock - v.trailT > (a?.kind === "super" ? 0.02 : 0.035)) {
      v.trailT = this.clock;
      v.trail.push({ x: p.x + po.dx, y: p.y - po.dy, rot: po.rot, sx: po.sx, sy: po.sy, flip: v.flip, born: this.clock, color: f.color });
      if (v.trail.length > 7) v.trail.shift();
    }
    v.trail = v.trail.filter((gh) => this.clock - gh.born < 0.26);
    if (el) {
      for (const gh of v.trail) {
        const age = (this.clock - gh.born) / 0.26;
        g.save();
        g.globalAlpha = 0.34 * (1 - age);
        g.translate(this.X(gh.x), this.Y(gh.y));
        g.rotate(gh.rot);
        g.scale(gh.sx, gh.sy);
        g.scale(gh.flip, 1);
        this.tint(g, el, w0, h0, w0 * sc, h0 * sc, gh.color, 1);
        g.restore();
      }
    }

    // glow while a super move is being done or the power bar is full
    if ((p.st === "atk" && p.atk?.kind === "super") || p.meter >= 100) {
      const r = f.h * 0.85 * this.zoom, cy = py - f.h * 0.45 * this.zoom;
      const gr = g.createRadialGradient(px, cy, 4, px, cy, r);
      const al = p.meter >= 100 && p.st !== "atk" ? 0.28 + 0.12 * Math.sin(w.time * 8) : 0.7;
      gr.addColorStop(0, hexA(f.color, al)); gr.addColorStop(1, hexA(f.color, 0));
      g.fillStyle = gr;
      g.fillRect(px - r, cy - r, r * 2, r * 2);
    }

    g.save();
    g.globalAlpha = po.alpha;
    g.translate(px, py);
    g.rotate(po.rot);
    g.scale(po.sx, po.sy);
    // the pictures look to the left; the flip eases through the middle so a turn is a quick turn-round, not a jump
    g.scale(v.flip, 1);
    if (el) {
      const dw = w0 * sc, dh = h0 * sc;
      g.imageSmoothingEnabled = true;
      g.drawImage(el, -dw / 2, -dh, dw, dh);
      if (p.flash > 0) this.tint(g, el, w0, h0, dw, dh, "#ffffff", clamp(p.flash / 0.14, 0, 1) * 0.85);
    } else {
      // while the picture is still on its way: a coloured blob with the first letter
      const r = f.h * 0.3 * this.zoom;
      g.fillStyle = f.color;
      g.beginPath(); g.arc(0, -r * 1.2, r, 0, Math.PI * 2); g.fill();
      g.scale(v.flip < 0 ? -1 : 1, 1);
      this.txt(g, f.name.slice(0, 1), 0, -r * 1.2, r, "#fff", { align: "center" });
    }
    g.restore();

    if (p.st === "block") {
      g.save();
      g.strokeStyle = `rgba(160,215,255,${0.5 + 0.2 * Math.sin(w.time * 20)})`;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(px + p.face * f.bw * 0.55 * this.zoom, py - f.h * 0.42 * this.zoom, f.bw * 0.7 * this.zoom, f.h * 0.5 * this.zoom, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  /** The swing of a punch or kick, the orb gathering for a special, the energy pulled in for a super move. */
  private strike(g: G, w: World, p: Pl) {
    const a: Atk | null = p.atk;
    const f = fighterOf(p.id);
    const z = this.zoom;
    const v = this.vis[p.slot];
    const px = this.X(p.x), py = this.Y(p.y) - v.hover * z;
    const dir = p.face;
    if (p.st === "atk" && a && (a.kind === "jab" || a.kind === "kick")) {
      const t0 = a.kind === "jab" ? 0.05 : 0.13, len = a.kind === "jab" ? 0.16 : 0.2;
      const k = (a.t - t0) / len;
      if (k >= 0 && k <= 1) {
        const r = (f.bw + (a.kind === "jab" ? 40 : 66)) * z;
        const cy = py - f.h * (a.kind === "jab" ? 0.55 : 0.3) * z;
        const cx = px + dir * f.bw * 0.2 * z;
        const sweep = a.kind === "jab" ? 0.95 : 1.25;
        const head = -sweep + 2 * sweep * k; // the swing travels from high to low in front of it
        g.save();
        g.translate(cx, cy);
        g.scale(dir, 1);
        g.lineCap = "round";
        g.strokeStyle = a.kind === "jab" ? `rgba(255,255,255,${0.85 * (1 - k)})` : hexA(f.color, 0.9 * (1 - k));
        g.lineWidth = (a.kind === "jab" ? 9 : 14) * (1 - k * 0.7) * z;
        g.beginPath();
        g.arc(0, 0, r, head - 1.0, head);
        g.stroke();
        g.restore();
      }
    }
    if (p.st === "atk" && a && a.kind === "spec" && a.t < 0.2) {
      const q = clamp(a.t / 0.16, 0, 1);
      const ox = px + dir * (f.bw + 14) * z, oy = py - f.h * 0.45 * z, r = (5 + 24 * q) * z;
      const gr = g.createRadialGradient(ox, oy, 1, ox, oy, r * 1.8);
      gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.35, hexA(f.special.color, 0.85)); gr.addColorStop(1, hexA(f.special.color, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(ox, oy, r * 1.8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = hexA(f.special.color, 0.7 * (1 - q * 0.4)); g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + w.time * 8, rr = r * (2.6 - q * 1.4);
        g.beginPath(); g.moveTo(ox + Math.cos(ang) * rr, oy + Math.sin(ang) * rr); g.lineTo(ox + Math.cos(ang) * rr * 0.7, oy + Math.sin(ang) * rr * 0.7); g.stroke();
      }
    }
    // super: energy streams into the Pokémon while the screen is frozen, and a ring runs outward from its feet
    if (w.freeze > 0 && w.superBy === p.slot) {
      const k = clamp(1 - w.freeze / 0.62, 0, 1);
      const cx = px, cy = py - f.h * 0.5 * z;
      g.save();
      g.strokeStyle = hexA(f.color, 0.85); g.lineWidth = 3 * z;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + i * 0.7, r1 = (150 + ((i * 37) % 80)) * z * (1 - k * 0.8), r0 = r1 + 38 * z;
        g.beginPath(); g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); g.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1); g.stroke();
      }
      g.lineWidth = 5 * z; g.strokeStyle = hexA("#ffffff", 0.6 * (1 - k));
      g.beginPath(); g.ellipse(px, py + 4, (40 + k * 240) * z, (10 + k * 40) * z, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }

  private tint(g: G, el: CanvasImageSource, w0: number, h0: number, dw: number, dh: number, color: string, a: number) {
    if (!this.tmp) this.tmp = document.createElement("canvas");
    const c = this.tmp;
    if (c.width !== w0 || c.height !== h0) { c.width = w0; c.height = h0; }
    const tg = c.getContext("2d")!;
    tg.globalCompositeOperation = "source-over";
    tg.clearRect(0, 0, w0, h0);
    tg.drawImage(el, 0, 0, w0, h0);
    tg.globalCompositeOperation = "source-atop";
    tg.fillStyle = color;
    tg.fillRect(0, 0, w0, h0);
    const old = g.globalAlpha;
    g.globalAlpha = old * a;
    g.drawImage(c, -dw / 2, -dh, dw, dh);
    g.globalAlpha = old;
  }

  private proj(g: G, pr: Proj, t: number) {
    const x = this.X(pr.x), z = this.zoom;
    if (pr.kind === "bomb") {
      const gyy = this.gy;
      if (pr.delay > 0) {
        const k = 1 - clamp(pr.delay / 0.6, 0, 1);
        g.strokeStyle = hexA(pr.color, 0.4 + 0.5 * k);
        g.lineWidth = 4;
        g.setLineDash([14, 10]);
        g.beginPath(); g.ellipse(x, gyy + 6, pr.r * z, 30 * z, 0, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
        g.fillStyle = hexA(pr.color, 0.12 + 0.22 * k);
        g.beginPath(); g.ellipse(x, gyy + 6, pr.r * z * k, 30 * z * k, 0, 0, Math.PI * 2); g.fill();
      } else {
        const k = clamp(pr.life / 0.45, 0, 1);
        const gr = g.createRadialGradient(x, gyy - 40, 10, x, gyy - 40, pr.r * z * 1.1);
        gr.addColorStop(0, hexA("#ffffff", 0.9 * k)); gr.addColorStop(0.35, hexA(pr.color, 0.75 * k)); gr.addColorStop(1, hexA(pr.color, 0));
        g.fillStyle = gr;
        g.fillRect(x - pr.r * z * 1.2, gyy - pr.r * z * 1.6, pr.r * z * 2.4, pr.r * z * 2.2);
      }
      return;
    }
    const y = this.Y(pr.y);
    const dir = Math.sign(pr.vx) || 1;
    const r = pr.r * z;
    const len = pr.kind === "beam" ? 260 * z : 70 * z;
    const tail = g.createLinearGradient(x, y, x - dir * len, y);
    tail.addColorStop(0, hexA(pr.color, 0.8)); tail.addColorStop(1, hexA(pr.color, 0));
    g.fillStyle = tail;
    g.beginPath(); g.moveTo(x, y - r * 0.8); g.lineTo(x - dir * len, y); g.lineTo(x, y + r * 0.8); g.closePath(); g.fill();
    const gr = g.createRadialGradient(x, y, 1, x, y, r * 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, hexA(pr.color, 0.95)); gr.addColorStop(1, hexA(pr.color, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r * 2, 0, Math.PI * 2); g.fill();
    if (pr.type === "Electric") {
      g.strokeStyle = "#fff9b0"; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x - dir * len * 0.7, y);
      for (let i = 1; i <= 6; i++) g.lineTo(x - dir * len * 0.7 + dir * (len * 0.7 * i) / 6, y + Math.sin(t * 40 + i * 2.3) * r * 0.9);
      g.stroke();
    } else if (pr.type === "Fire") {
      g.fillStyle = hexA("#ffe9a0", 0.8);
      g.beginPath(); g.arc(x + Math.sin(t * 30) * 2, y + Math.cos(t * 26) * 2, r * 0.55, 0, Math.PI * 2); g.fill();
    }
  }

  private effects(g: G, dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === "dot") p.vy -= 600 * dt;
      const k = clamp(p.life / p.max, 0, 1);
      const sx = this.X(p.x), sy = this.Y(p.y);
      if (p.kind === "ring") {
        g.strokeStyle = hexA(p.color, k);
        g.lineWidth = 5 * k + 1;
        g.beginPath(); g.arc(sx, sy, p.size * (1 - k) * this.zoom + 6, 0, Math.PI * 2); g.stroke();
      } else if (p.kind === "streak") {
        g.strokeStyle = hexA(p.color, k);
        g.lineWidth = 3;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(sx + Math.cos(a) * 14, sy + Math.sin(a) * 14); g.lineTo(sx + Math.cos(a) * (14 + p.size * (1 - k)), sy + Math.sin(a) * (14 + p.size * (1 - k))); g.stroke(); }
      } else {
        g.fillStyle = p.color.startsWith("#") ? hexA(p.color, k) : p.color;
        g.globalAlpha = p.color.startsWith("#") ? 1 : k;
        g.beginPath(); g.arc(sx, sy, p.size * (0.4 + 0.6 * k) * this.zoom, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) {
      p.t -= dt; p.y += 38 * dt;
      const a = clamp(p.t / 0.5, 0, 1);
      g.globalAlpha = a;
      this.txt(g, p.text, this.X(p.x), this.Y(p.y), 24, p.color, { align: "center", stroke: "rgba(0,0,0,.85)" });
      g.globalAlpha = 1;
    }
    this.pops = this.pops.filter((p) => p.t > 0);
  }

  private bannerDraw(g: G, w: World, dt: number) {
    const bn = this.banner;
    if (bn) {
      bn.t -= dt;
      if (bn.t <= 0) this.banner = null;
      else {
        const p = 1 - bn.t / bn.max;
        const s = easeOutBack(clamp(p * 4, 0, 1));
        const a = clamp(bn.t / 0.25, 0, 1);
        g.save();
        g.globalAlpha = a;
        g.translate(VW / 2, VH * 0.4);
        g.scale(s, s);
        g.transform(1, 0, -0.12, 1, 0, 0);
        this.txt(g, bn.text, 0, 0, 96, bn.color, { align: "center", stroke: "#1a0f2a", lw: 14, font: HEAD.replace("%s", "96") });
        if (bn.sub) this.txt(g, bn.sub, 0, 62, 28, "#ffffff", { align: "center", stroke: "#1a0f2a", lw: 6 });
        g.restore();
      }
    }
    if (w.phase === "matchEnd" && w.pt < 3.5) {
      const win = w.match;
      const s = easeOutBack(clamp(w.pt * 2.5, 0, 1));
      const you = this.local >= 0;
      const text = you ? (win === this.local ? (this.lang === "bn" ? "তুমি জিতেছ" : "YOU WIN") : (this.lang === "bn" ? "তুমি হেরেছ" : "YOU LOSE")) : `${fighterOf(w.p[win === 1 ? 1 : 0].id).name.toUpperCase()} WINS`;
      g.save();
      g.translate(VW / 2, VH * 0.42); g.scale(s, s); g.transform(1, 0, -0.12, 1, 0, 0);
      this.txt(g, text, 0, 0, 96, you && win !== this.local ? "#c9d2e8" : "#ffd54a", { align: "center", stroke: "#1a0f2a", lw: 14, font: HEAD.replace("%s", "96") });
      g.restore();
    }
  }

  private hud(g: G, w: World, dt: number) {
    for (const p of w.p) {
      const r = clamp(p.hp / p.maxHp, 0, 1);
      const tr = this.hpTrail[p.slot];
      this.hpTrail[p.slot] = tr > r ? Math.max(r, tr - dt * 0.35) : r;
    }
    const barW = 470, barY = 34, barH = 22;
    for (const p of w.p) {
      const left = p.slot === 0;
      const f = fighterOf(p.id);
      const x0 = left ? 90 : VW - 90 - barW;
      const r = clamp(p.hp / p.maxHp, 0, 1);
      // portrait
      const px = left ? 16 : VW - 16 - 62;
      g.fillStyle = "rgba(10,8,24,.78)"; rr(g, px, 12, 62, 62, 10); g.fill();
      g.strokeStyle = f.color; g.lineWidth = 3; rr(g, px, 12, 62, 62, 10); g.stroke();
      const im = this.portrait(p.id);
      if (im) { g.save(); rr(g, px + 2, 14, 58, 58, 8); g.clip(); g.drawImage(im, px + 2, 14, 58, 58); g.restore(); }
      // name + tag
      const tag = this.tags[p.slot] ? ` (${this.tags[p.slot]})` : "";
      this.txt(g, `${f.name.toUpperCase()}${tag}`, left ? x0 : x0 + barW, 20, 15, "#ffffff", { align: left ? "left" : "right", stroke: "rgba(0,0,0,.85)" });
      // bar
      g.fillStyle = "rgba(10,8,24,.8)"; rr(g, x0 - 3, barY - 3, barW + 6, barH + 6, 8); g.fill();
      const fill = (v: number, color: string | CanvasGradient) => {
        const wv = barW * v;
        g.fillStyle = color;
        if (left) rr(g, x0, barY, wv, barH, 5); else rr(g, x0 + barW - wv, barY, wv, barH, 5);
        g.fill();
      };
      fill(this.hpTrail[p.slot], "rgba(255,255,255,.85)");
      const gr = g.createLinearGradient(0, barY, 0, barY + barH);
      if (r > 0.3) { gr.addColorStop(0, "#ffe27a"); gr.addColorStop(1, "#f2a516"); } else { gr.addColorStop(0, "#ff7a6a"); gr.addColorStop(1, "#d6281a"); }
      fill(r, gr);
      // rounds won
      for (let i = 0; i < 2; i++) {
        const cx = left ? x0 + 8 + i * 22 : x0 + barW - 8 - i * 22;
        g.fillStyle = i < p.rounds ? "#ffd54a" : "rgba(255,255,255,.25)";
        g.beginPath(); g.arc(cx, barY + barH + 16, 7, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 2; g.stroke();
      }
      // power bar
      const my = VH - 64, mw = 300, mx = left ? 18 : VW - 18 - mw;
      g.fillStyle = "rgba(10,8,24,.75)"; rr(g, mx, my, mw, 12, 6); g.fill();
      const full = p.meter >= 100;
      const mv = clamp(p.meter / 100, 0, 1) * mw;
      g.fillStyle = full ? `hsl(${45 + Math.sin(w.time * 10) * 10},100%,${58 + Math.sin(w.time * 10) * 8}%)` : f.color;
      if (left) rr(g, mx, my, mv, 12, 6); else rr(g, mx + mw - mv, my, mv, 12, 6);
      g.fill();
      this.txt(g, full ? (this.lang === "bn" ? "সুপার রেডি!" : "SUPER READY!") : (this.lang === "bn" ? "পাওয়ার" : "POWER"), left ? mx : mx + mw, my - 11, 13, full ? "#ffd54a" : "#ffffffcc", { align: left ? "left" : "right", stroke: "rgba(0,0,0,.8)" });
      // combo counter
      if (p.combo >= 2) {
        const k = easeOutBack(clamp((1.2 - p.comboT) * 8, 0, 1));
        g.save();
        g.translate(left ? 20 : VW - 20, 200); g.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
        this.txt(g, `${p.combo}`, 0, 0, 54, "#ffd54a", { align: left ? "left" : "right", stroke: "#1a0f2a", lw: 8, font: HEAD.replace("%s", "54") });
        this.txt(g, this.lang === "bn" ? "হিট" : "HITS", left ? 4 : -4, 34, 20, "#ffffff", { align: left ? "left" : "right", stroke: "#1a0f2a", lw: 5 });
        g.restore();
      }
    }
    // the clock
    g.fillStyle = "rgba(10,8,24,.85)"; rr(g, VW / 2 - 40, 14, 80, 54, 12); g.fill();
    g.strokeStyle = "#ffd54a"; g.lineWidth = 3; rr(g, VW / 2 - 40, 14, 80, 54, 12); g.stroke();
    const secs = Math.ceil(clamp(w.timer, 0, ROUND_TIME));
    this.txt(g, `${secs}`, VW / 2, 42, 38, secs <= 10 ? "#ff6a5a" : "#ffffff", { align: "center", stroke: "rgba(0,0,0,.7)" });
    this.txt(g, `R${w.round}`, VW / 2, 80, 13, "#ffffffbb", { align: "center", stroke: "rgba(0,0,0,.7)" });
    this.ticker(g, w);
  }

  private ticker(g: G, w: World) {
    const y = VH - 24;
    g.fillStyle = "rgba(10,8,24,.9)"; g.fillRect(0, y, VW, 24);
    g.fillStyle = "#d22a2a"; g.fillRect(0, y, 96, 24);
    this.txt(g, this.lang === "bn" ? "● সরাসরি" : "● LIVE", 48, y + 12, 13, "#ffffff", { align: "center" });
    const text = [...BASE_LINES.slice(0, 2), ...this.lines, ...BASE_LINES.slice(2)].join("      ◆      ") + "      ◆      ";
    g.save();
    g.beginPath(); g.rect(100, y, VW - 100, 24); g.clip();
    g.font = `600 13px ${FONT}`;
    if (!this.tickW) this.tickW = Math.max(200, g.measureText(text).width);
    const off = (w.time * 70) % this.tickW;
    this.txt(g, text, 106 - off, y + 12, 13, "#ffe9a8");
    this.txt(g, text, 106 - off + this.tickW, y + 12, 13, "#ffe9a8");
    g.restore();
  }
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

/** "#rrggbb" with an alpha. */
function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}
