/**
 * Every Petown ability as a list of small, composable effects that the battle engine interprets.
 *
 * Petown's own descriptions are written for a turn-based game (levels, "restraint", "direct damage skill"…).
 * Here they are mapped onto this real-time engine: a "turn" is 3 seconds, "level" is a stat stage, "same-type bonus"
 * is STAB, "restraint" is type effectiveness. Where a description was cut off in the data, only the visible part is used.
 */

export type Stat = "atk" | "def" | "spa" | "spd" | "spe" | "acc" | "eva";
export type Status = "brn" | "psn" | "par" | "slp" | "cnf" | "inf";
export type Weather = "sun" | "rain" | "sand" | "hail" | "harshsun" | "heavyrain" | "wind";
export type Cond = "low" | "hp50" | "hp60" | "full" | "sun" | "rain" | "sand" | "hail" | "status" | "behind" | "foeSlp" | "cnf" | "noItem";
type T = string | string[];

/** A stat-stage change. `s` is one stat, or a list: all of them, or one random one when `any` is set. */
export type Boost = { s: Stat | Stat[]; n: number; any?: true; cap?: number };

export type Fx =
  | { t: "dmg"; m: number; type?: T; cond?: Cond; cat?: 0 | 1; maxPow?: number; name?: RegExp; se?: true; nve?: true; vs?: Status; after?: true }
  | { t: "stab"; m: number; type?: T; always?: true }
  | { t: "taken"; m: number; type?: T; except?: T; cond?: Cond; cat?: 0 | 1; se?: true }
  | { t: "capEff"; type: T; max: number }
  | { t: "minEff"; type: T; min: number }
  | { t: "stat"; s: "atk" | "def" | "spa" | "spd" | "spe"; m: number; cond?: Cond }
  | { t: "immune"; type: T; heal?: number; boost?: Boost }
  | { t: "convert"; to: string; m: number }
  | { t: "weather"; w: Weather }
  | { t: "noWeather" }
  | { t: "aura"; type: string; m: number }
  | { t: "auraBreak" }
  | { t: "accField"; type: T; m: number }
  | { t: "enter"; self?: Boost[]; foe?: Boost[]; gauge?: number; reveal?: "item" | "move" | "danger"; p?: number }
  | { t: "download" }
  | { t: "trace" }
  | { t: "onHit"; p?: number; type?: T; cat?: 0 | 1; status?: Status | Status[]; self?: Boost; foe?: Boost; flinch?: true; drain?: number; extra?: true; clearFoeBoosts?: true }
  | { t: "onHurt"; p?: number; contact?: true; type?: T; crit?: true; moveName?: string; status?: Status | Status[]; self?: Boost[]; foe?: Boost; reflect?: number; reflectMax?: number; heal?: number; healDmg?: number; beads?: number; blast?: number }
  | { t: "negate"; p: number; drainCur: number }
  | { t: "tick"; every?: number; heal?: number; selfHurt?: number; foeHurt?: number; cond?: Cond; self?: Boost[]; foe?: Boost; p?: number; ifType?: string; ifFoeNot?: string; download?: true }
  | { t: "ko"; boost: Boost | "best" }
  | { t: "crit"; n: number }
  | { t: "noCrit" }
  | { t: "critDmg"; m: number }
  | { t: "dodge"; p: number; cond?: Cond }
  | { t: "acc"; m: number; cat?: 0 | 1 }
  | { t: "noMiss" }
  | { t: "statusImmune"; list: (Status | "fln" | "all")[]; cond?: Cond }
  | { t: "noDrop"; stats?: Stat[]; ifType?: string }
  | { t: "onDropped"; boost: Boost }
  | { t: "onFlinch"; boost: Boost }
  | { t: "survive"; cond: "full" | "crit" | "any"; heal?: number }
  | { t: "pressure"; n: number }
  | { t: "ignoreAbility" }
  | { t: "scrappy" }
  | { t: "pierce"; type: T }
  | { t: "bestAtk"; type: T }
  | { t: "speed"; m: number }
  | { t: "trap" }
  | { t: "noChip" }
  | { t: "noRecoil" }
  | { t: "soundproof" }
  | { t: "switchOut"; heal?: number; cure?: true }
  | { t: "cure"; cond?: Cond; p?: number }
  | { t: "healBoost"; m: number }
  | { t: "sync" }
  | { t: "sleepFast" }
  | { t: "shieldDust" }
  | { t: "itemJam" }
  | { t: "bond" }
  | { t: "randImmune"; n: number }
  | { t: "aftermath"; frac: number }
  | { t: "serene" }
  | { t: "inert"; why: "multi" | "berry" | "explode" };

const B = (s: Stat | Stat[], n: number, any?: boolean, cap?: number): Boost => ({ s, n, ...(any ? { any: true as const } : {}), ...(cap ? { cap } : {}) });
const pinch = (type: string): Fx[] => [{ t: "dmg", m: 1.5, type, cond: "low" }];
const stabT = (type: T, m: number): Fx => ({ t: "stab", m, type });
const DEFS: Stat[] = ["def", "spd"];
const ATKS: Stat[] = ["atk", "spa"];
const FSP: T = ["Flying", "Psychic", "Fairy"];

export const RECOIL_MOVES: Record<string, number> = {
  "Double-Edge": 0.33, "Brave Bird": 0.33, "Flare Blitz": 0.33, "Wild Charge": 0.25, "Wood Hammer": 0.33, "Head Smash": 0.5,
  "Take Down": 0.25, Submission: 0.25, "Volt Tackle": 0.33, "Head Charge": 0.25, "Wave Crash": 0.33, "Light of Ruin": 0.5, "Struggle": 0.25,
};
export const RE_PUNCH = /Punch|Fist/;
export const RE_BITE = /Bite|Fang|Crunch|Jaw/;
export const RE_SOUND = /Hyper Voice|Boomburst|Sing|Screech|Round|Echoed Voice|Bug Buzz|Snarl|Uproar|Supersonic|Chatter|Disarming Voice|Relic Song|Sparkling Aria|Clanging Scales|Overdrive|Roar|Metal Sound|Torch Song|Alluring Voice|Psychic Noise|Howl|Clangorous/;

export const ABILITIES: Record<string, Fx[]> = {
  "Absolute Zero": [stabT("Ice", 2.5)],
  Adaptability: [{ t: "stab", m: 2 }],
  "Aerial Barrier": [{ t: "onHurt", type: ["Electric", "Ice", "Rock"], reflect: 0.3 }],
  "Aerial Feathers": [{ t: "enter", self: [B("spe", 1)], foe: [B("spe", -1)] }, { t: "tick", every: 2, foe: B("spe", -1, false, 3) }],
  "Aerial Illusions": [{ t: "bestAtk", type: "Flying" }],
  "Aerial Slam": [{ t: "dmg", m: 1.25, se: true }],
  Aerilate: [{ t: "convert", to: "Flying", m: 1.2 }],
  Aftermath: [{ t: "aftermath", frac: 0.25 }],
  "Alloy strengthening": [{ t: "onHit", type: "Steel", p: 0.1, self: B(DEFS, 1, true) }],
  "Anger Point": [{ t: "onHurt", crit: true, self: [B("atk", 6)] }],
  Anticipation: [{ t: "enter", reveal: "danger" }],
  "Arena Trap": [{ t: "trap" }],
  "Assimilated alloy": [{ t: "stab", m: 1.5, always: true }],
  "Aura Break": [{ t: "auraBreak" }],
  "Bad Dreams": [{ t: "tick", foeHurt: 0.125, cond: "foeSlp" }],
  "Barrier of Ice": [{ t: "capEff", type: ["Fighting", "Fire", "Rock", "Steel"], max: 1 }],
  "Battle Armor": [{ t: "noCrit" }],
  "Beast Boost": [{ t: "ko", boost: "best" }],
  "Best Operation": [stabT("Fighting", 2.35)],
  Blaze: pinch("Fire"),
  "Bloodthirsty Increase": [{ t: "dmg", m: 1.5, cond: "hp50" }],
  Chlorophyll: [{ t: "stat", s: "spe", m: 2, cond: "sun" }],
  "Clear Body": [{ t: "noDrop" }],
  "Cloud Nine": [{ t: "noWeather" }],
  Competitive: [{ t: "onDropped", boost: B("spa", 2) }],
  "Crossed Lightning": [{ t: "dmg", m: 1.5, type: "Electric", after: true }, { t: "onHit", type: "Electric", foe: B("spd", -1) }],
  "Crustal barriers": [{ t: "onHurt", p: 0.2, self: [B("def", 1)], heal: 0.1 }],
  "Cursed Life": [{ t: "survive", cond: "crit", heal: 1 }],
  "Cute Charm": [{ t: "onHurt", contact: true, p: 0.3, status: "inf" }],
  Damp: [{ t: "inert", why: "explode" }],
  "Dark Aura": [{ t: "aura", type: "Dark", m: 1.33 }],
  "Dark Forest Shield": [{ t: "taken", m: 0.25, type: ["Fire", "Ice"] }],
  "Darkness descends": [{ t: "pressure", n: 1 }, { t: "onHit", p: 0.45, self: B(ATKS, 1, true) }],
  "Defence of the Chirp Bug": [{ t: "onHurt", p: 0.45, self: [B(DEFS, 1, true)] }],
  Defiant: [{ t: "onDropped", boost: B("atk", 2) }],
  "Delta Stream": [{ t: "weather", w: "wind" }],
  "Desolate Land": [{ t: "weather", w: "harshsun" }],
  "Destruction Aura": [stabT("Water", 2.35), { t: "stat", s: "spe", m: 2, cond: "rain" }],
  Deterrent: [{ t: "itemJam" }],
  "Diamond Storm": [{ t: "accField", type: ["Water", "Grass"], m: 0.7 }],
  Download: [{ t: "download" }],
  "Dragon Core Elite": [{ t: "onHit", type: "Dragon", p: 0.15, self: B(DEFS, 1, true) }],
  "Dragon Power": [{ t: "dmg", m: 1.5 }, { t: "onHit", p: 0.3, self: B(ATKS, 1, true) }],
  "Dragon Refuge": [{ t: "onHurt", type: ["Fairy", "Ice"], reflect: 0.7 }],
  "Dragon Roar": [stabT(["Dragon", "Dark"], 2.2), { t: "crit", n: 1 }],
  "Dragon Skin": [{ t: "taken", m: 2, type: "Dragon" }, { t: "taken", m: 0.5, except: "Dragon" }],
  "Dragon spine armour": [{ t: "taken", m: 0.8 }, { t: "onHurt", healDmg: 0.3 }],
  "Dragon's Breath Dense": [{ t: "onHurt", p: 0.3, foe: B("acc", -1) }],
  Drought: [{ t: "weather", w: "sun" }],
  "Dry Skin": [{ t: "immune", type: "Water", heal: 0.25 }, { t: "taken", m: 1.25, type: "Fire" }],
  "Early Bird": [{ t: "sleepFast" }],
  "Earth Diversion": [{ t: "immune", type: "Water", boost: B("def", 1) }],
  "Effect Spore": [{ t: "onHurt", contact: true, p: 0.3, status: ["psn", "par", "slp"] }],
  "Electrostatic fields": [{ t: "onHit", p: 0.3, status: "par" }, { t: "onHurt", p: 0.3, status: "par" }],
  "Extreme Download": [{ t: "download" }, { t: "tick", every: 2, download: true }],
  "Fairy Aura": [{ t: "aura", type: "Fairy", m: 1.33 }],
  "Fierce Body": [{ t: "onHurt", p: 0.5, self: [B("eva", 1, false, 3)] }],
  "Fierce Fright": [{ t: "onHit", p: 0.3, foe: B(DEFS, -1, true) }],
  "Fierce Power": [{ t: "minEff", type: "Dark", min: 1.5 }],
  "Fierce Roar": [{ t: "onHit", p: 0.15, self: B(ATKS, 1, true) }],
  Filter: [{ t: "taken", m: 0.75, se: true }],
  "Fire burning": [{ t: "enter", p: 0.1, self: [B("atk", 1)] }],
  "Fire force": [{ t: "onHit", p: 0.1, status: "brn" }],
  "Fire infusion": [{ t: "onHit", cat: 0, p: 0.1, self: B("def", 2) }],
  "Fire shield": [{ t: "taken", m: 0.5, type: ["Water", "Ground", "Fighting"] }],
  "Fire skin": [{ t: "convert", to: "Fire", m: 1.2 }],
  "Flame Body": [{ t: "onHurt", contact: true, p: 0.3, status: "brn" }],
  "Flash Fire": [{ t: "immune", type: "Fire" }, { t: "dmg", m: 1.15, type: "Fire" }],
  "Flower Veil": [{ t: "noDrop", ifType: "Grass" }],
  Frisk: [{ t: "enter", reveal: "item" }],
  "Full Metal Body": [{ t: "noDrop" }],
  "Fur Coat": [{ t: "taken", m: 0.5, cat: 0 }],
  "Geocentric Convergence": [{ t: "negate", p: 0.3, drainCur: 0.2 }],
  "Ghost Bomb": [{ t: "onHurt", reflect: 0.3 }],
  "Ghost Dodge": [{ t: "dodge", p: 0.15 }],
  "Ghostly Flames": [{ t: "onHurt", p: 0.5, status: "brn" }],
  "Ghostly Traits": [{ t: "noCrit" }, { t: "crit", n: 1 }],
  "Ghostly Tunic": [{ t: "randImmune", n: 6 }],
  Gooey: [{ t: "onHurt", contact: true, foe: B("spe", -1) }],
  "Grass Pelt": [{ t: "stat", s: "def", m: 1.25 }],
  Guts: [{ t: "stat", s: "atk", m: 1.5, cond: "status" }],
  "Hard scales": [{ t: "onHurt", p: 0.3, self: [B(DEFS, 2, true)] }],
  "Highly imitative of virtual systems": [{ t: "trace" }],
  "Highly toxic sulphuric acid": [{ t: "onHit", p: 0.3, foe: B("spd", -1) }],
  "Huge Power": [{ t: "stat", s: "atk", m: 2 }],
  Hustle: [{ t: "stat", s: "atk", m: 1.5 }, { t: "acc", m: 0.8, cat: 0 }],
  Hydration: [{ t: "cure", cond: "rain" }],
  "Hyper Cutter": [{ t: "noDrop", stats: ["atk"] }],
  "Ice Body": [{ t: "tick", heal: 0.0625, cond: "hail" }],
  "Ice Curtain": [{ t: "tick", self: [B(["spe", "eva"], 1, true, 3)] }],
  "Ice and snow": [{ t: "weather", w: "hail" }, { t: "enter", self: [B("spe", 1)] }],
  "Immortal alloy": [{ t: "immune", type: ["Ground", "Fighting", "Fire"] }],
  Immunity: [{ t: "statusImmune", list: ["psn"] }],
  "Infinite Deep Sleep": [{ t: "tick", heal: 0.125, cond: "foeSlp" }, { t: "tick", foeHurt: 0.125, cond: "foeSlp" }],
  "Infinity Sea": [{ t: "weather", w: "heavyrain" }, { t: "tick", heal: 0.125, ifType: "Water" }],
  "Inner Focus": [{ t: "statusImmune", list: ["fln"] }],
  Insomnia: [{ t: "statusImmune", list: ["slp"] }],
  Intimidate: [{ t: "enter", foe: [B("atk", -1)] }],
  "Iron Fist": [{ t: "dmg", m: 1.2, name: RE_PUNCH }],
  "Keen Eye": [{ t: "noDrop", stats: ["acc"] }],
  "Killing Compulsions Come": [{ t: "onHit", p: 0.45, self: B(ATKS, 1, true) }],
  "Leaf Guard": [{ t: "statusImmune", list: ["all"], cond: "sun" }],
  Levitate: [{ t: "immune", type: "Ground" }],
  "Lightning Rod": [{ t: "immune", type: "Electric", boost: B("spa", 1) }],
  "Lightning charge": [{ t: "onHit", type: "Electric", p: 0.3, status: "par" }, { t: "onHit", type: "Electric", p: 0.5, self: B("spa", 1) }],
  "Lightning energy storage": [{ t: "onHit", type: "Electric", self: B(["spa", "spe"], 1, true, 3) }],
  "Liquid Metals": [{ t: "enter", self: [B("def", 1), B("spd", 1)] }],
  "Lunar Eclipse": [{ t: "tick", heal: 0.05 }, stabT("Fairy", 2.2)],
  "Magic Guard": [{ t: "noChip" }],
  "Magic Psychic Defence": [{ t: "onHurt", p: 0.25, self: [B(DEFS, 1, true)] }],
  "Magic Psychic Pact": [{ t: "dmg", m: 1.75, cond: "hp50" }],
  "Marvel Scale": [{ t: "stat", s: "def", m: 1.5, cond: "status" }],
  "Mental Suppression": [{ t: "pressure", n: 2 }, { t: "dmg", m: 1.15 }],
  "Mist of the Dark Forest": [{ t: "onHit", type: "Grass", p: 0.3, status: "slp" }],
  "Misty  Formation": [{ t: "accField", type: ["Water", "Grass", "Ice"], m: 0.7 }],
  "Mold Breaker": [{ t: "ignoreAbility" }],
  "Motor Drive": [{ t: "immune", type: "Electric", boost: B("spe", 1, false, 3) }],
  Moxie: [{ t: "ko", boost: B("atk", 1) }],
  Multiscale: [{ t: "taken", m: 0.5, cond: "full" }],
  "Natural Cure": [{ t: "switchOut", cure: true }],
  "No Guard": [{ t: "noMiss" }],
  "Omega Airflow": [{ t: "weather", w: "wind" }, { t: "tick", foe: B("acc", -1, false, 3) }, stabT("Flying", 2.2)],
  "Ougi Strong Endurance": [{ t: "survive", cond: "crit" }],
  "Ougi. Block": [{ t: "onHurt", type: FSP, self: [B(DEFS, 1, true)] }],
  "Ougi. Chase": [{ t: "dmg", m: 0.7, type: "Fighting" }, { t: "onHit", type: "Fighting", p: 0.5, extra: true }],
  "Ougi. Flash": [{ t: "onHurt", type: FSP, self: [B(["spe", "eva"], 1, true)] }],
  "Ougi. Knockout": [{ t: "dmg", m: 0.6, type: "Fighting" }, { t: "onHit", type: "Fighting", drain: 0.3 }],
  Overgrow: pinch("Grass"),
  "Own Tempo": [{ t: "statusImmune", list: ["cnf"] }],
  "Phoenix Nirvana": [{ t: "survive", cond: "any", heal: 1 }],
  Pixilate: [{ t: "convert", to: "Fairy", m: 1.2 }],
  "Poison Point": [{ t: "onHurt", contact: true, p: 0.3, status: "psn" }],
  "Poison wound armour": [{ t: "onHurt", beads: 5, blast: 0.2 }],
  "Positive and negative charges": [{ t: "tick", cond: "behind", self: [B("def", 1, false, 3), B("spd", 1, false, 3)] }],
  "Power Burst": [{ t: "stat", s: "atk", m: 2.5 }],
  Pressure: [{ t: "pressure", n: 1 }],
  "Primal Power": [{ t: "immune", type: "Ground" }, { t: "enter", self: [B("spe", 1)] }],
  "Primordial Sea": [{ t: "weather", w: "heavyrain" }],
  "Prismatic Core": [{ t: "enter", gauge: 100 }],
  Protean: [{ t: "stab", m: 1.5, always: true }],
  "Psychic Power": [stabT("Psychic", 2.35), { t: "pressure", n: 1 }],
  "Quick Feet": [{ t: "stat", s: "spe", m: 1.5, cond: "status" }],
  "Rain Dish": [{ t: "tick", heal: 0.0625, cond: "rain" }],
  Reckless: [{ t: "dmg", m: 1.2, name: new RegExp(`^(${Object.keys(RECOIL_MOVES).join("|")})$`) }],
  Refrigerate: [{ t: "convert", to: "Ice", m: 1.2 }],
  Regenerator: [{ t: "switchOut", heal: 0.33 }],
  "Rock Head": [{ t: "noRecoil" }],
  "Rough Skin": [{ t: "onHurt", contact: true, reflectMax: 0.125 }],
  "Sand Stream": [{ t: "weather", w: "sand" }],
  "Sand Veil": [{ t: "dodge", p: 0.2, cond: "sand" }],
  "Sap Sipper": [{ t: "immune", type: "Grass", boost: B("atk", 1) }],
  Scrappy: [{ t: "scrappy" }],
  "Serene Grace": [{ t: "serene" }],
  "Shadow Tag": [{ t: "trap" }],
  "Sharp alloy": [stabT("Steel", 2.2)],
  "Shed Skin": [{ t: "cure", p: 0.3 }],
  "Shell Armor": [{ t: "noCrit" }],
  "Shield Dust": [{ t: "shieldDust" }],
  "Shield of Bravery": [{ t: "onHurt", reflect: 0.4 }],
  "Shield of Water": [{ t: "onHurt", moveName: "Close Combat", p: 0.3, heal: 0.2 }],
  "Skill Link": [{ t: "inert", why: "multi" }],
  Sniper: [{ t: "critDmg", m: 1.5 }],
  "Snow Cloak": [{ t: "dodge", p: 0.2, cond: "hail" }],
  "Snow Warning": [{ t: "weather", w: "hail" }],
  "Solar Eclipse": [{ t: "tick", heal: 0.05 }, stabT("Dark", 2.2)],
  "Solar Power": [{ t: "stat", s: "spa", m: 1.5, cond: "sun" }, { t: "tick", selfHurt: 0.125, cond: "sun" }],
  "Solid Rock": [{ t: "taken", m: 0.75, se: true }],
  "Soothing Songs": [{ t: "onHit", p: 0.1, clearFoeBoosts: true }],
  Soundproof: [{ t: "soundproof" }],
  "Speed Boost": [{ t: "tick", every: 2, self: [B("spe", 1, false, 3)] }],
  "Spell of Magic Psychic": [{ t: "immune", type: ["Poison", "Steel"] }],
  "Spikes of the Spinel": [{ t: "dmg", m: 1.3, type: "Rock" }, { t: "onHit", type: "Rock", p: 0.3, flinch: true }],
  Stall: [{ t: "speed", m: 0.7 }],
  Static: [{ t: "onHurt", contact: true, p: 0.3, status: "par" }],
  Steadfast: [{ t: "onFlinch", boost: B("spe", 1) }],
  "Stone blockade": [{ t: "trap" }, { t: "enter", foe: [B("spe", -1)] }],
  "Storm Drain": [{ t: "immune", type: "Water", boost: B("spa", 1) }],
  "Strong Jaw": [{ t: "dmg", m: 1.5, name: RE_BITE }],
  Sturdy: [{ t: "survive", cond: "full" }],
  "Super Luck": [{ t: "crit", n: 1 }],
  "Super Psychic Constraints": [{ t: "dmg", m: 2, cond: "full" }],
  "Super Psychic Deterrence": [{ t: "onHit", p: 0.3, foe: B(ATKS, -1, true) }],
  "Super Psychic Piercing": [{ t: "onHit", p: 0.15, foe: B(DEFS, -1, true) }],
  "Super Psychic Premonition": [{ t: "onHurt", p: 0.5, self: [B("eva", 1, false, 3)] }],
  "Sweet Veil": [{ t: "statusImmune", list: ["slp"] }],
  "Swift Swim": [{ t: "stat", s: "spe", m: 2, cond: "rain" }],
  "Sword of Judgement": [{ t: "minEff", type: "Fighting", min: 2 }],
  Synchronize: [{ t: "sync" }],
  "Tangled Feet": [{ t: "dodge", p: 0.25, cond: "cnf" }],
  Technician: [{ t: "dmg", m: 1.5, maxPow: 60 }],
  Teravolt: [{ t: "ignoreAbility" }],
  "The Chirp Bug Spell": [{ t: "immune", type: ["Flying", "Rock", "Fire"] }],
  "The Chirp Bug's Pact": [{ t: "dmg", m: 1.5, cond: "hp60" }],
  "The Coming of the Psychic": [{ t: "dmg", m: 1.2 }, { t: "onHit", p: 0.5, foe: B(ATKS, -1, true) }],
  "The Gift of Heaven": [stabT(["Normal", "Dark"], 2.35), { t: "pressure", n: 1 }],
  "The Mirror of Darkness": [{ t: "onHurt", p: 0.5, self: [B("eva", 1, false, 3)] }],
  "The Power of Chirp Bug": [{ t: "minEff", type: "Bug", min: 1.5 }],
  "The Power of Dark Forest": [stabT("Grass", 1.7)],
  "The Power of Draw Water": [{ t: "pierce", type: "Water" }],
  "The Power of Gushing": [{ t: "tick", heal: 0.125 }],
  "The Power of Quicksand": [{ t: "weather", w: "sand" }, { t: "tick", foe: B("spe", -1, false, 3) }],
  "The Power of Speed Water": [{ t: "dmg", m: 1.2, se: true }],
  "The Power of Super Psychic": [{ t: "minEff", type: "Psychic", min: 2 }],
  "The Power of Waves": [{ t: "onHit", type: "Water", p: 0.3, status: "cnf" }],
  "The Power of the Dragon": [stabT("Dragon", 2.5), { t: "onHit", type: "Dragon", p: 0.5, foe: B("def", -1) }],
  "The Power of the Floating Ghost": [{ t: "dmg", m: 1.7, type: "Ghost" }, { t: "onHit", type: "Ghost", self: B("def", -1, false, 3) }],
  "The Soul of Poseidon": [{ t: "tick", p: 0.5, foe: B("spe", -1, false, 3) }],
  "The Source of the Dark Forest": [{ t: "healBoost", m: 2 }],
  "The earth rushes": [stabT("Ground", 2.5), { t: "onHit", type: "Ground", p: 0.5, foe: B("acc", -1) }],
  "The power of Magic Psychic": [{ t: "minEff", type: "Fairy", min: 1.5 }],
  "The ultimate bond": [{ t: "bond" }],
  "Thick Fat": [{ t: "taken", m: 0.5, type: ["Fire", "Ice"] }],
  "Tinted Lens": [{ t: "dmg", m: 2, nve: true }],
  Torrent: pinch("Water"),
  "Tough Claws": [{ t: "dmg", m: 1.3, cat: 0 }],
  "Toxic gas outbreak": [{ t: "dmg", m: 2, type: "Poison" }, { t: "tick", every: 3, self: [B(DEFS, -1, true, 3)] }],
  Trace: [{ t: "trace" }],
  Turboblaze: [{ t: "ignoreAbility" }],
  "Ultimate Alloy": [{ t: "enter", self: [B("atk", 2), B("spa", 2)] }, stabT("Steel", 2.2)],
  "Ultimate Aura": [{ t: "enter", self: [B("atk", 1), B("spa", 1)] }, stabT("Psychic", 2.2)],
  "Ultimate Beam": [{ t: "pressure", n: 1 }, { t: "onHit", p: 0.45, self: B(ATKS, 1, true) }],
  "Ultimate Blood Blade": [{ t: "tick", selfHurt: 0.01 }, { t: "statusImmune", list: ["all"] }, { t: "dmg", m: 1.25 }],
  "Ultimate Bondage": [{ t: "pressure", n: 1 }, { t: "onHit", p: 0.45, self: B(ATKS, 1, true) }],
  "Ultimate Boxing": [{ t: "pressure", n: 1 }, { t: "dmg", m: 1.5, name: RE_PUNCH }],
  "Ultimate Claw Attack": [{ t: "enter", self: [B("atk", 1), B("spa", 1)] }, stabT(["Dark", "Ice"], 2.2)],
  "Ultimate Devouring": [stabT(["Dragon", "Flying"], 2.2), { t: "crit", n: 1 }],
  "Ultimate Evil Claws": [stabT(["Dark", "Fighting"], 2.2), { t: "crit", n: 1 }],
  "Ultimate Evil Kill": [{ t: "enter", self: [B("atk", 1), B("spa", 1)] }, stabT(["Dark", "Flying"], 2.2)],
  "Ultimate Fighting": [{ t: "enter", self: [B("def", 1), B("spd", 1)] }, stabT("Fighting", 2.2)],
  "Ultimate Flux": [stabT("Water", 2.2), { t: "crit", n: 1 }, { t: "speed", m: 1.3 }],
  "Ultimate Kick": [stabT("Fire", 2.2), { t: "stat", s: "spe", m: 2, cond: "sun" }],
  "Ultimate Lightning": [stabT("Electric", 2.2), { t: "tick", p: 0.3, self: [B("spe", 1, false, 3)] }],
  "Ultimate Ninjutsu": [{ t: "stab", m: 1.5, always: true }, stabT("Water", 2.2)],
  "Ultimate Potential": [{ t: "dmg", m: 2.5, type: "Fire", cond: "hp50" }],
  "Ultimate Secrets": [{ t: "statusImmune", list: ["slp"] }],
  "Ultimate Sun": [{ t: "weather", w: "harshsun" }, { t: "tick", foeHurt: 0.125, ifFoeNot: "Fire" }],
  "Ultimate Water Cannon": [{ t: "pressure", n: 1 }, stabT("Water", 2.2)],
  "Ultimate Wings": [{ t: "pressure", n: 1 }, { t: "onHit", p: 0.45, self: B(ATKS, 1, true) }],
  "Ultimate Wormhole": [{ t: "dmg", m: 1.3, cond: "status" }],
  Unburden: [{ t: "stat", s: "spe", m: 1.5, cond: "noItem" }],
  Unnerve: [{ t: "inert", why: "berry" }],
  "Venom shield": [{ t: "immune", type: "Ground", boost: B(DEFS, 1, true) }],
  "Vicious Pursuit": [{ t: "dmg", m: 1.5, vs: "psn" }],
  "Vital Spirit": [{ t: "statusImmune", list: ["slp"] }],
  "Volt Absorb": [{ t: "immune", type: "Electric", heal: 0.25 }],
  "Water Absorb": [{ t: "immune", type: "Water", heal: 0.25 }],
  "Water Veil": [{ t: "statusImmune", list: ["brn"] }],
  "Weak Armor": [{ t: "onHurt", contact: true, self: [B("def", -1), B("spe", 2)] }],
  "White Smoke": [{ t: "noDrop" }],
  // classic abilities that appear in some forms' data under these names
  "Wonder Guard": [],
  "Pure Power": [{ t: "stat", s: "atk", m: 2 }],
  "Storm Drain ": [],
};
delete ABILITIES["Wonder Guard"];
delete ABILITIES["Storm Drain "];

export const fxOf = (ability: string): Fx[] => ABILITIES[ability] ?? [];
export const isInert = (ability: string) => fxOf(ability).length > 0 && fxOf(ability).every((f) => f.t === "inert");

/* ------------------------------------------------------------------ plain-language summaries */

type L = [bn: string, en: string];
const pick = (l: L, lang: "bn" | "en") => (lang === "en" ? l[1] : l[0]);
const list = (x?: T) => (x === undefined ? "" : Array.isArray(x) ? x.join("/") : x);
const COND: Record<Cond, L> = {
  low: ["HP কম হলে", "at low HP"], hp50: ["HP ৫০%-এর নিচে", "below 50% HP"], hp60: ["HP ৬০%-এর নিচে", "below 60% HP"], full: ["পূর্ণ HP-তে", "at full HP"],
  sun: ["রোদে", "in sun"], rain: ["বৃষ্টিতে", "in rain"], sand: ["বালিঝড়ে", "in a sandstorm"], hail: ["শিলাবৃষ্টিতে", "in hail"],
  status: ["স্ট্যাটাস থাকলে", "with a status"], behind: ["HP কম থাকলে", "when behind on HP"], foeSlp: ["প্রতিপক্ষ ঘুমালে", "while the foe sleeps"],
  cnf: ["বিভ্রান্ত থাকলে", "while confused"], noItem: ["আইটেম না থাকলে", "with no held item"],
};
const STATUS: Record<Status | "fln" | "all", L> = {
  brn: ["পোড়া", "burn"], psn: ["বিষ", "poison"], par: ["প্যারালাইসিস", "paralysis"], slp: ["ঘুম", "sleep"], cnf: ["বিভ্রান্তি", "confusion"], inf: ["মোহ", "infatuation"], fln: ["ফ্লিঞ্চ", "flinching"], all: ["সব স্ট্যাটাস", "all status effects"],
};
const STAT: Record<Stat, L> = { atk: ["অ্যাটাক", "Atk"], def: ["ডিফেন্স", "Def"], spa: ["স্পে. অ্যাটাক", "SpA"], spd: ["স্পে. ডিফেন্স", "SpD"], spe: ["গতি", "Speed"], acc: ["নির্ভুলতা", "Accuracy"], eva: ["ফাঁকি", "Evasion"] };
const WEATHER: Record<Weather, L> = {
  sun: ["রোদ", "sun"], rain: ["বৃষ্টি", "rain"], sand: ["বালিঝড়", "sandstorm"], hail: ["শিলাবৃষ্টি", "hail"], harshsun: ["প্রচণ্ড রোদ (পানির চাল বাতিল)", "harsh sun (Water moves fail)"],
  heavyrain: ["প্রবল বৃষ্টি (আগুনের চাল বাতিল)", "heavy rain (Fire moves fail)"], wind: ["ডেল্টা স্ট্রিম (ফ্লাইং-এর দুর্বলতা ঢাকে)", "Delta Stream (covers Flying's weaknesses)"],
};
const stats = (b: Boost, lang: "bn" | "en") => {
  const names = (Array.isArray(b.s) ? b.s : [b.s]).map((s) => pick(STAT[s], lang));
  const who = Array.isArray(b.s) && b.s.length > 1 ? (b.any ? names.join(lang === "en" ? " or " : " বা ") : names.join(" & ")) : names[0];
  return `${who} ${b.n > 0 ? "+" : ""}${b.n}`;
};
const chance = (p: number | undefined) => (p && p < 1 ? `${Math.round(p * 100)}%` : "");
const times = (m: number) => `×${Math.round(m * 100) / 100}`;

function phrase(f: Fx, lang: "bn" | "en"): string | null {
  const en = lang === "en";
  const c = (cond?: Cond) => (cond ? ` (${pick(COND[cond], lang)})` : "");
  switch (f.t) {
    case "dmg": {
      const what = f.type ? `${list(f.type)} ${en ? "moves" : "চাল"}` : f.name ? (f.name === RE_PUNCH ? (en ? "punching moves" : "ঘুসির চাল") : f.name === RE_BITE ? (en ? "biting moves" : "কামড়ের চাল") : en ? "recoil moves" : "রিকয়েল চাল") : f.cat === 0 ? (en ? "physical moves" : "ফিজিক্যাল চাল") : f.maxPow ? (en ? `moves ≤${f.maxPow} power` : `≤${f.maxPow} পাওয়ারের চাল`) : en ? "all moves" : "সব চাল";
      const extra = f.se ? (en ? ", if super effective" : ", কার্যকর হলে") : f.nve ? (en ? ", if not very effective" : ", কম কার্যকর হলে") : f.vs ? (en ? `, vs ${pick(STATUS[f.vs], lang)}` : `, ${pick(STATUS[f.vs], lang)} থাকা প্রতিপক্ষে`) : f.after ? (en ? ", after a non-Electric move" : ", অন্য টাইপের চালের পরে") : "";
      return `${what} ${times(f.m)}${extra}${c(f.cond)}`;
    }
    case "stab": return f.always ? (en ? "every move gets STAB" : "প্রতিটি চালে STAB") : `${f.type ? list(f.type) + " " : ""}STAB ${times(f.m)}`;
    case "taken": return `${en ? "damage taken" : "ক্ষতি"} ${times(f.m)}${f.type ? ` ${en ? "from" : ""} ${list(f.type)}` : f.except ? ` ${en ? "except" : "বাদে"} ${list(f.except)}` : f.cat === 0 ? (en ? " (physical)" : " (ফিজিক্যাল)") : f.se ? (en ? " (super effective)" : " (কার্যকর চালে)") : ""}${c(f.cond)}`;
    case "capEff": return en ? `${list(f.type)} hits never do more than ×${f.max}` : `${list(f.type)} চাল ×${f.max}-এর বেশি ক্ষতি করে না`;
    case "minEff": return en ? `${list(f.type)} moves hit at least ×${f.min} on any type` : `${list(f.type)} চাল যেকোনো টাইপে কমপক্ষে ×${f.min}`;
    case "stat": return `${pick(STAT[f.s], lang)} ${times(f.m)}${c(f.cond)}`;
    case "immune": return `${en ? "immune to" : "অক্ষত:"} ${list(f.type)}${f.heal ? (en ? ` and heals ${f.heal * 100}%` : `, ${f.heal * 100}% HP ফেরে`) : ""}${f.boost ? `, ${stats(f.boost, lang)}` : ""}`;
    case "convert": return en ? `Normal moves become ${f.to} (${times(f.m)})` : `নরমাল চাল ${f.to} হয়ে যায় (${times(f.m)})`;
    case "weather": return en ? `summons ${pick(WEATHER[f.w], lang)}` : `${pick(WEATHER[f.w], lang)} ডাকে`;
    case "noWeather": return en ? "cancels weather" : "আবহাওয়ার প্রভাব বাতিল";
    case "aura": return en ? `${f.type} moves ×${f.m} for everyone` : `সবার ${f.type} চাল ×${f.m}`;
    case "auraBreak": return en ? "reverses Auras" : "অরার প্রভাব উল্টে দেয়";
    case "accField": return en ? `${list(f.type)} moves ${times(f.m)} accuracy` : `${list(f.type)} চালের নির্ভুলতা ${times(f.m)}`;
    case "enter": {
      const parts: string[] = [];
      if (f.self?.length) parts.push((f.p ? `${chance(f.p)} ` : "") + f.self.map((b) => stats(b, lang)).join(", "));
      if (f.foe?.length) parts.push((en ? "foe " : "প্রতিপক্ষের ") + f.foe.map((b) => stats(b, lang)).join(", "));
      if (f.gauge) parts.push(en ? "strikes first" : "প্রথমে আঘাত করে");
      if (f.reveal) parts.push(f.reveal === "item" ? (en ? "reveals the foe's item" : "প্রতিপক্ষের আইটেম দেখায়") : f.reveal === "move" ? (en ? "reveals the foe's best move" : "প্রতিপক্ষের সেরা চাল দেখায়") : en ? "senses dangerous moves" : "বিপজ্জনক চাল টের পায়");
      return `${en ? "on entry:" : "নামলে:"} ${parts.join("; ")}`;
    }
    case "download": return en ? "on entry: boosts Atk or SpA depending on the foe's weaker defence" : "নামলে: প্রতিপক্ষের দুর্বল ডিফেন্স অনুযায়ী অ্যাটাক/স্পে. অ্যাটাক বাড়ে";
    case "trace": return en ? "copies the foe's ability" : "প্রতিপক্ষের অ্যাবিলিটি কপি করে";
    case "onHit": {
      const parts: string[] = [];
      if (f.status) parts.push((Array.isArray(f.status) ? f.status : [f.status]).map((s) => pick(STATUS[s], lang)).join("/"));
      if (f.self) parts.push((en ? "own " : "নিজের ") + stats(f.self, lang));
      if (f.foe) parts.push((en ? "foe " : "প্রতিপক্ষের ") + stats(f.foe, lang));
      if (f.flinch) parts.push(en ? "flinch" : "ফ্লিঞ্চ");
      if (f.drain) parts.push(en ? `heals ${Math.round(f.drain * 100)}% of damage` : `ক্ষতির ${Math.round(f.drain * 100)}% HP ফেরে`);
      if (f.extra) parts.push(en ? "strikes again" : "আবার আঘাত করে");
      if (f.clearFoeBoosts) parts.push(en ? "strips the foe's boosts" : "প্রতিপক্ষের বাড়তি স্ট্যাট মুছে দেয়");
      return `${chance(f.p)} ${en ? "when hitting" : "আঘাত করলে"}${f.type ? ` (${list(f.type)})` : f.cat === 0 ? (en ? " (physical)" : " (ফিজিক্যাল)") : ""}: ${parts.join(", ")}`.trim();
    }
    case "onHurt": {
      const parts: string[] = [];
      if (f.status) parts.push((en ? "inflicts " : "দেয় ") + (Array.isArray(f.status) ? f.status : [f.status]).map((s) => pick(STATUS[s], lang)).join("/"));
      if (f.self?.length) parts.push((en ? "own " : "নিজের ") + f.self.map((b) => stats(b, lang)).join(", "));
      if (f.foe) parts.push((en ? "attacker's " : "আক্রমণকারীর ") + stats(f.foe, lang));
      if (f.reflect) parts.push(en ? `reflects ${Math.round(f.reflect * 100)}% of the damage` : `ক্ষতির ${Math.round(f.reflect * 100)}% ফেরত পাঠায়`);
      if (f.reflectMax) parts.push(en ? `hurts the attacker for ${f.reflectMax * 100}% of its HP` : `আক্রমণকারীর HP-র ${f.reflectMax * 100}% কাটে`);
      if (f.heal) parts.push(en ? `heals ${f.heal * 100}%` : `${f.heal * 100}% HP ফেরে`);
      if (f.healDmg) parts.push(en ? `heals ${f.healDmg * 100}% of the damage taken` : `ক্ষতির ${f.healDmg * 100}% HP ফেরে`);
      if (f.beads) parts.push(en ? `after ${f.beads} hits, a poison burst hurts the foe ${f.blast! * 100}%` : `${f.beads}টি আঘাতের পর বিষ ফেটে প্রতিপক্ষের ${f.blast! * 100}% কাটে`);
      return `${chance(f.p)} ${en ? "when hit" : "আঘাত পেলে"}${f.contact ? (en ? " by physical moves" : " (ফিজিক্যাল)") : f.type ? ` (${list(f.type)})` : f.crit ? (en ? " by a critical hit" : " (ক্রিটিক্যাল)") : f.moveName ? ` (${f.moveName})` : ""}: ${parts.join(", ")}`.trim();
    }
    case "negate": return en ? `${f.p * 100}% to negate a hit and drain ${f.drainCur * 100}% of the attacker's HP` : `${f.p * 100}% সম্ভাবনায় আঘাত বাতিল করে আক্রমণকারীর ${f.drainCur * 100}% HP শুষে নেয়`;
    case "tick": {
      const parts: string[] = [];
      if (f.heal) parts.push(en ? `heals ${f.heal * 100}%` : `${f.heal * 100}% HP ফেরে`);
      if (f.selfHurt) parts.push(en ? `loses ${f.selfHurt * 100}% HP` : `${f.selfHurt * 100}% HP হারায়`);
      if (f.foeHurt) parts.push(en ? `foe loses ${f.foeHurt * 100}% HP` : `প্রতিপক্ষ ${f.foeHurt * 100}% HP হারায়`);
      if (f.self?.length) parts.push(f.self.map((b) => stats(b, lang)).join(", "));
      if (f.foe) parts.push((en ? "foe " : "প্রতিপক্ষের ") + stats(f.foe, lang));
      if (f.download) parts.push(en ? "re-downloads the foe's weakness" : "আবার দুর্বলতা ধরে");
      const every = (f.every ?? 1) * 3;
      return `${en ? `every ${every}s` : `প্রতি ${every}সে.`}${f.p ? ` (${chance(f.p)})` : ""}: ${parts.join(", ")}${f.ifType ? ` (${f.ifType}${en ? " type only" : " টাইপে"})` : ""}${c(f.cond)}`;
    }
    case "ko": return `${en ? "after a KO:" : "কাউকে হারালে:"} ${f.boost === "best" ? (en ? "boosts its best stat" : "সেরা স্ট্যাট বাড়ে") : stats(f.boost, lang)}`;
    case "crit": return en ? `crit rate +${f.n} stage` : `ক্রিটিক্যাল +${f.n}`;
    case "noCrit": return en ? "immune to critical hits" : "ক্রিটিক্যালে অক্ষত";
    case "critDmg": return en ? `crits do ${times(f.m)} more` : `ক্রিটিক্যালে ${times(f.m)} বেশি`;
    case "dodge": return en ? `${f.p * 100}% to dodge${c(f.cond)}` : `${f.p * 100}% ফাঁকি${c(f.cond)}`;
    case "acc": return `${f.cat === 0 ? (en ? "physical " : "ফিজিক্যাল ") : ""}${en ? "accuracy" : "নির্ভুলতা"} ${times(f.m)}`;
    case "noMiss": return en ? "never misses" : "কখনও ফসকায় না";
    case "statusImmune": return `${en ? "can't be" : "হয় না:"} ${f.list.map((s) => pick(STATUS[s], lang)).join("/")}${c(f.cond)}`;
    case "noDrop": return en ? `stats can't be lowered${f.stats ? ` (${f.stats.map((s) => pick(STAT[s], lang)).join("/")})` : ""}${f.ifType ? ` (${f.ifType} type)` : ""}` : `স্ট্যাট কমানো যায় না${f.stats ? ` (${f.stats.map((s) => pick(STAT[s], lang)).join("/")})` : ""}`;
    case "onDropped": return `${en ? "when a stat is lowered:" : "স্ট্যাট কমলে:"} ${stats(f.boost, lang)}`;
    case "onFlinch": return `${en ? "when it flinches:" : "ফ্লিঞ্চ করলে:"} ${stats(f.boost, lang)}`;
    case "survive": return f.cond === "full" ? (en ? "survives one fatal hit from full HP" : "পূর্ণ HP থেকে একটি মারাত্মক আঘাতে টিকে যায়") : f.cond === "crit" ? (en ? `survives a fatal critical hit${f.heal ? " and fully heals" : ""}` : `মারাত্মক ক্রিটিক্যালে টিকে যায়${f.heal ? " ও পূর্ণ HP ফেরে" : ""}`) : en ? `survives one fatal hit${f.heal ? " and fully heals" : ""}` : `একটি মারাত্মক আঘাতে টিকে যায়${f.heal ? " ও পূর্ণ HP ফেরে" : ""}`;
    case "pressure": return en ? `foe's moves cost +${f.n} PP` : `প্রতিপক্ষের চালে +${f.n} PP খরচ`;
    case "ignoreAbility": return en ? "ignores the foe's ability" : "প্রতিপক্ষের অ্যাবিলিটি উপেক্ষা করে";
    case "scrappy": return en ? "Normal/Fighting hit Ghosts" : "নরমাল/ফাইটিং ঘোস্টকে মারে";
    case "pierce": return en ? `${list(f.type)} moves ignore the foe's defence boosts` : `${list(f.type)} চাল প্রতিপক্ষের ডিফেন্স বুস্ট উপেক্ষা করে`;
    case "bestAtk": return en ? `${list(f.type)} moves use the higher of Atk/SpA` : `${list(f.type)} চাল অ্যাটাক/স্পে. অ্যাটাকের বড়টা ব্যবহার করে`;
    case "speed": return f.m > 1 ? (en ? `charges ${Math.round((f.m - 1) * 100)}% faster` : `${Math.round((f.m - 1) * 100)}% দ্রুত চার্জ`) : en ? `charges ${Math.round((1 - f.m) * 100)}% slower` : `${Math.round((1 - f.m) * 100)}% ধীরে চার্জ`;
    case "trap": return en ? "the foe can't switch out" : "প্রতিপক্ষ বদলাতে পারে না";
    case "noChip": return en ? "no damage from status or weather" : "স্ট্যাটাস/আবহাওয়ায় ক্ষতি হয় না";
    case "noRecoil": return en ? "no recoil damage" : "রিকয়েল ক্ষতি হয় না";
    case "soundproof": return en ? "immune to sound moves" : "শব্দের চালে অক্ষত";
    case "switchOut": return `${en ? "when switched out:" : "বদলে গেলে:"} ${f.cure ? (en ? "cures its status" : "স্ট্যাটাস সারে") : en ? `heals ${Math.round((f.heal ?? 0) * 100)}%` : `${Math.round((f.heal ?? 0) * 100)}% HP ফেরে`}`;
    case "cure": return en ? `${f.p ? chance(f.p) + " " : ""}cures its status${f.cond ? ` ${pick(COND[f.cond], lang)}` : " over time"}` : `${f.p ? chance(f.p) + " " : ""}স্ট্যাটাস সারে${f.cond ? ` ${pick(COND[f.cond], lang)}` : ""}`;
    case "healBoost": return en ? `healing ${times(f.m)}` : `হিলিং ${times(f.m)}`;
    case "sync": return en ? "passes burn/poison/paralysis back" : "পোড়া/বিষ/প্যারালাইসিস ফেরত দেয়";
    case "sleepFast": return en ? "wakes up faster" : "তাড়াতাড়ি জাগে";
    case "shieldDust": return en ? "blocks the extra effects of hits" : "আঘাতের বাড়তি প্রভাব আটকায়";
    case "itemJam": return en ? "the foe's held item stops working" : "প্রতিপক্ষের আইটেম কাজ করে না";
    case "bond": return en ? "all stats +2% per fainted ally (max +10%)" : "প্রতিটি পড়ে যাওয়া সঙ্গীর জন্য সব স্ট্যাট +২% (সর্বোচ্চ +১০%)";
    case "randImmune": return en ? `immune to ${f.n} random types, reshuffled every turn` : `প্রতি টার্নে এলোমেলো ${f.n}টি টাইপে অক্ষত`;
    case "aftermath": return en ? `hurts the attacker ${f.frac * 100}% of its HP when KO'd by a physical hit` : `ফিজিক্যাল আঘাতে পড়ে গেলে আক্রমণকারীর ${f.frac * 100}% HP কাটে`;
    case "serene": return en ? "doubles the chance of extra effects" : "বাড়তি প্রভাবের সম্ভাবনা দ্বিগুণ";
    case "inert": return f.why === "multi" ? (en ? "no effect here (no multi-hit moves)" : "এখানে কাজ করে না (মাল্টি-হিট চাল নেই)") : f.why === "berry" ? (en ? "no effect here (no berries)" : "এখানে কাজ করে না (বেরি নেই)") : en ? "no effect here (no explosive moves)" : "এখানে কাজ করে না (বিস্ফোরণের চাল নেই)";
    default: return null;
  }
}

/** What an ability does in this engine, in the reader's language. */
export function abilitySummary(ability: string, lang: "bn" | "en"): string {
  const fx = fxOf(ability);
  if (!fx.length) return "";
  return fx.map((f) => phrase(f, lang)).filter(Boolean).join(" · ");
}
