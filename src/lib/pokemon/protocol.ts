/**
 * Turns Pokémon Showdown battle-log lines ("|move|p1a: Pikachu|Thunderbolt|p2a: Gyarados" ...) into
 *   - the state of the battlefield (who is out, HP, status, weather ...),
 *   - a line of narration in Bangla or English,
 *   - an animation "cue" for the arena, and how long to wait before the next line.
 * Pure functions only, so it works the same in the browser and in tests.
 */
import { localize, tx, type Lang, type MoveInfo, type SpriteInfo } from "@/lib/pokemon/shared";

export type SideId = "p1" | "p2";

export type Mon = {
  name: string;
  species: string;
  level: number;
  gender: string;
  hp: number;
  maxHp: number;
  status: string;
  fainted: boolean;
  boosts: Record<string, number>;
  volatiles: string[];
  tera?: string;
  mega?: boolean;
  dynamax?: boolean;
  gmax?: boolean;
  revealed: boolean;
};
export type SideState = {
  id: SideId;
  name: string;
  size: number;
  team: Mon[];
  active: Mon | null;
  conditions: string[];
};
export type BState = {
  gen: number;
  turn: number;
  sides: Record<SideId, SideState>;
  weather: string;
  terrain: string;
  rooms: string[];
  ended: boolean;
  winner: string | null;
  /** effect words seen just before the next damage line */
  pendingEffect: "se" | "nve" | "crit" | null;
  lastMove: { side: SideId; name: string; type: string; cat: string } | null;
};

export type CueKind =
  | "start" | "switch" | "move" | "hit" | "heal" | "faint" | "status" | "boost" | "mega" | "zpower" | "dynamax"
  | "tera" | "weather" | "miss" | "turn" | "win" | "form" | "ability" | "hazard" | "item";
export type Cue = {
  id: number;
  kind: CueKind;
  /** The side the cue happens on (for a move: the target side) */
  side?: SideId;
  from?: SideId;
  moveName?: string;
  moveType?: string;
  cat?: string;
  amount?: number;
  effect?: "se" | "nve" | "crit" | null;
  up?: boolean;
  stat?: string;
  text?: string;
  type?: string;
};
export type Step = { state: BState; say: string[]; cue: Cue | null; wait: number };
export type Ctx = { lang: Lang; moves: Record<string, MoveInfo>; sprites: Record<string, SpriteInfo>; you: SideId | null };

const emptySide = (id: SideId): SideState => ({ id, name: id === "p1" ? "Player 1" : "Player 2", size: 0, team: [], active: null, conditions: [] });
export const initialState = (): BState => ({
  gen: 9,
  turn: 0,
  sides: { p1: emptySide("p1"), p2: emptySide("p2") },
  weather: "",
  terrain: "",
  rooms: [],
  ended: false,
  winner: null,
  pendingEffect: null,
  lastMove: null,
});

/* ---------------------------------------------------------------- helpers */

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
let cueCounter = 0;
const cue = (c: Omit<Cue, "id">): Cue => ({ id: ++cueCounter, ...c });

type Ident = { side: SideId; name: string };
function parseIdent(raw: string): Ident | null {
  const m = /^(p[1-4])[a-c]?:\s*(.*)$/.exec(raw.trim());
  if (!m || (m[1] !== "p1" && m[1] !== "p2")) return null;
  return { side: m[1], name: m[2] };
}
function parseDetails(details: string) {
  const parts = details.split(",").map((s) => s.trim());
  const species = parts[0] ?? "";
  let level = 100;
  let gender = "";
  for (const p of parts.slice(1)) {
    const lv = /^L(\d+)$/.exec(p);
    if (lv) level = Number(lv[1]);
    else if (p === "M" || p === "F") gender = p;
  }
  return { species, level, gender };
}
function parseCondition(cond: string): { hp: number; maxHp: number; status: string; fainted: boolean } {
  const [hpPart, statusPart = ""] = cond.trim().split(/\s+/);
  if (hpPart === "0" || statusPart === "fnt") return { hp: 0, maxHp: 100, status: "", fainted: true };
  const [a, b] = hpPart.split("/");
  const hp = Number(a);
  const maxHp = Number(b) || 100;
  return { hp: Number.isFinite(hp) ? hp : 0, maxHp, status: statusPart, fainted: false };
}
const pct = (m: Mon) => (m.maxHp ? Math.max(0, Math.round((m.hp / m.maxHp) * 100)) : 0);

function newMon(name: string, species = name): Mon {
  return { name, species, level: 100, gender: "", hp: 100, maxHp: 100, status: "", fainted: false, boosts: {}, volatiles: [], revealed: false };
}
function monFor(st: BState, id: Ident): Mon {
  const side = st.sides[id.side];
  if (side.active && (side.active.name === id.name || side.active.species === id.name)) return side.active;
  let m = side.team.find((x) => x.name === id.name);
  if (!m) m = side.team.find((x) => x.species === id.name && !x.revealed);
  if (!m) {
    m = newMon(id.name);
    side.team.push(m);
  }
  return m;
}
function monByRaw(st: BState, raw: string | undefined): { id: Ident; mon: Mon } | null {
  if (!raw) return null;
  const id = parseIdent(raw);
  return id ? { id, mon: monFor(st, id) } : null;
}
const clone = <T,>(v: T): T => structuredClone(v);

/** Pokémon names shown in text: the species (nicknames are not used on this site). */
const label = (m: Mon) => m.species || m.name;

const STATUS_BN: Record<string, string> = { brn: "পুড়ে গেল 🔥", par: "অবশ হয়ে গেল ⚡", slp: "ঘুমিয়ে পড়ল 💤", frz: "জমে গেল ❄️", psn: "বিষাক্ত হলো ☠️", tox: "তীব্র বিষে আক্রান্ত হলো ☠️" };
const STATUS_EN: Record<string, string> = { brn: "was burned 🔥", par: "is paralyzed ⚡", slp: "fell asleep 💤", frz: "was frozen solid ❄️", psn: "was poisoned ☠️", tox: "was badly poisoned ☠️" };
const STAT_BN: Record<string, string> = { atk: "আক্রমণ", def: "প্রতিরক্ষা", spa: "বিশেষ আক্রমণ", spd: "বিশেষ প্রতিরক্ষা", spe: "গতি", accuracy: "নির্ভুলতা", evasion: "এড়ানোর ক্ষমতা" };
const STAT_EN: Record<string, string> = { atk: "Attack", def: "Defense", spa: "Sp. Atk", spd: "Sp. Def", spe: "Speed", accuracy: "accuracy", evasion: "evasiveness" };
const WEATHER: Record<string, [string, string]> = {
  RainDance: ["বৃষ্টি শুরু হলো! 🌧️", "It started to rain! 🌧️"],
  SunnyDay: ["রোদ কড়া হলো! ☀️", "The sunlight turned harsh! ☀️"],
  Sandstorm: ["বালুঝড় উঠল! 🌪️", "A sandstorm kicked up! 🌪️"],
  Snow: ["তুষারপাত শুরু হলো! ❄️", "It started to snow! ❄️"],
  Hail: ["শিলাবৃষ্টি শুরু হলো! 🧊", "It started to hail! 🧊"],
  DesolateLand: ["রোদ ভীষণ প্রখর হয়ে উঠল! 🔥", "The sunlight turned extremely harsh! 🔥"],
  PrimordialSea: ["ভারী বৃষ্টি নামল! 🌊", "A heavy rain began to fall! 🌊"],
  DeltaStream: ["রহস্যময় বাতাস বইছে! 🌀", "Mysterious strong winds are protecting Flying types! 🌀"],
};
const CANT_BN: Record<string, string> = { par: "পুরো অবশ, নড়তে পারল না!", slp: "গভীর ঘুমে!", frz: "বরফে জমে আছে!", flinch: "ভয়ে পিছিয়ে গেল!", recharge: "রিচার্জ নিচ্ছে!", taunt: "টন্টে আটকে গেল!", Disable: "চালটি বন্ধ করা আছে!", confusion: "বিভ্রান্ত!", attract: "প্রেমে মজে আছে!" };
const CANT_EN: Record<string, string> = { par: "is fully paralyzed!", slp: "is fast asleep.", frz: "is frozen solid!", flinch: "flinched and couldn't move!", recharge: "must recharge!", taunt: "can't use that after the taunt!", Disable: "'s move is disabled!", confusion: "is confused!", attract: "is immobilized by love!" };

const cleanEffect = (s: string) => s.replace(/^(move|item|ability|ability|Move):\s*/i, "").trim();
const fromTag = (args: string[]) => {
  const t = args.find((a) => a.startsWith("[from]"));
  return t ? cleanEffect(t.slice(6).trim()) : "";
};

/* ------------------------------------------------------------- the reducer */

/** Reads one log line. `lang` picks the language of the narration. */
export function applyLine(prev: BState, line: string, ctx: Ctx): Step {
  const st = clone(prev);
  const parts = line.split("|");
  const cmd = parts[1] ?? "";
  const a = parts.slice(2);
  const say: string[] = [];
  let c: Cue | null = null;
  let wait = 0;
  const L = (bn: string, en: string) => tx(ctx.lang, bn, en);
  const youSide = ctx.you;

  switch (cmd) {
    case "player": {
      const side = a[0] as SideId;
      if (side === "p1" || side === "p2") st.sides[side].name = a[1] || st.sides[side].name;
      break;
    }
    case "teamsize": {
      const side = a[0] as SideId;
      if (side === "p1" || side === "p2") st.sides[side].size = Number(a[1]) || 0;
      break;
    }
    case "gen":
      st.gen = Number(a[0]) || st.gen;
      break;
    case "clearpoke":
      st.sides.p1.team = [];
      st.sides.p2.team = [];
      break;
    case "poke": {
      const side = a[0] as SideId;
      if (side !== "p1" && side !== "p2") break;
      const d = parseDetails(a[1] ?? "");
      const m = newMon(d.species);
      m.level = d.level;
      m.gender = d.gender;
      st.sides[side].team.push(m);
      break;
    }
    case "start":
      say.push(L("⚔️ লড়াই শুরু!", "⚔️ The battle begins!"));
      c = cue({ kind: "start" });
      wait = 900;
      break;

    case "switch":
    case "drag":
    case "replace": {
      const id = parseIdent(a[0] ?? "");
      if (!id) break;
      const d = parseDetails(a[1] ?? "");
      const cond = parseCondition(a[2] ?? "100/100");
      const side = st.sides[id.side];
      let m = side.team.find((x) => x.name === id.name && !x.revealed) ?? side.team.find((x) => x.species === d.species && !x.revealed);
      if (!m) m = side.team.find((x) => x.name === id.name || x.species === d.species);
      if (!m) {
        m = newMon(id.name, d.species);
        side.team.push(m);
      }
      const wasActive = side.active;
      if (wasActive && wasActive !== m) {
        wasActive.boosts = {};
        wasActive.volatiles = [];
        wasActive.dynamax = false;
      }
      m.name = id.name;
      m.species = d.species;
      m.level = d.level;
      m.gender = d.gender;
      m.hp = cond.hp;
      m.maxHp = cond.maxHp;
      m.status = cond.status;
      m.fainted = cond.fainted;
      m.revealed = true;
      if (cmd !== "replace") m.boosts = cmd === "drag" ? {} : m.boosts;
      side.active = m;
      if (cmd === "replace") {
        say.push(L(`${label(m)}-এর আসল রূপ প্রকাশ পেল!`, `The illusion of ${label(m)} faded!`));
      } else if (cmd === "drag") {
        say.push(L(`${label(m)}-কে টেনে আনা হলো!`, `${label(m)} was dragged out!`));
      } else if (youSide && id.side === youSide) {
        say.push(L(`যাও, ${label(m)}! 🔴`, `Go! ${label(m)}! 🔴`));
      } else {
        say.push(L(`${side.name} নামাল ${label(m)}-কে! 🔴`, `${side.name} sent out ${label(m)}! 🔴`));
      }
      c = cue({ kind: "switch", side: id.side });
      wait = 950;
      break;
    }
    case "detailschange":
    case "-formechange": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const d = parseDetails(a[1] ?? "");
      if (cmd === "detailschange") {
        r.mon.species = d.species;
        r.mon.level = d.level;
        const cond = a[2] ? parseCondition(a[2]) : null;
        if (cond) {
          r.mon.hp = cond.hp;
          r.mon.maxHp = cond.maxHp;
        }
      } else {
        r.mon.species = d.species;
      }
      if (/-Gmax$/.test(d.species)) r.mon.gmax = true;
      c = cue({ kind: "form", side: r.id.side });
      wait = 450;
      break;
    }

    case "move": {
      const src = monByRaw(st, a[0]);
      if (!src) break;
      const moveName = a[1] ?? "";
      const info = ctx.moves[toId(moveName)];
      const tgt = parseIdent(a[2] ?? "");
      const miss = a.includes("[miss]");
      const targetSide: SideId = tgt ? tgt.side : src.id.side === "p1" ? "p2" : "p1";
      st.lastMove = { side: src.id.side, name: moveName, type: info?.type ?? "", cat: info?.cat ?? "" };
      say.push(L(`${label(src.mon)} ব্যবহার করল ${moveName}!`, `${label(src.mon)} used ${moveName}!`));
      c = cue({ kind: "move", from: src.id.side, side: targetSide, moveName, moveType: info?.type, cat: info?.cat });
      if (miss) say.push(L("কিন্তু লাগল না! 💨", "But it missed! 💨"));
      wait = 800;
      break;
    }
    case "cant": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const why = a[1] ?? "";
      const key = Object.keys(CANT_EN).find((k) => toId(why).startsWith(toId(k))) ?? "";
      say.push(
        key
          ? L(`${label(r.mon)} ${CANT_BN[key]}`, `${label(r.mon)} ${CANT_EN[key]}`)
          : L(`${label(r.mon)} চাল দিতে পারল না! (${cleanEffect(why)})`, `${label(r.mon)} couldn't move! (${cleanEffect(why)})`),
      );
      wait = 700;
      break;
    }

    case "-damage": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const cond = parseCondition(a[1] ?? "0");
      const before = pct(r.mon);
      r.mon.hp = cond.hp;
      r.mon.maxHp = cond.maxHp;
      if (cond.status) r.mon.status = cond.status;
      if (cond.fainted) r.mon.hp = 0;
      const drop = Math.max(0, before - pct(r.mon));
      const src = fromTag(a);
      const effect = st.pendingEffect;
      st.pendingEffect = null;
      if (src) {
        const nice: Record<string, [string, string]> = {
          psn: ["বিষে কষ্ট পাচ্ছে", "is hurt by poison"], tox: ["বিষে কষ্ট পাচ্ছে", "is hurt by poison"], brn: ["পোড়ার যন্ত্রণায়", "is hurt by its burn"],
          Sandstorm: ["বালুঝড়ে আহত", "is buffeted by the sandstorm"], Hail: ["শিলায় আহত", "is pelted by hail"],
          "Stealth Rock": ["লুকানো পাথরে আঘাত পেল", "was hurt by Stealth Rock"], Spikes: ["কাঁটায় আঘাত পেল", "was hurt by the spikes"],
          "Life Orb": ["Life Orb-এর খেসারত দিল", "lost HP to its Life Orb"], "Leech Seed": ["বীজে শক্তি হারাল", "'s health is sapped by Leech Seed"],
          Recoil: ["রিকয়েলে আহত", "was damaged by recoil"], recoil: ["রিকয়েলে আহত", "was damaged by recoil"],
          "Rocky Helmet": ["Rocky Helmet-এ আঘাত পেল", "was hurt by the Rocky Helmet"], confusion: ["বিভ্রান্ত হয়ে নিজেকে আঘাত করল!", "hurt itself in its confusion!"],
        };
        const n = nice[src];
        say.push(n ? L(`${label(r.mon)} ${n[0]} (−${drop}%)`, `${label(r.mon)} ${n[1]} (−${drop}%)`) : L(`${label(r.mon)} হারাল ${drop}% (${src})`, `${label(r.mon)} lost ${drop}% (${src})`));
      } else {
        say.push(L(`${label(r.mon)} হারাল ${drop}% HP`, `${label(r.mon)} lost ${drop}% of its HP`));
      }
      c = cue({ kind: "hit", side: r.id.side, amount: drop, effect, text: src, moveType: src ? undefined : st.lastMove?.type });
      wait = effect ? 900 : 700;
      break;
    }
    case "-heal": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const cond = parseCondition(a[1] ?? "100/100");
      const before = pct(r.mon);
      r.mon.hp = cond.hp;
      r.mon.maxHp = cond.maxHp;
      const gain = Math.max(0, pct(r.mon) - before);
      const src = fromTag(a);
      say.push(L(`${label(r.mon)} ফিরে পেল ${gain}% HP${src ? ` (${src})` : ""} 💚`, `${label(r.mon)} regained ${gain}% HP${src ? ` (${src})` : ""} 💚`));
      c = cue({ kind: "heal", side: r.id.side, amount: gain });
      wait = 650;
      break;
    }
    case "-sethp": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const cond = parseCondition(a[1] ?? "100/100");
      r.mon.hp = cond.hp;
      r.mon.maxHp = cond.maxHp;
      break;
    }
    case "faint": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      r.mon.fainted = true;
      r.mon.hp = 0;
      r.mon.status = "";
      say.push(L(`${label(r.mon)} অজ্ঞান হয়ে গেল! 💫`, `${label(r.mon)} fainted! 💫`));
      c = cue({ kind: "faint", side: r.id.side });
      wait = 1100;
      break;
    }
    case "-status": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const s = a[1] ?? "";
      r.mon.status = s;
      say.push(L(`${label(r.mon)} ${STATUS_BN[s] ?? s}`, `${label(r.mon)} ${STATUS_EN[s] ?? s}`));
      c = cue({ kind: "status", side: r.id.side, text: s });
      wait = 800;
      break;
    }
    case "-curestatus": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      r.mon.status = "";
      say.push(L(`${label(r.mon)} সুস্থ হয়ে উঠল ✨`, `${label(r.mon)} was cured of its status ✨`));
      c = cue({ kind: "heal", side: r.id.side, amount: 0 });
      wait = 500;
      break;
    }
    case "-cureteam":
      for (const m of st.sides[(parseIdent(a[0] ?? "")?.side ?? "p1") as SideId].team) m.status = "";
      say.push(L("দলের সবাই সুস্থ হয়ে উঠল ✨", "The team was cured of its status ✨"));
      wait = 500;
      break;

    case "-boost":
    case "-unboost":
    case "-setboost": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const stat = a[1] ?? "";
      const n = Number(a[2]) || 0;
      if (cmd === "-setboost") r.mon.boosts[stat] = n;
      else r.mon.boosts[stat] = (r.mon.boosts[stat] ?? 0) + (cmd === "-boost" ? n : -n);
      const up = cmd === "-boost" || (cmd === "-setboost" && n > 0);
      const sb = STAT_BN[stat] ?? stat;
      const se = STAT_EN[stat] ?? stat;
      const big = Math.abs(n) >= 3 ? 3 : Math.abs(n);
      say.push(
        up
          ? L(`${label(r.mon)}-এর ${sb} ${big >= 3 ? "অসম্ভব বেড়ে গেল" : big === 2 ? "অনেক বাড়ল" : "বাড়ল"}! ⬆️`, `${label(r.mon)}'s ${se} ${big >= 3 ? "rose drastically" : big === 2 ? "rose sharply" : "rose"}! ⬆️`)
          : L(`${label(r.mon)}-এর ${sb} ${big >= 2 ? "অনেক কমে গেল" : "কমল"}! ⬇️`, `${label(r.mon)}'s ${se} ${big >= 2 ? "fell harshly" : "fell"}! ⬇️`),
      );
      c = cue({ kind: "boost", side: r.id.side, up, stat });
      wait = 650;
      break;
    }
    case "-clearboost":
    case "-clearnegativeboost":
    case "-clearpositiveboost": {
      const r = monByRaw(st, a[0]);
      if (r) r.mon.boosts = {};
      break;
    }
    case "-clearallboost":
      for (const s of ["p1", "p2"] as SideId[]) for (const m of st.sides[s].team) m.boosts = {};
      say.push(L("সব স্ট্যাট বদল মুছে গেল!", "All stat changes were eliminated!"));
      wait = 500;
      break;

    case "-weather": {
      const w = a[0] ?? "none";
      const upkeep = a.includes("[upkeep]");
      st.weather = w === "none" ? "" : w;
      if (!upkeep) {
        const t = WEATHER[w];
        say.push(w === "none" ? L("আবহাওয়া শান্ত হলো।", "The weather cleared up.") : t ? L(t[0], t[1]) : L(`আবহাওয়া: ${w}`, `Weather: ${w}`));
        c = cue({ kind: "weather", text: w });
        wait = 800;
      }
      break;
    }
    case "-fieldstart":
    case "-fieldend": {
      const eff = cleanEffect(a[0] ?? "");
      const start = cmd === "-fieldstart";
      if (/Terrain$/i.test(eff)) st.terrain = start ? eff : "";
      else st.rooms = start ? [...new Set([...st.rooms, eff])] : st.rooms.filter((x) => x !== eff);
      say.push(start ? L(`${eff} শুরু হলো!`, `${eff} began!`) : L(`${eff} শেষ হলো।`, `${eff} ended.`));
      c = cue({ kind: "weather", text: start ? eff : "" });
      wait = 750;
      break;
    }
    case "-sidestart":
    case "-sideend": {
      const id = parseIdent(a[0] ?? "") ?? ({ side: (a[0] ?? "").startsWith("p2") ? "p2" : "p1" } as Ident);
      const eff = cleanEffect(a[1] ?? "");
      const start = cmd === "-sidestart";
      const side = st.sides[id.side];
      if (start) side.conditions = [...side.conditions, eff];
      else side.conditions = side.conditions.filter((x) => x !== eff);
      say.push(start ? L(`${side.name}-এর দিকে ${eff} ছড়িয়ে পড়ল!`, `${eff} was set on ${side.name}'s side!`) : L(`${side.name}-এর ${eff} শেষ হলো।`, `${side.name}'s ${eff} ended.`));
      c = cue({ kind: "hazard", side: id.side, text: eff });
      wait = 700;
      break;
    }

    case "-start":
    case "-end": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const eff = cleanEffect(a[1] ?? "");
      const start = cmd === "-start";
      if (eff === "Dynamax") {
        r.mon.dynamax = start;
        if (start) {
          const gmax = /-Gmax$/.test(r.mon.species);
          say.push(gmax ? L(`${label(r.mon)} গিগান্টাম্যাক্স করল! 🌋`, `${label(r.mon)} Gigantamaxed! 🌋`) : L(`${label(r.mon)} ডায়ানাক্স করল! 🔴`, `${label(r.mon)} Dynamaxed! 🔴`));
          c = cue({ kind: "dynamax", side: r.id.side, text: gmax ? "gmax" : "dynamax" });
          wait = 1500;
        } else {
          say.push(L(`${label(r.mon)}-এর ডায়ানাক্স শেষ হলো।`, `${label(r.mon)}'s Dynamax ended.`));
          c = cue({ kind: "form", side: r.id.side });
          wait = 800;
        }
        break;
      }
      if (start) r.mon.volatiles = [...new Set([...r.mon.volatiles, eff])];
      else r.mon.volatiles = r.mon.volatiles.filter((v) => v !== eff);
      if (eff === "confusion") say.push(start ? L(`${label(r.mon)} বিভ্রান্ত হয়ে গেল! 😵`, `${label(r.mon)} became confused! 😵`) : L(`${label(r.mon)}-এর বিভ্রান্তি কাটল।`, `${label(r.mon)} snapped out of its confusion.`));
      else if (start && a[1]?.startsWith("typechange")) say.push(L(`${label(r.mon)}-এর টাইপ বদলে গেল!`, `${label(r.mon)}'s type changed!`));
      else if (eff) say.push(start ? L(`${label(r.mon)}: ${eff}!`, `${label(r.mon)}: ${eff}!`) : L(`${label(r.mon)}-এর ${eff} শেষ।`, `${label(r.mon)}'s ${eff} ended.`));
      wait = 450;
      break;
    }
    case "-terastallize": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const type = a[1] ?? "";
      r.mon.tera = type;
      say.push(L(`${label(r.mon)} টেরাস্টালাইজ করল! 💎 (${type})`, `${label(r.mon)} Terastallized! 💎 (${type})`));
      c = cue({ kind: "tera", side: r.id.side, type });
      wait = 1700;
      break;
    }
    case "-mega":
    case "-primal":
    case "-burst": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      r.mon.mega = true;
      const word =
        cmd === "-mega" ? L("মেগা ইভোলিউশন করল! 🧬", "Mega Evolved! 🧬") : cmd === "-primal" ? L("প্রাইমাল রিভার্শন করল! 🌋", "underwent Primal Reversion! 🌋") : L("আল্ট্রা বার্স্ট করল! 🌟", "regained its true power through Ultra Burst! 🌟");
      say.push(`${label(r.mon)} ${word}`);
      c = cue({ kind: "mega", side: r.id.side, text: cmd });
      wait = 1700;
      break;
    }
    case "-zpower": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      say.push(L(`${label(r.mon)} জেড-পাওয়ে জ্বলে উঠল! ✨`, `${label(r.mon)} surrounded itself with its Z-Power! ✨`));
      c = cue({ kind: "zpower", side: r.id.side });
      wait = 1500;
      break;
    }
    case "-ability": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const ab = a[1] ?? "";
      if (a.some((x) => x.startsWith("[from]"))) break;
      say.push(L(`${label(r.mon)}-এর ${ab} কাজ করল!`, `${label(r.mon)}'s ${ab}!`));
      c = cue({ kind: "ability", side: r.id.side, text: ab });
      wait = 600;
      break;
    }
    case "-item":
    case "-enditem": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const item = a[1] ?? "";
      const eaten = a.includes("[eat]");
      say.push(cmd === "-item" ? L(`${label(r.mon)}-এর ${item} প্রকাশ পেল!`, `${label(r.mon)} has ${item}!`) : eaten ? L(`${label(r.mon)} ${item} খেয়ে নিল! 🍓`, `${label(r.mon)} ate its ${item}! 🍓`) : L(`${label(r.mon)}-এর ${item} শেষ হয়ে গেল!`, `${label(r.mon)} lost its ${item}!`));
      c = cue({ kind: "item", side: r.id.side, text: item });
      wait = 600;
      break;
    }
    case "-activate": {
      const r = monByRaw(st, a[0]);
      if (!r) break;
      const eff = cleanEffect(a[1] ?? "");
      if (/^Protect|Detect|Spiky Shield|King's Shield|Baneful Bunker|Obstruct|Silk Trap|Burning Bulwark/i.test(eff)) say.push(L(`${label(r.mon)} নিজেকে রক্ষা করল! 🛡️`, `${label(r.mon)} protected itself! 🛡️`));
      else if (/Substitute/i.test(eff)) say.push(L(`সাবস্টিটিউট ${label(r.mon)}-এর হয়ে আঘাত নিল!`, `The substitute took damage for ${label(r.mon)}!`));
      else if (eff) say.push(L(`${label(r.mon)}: ${eff}`, `${label(r.mon)}: ${eff}`));
      wait = 550;
      break;
    }
    case "-crit":
      st.pendingEffect = "crit";
      say.push(L("ক্রিটিক্যাল হিট! 💥", "A critical hit! 💥"));
      break;
    case "-supereffective":
      if (st.pendingEffect !== "crit") st.pendingEffect = "se";
      say.push(L("খুবই কার্যকর! 🔥", "It's super effective! 🔥"));
      break;
    case "-resisted":
      if (!st.pendingEffect) st.pendingEffect = "nve";
      say.push(L("ততটা কার্যকর নয়… 🛡️", "It's not very effective… 🛡️"));
      break;
    case "-immune": {
      const r = monByRaw(st, a[0]);
      say.push(r ? L(`${label(r.mon)}-এর ওপর কোনো প্রভাব পড়ল না…`, `It doesn't affect ${label(r.mon)}…`) : L("কোনো প্রভাব পড়ল না…", "It had no effect…"));
      c = cue({ kind: "miss", side: r?.id.side });
      wait = 650;
      break;
    }
    case "-miss": {
      const tgt = monByRaw(st, a[1]);
      say.push(L("মিস! লাগল না 💨", "The attack missed! 💨"));
      c = cue({ kind: "miss", side: tgt?.id.side });
      wait = 550;
      break;
    }
    case "-fail":
      say.push(L("কিন্তু কাজ হলো না!", "But it failed!"));
      wait = 500;
      break;
    case "-hitcount":
      say.push(L(`${Number(a[1]) || 0} বার আঘাত লাগল!`, `Hit ${Number(a[1]) || 0} time(s)!`));
      break;
    case "-notarget":
    case "-nothing":
      say.push(L("কোনো লাভ হলো না…", "But nothing happened…"));
      break;
    case "-prepare": {
      const r = monByRaw(st, a[0]);
      if (r) say.push(L(`${label(r.mon)} ${a[1]}-এর জন্য শক্তি জমাচ্ছে…`, `${label(r.mon)} is preparing ${a[1]}…`));
      wait = 500;
      break;
    }
    case "-mustrecharge": {
      const r = monByRaw(st, a[0]);
      if (r) say.push(L(`${label(r.mon)}-কে রিচার্জ নিতে হবে!`, `${label(r.mon)} must recharge!`));
      break;
    }
    case "-transform": {
      const r = monByRaw(st, a[0]);
      const t = monByRaw(st, a[1]);
      if (r && t) {
        r.mon.species = t.mon.species;
        say.push(L(`${label(r.mon)} রূপান্তরিত হলো!`, `${label(r.mon)} transformed!`));
        c = cue({ kind: "form", side: r.id.side });
        wait = 800;
      }
      break;
    }
    case "-message":
    case "message":
      if (a[0]) say.push(localize(a[0], ctx.lang));
      wait = 700;
      break;

    case "turn":
      st.turn = Number(a[0]) || st.turn + 1;
      say.push(L(`—— টার্ন ${st.turn} ——`, `—— Turn ${st.turn} ——`));
      c = cue({ kind: "turn", text: String(st.turn) });
      wait = 350;
      break;
    case "win":
      st.ended = true;
      st.winner = a[0] ?? null;
      say.push(L(`🏆 ${a[0]} জিতল!`, `🏆 ${a[0]} won the battle!`));
      c = cue({ kind: "win", text: a[0] });
      wait = 900;
      break;
    case "tie":
      st.ended = true;
      st.winner = null;
      say.push(L("লড়াই ড্র হলো!", "The battle ended in a tie!"));
      c = cue({ kind: "win", text: "" });
      wait = 900;
      break;
    default:
      break;
  }
  return { state: st, say, cue: c, wait };
}

/** Plays a whole log with no animation (for jumping to the present). */
export function replayAll(lines: readonly string[], ctx: Ctx, from: BState = initialState()): { state: BState; say: string[] } {
  let state = from;
  const say: string[] = [];
  for (const l of lines) {
    const r = applyLine(state, l, ctx);
    state = r.state;
    say.push(...r.say);
  }
  return { state, say };
}

/** Names of moves used in these lines whose details we do not have yet. */
export function unknownMoves(lines: readonly string[], known: Record<string, MoveInfo>): string[] {
  const out = new Set<string>();
  for (const l of lines) {
    if (!l.startsWith("|move|")) continue;
    const name = l.split("|")[3];
    if (name && !known[toId(name)]) out.add(name);
  }
  return [...out];
}

export const hpPercent = pct;
