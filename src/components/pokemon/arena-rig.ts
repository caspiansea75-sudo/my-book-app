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

/** Draw a picture through the rig. (x0, y0, w, h) is where a plain picture would go, in the body's own space.
 *  Smooth things (leaning, sway, breathing, squash) are done with a single transform, so there are no cuts at all.
 *  Strips are used only where a bend really is needed (a flapping wing, a swaying tail, a rippling hem, stepping feet),
 *  they are thin, overlap, and are blended, so no seams show. */
export function drawRigged(g: CanvasRenderingContext2D, src: Pic, sw: number, sh: number, x0: number, y0: number, w: number, h: number, st: RigState, p: Persona, o: RigOpts) {
  const size = Math.max(w, h);
  const amp = o.animated ? 0.55 : 1;
  const N = o.q > 0.7 ? 28 : o.q > 0.45 ? 20 : 12;
  const mv = o.moving ? 1 : 0;
  const lagX = clamp(st.sx, -size * p.lag, size * p.lag) * o.face * amp;
  const lagY = clamp(st.sy, -size * p.lag * 0.6, size * p.lag * 0.6) * amp;

  // one smooth transform around the feet: lean, sway, breathing and the squash of a footfall
  const foot = Math.sin(st.fp * 1.3 + p.phase);
  const idleSway = Math.sin(o.t * 1.6 * p.rate + p.phase + o.id) * p.sway * 0.016 * size;
  const moveSway = Math.sin(st.fp * 1.3 + p.phase) * p.sway * 0.02 * size * mv;
  const jit = p.jitter && o.moving ? Math.sin(o.t * 31 + o.id * 3.7) * p.jitter * 0.01 * size : 0;
  const topDx = -lagX + idleSway + moveSway + jit;
  const breath = Math.sin(o.t * 2.1 * p.rate + p.phase + o.id) * p.breathe;
  const thump = mv ? Math.pow(Math.max(0, -foot), 4) * p.thump * 0.07 : 0;
  const scaleY = clamp(1 + breath - thump - (lagY * 0.5) / h, 0.8, 1.2);
  g.save();
  g.translate(x0 + w / 2, y0 + h);
  g.transform(1, 0, -topDx / h, 1, 0, 0);
  g.scale(1, scaleY);
  if (o.wk) {
    // stepping without any cut: the whole body hops from foot to foot, rocking and shifting its weight
    const wp = o.wk.p;
    g.translate(Math.sin(wp) * o.wk.a * size * 0.35, -Math.abs(Math.sin(wp)) * o.wk.a * size * 0.9);
    g.rotate(Math.sin(wp) * 0.05);
  }
  const X0 = -w / 2;
  const Y0 = -h;
  const smoothOld = g.imageSmoothingEnabled;

  if (o.loco === "fly") {
    // wings: thin columns, the tips lag behind the shoulders and the beat travels outwards
    g.imageSmoothingEnabled = true;
    const fp = o.t * 12 * p.rate + p.phase + o.id;
    const strength = 0.15 * p.wave * (o.moving ? 1 : 0.55) * amp;
    for (let j = 0; j < N; j++) {
      const c = ((j + 0.5) / N) * 2 - 1;
      const ac = Math.abs(c);
      const dy = -Math.sin(fp - ac * 1.1) * strength * h * Math.pow(ac, 1.3) - Math.sin(fp) * strength * h * 0.2;
      const sxp = Math.floor((j * sw) / N);
      const sxw = Math.min(sw - sxp, Math.ceil(sw / N) + 1);
      g.drawImage(src, sxp, 0, sxw, sh, X0 + (sxp * w) / sw, Y0 + dy, (sxw * w) / sw, h);
    }
  } else {
    // a bend along the body: how far each row is pushed sideways, by height (u: 0 feet .. 1 head)
    let wave: ((u: number) => number) | null = null;
    if (o.loco === "slither") {
      // the head and neck stay put; the rest of the body swings side to side, more and more towards the tail
      const fp = o.t * 4 * p.rate + p.phase + o.id;
      const k = (o.moving ? 0.1 : 0.04) * p.wave * amp * size;
      wave = (u) => { const r = clamp((0.62 - u) / 0.62, 0, 1); return Math.sin(fp - (1 - u) * 4.6) * k * r * r * (3 - 2 * r); };
    } else if (o.loco === "float") {
      // a hem that ripples
      const fp = o.t * 2.6 * p.rate + p.phase + o.id;
      wave = (u) => Math.sin(fp + (1 - u) * 5.2) * 0.034 * size * (1 - u * 0.55) * p.wave * amp;
    }
    if (wave) {
      g.imageSmoothingEnabled = true;
      for (let i = 0; i < N; i++) {
        const a = Math.floor((i * sh) / N);
        const b = Math.min(sh, Math.ceil(((i + 1) * sh) / N) + 1);
        const u = 1 - (a + (b - a) / 2) / sh;
        g.drawImage(src, 0, a, sw, b - a, X0 + wave(u), Y0 + (a * h) / sh, w, ((b - a) * h) / sh);
      }
    } else g.drawImage(src, 0, 0, sw, sh, X0, Y0, w, h);
  }
  g.imageSmoothingEnabled = smoothOld;
  g.restore();
}
