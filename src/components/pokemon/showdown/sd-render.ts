/**
 * Fight Showdown: draws a World onto a canvas — the stage, the Pokémon, the shots, the sparks and the score bars —
 * and turns the engine's events into sound and effects. The Pokémon are moved with ONE smooth transform around their feet
 * (lean, squash, hop, fall), never cut into strips, so there are no seams.
 */
import { sfx } from "@/components/pokemon/arena-sfx";
import { decodeGif, frameAt, type GifFrames } from "@/components/pokemon/gif-frames";
import { fighterOf, type Fighter, type StageId } from "./sd-data";
import { TYPE_COLOR } from "@/lib/pokemon/shared";
import { ROUND_TIME, STAGE_W, windupOf, type Atk, type Ev, type PState, type Pl, type Proj, type World } from "./sd-engine";
import { GROUND_Y, VH, VW, drawStage } from "./sd-stages";

type G = CanvasRenderingContext2D;
type Sprite = { gif: GifFrames | null; still: HTMLImageElement | null; done: boolean };
type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: "dot" | "ring" | "streak" };
type Pop = { x: number; y: number; t: number; text: string; color: string };
type Ghost = { x: number; y: number; rot: number; sx: number; sy: number; flip: number; born: number; color: string };
/** What is only about looks: smooth turning, landing squash, dust, after-images. The fight rules never see it. */
type Vis = { flip: number; land: number; bounce: number; hover: number; prevY: number; prevSt: PState; dust: number; trail: Ghost[]; trailT: number; star: number; tx: number };
const newVis = (): Vis => ({ flip: 1, land: 0, bounce: 0, hover: 0, prevY: 0, prevSt: "idle", dust: 0, trail: [], trailT: 0, star: 0, tx: 0 });
type Zap = { x: number; len: number; t: number; color: string };
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
  private zaps: Zap[] = [];
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
    this.zaps = [];
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
      case "nova": {
        const rad = e.r ?? 150;
        ring(e.color ?? "#ffffff", rad * 1.7, 0.55);
        ring("#ffffff", rad * 1.15, 0.35);
        burst(22, e.color ?? "#ffffff", 540, 5, 60);
        sfx.zhit();
        break;
      }
      case "zap": {
        const dir = Math.sign(e.r ?? 1) || 1, len = Math.abs(e.r ?? 400);
        this.zaps.push({ x: e.x, len: len * dir, t: 0.24, color: e.color ?? "#ffe27a" });
        for (let i = 0; i < 16; i++) this.parts.push({ x: e.x + dir * len * (i / 15), y: 16, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 260, life: 0.45, max: 0.45, size: 5, color: e.color ?? "#ffe27a", kind: "dot" });
        this.flash = Math.max(this.flash, 0.2);
        sfx.hit(true, false);
        break;
      }
      case "dig": {
        burst(e.heavy ? 18 : 12, "rgba(130,98,62,.9)", 300, 8, 120);
        ring("#8a6a42", e.heavy ? 130 : 70, 0.4);
        sfx.hit(!!e.heavy, false);
        break;
      }
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
      // green sparks rise while it recovers
      if (p.regenT > 0 && Math.random() < dt * 12) this.parts.push({ x: p.x + (Math.random() - 0.5) * f.bw * 1.6, y: p.y + f.h * 0.2, vx: 0, vy: 90 + Math.random() * 60, life: 0.6, max: 0.6, size: 5, color: "#7be08a", kind: "dot" });
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
        } else if (a.kind === "move") {
          const m = f.moves[a.mi];
          const k = m?.kind ?? "proj";
          const wu = m ? windupOf(m) : 0.16;
          const q = clamp(a.t / wu, 0, 1), r2 = clamp((a.t - wu) / 0.28, 0, 1);
          if (k === "dash") {
            if (a.t < wu) { rot = -fc * 0.2 * q; sy = 1 - 0.1 * q; dx = -fc * 8 * q; }
            else if (a.rush > 0) { rot = fc * 0.34; sx = 1.2; sy = 0.9; dy -= 4; }
            else { rot = fc * 0.14 * (1 - r2); sx = 1 + 0.06 * (1 - r2); }
          } else if (k === "nova") {
            if (a.t < wu) { sy = 1 - 0.18 * q; sx = 1 + 0.1 * q; dy += 3 * q; }
            else { sy = 1.12 - 0.12 * r2; sx = 0.94 + 0.06 * r2; dy -= 16 * (1 - r2); }
          } else if (k === "burrow") {
            const hid = a.t >= wu && a.t < wu + 0.5;
            if (a.t < wu) { sy = 1 - 0.3 * q; dy += 10 * q; }
            else if (hid) { alpha = 0; }
            else { const u = clamp((a.t - wu - 0.5) / 0.3, 0, 1); sy = 1.2 - 0.2 * u; dy -= Math.sin(u * Math.PI) * 44; }
          } else if (k === "beam") {
            rot = fc * 0.09; dx = -fc * 6 + Math.sin(t * 80) * 1.4; sy = 0.97;
          } else if (k === "grab") {
            if (a.t < wu) { rot = -fc * 0.15 * q; dx = -fc * 6 * q; } else { rot = fc * 0.3 * (1 - r2); dx = fc * 32 * (1 - r2); sx = 1.08; }
          } else if (k === "guard") {
            sy = 0.86; sx = 1.07; rot = -fc * 0.06;
          } else if (k === "heal") {
            sy = 1.03 + Math.sin(t * 6) * 0.02; rot = Math.sin(t * 3) * 0.03;
          } else if (k === "buff") {
            dx = Math.sin(t * 70) * 2; sy = 1.06 + Math.sin(t * 20) * 0.03; dy -= 4;
          } else if (k === "bolt") {
            sy = 1 + 0.08 * q; dy -= 10 * q; rot = -fc * 0.08 * q;
          } else if (a.t < wu) {
            rot = -fc * 0.17 * q; sy = 1 - 0.08 * q; sx = 1 + 0.05 * q; dx = Math.sin(t * 70) * 1.6 * q;
          } else {
            rot = fc * 0.15 * (1 - r2); dx = -fc * 12 * (1 - r2); sx = 0.96 + 0.04 * r2; sy = 1.06 - 0.06 * r2;
          }
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
    const fast = (p.st === "atk" && a && ((a.kind === "kick" && a.t >= 0.12 && a.t < 0.34) || ((a.kind === "super" || a.kind === "move") && a.rush > 0))) || ((p.st === "down" || p.st === "hurt") && Math.abs(p.vx) > 320);
    if (fast && this.clock - v.trailT > (a?.kind === "super" || a?.kind === "move" ? 0.02 : 0.035)) {
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

    if (po.alpha > 0.1) this.auras(g, w, p, f, px, py);

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

  /** What a move leaves on the Pokémon: a power-up glow, a shield, a recovery glow and a tag for burn, poison and the rest. */
  private auras(g: G, w: World, p: Pl, f: Fighter, px: number, py: number) {
    const z = this.zoom;
    const cy = py - f.h * 0.48 * z, rx = f.bw * 1.1 * z, ry = f.h * 0.58 * z;
    if (p.buff.t > 0) {
      const gr = g.createRadialGradient(px, cy, 4, px, cy, ry * 1.2);
      gr.addColorStop(0, hexA("#ff9a3c", 0.05)); gr.addColorStop(0.7, hexA("#ff9a3c", 0.28 + 0.1 * Math.sin(w.time * 9))); gr.addColorStop(1, hexA("#ff9a3c", 0));
      g.fillStyle = gr;
      g.fillRect(px - ry * 1.3, cy - ry * 1.3, ry * 2.6, ry * 2.6);
      g.fillStyle = hexA("#ffd38a", 0.85);
      for (let i = 0; i < 3; i++) { const u = ((w.time * 1.4 + i / 3) % 1); this.txt(g, "▲", px + (i - 1) * f.bw * 0.7 * z, cy + ry * (0.6 - u * 1.4), 12 * z, hexA("#ffd38a", 1 - u)); }
    }
    if (p.guardT > 0) {
      g.save();
      g.fillStyle = hexA("#9fd2ff", 0.16 + 0.06 * Math.sin(w.time * 12));
      g.strokeStyle = hexA("#d6efff", 0.8);
      g.lineWidth = 3;
      g.beginPath(); g.ellipse(px, cy, rx * 1.15, ry * 1.1, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    }
    if (p.regenT > 0) {
      const gr = g.createRadialGradient(px, cy, 4, px, cy, ry);
      gr.addColorStop(0, hexA("#7be08a", 0.28)); gr.addColorStop(1, hexA("#7be08a", 0));
      g.fillStyle = gr;
      g.fillRect(px - ry, cy - ry, ry * 2, ry * 2);
    }
    if (p.sk) {
      const tag: Record<string, [string, string]> = { brn: ["BRN", "#ff7a3a"], psn: ["PSN", "#b36be0"], par: ["PAR", "#e6b800"], frz: ["FRZ", "#5cc8f0"], slp: ["SLP", "#8a96ff"], cnf: ["CNF", "#e08cf0"] };
      const [txt, col] = tag[p.sk] ?? ["", "#fff"];
      const bx = px, by = py - f.h * 1.05 * z - 14 * z;
      g.fillStyle = col; rr(g, bx - 20, by - 9, 40, 18, 8); g.fill();
      this.txt(g, txt, bx, by, 11, "#ffffff", { align: "center", stroke: "rgba(0,0,0,.5)", lw: 2 });
      if (p.sk === "frz") { g.fillStyle = "rgba(190,235,255,.28)"; g.beginPath(); g.ellipse(px, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
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
    if (p.st === "atk" && a && a.kind === "move") {
      const m = f.moves[a.mi];
      if (m) {
        const wu = windupOf(m);
        const col = TYPE_COLOR[m.type] ?? f.color;
        const kd = m.kind;
        const q = clamp(a.t / wu, 0, 1);
        const ox = px + dir * (f.bw + 14) * z, oy = py - f.h * 0.45 * z;
        if (a.t < wu + 0.04 && (kd === "proj" || kd === "spread" || kd === "homing" || kd === "lob" || kd === "bolt" || kd === "beam" || kd === "hazard")) {
          const r = (5 + 24 * q) * z;
          const gr = g.createRadialGradient(ox, oy, 1, ox, oy, r * 1.8);
          gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.35, hexA(col, 0.85)); gr.addColorStop(1, hexA(col, 0));
          g.fillStyle = gr;
          g.beginPath(); g.arc(ox, oy, r * 1.8, 0, Math.PI * 2); g.fill();
          g.strokeStyle = hexA(col, 0.7 * (1 - q * 0.4)); g.lineWidth = 2;
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + w.time * 8, rr = r * (2.6 - q * 1.4);
            g.beginPath(); g.moveTo(ox + Math.cos(ang) * rr, oy + Math.sin(ang) * rr); g.lineTo(ox + Math.cos(ang) * rr * 0.7, oy + Math.sin(ang) * rr * 0.7); g.stroke();
          }
        } else if (kd === "nova" && a.t < wu + 0.05) {
          // a ring closes in on it before the burst
          g.strokeStyle = hexA(col, 0.8); g.lineWidth = 4 * z;
          g.beginPath(); g.arc(px, py - f.h * 0.4 * z, (f.h * 0.9 * (1.2 - q)) * z + 8, 0, Math.PI * 2); g.stroke();
        } else if (kd === "beam") {
          const n = m.n ?? 6;
          if (a.t >= wu && a.t < wu + n * 0.11 + 0.04) {
            const len = ((m.range ?? 260) + f.bw) * z;
            const pulse = 0.85 + 0.15 * Math.sin(w.time * 44);
            g.save();
            g.translate(px + dir * f.bw * 0.4 * z, oy);
            g.scale(dir, 1);
            const hh = 20 * z * pulse;
            const gr = g.createLinearGradient(0, 0, len, 0);
            gr.addColorStop(0, hexA(col, 0.95)); gr.addColorStop(1, hexA(col, 0.3));
            g.fillStyle = gr;
            g.beginPath(); g.moveTo(0, -hh * 0.6); g.lineTo(len, -hh); g.lineTo(len, hh); g.lineTo(0, hh * 0.6); g.closePath(); g.fill();
            g.fillStyle = "rgba(255,255,255,.85)";
            g.beginPath(); g.moveTo(0, -hh * 0.2); g.lineTo(len, -hh * 0.35); g.lineTo(len, hh * 0.35); g.lineTo(0, hh * 0.2); g.closePath(); g.fill();
            g.restore();
          }
        } else if (kd === "burrow" && a.t >= wu && a.t < wu + 0.5) {
          // a mound of earth runs along the floor where it is digging
          g.fillStyle = "rgba(120,92,58,.95)";
          g.beginPath(); g.ellipse(px, this.gy + 2, 46 * z, 15 * z, 0, Math.PI, 0); g.fill();
          g.fillStyle = "rgba(90,66,40,.9)";
          g.beginPath(); g.ellipse(px, this.gy + 2, 30 * z, 9 * z, 0, Math.PI, 0); g.fill();
        }
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
    if (pr.kind === "bolt") {
      // the warning: a pulsing band where the lightning is about to strike
      const len = pr.len * z, d = pr.dir;
      const k = clamp(1 - pr.delay / 0.4, 0, 1);
      g.save();
      g.globalAlpha = 0.25 + 0.5 * k * (0.6 + 0.4 * Math.sin(t * 30));
      g.fillStyle = pr.color;
      const gyy = this.gy;
      g.fillRect(Math.min(x, x + d * len), gyy - 150 * z, len, 150 * z);
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.setLineDash([10, 8]);
      g.strokeRect(Math.min(x, x + d * len), gyy - 150 * z, len, 150 * z);
      g.restore();
      return;
    }
    if (pr.kind === "trap") {
      const gyy = this.gy, r = pr.r * z;
      g.save();
      g.globalAlpha = clamp(pr.life / 0.6, 0, 1);
      if (pr.hz === "toxic") {
        g.fillStyle = "rgba(140,70,190,.75)";
        g.beginPath(); g.ellipse(x, gyy + 6, r * 1.1, r * 0.3, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(190,120,240,.8)";
        for (let i = 0; i < 4; i++) { const bx = x + Math.sin(t * 2 + i * 1.7) * r * 0.7, by = gyy + 4 - Math.abs(Math.sin(t * 3 + i * 2.3)) * 16 * z; g.beginPath(); g.arc(bx, by, 4 * z, 0, Math.PI * 2); g.fill(); }
      } else if (pr.hz === "rocks") {
        g.fillStyle = "#7b756c";
        for (let i = -2; i <= 2; i++) { const bx = x + i * r * 0.42; const h = (16 + (Math.abs(i) % 2) * 10) * z; g.beginPath(); g.moveTo(bx - 12 * z, gyy + 6); g.lineTo(bx - 4 * z, gyy + 6 - h); g.lineTo(bx + 8 * z, gyy + 6 - h * 0.7); g.lineTo(bx + 14 * z, gyy + 6); g.closePath(); g.fill(); }
      } else {
        g.fillStyle = "#c9ced8";
        for (let i = -3; i <= 3; i++) { const bx = x + i * r * 0.3; g.beginPath(); g.moveTo(bx - 7 * z, gyy + 6); g.lineTo(bx, gyy + 6 - 26 * z); g.lineTo(bx + 7 * z, gyy + 6); g.closePath(); g.fill(); }
      }
      g.restore();
      return;
    }
    const y = this.Y(pr.y);
    const sp = Math.hypot(pr.vx, pr.vy) || 1;
    const ux = pr.vx / sp, uy = -pr.vy / sp; // direction on the screen
    const r = pr.r * z;
    const len = (pr.kind === "beam" ? 260 : 70) * z;
    const tx = x - ux * len, ty = y - uy * len;
    const tail = g.createLinearGradient(x, y, tx, ty);
    tail.addColorStop(0, hexA(pr.color, 0.8)); tail.addColorStop(1, hexA(pr.color, 0));
    g.fillStyle = tail;
    g.beginPath(); g.moveTo(x - uy * r * 0.8, y + ux * r * 0.8); g.lineTo(tx, ty); g.lineTo(x + uy * r * 0.8, y - ux * r * 0.8); g.closePath(); g.fill();
    const gr = g.createRadialGradient(x, y, 1, x, y, r * 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, hexA(pr.color, 0.95)); gr.addColorStop(1, hexA(pr.color, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r * 2, 0, Math.PI * 2); g.fill();
    // what the shot looks like depends on its type
    switch (pr.type) {
      case "Electric":
        g.strokeStyle = "#fff9b0"; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(tx + (x - tx) * 0.3, ty + (y - ty) * 0.3);
        for (let i = 1; i <= 6; i++) g.lineTo(tx + (x - tx) * (0.3 + 0.7 * (i / 6)) - uy * Math.sin(t * 40 + i * 2.3) * r * 0.9, ty + (y - ty) * (0.3 + 0.7 * (i / 6)) + ux * Math.sin(t * 40 + i * 2.3) * r * 0.9);
        g.stroke();
        break;
      case "Fire":
        g.fillStyle = hexA("#ffe9a0", 0.8);
        g.beginPath(); g.arc(x + Math.sin(t * 30) * 2, y + Math.cos(t * 26) * 2, r * 0.55, 0, Math.PI * 2); g.fill();
        break;
      case "Water": case "Poison":
        g.fillStyle = hexA(pr.type === "Water" ? "#ffffff" : "#e0b0ff", 0.55);
        for (let i = 0; i < 3; i++) { const q = (i + 1) / 4; g.beginPath(); g.arc(x - ux * len * q * 0.9 + Math.sin(t * 9 + i) * r * 0.35, y - uy * len * q * 0.9 + Math.cos(t * 8 + i) * r * 0.35, r * (0.32 - i * 0.05), 0, Math.PI * 2); g.fill(); }
        break;
      case "Ice":
        g.strokeStyle = "#e8fbff"; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) { const an = t * 5 + (i * Math.PI) / 2; g.beginPath(); g.moveTo(x - Math.cos(an) * r * 1.3, y - Math.sin(an) * r * 1.3); g.lineTo(x + Math.cos(an) * r * 1.3, y + Math.sin(an) * r * 1.3); g.stroke(); }
        break;
      case "Grass": case "Bug":
        g.fillStyle = hexA("#d6ffb0", 0.8);
        g.save(); g.translate(x, y); g.rotate(t * 9); g.beginPath(); g.ellipse(0, 0, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); g.fill(); g.restore();
        break;
      case "Rock": case "Ground": case "Steel":
        g.fillStyle = hexA(pr.type === "Steel" ? "#dfe6ef" : "#a89678", 0.9);
        g.save(); g.translate(x, y); g.rotate(t * 7); g.beginPath(); for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI * 2; g.lineTo(Math.cos(an) * r * (0.6 + (i % 2) * 0.25), Math.sin(an) * r * (0.6 + (i % 2) * 0.25)); } g.closePath(); g.fill(); g.restore();
        break;
      case "Ghost": case "Dark":
        g.fillStyle = hexA("#2a1238", 0.8);
        g.beginPath(); g.arc(x, y, r * 0.7, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffd6ff"; g.beginPath(); g.arc(x - r * 0.22, y - r * 0.1, r * 0.1, 0, Math.PI * 2); g.arc(x + r * 0.22, y - r * 0.1, r * 0.1, 0, Math.PI * 2); g.fill();
        break;
      case "Psychic": case "Fairy":
        g.strokeStyle = hexA("#ffffff", 0.7); g.lineWidth = 2;
        for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(x, y, r * (1.1 + i * 0.5 + 0.12 * Math.sin(t * 10 + i)), 0, Math.PI * 2); g.stroke(); }
        break;
      default: break;
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
    for (const zp of this.zaps) {
      zp.t -= dt;
      const k = clamp(zp.t / 0.24, 0, 1);
      const x0 = this.X(zp.x), x1 = this.X(zp.x + zp.len);
      g.save();
      g.lineJoin = "round";
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass === 0 ? hexA(zp.color, 0.8 * k) : hexA("#ffffff", k);
        g.lineWidth = (pass === 0 ? 10 : 3.5) * k * this.zoom;
        g.beginPath();
        const steps = 14, hTop = this.gy - 135 * this.zoom;
        g.moveTo(x0, hTop);
        for (let i = 1; i <= steps; i++) g.lineTo(x0 + ((x1 - x0) * i) / steps, this.gy - (20 + (i % 2 ? 110 : 20)) * this.zoom + Math.sin(i * 12.9 + this.clock * 50) * 18 * this.zoom);
        g.stroke();
      }
      g.restore();
    }
    this.zaps = this.zaps.filter((zp) => zp.t > 0);
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
      // the four moves it knows: name, type colour, and a cooldown that drains away
      {
        const chipW = 71, chipH = 19, cy0 = VH - 50;
        f.moves.forEach((m, i) => {
          const cx0 = mx + i * (chipW + 3);
          const cd = Math.max(0, p.mcd[i] ?? 0);
          const col = TYPE_COLOR[m.type] ?? "#999999";
          g.fillStyle = "rgba(10,8,24,.8)"; rr(g, cx0, cy0, chipW, chipH, 5); g.fill();
          if (cd > 0) { g.fillStyle = "rgba(255,255,255,.14)"; rr(g, cx0, cy0, chipW * clamp(cd / m.cd, 0, 1), chipH, 5); g.fill(); }
          g.fillStyle = cd > 0 ? hexA(col, 0.45) : col; rr(g, cx0, cy0, 4, chipH, 2); g.fill();
          g.strokeStyle = cd > 0 ? "rgba(255,255,255,.12)" : hexA(col, 0.9); g.lineWidth = 1.5; rr(g, cx0, cy0, chipW, chipH, 5); g.stroke();
          g.font = `700 10px ${FONT}`;
          let label = m.name;
          while (label.length > 3 && g.measureText(label).width > chipW - 12) label = label.slice(0, -2);
          if (label !== m.name) label += "…";
          this.txt(g, label, cx0 + 8, cy0 + chipH / 2, 10, cd > 0 ? "#ffffff88" : "#ffffff");
          if (cd > 0.05) this.txt(g, cd.toFixed(cd < 10 ? 1 : 0), cx0 + chipW - 4, cy0 + chipH / 2, 9, "#ffffffcc", { align: "right" });
        });
      }
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
