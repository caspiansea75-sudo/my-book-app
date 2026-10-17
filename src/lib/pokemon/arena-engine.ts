/**
 * Arena Brawl engine: a real-time, top-down fight. No DOM, no React — `step(state, input, dt)` moves the world on
 * and `state.events` tells the screen what to show and play. Because it is plain data, a whole fight can be
 * simulated headless (the CPU can even play the player's side).
 */
import { FOE_POOL, MOVES, PERKS, ROSTER, speciesOf, type MoveDef, type Species, type StatusKind } from "@/lib/pokemon/arena-data";
import { typeMult } from "@/lib/pokemon/shared";

export const W = 960;
export const H = 600;
const MARGIN = 46;
const CX = W / 2;
const CY = H / 2;

export type Mode = "survival" | "royale";

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
  dash: { t: number; total: number; dx: number; dy: number; dist: number; mv: MoveDef; hit: Set<number> } | null;
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
  delay: number; // warning time before it strikes
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
  | { t: "cast"; x: number; y: number; type: string; kind: string; byPlayer: boolean }
  | { t: "hit"; x: number; y: number; dmg: number; crit: boolean; eff: number; type: string; toPlayer: boolean; byPlayer: boolean; dx: number; dy: number; heavy: boolean }
  | { t: "explode"; x: number; y: number; r: number; type: string }
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
  | { t: "over"; win: boolean };

export type Input = {
  mx: number;
  my: number;
  /** Where the player is aiming (a point in the arena), or null to aim at the nearest foe. */
  aim: { x: number; y: number } | null;
  cast: [boolean, boolean, boolean, boolean];
  dodge: boolean;
};
export const noInput = (): Input => ({ mx: 0, my: 0, aim: null, cast: [false, false, false, false], dodge: false });

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
  perks: string[]; // the three offered
  taken: string[]; // perks picked so far
  storm: { r: number; on: boolean };
  winner: boolean;
  place: number;
  perfects: number;
  /** Mean time the player has to dodge: higher is easier. */
  easy: number;
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const len = (x: number, y: number) => Math.hypot(x, y);
const norm = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y);
  return l < 1e-6 ? [1, 0] : [x / l, y / l];
};

const emptyStatus = () => ({ brn: 0, psn: 0, par: 0, frz: 0, frzImmune: 0 });

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
    dealt: 0,
    kos: 0,
  };
}

export function newGame(mode: Mode, speciesId: string, opts: { auto?: boolean } = {}): State {
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
    perks: [],
    taken: [],
    storm: { r: 520, on: false },
    winner: false,
    place: 0,
    perfects: 0,
    easy: 1,
  };
  const player = makeFighter(S, speciesOf(speciesId), 0, true, mode === "royale" ? CX : 230, mode === "royale" ? CY + 150 : CY);
  player.auto = !!opts.auto;
  S.fighters.push(player);
  if (mode === "royale") {
    const pool = ROSTER.filter((s) => s.id !== speciesId && !s.locked);
    for (let i = 0; i < 4; i++) {
      const sp = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!;
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      S.fighters.push(makeFighter(S, sp, i + 1, false, CX + Math.cos(a) * 300, CY + Math.sin(a) * 200, { hp: 0.95, dmg: 0.95 }));
    }
    S.wave = 1;
    S.storm = { r: 520, on: false };
  }
  return S;
}

export const playerOf = (S: State) => S.fighters[0]!;

function spawnWave(S: State) {
  S.wave++;
  const w = S.wave;
  const boss = w % 5 === 0;
  const p = playerOf(S);
  const scale = { hp: 0.8 + 0.12 * (w - 1), dmg: 0.62 + 0.07 * (w - 1) };
  const count = boss ? 1 + (w >= 10 ? 1 : 0) : Math.min(5, 1 + Math.floor(w / 2));
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
      const f = makeFighter(S, speciesOf("mewtwo"), 1, false, x, y, { hp: scale.hp, dmg: scale.dmg }, true);
      S.fighters.push(f);
    } else {
      const pool = FOE_POOL.slice(0, Math.min(FOE_POOL.length, 4 + w));
      const id = pool[Math.floor(Math.random() * pool.length)]!;
      S.fighters.push(makeFighter(S, speciesOf(id), 1, false, x, y, scale));
    }
  }
  S.events.push({ t: "wave", n: w, boss });
  S.phase = "intro";
  S.introT = 1.4;
}

export function choosePerk(S: State, id: string) {
  const p = playerOf(S);
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
  S.phase = "intro";
  S.introT = 0.6;
  spawnWave(S);
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
  return 13 * power * (src.power / 90) * src.dmgMul * (src.buffT > 0 ? src.buffMul : 1);
}

function applyStatus(S: State, f: Fighter, kind: StatusKind) {
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
      S.slow = 0.7;
      S.perfects++;
      S.score += 50;
      S.events.push({ t: "perfect", x: dst.x, y: dst.y });
    }
    return 0;
  }
  const eff = typeMult(type, dst.sp.types);
  const stab = src.sp.types.includes(type) ? STAB : 1;
  const crit = Math.random() < src.critChance;
  const comboMul = src.isPlayer ? 1 + Math.min(0.5, 0.1 * Math.max(0, src.combo.n - 1)) : 1;
  const focusMul = src.isPlayer && src.focus > 0 ? 1.5 : 1;
  let dmg = dmgBase * eff * stab * (crit ? 1.6 : 1) * comboMul * focusMul * rnd(0.93, 1.07) * dst.takeMul * (13 / (6 + dst.defence / 9));
  if (dst.shield > 0) dmg *= 0.12;
  dmg = Math.max(1, Math.round(dmg));
  dst.hp -= dmg;
  dst.flash = 0.12;
  src.dealt += dmg;
  if (src.drain > 0) src.hp = Math.min(src.maxHp, src.hp + dmg * src.drain);
  const heavy = dmg >= dst.maxHp * 0.12 || crit;
  const [nx, ny] = norm(o.kx, o.ky);
  if (!dst.boss) {
    dst.kx += nx * o.kb * (heavy ? 1.3 : 1);
    dst.ky += ny * o.kb * (heavy ? 1.3 : 1);
  }
  if (heavy) S.freeze = Math.max(S.freeze, src.isPlayer || dst.isPlayer ? 0.07 : 0.03);
  if (o.status && Math.random() < o.status.chance) applyStatus(S, dst, o.status.kind);
  S.events.push({ t: "hit", x: dst.x, y: dst.y, dmg, crit, eff, type, toPlayer: dst.isPlayer, byPlayer: src.isPlayer, dx: nx, dy: ny, heavy });
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
  if (src?.isPlayer) S.score += 100 * Math.max(1, S.wave) * (dst.boss ? 5 : 1);
  S.events.push({ t: "ko", x: dst.x, y: dst.y, id: dst.id, id2: dst.sp.id, type: dst.sp.types[0] ?? "Normal", byPlayer: !!src?.isPlayer, player: dst.isPlayer, boss: dst.boss });
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
    r: o.r ?? (mv.kind === "beam" ? 9 : 11),
    dmg: o.dmg ?? baseDamage(f, mv),
    type: mv.type,
    life: o.life ?? 1.6,
    pierce: o.pierce ?? !!mv.pierce,
    hits: new Set(),
    status: mv.status,
    homing: !!o.homing,
    beam: !!o.beam,
    kb: mv.kind === "beam" ? 30 : 150,
  });
}

function fire(S: State, f: Fighter, slot: number, dx: number, dy: number, tx: number, ty: number) {
  const mv = MOVES[f.sp.moves[slot]!]!;
  S.events.push({ t: "cast", x: f.x, y: f.y, type: mv.type, kind: mv.kind, byPlayer: f.isPlayer });
  f.face = Math.atan2(dy, dx);
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
    case "nova": {
      const r = mv.range ?? 130;
      S.events.push({ t: "explode", x: f.x, y: f.y, r, type: mv.type });
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
      S.zones.push({ id: S.nextId++, owner: f.id, team: f.team, shape: "circle", x, y, x2: x, y2: y, r: 62, delay: (mv.windup ?? 0.55) * (f.isPlayer ? 0.6 : 1), life: 0.35, dmg: baseDamage(f, mv), type: mv.type, status: mv.status, kb: 260, struck: false, mv, player: f.isPlayer });
      break;
    }
    case "bolt": {
      const range = mv.range ?? 480;
      S.zones.push({ id: S.nextId++, owner: f.id, team: f.team, shape: "line", x: f.x, y: f.y, x2: f.x + dx * range, y2: f.y + dy * range, r: 20, delay: (mv.windup ?? 0.5) * (f.isPlayer ? 0.35 : 1), life: 0.3, dmg: baseDamage(f, mv), type: mv.type, status: mv.status, kb: 200, struck: false, mv, player: f.isPlayer });
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
  const mv = MOVES[f.sp.moves[slot]!]!;
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
      S.events.push({ t: "explode", x: f.x, y: f.y, r, type: f.sp.types[0] ?? "Normal" });
      for (const o of foesOf(S, f)) if (len(o.x - f.x, o.y - f.y) <= r + o.r) strike(S, f, o, 20 * (f.power / 90) * f.dmgMul, f.sp.types[0] ?? "Normal", { kx: o.x - f.x, ky: o.y - f.y, kb: 300 });
    } else S.events.push({ t: "combo", n: c.n, finish: false });
  }
  // lobs and bolts warn with their own circle/line on the ground, so they fire at once
  const own = mv.kind === "lob" || mv.kind === "bolt";
  const wind = own ? 0 : f.isPlayer ? (mv.windup ?? 0) * 0.45 : mv.windup ?? (mv.kind === "proj" || mv.kind === "homing" || mv.kind === "spread" ? 0.32 : mv.kind === "dash" ? 0.4 : mv.kind === "beam" ? 0.4 : 0);
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

/* ---------------------------------------------------------------- computer players */

const useRange = (mv: MoveDef): [number, number] => {
  switch (mv.kind) {
    case "proj": case "spread": case "homing": return [80, 460];
    case "beam": return [0, (mv.range ?? 260) * 0.9];
    case "dash": return [70, (mv.range ?? 200) + 40];
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
      S.events.push({ t: "explode", x: f.x, y: f.y, r: 80, type: "Psychic" });
      f.gcd = 1.0;
      return;
    }
  }

  // pick a move that suits the distance
  const options: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (f.cd[i]! > 0) continue;
    const mv = MOVES[f.sp.moves[i]!]!;
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

function moveFighter(S: State, f: Fighter, dt: number) {
  let sx = f.vx;
  let sy = f.vy;
  if (f.dodge.t > 0) {
    sx = f.dodge.dx * 560;
    sy = f.dodge.dy * 560;
  } else if (f.dash) {
    const speed = f.dash.dist / f.dash.total;
    sx = f.dash.dx * speed;
    sy = f.dash.dy * speed;
  } else {
    let k = f.speedMul;
    if (f.status.par > 0) k *= 0.55;
    if (f.status.frz > 0 || f.stun > 0) k = 0;
    if (f.channel) k *= 0.35;
    sx *= k;
    sy *= k;
  }
  // knock-back decays quickly
  sx += f.kx;
  sy += f.ky;
  const decay = Math.pow(0.0008, dt);
  f.kx *= decay;
  f.ky *= decay;
  f.x += sx * dt;
  f.y += sy * dt;
  if (S.storm.on) {
    const d = len(f.x - CX, f.y - CY);
    if (d > S.storm.r) {
      f.hp -= f.maxHp * 0.06 * dt;
      if (f.hp <= 0 && f.alive) kill(S, null, f);
    }
  }
  f.x = clamp(f.x, MARGIN, W - MARGIN);
  f.y = clamp(f.y, MARGIN, H - MARGIN);
  if (len(sx, sy) > 20 && !f.cast && !f.channel) f.face = Math.atan2(sy, sx);
}

export function step(S: State, input: Input, realDt: number) {
  const dt0 = Math.min(realDt, 0.05);
  if (S.freeze > 0) {
    S.freeze -= dt0;
    return;
  }
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

  // ---- the player
  if (p.alive && !p.auto) {
    const [mx, my] = len(input.mx, input.my) > 1 ? norm(input.mx, input.my) : [input.mx, input.my];
    p.vx = mx * p.speed;
    p.vy = my * p.speed;
    if (input.dodge) startDodge(S, p, len(mx, my) > 0.1 ? mx : Math.cos(p.face), len(mx, my) > 0.1 ? my : Math.sin(p.face));
    for (let i = 0; i < 4; i++) if (input.cast[i]) tryCast(S, p, i, input);
    // a held beam follows the aim
    if (p.channel) {
      const a = aimOf(S, p, input);
      p.channel.dx = a.dx;
      p.channel.dy = a.dy;
      p.face = Math.atan2(a.dy, a.dx);
    }
    // face the aim
    if (!p.cast && !p.channel && len(mx, my) < 0.1) {
      const a = aimOf(S, p, input);
      p.face = Math.atan2(a.dy, a.dx);
    }
  } else if (p.alive && p.auto) {
    aiStep(S, p, dt);
  }

  // ---- everyone else
  for (const f of S.fighters) {
    if (!f.alive) {
      f.koT += dt;
      continue;
    }
    if (!f.isPlayer) aiStep(S, f, dt);

    // timers
    for (let i = 0; i < 4; i++) f.cd[i] = Math.max(0, f.cd[i]! - dt);
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
      const mv = MOVES[f.sp.moves[f.channel.slot]!]!;
      f.channel.t -= dt;
      f.channel.tick -= dt;
      if (f.channel.tick <= 0) {
        f.channel.tick = 0.55 / (mv.n ?? 8);
        spawnProj(S, f, mv, f.channel.dx, f.channel.dy, { speed: 760, life: (mv.range ?? 260) / 760, r: 10, pierce: true, beam: true, off: rnd(-0.07, 0.07), dmg: baseDamage(f, mv) });
      }
      if (f.channel.t <= 0 || f.status.frz > 0) f.channel = null;
    }
    // a rush
    if (f.dash) {
      f.dash.t += dt;
      for (const o of foesOf(S, f)) {
        if (!f.dash.hit.has(o.id) && len(o.x - f.x, o.y - f.y) <= f.r + o.r + 6) {
          f.dash.hit.add(o.id);
          strike(S, f, o, baseDamage(f, f.dash.mv), f.dash.mv.type, { kx: f.dash.dx, ky: f.dash.dy, kb: 330, status: f.dash.mv.status });
        }
      }
      if (f.dash.t >= f.dash.total) f.dash = null;
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
    if (pr.life <= 0) continue;
    const src = S.fighters.find((f) => f.id === pr.owner);
    for (const o of S.fighters) {
      if (!o.alive || o.team === pr.team || pr.hits.has(o.id)) continue;
      if (len(o.x - pr.x, o.y - pr.y) <= o.r + pr.r) {
        pr.hits.add(o.id);
        if (src) strike(S, src, o, pr.dmg, pr.type, { kx: pr.vx, ky: pr.vy, kb: pr.kb, status: pr.status });
        if (!pr.pierce) {
          pr.life = 0;
          S.events.push({ t: "explode", x: pr.x, y: pr.y, r: 34, type: pr.type });
          break;
        }
      }
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
        if (z.shape === "circle") S.events.push({ t: "explode", x: z.x, y: z.y, r: z.r, type: z.type });
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
        if (z.shape === "line") S.events.push({ t: "explode", x: z.x2, y: z.y2, r: 26, type: z.type });
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
