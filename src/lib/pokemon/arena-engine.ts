/**
 * Arena Brawl engine: a real-time, top-down fight. No DOM, no React — `step(state, input, dt)` moves the world on
 * and `state.events` tells the screen what to show and play. Because it is plain data, a whole fight can be
 * simulated headless (the CPU can even play the player's side).
 */
import { DIGGERS, FIELDS, FOE_POOL, GMAX, ITEMS, MEGAS, MOVES, PERKS, ROSTER, TERA_TYPES, Z_MOVES, Z_SIGNATURE, cleanMoves, gimmicksFor, isSwimmer, locoOf, speciesOf, type FieldKind, type GimmickKind, type ItemKind, type Loco, type MegaForm, type MoveDef, type Species, type StatusKind } from "@/lib/pokemon/arena-data";
import { typeMult } from "@/lib/pokemon/shared";

export const W = 960;
export const H = 600;
const MARGIN = 46;
const CX = W / 2;
const CY = H / 2;

export type Mode = "survival" | "royale";

export type StageKind = "grass" | "stone" | "dirt" | "crystal";
export type ObsKind = "crate" | "pillar" | "crystal" | "rock";
/** Something standing in the arena: crates break, the rest do not. */
export type Obstacle = { id: number; kind: ObsKind; x: number; y: number; r: number; hp: number; hit: number };
/** An oval patch of the floor: a bottomless pit or a pool of water. */
export type Patch = { id: number; x: number; y: number; rx: number; ry: number };

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
  cast: { slot: number; t: number; total: number; dx: number; dy: number; tx: number; ty: number } | null;
  channel: { slot: number; t: number; tick: number; dx: number; dy: number } | null;
  dash: { t: number; total: number; dx: number; dy: number; dist: number; mv: MoveDef; hit: Set<number>; under?: boolean } | null;
  dodge: { t: number; cd: number; dx: number; dy: number; perfected: boolean };
  invuln: number;
  shield: number;
  buffT: number;
  buffMul: number;
  heal: { t: number; per: number } | null;
  status: Record<StatusKind, number> & { frzImmune: number };
  flash: number;
  stun: number;
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
  combo: { n: number; t: number; last: number; best: number };
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
};

export type Ev =
  | { t: "cast"; id: number; dir: number; mv: string; tx: number; ty: number; x: number; y: number; type: string; kind: string; byPlayer: boolean }
  | { t: "hit"; id: number; x: number; y: number; dmg: number; crit: boolean; eff: number; type: string; toPlayer: boolean; byPlayer: boolean; dx: number; dy: number; heavy: boolean }
  | { t: "explode"; x: number; y: number; r: number; type: string; fx?: string }
  | { t: "crate"; x: number; y: number; kind?: string }
  | { t: "fall"; x: number; y: number; id: number; player: boolean }
  | { t: "dig"; x: number; y: number; id: number; phase: "down" | "up"; type: string }
  | { t: "stage"; kind: StageKind }
  | { t: "dodge"; x: number; y: number }
  | { t: "perfect"; x: number; y: number }
  | { t: "ko"; x: number; y: number; id: number; id2: string; type: string; byPlayer: boolean; player: boolean; boss: boolean }
  | { t: "combo"; n: number; finish: boolean }
  | { t: "heal"; x: number; y: number; amt: number }
  | { t: "status"; x: number; y: number; kind: StatusKind }
  | { t: "shield"; x: number; y: number }
  | { t: "buff"; x: number; y: number }
  | { t: "wave"; n: number; boss: boolean }
  | { t: "perks" }
  | { t: "storm" }
  | { t: "mega"; x: number; y: number; id: number; name: string; z: boolean; type: string }
  | { t: "zstart"; x: number; y: number; type: string; name: string }
  | { t: "zhit"; x: number; y: number; type: string }
  | { t: "dynamax"; x: number; y: number; id: number; gmax: boolean }
  | { t: "tera"; x: number; y: number; id: number; type: string }
  | { t: "gimmickEnd"; x: number; y: number; kind: GimmickKind }
  | { t: "awaken"; x: number; y: number; id: number }
  | { t: "item"; x: number; y: number; kind: ItemKind; byPlayer: boolean }
  | { t: "field"; kind: FieldKind }
  | { t: "hazard"; x: number; y: number }
  | { t: "clash"; x: number; y: number }
  | { t: "over"; win: boolean };

export type Input = {
  mx: number;
  my: number;
  /** Where the player is aiming (a point in the arena), or null to aim at the nearest foe. */
  aim: { x: number; y: number } | null;
  cast: [boolean, boolean, boolean, boolean];
  dodge: boolean;
  /** Awaken (the special burst), once the gauge is full. */
  ult?: boolean;
};
export const noInput = (): Input => ({ mx: 0, my: 0, aim: null, cast: [false, false, false, false], dodge: false, ult: false });

export type State = {
  mode: Mode;
  time: number;
  nextId: number;
  fighters: Fighter[];
  projs: Proj[];
  zones: Zone[];
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
  /** Multiplayer: the fighter id of the champion once the fight is over (0 = nobody, a draw). */
  winnerId?: number;
  /** When two beams last met (so the steam is not spawned every frame). */
  clashT?: number;
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

const emptyStatus = () => ({ brn: 0, psn: 0, par: 0, frz: 0, frzImmune: 0 });

/* ----------------------------------------------------------------- the arena floor */

const OBS_R: Record<ObsKind, number> = { crate: 24, pillar: 26, crystal: 22, rock: 24 };

/** An explosion, which also splinters any crates it reaches. */
function boom(S: State, x: number, y: number, r: number, type: string, fx?: string) {
  S.events.push({ t: "explode", x, y, r, type, fx });
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

/** Lays out crates, pillars, crystals, a pond or a pit — each stage has its own. */
export function buildStage(S: State, kind: StageKind) {
  S.stage = kind;
  S.obs = [];
  S.holes = [];
  S.pools = [];
  const free = (x: number, y: number, r: number) =>
    x > MARGIN + r + 10 && x < W - MARGIN - r - 10 && y > MARGIN + r + 10 && y < H - MARGIN - r - 10 &&
    S.obs.every((o) => len(o.x - x, o.y - y) > o.r + r + 46) &&
    S.holes.every((h) => !inPatch(h, x, y, r + 30)) &&
    S.pools.every((h) => !inPatch(h, x, y, r + 20)) &&
    S.fighters.every((f) => !f.alive || len(f.x - x, f.y - y) > f.r + r + 60);
  const scatter = (k: ObsKind, n: number) => {
    for (let i = 0; i < n; i++) {
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
      patch(S.pools, rnd(80, 110), rnd(55, 75), rnd(300, 660), rnd(190, 410));
      scatter("crate", 6);
      scatter("rock", 3);
      break;
    case "stone":
      scatter("crate", 5);
      scatter("pillar", 3);
      break;
    case "dirt":
      scatter("crate", 4);
      scatter("rock", 5);
      break;
    case "crystal":
      patch(S.holes, 190, 105, CX, CY);
      scatter("crystal", 8);
      scatter("pillar", 1);
      break;
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
    invuln: 0,
    shield: 0,
    buffT: 0,
    buffMul: 1,
    heal: null,
    status: emptyStatus(),
    flash: 0,
    stun: 0,
    kx: 0,
    ky: 0,
    alive: true,
    koT: 0,
    think: rnd(0.1, 0.5),
    gcd: rnd(0.6, 1.4),
    strafe: Math.random() < 0.5 ? 1 : -1,
    roam: { x, y },
    ringT: rnd(3, 5),
    combo: { n: 0, t: 0, last: -1, best: 0 },
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

export type NewGameOptions = { auto?: boolean; gimmick?: GimmickKind; mega?: string; tera?: string; moves?: string[] };

export function newGame(mode: Mode, speciesId: string, opts: NewGameOptions = {}): State {
  const S: State = {
    mode,
    time: 0,
    nextId: 1,
    fighters: [],
    projs: [],
    zones: [],
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
    pools: [],
    items: [],
    itemT: 7,
    hazardT: 6,
    field: "none",
    perks: [],
    taken: [],
    storm: { r: 520, on: false },
    winner: false,
    place: 0,
    perfects: 0,
    easy: 1,
  };
  const player = makeFighter(S, speciesOf(speciesId), 0, true, mode === "royale" ? CX : 230, mode === "royale" ? CY + 150 : CY);
  player.loadout = cleanMoves(speciesId, opts.moves);
  player.auto = !!opts.auto;
  player.cpuGimmick = !!opts.auto; // an auto-piloted player also uses its gimmick
  player.gimmick = opts.gimmick ?? "awaken";
  player.megaForm = (MEGAS[speciesId] ?? []).find((m) => m.id === opts.mega) ?? MEGAS[speciesId]?.[0] ?? null;
  if (player.gimmick === "mega" && !player.megaForm) player.gimmick = "awaken";
  if (opts.tera && TERA_TYPES.includes(opts.tera)) player.teraType = opts.tera;
  S.fighters.push(player);
  buildStage(S, mode === "royale" ? (["grass", "stone", "dirt", "crystal"] as StageKind[])[Math.floor(Math.random() * 4)]! : "grass");
  if (mode === "royale") {
    const pool = ROSTER.filter((s) => s.id !== speciesId && !s.unlock);
    for (let i = 0; i < 4; i++) {
      const sp = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!;
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cpu = makeFighter(S, sp, i + 1, false, CX + Math.cos(a) * 300, CY + Math.sin(a) * 200, { hp: 0.95, dmg: 0.95 });
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
    S.storm = { r: 520, on: false };
    const kinds: FieldKind[] = ["none", "sun", "rain", "sand", "hail"];
    S.field = kinds[Math.floor(Math.random() * kinds.length)]!;
  }
  return S;
}

export type MpPlayer = { member: number; name: string; species: string; gimmick?: GimmickKind; mega?: string; tera?: string; moves?: string[] };

/** A battle royale between 2-5 members: every fighter is steered by a person, nobody else is in the arena. */
export function newMpGame(players: MpPlayer[], mode: Mode = "royale"): State {
  const first = players[0]!;
  const S = newGame(mode, first.species, { gimmick: first.gimmick, mega: first.mega, tera: first.tera });
  // newGame made the first human and four computer fighters: keep only the humans
  S.fighters = [];
  S.nextId = 1;
  S.mp = true;
  const n = players.length;
  players.forEach((pl, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    // royale: everybody on their own team around the ring. Co-op: one team in a line on the left.
    const f =
      mode === "royale"
        ? makeFighter(S, speciesOf(pl.species), i, true, CX + Math.cos(a) * 300, CY + Math.sin(a) * 200)
        : makeFighter(S, speciesOf(pl.species), 0, true, 200, CY + (i - (n - 1) / 2) * 90);
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
  const order: StageKind[] = ["grass", "stone", "dirt", "stone"];
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

function baseDamage(src: Fighter, mv: MoveDef, power = mv.power) {
  return 13 * power * ((src.power * (src.mega > 0 ? src.megaP : 1)) / 90) * src.dmgMul * (src.buffT > 0 ? src.buffMul : 1) * (src.awaken > 0 ? 1.5 : 1) * (src.dyna > 0 ? 1.35 : 1);
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
  } else if (kind === "par") f.status.par = 3.5;
  else if (kind === "brn") f.status.brn = 4;
  else f.status.psn = 5;
  S.events.push({ t: "status", x: f.x, y: f.y, kind });
}

/** One hit lands (or does not): dodged, shielded, resisted, critical… returns the damage dealt. */
function strike(S: State, src: Fighter, dst: Fighter, dmgBase: number, type: string, o: { kx: number; ky: number; kb: number; status?: { kind: StatusKind; chance: number }; fromPlayerAttack?: boolean }): number {
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
  let dmg = dmgBase * fieldMul(S, type) * eff * stab * (crit ? 1.6 : 1) * comboMul * focusMul * rnd(0.93, 1.07) * dst.takeMul * (13 / (6 + (dst.defence * (dst.mega > 0 ? dst.megaD : 1)) / 9));
  if (dst.shield > 0) dmg *= 0.12;
  if (dst.crystal > 0) {
    const soak = Math.min(dst.crystal, dmg);
    dst.crystal -= soak;
    dmg -= soak;
  }
  dmg = dmg > 0.5 ? Math.max(1, Math.round(dmg)) : 0;
  dst.hp -= dmg;
  dst.flash = 0.12;
  src.dealt += dmg;
  gainUlt(src, (dmg / Math.max(1, dst.maxHp)) * 70);
  if (src.drain > 0) src.hp = Math.min(src.maxHp, src.hp + dmg * src.drain);
  const heavy = dmg >= dst.maxHp * 0.12 || crit;
  const [nx, ny] = norm(o.kx, o.ky);
  if (!dst.boss && dst.dyna <= 0) {
    dst.kx += nx * o.kb * (heavy ? 1.3 : 1);
    dst.ky += ny * o.kb * (heavy ? 1.3 : 1);
  }
  if (heavy) S.freeze = Math.max(S.freeze, src.isPlayer || dst.isPlayer ? 0.07 : 0.03);
  if (o.status && Math.random() < o.status.chance) applyStatus(S, dst, o.status.kind);
  S.events.push({ t: "hit", id: dst.id, x: dst.x, y: dst.y, dmg, crit, eff, type, toPlayer: dst.isPlayer, byPlayer: src.isPlayer, dx: nx, dy: ny, heavy });
  if (src.isPlayer) S.score += Math.round(dmg * 0.5);
  if (dst.hp <= 0) kill(S, src, dst);
  return dmg;
}

function kill(S: State, src: Fighter | null, dst: Fighter) {
  dst.alive = false;
  dst.hp = 0;
  dst.koT = 0;
  dst.cast = dst.channel = dst.dash = null;
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
    for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= r + o.r) strike(S, f, o, baseDamage(f, mv, 0.4), f.types[0] ?? "Normal", { kx: o.x - f.x, ky: o.y - f.y, kb: 200 });
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
      f.dash = { t: 0, total: 0.2, dx, dy, dist: range, mv, hit: new Set() };
      f.invuln = Math.max(f.invuln, 0.14);
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
      boom(S, f.x, f.y, r, mv.type, mv.id);
      for (const o of foesOf(S, f)) {
        const d = len(o.x - f.x, o.y - f.y);
        if (d <= r + o.r) strike(S, f, o, baseDamage(f, mv), mv.type, { kx: o.x - f.x, ky: o.y - f.y, kb: 240, status: mv.status });
      }
      break;
    }
    case "lob": {
      const range = mv.range ?? 320;
      const d = len(tx - f.x, ty - f.y);
      const k = d > range ? range / d : 1;
      const x = clamp(f.x + (tx - f.x) * k, MARGIN, W - MARGIN);
      const y = clamp(f.y + (ty - f.y) * k, MARGIN, H - MARGIN);
      S.zones.push({ id: S.nextId++, owner: f.id, team: f.team, shape: "circle", x, y, x2: x, y2: y, r: mv.id === "maxstrike" || mv.id === "gmaxblast" ? 108 : 62, delay: (mv.windup ?? 0.55) * (f.isPlayer ? 0.6 : 1), total: (mv.windup ?? 0.55) * (f.isPlayer ? 0.6 : 1), life: 0.35, dmg: baseDamage(f, mv), type: mv.type, status: mv.status, kb: 260, struck: false, mv, player: f.isPlayer });
      break;
    }
    case "bolt": {
      const range = mv.range ?? 480;
      S.zones.push({ id: S.nextId++, owner: f.id, team: f.team, shape: "line", x: f.x, y: f.y, x2: f.x + dx * range, y2: f.y + dy * range, r: 20, delay: (mv.windup ?? 0.5) * (f.isPlayer ? 0.35 : 1), total: (mv.windup ?? 0.5) * (f.isPlayer ? 0.35 : 1), life: 0.3, dmg: baseDamage(f, mv), type: mv.type, status: mv.status, kb: 200, struck: false, mv, player: f.isPlayer });
      break;
    }
    case "guard":
      f.shield = 1.15;
      S.events.push({ t: "shield", x: f.x, y: f.y });
      break;
    case "heal":
      f.heal = { t: 1.2, per: (f.maxHp * mv.power) / 1.2 };
      break;
    case "buff":
      f.buffT = 6;
      f.buffMul = mv.power;
      S.events.push({ t: "buff", x: f.x, y: f.y });
      break;
  }
}

/** Start using a move. Returns false if it is not possible right now. */
export function tryCast(S: State, f: Fighter, slot: number, input: Input | null = null): boolean {
  if (!f.alive || f.stun > 0 || f.status.frz > 0) return false;
  if (f.cd[slot]! > 0 || f.cast || f.channel || f.dash) return false;
  const mv = moveOf(f, slot);
  const a = aimOf(S, f, input);
  f.cd[slot] = mv.cd * f.cdMul;
  if (f.isPlayer) {
    // chain different moves for a combo
    const c = f.combo;
    if (c.last !== slot) c.n = c.t > 0 ? c.n + 1 : 1;
    c.last = slot;
    c.t = 2.2;
    c.best = Math.max(c.best, c.n);
    if (c.n >= 4) {
      c.n = 0;
      c.last = -1;
      for (let i = 0; i < 4; i++) f.cd[i] = Math.max(0, f.cd[i]! - 1.2);
      S.score += 150;
      S.events.push({ t: "combo", n: 4, finish: true });
      const r = 150;
      boom(S, f.x, f.y, r, f.types[0] ?? "Normal");
      for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= r + o.r) strike(S, f, o, 20 * (f.power / 90) * f.dmgMul, f.types[0] ?? "Normal", { kx: o.x - f.x, ky: o.y - f.y, kb: 300 });
    } else S.events.push({ t: "combo", n: c.n, finish: false });
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

function startDodge(S: State, f: Fighter, dx: number, dy: number) {
  if (!f.alive || f.dodge.cd > 0 || f.dodge.t > 0 || f.status.frz > 0 || f.stun > 0) return false;
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
  boom(S, f.x, f.y, r, type);
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
  f.override[3] = { id: "megaburst", name: `Mega ${type} Burst`, type, kind: "nova", power: 2.7, cd: 4.2, range: 215, desc: "An explosion of Mega energy all around you." };
  f.cd[3] = 0;
  S.events.push({ t: "mega", x: f.x, y: f.y, id: f.id, name: form.name, z: !!form.z, type });
  boom(S, f.x, f.y, 190, type);
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
  f.status.brn = f.status.psn = f.status.par = f.status.frz = 0;
  const type = f.types[0] ?? "Normal";
  // its own special move: a giant strike that lands where you aim
  f.override[3] = f.gmax
    ? { id: "gmaxblast", name: `G-Max ${type}`, type, kind: "lob", power: 3.2, cd: 4.6, range: 400, windup: 0.5, desc: "A Gigantamax finisher that lands where you aim." }
    : { id: "maxstrike", name: `Max ${type}`, type, kind: "lob", power: 2.8, cd: 4.2, range: 380, windup: 0.5, desc: "A Max Move strike where you aim." };
  f.cd[3] = 0;
  S.events.push({ t: "dynamax", x: f.x, y: f.y, id: f.id, gmax: f.gmax });
  boom(S, f.x, f.y, 210, type);
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
  boom(S, f.x, f.y, 170, type);
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
    default: return [0, 9999];
  }
};

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
  f.think = rnd(0.12, 0.28);

  // dodge incoming shots (the later the wave, the more often)
  const skill = clamp(0.25 + S.wave * 0.07, 0.25, 0.8);
  if (f.dodge.cd <= 0 && f.dodge.t <= 0 && (S.wave >= 3 || S.mode === "royale")) {
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
      if (d < 360) options.push(i);
      continue;
    }
    const [lo, hi] = useRange(mv);
    if (d >= lo && d <= hi) options.push(i);
  }
  if (options.length) {
    const slot = options[Math.floor(Math.random() * options.length)]!;
    if (tryCast(S, f, slot, null)) f.gcd = (f.boss ? rnd(0.5, 1.0) : rnd(0.9, 1.7)) * (S.mode === "royale" ? 0.9 : 1);
  }
}

/* ------------------------------------------------------------------- step */

/** How quickly each kind of mover gets up to speed and slows down (flyers and floaters drift). */
const ACCEL: Record<string, number> = { fly: 5.5, float: 3.8, surf: 6, slither: 6.5, run: 11, walk: 15 };

function moveFighter(S: State, f: Fighter, dt: number) {
  const under = !!f.dash?.under;
  f.inWater = S.pools.some((p) => inPatch(p, f.x, f.y));
  let sx = 0;
  let sy = 0;
  if (f.dodge.t > 0) {
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
    if (f.awaken > 0) k *= 1.25;
    if (f.mega > 0) k *= f.megaS;
    if (f.dyna > 0) k *= 0.92;
    if (f.haste > 0) k *= 1.3;
    if (f.status.par > 0) k *= 0.55;
    if (f.status.frz > 0 || f.stun > 0) k = 0;
    if (f.channel) k *= 0.35;
    // water: swimmers are quick, flyers do not care, everyone else wades
    if (f.inWater) k *= f.swimmer ? 1.3 : f.canFly ? 1 : 0.62;
    const a = 1 - Math.exp(-dt * (ACCEL[f.loco] ?? 15));
    f.mvx += (f.vx * k - f.mvx) * a;
    f.mvy += (f.vy * k - f.mvy) * a;
    sx = f.mvx;
    sy = f.mvy;
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
      if (!(o.kind === "pillar" || !f.canFly)) continue;
      const min = f.r * 0.85 + o.r;
      const d = len(f.x - o.x, f.y - o.y);
      if (d >= min) continue;
      if (f.dash && o.kind === "crate") {
        breakCrate(S, o);
        continue;
      }
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
    if (!f.canFly) {
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

  // ---- the people (one in a normal run, 2-5 in a multiplayer royale)
  for (const h of S.fighters) {
    if (!h.isPlayer || !h.alive) continue;
    if (h.auto) {
      aiStep(S, h, dt);
      continue;
    }
    const inp = h === p ? input : others?.get(h.id) ?? noInput();
    const [mx, my] = len(inp.mx, inp.my) > 1 ? norm(inp.mx, inp.my) : [inp.mx, inp.my];
    h.vx = mx * h.speed;
    h.vy = my * h.speed;
    if (inp.dodge) startDodge(S, h, len(mx, my) > 0.1 ? mx : Math.cos(h.face), len(mx, my) > 0.1 ? my : Math.sin(h.face));
    for (let i = 0; i < 4; i++) if (inp.cast[i]) tryCast(S, h, i, inp);
    if (inp.ult) activateGimmick(S, h);
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
    if (!f.isPlayer) aiStep(S, f, dt);

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
    f.shield = Math.max(0, f.shield - dt);
    f.focus = Math.max(0, f.focus - dt);
    f.buffT = Math.max(0, f.buffT - dt);
    f.dodge.cd = Math.max(0, f.dodge.cd - dt);
    if (f.dodge.t > 0) f.dodge.t = Math.max(0, f.dodge.t - dt);
    f.status.frzImmune = Math.max(0, f.status.frzImmune - dt);
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
    if (f.heal) {
      f.hp = Math.min(f.maxHp, f.hp + f.heal.per * dt);
      f.heal.t -= dt;
      if (f.heal.t <= 0) f.heal = null;
    }

    // a move being wound up
    if (f.cast) {
      if (f.status.frz > 0) f.cast = null;
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
      if (f.channel.t <= 0 || f.status.frz > 0) f.channel = null;
    }
    // a rush (or a burrow)
    if (f.dash) {
      f.dash.t += dt;
      if (f.dash.under) {
        f.invuln = Math.max(f.invuln, 0.08);
        if (f.dash.t >= f.dash.total) {
          const mv = f.dash.mv;
          S.events.push({ t: "dig", x: f.x, y: f.y, id: f.id, phase: "up", type: mv.type });
          boom(S, f.x, f.y, 95, mv.type, mv.id);
          for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= 95 + o.r) strike(S, f, o, baseDamage(f, mv), mv.type, { kx: o.x - f.x, ky: o.y - f.y, kb: 460, status: mv.status });
          f.dash = null;
        }
      } else {
        for (const o of foesOf(S, f)) {
          if (!f.dash.hit.has(o.id) && len(o.x - f.x, o.y - f.y) <= f.r + o.r + 6) {
            f.dash.hit.add(o.id);
            strike(S, f, o, baseDamage(f, f.dash.mv), f.dash.mv.type, { kx: f.dash.dx, ky: f.dash.dy, kb: 330, status: f.dash.mv.status });
          }
        }
        if (f.dash.t >= f.dash.total) f.dash = null;
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
        if (src) strike(S, src, o, pr.dmg, pr.type, { kx: pr.vx, ky: pr.vy, kb: pr.kb, status: pr.status });
        if (!pr.pierce) {
          pr.life = 0;
          boom(S, pr.x, pr.y, pr.aoe > 0 ? pr.aoe : 34, pr.type);
          if (pr.aoe > 0 && src) {
            for (const o2 of S.fighters) {
              if (o2.alive && o2.team !== pr.team && o2.id !== o.id && len(o2.x - pr.x, o2.y - pr.y) <= pr.aoe + o2.r) strike(S, src, o2, pr.dmg * 0.6, pr.type, { kx: o2.x - pr.x, ky: o2.y - pr.y, kb: 200, status: pr.status });
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

  // ---- zones (telegraphed circles and lines)
  for (const z of S.zones) {
    if (!z.struck) {
      z.delay -= dt;
      if (z.delay <= 0) {
        z.struck = true;
        const src = S.fighters.find((f) => f.id === z.owner);
        if (z.shape === "circle") boom(S, z.x, z.y, z.r, z.type, z.mv.id);
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
            if (inside) strike(S, src, o, z.dmg, z.type, { kx: o.x - z.x, ky: o.y - z.y, kb: z.kb, status: z.status });
          }
        }
        if (z.shape === "line") boom(S, z.x2, z.y2, 26, z.type);
      }
    } else z.life -= dt;
  }
  S.zones = S.zones.filter((z) => !z.struck || z.life > 0);

  // ---- the shrinking storm (royale)
  if (S.mode === "royale") {
    if (!S.storm.on && S.time > 22) {
      S.storm.on = true;
      S.events.push({ t: "storm" });
    }
    if (S.storm.on) S.storm.r = Math.max(130, S.storm.r - 7 * dt);
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
    if (alive.length <= 1) {
      S.phase = "over";
      S.winnerId = alive[0]?.id ?? 0;
      if (alive[0]) alive[0].place = 1;
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

/** Begin the first wave of a survival run. */
export function begin(S: State) {
  if (S.mode === "survival" && S.wave === 0) spawnWave(S);
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
