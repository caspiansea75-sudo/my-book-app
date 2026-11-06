/**
 * Arena Brawl engine: a real-time, top-down fight. No DOM, no React — `step(state, input, dt)` moves the world on
 * and `state.events` tells the screen what to show and play. Because it is plain data, a whole fight can be
 * simulated headless (the CPU can even play the player's side).
 */
import { DIGGERS, FIELDS, FOE_POOL, ALT_BURST, GMAX, ITEMS, MEGAS, MOVES, PERKS, ROSTER, TERA_TYPES, Z_MOVES, Z_SIGNATURE, cleanMoves, gimmicksFor, isPhysical, isSwimmer, locoOf, movePool, speciesOf, type FieldKind, type GimmickKind, type ItemKind, type Loco, type MegaForm, type MoveDef, type Species, type StatusKind } from "@/lib/pokemon/arena-data";
import { typeMult } from "@/lib/pokemon/shared";
import { MOBILITY, mobilityOf, type Mobility } from "@/lib/pokemon/arena-mobility";

/** The arena is this many times the size the first one was (960 x 600): more room to run, circle and dodge. (1.5 before; 2 now.) */
const K = 2;
export const W = 960 * K;
export const H = 600 * K;
const MARGIN = 46;
const CX = W / 2;
const CY = H / 2;

export type Mode = "survival" | "royale" | "quick" | "training";
export type Level = "easy" | "normal" | "hard";

export type StageKind = "grass" | "stone" | "dirt" | "crystal" | "ice" | "lava" | "coast" | "meadow" | "glacier" | "ocean";
export type ObsKind = "crate" | "pillar" | "crystal" | "rock" | "tree" | "pine" | "iceboulder" | "basalt" | "palm" | "cactus";
/** Something standing in the arena: crates break, the rest do not. */
export type Obstacle = { id: number; kind: ObsKind; x: number; y: number; r: number; hp: number; hit: number; /** a pillar thrown up by a blast: when it crumbles (game time), and its height and width */ until?: number; ph?: number; pw?: number };
/** An oval patch of the floor: a bottomless pit or a pool of water. */
export type Patch = { id: number; x: number; y: number; rx: number; ry: number; base?: number; /** the whole floor is this water (the Ocean arena) */ flood?: boolean };
/** A round sheet of ice lying on water: it is dry, slippery ground. Ice moves make them, fire melts them. */
export type Frozen = { id: number; x: number; y: number; r: number };

export type Fighter = {
  id: number;
  team: number;
  isPlayer: boolean;
  auto: boolean; // controlled by the computer (also used for a headless test of the player's side)
  sp: Species;
  boss: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  face: number;
  hp: number;
  ghost: number; // the pale part of the HP bar that catches up late
  maxHp: number;
  speed: number;
  power: number; // attack stat
  defence: number;
  dmgMul: number;
  takeMul: number;
  critChance: number;
  drain: number;
  cdMul: number;
  dodgeMul: number;
  speedMul: number;
  cd: [number, number, number, number];
  /** The four moves it brought (a multiplayer or customised loadout). */
  loadout?: string[];
  /** Multiplayer: the member number and name behind this fighter, and the place it finished in. */
  member?: number;
  name?: string;
  place?: number;
  /** Training Ground practice dummy: stands still, wanders, or fights back. */
  dummy?: "idle" | "walk" | "fight";
  /** Training Ground: which dummy slot this fighter is. */
  dumKey?: number;
  cast: { slot: number; t: number; total: number; dx: number; dy: number; tx: number; ty: number } | null;
  channel: { slot: number; t: number; tick: number; dx: number; dy: number } | null;
  dash: { t: number; total: number; dx: number; dy: number; dist: number; mv: MoveDef; hit: Set<number>; under?: boolean } | null;
  dodge: { t: number; cd: number; dx: number; dy: number; perfected: boolean };
  /** The special movement in progress (hop, dig, run, fly, blink…), and the wait before it can be used again. */
  mov: Mov | null;
  movCd: number;
  /** Which of its types the special movement uses: 0 = first, 1 = second. */
  movIdx: number;
  invuln: number;
  shield: number;
  buffT: number;
  buffMul: number;
  /** Stat changes from moves like Swords Dance: multipliers on attack, special attack, defence, special defence and speed. */
  boost: { atk: number; spa: number; def: number; spd: number; spe: number };
  boostT: number;
  /** Height off the ground in pixels (drawn only): used while a Seismic Toss carries someone up. */
  air: number;
  /** Lifted by a Psychic blow: how high it hangs now (drawn), seconds left floating, and the pause before it can be lifted again. */
  lev: number;
  levT: number;
  levCd: number;
  /** Seconds left of being slammed (the foe) or of slamming (the holder). */
  slamT: number;
  slamBy: number;
  slamDmg: number;
  heal: { t: number; per: number } | null;
  status: Record<StatusKind, number> & { frzImmune: number };
  flash: number;
  stun: number;
  /** Held in the air by a Psychic Grip, and thrown afterwards. */
  grabT: number;
  grabBy: number;
  grabDmg: number;
  flyT: number;
  flyDx: number;
  flyDy: number;
  flyBy: number;
  flyDmg: number;
  flyHit: number[];
  kx: number;
  ky: number;
  alive: boolean;
  koT: number;
  // computer control
  think: number;
  gcd: number;
  strafe: number;
  roam: { x: number; y: number };
  ringT: number; // the boss's ring attack
  // player only
  combo: { n: number; t: number; last: number; best: number; /** seconds the finisher stays ready (0 = not ready) */ ready: number };
  focus: number; // bonus damage after a perfect dodge
  ult: number; // the awakening gauge, 0 to 100
  awaken: number; // seconds of awakening left
  haste: number; // seconds of speed-boots left
  /** The battle gimmick this Pokémon uses with the gauge: Awaken, Mega Evolution, Z-Move, Dynamax or Terastallization. */
  gimmick: GimmickKind;
  cpuGimmick: boolean; // a computer player that fills its gauge and uses its gimmick
  /** Current types: they change with a Mega Evolution or Terastallization. */
  types: string[];
  megaForm: MegaForm | null; // the form chosen to evolve into
  form: MegaForm | null; // the form it is in right now
  mega: number;
  megaP: number;
  megaD: number;
  megaS: number;
  baseR: number;
  dyna: number;
  gmax: boolean;
  tera: { type: string; t: number } | null;
  teraType: string;
  crystal: number; // the Tera crystal shield
  zLock: boolean; // busy with a Z-Move
  override: Record<number, MoveDef>; // a move slot that is temporarily a different move (Tera Blast)
  /** How it gets around: walking, running, flying, floating, swimming or slithering. */
  loco: Loco;
  canFly: boolean; // crosses pits and low obstacles
  swimmer: boolean; // fast in water
  digger: boolean;
  mvx: number; // the speed it is actually moving at (it takes time to speed up or stop)
  mvy: number;
  inWater: boolean;
  stride: number; // distance walked, for the footstep animation
  dealt: number;
  kos: number;
};

export type Proj = {
  id: number;
  owner: number;
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  type: string;
  life: number;
  pierce: boolean;
  hits: Set<number>;
  status?: { kind: StatusKind; chance: number };
  homing: boolean;
  beam: boolean;
  kb: number;
  /** Dynamax shots burst on impact over this radius (0 for none). */
  aoe: number;
  mv: string; // the move it came from (the picture depends on it)
  born: number;
};

export type Zone = {
  id: number;
  owner: number;
  team: number;
  shape: "circle" | "line" | "ring";
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number; // radius, or half-width of a line
  delay: number; // warning time left before it strikes
  total: number; // the whole warning time (for drawing how far along it is)
  life: number; // how long the strike is shown afterwards
  dmg: number;
  type: string;
  status?: { kind: StatusKind; chance: number };
  kb: number;
  struck: boolean;
  mv: MoveDef;
  player: boolean;
  /** Lingering zones (whirls) hurt again every so often. */
  tick?: number;
};

export type Ev =
  | { t: "cast"; id: number; dir: number; mv: string; tx: number; ty: number; x: number; y: number; type: string; kind: string; byPlayer: boolean }
  | { t: "hit"; id: number; x: number; y: number; dmg: number; crit: boolean; eff: number; type: string; toPlayer: boolean; byPlayer: boolean; dx: number; dy: number; heavy: boolean; mv?: string }
  | { t: "explode"; x: number; y: number; r: number; type: string; fx?: string; mv?: string }
  | { t: "lift"; id: number; x: number; y: number }
  | { t: "crate"; x: number; y: number; kind?: string }
  | { t: "fall"; x: number; y: number; id: number; player: boolean }
  | { t: "dig"; x: number; y: number; id: number; phase: "down" | "up"; type: string }
  | { t: "stage"; kind: StageKind }
  | { t: "dodge"; x: number; y: number }
  | { t: "mov"; id: number; type: string; phase: "start" | "end"; x: number; y: number; x2: number; y2: number }
  | { t: "perfect"; x: number; y: number }
  | { t: "ko"; x: number; y: number; id: number; id2: string; type: string; byPlayer: boolean; player: boolean; boss: boolean }
  | { t: "combo"; n: number; finish: boolean }
  | { t: "heal"; x: number; y: number; amt: number; /** a drain: where the life came from */ fx?: number; fy?: number; id?: number }
  | { t: "status"; x: number; y: number; kind: StatusKind }
  | { t: "ailment"; x: number; y: number; kind: "par" | "cnf" | "slp" }
  | { t: "shield"; x: number; y: number }
  | { t: "buff"; x: number; y: number; id: number; fx?: string }
  | { t: "stat"; x: number; y: number; id: number; up: string[]; down: string[] }
  | { t: "patch"; x: number; y: number; kind: string; r: number; id: number }
  | { t: "slam"; id: number; by: number; x: number; y: number; phase: "lift" | "hit" }
  | { t: "grab"; id: number; by: number; x: number; y: number }
  | { t: "throw"; id: number; dx: number; dy: number; x: number; y: number }
  | { t: "wave"; n: number; boss: boolean }
  | { t: "perks" }
  | { t: "storm" }
  | { t: "mega"; x: number; y: number; id: number; name: string; z: boolean; type: string; origin?: boolean }
  | { t: "zstart"; x: number; y: number; type: string; name: string }
  | { t: "zhit"; x: number; y: number; type: string }
  | { t: "dynamax"; x: number; y: number; id: number; gmax: boolean }
  | { t: "tera"; x: number; y: number; id: number; type: string }
  | { t: "gimmickEnd"; x: number; y: number; kind: GimmickKind }
  | { t: "awaken"; x: number; y: number; id: number }
  | { t: "item"; x: number; y: number; kind: ItemKind; byPlayer: boolean }
  | { t: "field"; kind: FieldKind }
  | { t: "hazard"; x: number; y: number }
  | { t: "swap"; team: number; x: number; y: number; name: string; faint: boolean }
  | { t: "arena"; kind: "gust" | "vent" | "tide" | "spot" | "spotget" | "freeze" | "thaw"; x: number; y: number; dx?: number; dy?: number; team?: number }
  | { t: "clash"; x: number; y: number }
  | { t: "over"; win: boolean };

export type Input = {
  mx: number;
  my: number;
  /** Where the player is aiming (a point in the arena), or null to aim at the nearest foe. */
  aim: { x: number; y: number } | null;
  cast: [boolean, boolean, boolean, boolean];
  dodge: boolean;
  /** The special movement of the Pokémon's type. */
  mov?: boolean;
  /** Which type's movement the button uses (0 or 1). */
  movSel?: number;
  /** Awaken (the special burst), once the gauge is full. */
  ult?: boolean;
  /** Fire the combo finisher (once four different moves were chained). */
  fin?: boolean;
  /** Quick Battle: bring the squad member with this number into the ring. */
  swap?: number;
};
export const noInput = (): Input => ({ mx: 0, my: 0, aim: null, cast: [false, false, false, false], dodge: false, ult: false });

/** A special movement under way. `id` is the type whose movement it is; `ox,oy` is where it began, `tx,ty` where it ends. */
export type Mov = { id: string; t: number; total: number; dx: number; dy: number; ox: number; oy: number; tx: number; ty: number; hit: number[]; tick: number; seed: number };

export type Hazard = { id: number; owner: number; team: number; kind: "spikes" | "toxic" | "rocks"; x: number; y: number; r: number; life: number; max: number; hit: Record<number, number> };

/** One practice dummy: which Pokémon, how it behaves, which gimmick it carries and which four moves it knows. */
export type DummyCfg = {
  key: number;
  species: string;
  mode: "idle" | "walk" | "fight";
  gimmick: GimmickKind | "none";
  mega: string;
  tera: string;
  /** null = the Pokémon's own four moves */
  moves: string[] | null;
  respawn: number;
};

export type Train = {
  /** the practice dummies (up to five) */
  dums: DummyCfg[];
  nextKey: number;
  /** the dummies are put back to full HP whenever they get low (so they never go down) */
  immortal: boolean;
  /** the player's move cooldowns and gauge are always ready */
  nocd: boolean;
  last: number;
  total: number;
  hits: number;
  /** damage per second over the current string of hits, and the best of any */
  dps: number;
  best: number;
  start: number;
  lastT: number;
};

export type State = {
  mode: Mode;
  time: number;
  nextId: number;
  fighters: Fighter[];
  projs: Proj[];
  zones: Zone[];
  /** Patches on the floor left by Spikes, Toxic Spikes and Stealth Rock. */
  hazards: Hazard[];
  /** Training Ground settings and the damage read-out. */
  train?: Train;
  events: Ev[];
  phase: "intro" | "fight" | "perks" | "over";
  introT: number;
  wave: number;
  score: number;
  freeze: number; // hit-stop
  slow: number; // slow motion after a perfect dodge
  /** A Z-Move that has been announced and strikes when the cinematic ends. */
  zPending: { fid: number; type: string; name: string } | null;
  stage: StageKind;
  obs: Obstacle[];
  holes: Patch[];
  pools: Patch[];
  /** ice on the water */
  frozen: Frozen[];
  items: { id: number; x: number; y: number; kind: ItemKind; life: number }[];
  itemT: number;
  hazardT: number;
  field: FieldKind;
  perks: string[]; // the three offered
  taken: string[]; // perks picked so far
  storm: { r: number; on: boolean };
  winner: boolean;
  place: number;
  perfects: number;
  /** Mean time the player has to dodge: higher is easier. */
  easy: number;
  /** Multiplayer royale (2-5 members, no computer fighters). */
  mp?: boolean;
  /** Multiplayer Team Battle (3v3): two sides, computer fighters fill empty seats. */
  teamBattle?: boolean;
  /** Multiplayer: the fighter id of the champion once the fight is over (0 = nobody, a draw). */
  winnerId?: number;
  /** When two beams last met (so the steam is not spawned every frame). */
  clashT?: number;
  /** Quick Battle (3v3): computer difficulty, both squads (index = team), swap cool-down per team. */
  level?: Level;
  squads?: Fighter[][];
  /** What a screen that only sees the ring needs to draw the squads: set by the host's encoder, read by the client. */
  sq?: { id: number; sp: string; hp: number; max: number; alive: boolean; cur: boolean }[][];
  swapCd?: number[];
  /** Arena events (Quick Battle). */
  gust?: { warn: number; t: number; dx: number; dy: number } | null;
  gustT?: number;
  vents?: { x: number; y: number }[];
  ventT?: number;
  tideT?: number;
  spot?: { x: number; y: number; r: number; life: number; prog: number[] } | null;
  spotT?: number;
};

/** The move in a slot (Tera Blast takes over the fourth one for a while). */
export const moveOf = (f: Fighter, slot: number): MoveDef => f.override[slot] ?? MOVES[(f.loadout ?? f.sp.moves)[slot]!]!;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const len = (x: number, y: number) => Math.hypot(x, y);
const norm = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y);
  return l < 1e-6 ? [1, 0] : [x / l, y / l];
};

const emptyStatus = () => ({ brn: 0, psn: 0, par: 0, frz: 0, cnf: 0, slp: 0, frzImmune: 0 });

/* ----------------------------------------------------------------- the arena floor */

const TALL_OBS = new Set<ObsKind>(["pillar", "tree", "pine", "palm", "crystal", "basalt"]);
const OBS_R: Record<ObsKind, number> = { crate: 24, pillar: 26, crystal: 22, rock: 24, tree: 27, pine: 24, iceboulder: 28, basalt: 26, palm: 20, cactus: 18 };

/** An explosion, which also splinters any crates it reaches. */
/** `silent`: the blast still breaks crates and wears things down, but no explosion is drawn (used by gimmick transformations). */
function boom(S: State, x: number, y: number, r: number, type: string, fx?: string, silent = false, mv?: string) {
  if (!silent) S.events.push({ t: "explode", x, y, r, type, fx, mv });
  for (const o of S.obs) {
    if (o.hp <= 0 || len(o.x - x, o.y - y) > r + o.r * 0.6) continue;
    if (o.kind === "crate") breakCrate(S, o);
    else if (r >= 85) {
      // big blasts wear down rocks, pillars and crystals until they crumble
      o.hp -= 30 + r * 0.25;
      o.hit = 0.25;
      if (o.hp <= 0) {
        o.hp = 0;
        S.events.push({ t: "crate", x: o.x, y: o.y, kind: o.kind });
      }
    }
  }
  if (r >= 70 && (type === "Ground" || type === "Rock")) raisePillars(S, x, y, r);
  if (type === "Ice" && S.pools.length) freezeWater(S, x, y, Math.max(46, r * 0.9));
  else if (type === "Fire" && S.frozen.length) meltIce(S, x, y, r);
}

/** Heavy earth and rock blasts push up stone pillars: they block everyone like any pillar, wear down under big blasts, and crumble after a while. */
function raisePillars(S: State, x: number, y: number, r: number) {
  let live = S.obs.filter((o) => o.until !== undefined && o.hp > 0).length;
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n && live < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.min(r, 150) * (0.35 + Math.random() * 0.75);
    const px = clamp(x + Math.cos(a) * d, MARGIN + 40, W - MARGIN - 40);
    const py = clamp(y + Math.sin(a) * d * 0.8, MARGIN + 40, H - MARGIN - 40);
    const w = 11 + Math.random() * 9;
    const pr = w * 1.1;
    // never on somebody, on another obstacle, or in a pit or pool
    if (S.fighters.some((f) => f.alive && len(f.x - px, f.y - py) < f.r + pr + 10)) continue;
    if (S.obs.some((o) => o.hp > 0 && len(o.x - px, o.y - py) < o.r + pr + 12)) continue;
    if (S.holes.some((h) => inPatch(h, px, py, pr + 6)) || S.pools.some((h) => inPatch(h, px, py, pr + 6))) continue;
    S.obs.push({ id: S.nextId++, kind: "pillar", x: px, y: py, r: pr, hp: 99, hit: 0, until: S.time + 7 + Math.random() * 4, ph: 36 + Math.random() * 48, pw: w });
    live++;
  }
}

function breakCrate(S: State, o: Obstacle) {
  if (o.hp <= 0) return;
  o.hp = 0;
  S.events.push({ t: "crate", x: o.x, y: o.y });
  if (Math.random() < 0.22 && S.items.length < 4) {
    const kinds = Object.keys(ITEMS) as ItemKind[];
    S.items.push({ id: S.nextId++, x: o.x, y: o.y, kind: kinds[Math.floor(Math.random() * kinds.length)]!, life: 14 });
  }
}

const inPatch = (p: Patch, x: number, y: number, pad = 0) => ((x - p.x) / (p.rx + pad)) ** 2 + ((y - p.y) / (p.ry + pad)) ** 2 < 1;
/** Is this spot on a sheet of ice that lies on the water? */
const iced = (S: State, x: number, y: number) => S.frozen.some((f) => (x - f.x) ** 2 + (y - f.y) ** 2 < f.r * f.r);
/** Water you actually stand in: a pool, unless it has frozen over there. */
const wetAt = (S: State, x: number, y: number) => S.pools.some((p) => inPatch(p, x, y)) && !iced(S, x, y);

/** An ice move lands on water: it freezes over around the spot (more hits widen the same sheet). */
function freezeWater(S: State, x: number, y: number, r: number) {
  if (!S.pools.some((p) => inPatch(p, x, y, r * 0.3))) return;
  const near = S.frozen.find((f) => len(f.x - x, f.y - y) < Math.max(f.r, r) * 0.6);
  if (near) {
    near.r = Math.min(150, near.r + r * 0.22);
    near.x += (x - near.x) * 0.15;
    near.y += (y - near.y) * 0.15;
    return;
  }
  if (S.frozen.length >= 36) S.frozen.shift();
  S.frozen.push({ id: S.nextId++, x, y, r: Math.max(34, Math.min(r, 120)) });
  S.events.push({ t: "arena", kind: "freeze", x, y });
}
/** Fire melts ice back to water. */
function meltIce(S: State, x: number, y: number, r: number) {
  for (const f of [...S.frozen]) {
    if (len(f.x - x, f.y - y) > f.r + r * 0.5) continue;
    f.r -= Math.max(18, r * 0.45);
    if (f.r < 16) S.frozen.splice(S.frozen.indexOf(f), 1);
    S.events.push({ t: "arena", kind: "thaw", x: f.x, y: f.y });
  }
}

/** Lays out crates, pillars, crystals, a pond or a pit — each stage has its own. */
export function buildStage(S: State, kind: StageKind) {
  S.stage = kind;
  S.obs = [];
  S.holes = [];
  S.pools = [];
  S.frozen = [];
  S.vents = undefined;
  S.gust = null;
  S.spot = null;
  const free = (x: number, y: number, r: number) =>
    x > MARGIN + r + 10 && x < W - MARGIN - r - 10 && y > MARGIN + r + 10 && y < H - MARGIN - r - 10 &&
    S.obs.every((o) => len(o.x - x, o.y - y) > o.r + r + 46) &&
    S.holes.every((h) => !inPatch(h, x, y, r + 30)) &&
    S.pools.every((h) => !inPatch(h, x, y, r + 20)) &&
    S.fighters.every((f) => !f.alive || len(f.x - x, f.y - y) > f.r + r + 60);
  const scatter = (k: ObsKind, n: number) => {
    // a bigger floor gets more things standing on it (a little thinner than before, so there is still room to run)
    for (let i = 0; i < Math.round(n * K * K * 0.75); i++) {
      for (let t = 0; t < 30; t++) {
        const x = rnd(MARGIN + 40, W - MARGIN - 40);
        const y = rnd(MARGIN + 40, H - MARGIN - 40);
        if (free(x, y, OBS_R[k])) {
          S.obs.push({ id: S.nextId++, kind: k, x, y, r: OBS_R[k], hp: k === "crate" ? 1 : 99, hit: 0 });
          break;
        }
      }
    }
  };
  const patch = (list: Patch[], rx: number, ry: number, x: number, y: number) => list.push({ id: S.nextId++, x, y, rx, ry });
  switch (kind) {
    case "grass":
      patch(S.pools, rnd(80, 110) * K, rnd(55, 75) * K, rnd(300, 660) * K, rnd(190, 410) * K);
      scatter("tree", 6);
      scatter("crate", 4);
      scatter("rock", 2);
      break;
    case "stone":
      scatter("crate", 5);
      scatter("pillar", 3);
      break;
    case "dirt":
      scatter("cactus", 4);
      scatter("crate", 3);
      scatter("rock", 5);
      break;
    case "crystal":
      patch(S.holes, 190 * K, 105 * K, CX, CY);
      scatter("crystal", 8);
      scatter("pillar", 1);
      break;
    case "ice":
      scatter("pine", 4);
      scatter("iceboulder", 4);
      scatter("crystal", 2);
      scatter("crate", 3);
      break;
    case "lava":
      patch(S.holes, 120 * K, 70 * K, CX, CY);
      S.vents = [
        { x: 250 * K, y: 150 * K }, { x: W - 250 * K, y: 150 * K }, { x: 250 * K, y: H - 150 * K }, { x: W - 250 * K, y: H - 150 * K },
        { x: CX, y: 120 * K }, { x: CX, y: H - 120 * K },
      ];
      scatter("basalt", 5);
      scatter("rock", 2);
      scatter("crate", 3);
      break;
    case "meadow":
    case "glacier":
      // wide open floors: nothing to stand behind
      break;
    case "ocean":
      // the whole floor is water
      S.pools.push({ id: S.nextId++, x: CX, y: CY, rx: W * 0.8, ry: H * 0.8, flood: true });
      break;
    case "coast": {
      const a = rnd(150, 190) * K, b = rnd(80, 100) * K;
      S.pools.push({ id: S.nextId++, x: 250 * K, y: H - 190 * K, rx: a, ry: b, base: a });
      S.pools.push({ id: S.nextId++, x: W - 250 * K, y: 190 * K, rx: a, ry: b, base: a });
      scatter("palm", 4);
      scatter("crate", 4);
      scatter("rock", 3);
      break;
    }
  }
}

/** Anyone left standing inside something solid steps out to the nearest free spot. */
function unstick(S: State) {
  for (const f of S.fighters) {
    if (!f.alive) continue;
    for (let k = 0; k < 6; k++) {
      let moved = false;
      for (const o of S.obs) {
        if (o.hp <= 0) continue;
        const d = len(f.x - o.x, f.y - o.y);
        const min = f.r + o.r + 6;
        if (d < min) {
          const [nx, ny] = norm(f.x - o.x, f.y - o.y);
          f.x = clamp(o.x + nx * min, MARGIN, W - MARGIN);
          f.y = clamp(o.y + ny * min, MARGIN, H - MARGIN);
          moved = true;
        }
      }
      for (const h of S.holes) {
        if (!f.canFly && inPatch(h, f.x, f.y, 6)) {
          const [nx, ny] = norm((f.x - h.x) / h.rx, (f.y - h.y) / h.ry);
          f.x = clamp(h.x + nx * (h.rx + 18), MARGIN, W - MARGIN);
          f.y = clamp(h.y + ny * (h.ry + 18), MARGIN, H - MARGIN);
          moved = true;
        }
      }
      if (!moved) break;
    }
  }
}

/* ----------------------------------------------------------------------- setup */

function makeFighter(S: State, sp: Species, team: number, isPlayer: boolean, x: number, y: number, scale = { hp: 1, dmg: 1 }, boss = false): Fighter {
  const [hp, atk, def, spa, spd, spe] = sp.bs;
  const maxHp = Math.round((hp * 2.6 + 80) * scale.hp * (boss ? 3.4 : 1));
  return {
    id: S.nextId++,
    team,
    isPlayer,
    auto: !isPlayer,
    sp,
    boss,
    x,
    y,
    vx: 0,
    vy: 0,
    r: sp.size * (boss ? 0.82 : 0.6),
    face: 0,
    hp: maxHp,
    ghost: maxHp,
    maxHp,
    speed: 128 + spe * 0.95,
    power: Math.max(atk, spa),
    defence: (def + spd) / 2,
    dmgMul: scale.dmg,
    takeMul: 1,
    critChance: 0.06,
    drain: 0,
    cdMul: 1,
    dodgeMul: 1,
    speedMul: 1,
    cd: [rnd(0.3, 1.4), rnd(0.3, 1.4), rnd(0.8, 2.2), rnd(1, 3)],
    cast: null,
    channel: null,
    dash: null,
    dodge: { t: 0, cd: 0, dx: 0, dy: 0, perfected: false },
    mov: null,
    movCd: 0,
    movIdx: 0,
    invuln: 0,
    shield: 0,
    buffT: 0,
    buffMul: 1,
    boost: { atk: 1, spa: 1, def: 1, spd: 1, spe: 1 },
    boostT: 0,
    air: 0,
    lev: 0,
    levT: 0,
    levCd: 0,
    slamT: 0,
    slamBy: 0,
    slamDmg: 0,
    heal: null,
    status: emptyStatus(),
    flash: 0,
    stun: 0,
    grabT: 0,
    grabBy: 0,
    grabDmg: 0,
    flyT: 0,
    flyDx: 0,
    flyDy: 0,
    flyBy: 0,
    flyDmg: 0,
    flyHit: [],
    kx: 0,
    ky: 0,
    alive: true,
    koT: 0,
    think: rnd(0.1, 0.5),
    gcd: rnd(0.6, 1.4),
    strafe: Math.random() < 0.5 ? 1 : -1,
    roam: { x, y },
    ringT: rnd(3, 5),
    combo: { n: 0, t: 0, last: -1, best: 0, ready: 0 },
    focus: 0,
    ult: 0,
    awaken: 0,
    haste: 0,
    gimmick: "awaken",
    cpuGimmick: false,
    types: [...sp.types],
    megaForm: null,
    form: null,
    mega: 0,
    megaP: 1,
    megaD: 1,
    megaS: 1,
    baseR: sp.size * (boss ? 0.82 : 0.6),
    dyna: 0,
    gmax: false,
    tera: null,
    teraType: sp.types[0] ?? "Normal",
    crystal: 0,
    zLock: false,
    override: {},
    loco: locoOf(sp),
    canFly: ["fly", "float"].includes(locoOf(sp)),
    swimmer: isSwimmer(sp),
    digger: DIGGERS.has(sp.id),
    mvx: 0,
    mvy: 0,
    inWater: false,
    stride: 0,
    dealt: 0,
    kos: 0,
  };
}

export type NewGameOptions = { dummy?: string; arena?: StageKind; auto?: boolean; gimmick?: GimmickKind; mega?: string; tera?: string; moves?: string[] };

export function newGame(mode: Mode, speciesId: string, opts: NewGameOptions = {}): State {
  const S: State = {
    mode,
    time: 0,
    nextId: 1,
    fighters: [],
    projs: [],
    zones: [],
    hazards: [],
    events: [],
    phase: "intro",
    introT: 1.6,
    wave: 0,
    score: 0,
    freeze: 0,
    slow: 0,
    zPending: null,
    stage: "stone",
    obs: [],
    holes: [],
    frozen: [],
    pools: [],
    items: [],
    itemT: 7,
    hazardT: 6,
    field: "none",
    perks: [],
    taken: [],
    storm: { r: 520 * K, on: false },
    winner: false,
    place: 0,
    perfects: 0,
    easy: 1,
  };
  const player = makeFighter(S, speciesOf(speciesId), 0, true, mode === "royale" ? CX : 230 * K, mode === "royale" ? CY + 150 * K : CY);
  player.loadout = cleanMoves(speciesId, opts.moves);
  player.auto = !!opts.auto;
  player.cpuGimmick = !!opts.auto; // an auto-piloted player also uses its gimmick
  player.gimmick = opts.gimmick ?? "awaken";
  player.megaForm = (MEGAS[speciesId] ?? []).find((m) => m.id === opts.mega) ?? MEGAS[speciesId]?.[0] ?? null;
  if (player.gimmick === "mega" && !player.megaForm) player.gimmick = "awaken";
  if (opts.tera && TERA_TYPES.includes(opts.tera)) player.teraType = opts.tera;
  S.fighters.push(player);
  buildStage(S, mode === "royale" ? ARENAS[Math.floor(Math.random() * ARENAS.length)]! : mode === "training" ? opts.arena ?? "grass" : "grass");
  if (mode === "training") {
    S.train = { dums: [], nextKey: 1, immortal: true, nocd: true, last: 0, total: 0, hits: 0, dps: 0, best: 0, start: 0, lastT: -99 };
    trainAdd(S, opts.dummy);
    S.wave = 1;
  }
  if (mode === "royale") {
    const pool = ROSTER.filter((s) => s.id !== speciesId && !s.unlock);
    for (let i = 0; i < 4; i++) {
      const sp = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!;
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cpu = makeFighter(S, sp, i + 1, false, CX + Math.cos(a) * 300 * K, CY + Math.sin(a) * 200 * K, { hp: 0.95, dmg: 0.95 });
      // in a royale everybody brings a gimmick
      const kinds = gimmicksFor(sp.id);
      cpu.cpuGimmick = true;
      cpu.gimmick = kinds[Math.floor(Math.random() * kinds.length)]!;
      const forms = MEGAS[sp.id] ?? [];
      cpu.megaForm = forms[Math.floor(Math.random() * forms.length)] ?? null;
      cpu.teraType = TERA_TYPES[Math.floor(Math.random() * TERA_TYPES.length)]!;
      S.fighters.push(cpu);
    }
    unstick(S);
    S.wave = 1;
    S.storm = { r: 520 * K, on: false };
    const kinds: FieldKind[] = ["none", "sun", "rain", "sand", "hail"];
    S.field = kinds[Math.floor(Math.random() * kinds.length)]!;
  }
  return S;
}

export const MAX_DUMMIES = 5;

/** Every move a Pokémon can be given in the Training Ground: what it learns, what its types allow (signature moves too), or all of them. */
export function trainMovePool(speciesId: string, everything = false): string[] {
  const sp = ROSTER.find((x) => x.id === speciesId);
  if (!sp) return [];
  if (everything) return Object.keys(MOVES);
  const set = new Set<string>([...movePool(speciesId), ...sp.moves]);
  for (const k of Object.keys(MOVES)) if (sp.types.includes(MOVES[k]!.type)) set.add(k);
  return [...set].filter((m) => MOVES[m]);
}

/** Where dummy number `i` stands: the middle of the right-hand side first, then above and below it. */
function dummySpot(i: number): [number, number] {
  const row = Math.ceil(i / 2) * (i % 2 ? -1 : 1);
  return [CX + (190 + (i > 2 ? 90 : 0)) * K, CY + row * 120 * K];
}

/** Build the fighter for one dummy and put it in the arena (replacing the one with the same key). */
function placeDummy(S: State, cfg: DummyCfg, at?: { x: number; y: number }) {
  const T = S.train!;
  const sp = ROSTER.find((x) => x.id === cfg.species) ?? ROSTER[0]!;
  const i = Math.max(0, T.dums.indexOf(cfg));
  const [sx, sy] = dummySpot(i);
  S.fighters = S.fighters.filter((f) => f.isPlayer || f.dumKey !== cfg.key);
  const d = makeFighter(S, sp, 1, false, at?.x ?? sx, at?.y ?? sy);
  d.loadout = cleanMoves(sp.id, null);
  if (cfg.moves && cfg.moves.length === 4 && cfg.moves.every((m) => MOVES[m])) d.loadout = [...cfg.moves];
  d.dummy = cfg.mode;
  d.dumKey = cfg.key;
  if (cfg.gimmick !== "none") {
    d.gimmick = cfg.gimmick;
    d.megaForm = (MEGAS[sp.id] ?? []).find((m) => m.id === cfg.mega) ?? MEGAS[sp.id]?.[0] ?? null;
    if (d.gimmick === "mega" && !d.megaForm) d.gimmick = "awaken";
    if (TERA_TYPES.includes(cfg.tera)) d.teraType = cfg.tera;
    d.cpuGimmick = cfg.mode === "fight";
  }
  cfg.respawn = 0;
  S.fighters.push(d);
  return d;
}

const dummyOf = (S: State, key: number) => S.fighters.find((f) => !f.isPlayer && f.dumKey === key);

/** Add a practice dummy (at most five). */
export function trainAdd(S: State, speciesId?: string) {
  const T = S.train;
  if (!T || T.dums.length >= MAX_DUMMIES) return;
  const me = S.fighters.find((f) => f.isPlayer);
  const used = new Set(T.dums.map((d) => d.species));
  const sp = ROSTER.find((x) => x.id === speciesId) ?? ROSTER.find((x) => x.id === "snorlax" && !used.has(x.id) && x.id !== me?.sp.id) ?? ROSTER.find((x) => !used.has(x.id) && x.id !== me?.sp.id) ?? ROSTER[0]!;
  const cfg: DummyCfg = { key: T.nextKey++, species: sp.id, mode: "idle", gimmick: "none", mega: MEGAS[sp.id]?.[0]?.id ?? "", tera: TERA_TYPES[0]!, moves: null, respawn: 0 };
  T.dums.push(cfg);
  placeDummy(S, cfg);
}

/** Take a dummy away (at least one stays). */
export function trainRemove(S: State, key: number) {
  const T = S.train;
  if (!T || T.dums.length <= 1) return;
  T.dums = T.dums.filter((d) => d.key !== key);
  S.fighters = S.fighters.filter((f) => f.isPlayer || f.dumKey !== key);
}

/** Change what one dummy is: its Pokémon, behaviour, gimmick or moves. It is rebuilt where it stands. */
export function trainDummy(S: State, key: number, patch: Partial<Pick<DummyCfg, "species" | "mode" | "gimmick" | "mega" | "tera">> & { moves?: string[] | null; slot?: number; move?: string }) {
  const T = S.train;
  const cfg = T?.dums.find((d) => d.key === key);
  if (!T || !cfg) return;
  const old = dummyOf(S, key);
  const at = old ? { x: old.x, y: old.y } : undefined;
  if (patch.species && patch.species !== cfg.species && ROSTER.some((x) => x.id === patch.species)) {
    cfg.species = patch.species;
    cfg.moves = null;
    cfg.mega = MEGAS[cfg.species]?.[0]?.id ?? "";
    if (cfg.gimmick !== "none" && !gimmicksFor(cfg.species).includes(cfg.gimmick)) cfg.gimmick = "none";
  }
  if (patch.mode) cfg.mode = patch.mode;
  if (patch.gimmick) cfg.gimmick = patch.gimmick === "none" || gimmicksFor(cfg.species).includes(patch.gimmick) ? patch.gimmick : "none";
  if (patch.mega !== undefined) cfg.mega = patch.mega;
  if (patch.tera !== undefined && TERA_TYPES.includes(patch.tera)) cfg.tera = patch.tera;
  if (patch.moves !== undefined) cfg.moves = patch.moves;
  if (patch.slot !== undefined && patch.move && MOVES[patch.move] && patch.slot >= 0 && patch.slot < 4) {
    const cur = [...(cfg.moves ?? cleanMoves(cfg.species, null))];
    const was = cur.indexOf(patch.move);
    if (was >= 0) cur[was] = cur[patch.slot]!;
    cur[patch.slot] = patch.move;
    cfg.moves = cur;
  }
  placeDummy(S, cfg, at);
}

/** Make a dummy cast one of its moves at you now (to see it, or to practise dodging it). */
export function trainCast(S: State, key: number, slot: number) {
  const d = dummyOf(S, key);
  if (!d || !d.alive || slot < 0 || slot > 3) return;
  d.cd[slot] = 0;
  d.gcd = 0;
  d.cast = null;
  d.channel = null;
  tryCast(S, d, slot, null);
}

/** Make a dummy use its gimmick (Mega, Z-Move, Dynamax, Tera or Awaken) right now. */
export function trainGimmickNow(S: State, key: number) {
  const d = dummyOf(S, key);
  if (!d || !d.alive || gimmickActive(d)) return;
  d.ult = 100;
  if (d.gimmick === "mega" && !d.megaForm) d.gimmick = "awaken";
  activateGimmick(S, d);
}

/** Give the player a different move in one of its four slots (any move it may have; a move it already has swaps places). */
export function trainPlayerMove(S: State, slot: number, move: string, everything = false) {
  const p = playerOf(S);
  if (!p || slot < 0 || slot > 3 || !MOVES[move]) return;
  if (!trainMovePool(p.sp.id, everything).includes(move)) return;
  const cur = [...(p.loadout ?? cleanMoves(p.sp.id, null))];
  const was = cur.indexOf(move);
  if (was >= 0) {
    cur[was] = cur[slot]!;
    p.cd[was] = 0;
  }
  cur[slot] = move;
  p.cd[slot] = 0;
  p.loadout = cur;
  p.override = {};
}

/** Change the player's gimmick (only while none is running). */
export function trainPlayerGimmick(S: State, kind: GimmickKind, mega?: string, tera?: string) {
  const p = playerOf(S);
  if (!p || gimmickActive(p) || !gimmicksFor(p.sp.id).includes(kind)) return;
  p.gimmick = kind;
  if (mega !== undefined) p.megaForm = (MEGAS[p.sp.id] ?? []).find((m) => m.id === mega) ?? MEGAS[p.sp.id]?.[0] ?? null;
  if (kind === "mega" && !p.megaForm) p.gimmick = "awaken";
  if (tera && TERA_TYPES.includes(tera)) p.teraType = tera;
}

/** (Re)place the dummies at full health: the first one's Pokémon can be changed here. Kept for the old call. */
export function spawnDummy(S: State, speciesId?: string) {
  const T = S.train;
  if (!T) return;
  if (speciesId && T.dums[0]) trainDummy(S, T.dums[0].key, { species: speciesId });
  else for (const c of T.dums) placeDummy(S, c);
}

/** Change the switches that belong to every dummy: how it behaves (all of them) or the two practice options. */
export function trainSet(S: State, patch: Partial<Pick<Train, "immortal" | "nocd">> & { dummy?: DummyCfg["mode"] }) {
  const T = S.train;
  if (!T) return;
  if (patch.immortal !== undefined) T.immortal = patch.immortal;
  if (patch.nocd !== undefined) T.nocd = patch.nocd;
  if (patch.dummy) for (const c of T.dums) trainDummy(S, c.key, { mode: patch.dummy });
}

/** Back to a clean slate: full health, no status, cooldowns ready, everyone back in place and the numbers cleared. */
export function trainReset(S: State) {
  const T = S.train;
  if (!T) return;
  const p = playerOf(S);
  if (p) {
    p.hp = p.ghost = p.maxHp;
    p.cd = [0, 0, 0, 0];
    p.ult = 0;
    p.x = 230 * K;
    p.y = CY;
  }
  S.projs = [];
  S.zones = [];
  S.hazards = [];
  T.last = T.total = T.hits = T.dps = T.best = 0;
  T.lastT = -99;
  for (const c of T.dums) placeDummy(S, c);
}

function trainStep(S: State, dt: number) {
  const T = S.train!;
  const p = playerOf(S);
  if (p && p.alive) {
    p.hp = p.maxHp;
    if (T.nocd) {
      p.cd = [0, 0, 0, 0];
      if (p.ult < 100 && p.awaken <= 0 && !p.form && !p.tera && p.dyna <= 0) p.ult = 100;
    }
  } else if (p && !p.alive) {
    p.alive = true;
    p.hp = p.ghost = p.maxHp;
  }
  // the damage read-out: a string of hits ends after three quiet seconds
  for (const e of S.events) {
    if (e.t !== "hit" || !e.byPlayer || e.toPlayer) continue;
    if (S.time - T.lastT > 3) {
      T.total = 0;
      T.hits = 0;
      T.start = S.time;
    }
    T.last = e.dmg;
    T.total += e.dmg;
    T.hits++;
    T.lastT = S.time;
  }
  if (T.hits > 0) {
    T.dps = T.total / Math.max(1, S.time - T.start);
    T.best = Math.max(T.best, T.dps);
  }
  for (const cfg of T.dums) {
    const d = dummyOf(S, cfg.key);
    if (d && d.alive) {
      if (T.immortal && d.hp < d.maxHp * 0.2) {
        d.hp = d.maxHp;
        d.ghost = d.maxHp;
      }
      // quiet for a while: top it up
      if (S.time - T.lastT > 2.5 && d.hp < d.maxHp) d.hp = Math.min(d.maxHp, d.hp + d.maxHp * 0.5 * dt);
    } else {
      cfg.respawn += dt;
      if (cfg.respawn > 1.3) placeDummy(S, cfg);
    }
  }
}

export type MpPlayer = { member: number; name: string; species: string; gimmick?: GimmickKind; mega?: string; tera?: string; moves?: string[]; /** Team Battle: 0 = Team A (left), 1 = Team B (right). */ team?: number };

/** A battle royale between 2-5 members: every fighter is steered by a person, nobody else is in the arena. */
export function newMpGame(players: MpPlayer[], mode: Mode = "royale", teamBattle = false): State {
  const first = players[0]!;
  const S = newGame(mode, first.species, { gimmick: first.gimmick, mega: first.mega, tera: first.tera });
  // newGame made the first human and four computer fighters: keep only the humans
  S.fighters = [];
  S.nextId = 1;
  S.mp = true;
  const n = players.length;
  if (teamBattle) return newTeamBattle(S, players);
  players.forEach((pl, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    // royale: everybody on their own team around the ring. Co-op: one team in a line on the left.
    const f =
      mode === "royale"
        ? makeFighter(S, speciesOf(pl.species), i, true, CX + Math.cos(a) * 300 * K, CY + Math.sin(a) * 200 * K)
        : makeFighter(S, speciesOf(pl.species), 0, true, 200 * K, CY + (i - (n - 1) / 2) * 90 * K);
    f.gimmick = pl.gimmick ?? "awaken";
    f.megaForm = (MEGAS[pl.species] ?? []).find((m) => m.id === pl.mega) ?? MEGAS[pl.species]?.[0] ?? null;
    if (f.gimmick === "mega" && !f.megaForm) f.gimmick = "awaken";
    if (pl.tera && TERA_TYPES.includes(pl.tera)) f.teraType = pl.tera;
    f.loadout = cleanMoves(pl.species, pl.moves);
    f.member = pl.member;
    f.name = pl.name;
    f.face = mode === "royale" ? Math.atan2(CY - f.y, CX - f.x) : 0;
    S.fighters.push(f);
  });
  unstick(S);
  return S;
}

/** Team Battle (3v3): people on two sides; seats nobody fills are played by the computer, so each side always has three. */
function newTeamBattle(S: State, players: MpPlayer[]): State {
  const sides: MpPlayer[][] = [[], []];
  players.forEach((pl, i) => sides[pl.team === 1 || (pl.team === undefined && i % 2 === 1) ? 1 : 0]!.push(pl));
  const taken = new Set(players.map((p) => p.species));
  const pool = ROSTER.filter((x) => !taken.has(x.id) && !x.unlock);
  for (const team of [0, 1]) {
    const mine = sides[team]!;
    for (let i = 0; i < 3; i++) {
      const x = team === 0 ? 230 * K : W - 230 * K;
      const y = CY + (i - 1) * 130 * K;
      const pl = mine[i];
      if (pl) {
        const f = makeFighter(S, speciesOf(pl.species), team, true, x, y);
        f.gimmick = pl.gimmick ?? "awaken";
        f.megaForm = (MEGAS[pl.species] ?? []).find((m) => m.id === pl.mega) ?? MEGAS[pl.species]?.[0] ?? null;
        if (f.gimmick === "mega" && !f.megaForm) f.gimmick = "awaken";
        if (pl.tera && TERA_TYPES.includes(pl.tera)) f.teraType = pl.tera;
        f.loadout = cleanMoves(pl.species, pl.moves);
        f.member = pl.member;
        f.name = pl.name;
        f.face = team === 0 ? 0 : Math.PI;
        S.fighters.push(f);
      } else {
        const sp = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!;
        const f = makeFighter(S, sp, team, false, x, y, { hp: 1, dmg: 0.95 });
        const kinds = gimmicksFor(sp.id);
        f.cpuGimmick = true;
        f.gimmick = kinds[Math.floor(Math.random() * kinds.length)]!;
        const forms = MEGAS[sp.id] ?? [];
        f.megaForm = forms[Math.floor(Math.random() * forms.length)] ?? null;
        f.teraType = TERA_TYPES[Math.floor(Math.random() * TERA_TYPES.length)]!;
        f.name = "CPU";
        f.face = team === 0 ? 0 : Math.PI;
        S.fighters.push(f);
      }
    }
  }
  S.storm.on = false;
  S.teamBattle = true;
  unstick(S);
  return S;
}

/** Online Quick Battle: two people, each with a squad of three. Team 0 is the first squad (the host's). */
export type MpSquad = { member: number; name: string; picks: QuickPick[] };
export function newMpQuick(a: MpSquad, b: MpSquad, arena: StageKind | "random" = "random"): State {
  const S = newGame("quick", a.picks[0]!.species, {});
  S.fighters = [];
  S.nextId = 1;
  S.level = "normal";
  S.swapCd = [0, 0];
  S.wave = 1;
  S.mp = true;
  const make = (sq: MpSquad, team: number) =>
    sq.picks.slice(0, 3).map((pk) => {
      const f = makeFighter(S, speciesOf(pk.species), team, true, team === 0 ? 230 * K : W - 230 * K, CY);
      f.auto = false;
      f.gimmick = pk.gimmick ?? "awaken";
      f.megaForm = (MEGAS[pk.species] ?? []).find((m) => m.id === pk.mega) ?? MEGAS[pk.species]?.[0] ?? null;
      if (f.gimmick === "mega" && !f.megaForm) f.gimmick = "awaken";
      if (pk.tera && TERA_TYPES.includes(pk.tera)) f.teraType = pk.tera;
      f.loadout = cleanMoves(pk.species, pk.moves);
      f.member = sq.member;
      f.name = sq.name;
      f.face = team === 0 ? 0 : Math.PI;
      return f;
    });
  const mine = make(a, 0);
  const theirs = make(b, 1);
  S.squads = [mine, theirs];
  S.fighters = [mine[0]!, theirs[0]!];
  const kind = arena === "random" ? ARENAS[Math.floor(Math.random() * ARENAS.length)]! : arena;
  buildStage(S, kind);
  S.field = "none";
  unstick(S);
  return S;
}

/** A small description of both squads for the players' screens. */
export function squadView(S: State): NonNullable<State["sq"]> | undefined {
  if (!S.squads) return undefined;
  return S.squads.map((sq) => sq.map((f) => ({ id: f.id, sp: f.sp.id, hp: Math.round(f.hp), max: f.maxHp, alive: f.alive, cur: S.fighters.includes(f) })));
}

export const playerOf = (S: State) => S.fighters[0]!;

function spawnWave(S: State) {
  S.wave++;
  const w = S.wave;
  const boss = w % 5 === 0;
  const bossId = w % 10 === 0 ? "rayquaza" : "mewtwo";
  const fields: FieldKind[] = ["sun", "rain", "sand", "hail"];
  S.field = w >= 2 && w % 2 === 0 ? fields[Math.floor(Math.random() * fields.length)]! : "none";
  S.events.push({ t: "field", kind: S.field });
  // co-op: knocked-out teammates get back up (a little hurt) and the foes grow with the size of the team
  const humans = S.fighters.filter((f) => f.isPlayer);
  for (const f of humans) {
    if (f.alive) continue;
    f.alive = true;
    f.hp = Math.max(f.hp, f.maxHp * 0.4);
    f.ghost = f.hp;
    f.koT = 0;
    f.invuln = 2;
    f.status = emptyStatus();
  }
  const team = S.mp ? Math.max(1, humans.length) : 1;
  const p = humans[0] ?? playerOf(S);
  const scale = { hp: (0.8 + 0.12 * (w - 1)) * (1 + 0.5 * (team - 1)), dmg: (0.62 + 0.07 * (w - 1)) * (1 + 0.08 * (team - 1)) };
  const count = boss ? 1 + (w >= 10 || team >= 3 ? 1 : 0) : Math.min(5 + (team - 1), 1 + Math.floor(w / 2) + (team - 1));
  const spots: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = rnd(MARGIN + 30, W - MARGIN - 30);
      y = rnd(MARGIN + 30, H - MARGIN - 30);
      if (len(x - p.x, y - p.y) > 300 && spots.every(([sx, sy]) => len(x - sx, y - sy) > 120)) break;
    }
    spots.push([x, y]);
    if (boss && i === 0) {
      const f = makeFighter(S, speciesOf(bossId), 1, false, x, y, { hp: scale.hp, dmg: scale.dmg }, true);
      S.fighters.push(f);
    } else {
      const pool = FOE_POOL.slice(0, Math.min(FOE_POOL.length, 4 + w));
      const id = pool[Math.floor(Math.random() * pool.length)]!;
      S.fighters.push(makeFighter(S, speciesOf(id), 1, false, x, y, scale));
    }
  }
  // each wave has its own floor: grass, stone, dirt — and the boss comes with the crystal cave and its pit
  const order: StageKind[] = ["grass", "ice", "stone", "coast", "dirt", "lava"];
  buildStage(S, boss ? "crystal" : order[(w - 1) % order.length]!);
  unstick(S);
  S.events.push({ t: "stage", kind: S.stage });
  S.events.push({ t: "wave", n: w, boss });
  S.phase = "intro";
  S.introT = 1.4;
}

/** Give one fighter a perk (the heal that comes with it included). */
export function applyPerk(S: State, p: Fighter, id: string) {
  S.taken.push(id);
  switch (id) {
    case "power": p.dmgMul *= 1.18; break;
    case "swift": p.speedMul *= 1.14; break;
    case "haste": p.cdMul *= 0.85; break;
    case "vigor": { const add = Math.round(p.maxHp * 0.25); p.maxHp += add; p.hp += add; p.ghost = Math.max(p.ghost, p.hp); break; }
    case "drain": p.drain += 0.07; break;
    case "roll": p.dodgeMul *= 0.7; break;
    case "crit": p.critChance += 0.14; break;
    case "guardian": p.takeMul *= 0.88; break;
  }
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.22);
}

/** Leave the perk screen and start the next wave. */
export function nextWave(S: State) {
  S.phase = "intro";
  S.introT = 0.6;
  spawnWave(S);
}

export function choosePerk(S: State, id: string) {
  applyPerk(S, playerOf(S), id);
  nextWave(S);
}

/* ------------------------------------------------------------------- damage */

const STAB = 1.25;

function foesOf(S: State, f: { team: number; id: number }) {
  return S.fighters.filter((o) => o.alive && o.team !== f.team);
}
function nearestFoe(S: State, f: Fighter, from = { x: f.x, y: f.y }): Fighter | null {
  let best: Fighter | null = null;
  let bd = Infinity;
  for (const o of foesOf(S, f)) {
    const d = len(o.x - from.x, o.y - from.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/** How much the defender's Defense / Sp. Def changes (by the kind of move that is hitting it). */
function defBoost(dst: Fighter, mvId?: string) {
  const mv = mvId ? MOVES[mvId] : undefined;
  return mv ? (isPhysical(mv) ? dst.boost.def : dst.boost.spd) : (dst.boost.def + dst.boost.spd) / 2;
}

function baseDamage(src: Fighter, mv: MoveDef, power = mv.power) {
  return 13 * power * ((src.power * (src.mega > 0 ? src.megaP : 1)) / 90) * (isPhysical(mv) ? src.boost.atk : src.boost.spa) * src.dmgMul * (src.buffT > 0 ? src.buffMul : 1) * (src.awaken > 0 ? 1.5 : 1) * (src.dyna > 0 ? 1.35 : 1);
}

/** Weather helps some types and hurts others. */
function fieldMul(S: State, type: string) {
  if (S.field === "none") return 1;
  const f = FIELDS[S.field];
  return f.up.includes(type) ? 1.3 : f.down.includes(type) ? 0.75 : 1;
}

/** True while any gimmick is running (or a Z-Move is being announced). */
export const gimmickActive = (f: Fighter) => f.awaken > 0 || f.mega > 0 || f.dyna > 0 || !!f.tera || f.zLock;

function gainUlt(f: Fighter, amount: number) {
  if ((f.isPlayer || f.cpuGimmick) && !gimmickActive(f)) f.ult = Math.min(100, f.ult + amount);
}

function applyStatus(S: State, f: Fighter, kind: StatusKind) {
  if (f.dyna > 0) return;
  if (kind === "frz") {
    if (f.status.frzImmune > 0 || f.boss) return;
    f.status.frz = 1.0;
    f.status.frzImmune = 4.5;
  } else if (kind === "slp") {
    // asleep: cannot act until woken by a hard hit or the time runs out, then safe from sleep for a while
    if (f.status.frzImmune > 0 || f.boss) return;
    f.status.slp = 2.4;
    f.status.frzImmune = 5;
    f.cast = f.channel = null;
  } else if (kind === "cnf") f.status.cnf = f.boss ? 2 : 4;
  else if (kind === "par") f.status.par = 3.5;
  else if (kind === "brn") f.status.brn = 4;
  else f.status.psn = 5;
  S.events.push({ t: "status", x: f.x, y: f.y, kind });
}

/** One hit lands (or does not): dodged, shielded, resisted, critical… returns the damage dealt. */
function strike(S: State, src: Fighter, dst: Fighter, dmgBase: number, type: string, o: { kx: number; ky: number; kb: number; status?: { kind: StatusKind; chance: number }; fromPlayerAttack?: boolean; mv?: string }): number {
  if (!dst.alive) return 0;
  if (dst.invuln > 0) {
    // a roll that slips through an attack is a perfect dodge: time slows and the next blows hit harder
    if (dst.isPlayer && dst.dodge.t > 0 && !dst.dodge.perfected) {
      dst.dodge.perfected = true;
      dst.dodge.cd = 0;
      dst.focus = 3;
      gainUlt(dst, 25);
      S.slow = 0.7;
      S.perfects++;
      S.score += 50;
      S.events.push({ t: "perfect", x: dst.x, y: dst.y });
    }
    return 0;
  }
  const eff = typeMult(type, dst.types);
  const orig = src.sp.types.includes(type);
  // a Terastallized Pokémon gets a bigger same-type bonus for its Tera type, and keeps a little of its old one
  const stab = src.tera ? (src.tera.type === type ? (orig ? 2 : 1.5) : orig ? 1.2 : 1) : src.types.includes(type) ? STAB : 1;
  const crit = Math.random() < src.critChance;
  const comboMul = src.isPlayer ? 1 + Math.min(0.5, 0.1 * Math.max(0, src.combo.n - 1)) : 1;
  const focusMul = src.isPlayer && src.focus > 0 ? 1.5 : 1;
  let dmg = dmgBase * fieldMul(S, type) * eff * stab * (crit ? 1.6 : 1) * comboMul * focusMul * rnd(0.93, 1.07) * dst.takeMul * (13 / (6 + (dst.defence * (dst.mega > 0 ? dst.megaD : 1) * defBoost(dst, o.mv)) / 9));
  if (dst.shield > 0) dmg *= 0.12;
  if (dst.crystal > 0) {
    const soak = Math.min(dst.crystal, dmg);
    dst.crystal -= soak;
    dmg -= soak;
  }
  dmg = dmg > 0.5 ? Math.max(1, Math.round(dmg)) : 0;
  const hpBefore = Math.max(0, dst.hp);
  dst.hp -= dmg;
  dst.flash = 0.12;
  src.dealt += dmg;
  gainUlt(src, (dmg / Math.max(1, dst.maxHp)) * 70);
  if (src.drain > 0) src.hp = Math.min(src.maxHp, src.hp + dmg * src.drain);
  // a draining move gives back a share of the damage it really dealt (never more than the target had left)
  const drainK = o.mv ? MOVES[o.mv]?.drain ?? 0 : 0;
  if (drainK > 0 && src.alive && dmg > 0) {
    const gain = Math.min(src.maxHp - src.hp, Math.min(dmg, hpBefore) * drainK);
    if (gain >= 0.5) {
      src.hp += gain;
      src.ghost = Math.max(src.ghost, src.hp);
      S.events.push({ t: "heal", x: src.x, y: src.y, amt: Math.round(gain), fx: dst.x, fy: dst.y, id: src.id });
    }
  }
  const heavy = dmg >= dst.maxHp * 0.12 || crit;
  const [nx, ny] = norm(o.kx, o.ky);
  if (!dst.boss && dst.dyna <= 0) {
    dst.kx += nx * o.kb * (heavy ? 1.3 : 1);
    dst.ky += ny * o.kb * (heavy ? 1.3 : 1);
  }
  if (heavy) S.freeze = Math.max(S.freeze, src.isPlayer || dst.isPlayer ? 0.07 : 0.03);
  if (dst.status.slp > 0 && dmg > 0) dst.status.slp = Math.max(0, dst.status.slp - 1.1); // a hit shakes them awake
  if (o.status && Math.random() < o.status.chance) applyStatus(S, dst, o.status.kind);
  S.events.push({ t: "hit", id: dst.id, x: dst.x, y: dst.y, dmg, crit, eff, type, toPlayer: dst.isPlayer, byPlayer: src.isPlayer, dx: nx, dy: ny, heavy, mv: o.mv });
  if (type === "Ice" && S.pools.length) freezeWater(S, dst.x, dst.y, 46);
  else if (type === "Fire" && S.frozen.length) meltIce(S, dst.x, dst.y, 40);
  if (src.isPlayer) S.score += Math.round(dmg * 0.5);
  // a strong Psychic blow lifts the target off the ground and holds it there for a moment (it cannot move or act), then lets go
  if (type === "Psychic" && dmg > 0 && dst.hp > 0 && dst.levT <= 0 && dst.levCd <= 0 && dst.slamT <= 0 && dst.grabT <= 0 && dst.flyT <= 0 && (!o.mv || (MOVES[o.mv]?.power ?? 1) >= 0.9)) {
    const dur = Math.min(2, 0.8 + (o.mv ? MOVES[o.mv]?.power ?? 1 : 1) * 0.3) * (dst.boss ? 0.5 : 1);
    S.events.push({ t: "lift", id: dst.id, x: dst.x, y: dst.y });
    dst.levT = dur;
    dst.stun = Math.max(dst.stun, dur * 0.9);
    dst.kx *= 0.3;
    dst.ky *= 0.3;
    dst.cast = dst.channel = null;
  }
  if (dst.hp <= 0) kill(S, src, dst);
  return dmg;
}

function kill(S: State, src: Fighter | null, dst: Fighter) {
  dst.alive = false;
  dst.hp = 0;
  dst.koT = 0;
  dst.cast = dst.channel = dst.dash = null;
  dst.levT = 0;
  dst.lev = 0;
  if (src) src.kos++;
  if (src) gainUlt(src, 15);
  if (src?.isPlayer) S.score += 100 * Math.max(1, S.wave) * (dst.boss ? 5 : 1);
  S.events.push({ t: "ko", x: dst.x, y: dst.y, id: dst.id, id2: dst.sp.id, type: dst.types[0] ?? "Normal", byPlayer: !!src?.isPlayer, player: dst.isPlayer, boss: dst.boss });
  S.freeze = Math.max(S.freeze, 0.12);
}

/* ------------------------------------------------------------------- moves */

const aimOf = (S: State, f: Fighter, input: Input | null): { dx: number; dy: number; tx: number; ty: number } => {
  let tx: number;
  let ty: number;
  if (f.isPlayer && !f.auto && input?.aim) {
    tx = input.aim.x;
    ty = input.aim.y;
  } else {
    const foe = nearestFoe(S, f);
    if (foe) {
      // lead the target a little
      const d = len(foe.x - f.x, foe.y - f.y);
      const lead = f.isPlayer ? 0.12 : 0.28 * (d / 300);
      tx = foe.x + foe.vx * lead;
      ty = foe.y + foe.vy * lead;
    } else {
      tx = f.x + Math.cos(f.face) * 200;
      ty = f.y + Math.sin(f.face) * 200;
    }
  }
  const [dx, dy] = norm(tx - f.x, ty - f.y);
  return { dx, dy, tx, ty };
};

function spawnProj(S: State, f: Fighter, mv: MoveDef, dx: number, dy: number, o: { speed?: number; dmg?: number; homing?: boolean; beam?: boolean; r?: number; life?: number; pierce?: boolean; off?: number } = {}) {
  const sp = o.speed ?? mv.speed ?? 480;
  const a = Math.atan2(dy, dx) + (o.off ?? 0);
  const cx = Math.cos(a);
  const cy = Math.sin(a);
  S.projs.push({
    id: S.nextId++,
    owner: f.id,
    team: f.team,
    x: f.x + cx * (f.r + 6),
    y: f.y + cy * (f.r + 6),
    vx: cx * sp,
    vy: cy * sp,
    r: (o.r ?? (mv.kind === "beam" ? 9 : 11)) * (f.dyna > 0 ? 1.6 : 1),
    dmg: o.dmg ?? baseDamage(f, mv),
    type: mv.type,
    life: o.life ?? 1.6,
    pierce: o.pierce ?? !!mv.pierce,
    hits: new Set(),
    status: mv.status,
    homing: !!o.homing,
    beam: !!o.beam,
    kb: mv.kind === "beam" ? 30 : 150,
    aoe: f.dyna > 0 && !o.beam ? 75 : 0,
    mv: mv.id,
    born: S.time,
  });
}

function fire(S: State, f: Fighter, slot: number, dx: number, dy: number, tx: number, ty: number) {
  const mv = moveOf(f, slot);
  f.face = Math.atan2(dy, dx);
  S.events.push({ t: "cast", id: f.id, dir: f.face, mv: mv.id, tx, ty, x: f.x, y: f.y, type: mv.type, kind: mv.kind, byPlayer: f.isPlayer });
  // an icy beam laid across water freezes a path along its whole length
  if (mv.type === "Ice" && S.pools.length && (mv.kind === "beam" || mv.kind === "bolt")) {
    const L = Math.min(mv.range ?? 260, 520) * 0.85;
    for (let d = 50; d <= L; d += 46) freezeWater(S, f.x + Math.cos(f.face) * d, f.y + Math.sin(f.face) * d, 48);
  }
  // Dynamax: moves become Max Moves that change the weather, and Gigantamax adds a blast where you aim
  if (f.dyna > 0) {
    const w: Record<string, FieldKind> = { Fire: "sun", Water: "rain", Ice: "hail", Rock: "sand" };
    const kind = w[mv.type];
    if (kind && S.field !== kind) {
      S.field = kind;
      S.events.push({ t: "field", kind });
    }
    if (f.gmax && mv.kind !== "heal" && mv.kind !== "guard" && mv.kind !== "buff") {
      const gx = clamp(tx, MARGIN, W - MARGIN);
      const gy = clamp(ty, MARGIN, H - MARGIN);
      S.zones.push({ id: S.nextId++, owner: f.id, team: f.team, shape: "circle", x: gx, y: gy, x2: gx, y2: gy, r: 74, delay: 0.5, total: 0.5, life: 0.35, dmg: baseDamage(f, mv, 0.8), type: mv.type, status: mv.status, kb: 280, struck: false, mv, player: f.isPlayer });
    }
  }
  // the new Z forms send out a pulse with every move
  if (f.mega > 0 && f.form?.z && mv.kind !== "heal" && mv.kind !== "guard" && mv.kind !== "buff") {
    const r = 95;
    boom(S, f.x, f.y, r, f.types[0] ?? "Normal");
    for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= r + o.r) strike(S, f, o, baseDamage(f, mv, 0.4), f.types[0] ?? "Normal", { kx: o.x - f.x, ky: o.y - f.y, kb: 200, mv: mv.id });
  }
  switch (mv.kind) {
    case "proj":
      spawnProj(S, f, mv, dx, dy);
      break;
    case "homing":
      spawnProj(S, f, mv, dx, dy, { homing: true, life: 2.2 });
      break;
    case "spread": {
      const n = mv.n ?? 3;
      for (let i = 0; i < n; i++) spawnProj(S, f, mv, dx, dy, { off: (i - (n - 1) / 2) * 0.17, dmg: baseDamage(f, mv) });
      break;
    }
    case "beam":
      f.channel = { slot, t: 0.55, tick: 0, dx, dy };
      break;
    case "dash": {
      const range = mv.range ?? 200;
      // some rushes are longer than the usual flick: "Vanish and strike" must be seen to vanish, a dive to dive
      const total = VANISH_DASH.has(mv.id) ? 0.5 : DIVE_DASH[mv.id] ? 0.32 : mv.id === "drillrun" ? 0.3 : 0.2;
      f.dash = { t: 0, total, dx, dy, dist: range, mv, hit: new Set() };
      f.invuln = Math.max(f.invuln, VANISH_DASH.has(mv.id) ? total + 0.05 : 0.14);
      break;
    }
    case "burrow": {
      f.dash = { t: 0, total: 0.62, dx, dy, dist: mv.range ?? 260, mv, hit: new Set(), under: true };
      f.invuln = Math.max(f.invuln, 0.66);
      S.events.push({ t: "dig", x: f.x, y: f.y, id: f.id, phase: "down", type: mv.type });
      break;
    }
    case "nova": {
      const r = mv.range ?? 130;
      boom(S, f.x, f.y, r, mv.type, mv.fx ?? mv.id, false, mv.id);
      for (const o of foesOf(S, f)) {
        const d = len(o.x - f.x, o.y - f.y);
        if (d <= r + o.r) strike(S, f, o, baseDamage(f, mv), mv.type, { kx: o.x - f.x, ky: o.y - f.y, kb: 240, status: mv.status, mv: mv.id });
      }
      break;
    }
    case "lob": {
      const range = mv.range ?? 320;
      const d = len(tx - f.x, ty - f.y);
      const k = d > range ? range / d : 1;
      const x = clamp(f.x + (tx - f.x) * k, MARGIN, W - MARGIN);
      const y = clamp(f.y + (ty - f.y) * k, MARGIN, H - MARGIN);
      S.zones.push({ id: S.nextId++, owner: f.id, team: f.team, shape: "circle", x, y, x2: x, y2: y, r: mv.id === "maxstrike" || mv.id === "gmaxblast" ? 108 : mv.linger ? 84 : 62, delay: (mv.windup ?? 0.55) * (f.isPlayer ? 0.6 : 1), total: (mv.windup ?? 0.55) * (f.isPlayer ? 0.6 : 1), life: mv.linger ?? 0.35, dmg: baseDamage(f, mv) * (mv.linger ? 0.5 : 1), type: mv.type, status: mv.status, kb: mv.linger ? 120 : 260, struck: false, mv, player: f.isPlayer, tick: 0.5 });
      break;
    }
    case "bolt": {
      const range = mv.range ?? 480;
      S.zones.push({ id: S.nextId++, owner: f.id, team: f.team, shape: "line", x: f.x, y: f.y, x2: f.x + dx * range, y2: f.y + dy * range, r: 20, delay: (mv.windup ?? 0.5) * (f.isPlayer ? 0.35 : 1), total: (mv.windup ?? 0.5) * (f.isPlayer ? 0.35 : 1), life: 0.55, dmg: baseDamage(f, mv), type: mv.type, status: mv.status, kb: 200, struck: false, mv, player: f.isPlayer });
      break;
    }
    case "guard":
      f.shield = 1.15;
      S.events.push({ t: "shield", x: f.x, y: f.y });
      if (mv.boost) applyBoost(S, f, mv);
      break;
    case "heal":
      f.heal = { t: 1.2, per: (f.maxHp * mv.power) / 1.2 };
      break;
    case "grab": {
      const reach = mv.range ?? 380;
      let tgt: Fighter | null = null;
      let best = -Infinity;
      for (const o of foesOf(S, f)) {
        if (!o.alive || o.invuln > 0 || o.boss || o.grabT > 0 || o.flyT > 0 || o.slamT > 0) continue;
        const d = len(o.x - f.x, o.y - f.y);
        if (d > reach) continue;
        const dot = ((o.x - f.x) * dx + (o.y - f.y) * dy) / Math.max(1, d);
        if (dot < 0.25) continue;
        const sc = dot * 220 - d;
        if (sc > best) {
          best = sc;
          tgt = o;
        }
      }
      if (!tgt) {
        // nothing in front: only a pulse of mind power
        boom(S, f.x + dx * 60, f.y + dy * 60, 56, mv.type, mv.fx);
        break;
      }
      if (mv.slam) {
        startSlam(S, f, tgt, mv);
        break;
      }
      tgt.grabT = 1.0;
      tgt.grabBy = f.id;
      tgt.grabDmg = baseDamage(f, mv);
      tgt.stun = Math.max(tgt.stun, 1.1);
      tgt.cast = null;
      tgt.channel = null;
      tgt.dash = null;
      S.events.push({ t: "grab", id: tgt.id, by: f.id, x: tgt.x, y: tgt.y });
      boom(S, tgt.x, tgt.y, 60, mv.type, mv.fx);
      break;
    }
    case "buff":
      if (mv.boost) applyBoost(S, f, mv);
      else {
        f.buffT = 6;
        f.buffMul = mv.power;
      }
      S.events.push({ t: "buff", x: f.x, y: f.y, id: f.id, fx: mv.fx });
      break;
    case "hazard": {
      const range = mv.range ?? 300;
      const d = len(tx - f.x, ty - f.y);
      const k = d > range ? range / d : 1;
      const x = clamp(f.x + (tx - f.x) * k, MARGIN, W - MARGIN);
      const y = clamp(f.y + (ty - f.y) * k, MARGIN, H - MARGIN);
      const kind = mv.hazard ?? "spikes";
      // at most four patches per Pokémon: the oldest one goes
      const mine = S.hazards.filter((h) => h.owner === f.id);
      if (mine.length >= 4) S.hazards.splice(S.hazards.indexOf(mine[0]!), 1);
      const r = kind === "rocks" ? 86 : kind === "toxic" ? 78 : 72;
      S.hazards.push({ id: S.nextId++, owner: f.id, team: f.team, kind, x, y, r, life: 22, max: 22, hit: {} });
      S.events.push({ t: "patch", x, y, kind, r, id: f.id });
      break;
    }
  }
}

/** Stat moves: multiply the stats (stacking up to a limit) and restart the timer. */
function applyBoost(S: State, f: Fighter, mv: MoveDef) {
  const up: string[] = [];
  const down: string[] = [];
  for (const k of ["atk", "spa", "def", "spd", "spe"] as const) {
    const v = mv.boost?.[k];
    if (!v) continue;
    const next = clamp(f.boost[k] * v, 0.6, 2.6);
    if (Math.abs(next - f.boost[k]) < 0.001) continue;
    f.boost[k] = next;
    (v >= 1 ? up : down).push(k);
  }
  f.boostT = Math.max(f.boostT, mv.dur ?? 14);
  S.events.push({ t: "stat", x: f.x, y: f.y, id: f.id, up, down });
}

/** Patches on the floor: foes that step on one are hurt (spikes, rocks) or poisoned (toxic spikes). */
function updateHazards(S: State, dt: number) {
  if (!S.hazards.length) return;
  for (const h of S.hazards) h.life -= dt;
  const keep: Hazard[] = [];
  for (const h of S.hazards) {
    if (h.life <= 0) continue;
    const owner = S.fighters.find((x) => x.id === h.owner);
    if (!owner) continue;
    let used = false;
    for (const f of S.fighters) {
      if (!f.alive || f.team === h.team || f.invuln > 0 || f.dash?.under || f.boss) continue;
      if (len(f.x - h.x, f.y - h.y) > h.r + f.r * 0.3) continue;
      const grounded = !f.canFly && !movDef(f)?.cross && f.loco !== "float" && f.air < 8 && f.flyT <= 0;
      const ready = S.time >= (h.hit[f.id] ?? 0);
      if (!ready) continue;
      if (h.kind === "spikes" && grounded) {
        const mv = MOVES.spikes!;
        h.hit[f.id] = S.time + 0.9;
        strike(S, owner, f, baseDamage(owner, mv), "Ground", { kx: f.x - h.x, ky: f.y - h.y, kb: 40, mv: "spikes" });
      } else if (h.kind === "rocks") {
        const mv = MOVES.stealthrock!;
        h.hit[f.id] = S.time + 1.2;
        strike(S, owner, f, baseDamage(owner, mv), "Rock", { kx: f.x - h.x, ky: f.y - h.y, kb: 40, mv: "stealthrock" });
      } else if (h.kind === "toxic" && grounded) {
        if (f.types.includes("Poison")) {
          used = true; // a Poison type soaks them up
          S.events.push({ t: "patch", x: h.x, y: h.y, kind: "clear", r: h.r, id: f.id });
          break;
        }
        if (f.types.includes("Steel")) continue;
        h.hit[f.id] = S.time + 2.2;
        applyStatus(S, f, "psn");
      }
    }
    if (!used) keep.push(h);
  }
  S.hazards = keep;
}

/** Seismic Toss: the foe is carried up, held, then driven into the ground. */
function startSlam(S: State, f: Fighter, tgt: Fighter, mv: MoveDef) {
  tgt.slamT = 1.25;
  tgt.slamBy = f.id;
  tgt.slamDmg = baseDamage(f, mv);
  tgt.stun = Math.max(tgt.stun, 1.35);
  tgt.cast = null;
  tgt.channel = null;
  tgt.dash = null;
  tgt.dodge.t = 0;
  f.stun = Math.max(f.stun, 1.3);
  f.mvx = 0;
  f.mvy = 0;
  S.events.push({ t: "slam", id: tgt.id, by: f.id, x: tgt.x, y: tgt.y, phase: "lift" });
}

function updateSlams(S: State, dt: number) {
  for (const o of S.fighters) {
    if (o.slamT <= 0) continue;
    const by = S.fighters.find((x) => x.id === o.slamBy);
    if (!o.alive || !by || !by.alive) {
      o.slamT = 0;
      o.air = 0;
      if (by) by.air = 0;
      continue;
    }
    const prev = o.slamT;
    o.slamT -= dt;
    const t = 1.25 - Math.max(0, o.slamT);
    const k = Math.min(1, dt * 14);
    o.x += (clamp(by.x + Math.cos(by.face) * 40, MARGIN, W - MARGIN) - o.x) * k;
    o.y += (clamp(by.y + Math.sin(by.face) * 22, MARGIN, H - MARGIN) - o.y) * k;
    o.kx = o.ky = o.mvx = o.mvy = 0;
    by.mvx = by.mvy = 0;
    o.stun = Math.max(o.stun, 0.25);
    by.stun = Math.max(by.stun, 0.25);
    // up (0 - 0.55s), hold at the top, then down fast (0.78 - 0.92s)
    const PEAK = 150;
    let h: number;
    if (t < 0.55) h = PEAK * (1 - (1 - t / 0.55) ** 3);
    else if (t < 0.78) h = PEAK;
    else if (t < 0.92) h = PEAK * (1 - ((t - 0.78) / 0.14) ** 2.2);
    else h = 0;
    o.air = Math.max(0, h);
    by.air = Math.max(0, h * 0.82);
    if (prev > 0.33 && o.slamT <= 0.33) {
      // the impact
      o.air = 0;
      strike(S, by, o, o.slamDmg, "Fighting", { kx: 0, ky: 0, kb: 0, mv: "seismictoss" });
      boom(S, o.x, o.y, 95, "Fighting", "seismictoss");
      for (const q of foesOf(S, by)) if (q !== o && len(q.x - o.x, q.y - o.y) <= 100 + q.r) strike(S, by, q, o.slamDmg * 0.4, "Fighting", { kx: q.x - o.x, ky: q.y - o.y, kb: 260, mv: "seismictoss" });
      S.events.push({ t: "slam", id: o.id, by: by.id, x: o.x, y: o.y, phase: "hit" });
      o.stun = Math.max(o.stun, 0.55);
    }
    if (o.slamT <= 0) {
      o.slamT = 0;
      o.air = 0;
      by.air = 0;
    }
  }
}

/** Held foes hover in front of their holder; thrown foes fly, hit others on the way and slam down. */
function updateGrabs(S: State, dt: number) {
  for (const o of S.fighters) {
    if (!o.alive) {
      o.grabT = 0;
      o.flyT = 0;
      continue;
    }
    if (o.grabT > 0) {
      const by = S.fighters.find((x) => x.id === o.grabBy);
      if (!by || !by.alive) {
        o.grabT = 0;
        continue;
      }
      o.grabT -= dt;
      const ax = Math.cos(by.face);
      const ay = Math.sin(by.face);
      const k = Math.min(1, dt * 9);
      o.x += (clamp(by.x + ax * 78, MARGIN, W - MARGIN) - o.x) * k;
      o.y += (clamp(by.y + ay * 78, MARGIN, H - MARGIN) - o.y) * k;
      o.kx = 0;
      o.ky = 0;
      o.mvx = 0;
      o.mvy = 0;
      o.stun = Math.max(o.stun, 0.25);
      if (o.grabT <= 0) {
        o.flyT = 0.42;
        o.flyDx = ax;
        o.flyDy = ay;
        o.flyBy = by.id;
        o.flyDmg = o.grabDmg;
        o.flyHit = [];
        o.stun = Math.max(o.stun, 0.6);
        S.events.push({ t: "throw", id: o.id, dx: ax, dy: ay, x: o.x, y: o.y });
      }
    } else if (o.flyT > 0) {
      const src = S.fighters.find((x) => x.id === o.flyBy);
      o.flyT -= dt;
      o.kx = 0;
      o.ky = 0;
      o.mvx = 0;
      o.mvy = 0;
      o.stun = Math.max(o.stun, 0.25);
      const nx = o.x + o.flyDx * 980 * dt;
      const ny = o.y + o.flyDy * 980 * dt;
      const cx = clamp(nx, MARGIN, W - MARGIN);
      const cy = clamp(ny, MARGIN, H - MARGIN);
      const wall = cx !== nx || cy !== ny;
      o.x = cx;
      o.y = cy;
      if (src && src.alive) {
        for (const q of S.fighters) {
          if (q === o || !q.alive || q.team === src.team || o.flyHit.includes(q.id) || len(q.x - o.x, q.y - o.y) > q.r + o.r) continue;
          o.flyHit.push(q.id);
          strike(S, src, q, o.flyDmg * 0.55, "Psychic", { kx: o.flyDx, ky: o.flyDy, kb: 260 });
        }
      }
      if (o.flyT <= 0 || wall) {
        o.flyT = 0;
        boom(S, o.x, o.y, 78, "Psychic", "slam");
        if (src) strike(S, src, o, o.flyDmg, "Psychic", { kx: o.flyDx, ky: o.flyDy, kb: 120 });
        o.stun = Math.max(o.stun, 0.5);
      }
    }
  }
}

/** Start using a move. Returns false if it is not possible right now. */
export function tryCast(S: State, f: Fighter, slot: number, input: Input | null = null): boolean {
  if (!f.alive || f.stun > 0 || f.status.frz > 0 || f.status.slp > 0) return false;
  if (f.cd[slot]! > 0 || f.cast || f.channel || f.dash || hiddenMov(f)) return false;
  // paralysed: sometimes the body will not obey; confused: sometimes they hit themselves instead
  if (f.status.par > 0 && Math.random() < 0.25) {
    f.cd[slot] = 0.5;
    S.events.push({ t: "ailment", x: f.x, y: f.y, kind: "par" });
    return false;
  }
  if (f.status.cnf > 0 && Math.random() < 0.35) {
    f.cd[slot] = 0.7;
    f.hp = Math.max(1, f.hp - f.maxHp * 0.05);
    f.flash = 0.2;
    S.events.push({ t: "ailment", x: f.x, y: f.y, kind: "cnf" });
    return false;
  }
  const mv = moveOf(f, slot);
  const a = aimOf(S, f, input);
  if (f.status.cnf > 0) {
    // confused aim: the shot flies off to one side
    const sw = Math.sin(S.time * 6 + f.id) * 0.8;
    const c = Math.cos(sw), sn = Math.sin(sw);
    const nx = a.dx * c - a.dy * sn, ny = a.dx * sn + a.dy * c;
    const dd = len(a.tx - f.x, a.ty - f.y);
    a.dx = nx; a.dy = ny; a.tx = f.x + nx * dd; a.ty = f.y + ny * dd;
  }
  f.cd[slot] = mv.cd * f.cdMul;
  if (f.isPlayer) {
    // chain different moves for a combo
    const c = f.combo;
    if (c.ready > 0) { /* a finisher is waiting: no new chain until it is used or runs out */ }
    else {
    if (c.last !== slot) c.n = c.t > 0 ? c.n + 1 : 1;
    c.last = slot;
    c.t = 2.2;
    c.best = Math.max(c.best, c.n);
    if (c.n >= 4) {
      // four different moves in a row: the finisher is now READY and waits for the player to fire it
      c.n = 0;
      c.last = -1;
      c.ready = 7;
      S.events.push({ t: "combo", n: 4, finish: false });
    } else S.events.push({ t: "combo", n: c.n, finish: false });
    }
  }
  // lobs and bolts warn with their own circle/line on the ground, so they fire at once
  const own = mv.kind === "lob" || mv.kind === "bolt";
  const wind = own ? 0 : f.isPlayer ? (mv.windup ?? 0) * 0.45 : mv.windup ?? (mv.kind === "proj" || mv.kind === "homing" || mv.kind === "spread" ? 0.32 : (mv.kind === "dash" || mv.kind === "burrow") ? 0.4 : mv.kind === "beam" ? 0.4 : 0);
  if (wind > 0.04) {
    f.cast = { slot, t: wind, total: wind, dx: a.dx, dy: a.dy, tx: a.tx, ty: a.ty };
    f.face = Math.atan2(a.dy, a.dx);
  } else fire(S, f, slot, a.dx, a.dy, a.tx, a.ty);
  return true;
}

/* ------------------------------------------------------- special movement */

/** Rushes that vanish for the strike ("Vanish and strike") and those that fly: the height of the dive. */
export const VANISH_DASH = new Set(["phantomforce", "shadowforce"]);
export const DIVE_DASH: Record<string, number> = { bravebird: 40, skyattack: 46, dragonascent: 60 };

const movDef = (f: Fighter): Mobility | null => (f.mov ? MOBILITY[f.mov.id] ?? null : null);
/** Underground or out of this world: cannot be hit, cannot cast, walks through everything. */
const hiddenMov = (f: Fighter) => !!f.mov && (f.mov.id === "Ground" || f.mov.id === "Ghost") && (MOBILITY[f.mov.id]?.kind === "dig" || MOBILITY[f.mov.id]?.kind === "vanish");

/** Start the special movement of this fighter's type. `aim` is where it is pointing, `dir` the way the sticks say (or null). */
export function startMov(S: State, f: Fighter, aim: { dx: number; dy: number; tx: number; ty: number }, dir: [number, number] | null): boolean {
  const m = mobilityOf(f.types, f.movIdx);
  if (!f.alive || f.mov || f.movCd > 0 || f.dash || f.dodge.t > 0 || f.status.frz > 0 || f.status.slp > 0 || f.stun > 0 || f.zLock || f.grabT > 0 || f.slamT > 0 || f.flyT > 0 || f.levT > 0) return false;
  let [dx, dy] = dir && len(dir[0], dir[1]) > 0.2 ? norm(dir[0], dir[1]) : norm(aim.dx, aim.dy);
  let tx = f.x, ty = f.y;
  const range = m.range ?? 300;
  if (m.kind === "blink" || m.kind === "vanish") {
    const d = len(aim.tx - f.x, aim.ty - f.y);
    const k = d > range ? range / d : 1;
    tx = f.x + (aim.tx - f.x) * k;
    ty = f.y + (aim.ty - f.y) * k;
    if (d < 40) { tx = f.x + dx * range * 0.7; ty = f.y + dy * range * 0.7; }
    [dx, dy] = norm(tx - f.x, ty - f.y);
  } else if (m.kind === "stalk") {
    const foe = nearestFoe(S, f);
    if (foe && len(foe.x - f.x, foe.y - f.y) <= range + 120) {
      const [ux, uy] = norm(foe.x - f.x, foe.y - f.y);
      tx = foe.x + ux * (foe.r + f.r + 16);
      ty = foe.y + uy * (foe.r + f.r + 16);
      dx = -ux; dy = -uy; // turn round to face it
    } else {
      tx = f.x + dx * range * 0.55;
      ty = f.y + dy * range * 0.55;
    }
  } else if (m.kind === "leap" || m.kind === "dig") {
    tx = f.x + dx * range;
    ty = f.y + dy * range;
  }
  tx = clamp(tx, MARGIN, W - MARGIN);
  ty = clamp(ty, MARGIN, H - MARGIN);
  f.mov = { id: m.type, t: 0, total: m.dur, dx, dy, ox: f.x, oy: f.y, tx, ty, hit: [], tick: 0, seed: Math.random() };
  f.movCd = m.cd * (f.boss ? 1.5 : 1);
  f.cast = null;
  f.channel = null;
  if (m.shield) f.shield = Math.max(f.shield, m.shield);
  if (m.kind === "blink" || m.kind === "stalk") {
    f.invuln = Math.max(f.invuln, 0.3);
    f.x = tx;
    f.y = ty;
    f.mvx = f.mvy = 0;
    f.face = Math.atan2(dy, dx);
  }
  if (m.kind === "vanish" || m.kind === "dig") f.invuln = Math.max(f.invuln, m.dur + 0.05);
  if (m.kind === "leap") f.invuln = Math.max(f.invuln, 0.15);
  if (m.kind === "fly") {
    // a rush of wind on take-off shoves the neighbours away
    if (m.dmg !== undefined && m.type !== "Fairy") for (const o of foesOf(S, f)) {
      const d = len(o.x - f.x, o.y - f.y);
      if (d < 130 + o.r) { const [nx, ny] = norm(o.x - f.x, o.y - f.y); o.kx += nx * (m.kb ?? 300); o.ky += ny * (m.kb ?? 300); }
    }
  }
  S.events.push({ t: "mov", id: f.id, type: m.type, phase: "start", x: f.mov.ox, y: f.mov.oy, x2: tx, y2: ty });
  return true;
}

/** Everything a special movement does each step: contact damage, trails, healing, and the landing. */
function stepMov(S: State, f: Fighter, dt: number) {
  const mv = f.mov;
  if (!mv) return;
  const m = MOBILITY[mv.id];
  if (!m || !f.alive) { f.mov = null; return; }
  mv.t += dt;
  const k = Math.min(1, mv.t / mv.total);
  if (f.status.frz > 0 || f.status.slp > 0) { // frozen solid: it stops, whatever it was doing
    if (m.kind === "dig" || m.kind === "vanish") { /* still has to come out */ } else { f.mov = null; f.air = 0; return; }
  }
  const hit = (o: Fighter, mult: number, kb: number, st = m.status) => strike(S, f, o, 20 * mult * (f.power / 90) * f.dmgMul, m.type, { kx: o.x - f.x, ky: o.y - f.y, kb, status: st, mv: undefined });
  const dmg = m.dmg ?? 0;
  if (m.kind === "leap") {
    f.air = Math.sin(Math.PI * k) * 96;
    f.invuln = Math.max(f.invuln, k < 0.9 ? 0.06 : 0);
  } else if (m.kind === "fly") {
    f.air = Math.min(1, mv.t / 0.25) * Math.min(1, (mv.total - mv.t) / 0.25 + 0.001) * 46;
  }
  if (m.heal) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * m.heal * (dt / mv.total));
  if (m.kind === "run" || m.kind === "fly") {
    if (dmg > 0) for (const o of foesOf(S, f)) {
      if (mv.hit.includes(o.id) || len(o.x - f.x, o.y - f.y) > f.r + o.r + 10) continue;
      mv.hit.push(o.id);
      hit(o, dmg, m.kb ?? 200);
    }
    mv.tick -= dt;
    if (mv.tick <= 0) {
      mv.tick = 0.11;
      if (m.freeze) freezeWater(S, f.x, f.y, 52);
      if (m.type === "Fire") meltIce(S, f.x, f.y, 40);
      if (m.puddles) {
        const mine = S.hazards.filter((h) => h.owner === f.id);
        if (mine.length < 7 && !S.hazards.some((h) => h.owner === f.id && len(h.x - f.x, h.y - f.y) < 40)) {
          S.hazards.push({ id: S.nextId++, owner: f.id, team: f.team, kind: "toxic", x: f.x, y: f.y, r: 42, life: 7, max: 7, hit: {} });
        }
      }
    }
  }
  if (k >= 1) endMov(S, f, m);
}

function endMov(S: State, f: Fighter, m: Mobility) {
  const mv = f.mov!;
  const type = m.type;
  if (m.kind === "leap") {
    f.air = 0;
    boom(S, f.x, f.y, 78, type, "quake", false);
    for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= 80 + o.r) strike(S, f, o, 20 * (m.dmg ?? 0.5) * (f.power / 90) * f.dmgMul, type, { kx: o.x - f.x, ky: o.y - f.y, kb: m.kb ?? 260 });
  } else if (m.kind === "dig") {
    S.events.push({ t: "dig", x: f.x, y: f.y, id: f.id, phase: "up", type });
    boom(S, f.x, f.y, 95, type, "earthquake", false);
    for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= 95 + o.r) strike(S, f, o, 20 * (m.dmg ?? 1) * (f.power / 90) * f.dmgMul, type, { kx: o.x - f.x, ky: o.y - f.y, kb: m.kb ?? 460 });
  } else if (m.kind === "vanish") {
    f.x = mv.tx;
    f.y = mv.ty;
    f.mvx = f.mvy = 0;
    f.face = Math.atan2(mv.dy, mv.dx);
    f.invuln = Math.max(f.invuln, 0.2);
    for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= 140 + o.r && Math.random() < (m.status?.chance ?? 0)) applyStatus(S, o, "cnf");
  } else if (m.kind === "fly") f.air = 0;
  if (m.focus) f.focus = Math.max(f.focus, m.focus);
  S.events.push({ t: "mov", id: f.id, type, phase: "end", x: f.x, y: f.y, x2: mv.ox, y2: mv.oy });
  f.mov = null;
}

function startDodge(S: State, f: Fighter, dx: number, dy: number) {
  if (!f.alive || f.dodge.cd > 0 || f.dodge.t > 0 || f.status.frz > 0 || f.status.slp > 0 || f.stun > 0) return false;
  const [nx, ny] = norm(dx, dy);
  f.dodge = { t: 0.3, cd: 1.15 * f.dodgeMul, dx: nx, dy: ny, perfected: false };
  f.invuln = Math.max(f.invuln, 0.27);
  f.cast = null;
  S.events.push({ t: "dodge", x: f.x, y: f.y });
  return true;
}

/** The special burst: a shockwave, then a few seconds of more damage, speed and recharge. */
function doAwaken(S: State, f: Fighter) {
  f.awaken = 8;
  f.invuln = Math.max(f.invuln, 0.5);
  const type = f.types[0] ?? "Normal";
  const r = 230;
  S.events.push({ t: "awaken", x: f.x, y: f.y, id: f.id });
  boom(S, f.x, f.y, r, type, undefined, true);
  S.freeze = Math.max(S.freeze, 0.1);
  for (const o of foesOf(S, f)) {
    if (len(o.x - f.x, o.y - f.y) <= r + o.r) strike(S, f, o, 30 * (f.power / 90) * f.dmgMul, type, { kx: o.x - f.x, ky: o.y - f.y, kb: 420 });
  }
}

/** Mega Evolution: a new form for a while, with its own stats and sometimes new types. */
function doMega(S: State, f: Fighter) {
  const form = f.megaForm;
  if (!form) return doAwaken(S, f);
  f.mega = 15;
  f.form = form;
  f.types = form.types ? [...form.types] : [...f.sp.types];
  f.megaP = form.p ?? 1.28;
  f.megaD = form.d ?? 1.2;
  f.megaS = form.s ?? 1.1;
  f.r = f.baseR * 1.12;
  f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.25);
  f.invuln = Math.max(f.invuln, 0.5);
  const type = f.types[0] ?? "Normal";
  // the Mega form's own special move: a huge burst of its type all around it
  if (form.origin) {
    const o = ALT_BURST[form.id] ?? [`${form.name} Burst`, type];
    f.override[3] = { id: "megaburst", name: o[0]!, type: o[1]!, kind: "nova", power: 3.1, cd: 4.2, range: 240, desc: "The alternate forme unleashes its full power all around you." };
  } else f.override[3] = { id: "megaburst", name: `Mega ${type} Burst`, type, kind: "nova", power: 2.7, cd: 4.2, range: 215, desc: "An explosion of Mega energy all around you." };
  f.cd[3] = 0;
  S.events.push({ t: "mega", x: f.x, y: f.y, id: f.id, name: form.name, z: !!form.z, type, origin: !!form.origin });
  boom(S, f.x, f.y, 190, type, undefined, true);
  S.freeze = Math.max(S.freeze, f.isPlayer ? 0.95 : 0.35);
  for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= 190 + o.r) strike(S, f, o, 22 * (f.power / 90) * f.dmgMul, type, { kx: o.x - f.x, ky: o.y - f.y, kb: 380 });
}
function endMega(S: State, f: Fighter) {
  f.mega = 0;
  f.form = null;
  delete f.override[3];
  f.types = [...f.sp.types];
  f.megaP = f.megaD = f.megaS = 1;
  f.r = f.baseR;
  S.events.push({ t: "gimmickEnd", x: f.x, y: f.y, kind: "mega" });
}

/** Z-Move: the world freezes for a cinematic, then a finisher of your type hits everyone, whatever they are doing. */
function doZ(S: State, f: Fighter) {
  const sig = Z_SIGNATURE[f.sp.id];
  const type = sig?.type ?? f.types[0] ?? "Normal";
  const name = sig?.name ?? Z_MOVES[type]?.name ?? "Z-Move";
  f.zLock = true;
  f.invuln = Math.max(f.invuln, 1.6);
  f.cast = f.channel = f.dash = null;
  S.zPending = { fid: f.id, type, name };
  S.freeze = Math.max(S.freeze, 1.2);
  S.events.push({ t: "zstart", x: f.x, y: f.y, type, name });
}
function resolveZ(S: State) {
  const z = S.zPending;
  S.zPending = null;
  if (!z) return;
  const f = S.fighters.find((x) => x.id === z.fid);
  if (!f) return;
  f.zLock = false;
  f.invuln = Math.max(f.invuln, 0.6);
  if (!f.alive) return;
  boom(S, f.x, f.y, 200, z.type);
  for (const o of foesOf(S, f)) {
    o.invuln = 0;
    o.shield = 0;
    S.events.push({ t: "zhit", x: o.x, y: o.y, type: z.type });
    strike(S, f, o, 13 * 8.5 * (f.power / 90) * f.dmgMul * (f.mega > 0 ? f.megaP : 1), z.type, { kx: o.x - f.x, ky: o.y - f.y, kb: 560 });
  }
  S.freeze = Math.max(S.freeze, 0.18);
}

/** Dynamax and Gigantamax: huge for a while, with more HP and Max Moves. */
function doDynamax(S: State, f: Fighter) {
  f.dyna = 12;
  f.gmax = GMAX.has(f.sp.id);
  f.r = f.baseR * 1.55;
  f.maxHp = Math.round(f.maxHp * 1.5);
  f.hp = Math.round(f.hp * 1.5);
  f.ghost = f.hp;
  f.invuln = Math.max(f.invuln, 0.5);
  f.status.brn = f.status.psn = f.status.par = f.status.frz = f.status.cnf = f.status.slp = 0;
  const type = f.types[0] ?? "Normal";
  // its own special move: a giant strike that lands where you aim
  f.override[3] = f.gmax
    ? { id: "gmaxblast", name: `G-Max ${type}`, type, kind: "lob", power: 3.2, cd: 4.6, range: 400, windup: 0.5, desc: "A Gigantamax finisher that lands where you aim." }
    : { id: "maxstrike", name: `Max ${type}`, type, kind: "lob", power: 2.8, cd: 4.2, range: 380, windup: 0.5, desc: "A Max Move strike where you aim." };
  f.cd[3] = 0;
  S.events.push({ t: "dynamax", x: f.x, y: f.y, id: f.id, gmax: f.gmax });
  boom(S, f.x, f.y, 210, type, undefined, true);
  S.freeze = Math.max(S.freeze, f.isPlayer ? 0.95 : 0.35);
  for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= 210 + o.r) strike(S, f, o, 26 * (f.power / 90) * f.dmgMul, type, { kx: o.x - f.x, ky: o.y - f.y, kb: 520 });
}
function endDynamax(S: State, f: Fighter) {
  f.dyna = 0;
  delete f.override[3];
  f.r = f.baseR;
  f.maxHp = Math.max(1, Math.round(f.maxHp / 1.5));
  f.hp = Math.max(1, Math.min(f.maxHp, Math.round(f.hp / 1.5)));
  f.ghost = f.hp;
  S.events.push({ t: "gimmickEnd", x: f.x, y: f.y, kind: "dynamax" });
  if (f.gmax && f.alive) {
    // the Gigantamax finishing blast
    const type = f.types[0] ?? "Normal";
    boom(S, f.x, f.y, 230, type);
    for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= 230 + o.r) strike(S, f, o, 24 * (f.power / 90) * f.dmgMul, type, { kx: o.x - f.x, ky: o.y - f.y, kb: 480 });
  }
}

/** Terastallization: a crystal of any type, with a shield, a stronger same-type bonus and Tera Blast. */
function doTera(S: State, f: Fighter) {
  const type = f.teraType;
  f.tera = { type, t: 25 };
  f.types = [type];
  f.crystal = f.maxHp * 0.3;
  f.override[3] = { id: "terablast", name: "Tera Blast", type, kind: "proj", power: 2.1, cd: 3.4, speed: 560, pierce: true, desc: "A piercing blast of your Tera type." };
  f.cd[3] = 0;
  f.invuln = Math.max(f.invuln, 0.5);
  S.events.push({ t: "tera", x: f.x, y: f.y, id: f.id, type });
  boom(S, f.x, f.y, 170, type, undefined, true);
  S.freeze = Math.max(S.freeze, f.isPlayer ? 0.85 : 0.35);
  for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= 170 + o.r) strike(S, f, o, 20 * (f.power / 90) * f.dmgMul, type, { kx: o.x - f.x, ky: o.y - f.y, kb: 360 });
}
function endTera(S: State, f: Fighter) {
  f.tera = null;
  f.types = f.form?.types ? [...f.form.types] : [...f.sp.types];
  f.crystal = 0;
  delete f.override[3];
  S.events.push({ t: "gimmickEnd", x: f.x, y: f.y, kind: "tera" });
}

/** Use the gimmick once the gauge is full. */
export function activateGimmick(S: State, f: Fighter) {
  if (!f.alive || f.ult < 100 || gimmickActive(f)) return false;
  f.ult = 0;
  switch (f.gimmick) {
    case "mega": doMega(S, f); break;
    case "zmove": doZ(S, f); break;
    case "dynamax": doDynamax(S, f); break;
    case "tera": doTera(S, f); break;
    default: doAwaken(S, f);
  }
  return true;
}
/** Kept for older callers. */
export const awaken = activateGimmick;

/* ---------------------------------------------------------------- computer players */

const useRange = (mv: MoveDef): [number, number] => {
  switch (mv.kind) {
    case "proj": case "spread": case "homing": return [80, 460];
    case "beam": return [0, (mv.range ?? 260) * 0.9];
    case "dash": case "burrow": return [70, (mv.range ?? 200) + 40];
    case "nova": return [0, (mv.range ?? 130) * 0.85];
    case "lob": return [90, mv.range ?? 320];
    case "bolt": return [100, (mv.range ?? 480) * 0.9];
    case "grab": return [60, (mv.range ?? 380) * 0.85];
    case "hazard": return [60, mv.range ?? 300];
    default: return [0, 9999];
  }
};

/** The practice dummy that does not fight back: it stands still or wanders slowly, and never casts. */
function dummyStep(S: State, f: Fighter, dt: number) {
  f.gcd = 1;
  if (f.cast || f.channel) return;
  if (f.dummy === "walk") {
    f.think -= dt;
    if (f.think <= 0) {
      f.think = rnd(1.2, 2.6);
      const a = rnd(0, Math.PI * 2);
      f.strafe = Math.cos(a);
      f.face = a;
    }
    let mx = Math.cos(f.face);
    let my = Math.sin(f.face);
    if (f.x < 520 || f.x > W - MARGIN - 60) mx = f.x < 520 ? 1 : -1;
    if (f.y < MARGIN + 60) my = 1;
    if (f.y > H - MARGIN - 60) my = -1;
    f.vx = mx * f.speed * 0.45;
    f.vy = my * f.speed * 0.45;
  } else {
    f.vx = 0;
    f.vy = 0;
  }
}

function aiStep(S: State, f: Fighter, dt: number) {
  const foe = nearestFoe(S, f);
  if (!foe) return;
  f.think -= dt;
  f.gcd -= dt;
  const dx = foe.x - f.x;
  const dy = foe.y - f.y;
  const d = len(dx, dy);
  const [ux, uy] = norm(dx, dy);
  const want = f.sp.role === "brawler" ? 90 : f.sp.role === "bomber" ? 300 : 250;
  let mx = 0;
  let my = 0;
  if (f.cast || f.channel) {
    // stand still while charging a move
  } else if (d > want + 50) {
    mx = ux;
    my = uy;
  } else if (d < want - 60 && f.sp.role !== "brawler") {
    mx = -ux;
    my = -uy;
  } else {
    // circle the target
    mx = -uy * f.strafe;
    my = ux * f.strafe;
    if (f.sp.role === "brawler") {
      mx += ux * 0.4;
      my += uy * 0.4;
    }
  }
  if (Math.random() < dt * 0.35) f.strafe *= -1;
  // stay out of the corners and off the walls
  mx += (CX - f.x) * 0.0014;
  my += (CY - f.y) * 0.0014;
  if (f.x < MARGIN + 90) mx += (MARGIN + 90 - f.x) / 60;
  if (f.x > W - MARGIN - 90) mx -= (f.x - (W - MARGIN - 90)) / 60;
  if (f.y < MARGIN + 80) my += (MARGIN + 80 - f.y) / 60;
  if (f.y > H - MARGIN - 80) my -= (f.y - (H - MARGIN - 80)) / 60;
  if (S.storm.on) {
    const out = len(f.x - CX, f.y - CY) - (S.storm.r - 60);
    if (out > 0) {
      const [sx, sy] = norm(CX - f.x, CY - f.y);
      mx += sx * 1.6;
      my += sy * 1.6;
    }
  }
  const [mnx, mny] = norm(mx, my);
  const walk = f.cast ? 0 : 1;
  f.vx = mnx * f.speed * (len(mx, my) > 0.01 ? 1 : 0) * walk * (f.boss ? 0.8 : 0.9);
  f.vy = mny * f.speed * (len(mx, my) > 0.01 ? 1 : 0) * walk * (f.boss ? 0.8 : 0.9);

  if (f.think > 0) return;
  f.think = rnd(0.12, 0.28) * (S.mode === "quick" ? { easy: 1.6, normal: 1, hard: 0.7 }[S.level ?? "normal"] : 1);

  // dodge incoming shots (the later the wave, the more often)
  const quick = S.mode === "quick";
  const skill = quick ? { easy: 0.1, normal: 0.35, hard: 0.7 }[S.level ?? "normal"] : clamp(0.25 + S.wave * 0.07, 0.25, 0.8);
  if (f.dodge.cd <= 0 && f.dodge.t <= 0 && (S.wave >= 3 || S.mode === "royale" || quick)) {
    for (const p of S.projs) {
      if (p.team === f.team) continue;
      const px = f.x - p.x;
      const py = f.y - p.y;
      const closing = (px * p.vx + py * p.vy) / (len(p.vx, p.vy) || 1);
      const side = Math.abs(px * p.vy - py * p.vx) / (len(p.vx, p.vy) || 1);
      if (closing > 0 && closing < 170 && side < f.r + p.r + 10 && Math.random() < skill) {
        startDodge(S, f, -p.vy * (Math.random() < 0.5 ? 1 : -1), p.vx * (Math.random() < 0.5 ? 1 : -1));
        return;
      }
    }
  }
  // special movement: close the gap on a far foe, or get away when hurt
  if (!f.boss && !f.mov && f.movCd <= 0 && !f.cast && !f.channel && !f.dash && f.dummy !== "idle") {
    if (f.types.length > 1) f.movIdx = Math.random() < 0.5 ? 0 : 1;
    const m = mobilityOf(f.types, f.movIdx);
    const hurt = f.hp < f.maxHp * 0.3;
    const lvl = S.mode === "quick" ? { easy: 0.05, normal: 0.12, hard: 0.22 }[S.level ?? "normal"] : 0.1;
    if (Math.random() < lvl) {
      const away = hurt && d < 260;
      const closing = !away && d > (m.kind === "stalk" ? 240 : 230) && d < (m.range ?? 480) + 260;
      if (away || closing) {
        const k = away ? -1 : 1;
        const aim = { dx: ux * k, dy: uy * k, tx: away ? f.x - ux * 400 : foe.x, ty: away ? f.y - uy * 400 : foe.y };
        if (startMov(S, f, aim, null)) return;
      }
    }
  }
  if (f.cpuGimmick && f.ult >= 100 && !gimmickActive(f) && Math.random() < 0.5) {
    activateGimmick(S, f);
    return;
  }
  if (f.cast || f.channel || f.dash || f.gcd > 0) return;

  // the boss's ring of shots
  if (f.boss) {
    f.ringT -= 0.2;
    if (f.ringT <= 0 && f.hp < f.maxHp * 0.99) {
      f.ringT = f.hp < f.maxHp * 0.5 ? 4.5 : 6.5;
      const mv = MOVES.shadowball!;
      const n = f.hp < f.maxHp * 0.5 ? 20 : 14;
      const off = Math.random() * 6;
      for (let i = 0; i < n; i++) spawnProj(S, f, mv, Math.cos(off + (i / n) * Math.PI * 2), Math.sin(off + (i / n) * Math.PI * 2), { speed: 230, life: 3.4, dmg: baseDamage(f, mv, 0.8) });
      boom(S, f.x, f.y, 80, "Psychic");
      f.gcd = 1.0;
      return;
    }
  }

  // pick a move that suits the distance
  const options: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (f.cd[i]! > 0) continue;
    const mv = moveOf(f, i);
    if (mv.kind === "heal") {
      if (f.hp < f.maxHp * 0.5) options.push(i, i);
      continue;
    }
    if (mv.kind === "guard") {
      if (f.hp < f.maxHp * 0.45 && d < 260) options.push(i);
      continue;
    }
    if (mv.kind === "buff") {
      if (d < 360 && f.boostT < 5) options.push(i);
      continue;
    }
    const [lo, hi] = useRange(mv);
    if (d >= lo && d <= hi) options.push(i);
  }
  if (options.length) {
    const slot = options[Math.floor(Math.random() * options.length)]!;
    if (tryCast(S, f, slot, null)) f.gcd = (f.boss ? rnd(0.5, 1.0) : rnd(0.9, 1.7)) * (S.mode === "royale" ? 0.9 : 1) * (S.mode === "quick" ? { easy: 1.5, normal: 1, hard: 0.75 }[S.level ?? "normal"] : 1);
  }
}

/* ------------------------------------------------------------------- step */

/** How quickly each kind of mover gets up to speed and slows down (flyers and floaters drift). */
const ACCEL: Record<string, number> = { fly: 9, float: 6.5, surf: 9, slither: 9.5, run: 16, walk: 20 };

function moveFighter(S: State, f: Fighter, dt: number) {
  const mob = movDef(f);
  const under = !!f.dash?.under || (!!mob && (mob.kind === "dig" || mob.kind === "vanish" || (mob.kind === "leap" && f.air > 20)));
  const flies = f.canFly || !!mob?.cross;
  f.inWater = wetAt(S, f.x, f.y);
  // glacier floors and sheets of ice on the water are slippery for everyone who walks on them
  const slick = !flies && !mob?.sure && f.loco !== "fly" && f.loco !== "float" && (S.stage === "glacier" || iced(S, f.x, f.y));
  let sx = 0;
  let sy = 0;
  if (mob && f.mov && (mob.kind === "leap" || mob.kind === "dig")) {
    // a jump or a burrow carries straight on to where it was aimed
    const sp = (mob.range ?? 300) / mob.dur;
    sx = f.mov.dx * sp;
    sy = f.mov.dy * sp;
    f.mvx = sx * 0.5;
    f.mvy = sy * 0.5;
  } else if (mob && f.mov && (mob.kind === "vanish" || mob.kind === "blink" || mob.kind === "stalk")) {
    // nothing moves while it fades; a blink has already happened
    f.mvx = f.mvy = 0;
  } else if (f.dodge.t > 0) {
    sx = f.dodge.dx * 560;
    sy = f.dodge.dy * 560;
    f.mvx = sx * 0.5;
    f.mvy = sy * 0.5;
  } else if (f.dash) {
    const speed = f.dash.dist / f.dash.total;
    sx = f.dash.dx * speed;
    sy = f.dash.dy * speed;
    f.mvx = sx * 0.4;
    f.mvy = sy * 0.4;
  } else {
    let k = f.speedMul;
    if (f.status.cnf > 0) {
      // stumbling: the walking direction wanders
      const w = Math.sin(S.time * 4.2 + f.id * 1.7) * 1.5;
      const c = Math.cos(w), sn = Math.sin(w);
      const vx = f.vx * c - f.vy * sn, vy = f.vx * sn + f.vy * c;
      f.vx = vx; f.vy = vy;
    }
    if (f.awaken > 0) k *= 1.25;
    if (f.mega > 0) k *= f.megaS;
    k *= f.boost.spe;
    if (f.dyna > 0) k *= 0.92;
    if (f.haste > 0) k *= 1.3;
    if (f.status.par > 0) k *= 0.55;
    if (f.status.frz > 0 || f.status.slp > 0 || f.stun > 0) k = 0;
    if (f.channel) k *= 0.35;
    // water: swimmers are quick, flyers do not care, everyone else wades
    if (f.inWater) k *= f.swimmer ? 1.3 : flies || mob?.sure ? 1 : 0.62;
    if (mob && (mob.kind === "run" || mob.kind === "fly")) {
      k *= mob.speed ?? 1.5;
      // no stick held: it keeps going the way it was pointing
      if (len(f.vx, f.vy) < 5 && f.mov) { f.vx = f.mov.dx * f.speed; f.vy = f.mov.dy * f.speed; }
    }
    const a = 1 - Math.exp(-dt * (ACCEL[f.loco] ?? 15) * (slick ? 0.3 : 1));
    f.mvx += (f.vx * k - f.mvx) * a;
    f.mvy += (f.vy * k - f.mvy) * a;
    sx = f.mvx;
    sy = f.mvy;
  }
  // wind gusts shove everyone who is not flying (flyers only a little)
  if (S.gust && S.gust.warn <= 0 && S.gust.t > 0) {
    const w = f.canFly ? 55 : 150;
    sx += S.gust.dx * w;
    sy += S.gust.dy * w;
  }
  // knock-back decays quickly
  sx += f.kx;
  sy += f.ky;
  const decay = Math.pow(0.0008, dt);
  f.kx *= decay;
  f.ky *= decay;
  const ox = f.x;
  const oy = f.y;
  f.x += sx * dt;
  f.y += sy * dt;
  f.stride += len(f.x - ox, f.y - oy);
  if (S.storm.on) {
    const d = len(f.x - CX, f.y - CY);
    if (d > S.storm.r) {
      f.hp -= f.maxHp * 0.06 * dt;
      if (f.hp <= 0 && f.alive) kill(S, null, f);
    }
  }
  f.x = clamp(f.x, MARGIN, W - MARGIN);
  f.y = clamp(f.y, MARGIN, H - MARGIN);

  if (!under) {
    // things standing in the way: pillars stop everyone; crates, rocks and crystals stop whoever cannot fly over them
    for (const o of S.obs) {
      if (o.hp <= 0) continue;
      // tall things (trees, pines, palms, pillars, crystals, basalt) stop everyone, even fliers; low ones only stop what walks
      if (!(TALL_OBS.has(o.kind) || !flies)) continue;
      const min = f.r * 0.85 + o.r;
      const d = len(f.x - o.x, f.y - o.y);
      if (d >= min) continue;
      if (f.dash && o.kind === "crate") {
        breakCrate(S, o);
        continue;
      }
      if (len(f.mvx, f.mvy) > 60) o.hit = Math.max(o.hit, 0.18); // the thing shakes when something runs into it
      const [nx, ny] = norm(f.x - o.x, f.y - o.y);
      f.x = o.x + nx * min;
      f.y = o.y + ny * min;
      const dot = f.mvx * nx + f.mvy * ny;
      if (dot < 0) {
        f.mvx -= dot * nx;
        f.mvy -= dot * ny;
      }
      if (f.dash) {
        f.dash = null;
        f.kx *= 0.2;
        f.ky *= 0.2;
      }
    }
    // pits: whoever cannot fly or float is stopped at the edge, or falls in if thrown there
    if (!flies) {
      for (const h of S.holes) {
        if (!inPatch(h, f.x, f.y)) continue;
        const thrown = !!f.dash || len(f.kx, f.ky) > 220;
        const [nx, ny] = norm((f.x - h.x) / h.rx, (f.y - h.y) / h.ry);
        f.x = clamp(h.x + nx * (h.rx + 16), MARGIN, W - MARGIN);
        f.y = clamp(h.y + ny * (h.ry + 16), MARGIN, H - MARGIN);
        f.mvx = f.mvy = 0;
        if (thrown && f.alive) {
          f.dash = null;
          f.kx = f.ky = 0;
          f.stun = Math.max(f.stun, 0.5);
          f.hp -= f.maxHp * 0.1;
          S.events.push({ t: "fall", x: f.x, y: f.y, id: f.id, player: f.isPlayer });
          if (f.hp <= 0) kill(S, null, f);
        }
      }
    }
    f.x = clamp(f.x, MARGIN, W - MARGIN);
    f.y = clamp(f.y, MARGIN, H - MARGIN);
  }
  if (len(sx, sy) > 20 && !f.cast && !f.channel) f.face = Math.atan2(sy, sx);
}

/** The combo finisher, fired by the player once it is ready: a blast around the fighter that hits nearby foes and refreshes cooldowns. */
export function fireFinisher(S: State, f: Fighter): boolean {
  if (!f.alive || !f.isPlayer || f.combo.ready <= 0) return false;
  f.combo.ready = 0;
  f.combo.n = 0;
  f.combo.last = -1;
  f.combo.t = 0;
  for (let i = 0; i < 4; i++) f.cd[i] = Math.max(0, f.cd[i]! - 1.2);
  S.score += 150;
  S.events.push({ t: "combo", n: 4, finish: true });
  const r = 150;
  boom(S, f.x, f.y, r, f.types[0] ?? "Normal");
  for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= r + o.r) strike(S, f, o, 20 * (f.power / 90) * f.dmgMul, f.types[0] ?? "Normal", { kx: o.x - f.x, ky: o.y - f.y, kb: 300 });
  return true;
}

/** Client-side guess of where a fighter moves under its own player's input (used to hide network lag); touches nothing but `f`. */
export function predictMove(S: State, f: Fighter, dt: number) {
  moveFighter({ ...S, events: [] } as State, f, dt);
}

/**
 * Advance the fight. `input` steers the first fighter; in a multiplayer fight `others` holds the input of every other
 * human, by fighter id.
 */
export function step(S: State, input: Input, realDt: number, others?: Map<number, Input>) {
  const dt0 = Math.min(realDt, 0.05);
  // Nobody may freeze or slow down the others in a multiplayer fight
  if (S.mp) {
    S.freeze = 0;
    S.slow = 0;
  }
  if (S.freeze > 0) {
    S.freeze -= dt0;
    return;
  }
  if (S.zPending) resolveZ(S);
  const dt = dt0 * (S.slow > 0 ? 0.32 : 1);
  S.slow = Math.max(0, S.slow - dt0);
  S.time += dt;
  const p = playerOf(S);

  if (S.phase === "over" || S.phase === "perks") return;
  if (S.phase === "intro") {
    S.introT -= dt0;
    // everyone can still move a little, but nobody attacks
    if (S.introT <= 0) S.phase = "fight";
    for (const f of S.fighters) if (f.alive) f.flash = Math.max(0, f.flash - dt);
    return;
  }

  // pillars thrown up by blasts crumble when their time is up
  for (const o of S.obs) {
    if (o.until !== undefined && o.hp > 0 && S.time > o.until) {
      o.hp = 0;
      S.events.push({ t: "crate", x: o.x, y: o.y, kind: o.kind });
    }
  }

  // ---- the people (one in a normal run, 2-5 in a multiplayer royale)
  for (const h of S.fighters) {
    if (!h.isPlayer || !h.alive) continue;
    if (h.auto) {
      aiStep(S, h, dt);
      continue;
    }
    const inp = h === p ? input : others?.get(h.id) ?? noInput();
    if (inp.swap !== undefined && inp.swap >= 0 && S.mode === "quick" && S.squads) {
      // Quick Battle: a swap takes the turn (the new fighter is in the ring from the next step)
      if (swapTo(S, h.team, inp.swap)) continue;
    }
    const [mx, my] = len(inp.mx, inp.my) > 1 ? norm(inp.mx, inp.my) : [inp.mx, inp.my];
    h.vx = mx * h.speed;
    h.vy = my * h.speed;
    if (inp.dodge) startDodge(S, h, len(mx, my) > 0.1 ? mx : Math.cos(h.face), len(mx, my) > 0.1 ? my : Math.sin(h.face));
    if (inp.movSel !== undefined && !h.mov) h.movIdx = Math.max(0, Math.min(1, inp.movSel | 0));
    if (inp.mov) startMov(S, h, aimOf(S, h, inp), len(mx, my) > 0.2 ? [mx, my] : null);
    for (let i = 0; i < 4; i++) if (inp.cast[i]) tryCast(S, h, i, inp);
    if (inp.ult) activateGimmick(S, h);
    if (inp.fin) fireFinisher(S, h);
    // a held beam follows the aim
    if (h.channel) {
      const a = aimOf(S, h, inp);
      h.channel.dx = a.dx;
      h.channel.dy = a.dy;
      h.face = Math.atan2(a.dy, a.dx);
    }
    // face the aim
    if (!h.cast && !h.channel && len(mx, my) < 0.1) {
      const a = aimOf(S, h, inp);
      h.face = Math.atan2(a.dy, a.dx);
    }
  }

  // ---- everyone else
  for (const f of S.fighters) {
    if (!f.alive) {
      f.koT += dt;
      continue;
    }
    if (!f.isPlayer) {
      if (f.dummy && f.dummy !== "fight") dummyStep(S, f, dt);
      else aiStep(S, f, dt);
    }

    // timers
    const cdRate = (f.awaken > 0 ? 2 : 1) * (f.dyna > 0 ? 1.25 : 1);
    for (let i = 0; i < 4; i++) f.cd[i] = Math.max(0, f.cd[i]! - dt * cdRate);
    f.awaken = Math.max(0, f.awaken - dt);
    if (f.mega > 0) {
      f.mega -= dt;
      if (f.mega <= 0) endMega(S, f);
    }
    if (f.dyna > 0) {
      f.dyna -= dt;
      if (f.dyna <= 0) endDynamax(S, f);
    }
    if (f.tera) {
      f.tera.t -= dt;
      if (f.tera.t <= 0) endTera(S, f);
    }
    f.haste = Math.max(0, f.haste - dt);
    f.invuln = Math.max(0, f.invuln - dt);
    f.flash = Math.max(0, f.flash - dt);
    f.stun = Math.max(0, f.stun - dt);
    if (f.levT > 0) {
      f.levT -= dt;
      if (f.levT <= 0) {
        f.levT = 0;
        f.levCd = 1.4;
      }
    } else f.levCd = Math.max(0, f.levCd - dt);
    {
      const goal = f.levT > 0 ? 46 + Math.sin(S.time * 5 + f.id) * 4 : 0;
      f.lev += (goal - f.lev) * Math.min(1, dt * (goal > 0 ? 9 : 7));
      if (goal === 0 && f.lev < 0.3) f.lev = 0;
    }
    f.shield = Math.max(0, f.shield - dt);
    f.focus = Math.max(0, f.focus - dt);
    f.buffT = Math.max(0, f.buffT - dt);
    if (f.boostT > 0) {
      f.boostT -= dt;
      if (f.boostT <= 0) {
        f.boostT = 0;
        f.boost.atk = f.boost.spa = f.boost.def = f.boost.spd = f.boost.spe = 1;
      }
    }
    f.dodge.cd = Math.max(0, f.dodge.cd - dt);
    f.movCd = Math.max(0, f.movCd - dt);
    if (f.dodge.t > 0) f.dodge.t = Math.max(0, f.dodge.t - dt);
    f.status.frzImmune = Math.max(0, f.status.frzImmune - dt);
    if (f.isPlayer && f.combo.ready > 0) f.combo.ready = Math.max(0, f.combo.ready - dt);
    if (f.isPlayer && f.combo.t > 0) {
      f.combo.t -= dt;
      if (f.combo.t <= 0) f.combo.n = 0, (f.combo.last = -1);
    }
    f.ghost = f.ghost > f.hp ? Math.max(f.hp, f.ghost - Math.max(f.maxHp * 0.25, (f.ghost - f.hp) * 1.6) * dt * (f.flash > 0 ? 0 : 1)) : f.hp;

    // sandstorm and hail wear down whoever they are not made for
    if (S.field === "sand" || S.field === "hail") {
      const chip = FIELDS[S.field].chip;
      if (!f.types.some((ty) => chip.includes(ty))) {
        f.hp -= f.maxHp * 0.01 * dt;
        if (f.hp <= 0) {
          kill(S, null, f);
          continue;
        }
      }
    }
    // status effects over time
    for (const k of ["brn", "psn"] as const) {
      if (f.status[k] > 0) {
        f.status[k] -= dt;
        f.hp -= f.maxHp * (k === "brn" ? 0.022 : 0.028) * dt;
        if (f.hp <= 0) {
          kill(S, null, f);
          break;
        }
      }
    }
    if (!f.alive) continue;
    f.status.par = Math.max(0, f.status.par - dt);
    f.status.frz = Math.max(0, f.status.frz - dt);
    f.status.cnf = Math.max(0, f.status.cnf - dt);
    f.status.slp = Math.max(0, f.status.slp - dt);
    if (f.heal) {
      f.hp = Math.min(f.maxHp, f.hp + f.heal.per * dt);
      f.heal.t -= dt;
      if (f.heal.t <= 0) f.heal = null;
    }

    // a move being wound up
    if (f.cast) {
      if (f.status.frz > 0 || f.status.slp > 0) f.cast = null;
      else {
        f.cast.t -= dt;
        if (f.cast.t <= 0) {
          const c = f.cast;
          f.cast = null;
          // aim again at the last moment (the player can still change it; enemies keep their telegraphed line)
          fire(S, f, c.slot, c.dx, c.dy, c.tx, c.ty);
        }
      }
    }
    // a beam being held
    if (f.channel) {
      const mv = moveOf(f, f.channel.slot);
      f.channel.t -= dt;
      f.channel.tick -= dt;
      if (f.channel.tick <= 0) {
        f.channel.tick = 0.55 / (mv.n ?? 8);
        spawnProj(S, f, mv, f.channel.dx, f.channel.dy, { speed: 760, life: (mv.range ?? 260) / 760, r: 10, pierce: true, beam: true, off: rnd(-0.07, 0.07), dmg: baseDamage(f, mv) });
      }
      if (f.channel.t <= 0 || f.status.frz > 0 || f.status.slp > 0) f.channel = null;
    }
    stepMov(S, f, dt);
    // a rush (or a burrow)
    if (f.dash) {
      f.dash.t += dt;
      if (f.dash.under) {
        f.invuln = Math.max(f.invuln, 0.08);
        if (f.dash.t >= f.dash.total) {
          const mv = f.dash.mv;
          S.events.push({ t: "dig", x: f.x, y: f.y, id: f.id, phase: "up", type: mv.type });
          boom(S, f.x, f.y, 95, mv.type, mv.fx ?? mv.id, false, mv.id);
          for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= 95 + o.r) strike(S, f, o, baseDamage(f, mv), mv.type, { kx: o.x - f.x, ky: o.y - f.y, kb: 460, status: mv.status, mv: mv.id });
          f.dash = null;
        }
      } else {
        // a flying dive rises and comes down
        const lift = DIVE_DASH[f.dash.mv.id];
        if (lift) f.air = Math.sin(Math.PI * Math.min(1, f.dash.t / f.dash.total)) * lift;
        for (const o of foesOf(S, f)) {
          if (!f.dash.hit.has(o.id) && len(o.x - f.x, o.y - f.y) <= f.r + o.r + 6) {
            f.dash.hit.add(o.id);
            strike(S, f, o, baseDamage(f, f.dash.mv), f.dash.mv.type, { kx: f.dash.dx, ky: f.dash.dy, kb: 330, status: f.dash.mv.status, mv: f.dash.mv.id });
          }
        }
        if (f.dash.t >= f.dash.total) { if (DIVE_DASH[f.dash.mv.id]) f.air = 0; f.dash = null; }
      }
    }
    moveFighter(S, f, dt);
  }

  // ---- fighters push each other apart
  const live = S.fighters.filter((f) => f.alive);
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!;
      const b = live[j]!;
      const d = len(b.x - a.x, b.y - a.y);
      const min = (a.r + b.r) * 0.9;
      if (d < min && d > 0.01) {
        const k = ((min - d) / d) * 0.5;
        const wa = a.dash || a.dodge.t > 0 ? 0 : 1;
        const wb = b.dash || b.dodge.t > 0 ? 0 : 1;
        const ox = (b.x - a.x) * k;
        const oy = (b.y - a.y) * k;
        a.x -= ox * wa;
        a.y -= oy * wa;
        b.x += ox * wb;
        b.y += oy * wb;
      }
    }

  // ---- projectiles
  for (const pr of S.projs) {
    pr.life -= dt;
    if (pr.homing) {
      let best: Fighter | null = null;
      let bd = 420;
      for (const o of S.fighters) {
        if (!o.alive || o.team === pr.team) continue;
        const d = len(o.x - pr.x, o.y - pr.y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (best) {
        const sp = len(pr.vx, pr.vy);
        const cur = Math.atan2(pr.vy, pr.vx);
        let want = Math.atan2(best.y - pr.y, best.x - pr.x) - cur;
        while (want > Math.PI) want -= Math.PI * 2;
        while (want < -Math.PI) want += Math.PI * 2;
        const turn = clamp(want, -3.6 * dt, 3.6 * dt);
        pr.vx = Math.cos(cur + turn) * sp;
        pr.vy = Math.sin(cur + turn) * sp;
      }
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.x < -30 || pr.x > W + 30 || pr.y < -30 || pr.y > H + 30) pr.life = 0;
    for (const o of S.obs) {
      if (o.hp <= 0 || pr.life <= 0) continue;
      if (len(o.x - pr.x, o.y - pr.y) > o.r + pr.r * 0.6) continue;
      if (o.kind === "crate") {
        breakCrate(S, o);
        if (!pr.pierce) {
          pr.life = 0;
          S.events.push({ t: "explode", x: pr.x, y: pr.y, r: 30, type: pr.type });
        }
      } else {
        // pillars, rocks and crystals stop every shot
        pr.life = 0;
        S.events.push({ t: "explode", x: pr.x, y: pr.y, r: 30, type: pr.type });
      }
    }
    if (pr.life <= 0) continue;
    const src = S.fighters.find((f) => f.id === pr.owner);
    for (const o of S.fighters) {
      if (!o.alive || o.team === pr.team || pr.hits.has(o.id)) continue;
      if (len(o.x - pr.x, o.y - pr.y) <= o.r + pr.r) {
        pr.hits.add(o.id);
        if (src) strike(S, src, o, pr.dmg, pr.type, { kx: pr.vx, ky: pr.vy, kb: pr.kb, status: pr.status, mv: pr.mv });
        if (!pr.pierce) {
          pr.life = 0;
          boom(S, pr.x, pr.y, pr.aoe > 0 ? pr.aoe : 34, pr.type);
          if (pr.aoe > 0 && src) {
            for (const o2 of S.fighters) {
              if (o2.alive && o2.team !== pr.team && o2.id !== o.id && len(o2.x - pr.x, o2.y - pr.y) <= pr.aoe + o2.r) strike(S, src, o2, pr.dmg * 0.6, pr.type, { kx: o2.x - pr.x, ky: o2.y - pr.y, kb: 200, status: pr.status, mv: pr.mv });
            }
          }
          break;
        }
      }
    }
  }
  // beams from different sides that meet cancel each other out, with a burst of steam where they clash
  const beams = S.projs.filter((p2) => p2.beam && p2.life > 0);
  for (let i = 0; i < beams.length; i++) {
    const a = beams[i]!;
    if (a.life <= 0) continue;
    for (let j = i + 1; j < beams.length; j++) {
      const b = beams[j]!;
      if (b.life <= 0 || a.team === b.team || len(a.x - b.x, a.y - b.y) > a.r + b.r) continue;
      a.life = 0;
      b.life = 0;
      if (S.time - (S.clashT ?? -9) > 0.07) {
        S.clashT = S.time;
        S.events.push({ t: "clash", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
      break;
    }
  }
  S.projs = S.projs.filter((p2) => p2.life > 0);

  updateGrabs(S, dt);
  updateSlams(S, dt);
  updateHazards(S, dt);

  // ---- zones (telegraphed circles and lines)
  for (const z of S.zones) {
    if (!z.struck) {
      z.delay -= dt;
      if (z.delay <= 0) {
        z.struck = true;
        const src = S.fighters.find((f) => f.id === z.owner);
        if (z.shape === "circle") boom(S, z.x, z.y, z.r, z.type, z.mv.fx ?? z.mv.id, false, z.mv.id);
        else {
          const [ux, uy] = norm(z.x2 - z.x, z.y2 - z.y);
          const L = len(z.x2 - z.x, z.y2 - z.y);
          for (const o of S.obs) {
            if (o.kind !== "crate" || o.hp <= 0) continue;
            const along = (o.x - z.x) * ux + (o.y - z.y) * uy;
            const across = Math.abs((o.x - z.x) * uy - (o.y - z.y) * ux);
            if (along > 0 && along < L && across <= z.r + o.r) breakCrate(S, o);
          }
        }
        if (!src && z.team === -1) {
          // lightning from the sky hurts everyone it touches
          for (const o of S.fighters) {
            if (!o.alive || len(o.x - z.x, o.y - z.y) > z.r + o.r) continue;
            if (o.invuln > 0) {
              if (o.isPlayer && o.dodge.t > 0 && !o.dodge.perfected) {
                o.dodge.perfected = true;
                o.dodge.cd = 0;
                o.focus = 3;
                gainUlt(o, 25);
                S.slow = 0.7;
                S.perfects++;
                S.score += 50;
                S.events.push({ t: "perfect", x: o.x, y: o.y });
              }
              continue;
            }
            const d = Math.max(1, Math.round(o.maxHp * 0.14));
            o.hp -= d;
            o.flash = 0.12;
            S.events.push({ t: "hit", id: o.id, x: o.x, y: o.y, dmg: d, crit: false, eff: 1, type: "Electric", toPlayer: o.isPlayer, byPlayer: false, dx: 0, dy: -1, heavy: true });
            if (o.hp <= 0) kill(S, null, o);
          }
        }
        if (src) {
          for (const o of S.fighters) {
            if (!o.alive || o.team === z.team) continue;
            let inside = false;
            if (z.shape === "circle") inside = len(o.x - z.x, o.y - z.y) <= z.r + o.r;
            else {
              const [ux, uy] = norm(z.x2 - z.x, z.y2 - z.y);
              const rx = o.x - z.x;
              const ry = o.y - z.y;
              const along = rx * ux + ry * uy;
              const across = Math.abs(rx * uy - ry * ux);
              inside = along > -10 && along < len(z.x2 - z.x, z.y2 - z.y) && across <= z.r + o.r;
            }
            if (inside) strike(S, src, o, z.dmg, z.type, { kx: o.x - z.x, ky: o.y - z.y, kb: z.kb, status: z.status, mv: z.mv.id });
          }
        }
        if (z.shape === "line") boom(S, z.x2, z.y2, 26, z.type);
      }
    } else {
      z.life -= dt;
      // a whirl keeps hurting what stays inside it
      if (z.mv.linger && z.life > 0 && z.shape === "circle") {
        z.tick = (z.tick ?? 0.5) - dt;
        if (z.tick <= 0) {
          z.tick = 0.5;
          const src = S.fighters.find((f) => f.id === z.owner);
          if (src) {
            for (const o of S.fighters) {
              if (!o.alive || o.team === z.team || len(o.x - z.x, o.y - z.y) > z.r + o.r) continue;
              strike(S, src, o, z.dmg * 0.55, z.type, { kx: o.x - z.x, ky: o.y - z.y, kb: 30, status: z.status, mv: z.mv.id });
            }
          }
        }
      }
    }
  }
  S.zones = S.zones.filter((z) => !z.struck || z.life > 0);

  // ---- the shrinking storm (royale)
  if (S.mode === "royale") {
    if (!S.storm.on && S.time > (S.teamBattle ? 70 : 22)) {
      S.storm.on = true;
      S.events.push({ t: "storm" });
    }
    if (S.storm.on) S.storm.r = Math.max(130 * K, S.storm.r - 7 * K * dt);
  }

  // ---- pickups: berries, orbs, boots and crystals appear now and then
  S.itemT -= dt;
  if (S.itemT <= 0 && S.items.length < 3) {
    S.itemT = rnd(9, 14);
    const kinds = Object.keys(ITEMS) as ItemKind[];
    const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
    S.items.push({ id: S.nextId++, x: rnd(MARGIN + 60, W - MARGIN - 60), y: rnd(MARGIN + 60, H - MARGIN - 60), kind, life: 16 });
  }
  for (const it of S.items) {
    it.life -= dt;
    for (const f of live) {
      if (!f.alive || (!f.isPlayer && S.mode !== "royale")) continue;
      if (it.life > 0 && len(f.x - it.x, f.y - it.y) <= f.r + 20) {
        it.life = 0;
        if (it.kind === "heal") f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.25);
        else if (it.kind === "orb") {
          for (let i = 0; i < 4; i++) f.cd[i] = 0;
          f.dodge.cd = 0;
          gainUlt(f, 30);
        } else if (it.kind === "boots") f.haste = 7;
        else {
          f.buffT = 7;
          f.buffMul = Math.max(f.buffMul, 1.5);
        }
        S.events.push({ t: "item", x: it.x, y: it.y, kind: it.kind, byPlayer: f.isPlayer });
      }
    }
  }
  S.items = S.items.filter((it) => it.life > 0);

  // ---- falling lightning from wave 3 (and a little later in a royale): move out of the circles
  if ((S.mode === "survival" && S.wave >= 3) || (S.mode === "royale" && S.time > 14)) {
    S.hazardT -= dt;
    if (S.hazardT <= 0) {
      S.hazardT = rnd(5.5, 8.5);
      const n = 2 + Math.floor(Math.random() * 2);
      const targets = S.fighters.filter((f) => f.alive);
      for (let i = 0; i < n; i++) {
        const t = targets[Math.floor(Math.random() * targets.length)];
        const x = t && Math.random() < 0.6 ? clamp(t.x + rnd(-60, 60), MARGIN, W - MARGIN) : rnd(MARGIN, W - MARGIN);
        const y = t && Math.random() < 0.6 ? clamp(t.y + rnd(-60, 60), MARGIN, H - MARGIN) : rnd(MARGIN, H - MARGIN);
        S.zones.push({ id: S.nextId++, owner: 0, team: -1, shape: "circle", x, y, x2: x, y2: y, r: 56, delay: 1.1, total: 1.1, life: 0.35, dmg: 0, type: "Electric", kb: 220, struck: false, mv: MOVES.thunder!, player: false });
      }
      S.events.push({ t: "hazard", x: CX, y: CY });
    }
  }

  // ---- Training Ground: nothing ever ends
  if (S.mode === "training") {
    trainStep(S, dt);
    return;
  }

  // ---- Quick Battle: arena events, swaps, and the end of the match
  if (S.mode === "quick") {
    quickStep(S, dt);
    return;
  }

  // ---- the themed arenas' own events (solo runs; a shared match keeps the floors calm)
  if (!S.mp && S.phase === "fight") arenaEvents(S, dt, false);

  // ---- end of a co-op wave, or of the co-op run
  if (S.mp && S.mode === "survival") {
    const humans = S.fighters.filter((f) => f.isPlayer);
    if (humans.every((f) => !f.alive)) {
      S.phase = "over";
      S.winner = false;
      S.place = 0;
      S.events.push({ t: "over", win: false });
    } else if (!S.fighters.some((f) => f.alive && f.team !== 0)) {
      S.fighters = humans;
      S.projs = [];
      S.zones = [];
      S.perks = PERKS.map((x) => x.id).sort(() => Math.random() - 0.5).slice(0, 3);
      S.phase = "perks";
      S.score += 200 * S.wave;
      S.events.push({ t: "perks" });
    }
    return;
  }

  // ---- end of a multiplayer fight: last one standing
  if (S.mp) {
    const alive = S.fighters.filter((f) => f.alive);
    for (const f of S.fighters) if (!f.alive && !f.place) f.place = alive.length + 1;
    // over when one side is left (in a royale everyone is their own side, so it is the last one standing; a team battle ends when a whole team is down)
    if (new Set(alive.map((f) => f.team)).size <= 1) {
      S.phase = "over";
      S.winnerId = alive[0]?.id ?? 0;
      for (const f of alive) f.place = 1;
      S.events.push({ t: "over", win: false });
    }
    return;
  }

  // ---- end of a wave or of the fight
  if (!p.alive) {
    S.phase = "over";
    S.winner = false;
    S.place = S.mode === "royale" ? S.fighters.filter((f) => f.alive).length + 1 : 0;
    S.events.push({ t: "over", win: false });
    return;
  }
  const foes = S.fighters.filter((f) => f.alive && f.team !== 0);
  if (foes.length === 0) {
    if (S.mode === "royale") {
      S.phase = "over";
      S.winner = true;
      S.place = 1;
      S.score += 1000;
      S.events.push({ t: "over", win: true });
    } else {
      S.fighters = [p];
      S.projs = [];
      S.zones = [];
      const pool = PERKS.map((x) => x.id).sort(() => Math.random() - 0.5).slice(0, 3);
      S.perks = pool;
      S.phase = "perks";
      S.score += 200 * S.wave;
      S.events.push({ t: "perks" });
    }
  }
}

/* ------------------------------------------------------------- Quick Battle (3v3) */

export type QuickPick = { species: string; moves?: string[]; gimmick?: GimmickKind; mega?: string; tera?: string };
export const ARENAS: StageKind[] = ["grass", "stone", "dirt", "crystal", "ice", "lava", "coast", "meadow", "glacier", "ocean"];
const LEVEL_SCALE: Record<Level, { hp: number; dmg: number; cd: number }> = {
  easy: { hp: 0.8, dmg: 0.7, cd: 1.3 },
  normal: { hp: 1, dmg: 0.95, cd: 1 },
  hard: { hp: 1.25, dmg: 1.1, cd: 0.85 },
};

/** Three against three: the person's squad is S.squads[0], the computer's S.squads[1]; only the fighter in the ring is in S.fighters. */
export function newQuickGame(picks: QuickPick[], arena: StageKind | "random", level: Level): State {
  const first = picks[0]!;
  const S = newGame("quick", first.species, {});
  S.fighters = [];
  S.nextId = 1;
  S.level = level;
  S.swapCd = [0, 0];
  S.wave = 1;
  const mine: Fighter[] = picks.slice(0, 3).map((pk) => {
    const f = makeFighter(S, speciesOf(pk.species), 0, true, 230 * K, CY);
    f.auto = false;
    f.gimmick = pk.gimmick ?? "awaken";
    f.megaForm = (MEGAS[pk.species] ?? []).find((m) => m.id === pk.mega) ?? MEGAS[pk.species]?.[0] ?? null;
    if (f.gimmick === "mega" && !f.megaForm) f.gimmick = "awaken";
    if (pk.tera && TERA_TYPES.includes(pk.tera)) f.teraType = pk.tera;
    f.loadout = cleanMoves(pk.species, pk.moves);
    f.face = 0;
    return f;
  });
  const sc = LEVEL_SCALE[level];
  const taken = new Set(picks.map((p) => p.species));
  const pool = ROSTER.filter((x) => !taken.has(x.id) && !x.unlock);
  const theirs: Fighter[] = [];
  for (let i = 0; i < 3; i++) {
    const sp = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!;
    const f = makeFighter(S, sp, 1, false, W - 230 * K, CY, { hp: sc.hp, dmg: sc.dmg });
    f.cdMul = sc.cd;
    f.face = Math.PI;
    const kinds = gimmicksFor(sp.id);
    f.cpuGimmick = level !== "easy";
    f.gimmick = kinds[Math.floor(Math.random() * kinds.length)]!;
    const forms = MEGAS[sp.id] ?? [];
    f.megaForm = forms[Math.floor(Math.random() * forms.length)] ?? null;
    f.teraType = TERA_TYPES[Math.floor(Math.random() * TERA_TYPES.length)]!;
    theirs.push(f);
  }
  S.squads = [mine, theirs];
  S.fighters = [mine[0]!, theirs[0]!];
  const kind = arena === "random" ? ARENAS[Math.floor(Math.random() * ARENAS.length)]! : arena;
  buildStage(S, kind);
  S.gustT = rnd(6, 9);
  S.ventT = 5;
  S.spotT = rnd(8, 11);
  S.tideT = 0;
  S.field = "none";
  unstick(S);
  return S;
}

const swapBusy = (f: Fighter) => !!(f.slamT > 0 || f.cast || f.channel || f.dash || f.grabT > 0 || f.stun > 0 || f.mega > 0 || f.dyna > 0 || f.tera || f.awaken > 0);

function sendOut(S: State, team: number, cur: Fighter, nxt: Fighter) {
  const i = S.fighters.indexOf(cur);
  if (i < 0) return;
  const faint = !cur.alive;
  if (cur.alive) {
    cur.status = emptyStatus();
    cur.vx = cur.vy = 0;
    cur.mvx = cur.mvy = 0;
  }
  nxt.x = cur.x;
  nxt.y = cur.y;
  nxt.face = cur.face;
  nxt.vx = nxt.vy = 0;
  nxt.mvx = nxt.mvy = 0;
  nxt.kx = nxt.ky = 0;
  nxt.invuln = Math.max(nxt.invuln, 0.9);
  nxt.flash = 0.4;
  nxt.gcd = 0.6;
  S.fighters[i] = nxt;
  S.swapCd![team] = faint ? 0 : 3.5;
  S.events.push({ t: "explode", x: nxt.x, y: nxt.y, r: 54, type: nxt.sp.types[0]!, fx: undefined });
  S.events.push({ t: "swap", team, x: nxt.x, y: nxt.y, name: nxt.sp.name, faint });
}

/** Swap the fighter in the ring for squad member `idx`. Not possible while casting, grabbed or in a gimmick, or inside the cool-down. */
export function swapTo(S: State, team: number, idx: number): boolean {
  const sq = S.squads?.[team];
  if (S.mode !== "quick" || !sq || S.phase !== "fight") return false;
  const cur = S.fighters.find((f) => f.team === team);
  const nxt = sq[idx];
  if (!cur || !nxt || nxt === cur || !nxt.alive) return false;
  if (cur.alive && ((S.swapCd?.[team] ?? 0) > 0 || swapBusy(cur))) return false;
  sendOut(S, team, cur, nxt);
  return true;
}

/** Live events of the themed arenas: wind gusts on the ice, lava vents, tides, and (in Quick Battle) the supply spotlight. */
function arenaEvents(S: State, dt: number, spot: boolean) {
  if (S.stage === "ice") {
    const g = S.gust;
    if (g) {
      if (g.warn > 0) g.warn -= dt;
      else {
        g.t -= dt;
        if (g.t <= 0) S.gust = null;
      }
    } else {
      S.gustT = (S.gustT ?? 6) - dt;
      if (S.gustT <= 0) {
        const a = Math.floor(Math.random() * 8) * (Math.PI / 4);
        S.gust = { warn: 1.6, t: 2.6, dx: Math.cos(a), dy: Math.sin(a) };
        S.gustT = rnd(7, 10);
        S.events.push({ t: "arena", kind: "gust", x: CX, y: CY, dx: S.gust.dx, dy: S.gust.dy });
      }
    }
  }
  if (S.stage === "lava" && S.vents) {
    S.ventT = (S.ventT ?? 5) - dt;
    if (S.ventT <= 0) {
      S.ventT = rnd(4, 6);
      const vs = [...S.vents].sort(() => Math.random() - 0.5).slice(0, 2);
      for (const v of vs) {
        S.zones.push({ id: S.nextId++, owner: 0, team: -1, shape: "circle", x: v.x, y: v.y, x2: v.x, y2: v.y, r: 62, delay: 1.3, total: 1.3, life: 0.35, dmg: 0, type: "Fire", kb: 230, struck: false, mv: MOVES.eruption!, player: false });
      }
      S.events.push({ t: "arena", kind: "vent", x: vs[0]!.x, y: vs[0]!.y });
    }
  }
  if (S.stage === "coast") {
    const before = Math.sin((S.tideT ?? 0) * 0.45);
    S.tideT = (S.tideT ?? 0) + dt;
    const after = Math.sin(S.tideT * 0.45);
    const k = 1 + 0.34 * after;
    for (const p of S.pools) if (p.base) {
      p.rx = p.base * k;
      p.ry = p.base * 0.55 * k;
    }
    if (before <= 0 && after > 0) S.events.push({ t: "arena", kind: "tide", x: CX, y: CY, dx: 1 });
    else if (before > 0 && after <= 0) S.events.push({ t: "arena", kind: "tide", x: CX, y: CY, dx: -1 });
  }
  if (!spot) return;
  // a supply spotlight: hold it alone for a moment to get healed and powered up
  const sp = S.spot;
  if (sp) {
    sp.life -= dt;
    const inside = [0, 1].map((t) => {
      const f = S.fighters.find((x) => x.team === t && x.alive);
      return !!f && len(f.x - sp.x, f.y - sp.y) <= sp.r + f.r * 0.4;
    });
    for (const t of [0, 1]) sp.prog[t] = inside[t] && !inside[1 - t] ? sp.prog[t]! + dt : Math.max(0, sp.prog[t]! - dt * 0.5);
    for (const t of [0, 1]) {
      if (sp.prog[t]! < 1.5) continue;
      const f = S.fighters.find((x) => x.team === t && x.alive);
      if (f) {
        f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.3);
        f.buffT = 8;
        f.buffMul = Math.max(f.buffMul, 1.4);
        gainUlt(f, 35);
        S.events.push({ t: "heal", x: f.x, y: f.y, amt: Math.round(f.maxHp * 0.3) });
        S.events.push({ t: "arena", kind: "spotget", x: sp.x, y: sp.y, team: t });
      }
      S.spot = null;
      S.spotT = rnd(13, 18);
      break;
    }
    if (S.spot && sp.life <= 0) {
      S.spot = null;
      S.spotT = rnd(9, 12);
    }
  } else {
    S.spotT = (S.spotT ?? 9) - dt;
    if (S.spotT <= 0) {
      for (let k = 0; k < 24; k++) {
        const x = rnd(MARGIN + 140, W - MARGIN - 140);
        const y = rnd(MARGIN + 110, H - MARGIN - 110);
        if (S.obs.every((o) => o.hp <= 0 || len(o.x - x, o.y - y) > o.r + 80) && S.holes.every((h) => !inPatch(h, x, y, 80))) {
          S.spot = { x, y, r: 68, life: 11, prog: [0, 0] };
          S.events.push({ t: "arena", kind: "spot", x, y });
          break;
        }
      }
      S.spotT = 2;
    }
  }

}

function quickStep(S: State, dt: number) {
  const sq = S.squads!;
  for (const t of [0, 1]) S.swapCd![t] = Math.max(0, S.swapCd![t]! - dt);
  // a downed fighter is replaced by the next one that is still standing
  for (const t of [0, 1]) {
    const cur = S.fighters.find((f) => f.team === t);
    if (cur && !cur.alive && cur.koT > 1.0) {
      const nxt = sq[t]!.find((f) => f.alive);
      if (nxt) sendOut(S, t, cur, nxt);
    }
  }
  // the computer pulls back a hurt fighter (never on Easy)
  const cpu = S.mp ? undefined : S.fighters.find((f) => f.team === 1);
  if (cpu && cpu.alive && S.level !== "easy" && S.swapCd![1]! <= 0 && !swapBusy(cpu) && cpu.hp < cpu.maxHp * (S.level === "hard" ? 0.3 : 0.18)) {
    const best = sq[1]!.filter((f) => f.alive && f !== cpu && f.hp > f.maxHp * 0.5).sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp)[0];
    if (best && Math.random() < dt * (S.level === "hard" ? 1.2 : 0.5)) sendOut(S, 1, cpu, best);
  }

  if (!S.mp) arenaEvents(S, dt, true); // a shared match keeps the floors calm
  // sudden death: between two people a match must end, so the floor starts to close in after two and a half minutes
  if (S.mp && S.phase === "fight") {
    if (!S.storm.on && S.time > 150) {
      S.storm.on = true;
      S.events.push({ t: "storm" });
    }
    if (S.storm.on) S.storm.r = Math.max(130 * K, S.storm.r - 9 * K * dt);
  }

  // ---- the end: a whole squad is down
  const up = (t: number) => sq[t]!.some((f) => f.alive);
  if ((!up(0) || !up(1)) && S.phase === "fight") {
    S.phase = "over";
    S.winner = up(0);
    const downed = sq[1]!.filter((f) => !f.alive).length;
    const lost = sq[0]!.filter((f) => !f.alive).length;
    S.score += downed * 300 + (S.winner ? 1000 + (3 - lost) * 300 : 0);
    S.events.push({ t: "over", win: S.winner });
  }
}

/** Begin the first wave of a survival run. */
export function begin(S: State) {
  if (S.mode === "training") {
    S.phase = "fight";
  } else if (S.mode === "quick") {
    S.phase = "intro";
    S.introT = 1.8;
  } else if (S.mode === "survival" && S.wave === 0) spawnWave(S);
  else if (S.mode === "royale") {
    S.phase = "intro";
    S.introT = 1.6;
    S.events.push({ t: "wave", n: 1, boss: false });
  }
}

export function stormRadius(S: State) {
  return S.storm.r;
}
export const ARENA = { W, H, CX, CY, MARGIN };
