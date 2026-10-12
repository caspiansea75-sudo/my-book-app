/**
 * Petown Arena battle engine: real-time 3v3, pure logic (no React, no DOM).
 *
 * The data tables come from the Petown game files (see src/data/petown.json). The battle loop here is our own:
 * each side's active Pokémon charges a gauge at a speed-driven rate; when it is full the Pokémon can use a move.
 * Damage is the standard Pokémon formula at level 50 (31 IVs, ~84 EVs everywhere), using Petown's base stats,
 * types, moves, abilities and hold items.
 */
import { typeMult } from "@/lib/pokemon/shared";

/* ------------------------------------------------------------------ data shapes */

/** [name, type, category (0 physical, 1 special), power, accuracy, pp] */
export type MoveRow = [string, string, 0 | 1, number, number, number];
/** [name, kind (0 = move power, 1 = stat), type, stat, multiplier, description] */
export type ItemRow = [string, 0 | 1, string, string, number, string];
/** [id, name, types, [hp, atk, def, spa, spd, spe], ability, move indexes, form (0 base, 1 mega, 2 R2, 3 ultimate), sprite id, dex number] */
export type SpeciesRow = [number, string, string[], number[], string, number[], 0 | 1 | 2 | 3, string, number];
export type PetownData = { moves: MoveRow[]; items: ItemRow[]; abilities: Record<string, string>; species: SpeciesRow[] };

export const LEVEL = 50;
export const TEAM_SIZE = 3;
export const FORM_LABEL: Record<number, { bn: string; en: string }> = {
  0: { bn: "সাধারণ", en: "Base" },
  1: { bn: "মেগা", en: "Mega" },
  2: { bn: "R2", en: "R2" },
  3: { bn: "আল্টিমেট", en: "Ultimate" },
};

/** Abilities this engine really simulates. Every other Petown ability is shown for flavour only. */
export const SIMULATED_ABILITIES: Record<string, { bn: string; en: string }> = {
  Blaze: { bn: "HP কম হলে আগুন চাল ×১.৫", en: "Fire moves ×1.5 at low HP" },
  Torrent: { bn: "HP কম হলে পানির চাল ×১.৫", en: "Water moves ×1.5 at low HP" },
  Overgrow: { bn: "HP কম হলে ঘাসের চাল ×১.৫", en: "Grass moves ×1.5 at low HP" },
  Swarm: { bn: "HP কম হলে পোকার চাল ×১.৫", en: "Bug moves ×1.5 at low HP" },
  Levitate: { bn: "মাটির চালে অক্ষত", en: "Immune to Ground moves" },
  "Flash Fire": { bn: "আগুনে অক্ষত, আগুনের চাল জোরালো", en: "Immune to Fire, powers up Fire moves" },
  "Volt Absorb": { bn: "বিদ্যুৎ শুষে HP ফেরে", en: "Heals from Electric moves" },
  "Lightning Rod": { bn: "বিদ্যুতে অক্ষত", en: "Immune to Electric moves" },
  "Motor Drive": { bn: "বিদ্যুতে অক্ষত, গতি বাড়ে", en: "Immune to Electric, gains speed" },
  "Water Absorb": { bn: "পানি শুষে HP ফেরে", en: "Heals from Water moves" },
  "Storm Drain": { bn: "পানিতে অক্ষত", en: "Immune to Water moves" },
  "Dry Skin": { bn: "পানি শুষে HP ফেরে", en: "Heals from Water moves" },
  "Sap Sipper": { bn: "ঘাসে অক্ষত", en: "Immune to Grass moves" },
  "Huge Power": { bn: "অ্যাটাক দ্বিগুণ", en: "Doubles Attack" },
  "Pure Power": { bn: "অ্যাটাক দ্বিগুণ", en: "Doubles Attack" },
  "Thick Fat": { bn: "আগুন ও বরফের ক্ষতি অর্ধেক", en: "Halves Fire and Ice damage" },
  Heatproof: { bn: "আগুনের ক্ষতি অর্ধেক", en: "Halves Fire damage" },
  Sturdy: { bn: "পূর্ণ HP থেকে এক আঘাতে মরে না", en: "Survives a hit from full HP" },
  Intimidate: { bn: "নামলে প্রতিপক্ষের অ্যাটাক কমে", en: "Lowers the foe's Attack on entry" },
  Adaptability: { bn: "STAB দ্বিগুণ (×২)", en: "STAB becomes ×2" },
  Technician: { bn: "দুর্বল চাল (≤৬০) ×১.৫", en: "Weak moves (≤60) ×1.5" },
  "Tinted Lens": { bn: "কম কার্যকর চাল দ্বিগুণ", en: "Not-very-effective hits do double" },
  Filter: { bn: "কার্যকর চালের ক্ষতি ×০.৭৫", en: "Super-effective damage ×0.75" },
  "Solid Rock": { bn: "কার্যকর চালের ক্ষতি ×০.৭৫", en: "Super-effective damage ×0.75" },
  Multiscale: { bn: "পূর্ণ HP-তে ক্ষতি অর্ধেক", en: "Halves damage at full HP" },
  "Fur Coat": { bn: "ফিজিক্যাল ক্ষতি অর্ধেক", en: "Halves physical damage" },
  "Wonder Guard": { bn: "শুধু কার্যকর চালে আঘাত লাগে", en: "Only super-effective moves hit" },
  Moxie: { bn: "কাউকে হারালে অ্যাটাক বাড়ে", en: "Attack rises after a KO" },
  "Speed Boost": { bn: "সময়ের সাথে গতি বাড়ে", en: "Gets faster over time" },
  "Compound Eyes": { bn: "নির্ভুলতা ×১.৩", en: "Accuracy ×1.3" },
  "No Guard": { bn: "সব চাল লাগে", en: "Every move hits" },
};

/* ------------------------------------------------------------------ runtime types */

export type BMove = { name: string; type: string; cat: 0 | 1; power: number; acc: number; pp: number; max: number };

export type Mon = {
  uid: number;
  name: string;
  types: string[];
  form: number;
  sprite: string;
  num: number;
  base: number[];
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  ability: string;
  item: ItemRow | null;
  moves: BMove[];
  fainted: boolean;
  atkStage: number;
  speedMul: number;
  sturdyUsed: boolean;
};

export type Side = {
  mons: Mon[];
  active: number;
  gauge: number;
  /** seconds the active Pokémon is still sliding into place after a switch */
  lock: number;
  /** the active Pokémon fainted; a replacement is chosen when this timer runs out (or sooner by tapping) */
  pendingSwitch: number;
  human: boolean;
};

export type Ev =
  | { id: number; k: "send"; side: 0 | 1; mon: string }
  | { id: number; k: "use"; side: 0 | 1; mon: string; move: string; type: string }
  | { id: number; k: "dmg"; side: 0 | 1; amount: number; mult: number; crit: boolean }
  | { id: number; k: "miss"; side: 0 | 1; move: string }
  | { id: number; k: "immune"; side: 0 | 1; mon: string }
  | { id: number; k: "heal"; side: 0 | 1; amount: number; why: string }
  | { id: number; k: "ability"; side: 0 | 1; mon: string; ability: string; what: "intimidate" | "sturdy" | "moxie" | "absorb" | "boost" }
  | { id: number; k: "faint"; side: 0 | 1; mon: string }
  | { id: number; k: "end"; winner: 0 | 1 };

export type Battle = {
  sides: [Side, Side];
  time: number;
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

/* ------------------------------------------------------------------ building Pokémon */

const calcStat = (base: number) => Math.floor(((2 * base + 31 + 21) * LEVEL) / 100) + 5;
const calcHp = (base: number) => Math.floor(((2 * base + 31 + 21) * LEVEL) / 100) + LEVEL + 10;

export const bst = (s: SpeciesRow) => s[3].reduce((a, b) => a + b, 0);

/** Hold items a Pokémon may carry: stat items need a matching type; power items work for any holder. */
export function itemsFor(data: PetownData, sp: SpeciesRow): ItemRow[] {
  return data.items.filter((it) => (it[1] === 1 ? sp[2].includes(it[2]) : true));
}

let uidSeq = 1;
export function makeMon(data: PetownData, sp: SpeciesRow, item: ItemRow | null): Mon {
  const [, name, types, st, ability, moveIdx, form, sprite, num] = sp;
  const boost = (key: string, v: number) => (item && item[1] === 1 && item[3] === key && types.includes(item[2]) ? Math.floor(v * item[4]) : v);
  const maxHp = calcHp(st[0]);
  return {
    uid: uidSeq++,
    name,
    types,
    form,
    sprite,
    num,
    base: st,
    maxHp,
    hp: maxHp,
    atk: boost("atk", calcStat(st[1])),
    def: boost("def", calcStat(st[2])),
    spa: boost("spa", calcStat(st[3])),
    spd: boost("spd", calcStat(st[4])),
    spe: boost("spe", calcStat(st[5])),
    ability,
    item,
    moves: moveIdx.map((i) => {
      const m = data.moves[i];
      return { name: m[0], type: m[1], cat: m[2], power: m[3], acc: m[4], pp: m[5], max: m[5] };
    }),
    fainted: false,
    atkStage: 0,
    speedMul: 1,
    sturdyUsed: false,
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

/* ------------------------------------------------------------------ damage */

const STRUGGLE: BMove = { name: "Struggle", type: "Normal", cat: 0, power: 50, acc: 100, pp: 1, max: 1 };

const PINCH: Record<string, string> = { Blaze: "Fire", Torrent: "Water", Overgrow: "Grass", Swarm: "Bug" };
const ABSORB_HEAL: Record<string, string> = { "Volt Absorb": "Electric", "Water Absorb": "Water", "Dry Skin": "Water" };
const IMMUNE_TO: Record<string, string> = { Levitate: "Ground", "Lightning Rod": "Electric", "Motor Drive": "Electric", "Storm Drain": "Water", "Sap Sipper": "Grass", "Flash Fire": "Fire" };

export type DamageInfo = { min: number; max: number; mult: number; immune: boolean; absorbs: boolean };

function stageMul(stage: number) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

/** Damage range of `mv` from `att` onto `def` (crit not included). */
export function damageRange(att: Mon, def: Mon, mv: BMove): DamageInfo {
  const mult = typeMult(mv.type, def.types);
  const none = { min: 0, max: 0, mult, immune: true, absorbs: false };
  if (mult === 0) return none;
  const absorbType = ABSORB_HEAL[def.ability];
  if (absorbType && absorbType === mv.type) return { ...none, absorbs: true };
  if (IMMUNE_TO[def.ability] === mv.type) return none;
  if (def.ability === "Wonder Guard" && mult <= 1) return none;

  const physical = mv.cat === 0;
  let a = physical ? att.atk * stageMul(att.atkStage) : att.spa;
  if (physical && (att.ability === "Huge Power" || att.ability === "Pure Power")) a *= 2;
  const d = physical ? def.def : def.spd;

  let power = mv.power;
  if (att.item && att.item[1] === 0 && att.item[2] === mv.type) power *= att.item[4];
  if (att.ability === "Technician" && mv.power <= 60) power *= 1.5;
  if (PINCH[att.ability] === mv.type && att.hp <= att.maxHp / 3) power *= 1.5;
  if (att.ability === "Flash Fire" && mv.type === "Fire") power *= 1.15;

  let dmg = Math.floor(Math.floor(((Math.floor((2 * LEVEL) / 5) + 2) * power * a) / Math.max(1, d)) / 50) + 2;
  const stab = att.types.includes(mv.type) ? (att.ability === "Adaptability" ? 2 : 1.5) : 1;
  dmg *= stab * mult;
  if (mult < 1 && att.ability === "Tinted Lens") dmg *= 2;
  if (mult > 1 && (def.ability === "Filter" || def.ability === "Solid Rock")) dmg *= 0.75;
  if (def.ability === "Thick Fat" && (mv.type === "Fire" || mv.type === "Ice")) dmg *= 0.5;
  if (def.ability === "Heatproof" && mv.type === "Fire") dmg *= 0.5;
  if (def.ability === "Multiscale" && def.hp === def.maxHp) dmg *= 0.5;
  if (def.ability === "Fur Coat" && physical) dmg *= 0.5;
  return { min: Math.max(1, Math.floor(dmg * 0.85)), max: Math.max(1, Math.floor(dmg)), mult, immune: false, absorbs: false };
}

/* ------------------------------------------------------------------ battle flow */

export function newBattle(player: Mon[], foe: Mon[], difficulty: Difficulty): Battle {
  const mk = (mons: Mon[], human: boolean): Side => ({ mons, active: 0, gauge: 35, lock: 0, pendingSwitch: 0, human });
  return {
    sides: [mk(player, true), mk(foe, false)],
    time: 0,
    seq: 1,
    winner: -1,
    difficulty,
    stats: { hits: 0, crits: 0, maxHit: 0, kos: 0, lost: 0 },
  };
}

const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0);
export const activeOf = (b: Battle, s: 0 | 1) => b.sides[s].mons[b.sides[s].active];
export const alive = (side: Side) => side.mons.filter((m) => !m.fainted).length;

/** Seconds the active Pokémon needs to fill its gauge. */
export function chargeTime(b: Battle, s: 0 | 1): number {
  const m = activeOf(b, s);
  const rate = s === 1 ? DIFFICULTY[b.difficulty].rate : 1;
  return 900 / ((m.spe * m.speedMul + 60) * rate);
}

/** Events that happen on entry (Intimidate). */
export function enter(b: Battle, s: 0 | 1, out: Ev[]) {
  const me = activeOf(b, s);
  const foe = activeOf(b, other(s));
  out.push({ id: b.seq++, k: "send", side: s, mon: me.name });
  if (me.ability === "Intimidate" && !foe.fainted) {
    foe.atkStage = Math.max(-6, foe.atkStage - 1);
    out.push({ id: b.seq++, k: "ability", side: s, mon: me.name, ability: "Intimidate", what: "intimidate" });
  }
}

export function startBattle(b: Battle): Ev[] {
  const out: Ev[] = [];
  enter(b, 0, out);
  enter(b, 1, out);
  return out;
}

/** Strongest-looking replacement versus the foe's current Pokémon. */
function bestReplacement(b: Battle, s: 0 | 1): number {
  const side = b.sides[s];
  const foe = activeOf(b, other(s));
  let best = -1;
  let score = -1;
  side.mons.forEach((m, i) => {
    if (m.fainted || i === side.active) return;
    let sc = Math.max(...m.moves.map((mv) => damageRange(m, foe, mv).max)) + m.hp * 0.2;
    if (m.hp <= 0) sc = -1;
    if (sc > score) { score = sc; best = i; }
  });
  return best;
}

/** Manual (or automatic) switch. Returns false if it is not allowed. */
export function switchTo(b: Battle, s: 0 | 1, idx: number, out: Ev[]): boolean {
  const side = b.sides[s];
  const m = side.mons[idx];
  if (!m || m.fainted || idx === side.active && !side.pendingSwitch) return false;
  const forced = side.pendingSwitch > 0 || activeOf(b, s).fainted;
  if (!forced && side.lock > 0) return false;
  side.active = idx;
  side.pendingSwitch = 0;
  side.gauge = forced ? 40 : 15;
  side.lock = 0.9;
  enter(b, s, out);
  return true;
}

function hits(att: Mon, mv: BMove): boolean {
  if (att.ability === "No Guard") return true;
  const acc = Math.min(100, mv.acc * (att.ability === "Compound Eyes" ? 1.3 : 1));
  return Math.random() * 100 < acc;
}

/** Use move `i` of side `s`'s active Pokémon. */
export function performMove(b: Battle, s: 0 | 1, i: number, out: Ev[]): void {
  const side = b.sides[s];
  const att = activeOf(b, s);
  const def = activeOf(b, other(s));
  if (b.winner !== -1 || att.fainted || def.fainted) return;
  const hasPp = att.moves.some((m) => m.pp > 0);
  const mv = hasPp ? att.moves[i] : STRUGGLE;
  if (!mv || (hasPp && mv.pp <= 0)) return;
  if (hasPp) mv.pp -= 1;
  side.gauge = 0;
  out.push({ id: b.seq++, k: "use", side: s, mon: att.name, move: mv.name, type: mv.type });

  if (!hits(att, mv)) {
    out.push({ id: b.seq++, k: "miss", side: s, move: mv.name });
    return;
  }
  const info = damageRange(att, def, mv);
  const ts = other(s);
  if (info.absorbs) {
    const heal = Math.min(def.maxHp - def.hp, Math.floor(def.maxHp / 4));
    def.hp += heal;
    out.push({ id: b.seq++, k: "ability", side: ts, mon: def.name, ability: def.ability, what: "absorb" });
    if (heal > 0) out.push({ id: b.seq++, k: "heal", side: ts, amount: heal, why: def.ability });
    return;
  }
  if (info.immune) {
    out.push({ id: b.seq++, k: "immune", side: ts, mon: def.name });
    if (def.ability === "Motor Drive") { def.speedMul = Math.min(1.6, def.speedMul + 0.2); out.push({ id: b.seq++, k: "ability", side: ts, mon: def.name, ability: def.ability, what: "boost" }); }
    if (def.ability === "Flash Fire") { out.push({ id: b.seq++, k: "ability", side: ts, mon: def.name, ability: def.ability, what: "boost" }); }
    return;
  }
  const crit = Math.random() < 1 / 16;
  const roll = 0.85 + Math.random() * 0.15;
  let dmg = Math.max(1, Math.floor(((info.max + info.min) / 2 / 0.925) * roll * (crit ? 1.5 : 1)));
  if (def.ability === "Sturdy" && !def.sturdyUsed && def.hp === def.maxHp && dmg >= def.hp) {
    dmg = def.hp - 1;
    def.sturdyUsed = true;
    out.push({ id: b.seq++, k: "ability", side: ts, mon: def.name, ability: "Sturdy", what: "sturdy" });
  }
  dmg = Math.min(def.hp, dmg);
  def.hp -= dmg;
  out.push({ id: b.seq++, k: "dmg", side: ts, amount: dmg, mult: info.mult, crit });
  if (s === 0) {
    b.stats.hits += 1;
    if (crit) b.stats.crits += 1;
    b.stats.maxHit = Math.max(b.stats.maxHit, dmg);
  }
  if (def.hp <= 0) {
    def.hp = 0;
    def.fainted = true;
    out.push({ id: b.seq++, k: "faint", side: ts, mon: def.name });
    if (s === 0) b.stats.kos += 1;
    else b.stats.lost += 1;
    if (att.ability === "Moxie") {
      att.atkStage = Math.min(6, att.atkStage + 1);
      out.push({ id: b.seq++, k: "ability", side: s, mon: att.name, ability: "Moxie", what: "moxie" });
    }
    const dside = b.sides[ts];
    if (alive(dside) === 0) {
      b.winner = s;
      out.push({ id: b.seq++, k: "end", winner: s });
    } else {
      dside.pendingSwitch = dside.human ? 6 : 1.4;
    }
  }
}

/** Move the CPU (or auto-pilot) would pick. */
export function chooseMove(b: Battle, s: 0 | 1, smart: number): number {
  const att = activeOf(b, s);
  const def = activeOf(b, other(s));
  const scored = att.moves.map((mv, i) => {
    if (mv.pp <= 0) return { i, v: -1 };
    const r = damageRange(att, def, mv);
    const v = r.immune ? (r.absorbs ? -2 : 0) : ((r.min + r.max) / 2) * (Math.min(100, mv.acc) / 100);
    return { i, v };
  });
  const usable = scored.filter((x) => x.v >= 0);
  if (!usable.length) return 0;
  if (Math.random() < smart) return usable.sort((x, y) => y.v - x.v)[0].i;
  return usable[Math.floor(Math.random() * usable.length)].i;
}

/** Advance the battle by `dt` seconds. Returns the events that happened. */
export function tick(b: Battle, dt: number, autoPilot: boolean): Ev[] {
  const out: Ev[] = [];
  if (b.winner !== -1) return out;
  b.time += dt;
  for (const s of [0, 1] as const) {
    const side = b.sides[s];
    const me = activeOf(b, s);

    if (me.fainted) {
      side.pendingSwitch -= dt;
      if (side.pendingSwitch <= 0 && alive(side) > 0) {
        const pick = bestReplacement(b, s);
        if (pick >= 0) switchTo(b, s, pick, out);
      }
      continue;
    }
    if (me.ability === "Speed Boost") me.speedMul = Math.min(1.6, me.speedMul + dt * 0.04);
    if (side.lock > 0) side.lock = Math.max(0, side.lock - dt);
    else if (side.gauge < 100) side.gauge = Math.min(100, side.gauge + (dt * 100) / chargeTime(b, s));
  }
  // actions (fastest gauge first so the speedier Pokémon wins a tie)
  const order: (0 | 1)[] = activeOf(b, 0).spe >= activeOf(b, 1).spe ? [0, 1] : [1, 0];
  for (const s of order) {
    const side = b.sides[s];
    const me = activeOf(b, s);
    if (b.winner !== -1 || me.fainted || side.lock > 0 || side.gauge < 100) continue;
    if (s === 1) performMove(b, 1, chooseMove(b, 1, DIFFICULTY[b.difficulty].smart), out);
    else if (autoPilot) performMove(b, 0, chooseMove(b, 0, 0.9), out);
  }
  return out;
}

/** Player taps a move. */
export function playerMove(b: Battle, i: number): Ev[] {
  const out: Ev[] = [];
  const side = b.sides[0];
  if (b.winner !== -1 || side.gauge < 100 || side.lock > 0 || activeOf(b, 0).fainted) return out;
  performMove(b, 0, i, out);
  return out;
}

/** Player taps a team member. */
export function playerSwitch(b: Battle, idx: number): Ev[] {
  const out: Ev[] = [];
  if (b.winner === -1) switchTo(b, 0, idx, out);
  return out;
}

/** Rough score: how well the player did, for the result screen. */
export function rating(b: Battle): { survivors: number; flawless: boolean } {
  const survivors = alive(b.sides[0]);
  return { survivors, flawless: b.winner === 0 && survivors === b.sides[0].mons.length && b.stats.lost === 0 };
}
