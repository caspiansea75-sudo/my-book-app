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
  /** a four-legged walker: its legs step in a travelling wave from the hind legs to the front legs, not as one left foot and one right foot */
  quad?: boolean;
};

const cache = new Map<string, Persona>();
/** Species that walk on four legs (the body plan is not stored in the art). */
const QUADS = new Set(("growlithe arcanine ponyta rapidash rhyhorn rhydon rhyperior tauros miltank entei raikou suicune eevee vaporeon jolteon flareon espeon umbreon leafeon glaceon sylveon vulpix ninetales alolanninetales persian meowth growlithehisui arcaninehisui houndour houndoom poochyena mightyena zigzagoon linoone lillipup herdier stoutland shinx luxio luxray blitzle zebstrika mudbray mudsdale torterra grotle turtwig bastiodon shieldon cranidos rampardos bidoof bibarel skiddo gogoat litleo pyroar furfrou absol rockruff lycanroc lycanrocmidday lycanrocmidnight lycanrocdusk electrike manectric glameow purugly camerupt numel donphan phanpy swinub piloswine mamoswine girafarig stantler wyrdeer sawsbuck deerling aron lairon aggron golem graveler tyrantrum aurorus wooloo dubwool yamper boltund stoutland snubbull granbull mareep flaaffy ampharos sentret furret raticate rattata rattatalola bouffalant").split(" "));
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
  if (loco !== "fly" && loco !== "slither" && loco !== "float" && loco !== "surf" && QUADS.has(id)) p.quad = true;
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

/** One foot's path through a step (ph 0..1): it stays on the ground and slides back at an even pace (stance), then lifts, swings
 *  forward in an arc and plants again (swing). dx runs +1 .. -1 .. +1 and dy is the lift. */
const footCycle = (ph: number): [number, number] => {
  const q = ph - Math.floor(ph), STANCE = 0.58;
  if (q < STANCE) return [1 - 2 * (q / STANCE), 0];
  const k = (q - STANCE) / (1 - STANCE), e = k * k * (3 - 2 * k);
  return [-1 + 2 * e, Math.pow(Math.sin(Math.PI * k), 0.85)];
};

const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** How many slices to cut a length of `len` picture pixels into: thin slices, so each step between two of them is tiny. */
const slices = (len: number, q: number, lo: number, hi: number) => clamp(Math.ceil(len / (q > 0.7 ? 2 : q > 0.45 ? 3 : 5)), lo, hi);

/** One slice of the picture, moved by (dx, dy). It is drawn a little larger (`ox` to the right, `oy` downwards) so it
 *  slides under the next slice: the soft edge of a slice is always covered by solid picture, so no hairline gap or dark
 *  seam can open up between two slices, however differently they move. Slices must be drawn left to right, top to bottom. */
function slice(g: CanvasRenderingContext2D, src: Pic, sw: number, sh: number, X0: number, Y0: number, w: number, h: number, sx: number, sy: number, sWide: number, sHigh: number, dx: number, dy: number, ox: number, oy: number) {
  const ex = Math.min(sw - sx, sWide + ox);
  const ey = Math.min(sh - sy, sHigh + oy);
  if (ex <= 0 || ey <= 0) return;
  g.drawImage(src, sx, sy, ex, ey, X0 + (sx * w) / sw + dx, Y0 + (sy * h) / sh + dy, (ex * w) / sw, (ey * h) / sh);
}

/** Draw a picture through the rig. (x0, y0, w, h) is where a plain picture would go, in the body's own space.
 *  Smooth things (leaning, sway, breathing, squash) are done with a single transform, so there are no cuts at all.
 *  Where a bend really is needed (a flapping wing, a swaying tail, a rippling hem, stepping feet) the picture is cut into
 *  thin slices that overlap each other, and every slice is drawn the same way as the rest of the picture. The feet
 *  are not two blocks any more: the legs are a soft grid where the movement fades in from the waist down and from one
 *  foot to the other, so there is no step between the body and the feet or between the left and the right foot. */
export function drawRigged(g: CanvasRenderingContext2D, src: Pic, sw: number, sh: number, x0: number, y0: number, w: number, h: number, st: RigState, p: Persona, o: RigOpts) {
  const size = Math.max(w, h);
  const amp = o.animated ? 0.55 : 1;
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
  // the body rolls a little onto the planted foot as the weight passes from one side to the other
  if (o.wk && !o.animated) g.rotate(Math.sin(o.wk.p) * 0.022 * (p.quad ? 0.6 : 1));
  g.transform(1, 0, -topDx / h, 1, 0, 0);
  g.scale(1, scaleY);
  const X0 = -w / 2;
  const Y0 = -h;
  // every part is drawn with the same filtering as the plain picture, so the look never changes where two parts meet
  const OV = 2; // how many picture pixels a slice slides under its neighbour

  if (o.loco === "fly") {
    // wings: thin columns, the tips lag behind the shoulders and the beat travels outwards
    const N = slices(sw, o.q, 12, 56);
    const fp = o.t * 12 * p.rate + p.phase + o.id;
    const strength = 0.15 * p.wave * (o.moving ? 1 : 0.55) * amp;
    for (let j = 0; j < N; j++) {
      const c = ((j + 0.5) / N) * 2 - 1;
      const ac = Math.abs(c);
      const dy = -Math.sin(fp - ac * 1.1) * strength * h * Math.pow(ac, 1.3) - Math.sin(fp) * strength * h * 0.2;
      const sxp = Math.floor((j * sw) / N);
      const sxe = j === N - 1 ? sw : Math.floor(((j + 1) * sw) / N);
      slice(g, src, sw, sh, X0, Y0, w, h, sxp, 0, sxe - sxp, sh, 0, dy, OV, 0);
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
    const wk = o.wk;
    if (!wave && !o.animated && o.q > 0.45 && o.loco !== "fly") {
      // a living spine: while walking, the hips lead and the shoulders and head follow a beat behind; standing, a slow breathing sway
      if (wk) wave = (u) => Math.sin(wk.p - u * 1.7 + p.phase * 0.1) * 0.012 * size * u * (0.5 + p.sway * 0.5);
      else {
        const fp = o.t * 1.1 * p.rate + p.phase + o.id;
        wave = (u) => Math.sin(fp - u * 1.4) * 0.0055 * size * u;
      }
    }
    const bobTop = wk ? -Math.abs(Math.sin(wk.p)) * wk.a * size * 0.5 : 0;
    // rows above `waist` move as one body; the legs below it are the soft grid
    const waist = wk ? Math.floor(sh * 0.58) : sh;
    if (wave) {
      const N = slices(waist, o.q, 12, 64);
      for (let i = 0; i < N; i++) {
        const a = Math.floor((i * waist) / N);
        const b = i === N - 1 ? waist : Math.floor(((i + 1) * waist) / N);
        const u = 1 - (a + (b - a) / 2) / sh;
        slice(g, src, sw, sh, X0, Y0, w, h, 0, a, sw, b - a, wave(u), bobTop, 0, i === N - 1 && waist >= sh ? 0 : OV);
      }
    } else slice(g, src, sw, sh, X0, Y0, w, h, 0, 0, sw, waist, 0, bobTop, 0, wk ? OV : 0);
    if (wk && waist < sh) {
      const R = o.q > 0.7 ? 7 : o.q > 0.45 ? 5 : 3;
      const quad = !!p.quad;
      const C = quad ? (o.q > 0.7 ? 24 : o.q > 0.45 ? 16 : 10) : o.q > 0.7 ? 14 : o.q > 0.45 ? 10 : 6;
      // the left foot and the right foot step in turn
      const lift: number[] = [];
      const swing: number[] = [];
      for (const side of [0, 1]) {
        const [fx, fy] = footCycle(wk.p / (Math.PI * 2) + side * 0.5);
        lift.push(fy * wk.a * size * 1.2);
        swing.push(fx * wk.a * size * 0.42);
      }
      const legH = sh - waist;
      for (let r = 0; r < R; r++) {
        const sy0 = waist + Math.floor((r * legH) / R);
        const sy1 = r === R - 1 ? sh : waist + Math.floor(((r + 1) * legH) / R);
        // 0 at the waist (moves with the body) .. 1 at the toes (moves with its own foot)
        const ramp = smooth(0, 0.85, (r + 0.5) / R);
        for (let c = 0; c < C; c++) {
          const sx0 = Math.floor((c * sw) / C);
          const sx1 = c === C - 1 ? sw : Math.floor(((c + 1) * sw) / C);
          const wR = smooth(0.3, 0.7, (c + 0.5) / C); // 0 left foot .. 1 right foot, blended in the middle
          let footDy = mix(-lift[0]! + bobTop * 0.4, -lift[1]! + bobTop * 0.4, wR);
          let footDx = mix(swing[0]!, swing[1]!, wR);
          if (quad) {
            // four legs: the step travels along the body (hind legs first, then the front ones), so neighbouring legs are never in step
            // and each foot lifts and plants smoothly; the stride is shorter than a biped's
            const [fx, fy] = footCycle(wk.p / (Math.PI * 2) + ((c + 0.5) / C) * 0.75);
            footDy = -fy * wk.a * size * 0.95 + bobTop * 0.4;
            footDx = fx * wk.a * size * 0.32;
          }
          slice(g, src, sw, sh, X0, Y0, w, h, sx0, sy0, sx1 - sx0, sy1 - sy0, footDx * ramp, mix(bobTop, footDy, ramp), OV, r === R - 1 ? 0 : OV);
        }
      }
    }
  }
  g.restore();
}
