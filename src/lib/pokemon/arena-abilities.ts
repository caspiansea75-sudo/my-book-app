/**
 * Abilities for the real-time Brawl: every Pokémon has its own (slot 1, sometimes slot 2 for the computer, and a hidden one).
 *
 * The turn-based abilities are rewritten as small effects that make sense in real time: a "turn" is a second or so, "stages"
 * are temporary damage / speed boosts, "switch-in" is the start of the fight (or the moment a Pokémon steps in), and abilities
 * that only matter in turn-based play (held items, held-item thieves, priority, PP, accuracy...) simply do nothing here and say so.
 * The engine reads `fx` at a few fixed places (damage dealt and taken, status, the tick, KOs, the start of a fight).
 */
import type { FieldKind, MoveDef, StatusKind } from "./arena-data";

/** A temporary change: damage dealt, speed, and damage taken, for `t` seconds (`type` limits the damage boost to moves of those types). */
export type Gain = { dmg?: number; spd?: number; take?: number; t: number; type?: string[] };

export type AbFx = {
  /** Damage dealt: multiplied when all the conditions hold (low: at 1/3 life or less, status: it has a status, weak: a weak move, foeFaster: the target is faster). */
  boost?: { mul: number; type?: string[]; low?: boolean; status?: boolean; weak?: boolean; name?: RegExp; field?: FieldKind; foeFaster?: boolean; secondary?: boolean }[];
  /** Everything it does is multiplied by this (a Pure Power attack stat). */
  power?: number;
  /** Extra multiplier on the same-type bonus. */
  stabMul?: number;
  /** Every move gets the same-type bonus (Protean, Libero). */
  protean?: boolean;
  /** Multiplier when a move is not very effective. */
  tinted?: number;
  crit?: number;
  critX?: number;
  /** Moves ignore the other side's ability (Mold Breaker, Teravolt, Turboblaze). */
  pierce?: boolean;
  scrappy?: boolean;
  /** A type's moves, from anyone, get stronger while it is in the fight. */
  aura?: { type: string; mul: number };
  auraBreak?: boolean;
  /** Damage taken: multiplied when the conditions hold (se: super effective, full: at full life). */
  guard?: { mul: number; type?: string[]; se?: boolean; full?: boolean; name?: RegExp; field?: FieldKind }[];
  /** Hits of these types do nothing; `absorb` is the share of its life it takes back, `gain` what it gets instead. */
  immune?: string[];
  absorb?: number;
  gain?: Gain;
  /** Moves with these names do nothing (ball and bomb moves, sound moves). */
  blocks?: RegExp;
  sturdy?: boolean;
  disguise?: boolean;
  noCrit?: boolean;
  /** Knockback taken. */
  kb?: number;
  /** Touched by a close-range move (a dash, a grab, a burrow): a chance to hurt or ail the attacker. `anyHit`: by any hit. */
  contact?: { status?: StatusKind; p: number; chip?: number; anyHit?: boolean };
  /** A hit that matches changes it for a while. */
  onHit?: { p?: number; type?: string[]; crit?: boolean; contact?: boolean; gain: Gain };
  /** After a knock-out (`any`: of anybody) it grows stronger, up to `cap` times, for `t` seconds each. */
  onKo?: { dmg: number; cap: number; t: number; any?: boolean };
  aftermath?: number;
  /** A chance for its own hits to stun for a moment. */
  stun?: number;
  /** A burn, poison or paralysis on it is passed back to whoever caused it. */
  sync?: boolean;
  /** Anyone who hits it has to wait a little before their next move. */
  pressure?: boolean;
  /** Safe from field hazards (Spikes and the like), as flyers are. */
  levitate?: boolean;
  /** Life it takes back each second (a share of its max), always or in a kind of weather. */
  regen?: number;
  regenField?: { field: FieldKind; pct: number };
  poisonHeal?: boolean;
  speedBoost?: boolean;
  /** Chance each three seconds that its status is cured. */
  shed?: number;
  /** Statuses wear off this many times faster (`slp`: sleep only, `field`: while that weather is on). */
  cure?: { all?: number; slp?: number; field?: FieldKind };
  moody?: boolean;
  /** No damage except from attacks: no burn, poison, weather or hazard damage. */
  magicGuard?: boolean;
  badDreams?: boolean;
  /** Takes damage over time in the sun (the price of Solar Power). */
  solar?: boolean;
  speed?: { mul: number; field?: FieldKind; status?: boolean };
  noStatus?: StatusKind[];
  noStatusField?: { field: FieldKind; kinds: StatusKind[] };
  /** Weather has no effect on it (no boosts, no damage). */
  noField?: boolean;
  noChip?: boolean;
  /** At the start: foes hit for a while with less force. */
  intimidate?: boolean;
  noIntimidate?: boolean;
  onIntimidated?: Gain;
  weather?: FieldKind;
  trace?: boolean;
  /** At the start it gets this for a while. */
  enter?: Gain;
  /** Hit: a sandstorm begins. */
  sandSpit?: boolean;
  /** Hit by a close-range move: Toxic Spikes appear on the floor. */
  toxicDebris?: boolean;
  /** Its attacks' status effects are dropped for more damage. */
  sheer?: boolean;
};

export type AbDef = { id: string; name: string; desc: string; fx: AbFx };

const SOUND = /Sing|Roar|Hyper Voice|Screech|Bug Buzz|Boomburst|Echoed Voice|Snarl|Uproar|Supersonic|Sparkling Aria|Disarming Voice|Chatter|Clanging Scales|Overdrive|Relic Song|Perish Song|Metal Sound|Howl|Torch Song|Alluring Voice|Growl|Round|Confide|Eerie Spell|Throat Chop|Noble Roar/;
const BULLET = /Ball|Bomb|Blast|Cannon|Seed|Sphere|Barrage|Octazooka|Acid Spray|Beak Blast|Egg|Pollen Puff|Searing Shot|Rock Wrecker|Gyro/;
const PUNCH = /Punch|Hammer Arm|Ice Hammer|Meteor Mash|Power-Up|Plasma Fists|Sucker/;
const BITE = /Bite|Fang|Crunch|Jaw/;
const SLICE = /Slash|Cut|Blade|Edge|Scissor|Cutter|Razor|Sword|Fury Cutter|Leaf Blade|Sacred|Ceaseless|Psyblade|Aqua Cutter|Stone Axe|Kowtow|Tachyon/;
const RECOIL = /Double-Edge|Brave Bird|Flare Blitz|Wild Charge|Wood Hammer|Head Smash|Take Down|Submission|Volt Tackle|Wave Crash|Head Charge|Light of Ruin|Chloroblast/;

const NONE: AbFx = {};
const A = (name: string, desc: string, fx: AbFx = NONE): AbDef => ({ id: name.toLowerCase().replace(/[^a-z0-9]/g, ""), name, desc, fx });
const low = (type: string, name: string, moves: string): AbDef => A(name, `${moves} moves hit 50% harder when life is low.`, { boost: [{ mul: 1.5, type: [type], low: true }] });
const same = (name: string): AbDef => A(name, "Does nothing in Brawl.");
const veil = (name: string, kind: StatusKind, word: string): AbDef => A(name, `Cannot be ${word}.`, { noStatus: [kind] });
const steady = (name: string): AbDef => A(name, "Foes cannot weaken its attacks (Intimidate does not work on it).", { noIntimidate: true });

const LIST: AbDef[] = [
  A("Adaptability", "Moves of its own type hit 33% harder.", { stabMul: 1.33 }),
  A("Aftermath", "When a close-range move KOs it, the attacker loses 20% of their life.", { aftermath: 0.2 }),
  A("Air Lock", "Weather does nothing to it.", { noField: true, noChip: true }),
  A("Analytic", "Hits 25% harder against foes that are faster than it.", { boost: [{ mul: 1.25, foeFaster: true }] }),
  A("Anger Point", "A critical hit makes it hit 80% harder for 12 seconds.", { onHit: { crit: true, gain: { dmg: 1.8, t: 12 } } }),
  same("Anticipation"),
  same("Aroma Veil"),
  A("Aura Break", "Dark Aura and Fairy Aura are weaker while it is in the fight.", { auraBreak: true }),
  A("Bad Dreams", "Sleeping foes lose 3% of their life every second.", { badDreams: true }),
  A("Battle Bond", "After a KO it hits 25% harder for 20 seconds.", { onKo: { dmg: 1.25, cap: 1, t: 20 } }),
  same("Big Pecks"),
  low("Fire", "Blaze", "Fire"),
  A("Bulletproof", "Immune to ball and bomb moves.", { blocks: BULLET }),
  A("Chlorophyll", "40% faster in harsh sun.", { speed: { mul: 1.4, field: "sun" } }),
  steady("Clear Body"),
  A("Cloud Nine", "Weather does nothing to it.", { noField: true, noChip: true }),
  same("Commander"),
  A("Competitive", "Hits 40% harder for 12 seconds after a foe tries to weaken it.", { onIntimidated: { dmg: 1.4, t: 12 } }),
  same("Compound Eyes"),
  same("Corrosion"),
  A("Cursed Body", "When hit it has a 30% chance to confuse the attacker.", { contact: { status: "cnf", p: 0.3, anyHit: true } }),
  A("Cute Charm", "A close-range attacker has a 30% chance to be confused.", { contact: { status: "cnf", p: 0.3 } }),
  same("Damp"),
  A("Dark Aura", "Dark moves from everyone hit 33% harder while it is in the fight.", { aura: { type: "Dark", mul: 1.33 } }),
  A("Dauntless Shield", "Takes 15% less damage for the first 15 seconds.", { enter: { take: 0.85, t: 15 } }),
  A("Disguise", "Blocks the first hit it takes.", { disguise: true }),
  A("Drizzle", "Starts the fight with heavy rain.", { weather: "rain" }),
  A("Drought", "Starts the fight with harsh sun.", { weather: "sun" }),
  A("Early Bird", "Wakes from sleep twice as fast.", { cure: { slp: 2 } }),
  A("Electric Surge", "Electric moves hit 20% harder.", { boost: [{ mul: 1.2, type: ["Electric"] }] }),
  same("Emergency Exit"),
  A("Fairy Aura", "Fairy moves from everyone hit 33% harder while it is in the fight.", { aura: { type: "Fairy", mul: 1.33 } }),
  A("Flame Body", "A close-range attacker has a 30% chance to be burned.", { contact: { status: "brn", p: 0.3 } }),
  A("Flash Fire", "Immune to Fire. Being hit by Fire makes its Fire moves 40% stronger for 10 seconds.", { immune: ["Fire"], gain: { dmg: 1.4, t: 10, type: ["Fire"] } }),
  same("Frisk"),
  steady("Full Metal Body"),
  same("Gluttony"),
  A("Good as Gold", "Immune to every status effect.", { noStatus: ["brn", "psn", "par", "slp", "frz", "cnf"] }),
  A("Grassy Surge", "Grass moves hit 20% harder, and it slowly heals.", { boost: [{ mul: 1.2, type: ["Grass"] }], regen: 0.008 }),
  A("Guts", "With a status effect it hits 40% harder.", { boost: [{ mul: 1.4, status: true }] }),
  same("Healer"),
  A("Heavy Metal", "Heavy: knocked back 40% less.", { kb: 0.6 }),
  A("Hustle", "Hits 25% harder.", { boost: [{ mul: 1.25 }] }),
  A("Hydration", "Status effects wear off 3 times faster in rain.", { cure: { all: 3, field: "rain" } }),
  steady("Hyper Cutter"),
  A("Ice Body", "Heals 1.5% of its life a second in hail, and hail does not hurt it.", { regenField: { field: "hail", pct: 0.015 }, noChip: true }),
  same("Illuminate"),
  veil("Immunity", "psn", "poisoned"),
  same("Infiltrator"),
  A("Inner Focus", "Knocked back 55% less, and Intimidate does not work on it.", { kb: 0.45, noIntimidate: true }),
  veil("Insomnia", "slp", "put to sleep"),
  A("Intimidate", "At the start, foes hit 13% weaker for 12 seconds.", { intimidate: true }),
  A("Intrepid Sword", "Hits 15% harder for the first 15 seconds.", { enter: { dmg: 1.15, t: 15 } }),
  A("Iron Fist", "Punching moves hit 25% harder.", { boost: [{ mul: 1.25, name: PUNCH }] }),
  A("Justified", "Hit by a Dark move: hits 30% harder for 12 seconds.", { onHit: { type: ["Dark"], gain: { dmg: 1.3, t: 12 } } }),
  same("Keen Eye"),
  same("Klutz"),
  A("Leaf Guard", "Cannot get a status effect in harsh sun.", { noStatusField: { field: "sun", kinds: ["brn", "psn", "par", "slp", "frz", "cnf"] } }),
  A("Levitate", "Immune to Ground moves and to Spikes and other hazards on the floor.", { immune: ["Ground"], levitate: true }),
  A("Libero", "Every move gets the same-type bonus.", { protean: true }),
  same("Light Metal"),
  A("Lightning Rod", "Immune to Electric. Being hit by it makes it hit 25% harder for 10 seconds.", { immune: ["Electric"], gain: { dmg: 1.25, t: 10 } }),
  veil("Limber", "par", "paralyzed"),
  same("Liquid Voice"),
  same("Long Reach"),
  A("Magic Bounce", "Immune to every status effect.", { noStatus: ["brn", "psn", "par", "slp", "frz", "cnf"] }),
  A("Magic Guard", "Only attacks can hurt it: no burn, poison, weather or hazard damage.", { magicGuard: true, noChip: true }),
  same("Magician"),
  veil("Magma Armor", "frz", "frozen"),
  same("Minus"),
  A("Mirror Armor", "Intimidate does not work on it.", { noIntimidate: true }),
  A("Mold Breaker", "Its moves ignore the other side's abilities.", { pierce: true }),
  A("Moody", "Every 7 seconds it hits 25% harder or moves 20% faster.", { moody: true }),
  A("Moxie", "Every KO makes it hit 12% harder for 25 seconds (up to 5 times).", { onKo: { dmg: 1.12, cap: 5, t: 25 } }),
  A("Multiscale", "Takes half damage while at full life.", { guard: [{ mul: 0.5, full: true }] }),
  same("Multitype"),
  A("Natural Cure", "Status effects wear off 2 times faster.", { cure: { all: 2.2 } }),
  same("No Guard"),
  steady("Oblivious"),
  A("Overcoat", "Weather does not hurt it.", { noChip: true }),
  A("Overgrow", "Grass moves hit 50% harder when life is low.", { boost: [{ mul: 1.5, type: ["Grass"], low: true }] }),
  A("Own Tempo", "Cannot be confused, and Intimidate does not work on it.", { noStatus: ["cnf"], noIntimidate: true }),
  same("Pickpocket"),
  same("Plus"),
  same("Power Construct"),
  same("Prankster"),
  A("Pressure", "Foes that hit it have to wait a little longer before their next move.", { pressure: true }),
  A("Prism Armor", "Takes 25% less damage from super effective hits.", { guard: [{ mul: 0.75, se: true }] }),
  A("Protean", "Every move gets the same-type bonus.", { protean: true }),
  A("Punk Rock", "Sound moves hit 30% harder, and it takes half damage from them.", { boost: [{ mul: 1.3, name: SOUND }], guard: [{ mul: 0.5, name: SOUND }] }),
  A("Pure Power", "Hits 50% harder.", { power: 1.5 }),
  A("Quick Feet", "40% faster while it has a status effect.", { speed: { mul: 1.4, status: true } }),
  A("Rain Dish", "Heals 1.2% of its life a second in rain.", { regenField: { field: "rain", pct: 0.012 } }),
  A("Reckless", "Recoil moves hit 20% harder.", { boost: [{ mul: 1.2, name: RECOIL }] }),
  A("Regenerator", "Slowly heals 1.2% of its life a second.", { regen: 0.012 }),
  same("Ripen"),
  same("Rivalry"),
  same("Rock Head"),
  A("Rough Skin", "A close-range attacker loses 7% of their life.", { contact: { p: 1, chip: 0.07 } }),
  same("Run Away"),
  A("Sand Force", "Ground, Rock and Steel moves hit 30% harder in a sandstorm, which does not hurt it.", { boost: [{ mul: 1.3, type: ["Ground", "Rock", "Steel"], field: "sand" }], noChip: true }),
  A("Sand Rush", "40% faster in a sandstorm, which does not hurt it.", { speed: { mul: 1.4, field: "sand" }, noChip: true }),
  A("Sand Spit", "When hit, a sandstorm begins.", { sandSpit: true }),
  A("Sand Stream", "Starts the fight with a sandstorm.", { weather: "sand" }),
  A("Sand Veil", "Takes 20% less damage in a sandstorm, which does not hurt it.", { guard: [{ mul: 0.8, field: "sand" }], noChip: true }),
  A("Scrappy", "Fighting and Normal moves hit Ghosts, and Intimidate does not work on it.", { scrappy: true, noIntimidate: true }),
  A("Sharpness", "Slicing moves hit 40% harder.", { boost: [{ mul: 1.4, name: SLICE }] }),
  A("Shed Skin", "Every 3 seconds a 33% chance to shake off a status effect.", { shed: 0.33 }),
  A("Sheer Force", "Moves that would cause a status effect hit 30% harder instead.", { boost: [{ mul: 1.3, secondary: true }], sheer: true }),
  A("Shell Armor", "Cannot be hit by critical hits.", { noCrit: true }),
  A("Shadow Shield", "Takes half damage while at full life.", { guard: [{ mul: 0.5, full: true }] }),
  A("Snow Cloak", "Takes 20% less damage in hail.", { guard: [{ mul: 0.8, field: "hail" }] }),
  A("Snow Warning", "Starts the fight with a hailstorm.", { weather: "hail" }),
  A("Sniper", "Critical hits do much more damage (x2.2 instead of x1.6).", { critX: 2.2 }),
  A("Solar Power", "Moves hit 30% harder in harsh sun, but it loses 1.5% of its life a second.", { boost: [{ mul: 1.3, field: "sun" }], solar: true }),
  A("Solid Rock", "Takes 25% less damage from super effective hits.", { guard: [{ mul: 0.75, se: true }] }),
  A("Soul-Heart", "Every KO, of anybody, makes it hit 10% harder for 25 seconds (up to 5 times).", { onKo: { dmg: 1.1, cap: 5, t: 25, any: true } }),
  A("Soundproof", "Immune to sound moves.", { blocks: SOUND }),
  A("Speed Boost", "Gets 5% faster every 3 seconds, up to 35%.", { speedBoost: true }),
  same("Stall"),
  same("Stalwart"),
  same("Stance Change"),
  A("Static", "A close-range attacker has a 30% chance to be paralyzed.", { contact: { status: "par", p: 0.3 } }),
  A("Steadfast", "When hit it has a 30% chance to get 15% faster for 5 seconds.", { onHit: { p: 0.3, gain: { spd: 1.15, t: 5 } } }),
  A("Steam Engine", "Hit by Fire or Water: 50% faster for 6 seconds.", { onHit: { type: ["Fire", "Water"], gain: { spd: 1.5, t: 6 } } }),
  A("Stench", "Its hits have a 10% chance to stun for a moment.", { stun: 0.1 }),
  A("Storm Drain", "Immune to Water. Being hit by it makes it hit 25% harder for 10 seconds.", { immune: ["Water"], gain: { dmg: 1.25, t: 10 } }),
  A("Strong Jaw", "Biting moves hit 40% harder.", { boost: [{ mul: 1.4, name: BITE }] }),
  A("Sturdy", "Survives a killing blow from full life with 1 HP (once every 25 seconds).", { sturdy: true }),
  A("Super Luck", "More critical hits (+8%).", { crit: 0.08 }),
  low("Bug", "Swarm", "Bug"),
  A("Sweet Veil", "Cannot be put to sleep.", { noStatus: ["slp"] }),
  A("Swift Swim", "40% faster in rain.", { speed: { mul: 1.4, field: "rain" } }),
  A("Synchronize", "A burn, poison or paralysis it gets is passed on to the attacker.", { sync: true }),
  same("Tangled Feet"),
  A("Technician", "Weak moves hit 40% harder.", { boost: [{ mul: 1.4, weak: true }] }),
  same("Telepathy"),
  A("Teravolt", "Its moves ignore the other side's abilities.", { pierce: true }),
  A("Thermal Exchange", "Cannot be burned. Hit by Fire: hits 25% harder for 10 seconds.", { noStatus: ["brn"], onHit: { type: ["Fire"], gain: { dmg: 1.25, t: 10 } } }),
  A("Thick Fat", "Takes half damage from Fire and Ice.", { guard: [{ mul: 0.5, type: ["Fire", "Ice"] }] }),
  A("Tinted Lens", "Moves that are not very effective hit 60% harder.", { tinted: 1.6 }),
  low("Water", "Torrent", "Water"),
  A("Toxic Debris", "When a close-range move hits it, Toxic Spikes appear on the floor around it.", { toxicDebris: true }),
  A("Trace", "At the start it copies the nearest foe's ability.", { trace: true }),
  A("Turboblaze", "Its moves ignore the other side's abilities.", { pierce: true }),
  same("Unaware"),
  same("Unburden"),
  same("Unnerve"),
  same("Unseen Fist"),
  A("Volt Absorb", "Immune to Electric: heals 25% of its life instead.", { immune: ["Electric"], absorb: 0.25 }),
  A("Water Absorb", "Immune to Water: heals 25% of its life instead.", { immune: ["Water"], absorb: 0.25 }),
  A("Weak Armor", "A close-range hit makes it 25% faster but takes 10% more damage, for 6 seconds.", { onHit: { contact: true, gain: { spd: 1.25, take: 1.1, t: 6 } } }),
  steady("White Smoke"),
];

export const ABILITIES: Record<string, AbDef> = Object.fromEntries(LIST.map((a) => [a.id, a]));

/** [first ability, second ability or null, hidden ability or null] of each Pokémon in the Brawl roster. */
export const SPECIES_ABILITIES: Record<string, [string, string | null, string | null]> = {
  charizard: ["blaze", null, "solarpower"],
  blastoise: ["torrent", null, "raindish"],
  venusaur: ["overgrow", null, "chlorophyll"],
  pikachu: ["static", null, "lightningrod"],
  gengar: ["cursedbody", null, null],
  lucario: ["steadfast", "innerfocus", "justified"],
  garchomp: ["sandveil", null, "roughskin"],
  gardevoir: ["synchronize", "trace", "telepathy"],
  alakazam: ["synchronize", "innerfocus", "magicguard"],
  dragonite: ["innerfocus", null, "multiscale"],
  scizor: ["swarm", "technician", "lightmetal"],
  gyarados: ["intimidate", null, "moxie"],
  umbreon: ["synchronize", null, "innerfocus"],
  tyranitar: ["sandstream", null, "unnerve"],
  blaziken: ["blaze", null, "speedboost"],
  greninja: ["torrent", "battlebond", "protean"],
  metagross: ["clearbody", null, "lightmetal"],
  salamence: ["intimidate", null, "moxie"],
  jolteon: ["voltabsorb", null, "quickfeet"],
  arcanine: ["intimidate", "flashfire", "justified"],
  lapras: ["waterabsorb", "shellarmor", "hydration"],
  machamp: ["guts", "noguard", "steadfast"],
  snorlax: ["immunity", "thickfat", "gluttony"],
  sceptile: ["overgrow", null, "unburden"],
  dragapult: ["clearbody", "infiltrator", "cursedbody"],
  aegislash: ["stancechange", null, null],
  absol: ["pressure", "superluck", "justified"],
  clefable: ["cutecharm", "magicguard", "unaware"],
  starmie: ["illuminate", "naturalcure", "analytic"],
  victreebel: ["chlorophyll", null, "gluttony"],
  meganium: ["overgrow", null, "leafguard"],
  feraligatr: ["torrent", null, "sheerforce"],
  emboar: ["blaze", null, "reckless"],
  excadrill: ["sandrush", "sandforce", "moldbreaker"],
  chandelure: ["flashfire", "flamebody", "infiltrator"],
  chesnaught: ["overgrow", null, "bulletproof"],
  delphox: ["blaze", null, "magician"],
  hawlucha: ["limber", "unburden", "moldbreaker"],
  skarmory: ["keeneye", "sturdy", "weakarmor"],
  froslass: ["snowcloak", null, "cursedbody"],
  mimikyu: ["disguise", null, null],
  corviknight: ["pressure", "unnerve", "mirrorarmor"],
  hydreigon: ["levitate", null, null],
  kommoo: ["bulletproof", "soundproof", "overcoat"],
  zeraora: ["voltabsorb", null, null],
  darkrai: ["baddreams", null, null],
  heatran: ["flashfire", null, "flamebody"],
  golurk: ["ironfist", "klutz", "noguard"],
  raichu: ["static", null, "lightningrod"],
  staraptor: ["intimidate", null, "reckless"],
  baxcalibur: ["thermalexchange", null, "icebody"],
  chimecho: ["levitate", null, null],
  crabominable: ["hypercutter", "ironfist", "angerpoint"],
  golisopod: ["emergencyexit", null, null],
  scovillain: ["chlorophyll", "insomnia", "moody"],
  glimmora: ["toxicdebris", null, "corrosion"],
  tatsugiri: ["commander", null, "stormdrain"],
  meowstic: ["keeneye", "infiltrator", "prankster"],
  magearna: ["soulheart", null, null],
  mewtwo: ["pressure", null, "unnerve"],
  rayquaza: ["airlock", null, null],
  onix: ["rockhead", "sturdy", "weakarmor"],
  steelix: ["rockhead", "sturdy", "sheerforce"],
  sandaconda: ["sandspit", "shedskin", "sandveil"],
  lugia: ["pressure", null, "multiscale"],
  hooh: ["pressure", null, "regenerator"],
  kyogre: ["drizzle", null, null],
  groudon: ["drought", null, null],
  dialga: ["pressure", null, "telepathy"],
  palkia: ["pressure", null, "telepathy"],
  giratina: ["pressure", null, "telepathy"],
  arceus: ["multitype", null, null],
  mew: ["synchronize", null, null],
  raikou: ["pressure", null, "innerfocus"],
  entei: ["pressure", null, "innerfocus"],
  suicune: ["pressure", null, "innerfocus"],
  latias: ["levitate", null, null],
  latios: ["levitate", null, null],
  deoxys: ["pressure", null, null],
  reshiram: ["turboblaze", null, null],
  zekrom: ["teravolt", null, null],
  kyurem: ["pressure", null, null],
  xerneas: ["fairyaura", null, null],
  yveltal: ["darkaura", null, null],
  solgaleo: ["fullmetalbody", null, null],
  lunala: ["shadowshield", null, null],
  necrozma: ["prismarmor", null, null],
  zacian: ["intrepidsword", null, null],
  zamazenta: ["dauntlessshield", null, null],
  eternatus: ["pressure", null, null],
  zygarde: ["aurabreak", null, null],
  diancie: ["clearbody", null, null],
  marshadow: ["technician", null, null],
  tapukoko: ["electricsurge", null, "telepathy"],
  tornadus: ["prankster", null, "competitive"],
  thundurus: ["prankster", null, "competitive"],
  landorus: ["sandforce", null, "sheerforce"],
  enamorus: ["cutecharm", null, "magicguard"],
  shaymin: ["naturalcure", null, null],
  hoopa: ["magicbounce", null, null],
  meloetta: ["naturalcure", null, null],
  keldeo: ["justified", null, null],
  genesect: ["technician", null, null],
  calyrex: ["pressure", null, null],
  ogerpon: ["technician", null, null],
  terapagos: ["solidrock", null, null],
  articuno: ["pressure", null, "snowcloak"],
  zapdos: ["pressure", null, "static"],
  moltres: ["pressure", null, "flamebody"],
  vaporeon: ["waterabsorb", null, "hydration"],
  flareon: ["flashfire", null, null],
  espeon: ["synchronize", null, null],
  leafeon: ["leafguard", null, null],
  glaceon: ["snowcloak", null, null],
  sylveon: ["cutecharm", null, null],
  ninetales: ["flashfire", null, null],
  typhlosion: ["blaze", null, null],
  goodra: ["hydration", null, null],
  togekiss: ["superluck", null, null],
  zoroark: ["moxie", null, null],
  blissey: ["naturalcure", null, null],
  meowscarada: ["overgrow", null, null],
  skeledirge: ["blaze", null, null],
  quaquaval: ["torrent", null, null],
  kingambit: ["pressure", null, null],
  talonflame: ["flamebody", null, null],
  noivern: ["moldbreaker", null, null],
  mamoswine: ["thickfat", null, null],
  magnezone: ["sturdy", null, null],
  electivire: ["static", null, null],
  gliscor: ["sandveil", null, null],
  zarude: ["leafguard", null, null],
  ampharos: ["static", null, "plus"],
  heracross: ["swarm", "guts", "moxie"],
  houndoom: ["earlybird", "flashfire", "unnerve"],
  aggron: ["sturdy", "rockhead", "heavymetal"],
  manectric: ["static", "lightningrod", "minus"],
  sharpedo: ["roughskin", null, "speedboost"],
  camerupt: ["magmaarmor", "solidrock", "angerpoint"],
  altaria: ["naturalcure", null, "cloudnine"],
  banette: ["insomnia", "frisk", "cursedbody"],
  glalie: ["innerfocus", "icebody", "moody"],
  lopunny: ["cutecharm", "klutz", "limber"],
  gallade: ["steadfast", "sharpness", "justified"],
  abomasnow: ["snowwarning", null, "soundproof"],
  pinsir: ["hypercutter", "moldbreaker", "moxie"],
  aerodactyl: ["rockhead", "pressure", "unnerve"],
  kangaskhan: ["earlybird", "scrappy", "innerfocus"],
  slowbro: ["oblivious", "owntempo", "regenerator"],
  beedrill: ["swarm", null, "sniper"],
  pidgeot: ["keeneye", "tangledfeet", "bigpecks"],
  sableye: ["keeneye", "stall", "prankster"],
  medicham: ["purepower", null, "telepathy"],
  swampert: ["torrent", null, "damp"],
  eevee: ["runaway", "adaptability", "anticipation"],
  incineroar: ["blaze", null, "intimidate"],
  decidueye: ["overgrow", null, "longreach"],
  primarina: ["torrent", null, "liquidvoice"],
  lycanroc: ["keeneye", "sandrush", "steadfast"],
  toxtricity: ["punkrock", "plus", "technician"],
  cinderace: ["blaze", null, "libero"],
  rillaboom: ["overgrow", null, "grassysurge"],
  inteleon: ["torrent", null, "sniper"],
  urshifu: ["unseenfist", null, null],
  hatterene: ["healer", "anticipation", "magicbounce"],
  grimmsnarl: ["prankster", "frisk", "pickpocket"],
  kingler: ["hypercutter", "shellarmor", "sheerforce"],
  butterfree: ["compoundeyes", null, "tintedlens"],
  melmetal: ["ironfist", null, null],
  duraludon: ["lightmetal", "heavymetal", "stalwart"],
  coalossal: ["steamengine", "flamebody", "flashfire"],
  centiskorch: ["flashfire", "whitesmoke", "flamebody"],
  drednaw: ["strongjaw", "shellarmor", "swiftswim"],
  orbeetle: ["swarm", "frisk", "telepathy"],
  copperajah: ["sheerforce", null, "heavymetal"],
  garbodor: ["stench", "weakarmor", "aftermath"],
  alcremie: ["sweetveil", null, "aromaveil"],
  appletun: ["ripen", "gluttony", "thickfat"],
  flapple: ["ripen", "gluttony", "hustle"],
  volcarona: ["flamebody", null, "swarm"],
  haxorus: ["rivalry", "moldbreaker", "unnerve"],
  gholdengo: ["goodasgold", null, null],
  infernape: ["blaze", null, "ironfist"],
  weavile: ["pressure", null, "pickpocket"],
  empoleon: ["torrent", null, "competitive"],
  torterra: ["overgrow", null, "shellarmor"],
};

export const abilityDef = (id: string | undefined): AbDef => ABILITIES[id ?? ""] ?? ABILITIES.runaway!;

/** The abilities a Pokémon can have, in order: the first and the second (if any), then the hidden one (if any). */
export function abilitiesOf(speciesId: string): string[] {
  const a = SPECIES_ABILITIES[speciesId];
  return a ? (a.filter(Boolean) as string[]).filter((x, i, all) => ABILITIES[x] && all.indexOf(x) === i) : [];
}

/** The ability a Pokémon starts with: its first, unless it is told which one (`slot`: 0, 1 or 2 = hidden). */
export function pickAbility(speciesId: string, slot = 0): string {
  const a = SPECIES_ABILITIES[speciesId];
  const own = a?.[slot] ?? a?.[0];
  return own && ABILITIES[own] ? own : "runaway";
}

/* ------------------------------------------------------------------ what the engine asks of an ability */

export type AbState = {
  /** it has already done its "start of the fight" part */
  entered: boolean;
  /** seconds left on several timers, by name */
  t: Record<string, number>;
  dmg: number;
  dmgT: number;
  spd: number;
  spdT: number;
  take: number;
  takeT: number;
  /** a damage boost that only counts for some types */
  typed: { types: string[]; mul: number; t: number } | null;
  /** the speed-boost steps */
  n: number;
  /** KOs counted for Moxie and friends */
  ko: number;
  /** the traced ability, if any */
  traced: string | null;
};

export const newAbState = (): AbState => ({ entered: false, t: {}, dmg: 1, dmgT: 0, spd: 1, spdT: 0, take: 1, takeT: 0, typed: null, n: 0, ko: 0, traced: null });

type AbHolder = { ab: string; abx: AbState };
const fxOf = (f: AbHolder): AbFx => abilityDef(f.abx.traced ?? f.ab).fx;
export const abFx = fxOf;

/** Start (or extend) a temporary change on a fighter. */
export function giveGain(f: AbHolder, g: Gain) {
  const x = f.abx;
  // changes pile up (a second one multiplies the first and keeps it going for as long as the longer of the two)
  const mix = (cur: number, curT: number, add: number) => Math.max(0.55, Math.min(2.6, curT > 0 ? cur * add : add));
  if (g.dmg) {
    if (g.type) x.typed = { types: g.type, mul: g.dmg, t: g.t };
    else (x.dmg = mix(x.dmg, x.dmgT, g.dmg)), (x.dmgT = Math.max(x.dmgT, g.t));
  }
  if (g.spd) (x.spd = mix(x.spd, x.spdT, g.spd)), (x.spdT = Math.max(x.spdT, g.t));
  if (g.take) (x.take = mix(x.take, x.takeT, g.take)), (x.takeT = Math.max(x.takeT, g.t));
}

export const abTick = (f: AbHolder, dt: number) => {
  const x = f.abx;
  if (x.dmgT > 0) { x.dmgT -= dt; if (x.dmgT <= 0) x.dmg = 1; }
  if (x.spdT > 0) { x.spdT -= dt; if (x.spdT <= 0) x.spd = 1; }
  if (x.takeT > 0) { x.takeT -= dt; if (x.takeT <= 0) x.take = 1; }
  if (x.typed && (x.typed.t -= dt) <= 0) x.typed = null;
  for (const k in x.t) if (x.t[k]! > 0) x.t[k]! -= dt;
};

type Src = AbHolder & { hp: number; maxHp: number; speed: number; status: Record<string, number> };
const hasStatus = (f: Src) => ["brn", "psn", "par", "slp", "frz", "cnf"].some((k) => (f.status[k] ?? 0) > 0);

/** What its ability does to the damage of a move before anyone is targeted (boosts that depend only on itself). */
export function abBase(f: Src, mv: MoveDef, field: string): number {
  const fx = fxOf(f);
  const x = f.abx;
  let m = fx.power ?? 1;
  const lowHp = f.hp <= f.maxHp / 3;
  const sec = !!mv.status;
  for (const b of fx.boost ?? []) {
    if (b.foeFaster) continue; // needs a target: done in abStrike
    if (b.type && !b.type.includes(mv.type)) continue;
    if (b.low && !lowHp) continue;
    if (b.status && !hasStatus(f)) continue;
    if (b.weak && mv.power > 0.9) continue;
    if (b.name && !b.name.test(mv.name)) continue;
    if (b.secondary && !sec) continue;
    if (b.field && (field !== b.field || fx.noField)) continue;
    m *= b.mul;
  }
  if (x.dmgT > 0) m *= x.dmg;
  if (x.typed && x.typed.types.includes(mv.type)) m *= x.typed.mul;
  return m;
}

export type Block = { kind: "immune" | "block"; heal: number; gain?: Gain };
/** Does its ability make a hit of this type / move do nothing? */
export function abBlock(dst: AbHolder, type: string, mv: MoveDef | undefined): Block | null {
  const fx = fxOf(dst);
  if (fx.immune?.includes(type)) return { kind: "immune", heal: fx.absorb ?? 0, gain: fx.gain };
  if (fx.blocks && mv && fx.blocks.test(mv.name)) return { kind: "block", heal: 0 };
  return null;
}

/** What the attacker's ability does once it knows who it is hitting. */
export function abStrikeOut(src: Src, dst: Src, type: string, eff: number, mv: MoveDef | undefined, stabbed: boolean, field: string, auras: { type: string; mul: number }[]): number {
  const fx = fxOf(src);
  let m = 1;
  if (stabbed && fx.stabMul) m *= fx.stabMul;
  if (eff < 1 && eff > 0 && fx.tinted) m *= fx.tinted;
  for (const b of fx.boost ?? []) if (b.foeFaster && dst.speed > src.speed) m *= b.mul;
  for (const a of auras) if (a.type === type) m *= a.mul;
  void mv;
  void field;
  return m;
}

/** What the target's ability does to the damage it takes. */
export function abStrikeIn(dst: Src, type: string, eff: number, mv: MoveDef | undefined, field: string, pierce: boolean): number {
  const fx = fxOf(dst);
  let m = dst.abx.takeT > 0 ? dst.abx.take : 1;
  if (pierce) return m;
  const full = dst.hp >= dst.maxHp * 0.995;
  for (const g of fx.guard ?? []) {
    if (g.type && !g.type.includes(type)) continue;
    if (g.se && !(eff > 1)) continue;
    if (g.full && !full) continue;
    if (g.name && !(mv && g.name.test(mv.name))) continue;
    if (g.field && (field !== g.field || fx.noField)) continue;
    m *= g.mul;
  }
  return m;
}

/** Walking speed from its ability right now. */
export function abSpeed(f: Src, field: string): number {
  const fx = fxOf(f);
  const x = f.abx;
  let m = x.spdT > 0 ? x.spd : 1;
  if (fx.speed) {
    const s = fx.speed;
    if ((!s.field || (field === s.field && !fx.noField)) && (!s.status || hasStatus(f))) m *= s.mul;
  }
  if (fx.speedBoost) m *= 1 + 0.05 * Math.min(7, x.n);
  return m;
}

/** Is this status something its ability keeps off? */
export function abNoStatus(f: AbHolder, kind: StatusKind, field: string): boolean {
  const fx = fxOf(f);
  if (fx.noStatus?.includes(kind)) return true;
  const nf = fx.noStatusField;
  return !!nf && field === nf.field && nf.kinds.includes(kind);
}
