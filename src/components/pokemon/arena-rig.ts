// A puppet rig for the flat Pokémon pictures: no bones are stored in the art, so the picture is cut into strips and
// each strip is moved by a small spring "chain" (the head lags behind the feet and overshoots), by waves, flaps and
// weight. Every species gets its own personality (from its type, size and name), so a Pikachu skitters, a Snorlax
// thumps, a Gengar sways like a sheet, a Gyarados ripples and a Pidgeot beats its wings.

type Pic = CanvasImageSource;

export type RigState = { sx: number; sy: number; vx: number; vy: number; pmx: number; pmy: number; ph: number; fp: number; init: boolean };
export const newRig = (): RigState => ({ sx: 0, sy: 0, vx: 0, vy: 0, pmx: 0, pmy: 0, ph: 0, fp: 0, init: false });

export type Persona = {
  /** spring stiffness and damping: low stiffness is jelly-like, high is stiff */
  k: number;
  c: number;
  /** how far the upper body is allowed to lag (fraction of the picture's size) */
  lag: number;
  /** footfall squash 0..1 (heavy things thump) */
  thump: number;
  /** high-frequency twitch while moving (electric, bug) */
  jitter: number;
  /** side-to-side sway while moving and idle (grass, water, ghost) */
  sway: number;
  /** wing flap / body wave strength and speed */
  wave: number;
  rate: number;
  /** per-species variety */
  phase: number;
  /** breathing / flicker while idle */
  breathe: number;
};

const cache = new Map<string, Persona>();
const hashId = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h / 9973; };

/** Personality by type, size and name. Nothing is random: the same species always moves the same way. */
export function personaOf(id: string, types: string[], size: number, loco: string): Persona {
  const key = id + loco;
  const hit = cache.get(key);
  if (hit) return hit;
  const h = hashId(id);
  const T = types[0] ?? "Normal";
  const heavy = Math.max(0, Math.min(1, (size - 22) / 12)); // 0 small .. 1 huge
  const p: Persona = { k: 150 - 70 * heavy, c: 13 - 3 * heavy, lag: 0.17 - 0.06 * heavy, thump: 0.15 + 0.7 * heavy, jitter: 0, sway: 0.25, wave: 0.5, rate: 0.9 + h * 0.35, phase: h * 6.28, breathe: 0.012 + (1 - heavy) * 0.01 };
  const has = (...t: string[]) => types.some((x) => t.includes(x));
  if (has("Rock", "Steel", "Ground")) { p.k *= 1.6; p.c *= 1.5; p.lag *= 0.55; p.thump += 0.3; p.sway *= 0.4; }
  if (has("Electric")) { p.jitter = 1; p.k *= 1.4; p.rate *= 1.3; p.lag *= 0.8; }
  if (has("Bug")) { p.jitter = 0.7; p.k *= 1.3; p.rate *= 1.25; }
  if (has("Water")) { p.k *= 0.55; p.c *= 0.6; p.lag *= 1.35; p.sway += 0.3; }
  if (has("Grass", "Poison")) { p.sway += 0.35; p.k *= 0.8; }
  if (has("Fire")) { p.breathe *= 2.2; p.rate *= 1.1; }
  if (has("Ghost", "Psychic", "Fairy")) { p.k *= 0.55; p.c *= 0.5; p.sway += 0.5; p.lag *= 1.4; p.thump *= 0.2; }
  if (has("Fighting")) { p.k *= 1.2; p.breathe *= 2; p.lag *= 0.9; }
  if (has("Dragon")) { p.rate *= 0.8; p.sway += 0.2; p.wave *= 1.15; }
  if (has("Dark")) { p.rate *= 1.1; p.lag *= 0.85; }
  if (has("Ice")) { p.k *= 1.2; p.sway *= 0.7; }
  if (loco === "fly") { p.wave = 1; p.rate = 1.1 + h * 0.5; if (has("Bug")) p.rate *= 1.8; }
  if (loco === "slither") { p.wave = 1.1; p.rate = 0.9 + h * 0.3; }
  if (loco === "float") { p.sway += 0.3; p.thump = 0; }
  if (loco === "surf") { p.wave = 0.7; p.thump = 0; }
  cache.set(key, p);
  return p;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Move the spring chain on: the head's offset from the feet reacts to how the feet accelerate (start, stop, turn). */
export function stepRig(st: RigState, p: Persona, mvx: number, mvy: number, dt: number, speed: number) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30);
  if (!st.init) { st.pmx = mvx; st.pmy = mvy; st.init = true; }
  const ax = clamp((mvx - st.pmx) / dt, -2600, 2600);
  const ay = clamp((mvy - st.pmy) / dt, -2600, 2600);
  st.pmx = mvx; st.pmy = mvy;
  // two sub-steps keep the spring stable on slow frames
  for (let i = 0; i < 2; i++) {
    const h = dt / 2;
    st.vx += (-p.k * st.sx - p.c * st.vx - ax * 0.9) * h;
    st.vy += (-p.k * st.sy - p.c * st.vy - ay * 0.9) * h;
    st.sx += st.vx * h;
    st.sy += st.vy * h;
  }
  st.sx = clamp(st.sx, -40, 40);
  st.sy = clamp(st.sy, -40, 40);
  st.ph += dt * (2 + speed * 0.05) * p.rate;
  st.fp += dt * (speed * 0.065 + 1.2);
}

export type RigOpts = {
  t: number;
  /** +1 when the picture faces left in the world, -1 when it faces right (the picture is mirrored by `body`) */
  face: number;
  moving: boolean;
  speed: number;
  loco: string;
  /** a real moving picture is playing: the rig is turned down so the two do not fight */
  animated: boolean;
  id: number;
  /** quality 0..1 (fewer strips on slow devices) */
  q: number;
  /** walking feet for stand-in pictures: phase and size */
  wk?: { p: number; a: number };
};

/** Draw a picture through the rig. (x0, y0, w, h) is where a plain picture would go, in the body's own space. */
export function drawRigged(g: CanvasRenderingContext2D, src: Pic, sw: number, sh: number, x0: number, y0: number, w: number, h: number, st: RigState, p: Persona, o: RigOpts) {
  const size = Math.max(w, h);
  const amp = o.animated ? 0.55 : 1;
  const N = Math.max(6, Math.round((o.q > 0.7 ? 16 : o.q > 0.45 ? 11 : 7)));
  const mv = o.moving ? 1 : 0;
  const lagX = clamp(st.sx, -size * p.lag, size * p.lag) * o.face * amp;
  const lagY = clamp(st.sy, -size * p.lag * 0.6, size * p.lag * 0.6) * amp;

  if (o.loco === "fly" || o.loco === "slither" || o.loco === "surf") {
    // columns: wings beat (the tips lag behind the shoulders) or the body ripples from head to tail
    const fp = o.t * (o.loco === "fly" ? 12 : o.loco === "slither" ? 4.2 : 2.6) * p.rate + p.phase + o.id;
    const strength = (o.loco === "fly" ? 0.17 : o.loco === "slither" ? 0.1 : 0.035) * p.wave * (o.moving ? 1 : o.loco === "fly" ? 0.55 : 0.4) * amp;
    for (let j = 0; j < N; j++) {
      const c = ((j + 0.5) / N) * 2 - 1; // -1 left tip .. 1 right tip
      const ac = Math.abs(c);
      let dy: number;
      let dys = 1;
      if (o.loco === "fly") {
        // wing tips rise and fall most; the beat travels outwards
        dy = -Math.sin(fp - ac * 1.1) * strength * h * Math.pow(ac, 1.2) - Math.sin(fp) * strength * h * 0.25;
        dys = 1 + Math.sin(fp - ac * 1.1) * 0.05 * ac;
      } else {
        dy = Math.sin(c * 4.2 * Math.PI * 0.5 - fp) * strength * h * (0.55 + 0.45 * (c * o.face * -1 + 1) * 0.5);
        dys = 1 + Math.cos(c * 4.2 * Math.PI * 0.5 - fp) * 0.04;
      }
      dy += lagY * 0.5;
      const sxp = Math.floor((j * sw) / N);
      const sxw = Math.ceil(sw / N) + (j === N - 1 ? 0 : 1);
      g.drawImage(src, sxp, 0, Math.min(sxw, sw - sxp), sh, x0 + (sxp * w) / sw, y0 + dy - (h * (dys - 1)) / 2, (Math.min(sxw, sw - sxp) * w) / sw, h * dys);
    }
    return;
  }

  // rows: the picture is cut into strips from head to feet; the higher the strip, the more it lags and sways
  const wk = o.wk;
  const cut = 0.6;
  const bobTop = wk ? -Math.abs(Math.sin(wk.p)) * wk.a * size * 0.5 : 0;
  const idleSway = Math.sin(o.t * 1.6 * p.rate + p.phase + o.id) * p.sway * 0.016 * size;
  const moveSway = Math.sin(st.fp * 1.3 + p.phase) * p.sway * 0.02 * size * mv;
  const foot = Math.sin(st.fp * 1.3 + p.phase);
  const thumpK = mv ? Math.pow(Math.max(0, -foot), 4) * p.thump * 0.07 : 0; // squash as a heavy foot lands
  const breath = Math.sin(o.t * 2.1 * p.rate + p.phase + o.id) * p.breathe;
  const jit = p.jitter && o.moving ? p.jitter * 0.012 * size : 0;
  const ph = o.t * 31 + o.id * 3.7;
  for (let i = 0; i < N; i++) {
    const u = 1 - (i + 0.5) / N; // 0 at the feet .. 1 at the head
    const u15 = Math.pow(u, 1.5);
    let dx = lagX * -u15 + (idleSway + moveSway) * u * u;
    let dy = lagY * -0.5 * u15 - breath * size * u * u + thumpK * size * u;
    if (jit) dx += Math.sin(ph + i * 2.3) * jit * (0.3 + u);
    if (o.loco === "float") dx += Math.sin(o.t * 2.6 * p.rate + p.phase + (1 - u) * 5.2) * 0.034 * size * (1 - u * 0.55) * p.wave * amp; // a hem that ripples
    const srcY = Math.floor((i * sh) / N);
    const srcH = Math.min(sh - srcY, Math.ceil(sh / N) + 1);
    const dyTop = y0 + (srcY * h) / sh; // dest lines up exactly with the source rows, so strips meet without seams
    const hh = (srcH * h) / sh;
    if (wk && (i + 0.5) / N > cut) {
      // the lower part: a left foot and a right foot that step in turn
      for (const side of [0, 1]) {
        const sn = Math.sin(wk.p + side * Math.PI);
        const lift = Math.max(0, sn) * wk.a * size * 1.4;
        const swing = sn * wk.a * size * 0.5;
        const half = sw / 2;
        g.drawImage(src, side * half - (side ? 1 : 0), srcY, half + 1, srcH, x0 + side * (w / 2) + dx + swing, dyTop + dy - lift + bobTop * 0.4, w / 2 + (w / sw), hh);
      }
    } else {
      g.drawImage(src, 0, srcY, sw, srcH, x0 + dx, dyTop + dy + (wk ? bobTop : 0), w, hh);
    }
  }
}
