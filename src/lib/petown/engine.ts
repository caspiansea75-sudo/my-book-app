/**
 * Petown Arena battle engine: turn-based 3v3, pure logic (no React, no DOM).
 *
 * Data tables come from the Petown game files (src/data/petown.json). Each round both sides choose a move (or a switch),
 * the faster Pokémon acts first, then end-of-round effects run (status damage, weather, regen, periodic abilities).
 * Damage is the standard formula at level 50 (31 IVs, ~84 EVs). Petown forms are very strong, so HP is scaled up
 * (HP_SCALE) to keep fights readable. Every Petown ability is interpreted from the effect lists in ./abilities.ts.
 * `playRound` is a generator: it yields after every action, so the UI can play a round back step by step.
 */
import { TYPES, typeMult } from "@/lib/pokemon/shared";
import { RECOIL_MOVES, RE_SOUND, fxOf, type Boost, type Cond, type Fx, type Stat, type Status, type Weather } from "@/lib/petown/abilities";

export type { Stat, Status, Weather } from "@/lib/petown/abilities";

/* ------------------------------------------------------------------ data shapes */

/** [name, type, category (0 physical, 1 special), power, accuracy, pp] */
export type MoveRow = [string, string, 0 | 1, number, number, number];
/** [name, kind (0 = move power, 1 = stat), type, stat, multiplier, description] */
export type ItemRow = [string, 0 | 1, string, string, number, string];
/** [id, name, types, [hp, atk, def, spa, spd, spe], ability, move indexes, form (0 base, 1 mega, 2 R2, 3 ultimate), sprite id, dex number, tint hue] */
export type SpeciesRow = [number, string, string[], number[], string, number[], 0 | 1 | 2 | 3, string, number, number];
export type PetownData = { moves: MoveRow[]; items: ItemRow[]; abilities: Record<string, string>; species: SpeciesRow[] };

export const LEVEL = 50;
export const TEAM_SIZE = 3;
/** Petown forms have huge stats; more HP means a fight lasts several rounds instead of one or two hits. */
export const HP_SCALE = 2.6;
/** From this round on, both active Pokémon lose more and more HP every round, so no fight can stall forever. */
export const SUDDEN_ROUND = 30;
export const FORM_LABEL: Record<number, { bn: string; en: string }> = {
  0: { bn: "সাধারণ", en: "Base" },
  1: { bn: "মেগা", en: "Mega" },
  2: { bn: "R2", en: "R2" },
  3: { bn: "আল্টিমেট", en: "Ultimate" },
};

/* ------------------------------------------------------------------ runtime types */

export type BMove = { name: string; type: string; cat: 0 | 1; power: number; acc: number; pp: number; max: number };
type MajorStatus = "brn" | "psn" | "par" | "slp";

export type Mon = {
  uid: number;
  name: string;
  types: string[];
  form: number;
  sprite: string;
  num: number;
  hue: number;
  base: number[];
  maxHp: number;
  hp: number;
  stats: { atk: number; def: number; spa: number; spd: number; spe: number };
  /** the ability it was born with, and the one it has now (Trace can change it) */
  ability: string;
  curAbility: string;
  fxs: Fx[];
  item: ItemRow | null;
  moves: BMove[];
  fainted: boolean;
  stages: Record<Stat, number>;
  status: MajorStatus | null;
  statusT: number;
  vol: { cnf: number; inf: number };
  surviveUsed: boolean;
  beads: number;
  lastType: string;
  turn: number;
  allyDown: number;
  immuneSet: string[];
  /** lost its action this round (flinch) */
  flinched: boolean;
  /** acts before everyone else this round (Prismatic Core on entry) */
  prio: number;
};

export type Side = {
  mons: Mon[];
  active: number;
  /** the active Pokémon fainted and the player must pick a replacement */
  needSwitch: boolean;
  human: boolean;
};

export type AbilityWhat = "trigger" | "sturdy" | "absorb" | "boost" | "negate" | "trace" | "survive";
export type ChipWhy = "brn" | "psn" | "sand" | "hail" | "recoil" | "ability" | "reflect" | "confusion" | "aftermath" | "sudden";

export type Ev =
  | { id: number; k: "send"; side: 0 | 1; mon: string }
  | { id: number; k: "use"; side: 0 | 1; mon: string; move: string; type: string; cat: "physical" | "special" }
  | { id: number; k: "dmg"; side: 0 | 1; amount: number; mult: number; crit: boolean }
  | { id: number; k: "miss"; side: 0 | 1; move: string }
  | { id: number; k: "dodge"; side: 0 | 1; mon: string }
  | { id: number; k: "immune"; side: 0 | 1; mon: string }
  | { id: number; k: "heal"; side: 0 | 1; amount: number; why: string }
  | { id: number; k: "ability"; side: 0 | 1; mon: string; ability: string; what: AbilityWhat }
  | { id: number; k: "status"; side: 0 | 1; mon: string; status: Status }
  | { id: number; k: "cure"; side: 0 | 1; mon: string; why: "wake" | "cure" }
  | { id: number; k: "stage"; side: 0 | 1; mon: string; stat: Stat; n: number }
  | { id: number; k: "weather"; w: Weather | null }
  | { id: number; k: "chip"; side: 0 | 1; amount: number; why: ChipWhy }
  | { id: number; k: "skip"; side: 0 | 1; mon: string; why: "inf" | "cnf" | "par" | "slp" }
  | { id: number; k: "flinch"; side: 0 | 1; mon: string }
  | { id: number; k: "reveal"; side: 0 | 1; mon: string; what: "item" | "move" | "danger"; value: string }
  | { id: number; k: "trapped"; side: 0 | 1; by: string }
  | { id: number; k: "faint"; side: 0 | 1; mon: string }
  | { id: number; k: "end"; winner: 0 | 1 };

export type Battle = {
  sides: [Side, Side];
  /** weather and how many rounds it has left */
  weather: { w: Weather | null; t: number };
  round: number;
  moved: [boolean, boolean];
  seq: number;
  winner: -1 | 0 | 1;
  difficulty: Difficulty;
  stats: { hits: number; crits: number; maxHit: number; kos: number; lost: number };
};

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTY: Record<Difficulty, { bn: string; en: string; smart: number; rate: number; bst: number }> = {
  easy: { bn: "সহজ", en: "Easy", smart: 0.3, rate: 0.9, bst: 0.95 },
  normal: { bn: "মাঝারি", en: "Normal", smart: 0.7, rate: 1, bst: 1 },
  hard: { bn: "কঠিন", en: "Hard", smart: 0.95, rate: 1.08, bst: 1.06 },
};

/* ------------------------------------------------------------------ small helpers */

const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0);
export const activeOf = (b: Battle, s: 0 | 1) => b.sides[s].mons[b.sides[s].active];
export const alive = (side: Side) => side.mons.filter((m) => !m.fainted).length;
const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const inT = (t: string | string[] | undefined, x: string) => (t === undefined ? true : Array.isArray(t) ? t.includes(x) : t === x);
const stageMul = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));
const accStage = (n: number) => (n >= 0 ? (3 + n) / 3 : 3 / (3 - n));
const isSun = (w: Weather | null) => w === "sun" || w === "harshsun";
const isRain = (w: Weather | null) => w === "rain" || w === "heavyrain";
const primal = (w: Weather | null) => w === "harshsun" || w === "heavyrain" || w === "wind";
const calcStat = (base: number) => Math.floor(((2 * base + 31 + 21) * LEVEL) / 100) + 5;
const calcHp = (base: number) => Math.round((Math.floor(((2 * base + 31 + 21) * LEVEL) / 100) + LEVEL + 10) * HP_SCALE);
const ofType = <K extends Fx["t"]>(m: Mon, t: K) => m.fxs.filter((f) => f.t === t) as Extract<Fx, { t: K }>[];
const hasFx = (m: Mon, t: Fx["t"]) => m.fxs.some((f) => f.t === t);
/** The foe's ability effects, unless the attacker ignores abilities. */
const guardFx = (att: Mon, def: Mon): Fx[] => (hasFx(att, "ignoreAbility") ? [] : def.fxs);

export const bst = (s: SpeciesRow) => s[3].reduce((a, b) => a + b, 0);

/** The weather that is really in force (Cloud Nine / Air Lock cancel it). */
export function activeWeather(b: Battle): Weather | null {
  if (b.weather.w === null) return null;
  for (const s of [0, 1] as const) {
    const m = activeOf(b, s);
    if (!m.fainted && hasFx(m, "noWeather")) return null;
  }
  return b.weather.w;
}

function condOk(c: Cond | undefined, m: Mon, foe: Mon | null, w: Weather | null): boolean {
  switch (c) {
    case undefined: return true;
    case "low": return m.hp <= m.maxHp / 3;
    case "hp50": return m.hp <= m.maxHp / 2;
    case "hp60": return m.hp <= m.maxHp * 0.6;
    case "full": return m.hp === m.maxHp;
    case "sun": return isSun(w);
    case "rain": return isRain(w);
    case "sand": return w === "sand";
    case "hail": return w === "hail";
    case "status": return m.status !== null;
    case "behind": return foe !== null && m.hp < foe.hp;
    case "foeSlp": return foe !== null && foe.status === "slp";
    case "cnf": return m.vol.cnf > 0;
    case "noItem": return m.item === null;
  }
}

/** Items a Pokémon may carry: stat items need a matching type; power items work for any holder. */
export function itemsFor(data: PetownData, sp: SpeciesRow): ItemRow[] {
  return data.items.filter((it) => (it[1] === 1 ? sp[2].includes(it[2]) : true));
}

let uidSeq = 1;
export function makeMon(data: PetownData, sp: SpeciesRow, item: ItemRow | null): Mon {
  const [, name, types, st, ability, moveIdx, form, sprite, num, hue] = sp;
  const maxHp = calcHp(st[0]);
  return {
    uid: uidSeq++,
    name,
    types,
    form,
    sprite,
    num,
    hue: hue ?? 0,
    base: st,
    maxHp,
    hp: maxHp,
    stats: { atk: calcStat(st[1]), def: calcStat(st[2]), spa: calcStat(st[3]), spd: calcStat(st[4]), spe: calcStat(st[5]) },
    ability,
    curAbility: ability,
    fxs: fxOf(ability),
    item,
    moves: moveIdx.map((i) => {
      const m = data.moves[i];
      return { name: m[0], type: m[1], cat: m[2], power: m[3], acc: m[4], pp: m[5], max: m[5] };
    }),
    fainted: false,
    stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 },
    status: null,
    statusT: 0,
    vol: { cnf: 0, inf: 0 },
    surviveUsed: false,
    beads: 0,
    lastType: "",
    turn: 0,
    allyDown: 0,
    immuneSet: [],
    flinched: false,
    prio: 0,
  };
}

/** A CPU team of `size` Pokémon whose total strength is close to `targetBst` × difficulty. */
export function cpuTeam(data: PetownData, targetBst: number, diff: Difficulty, size = TEAM_SIZE, avoid: number[] = []): Mon[] {
  const want = targetBst * DIFFICULTY[diff].bst;
  const pool = data.species.filter((s) => !avoid.includes(s[0]) && Math.abs(bst(s) - want) <= want * 0.1);
  const src = pool.length >= size ? pool : data.species.filter((s) => !avoid.includes(s[0]));
  const out: Mon[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (out.length < size && guard++ < 200) {
    const s = src[Math.floor(Math.random() * src.length)];
    if (used.has(s[0])) continue;
    used.add(s[0]);
    const opts = itemsFor(data, s);
    const item = opts.length && Math.random() < 0.7 ? opts[Math.floor(Math.random() * opts.length)] : null;
    out.push(makeMon(data, s, item));
  }
  return out;
}

/* ------------------------------------------------------------------ stats & damage */

type Ctx = { w: Weather | null; foe: Mon };

/** A stat after stages, ability, item, status and weather. */
export function effStat(m: Mon, key: "atk" | "def" | "spa" | "spd" | "spe", ctx: Ctx, ignorePos = false): number {
  const st = ignorePos ? Math.min(0, m.stages[key]) : m.stages[key];
  let v = m.stats[key] * stageMul(st);
  const jam = hasFx(ctx.foe, "itemJam");
  if (m.item && m.item[1] === 1 && m.item[3] === key && m.types.includes(m.item[2]) && !jam) v *= m.item[4];
  for (const f of ofType(m, "stat")) if (f.s === key && condOk(f.cond, m, ctx.foe, ctx.w)) v *= f.m;
  if (hasFx(m, "bond")) v *= 1 + Math.min(0.1, 0.02 * m.allyDown);
  if (key === "atk" && m.status === "brn" && !m.fxs.some((f) => f.t === "stat" && f.s === "atk" && f.cond === "status")) v *= 0.5;
  if (key === "spe" && m.status === "par") v *= 0.5;
  return v;
}

export type DamageInfo = { min: number; max: number; mult: number; immune: boolean; absorbs: boolean; heal?: number; boost?: Boost; type: string };

/** Type a move really has (Aerilate and friends change Normal moves). */
function moveType(att: Mon, mv: BMove): { type: string; m: number } {
  if (mv.type === "Normal") {
    const cv = ofType(att, "convert")[0];
    if (cv) return { type: cv.to, m: cv.m };
  }
  return { type: mv.type, m: 1 };
}

/** Damage range of `mv` from `att` onto `def` (crit not included). */
export function damageRange(att: Mon, def: Mon, mv: BMove, w: Weather | null): DamageInfo {
  const afx = att.fxs;
  const dfx = guardFx(att, def);
  const { type: mType, m: convM } = moveType(att, mv);

  const scrappy = hasFx(att, "scrappy") && (mType === "Normal" || mType === "Fighting");
  let mult = 1;
  for (const dt of def.types) {
    let tm = typeMult(mType, [dt]);
    if (dt === "Ghost" && scrappy) tm = 1;
    if (dt === "Flying" && w === "wind" && tm > 1) tm = 1;
    mult *= tm;
  }
  for (const f of dfx) if (f.t === "capEff" && inT(f.type, mType)) mult = Math.min(mult, f.max);
  if (mult > 0) for (const f of afx) if (f.t === "minEff" && inT(f.type, mType)) mult = Math.max(mult, f.min);

  const none = (extra?: Partial<DamageInfo>): DamageInfo => ({ min: 0, max: 0, mult, immune: true, absorbs: false, type: mType, ...extra });
  if (mult === 0) return none();
  for (const f of dfx) {
    if (f.t === "immune" && inT(f.type, mType)) return none({ absorbs: !!(f.heal || f.boost), heal: f.heal, boost: f.boost });
    if (f.t === "soundproof" && RE_SOUND.test(mv.name)) return none();
  }
  if (!hasFx(att, "ignoreAbility") && def.immuneSet.includes(mType)) return none();
  if (w === "harshsun" && mType === "Water") return none();
  if (w === "heavyrain" && mType === "Fire") return none();

  /* power */
  let power = mv.power * convM;
  const jam = hasFx(def, "itemJam");
  if (att.item && att.item[1] === 0 && att.item[2] === mType && !jam) power *= att.item[4];
  for (const f of afx) {
    if (f.t !== "dmg") continue;
    if (f.type && !inT(f.type, mType)) continue;
    if (f.cat !== undefined && f.cat !== mv.cat) continue;
    if (f.maxPow && mv.power > f.maxPow) continue;
    if (f.name && !f.name.test(mv.name)) continue;
    if (f.se && !(mult > 1)) continue;
    if (f.nve && !(mult < 1)) continue;
    if (f.vs && def.status !== f.vs) continue;
    if (f.after && !(att.lastType && att.lastType !== "Electric")) continue;
    if (!condOk(f.cond, att, def, w)) continue;
    power *= f.m;
  }
  if (isSun(w)) power *= mType === "Fire" ? 1.5 : mType === "Water" ? 0.5 : 1;
  else if (isRain(w)) power *= mType === "Water" ? 1.5 : mType === "Fire" ? 0.5 : 1;
  const all = [...afx, ...def.fxs];
  const breaker = all.some((f) => f.t === "auraBreak");
  for (const f of all) if (f.t === "aura" && f.type === mType) power *= breaker ? 0.75 : f.m;

  /* stats */
  const physical = mv.cat === 0;
  const ctxA: Ctx = { w, foe: def };
  const ctxD: Ctx = { w, foe: att };
  const pierce = afx.some((f) => f.t === "pierce" && inT(f.type, mType));
  const best = afx.some((f) => f.t === "bestAtk" && inT(f.type, mType));
  const A = best ? Math.max(effStat(att, "atk", ctxA), effStat(att, "spa", ctxA)) : effStat(att, physical ? "atk" : "spa", ctxA);
  let D = effStat(def, physical ? "def" : "spd", ctxD, pierce);
  if (w === "sand" && !physical && def.types.includes("Rock")) D *= 1.5;

  let dmg = Math.floor(Math.floor(((Math.floor((2 * LEVEL) / 5) + 2) * power * A) / Math.max(1, D)) / 50) + 2;
  let stab = att.types.includes(mType) ? 1.5 : 1;
  for (const f of afx) {
    if (f.t !== "stab") continue;
    if (!(f.always || att.types.includes(mType))) continue;
    if (f.type && !inT(f.type, mType)) continue;
    stab = Math.max(stab, f.m);
  }
  dmg *= stab * mult;
  for (const f of dfx) {
    if (f.t !== "taken") continue;
    if (f.type && !inT(f.type, mType)) continue;
    if (f.except && inT(f.except, mType)) continue;
    if (f.cat !== undefined && f.cat !== mv.cat) continue;
    if (f.se && !(mult > 1)) continue;
    if (!condOk(f.cond, def, att, w)) continue;
    dmg *= f.m;
  }
  return { min: Math.max(1, Math.floor(dmg * 0.85)), max: Math.max(1, Math.floor(dmg)), mult, immune: false, absorbs: false, type: mType };
}

function hitChance(att: Mon, def: Mon, mv: BMove, mType: string): number {
  if (hasFx(att, "noMiss")) return 100;
  let acc = mv.acc;
  for (const f of ofType(att, "acc")) if (f.cat === undefined || f.cat === mv.cat) acc *= f.m;
  for (const f of [...att.fxs, ...def.fxs]) if (f.t === "accField" && inT(f.type, mType)) acc *= f.m;
  acc *= accStage(att.stages.acc) / accStage(def.stages.eva);
  return Math.min(100, acc);
}

const STRUGGLE: BMove = { name: "Struggle", type: "Normal", cat: 0, power: 50, acc: 100, pp: 1, max: 1 };

/* ------------------------------------------------------------------ battle flow */

export function newBattle(player: Mon[], foe: Mon[], difficulty: Difficulty): Battle {
  const mk = (mons: Mon[], human: boolean): Side => ({ mons, active: 0, needSwitch: false, human });
  return {
    sides: [mk(player, true), mk(foe, false)],
    weather: { w: null, t: 0 },
    round: 0,
    moved: [false, false],
    seq: 1,
    winner: -1,
    difficulty,
    stats: { hits: 0, crits: 0, maxHit: 0, kos: 0, lost: 0 },
  };
}

function heal(b: Battle, s: 0 | 1, amount: number, why: string, out: Ev[]) {
  const m = activeOf(b, s);
  if (m.fainted) return;
  const boost = ofType(m, "healBoost").reduce((a, f) => a * f.m, 1);
  const n = Math.min(m.maxHp - m.hp, Math.max(0, Math.floor(amount * boost)));
  if (n <= 0) return;
  m.hp += n;
  out.push({ id: b.seq++, k: "heal", side: s, amount: n, why });
}

function note(b: Battle, s: 0 | 1, m: Mon, ability: string, what: AbilityWhat, out: Ev[]) {
  out.push({ id: b.seq++, k: "ability", side: s, mon: m.name, ability, what });
}

/** Stat-stage change on side `ts`. `src` is the side that caused it (null = the Pokémon itself). */
function applyBoost(b: Battle, ts: 0 | 1, bo: Boost, out: Ev[], src: 0 | 1 | null) {
  const m = activeOf(b, ts);
  if (m.fainted) return;
  const list = Array.isArray(bo.s) ? (bo.any ? [rand(bo.s)] : bo.s) : [bo.s];
  const cap = bo.cap ?? 6;
  for (const s of list) {
    const cur = m.stages[s];
    if (bo.n < 0 && src !== null && src !== ts) {
      const blocked = !hasFx(activeOf(b, src), "ignoreAbility") && m.fxs.some((f) => f.t === "noDrop" && (!f.stats || f.stats.includes(s)) && (!f.ifType || m.types.includes(f.ifType)));
      if (blocked) continue;
    }
    if ((bo.n > 0 && cur >= cap) || (bo.n < 0 && cur <= -cap)) continue;
    const nx = Math.max(-cap, Math.min(cap, cur + bo.n));
    if (nx === cur) continue;
    m.stages[s] = nx;
    out.push({ id: b.seq++, k: "stage", side: ts, mon: m.name, stat: s, n: nx - cur });
    if (bo.n < 0 && src !== null && src !== ts) for (const f of ofType(m, "onDropped")) applyBoost(b, ts, f.boost, out, null);
  }
}

function setWeather(b: Battle, w: Weather, out: Ev[]) {
  if (primal(b.weather.w) && !primal(w)) return;
  if (b.weather.w === w) return;
  b.weather = { w, t: primal(w) ? Infinity : 5 };
  out.push({ id: b.seq++, k: "weather", w });
}

/** Inflict a status (or volatile condition). Returns true if it stuck. */
function inflict(b: Battle, ts: 0 | 1, st: Status, out: Ev[], src: 0 | 1 | null, fromHit: boolean): boolean {
  const m = activeOf(b, ts);
  if (m.fainted) return false;
  const srcMon = src === null ? null : activeOf(b, src);
  const w = activeWeather(b);
  const fx = srcMon && hasFx(srcMon, "ignoreAbility") ? [] : m.fxs;
  if (fromHit && fx.some((f) => f.t === "shieldDust")) return false;
  for (const f of fx) {
    if (f.t !== "statusImmune") continue;
    if (!condOk(f.cond, m, srcMon, w)) continue;
    if (f.list.includes("all") || f.list.includes(st)) return false;
  }
  if (st === "cnf" || st === "inf") {
    if (m.vol[st] > 0) return false;
    m.vol[st] = 3;
    out.push({ id: b.seq++, k: "status", side: ts, mon: m.name, status: st });
    return true;
  }
  if (m.status) return false;
  if (st === "brn" && m.types.includes("Fire")) return false;
  if (st === "psn" && (m.types.includes("Poison") || m.types.includes("Steel"))) return false;
  if (st === "par" && m.types.includes("Electric")) return false;
  m.status = st;
  // sleep: the number of its own turns it needs to wake (it wakes and acts when this runs out)
  m.statusT = st === "slp" ? (hasFx(m, "sleepFast") ? 2 : 3) : 0;
  out.push({ id: b.seq++, k: "status", side: ts, mon: m.name, status: st });
  if (srcMon && !srcMon.fainted && hasFx(m, "sync") && (st === "brn" || st === "psn" || st === "par")) inflict(b, src!, st, out, null, false);
  return true;
}

function cureStatus(b: Battle, s: 0 | 1, why: "wake" | "cure", out: Ev[]) {
  const m = activeOf(b, s);
  if (!m.status) return;
  m.status = null;
  m.statusT = 0;
  out.push({ id: b.seq++, k: "cure", side: s, mon: m.name, why });
}

function chip(b: Battle, s: 0 | 1, amount: number, why: ChipWhy, out: Ev[]) {
  const m = activeOf(b, s);
  if (m.fainted || amount <= 0) return;
  const n = Math.min(m.hp, Math.max(1, Math.floor(amount)));
  m.hp -= n;
  out.push({ id: b.seq++, k: "chip", side: s, amount: n, why });
  if (m.hp <= 0) faintMon(b, s, null, out);
}

/** A Pokémon has fallen. `att` is who dealt the final blow (if any). */
function faintMon(b: Battle, ts: 0 | 1, att: { side: 0 | 1; contact: boolean } | null, out: Ev[]) {
  const m = activeOf(b, ts);
  m.hp = 0;
  m.fainted = true;
  out.push({ id: b.seq++, k: "faint", side: ts, mon: m.name });
  const dside = b.sides[ts];
  for (const o of dside.mons) if (o !== m) o.allyDown += 1;
  if (att) {
    if (att.side === 0) b.stats.kos += 1;
    else b.stats.lost += 1;
    const a = activeOf(b, att.side);
    if (att.contact && !a.fainted && !hasFx(a, "ignoreAbility")) {
      for (const f of ofType(m, "aftermath")) if (!hasFx(a, "noChip")) chip(b, att.side, a.maxHp * f.frac, "aftermath", out);
    }
    if (!a.fainted) {
      for (const f of ofType(a, "ko")) {
        if (f.boost === "best") {
          const keys: ("atk" | "def" | "spa" | "spd" | "spe")[] = ["atk", "def", "spa", "spd", "spe"];
          const top = keys.reduce((x, y) => (a.stats[y] > a.stats[x] ? y : x));
          applyBoost(b, att.side, { s: top, n: 1 }, out, null);
        } else applyBoost(b, att.side, f.boost, out, null);
      }
    }
  }
  if (alive(dside) === 0 && b.winner === -1) {
    b.winner = other(ts);
    out.push({ id: b.seq++, k: "end", winner: other(ts) });
  }
}

/** Events that happen on entry (Trace, weather, boosts, Intimidate, reveals). */
export function enter(b: Battle, s: 0 | 1, out: Ev[]) {
  const me = activeOf(b, s);
  const foe = activeOf(b, other(s));
  me.turn = 0;
  me.flinched = false;
  out.push({ id: b.seq++, k: "send", side: s, mon: me.name });

  if (hasFx(me, "trace") && !foe.fainted && foe.curAbility && !hasFx(foe, "trace") && fxOf(foe.curAbility).length) {
    me.curAbility = foe.curAbility;
    me.fxs = fxOf(foe.curAbility);
    note(b, s, me, foe.curAbility, "trace", out);
  }
  for (const f of me.fxs) {
    if (f.t === "weather") {
      note(b, s, me, me.curAbility, "trigger", out);
      setWeather(b, f.w, out);
    } else if (f.t === "enter") {
      if (f.p && Math.random() > f.p) continue;
      note(b, s, me, me.curAbility, "trigger", out);
      for (const bo of f.self ?? []) applyBoost(b, s, bo, out, null);
      if (!foe.fainted) for (const bo of f.foe ?? []) applyBoost(b, other(s), bo, out, s);
      if (f.gauge) me.prio = 1;
      if (f.reveal && !foe.fainted) {
        let value = "";
        if (f.reveal === "item") value = foe.item?.[0] ?? "";
        else if (f.reveal === "move") value = [...foe.moves].sort((x, y) => damageRange(foe, me, y, null).max - damageRange(foe, me, x, null).max)[0]?.name ?? "";
        else value = foe.moves.some((mv) => damageRange(foe, me, mv, null).mult > 1) ? "yes" : "no";
        out.push({ id: b.seq++, k: "reveal", side: s, mon: me.name, what: f.reveal, value });
      }
    } else if (f.t === "download" && !foe.fainted) {
      note(b, s, me, me.curAbility, "trigger", out);
      applyBoost(b, s, { s: foe.stats.def < foe.stats.spd ? "atk" : "spa", n: 1 }, out, null);
    }
  }
}

export function startBattle(b: Battle): Ev[] {
  const out: Ev[] = [];
  enter(b, 0, out);
  enter(b, 1, out);
  return out;
}

/** Strongest-looking replacement versus the foe's current Pokémon. */
export function bestReplacement(b: Battle, s: 0 | 1): number {
  const side = b.sides[s];
  const foe = activeOf(b, other(s));
  const w = activeWeather(b);
  let best = -1;
  let score = -1;
  side.mons.forEach((m, i) => {
    if (m.fainted || i === side.active) return;
    const sc = Math.max(...m.moves.map((mv) => damageRange(m, foe, mv, w).max)) + m.hp * 0.2;
    if (sc > score) { score = sc; best = i; }
  });
  return best;
}

/** Can the player switch to `idx` right now (without spending anything)? */
export function canSwitch(b: Battle, s: 0 | 1, idx: number): "ok" | "trapped" | "invalid" {
  const side = b.sides[s];
  const m = side.mons[idx];
  const cur = activeOf(b, s);
  if (!m || m.fainted || (idx === side.active && !cur.fainted)) return "invalid";
  const foe = activeOf(b, other(s));
  if (!cur.fainted && !foe.fainted && hasFx(foe, "trap") && !hasFx(cur, "ignoreAbility")) return "trapped";
  return "ok";
}

/** Switch the active Pokémon. */
export function switchTo(b: Battle, s: 0 | 1, idx: number, out: Ev[]): boolean {
  const verdict = canSwitch(b, s, idx);
  if (verdict === "trapped") {
    out.push({ id: b.seq++, k: "trapped", side: s, by: activeOf(b, other(s)).name });
    return false;
  }
  if (verdict !== "ok") return false;
  const side = b.sides[s];
  const cur = activeOf(b, s);
  if (!cur.fainted) {
    for (const f of ofType(cur, "switchOut")) {
      if (f.cure && cur.status) { cur.status = null; cur.statusT = 0; }
      if (f.heal) cur.hp = Math.min(cur.maxHp, cur.hp + Math.floor(cur.maxHp * f.heal));
    }
    cur.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
    cur.vol = { cnf: 0, inf: 0 };
    cur.prio = 0;
  }
  side.active = idx;
  side.needSwitch = false;
  enter(b, s, out);
  return true;
}

/** Checks that can make a Pokémon lose its action (flinch, sleep, paralysis). Returns true if it may act. */
function canAct(b: Battle, s: 0 | 1, out: Ev[]): boolean {
  const m = activeOf(b, s);
  if (m.flinched) {
    m.flinched = false;
    out.push({ id: b.seq++, k: "flinch", side: s, mon: m.name });
    for (const g of ofType(m, "onFlinch")) applyBoost(b, s, g.boost, out, null);
    return false;
  }
  if (m.status === "slp") {
    m.statusT -= 1;
    if (m.statusT > 0) { out.push({ id: b.seq++, k: "skip", side: s, mon: m.name, why: "slp" }); return false; }
    cureStatus(b, s, "wake", out);
  }
  if (m.status === "par" && Math.random() < 0.25) {
    out.push({ id: b.seq++, k: "skip", side: s, mon: m.name, why: "par" });
    return false;
  }
  return true;
}

/** One Pokémon uses move `i` on the other. */
function performMove(b: Battle, s: 0 | 1, i: number, out: Ev[]): void {
  const att = activeOf(b, s);
  const ts = other(s);
  const def = activeOf(b, ts);
  if (b.winner !== -1 || att.fainted || def.fainted) return;
  const w = activeWeather(b);
  const hasPp = att.moves.some((m) => m.pp > 0);
  const mv = hasPp ? att.moves[i] : STRUGGLE;
  if (!mv || (hasPp && mv.pp <= 0)) return;
  const dfx = guardFx(att, def);
  if (hasPp) {
    const extra = dfx.reduce((a, f) => a + (f.t === "pressure" ? f.n : 0), 0);
    mv.pp = Math.max(0, mv.pp - 1 - extra);
  }
  out.push({ id: b.seq++, k: "use", side: s, mon: att.name, move: mv.name, type: moveType(att, mv).type, cat: mv.cat === 0 ? "physical" : "special" });

  if (att.vol.inf > 0 && Math.random() < 0.5) { out.push({ id: b.seq++, k: "skip", side: s, mon: att.name, why: "inf" }); return; }
  if (att.vol.cnf > 0 && Math.random() < 0.33) {
    out.push({ id: b.seq++, k: "skip", side: s, mon: att.name, why: "cnf" });
    const dmg = Math.floor(Math.floor((Math.floor((2 * LEVEL) / 5) + 2) * 40 * effStat(att, "atk", { w, foe: def })) / Math.max(1, effStat(att, "def", { w, foe: def })) / 50) + 2;
    chip(b, s, dmg, "confusion", out);
    return;
  }

  const { type: mType } = moveType(att, mv);
  if (Math.random() * 100 >= hitChance(att, def, mv, mType)) {
    att.lastType = mType;
    out.push({ id: b.seq++, k: "miss", side: s, move: mv.name });
    return;
  }
  for (const f of dfx) {
    if (f.t === "dodge" && condOk(f.cond, def, att, w) && Math.random() < f.p) {
      att.lastType = mType;
      out.push({ id: b.seq++, k: "dodge", side: ts, mon: def.name });
      return;
    }
  }

  const info = damageRange(att, def, mv, w);
  att.lastType = mType;
  if (info.immune) {
    out.push({ id: b.seq++, k: "immune", side: ts, mon: def.name });
    if (info.heal) { heal(b, ts, def.maxHp * info.heal, def.curAbility, out); note(b, ts, def, def.curAbility, "absorb", out); }
    if (info.boost) { applyBoost(b, ts, info.boost, out, null); note(b, ts, def, def.curAbility, "boost", out); }
    return;
  }
  for (const f of dfx) {
    if (f.t === "negate" && Math.random() < f.p) {
      const drain = Math.min(att.hp - 1, Math.floor(att.hp * f.drainCur));
      if (drain > 0) { att.hp -= drain; heal(b, ts, drain, def.curAbility, out); }
      note(b, ts, def, def.curAbility, "negate", out);
      return;
    }
  }

  /* critical hit */
  const critStage = Math.min(3, ofType(att, "crit").reduce((a, f) => a + f.n, 0));
  const critChance = dfx.some((f) => f.t === "noCrit") ? 0 : [1 / 16, 1 / 8, 1 / 2, 1][critStage];
  const crit = Math.random() < critChance;
  const critMul = crit ? 1.5 * ofType(att, "critDmg").reduce((a, f) => a * f.m, 1) : 1;
  const roll = 0.85 + Math.random() * 0.15;
  let dmg = Math.max(1, Math.floor(((info.max + info.min) / 2 / 0.925) * roll * critMul));

  /* survive a fatal hit */
  if (dmg >= def.hp) {
    for (const f of dfx) {
      if (f.t !== "survive" || def.surviveUsed) continue;
      const ok = f.cond === "any" || (f.cond === "full" && def.hp === def.maxHp) || (f.cond === "crit" && crit);
      if (!ok) continue;
      def.surviveUsed = true;
      dmg = def.hp - 1;
      note(b, ts, def, def.curAbility, "survive", out);
      break;
    }
  }
  dmg = Math.min(def.hp, dmg);
  def.hp -= dmg;
  out.push({ id: b.seq++, k: "dmg", side: ts, amount: dmg, mult: info.mult, crit });
  if (s === 0) {
    b.stats.hits += 1;
    if (crit) b.stats.crits += 1;
    b.stats.maxHit = Math.max(b.stats.maxHit, dmg);
  }
  const contact = mv.cat === 0;
  const serene = hasFx(att, "serene") ? 2 : 1;
  const chancePass = (p: number | undefined) => p === undefined || Math.random() < Math.min(1, p * serene);

  const fainted = def.hp <= 0;
  if (fainted) faintMon(b, ts, { side: s, contact }, out);

  /* defender's reactions (it may be gone, but reflect still applies) */
  if (!fainted) {
    for (const f of dfx) {
      if (f.t !== "onHurt") continue;
      if (f.contact && !contact) continue;
      if (f.type && !inT(f.type, mType)) continue;
      if (f.crit && !crit) continue;
      if (f.moveName && f.moveName !== mv.name) continue;
      if (f.p !== undefined && Math.random() >= f.p) continue;
      for (const bo of f.self ?? []) applyBoost(b, ts, bo, out, null);
      if (f.heal) heal(b, ts, def.maxHp * f.heal, def.curAbility, out);
      if (f.healDmg) heal(b, ts, dmg * f.healDmg, def.curAbility, out);
      if (f.beads) {
        def.beads += 1;
        if (def.beads >= f.beads) { def.beads = 0; if (!hasFx(att, "noChip")) chip(b, s, att.maxHp * (f.blast ?? 0.2), "ability", out); }
      }
      if (f.status) inflict(b, s, Array.isArray(f.status) ? rand(f.status) : f.status, out, ts, false);
      if (f.foe) applyBoost(b, s, f.foe, out, ts);
      if (f.reflect && !hasFx(att, "noChip")) chip(b, s, dmg * f.reflect, "reflect", out);
      if (f.reflectMax && !hasFx(att, "noChip")) chip(b, s, att.maxHp * f.reflectMax, "reflect", out);
    }
  } else {
    for (const f of dfx) if (f.t === "onHurt" && f.reflect && !f.contact && (!f.type || inT(f.type, mType)) && !hasFx(att, "noChip")) chip(b, s, dmg * f.reflect, "reflect", out);
  }

  /* attacker's follow-ups */
  if (!att.fainted && b.winner === -1) {
    for (const f of att.fxs) {
      if (f.t !== "onHit") continue;
      if (f.type && !inT(f.type, mType)) continue;
      if (f.cat !== undefined && f.cat !== mv.cat) continue;
      if (!chancePass(f.p)) continue;
      if (f.self) applyBoost(b, s, f.self, out, null);
      if (f.drain) heal(b, s, dmg * f.drain, att.curAbility, out);
      if (def.fainted) continue;
      if (f.status) inflict(b, ts, Array.isArray(f.status) ? rand(f.status) : f.status, out, s, true);
      if (f.foe && !dfx.some((x) => x.t === "shieldDust")) applyBoost(b, ts, f.foe, out, s);
      if (f.clearFoeBoosts) for (const k of Object.keys(def.stages) as Stat[]) if (def.stages[k] > 0) def.stages[k] = 0;
      if (f.flinch && !b.moved[ts] && !dfx.some((x) => x.t === "shieldDust") && !dfx.some((x) => x.t === "statusImmune" && x.list.includes("fln"))) def.flinched = true;
      if (f.extra && !def.fainted) {
        const extra = Math.min(def.hp, Math.max(1, Math.floor(dmg * 0.5)));
        def.hp -= extra;
        out.push({ id: b.seq++, k: "dmg", side: ts, amount: extra, mult: info.mult, crit: false });
        if (def.hp <= 0) faintMon(b, ts, { side: s, contact }, out);
      }
    }
    const rc = RECOIL_MOVES[mv.name];
    if (rc && !hasFx(att, "noRecoil") && !hasFx(att, "noChip") && b.winner === -1) chip(b, s, Math.max(1, dmg * rc), "recoil", out);
  }
}

/** Move the CPU (or auto-pilot) would pick. */
export function chooseMove(b: Battle, s: 0 | 1, smart: number): number {
  const att = activeOf(b, s);
  const def = activeOf(b, other(s));
  const w = activeWeather(b);
  const scored = att.moves.map((mv, i) => {
    if (mv.pp <= 0) return { i, v: -1 };
    const r = damageRange(att, def, mv, w);
    const v = r.immune ? (r.absorbs ? -2 : 0) : ((r.min + r.max) / 2) * (Math.min(100, mv.acc) / 100);
    return { i, v };
  });
  const usable = scored.filter((x) => x.v >= 0);
  if (!usable.length) return 0;
  if (Math.random() < smart) return usable.sort((x, y) => y.v - x.v)[0].i;
  return usable[Math.floor(Math.random() * usable.length)].i;
}

/** What the CPU does this round. */
function cpuChoice(b: Battle): Choice {
  const smart = DIFFICULTY[b.difficulty].smart;
  const me = activeOf(b, 1);
  const foe = activeOf(b, 0);
  // a clever opponent steps out when nothing it knows can hurt the foe
  if (smart >= 0.9 && alive(b.sides[1]) > 1 && Math.random() < 0.5) {
    const w = activeWeather(b);
    const best = Math.max(...me.moves.map((mv) => damageRange(me, foe, mv, w).max));
    if (best === 0) {
      const r = bestReplacement(b, 1);
      if (r >= 0 && canSwitch(b, 1, r) === "ok") return { kind: "switch", idx: r };
    }
  }
  return { kind: "move", i: chooseMove(b, 1, smart) };
}

/** The player's auto-pilot choice. */
export function autoChoice(b: Battle): Choice {
  return { kind: "move", i: chooseMove(b, 0, 0.9) };
}

/** Everything that happens at the end of a round for the side's active Pokémon. */
function endTurn(b: Battle, s: 0 | 1, out: Ev[]) {
  const me = activeOf(b, s);
  const foe = activeOf(b, other(s));
  if (me.fainted) return;
  const w = activeWeather(b);
  me.turn += 1;
  if (me.vol.cnf > 0) me.vol.cnf -= 1;
  if (me.vol.inf > 0) me.vol.inf -= 1;

  // sudden death: nobody gets to stall forever
  if (b.round >= SUDDEN_ROUND) {
    // 6% at first, then 2% more every round, so even the strongest healing ability is outpaced
    chip(b, s, me.maxHp * (0.06 + 0.02 * (b.round - SUDDEN_ROUND)), "sudden", out);
    if (me.fainted || b.winner !== -1) return;
  }
  if (!hasFx(me, "noChip")) {
    if (me.status === "brn") chip(b, s, me.maxHp / 16, "brn", out);
    else if (me.status === "psn") chip(b, s, me.maxHp / 10, "psn", out);
    if (me.fainted || b.winner !== -1) return;
    if (w === "sand" && !me.types.some((t) => t === "Rock" || t === "Ground" || t === "Steel")) chip(b, s, me.maxHp / 16, "sand", out);
    else if (w === "hail" && !me.types.includes("Ice")) chip(b, s, me.maxHp / 16, "hail", out);
    if (me.fainted || b.winner !== -1) return;
  }
  for (const f of ofType(me, "randImmune")) me.immuneSet = [...TYPES].sort(() => Math.random() - 0.5).slice(0, f.n);
  for (const f of me.fxs) {
    if (me.fainted || b.winner !== -1) return;
    if (f.t === "cure") {
      if (me.status && condOk(f.cond, me, foe, w) && (f.p === undefined || Math.random() < f.p)) cureStatus(b, s, "cure", out);
    } else if (f.t === "tick") {
      if (me.turn % (f.every ?? 1) !== 0) continue;
      if (!condOk(f.cond, me, foe, w)) continue;
      if (f.ifType && !me.types.includes(f.ifType)) continue;
      if (f.ifFoeNot && foe.types.includes(f.ifFoeNot)) continue;
      if (f.p !== undefined && Math.random() >= f.p) continue;
      if (f.heal) heal(b, s, me.maxHp * f.heal, me.curAbility, out);
      if (f.selfHurt && !hasFx(me, "noChip")) chip(b, s, me.maxHp * f.selfHurt, "ability", out);
      if (foe.fainted) continue;
      if (f.foeHurt && !hasFx(foe, "noChip")) chip(b, other(s), foe.maxHp * f.foeHurt, "ability", out);
      for (const bo of f.self ?? []) applyBoost(b, s, bo, out, null);
      if (f.foe) applyBoost(b, other(s), f.foe, out, s);
      if (f.download) applyBoost(b, s, { s: foe.stats.def < foe.stats.spd ? "atk" : "spa", n: 1, cap: 3 }, out, null);
    }
  }
}

/* ------------------------------------------------------------------ rounds */

export type Choice = { kind: "move"; i: number } | { kind: "switch"; idx: number };

/** Who acts first: priority, then Speed (stages, status, abilities), then a coin flip. */
function turnOrder(b: Battle, choices: [Choice, Choice]): (0 | 1)[] {
  const w = activeWeather(b);
  const key = (s: 0 | 1) => {
    const m = activeOf(b, s);
    const sp = ofType(m, "speed").reduce((a, f) => a * f.m, 1);
    return { prio: m.prio, spe: effStat(m, "spe", { w, foe: activeOf(b, other(s)) }) * sp };
  };
  const k0 = key(0);
  const k1 = key(1);
  void choices;
  if (k0.prio !== k1.prio) return k0.prio > k1.prio ? [0, 1] : [1, 0];
  if (k0.spe !== k1.spe) return k0.spe > k1.spe ? [0, 1] : [1, 0];
  return Math.random() < 0.5 ? [0, 1] : [1, 0];
}

/**
 * Plays one round. It is a generator: every `yield` is one step (a switch, an attack, the end-of-round effects) and
 * the Battle is already updated to that point, so the UI can show each step with its own pause.
 */
export function* playRound(b: Battle, player: Choice): Generator<Ev[], void, void> {
  const out: Ev[] = [];
  const flush = () => out.splice(0, out.length);
  b.round += 1;
  b.moved = [false, false];
  const choices: [Choice, Choice] = [player, cpuChoice(b)];

  // switches happen first
  for (const s of [0, 1] as const) {
    const c = choices[s];
    if (c.kind === "switch") {
      switchTo(b, s, c.idx, out);
      b.moved[s] = true;
      if (out.length) yield flush();
    }
  }
  // then the attacks, fastest first
  for (const s of turnOrder(b, choices)) {
    const c = choices[s];
    if (b.winner !== -1) break;
    if (c.kind !== "move" || activeOf(b, s).fainted) continue;
    if (canAct(b, s, out)) performMove(b, s, c.i, out);
    b.moved[s] = true;
    if (out.length) yield flush();
  }
  for (const s of [0, 1] as const) activeOf(b, s).prio = 0;

  // end of round
  if (b.winner === -1) {
    for (const s of turnOrder(b, choices)) {
      endTurn(b, s, out);
      if (out.length) yield flush();
      if (b.winner !== -1) break;
    }
  }
  if (b.winner === -1 && b.weather.w && Number.isFinite(b.weather.t)) {
    b.weather.t -= 1;
    if (b.weather.t <= 0) {
      b.weather = { w: null, t: 0 };
      out.push({ id: b.seq++, k: "weather", w: null });
      yield flush();
    }
  }
  // the CPU sends in a replacement; the player is asked to choose theirs
  if (b.winner === -1 && activeOf(b, 1).fainted && alive(b.sides[1]) > 0) {
    switchTo(b, 1, bestReplacement(b, 1), out);
    if (out.length) yield flush();
  }
  b.sides[0].needSwitch = b.winner === -1 && activeOf(b, 0).fainted && alive(b.sides[0]) > 0;
}

/** The player picks a replacement after their Pokémon fainted. */
export function* playerReplace(b: Battle, idx: number): Generator<Ev[], void, void> {
  const out: Ev[] = [];
  if (b.winner === -1 && switchTo(b, 0, idx, out)) yield out;
}

/** Rough score: how well the player did, for the result screen. */
export function rating(b: Battle): { survivors: number; flawless: boolean } {
  const survivors = alive(b.sides[0]);
  return { survivors, flawless: b.winner === 0 && survivors === b.sides[0].mons.length && b.stats.lost === 0 };
}
