/**
 * Everything that touches the real Pokémon Showdown battle engine (@pkmn/sim) lives in this one file.
 * It is only ever loaded on the server, through `await import("@/lib/pokemon/engine.server")`.
 *
 * Battles are stored as: seed + teams + the list of choices ("rounds"). To move a battle forward we
 * rebuild it from the seed, replay every round (the engine is deterministic), then add the new choice.
 */
import { Battle, Dex, Teams } from "@pkmn/sim";
import {
  STAT_KEYS,
  TYPES,
  isNewMega,
  toId,
  typeMult,
  type CpuLevel,
  type DexEntry,
  type ItemInfo,
  type MoveInfo,
  type PokeSet,
  type SpeciesDetail,
  type SpriteInfo,
  type StatKey,
} from "@/lib/pokemon/shared";

const dexFor = (gen: number): any => (Dex as any).forGen(gen);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const shuffle = <T>(list: readonly T[]): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ============================================================== dex data */


export const spriteIdOf = (sp: any): string => {
  if (sp.spriteid) return String(sp.spriteid);
  const base = toId(sp.baseSpecies || sp.name);
  return sp.forme && sp.baseSpecies && sp.baseSpecies !== sp.name ? `${base}-${toId(sp.forme)}` : base;
};

const kindOf = (sp: any): string => {
  if (sp.isMega) return "mega";
  if (sp.isPrimal) return "primal";
  if (sp.forme === "Ultra") return "ultra";
  if (sp.forme === "Gmax") return "gmax";
  if (!sp.forme) return "base";
  if (/^(Alola|Galar|Hisui|Paldea)/.test(sp.forme)) return "regional";
  return "other";
};

let dexCache: { list: DexEntry[]; zsig: Record<string, { crystal: string; move: string }> } | null = null;

function allItems(): any[] {
  const d: any = Dex;
  return d.items.all ? d.items.all() : [];
}

function zSignatures(): Record<string, { crystal: string; move: string }> {
  const out: Record<string, { crystal: string; move: string }> = {};
  for (const it of allItems()) {
    if (typeof it.zMove === "string" && Array.isArray(it.itemUser)) {
      for (const who of it.itemUser) out[who] = { crystal: it.name, move: it.zMove };
    }
  }
  return out;
}

/** Every Pokémon and form the Pokédex shows. Megas stay in even when the engine files them under "Future" (the new Z-A ones). */
const keepSpecies = (sp: any): boolean =>
  sp.exists &&
  sp.num > 0 &&
  (!sp.isNonstandard || ["Past", "Unobtainable", "Gigantamax"].includes(sp.isNonstandard) || (sp.isMega && !["CAP", "Custom"].includes(sp.isNonstandard)));

export function dexList(): DexEntry[] {
  if (dexCache) return dexCache.list;
  const d: any = Dex;
  const zsig = zSignatures();
  const list: DexEntry[] = [];
  for (const sp of d.species.all()) {
    if (!keepSpecies(sp)) continue;
    const kind = kindOf(sp);
    const abilities = sp.abilities ?? {};
    const g: string[] = [];
    if (kind === "base" || kind === "regional" || kind === "other") {
      const formes: any[] = (sp.otherFormes ?? []).map((f: string) => d.species.get(f));
      if (formes.some((f) => f.isMega)) g.push("mega");
      if (formes.some((f) => f.isMega && isNewMega(sp.baseSpecies || sp.name, f.forme))) g.push("megaza");
      if (formes.some((f) => f.isPrimal)) g.push("primal");
      if (formes.some((f) => f.forme === "Ultra")) g.push("ultra");
      if (sp.canGigantamax || formes.some((f) => f.forme === "Gmax")) g.push("gmax");
      if (zsig[sp.name]) g.push("zsig");
      if (sp.gen <= 7) g.push("z");
      if (sp.gen <= 8) g.push("dyna");
      g.push("tera");
    } else {
      g.push(kind);
      if (kind === "mega" && isNewMega(sp.baseSpecies || sp.name, sp.forme)) g.push("megaza");
    }
    list.push({
      n: sp.num,
      id: sp.id,
      name: sp.name,
      base: sp.baseSpecies || sp.name,
      forme: sp.forme || "",
      kind,
      gen: sp.gen,
      t: sp.types,
      bs: STAT_KEYS.map((k) => sp.baseStats[k]),
      ab: [abilities["0"], abilities["1"]].filter(Boolean),
      hidden: abilities["H"] ?? "",
      fe: !(sp.evos && sp.evos.length),
      g,
      sp: spriteIdOf(sp),
      req: sp.requiredItem ?? "",
    });
  }
  list.sort((a, b) => a.n - b.n || (a.kind === "base" ? -1 : 0) - (b.kind === "base" ? -1 : 0) || a.name.localeCompare(b.name));
  dexCache = { list, zsig };
  return list;
}

/* ---------------------------------------------------------------- moves */

function moveInfo(m: any): MoveInfo {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    cat: m.category,
    bp: m.basePower ?? 0,
    acc: m.accuracy === true ? null : (m.accuracy ?? null),
    desc: m.shortDesc || "",
  };
}

const NOT_USEFUL = new Set(["splash", "celebrate", "holdhands", "happyhour", "struggle", "metronome", "sketch", "hyperspacefury", "extremeevoboost"]);

/** Every move the species (or its pre-evolutions) can learn up to `gen`. */
function learnableIds(dex: any, sp: any, gen: number): string[] {
  const out = new Set<string>();
  const seen = new Set<string>();
  let cur: any = sp;
  let guard = 0;
  while (cur && guard++ < 6) {
    const ids = [cur.id];
    if (cur.baseSpecies && toId(cur.baseSpecies) !== cur.id) ids.push(toId(cur.baseSpecies));
    if (cur.changesFrom) ids.push(toId(cur.changesFrom));
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      let ls: any = null;
      try {
        ls = dex.species.getLearnsetData?.(id)?.learnset ?? dex.data?.Learnsets?.[id]?.learnset ?? null;
      } catch {
        ls = null;
      }
      if (!ls) continue;
      for (const mv of Object.keys(ls)) {
        const sources: string[] = ls[mv] ?? [];
        if (sources.some((s) => parseInt(s, 10) <= gen)) out.add(mv);
      }
    }
    cur = cur.prevo ? dex.species.get(cur.prevo) : null;
  }
  return [...out];
}

export function speciesMoves(name: string, gen: number): MoveInfo[] {
  const dex = dexFor(gen);
  const sp = dex.species.get(name);
  if (!sp?.exists) return [];
  const out: MoveInfo[] = [];
  for (const id of learnableIds(dex, sp, gen)) {
    const m = dex.moves.get(id);
    if (!m?.exists || m.isZ || m.isMax || m.gen > gen || NOT_USEFUL.has(m.id)) continue;
    out.push(moveInfo(m));
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}


export function speciesDetail(name: string): SpeciesDetail | null {
  const d: any = Dex;
  const sp = d.species.get(name);
  if (!sp?.exists) return null;
  const list = dexList();
  const entry = list.find((e) => e.id === sp.id);
  if (!entry) return null;
  const baseSp = d.species.get(sp.baseSpecies || sp.name);
  const forms = list.filter((e) => e.base === baseSp.name && e.id !== sp.id);
  const evoLine: string[] = [];
  let root: any = baseSp;
  let guard = 0;
  while (root.prevo && guard++ < 4) root = d.species.get(root.prevo);
  const walk = (s: any, depth = 0) => {
    evoLine.push("  ".repeat(depth) + s.name);
    for (const e of s.evos ?? []) walk(d.species.get(e), depth + 1);
  };
  walk(root);
  const abilities: SpeciesDetail["abilities"] = Object.entries(sp.abilities ?? {}).map(([slot, ab]) => {
    const a = d.abilities.get(String(ab));
    return { name: String(ab), slot, desc: a?.shortDesc || a?.desc || "" };
  });
  const megas = (baseSp.otherFormes ?? [])
    .map((f: string) => d.species.get(f))
    .filter((f: any) => f.isMega || f.isPrimal || f.forme === "Ultra")
    .map((f: any) => ({ name: f.name, stone: f.requiredItem || (f.requiredMove ? `move: ${f.requiredMove}` : "") }));
  const gmaxForme = (baseSp.otherFormes ?? []).map((f: string) => d.species.get(f)).find((f: any) => f.forme === "Gmax");
  const gmax = baseSp.canGigantamax || gmaxForme ? { name: gmaxForme?.name ?? `${baseSp.name}-Gmax`, move: baseSp.canGigantamax || "" } : null;
  const z = dexCache?.zsig[baseSp.name] ?? zSignatures()[baseSp.name] ?? null;
  return {
    entry,
    forms,
    evoLine,
    abilities,
    megas,
    gmax,
    zsig: z,
    moves: speciesMoves(baseSp.name === sp.name ? sp.name : sp.name, 9),
    heightm: sp.heightm,
    weightkg: sp.weightkg,
    eggGroups: sp.eggGroups ?? [],
  };
}


export function itemsList(gen: number): ItemInfo[] {
  const dex = dexFor(gen);
  const out: ItemInfo[] = [];
  for (const it of dex.items.all()) {
    const oddButUsable = !!it.megaStone && gen === 9 && !["CAP", "Custom"].includes(it.isNonstandard ?? "");
    if (!it.exists || it.gen > gen || it.isPokeball || (it.isNonstandard && it.isNonstandard !== "Past" && !oddButUsable)) continue;
    const kind: ItemInfo["kind"] = it.megaStone ? "mega" : it.zMove ? "z" : it.onPrimal ? "orb" : "item";
    // Mega stones, Z-Crystals and the Primal orbs only exist in the generations that have those gimmicks.
    if (kind === "mega" && (gen < 6 || gen === 8)) continue;
    if (kind === "z" && gen !== 7) continue;
    out.push({ name: it.name, kind, desc: it.shortDesc || "" });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/* ================================================================ teams */

const NATURE_FALLBACK = "Serious";

export function normalizeSet(gen: number, raw: any): PokeSet {
  const dex = dexFor(gen);
  let sp = dex.species.get(String(raw?.species ?? ""));
  if (!sp?.exists || sp.num <= 0 || sp.gen > gen) throw new Error(`"${raw?.species ?? ""}" এই জেনারেশনে নেই`);
  if (sp.isMega || sp.isPrimal || sp.forme === "Gmax" || sp.forme === "Ultra" || sp.battleOnly) {
    sp = dex.species.get(sp.baseSpecies || (Array.isArray(sp.battleOnly) ? sp.battleOnly[0] : sp.battleOnly));
  }
  const moves: string[] = [];
  for (const nm of Array.isArray(raw?.moves) ? raw.moves : []) {
    const m = dex.moves.get(String(nm));
    if (!m?.exists || m.gen > gen || m.isZ || m.isMax) throw new Error(`"${nm}" চালটি এই জেনারেশনে নেই`);
    if (!moves.includes(m.name)) moves.push(m.name);
  }
  if (moves.length < 1 || moves.length > 4) throw new Error(`${sp.name}-এর জন্য ১ থেকে ৪টি চাল দিন`);
  let ability = "";
  if (gen >= 3) {
    const own = Object.values(sp.abilities ?? {}).map(String);
    const want = String(raw?.ability ?? "");
    ability = own.find((a) => toId(a) === toId(want)) ?? own[0] ?? "";
  }
  let item = "";
  if (gen >= 2 && raw?.item) {
    const it = dex.items.get(String(raw.item));
    if (it?.exists && it.gen <= gen) item = it.name;
  }
  let nature = "";
  if (gen >= 3) {
    const n = dex.natures?.get?.(String(raw?.nature ?? ""));
    nature = n?.exists ? n.name : NATURE_FALLBACK;
  }
  const level = Math.max(1, Math.min(100, Math.floor(Number(raw?.level) || 100)));
  const evs = {} as Record<StatKey, number>;
  if (gen >= 3) {
    let total = 0;
    for (const k of STAT_KEYS) {
      evs[k] = Math.max(0, Math.min(252, Math.floor(Number(raw?.evs?.[k]) || 0)));
      total += evs[k];
    }
    if (total > 510) for (const k of STAT_KEYS) evs[k] = Math.floor((evs[k] * 510) / total);
  } else {
    for (const k of STAT_KEYS) evs[k] = 252;
  }
  const tera = gen === 9 ? (TYPES as readonly string[]).find((t) => toId(t) === toId(String(raw?.teraType ?? ""))) ?? sp.types[0] : undefined;
  return {
    species: sp.name,
    ability,
    item,
    moves,
    nature,
    level,
    teraType: tera,
    gigantamax: gen === 8 && !!sp.canGigantamax && !!raw?.gigantamax,
    evs,
  };
}

export function normalizeTeam(gen: number, rawSets: any[]): PokeSet[] {
  if (!Array.isArray(rawSets) || rawSets.length < 1 || rawSets.length > 6) throw new Error("টিমে ১ থেকে ৬টি পোকেমন লাগবে");
  return rawSets.map((s) => normalizeSet(gen, s));
}

export function packSets(sets: PokeSet[]): string {
  const psSets = sets.map((s) => ({
    name: s.species,
    species: s.species,
    item: s.item,
    ability: s.ability,
    moves: s.moves,
    nature: s.nature,
    gender: "",
    evs: { ...s.evs },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: s.level,
    shiny: false,
    teraType: s.teraType,
    gigantamax: s.gigantamax || undefined,
  }));
  return (Teams as any).pack(psSets);
}

/* -------------------------------------------------------- random teams */

const MEGA_ITEM_NOTE = "Rayquaza";
const SAFE_ITEMS = ["Leftovers", "Life Orb", "Sitrus Berry", "Lum Berry", "Focus Sash", "Expert Belt", "Rocky Helmet", "Assault Vest", "Heavy-Duty Boots", "Choice Band", "Choice Specs", "Choice Scarf", "Shell Bell", "Scope Lens"];
const GOOD_STATUS = new Set([
  "recover", "roost", "softboiled", "synthesis", "moonlight", "slackoff", "swordsdance", "nastyplot", "calmmind", "dragondance",
  "bulkup", "quiverdance", "irondefense", "agility", "toxic", "thunderwave", "willowisp", "stealthrock", "spikes", "toxicspikes",
  "protect", "substitute", "rest", "sleeptalk", "trickroom", "taunt", "leechseed", "reflect", "lightscreen", "painsplit",
  "healbell", "defog", "rapidspin", "wish", "shellsmash", "coil", "curse", "growth", "workup", "hypnosis", "sleeppowder", "spore",
]);
const Z_CRYSTAL: Record<string, string> = {
  Normal: "Normalium Z", Fire: "Firium Z", Water: "Waterium Z", Electric: "Electrium Z", Grass: "Grassium Z", Ice: "Icium Z",
  Fighting: "Fightinium Z", Poison: "Poisonium Z", Ground: "Groundium Z", Flying: "Flyinium Z", Psychic: "Psychium Z",
  Bug: "Buginium Z", Rock: "Rockium Z", Ghost: "Ghostium Z", Dragon: "Dragonium Z", Dark: "Darkinium Z", Steel: "Steelium Z", Fairy: "Fairium Z",
};

export function randomSets(gen: number, size: number): PokeSet[] {
  const dex = dexFor(gen);
  const eligible = (relaxed: boolean) =>
    (dex.species.all() as any[]).filter(
      (s) =>
        s.exists &&
        s.num > 0 &&
        s.gen <= gen &&
        !s.evos?.length &&
        (!s.forme || /^(Alola|Galar|Hisui|Paldea)/.test(s.forme)) &&
        (relaxed ? !s.isNonstandard || s.isNonstandard === "Past" : !s.isNonstandard),
    );
  let pool = eligible(false);
  if (pool.length < size * 6) pool = eligible(true);
  const legendary = (s: any) => (s.tags ?? []).some((t: string) => /Legendary|Mythical|Paradox/i.test(t));
  const team: PokeSet[] = [];
  let legends = 0;
  for (const sp of shuffle(pool)) {
    if (team.length >= size) break;
    if (legendary(sp) && legends >= 1) continue;
    const set = tryBuildSet(dex, sp, gen);
    if (!set) continue;
    if (legendary(sp)) legends++;
    team.push(set);
  }
  return team;
}

function tryBuildSet(dex: any, sp: any, gen: number): PokeSet | null {
  try {
    const bst = Object.values(sp.baseStats as Record<string, number>).reduce((a, b) => a + b, 0);
    const level = Math.max(70, Math.min(100, Math.round(100 - (bst - 400) * 0.1)));
    const physical = sp.baseStats.atk >= sp.baseStats.spa;
    const moves = pickMoves(dex, sp, gen, physical);
    if (!moves.length) return null;
    const own = Object.values(sp.abilities ?? {}).map(String);
    let item = "";
    if (gen >= 2) item = pick(SAFE_ITEMS.filter((n) => dex.items.get(n).exists && dex.items.get(n).gen <= gen)) ?? "";
    if (/Choice (Band|Specs)/.test(item) && !(physical === (item === "Choice Band"))) item = "Leftovers";
    const extra: Partial<PokeSet> = {};
    if (gen === 9) extra.teraType = Math.random() < 0.55 ? pick(sp.types) : pick(TYPES as readonly string[]);
    if (gen === 8 && sp.canGigantamax && Math.random() < 0.6) extra.gigantamax = true;
    if (gen === 6 || gen === 7 || gen === 9) {
      const forms: any[] = (sp.otherFormes ?? []).map((f: string) => dex.species.get(f)).filter((f: any) => f.isMega && f.requiredItem);
      if (gen === 9) {
        if (forms.length && Math.random() < 0.4) item = pick(forms).requiredItem;
      } else if (sp.name === "Kyogre" || sp.name === "Groudon") item = sp.name === "Kyogre" ? "Blue Orb" : "Red Orb";
      else if (sp.name === MEGA_ITEM_NOTE && !moves.includes("Dragon Ascent")) {
        moves[moves.length - 1] = "Dragon Ascent";
        item = "";
      } else if (forms.length && Math.random() < 0.6) item = pick(forms).requiredItem;
      else if (gen === 7 && Math.random() < 0.35) {
        const mv = moves.map((n) => dex.moves.get(n)).find((m: any) => m.category !== "Status");
        if (mv && Z_CRYSTAL[mv.type]) item = Z_CRYSTAL[mv.type];
      }
    }
    return normalizeSet(gen, {
      species: sp.name,
      ability: own.length ? pick(own) : "",
      item,
      moves,
      nature: physical ? "Adamant" : "Modest",
      level,
      evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 },
      ...extra,
    });
  } catch {
    return null;
  }
}

function pickMoves(dex: any, sp: any, gen: number, physical: boolean): string[] {
  const all: any[] = learnableIds(dex, sp, gen)
    .map((id) => dex.moves.get(id))
    .filter((m) => m?.exists && !m.isZ && !m.isMax && m.gen <= gen && !NOT_USEFUL.has(m.id) && (!m.isNonstandard || m.isNonstandard === "Past"));
  const attacks = all.filter((m) => m.category !== "Status" && m.basePower >= 50 && !/charge|recharge/i.test(m.flags ? Object.keys(m.flags).join() : ""));
  const preferred = attacks.filter((m) => (gen <= 3 ? true : m.category === (physical ? "Physical" : "Special")));
  const byPower = (a: any, b: any) => b.basePower - a.basePower;
  const stab = (preferred.length ? preferred : attacks).filter((m) => sp.types.includes(m.type)).sort(byPower).slice(0, 5);
  const cover = (preferred.length ? preferred : attacks).filter((m) => !sp.types.includes(m.type)).sort(byPower).slice(0, 6);
  const utility = all.filter((m) => GOOD_STATUS.has(m.id));
  const chosen: any[] = [];
  const add = (m: any) => m && !chosen.includes(m) && chosen.push(m);
  shuffle(stab).slice(0, 2).forEach(add);
  add(pick(cover.length ? cover : attacks));
  if (utility.length) add(pick(utility));
  for (const m of shuffle(attacks)) {
    if (chosen.length >= 4) break;
    add(m);
  }
  for (const m of shuffle(all)) {
    if (chosen.length >= 4) break;
    add(m);
  }
  if (!chosen.length) {
    const fallback = dex.moves.get("tackle");
    if (fallback?.exists) chosen.push(fallback);
  }
  return chosen.slice(0, 4).map((m) => m.name);
}

/* ---------------------------------------------- sprites & move details */

export function spriteMapFor(names: string[], gen: number): Record<string, SpriteInfo> {
  const dex = dexFor(gen);
  const out: Record<string, SpriteInfo> = {};
  const add = (sp: any) => {
    if (sp?.exists) out[sp.name] = { id: spriteIdOf(sp), num: sp.num, types: sp.types };
  };
  for (const n of names) {
    const sp = dex.species.get(n);
    add(sp);
    const base = dex.species.get(sp.baseSpecies || sp.name);
    add(base);
    for (const f of base.otherFormes ?? []) add(dex.species.get(f));
    for (const f of sp.otherFormes ?? []) add(dex.species.get(f));
  }
  return out;
}

/** Details of moves by name (type, power ...), e.g. for a move the opponent just used. */
export function moveInfosByName(names: string[], gen: number): Record<string, MoveInfo> {
  const dex = dexFor(gen);
  const out: Record<string, MoveInfo> = {};
  for (const n of names.slice(0, 12)) {
    const m = dex.moves.get(n);
    if (m?.exists) out[m.id] = moveInfo(m);
  }
  return out;
}

export function moveMapFor(sets: PokeSet[], gen: number): Record<string, MoveInfo> {
  const dex = dexFor(gen);
  const out: Record<string, MoveInfo> = {};
  for (const s of sets) {
    for (const n of s.moves) {
      const m = dex.moves.get(n);
      if (m?.exists) out[m.id] = moveInfo(m);
    }
  }
  return out;
}

/* ================================================================ battles */

export type Round = [string, string];
export type Setup = {
  format: string;
  seed: number[];
  p1: { name: string; team: string };
  p2: { name: string; team: string };
};
export type Snapshot = {
  lines: string[];
  requests: { p1: any; p2: any };
  ended: boolean;
  winner: "p1" | "p2" | "tie" | null;
  turn: number;
  left: { p1: number; p2: number };
};
type Handle = { battle: any; caps: Record<string, any>; setup: Setup };

export const newSeed = (): number[] => [0, 0, 0, 0].map(() => Math.floor(Math.random() * 0x10000));

function make(setup: Setup): Handle {
  const caps: Record<string, any> = {};
  const battle = new (Battle as any)({
    formatid: setup.format,
    seed: setup.seed,
    strictChoices: true,
    send: (type: string, data: any) => {
      if (type !== "sideupdate") return;
      const text = Array.isArray(data) ? data.join("\n") : String(data);
      const nl = text.indexOf("\n");
      if (nl < 0) return;
      const side = text.slice(0, nl);
      for (const line of text.slice(nl + 1).split("\n")) {
        if (!line.startsWith("|request|")) continue;
        try {
          caps[side] = JSON.parse(line.slice(9));
        } catch {
          /* ignore */
        }
      }
    },
  });
  battle.setPlayer("p1", { name: setup.p1.name, team: setup.p1.team });
  battle.setPlayer("p2", { name: setup.p2.name, team: setup.p2.team });
  battle.sendUpdates();
  return { battle, caps, setup };
}

const reqOf = (h: Handle, i: 0 | 1): any => {
  const live = h.battle.sides?.[i]?.activeRequest;
  if (live !== undefined) return live ?? null;
  return h.caps[i === 0 ? "p1" : "p2"] ?? null;
};
const needsChoice = (h: Handle, i: 0 | 1): boolean => {
  if (h.battle.ended) return false;
  const r = reqOf(h, i);
  return !!r && !r.wait;
};

function snapshot(h: Handle): Snapshot {
  const b = h.battle;
  const ended = !!b.ended;
  let winner: Snapshot["winner"] = null;
  if (ended) winner = b.winner === h.setup.p1.name ? "p1" : b.winner === h.setup.p2.name ? "p2" : "tie";
  const alive = (i: number) => (b.sides[i].pokemon as any[]).filter((p) => !p.fainted).length;
  return {
    lines: [...b.log],
    requests: { p1: reqOf(h, 0), p2: reqOf(h, 1) },
    ended,
    winner,
    turn: b.turn ?? 0,
    left: { p1: alive(0), p2: alive(1) },
  };
}

/** Starts a battle and skips team preview (the first Pokémon of each team leads). */
export function initBattle(setup: Setup): { rounds: Round[]; snapshot: Snapshot } {
  const h = make(setup);
  const rounds: Round[] = [];
  const preview = [0, 1].map((i) => !!reqOf(h, i as 0 | 1)?.teamPreview);
  if (preview[0] || preview[1]) {
    h.battle.makeChoices(preview[0] ? "default" : "", preview[1] ? "default" : "");
    h.battle.sendUpdates();
    rounds.push([preview[0] ? "default" : "", preview[1] ? "default" : ""]);
  }
  return { rounds, snapshot: snapshot(h) };
}

export type AdvanceInput = {
  setup: Setup;
  rounds: Round[];
  pending: { p1?: string; p2?: string };
  cpu: CpuLevel | null;
  /** The choice a person just made. Omit to only (re)run the CPU's moves. */
  choose?: { side: "p1" | "p2"; choice: string };
};
export type AdvanceResult = {
  ok: boolean;
  error?: string;
  rounds: Round[];
  pending: { p1?: string; p2?: string };
  snapshot: Snapshot;
  /** True when something was played (rather than a choice just waiting for the other player). */
  progressed: boolean;
};

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^\[(Invalid|Unavailable) choice\]\s*/i, "").slice(0, 200);
}

export function advance(input: AdvanceInput): AdvanceResult {
  const h = make(input.setup);
  const rounds: Round[] = input.rounds.map((r) => [r[0], r[1]]);
  for (const r of rounds) {
    h.battle.makeChoices(r[0], r[1]);
    h.battle.sendUpdates();
  }
  let pending = { ...input.pending };
  let progressed = false;
  const sideIdx = (s: "p1" | "p2"): 0 | 1 => (s === "p1" ? 0 : 1);

  if (input.choose) {
    const { side, choice } = input.choose;
    const i = sideIdx(side);
    if (!needsChoice(h, i)) {
      return { ok: false, error: "এখন আপনার চাল দেওয়ার পালা নয়", rounds, pending, snapshot: snapshot(h), progressed };
    }
    try {
      const ok = h.battle.sides[i].choose(choice);
      if (ok === false) throw new Error(h.battle.sides[i].choice?.error || "অবৈধ চাল");
    } catch (e) {
      return { ok: false, error: friendly(e), rounds, pending, snapshot: snapshot(h), progressed };
    }
    pending = { ...pending, [side]: choice };
  }

  for (let guard = 0; guard < 60 && !h.battle.ended; guard++) {
    const need = [needsChoice(h, 0), needsChoice(h, 1)];
    if (!need[0] && !need[1]) break;
    // The CPU decides as soon as it is its turn.
    if (input.cpu && need[1] && pending.p2 === undefined) pending.p2 = cpuChoose(h, 1, input.cpu);
    const ready = (!need[0] || pending.p1 !== undefined) && (!need[1] || pending.p2 !== undefined);
    if (!ready) break;
    const c1 = need[0] ? pending.p1 ?? "" : "";
    const c2 = need[1] ? pending.p2 ?? "" : "";
    try {
      h.battle.makeChoices(c1, c2);
    } catch (e) {
      if (input.cpu && need[1]) {
        // The CPU's pick was refused: let the engine choose for it.
        h.battle.makeChoices(c1, "default");
        rounds.push([c1, "default"]);
        h.battle.sendUpdates();
        pending = {};
        progressed = true;
        continue;
      }
      return { ok: false, error: friendly(e), rounds, pending, snapshot: snapshot(h), progressed };
    }
    h.battle.sendUpdates();
    rounds.push([c1, c2]);
    pending = {};
    progressed = true;
  }
  return { ok: true, rounds, pending, snapshot: snapshot(h), progressed };
}

/* ====================================================================== CPU */

function parseDetails(details: string): { species: string } {
  return { species: details.split(",")[0].trim() };
}

function cpuChoose(h: Handle, i: 0 | 1, level: CpuLevel): string {
  try {
    const req = reqOf(h, i);
    if (!req) return "default";
    if (req.teamPreview) return "default";
    const dex = h.battle.dex;
    const foeActive = h.battle.sides[1 - i].active?.[0];
    const foeTypes: string[] = foeActive?.getTypes?.() ?? foeActive?.types ?? ["Normal"];
    const side = req.side;

    const matchup = (species: string, moveTypes: string[]): number => {
      const sp = dex.species.get(species);
      const own: string[] = sp.types ?? ["Normal"];
      let best = 1;
      for (const t of own) best = Math.max(best, typeMult(t, foeTypes));
      if (moveTypes.length) best = Math.max(best, ...moveTypes.map((t) => typeMult(t, foeTypes)));
      return best;
    };
    const benchChoices = (): { slot: number; score: number }[] =>
      side.pokemon
        .map((p: any, idx: number) => ({ p, slot: idx + 1 }))
        .filter(({ p }: any) => !p.active && !String(p.condition).endsWith(" fnt"))
        .map(({ p, slot }: any) => {
          const mv: string[] = (p.moves ?? []).map((id: string) => dex.moves.get(id)).filter((m: any) => m.category !== "Status").map((m: any) => m.type);
          return { slot, score: matchup(parseDetails(p.details).species, mv) };
        });

    if (req.forceSwitch?.[0]) {
      const options = benchChoices();
      if (!options.length) return "default";
      const choice = level === "hard" ? options.sort((a, b) => b.score - a.score)[0] : pick(options);
      return `switch ${choice.slot}`;
    }

    const act = req.active?.[0];
    if (!act) return "default";
    const me = h.battle.sides[i].active?.[0];
    const myTypes: string[] = me?.getTypes?.() ?? me?.types ?? [];
    const hpRatio = me && me.maxhp ? me.hp / me.maxhp : 1;
    const usable = act.moves
      .map((m: any, idx: number) => ({ m, slot: idx + 1 }))
      .filter(({ m }: any) => !m.disabled && (m.pp === undefined || m.pp > 0 || m.id === "struggle"));
    if (!usable.length) return "move 1";

    const scored = usable.map(({ m, slot }: any) => {
      const mv = dex.moves.get(m.id);
      let score = 20;
      if (mv.category === "Status") {
        score = 25;
        if (mv.heal) score = hpRatio < 0.5 ? 70 : 5;
        else if (mv.boosts && (mv.target === "self" || mv.target === "allySide")) score = hpRatio > 0.6 ? 45 : 10;
        else if (mv.status && foeActive && !foeActive.status) score = 45;
        else if (["spikes", "stealthrock", "toxicspikes"].includes(mv.id)) score = 38;
      } else {
        const bp = mv.basePower || (mv.damage ? 40 : 60);
        const acc = mv.accuracy === true ? 100 : (mv.accuracy ?? 100);
        const stab = myTypes.includes(mv.type) ? 1.5 : 1;
        score = bp * (acc / 100) * stab * typeMult(mv.type, foeTypes);
      }
      return { slot, score, m, mv };
    });

    let chosen: (typeof scored)[number];
    if (level === "easy") chosen = pick(scored);
    else if (level === "normal") {
      const weighted = scored.flatMap((s: any) => Array(Math.max(1, Math.round(s.score / 10))).fill(s));
      chosen = pick(weighted);
    } else chosen = [...scored].sort((a, b) => b.score - a.score + (Math.random() - 0.5) * 6)[0];

    // Hard CPU swaps out of a bad matchup now and then.
    if (level === "hard" && !act.trapped && chosen.score < 35 && Math.random() < 0.5) {
      const better = benchChoices().filter((c) => c.score >= 2).sort((a, b) => b.score - a.score)[0];
      if (better) return `switch ${better.slot}`;
    }

    // Gimmicks: the harder the CPU, the more eagerly it uses them (once each is allowed by the engine).
    const chance = level === "easy" ? 0 : level === "normal" ? 0.3 : 0.6;
    const attack = chosen.mv.category !== "Status";
    let suffix = "";
    if (act.canMegaEvoX && Math.random() < 0.5) suffix = " megax";
    else if (act.canMegaEvoY) suffix = " megay";
    else if (act.canMegaEvo && level !== "easy") suffix = " mega";
    else if (act.canUltraBurst && level !== "easy") suffix = " ultra";
    else if (attack && act.canZMove?.[chosen.slot - 1] && Math.random() < chance) suffix = " zmove";
    else if (act.canTerastallize && Math.random() < chance) suffix = " terastallize";
    else if (act.canDynamax && (Math.random() < chance * 0.6 || hpRatio < 0.45)) suffix = " dynamax";
    return `move ${chosen.slot}${suffix}`;
  } catch {
    return "default";
  }
}

export function engineVersion(): string {
  try {
    return String((Dex as any).gen ?? "ok");
  } catch {
    return "ok";
  }
}
