/** Things the Pokémon pages share with the server: types, battle formats, sprites, type chart, fun lines. */

export type Lang = "bn" | "en";
export const tx = (lang: Lang, bn: string, en: string) => (lang === "en" ? en : bn);

/** Messages the server writes in Bangla, with their English versions (the server does not know the reader's language). */
const MSG_EXACT: Record<string, string> = {
  "পোকেমন ইঞ্জিন চালু হয়নি — সার্ভারে @pkmn/sim প্যাকেজ আছে কিনা দেখুন (npm install)": "The Pokémon engine isn't running — check that the @pkmn/sim package is installed on the server (npm install)",
  "টিমটি পাওয়া যায়নি": "Team not found",
  "সর্বোচ্চ ২০টি টিম রাখা যায় — পুরোনো টিম মুছে ফেলুন": "You can keep up to 20 teams — delete an old one",
  "র‍্যান্ডম টিম বানানো গেল না, আবার চেষ্টা করুন": "Couldn't make a random team, try again",
  "CPU-র টিম বানানো গেল না, আবার চেষ্টা করুন": "Couldn't make the CPU's team, try again",
  "প্রতিপক্ষ বেছে নিন": "Pick an opponent",
  "সদস্যকে পাওয়া যায়নি": "Member not found",
  "এই চ্যালেঞ্জটি আর নেই": "This challenge no longer exists",
  "আপনার টিম বেছে নিন": "Choose your team",
  "লড়াইটি পাওয়া যায়নি": "Battle not found",
  "চলতি লড়াই শুধু যারা খেলছে তারাই দেখতে পারবে": "Only the players can watch a battle in progress",
  "আপনি এই লড়াইয়ের খেলোয়াড় নন": "You're not a player in this battle",
  "লড়াইটি এখন চলছে না": "This battle isn't running",
  "অবৈধ চাল": "Invalid move",
  "একই সময়ে অনেক কিছু হচ্ছে — আবার চেষ্টা করুন": "A lot is happening at once — try again",
  "এখনও প্রতিপক্ষকে অপেক্ষার সময় দেওয়া হয়েছে": "The opponent still has time to move",
  "এখন আপনার চাল দেওয়ার পালা নয়": "It's not your turn to move",
  "টিমে ১ থেকে ৬টি পোকেমন লাগবে": "A team needs 1 to 6 Pokémon",
};
const MSG_RULES: [RegExp, string][] = [
  [/^এই টিমটি জেন (\d)-এর, জেন (\d)-এর নয়$/, "This team is for Gen $1, not Gen $2"],
  [/^"(.*)" এই জেনারেশনে নেই$/, "\"$1\" doesn't exist in this generation"],
  [/^"(.*)" চালটি এই জেনারেশনে নেই$/, "\"$1\" isn't available in this generation"],
  [/^(.*)-এর জন্য ১ থেকে ৪টি চাল দিন$/, "Give $1 between 1 and 4 moves"],
  [/^(.*) হার মেনে নিয়েছে$/, "$1 forfeited"],
  [/^(.*) সময়মতো চাল দেয়নি$/, "$1 ran out of time"],
];
/** English version of a server message when `lang` is English; anything unknown is left as it is. */
export function localize(msg: string, lang: Lang): string {
  if (lang !== "en") return msg;
  if (MSG_EXACT[msg]) return MSG_EXACT[msg];
  for (const [rx, to] of MSG_RULES) if (rx.test(msg)) return msg.replace(rx, to);
  return msg;
}

/** The 48 Mega Evolutions from Gen 6–7. Any other Mega (and every "-Z" form) is one of the new ones from Legends: Z-A. */
const CLASSIC_MEGA_BASES = new Set(
  "Venusaur Charizard Blastoise Beedrill Pidgeot Alakazam Slowbro Gengar Kangaskhan Pinsir Gyarados Aerodactyl Mewtwo Ampharos Steelix Scizor Heracross Houndoom Tyranitar Sceptile Blaziken Swampert Gardevoir Sableye Mawile Aggron Medicham Manectric Sharpedo Camerupt Altaria Banette Absol Glalie Salamence Metagross Latias Latios Rayquaza Lopunny Garchomp Lucario Abomasnow Gallade Audino Diancie".split(" "),
);
export function isNewMega(base: string, forme: string): boolean {
  return /^Mega/.test(forme) && (!CLASSIC_MEGA_BASES.has(base) || /-Z$/.test(forme) || forme === "Mega-Z");
}

export const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
] as const;
export type PType = (typeof TYPES)[number];

export const TYPE_COLOR: Record<string, string> = {
  Normal: "#a8a77a", Fire: "#ee8130", Water: "#6390f0", Electric: "#f7d02c", Grass: "#7ac74c",
  Ice: "#96d9d6", Fighting: "#c22e28", Poison: "#a33ea1", Ground: "#e2bf65", Flying: "#a98ff3",
  Psychic: "#f95587", Bug: "#a6b91a", Rock: "#b6a136", Ghost: "#735797", Dragon: "#6f35fc",
  Dark: "#705746", Steel: "#b7b7ce", Fairy: "#d685ad", Stellar: "#40b5a5", "???": "#68a090",
};

export const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export const STAT_LABEL: Record<StatKey, string> = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };

/* ------------------------------------------------------------------ formats */

export type FormatPreset = {
  gen: number;
  id: string; // Showdown format id
  bn: string;
  en: string;
  gimmick: "tera" | "dynamax" | "mega-z" | "mega" | "none";
  gimmickBn: string;
  gimmickEn: string;
};
export const FORMATS: FormatPreset[] = [
  { gen: 9, id: "gen9customgame", bn: "জেন ৯", en: "Gen 9", gimmick: "tera", gimmickBn: "টেরাস্টালাইজ (ক্রিস্টাল টাইপ বদল) + মেগা ইভোলিউশন (নতুন Z-A মেগা সহ)", gimmickEn: "Terastallization (crystal type change) + Mega Evolution (incl. the new Z-A Megas)" },
  { gen: 8, id: "gen8customgame", bn: "জেন ৮", en: "Gen 8", gimmick: "dynamax", gimmickBn: "ডায়ানাক্স ও গিগান্টাম্যাক্স", gimmickEn: "Dynamax & Gigantamax" },
  { gen: 7, id: "gen7customgame", bn: "জেন ৭", en: "Gen 7", gimmick: "mega-z", gimmickBn: "মেগা, জেড-মুভ, আল্ট্রা বার্স্ট", gimmickEn: "Mega, Z-Moves, Ultra Burst" },
  { gen: 6, id: "gen6customgame", bn: "জেন ৬", en: "Gen 6", gimmick: "mega", gimmickBn: "মেগা ইভোলিউশন ও প্রাইমাল", gimmickEn: "Mega Evolution & Primal Reversion" },
  { gen: 5, id: "gen5customgame", bn: "জেন ৫", en: "Gen 5", gimmick: "none", gimmickBn: "ক্লাসিক (গিমিক নেই)", gimmickEn: "Classic (no gimmick)" },
  { gen: 4, id: "gen4customgame", bn: "জেন ৪", en: "Gen 4", gimmick: "none", gimmickBn: "ক্লাসিক (গিমিক নেই)", gimmickEn: "Classic (no gimmick)" },
  { gen: 3, id: "gen3customgame", bn: "জেন ৩", en: "Gen 3", gimmick: "none", gimmickBn: "ক্লাসিক (গিমিক নেই)", gimmickEn: "Classic (no gimmick)" },
  { gen: 2, id: "gen2customgame", bn: "জেন ২", en: "Gen 2", gimmick: "none", gimmickBn: "ক্লাসিক (গিমিক নেই)", gimmickEn: "Classic (no gimmick)" },
  { gen: 1, id: "gen1customgame", bn: "জেন ১", en: "Gen 1", gimmick: "none", gimmickBn: "ক্লাসিক (গিমিক নেই)", gimmickEn: "Classic (no gimmick)" },
];
export const formatById = (id: string) => FORMATS.find((f) => f.id === id) ?? FORMATS[0];
export const formatByGen = (gen: number) => FORMATS.find((f) => f.gen === gen) ?? FORMATS[0];

export type CpuLevel = "easy" | "normal" | "hard";
export const CPU_LEVELS: { id: CpuLevel; bn: string; en: string }[] = [
  { id: "easy", bn: "সহজ", en: "Easy" },
  { id: "normal", bn: "মাঝারি", en: "Normal" },
  { id: "hard", bn: "কঠিন", en: "Hard" },
];

/* ------------------------------------------------------------------- shapes */

/** One Pokémon as a member builds it. */
export type PokeSet = {
  species: string;
  ability: string;
  item: string;
  moves: string[];
  nature: string;
  level: number;
  teraType?: string;
  gigantamax?: boolean;
  evs: Record<StatKey, number>;
};

export type SpriteInfo = { id: string; num: number; types: string[] };
export type MoveInfo = { id: string; name: string; type: string; cat: "Physical" | "Special" | "Status"; bp: number; acc: number | null; desc: string };

/** A Showdown "request": what a side can do right now. Loosely typed on purpose. */
export type BattleRequest = {
  wait?: boolean;
  teamPreview?: boolean;
  forceSwitch?: boolean[];
  noCancel?: boolean;
  active?: {
    moves: { move: string; id: string; pp?: number; maxpp?: number; target?: string; disabled?: boolean | string }[];
    trapped?: boolean;
    maybeTrapped?: boolean;
    canMegaEvo?: boolean;
    canMegaEvoX?: boolean;
    canMegaEvoY?: boolean;
    canUltraBurst?: boolean;
    canZMove?: ({ move: string; target: string } | null)[];
    canDynamax?: boolean;
    maxMoves?: { maxMoves: { move: string; target: string; disabled?: boolean }[]; gigantamax?: string };
    canTerastallize?: string;
  }[];
  side?: {
    name: string;
    id: string;
    pokemon: {
      ident: string;
      details: string;
      condition: string;
      active: boolean;
      stats?: Record<string, number>;
      moves?: string[];
      baseAbility?: string;
      item?: string;
      ability?: string;
      teraType?: string;
      terastallized?: string;
    }[];
  };
};

/** One row of the Pokédex. */
export type DexEntry = {
  n: number;
  id: string;
  name: string;
  base: string;
  forme: string;
  /** base | regional | mega | primal | ultra | gmax | other */
  kind: string;
  gen: number;
  t: string[];
  bs: number[];
  ab: string[];
  hidden: string;
  /** mega primal ultra gmax z zsig dyna tera */
  g: string[];
  sp: string;
  req: string;
};

export type ItemInfo = { name: string; kind: "mega" | "z" | "orb" | "item"; desc: string };

export type SpeciesDetail = {
  entry: DexEntry;
  forms: DexEntry[];
  evoLine: string[];
  abilities: { name: string; slot: string; desc: string }[];
  megas: { name: string; stone: string }[];
  gmax: { name: string; move: string } | null;
  zsig: { crystal: string; move: string } | null;
  moves: MoveInfo[];
  heightm: number;
  weightkg: number;
  eggGroups: string[];
};

/* ---------------------------------------------------------------- sprite URLs */

const PS = "https://play.pokemonshowdown.com/sprites";
const ART = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

/** Image URLs to try in order: animated, then static, then official artwork, then the caller shows an emoji. */
export function spriteChain(sprite: { id: string; num?: number } | null | undefined, opts: { back?: boolean; shiny?: boolean; still?: boolean } = {}): string[] {
  if (!sprite) return [];
  const id = sprite.id;
  const out: string[] = [];
  if (!opts.still) {
    out.push(`${PS}/${opts.back ? "ani-back" : "ani"}${opts.shiny ? "-shiny" : ""}/${id}.gif`);
  }
  out.push(`${PS}/dex${opts.shiny ? "-shiny" : ""}/${id}.png`);
  out.push(`${PS}/gen5${opts.back ? "-back" : ""}${opts.shiny ? "-shiny" : ""}/${id}.png`);
  if (sprite.num && sprite.num > 0 && sprite.num <= 1025) out.push(`${ART}/${opts.shiny ? "shiny/" : ""}${sprite.num}.png`);
  return out;
}

/** Best guess of a Showdown sprite id from a species name, when the server did not send one. */
export function guessSpriteId(name: string): string {
  const hyphenBase = /^(ho-oh|porygon-z|jangmo-o|hakamo-o|kommo-o|wo-chien|chien-pao|ting-lu|chi-yu)$/i;
  const m = /^(ho-oh|porygon-z|jangmo-o|hakamo-o|kommo-o|wo-chien|chien-pao|ting-lu|chi-yu)(?:-(.+))?$/i.exec(name);
  if (m && (hyphenBase.test(name) || m[2] !== undefined)) {
    return toId(m[1]) + (m[2] ? "-" + toId(m[2]) : "");
  }
  const dash = name.indexOf("-");
  if (dash < 0) return toId(name);
  return toId(name.slice(0, dash)) + "-" + toId(name.slice(dash + 1));
}

/* ----------------------------------------------------------- type effectiveness */

const SE: Record<string, string[]> = {
  Normal: [], Fire: ["Grass", "Ice", "Bug", "Steel"], Water: ["Fire", "Ground", "Rock"], Electric: ["Water", "Flying"],
  Grass: ["Water", "Ground", "Rock"], Ice: ["Grass", "Ground", "Flying", "Dragon"],
  Fighting: ["Normal", "Ice", "Rock", "Dark", "Steel"], Poison: ["Grass", "Fairy"],
  Ground: ["Fire", "Electric", "Poison", "Rock", "Steel"], Flying: ["Grass", "Fighting", "Bug"],
  Psychic: ["Fighting", "Poison"], Bug: ["Grass", "Psychic", "Dark"], Rock: ["Fire", "Ice", "Flying", "Bug"],
  Ghost: ["Psychic", "Ghost"], Dragon: ["Dragon"], Dark: ["Psychic", "Ghost"], Steel: ["Ice", "Rock", "Fairy"],
  Fairy: ["Fighting", "Dragon", "Dark"],
};
const NVE: Record<string, string[]> = {
  Normal: ["Rock", "Steel"], Fire: ["Fire", "Water", "Rock", "Dragon"], Water: ["Water", "Grass", "Dragon"],
  Electric: ["Electric", "Grass", "Dragon"], Grass: ["Fire", "Grass", "Poison", "Flying", "Bug", "Dragon", "Steel"],
  Ice: ["Fire", "Water", "Ice", "Steel"], Fighting: ["Poison", "Flying", "Psychic", "Bug", "Fairy"],
  Poison: ["Poison", "Ground", "Rock", "Ghost"], Ground: ["Grass", "Bug"], Flying: ["Electric", "Rock", "Steel"],
  Psychic: ["Psychic", "Steel"], Bug: ["Fire", "Fighting", "Poison", "Flying", "Ghost", "Steel", "Fairy"],
  Rock: ["Fighting", "Ground", "Steel"], Ghost: ["Dark"], Dragon: ["Steel"], Dark: ["Fighting", "Dark", "Fairy"],
  Steel: ["Fire", "Water", "Electric", "Steel"], Fairy: ["Fire", "Poison", "Steel"],
};
const IMM: Record<string, string[]> = {
  Normal: ["Ghost"], Electric: ["Ground"], Fighting: ["Ghost"], Poison: ["Steel"], Ground: ["Flying"],
  Ghost: ["Normal"], Psychic: ["Dark"], Dragon: ["Fairy"],
};

/** Damage multiplier of an attacking type against a defender's types (Gen 6+ chart). */
export function typeMult(attack: string, defend: readonly string[]): number {
  let m = 1;
  for (const d of defend) {
    if (IMM[attack]?.includes(d)) return 0;
    if (SE[attack]?.includes(d)) m *= 2;
    else if (NVE[attack]?.includes(d)) m *= 0.5;
  }
  return m;
}

/* ------------------------------------------------------------- battle log views */

/**
 * The raw battle log has "|split|p1" lines followed by a private and a public version of the next line.
 * `channel` 0 = spectator (public); 1 / 2 = what player one / two sees (their own exact HP, etc.).
 */
export function viewLines(lines: readonly string[], channel: 0 | 1 | 2): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("|split|")) {
      const side = l.slice(7).trim();
      const secret = lines[i + 1] ?? "";
      const pub = lines[i + 2] ?? "";
      const line = channel !== 0 && side === `p${channel}` ? secret : pub;
      if (line) out.push(line);
      i += 2;
      continue;
    }
    if (l) out.push(l);
  }
  return out;
}

/* ------------------------------------------------------------------ fun lines */

export type Pair = readonly [bn: string, en: string];

export const WIN_LINES: Pair[] = [
  ["GG EZ! 😎", "GG EZ! 😎"],
  ["টাইপ চার্ট মুখস্থ ছিল যে!", "Memorised the type chart, did ya?"],
  ["চ্যাম্পিয়ন অফ দ্য ডে 🏆", "Champion of the day 🏆"],
  ["প্রতিপক্ষ এখন ডেক্স খুলে বসেছে…", "Opponent is now reading the Pokédex…"],
  ["এটা কোনো ম্যাচ ছিল না, এটা পাঠদান ছিল!", "That wasn't a match, that was a lesson!"],
  ["অ্যাশ কখনও এভাবে জেতেনি!", "Ash never won like this!"],
];
export const LOSE_LINES: Pair[] = [
  ["স্কিল ইস্যু 💀", "Skill issue 💀"],
  ["টাইপ চার্টটা একবার দেখে আসুন 📖", "Go take a look at the type chart 📖"],
  ["Magikarp দিয়ে লড়লেও এর চেয়ে ভালো হতো", "Even a Magikarp would've done better"],
  ["পোকেবল ছুড়ে মারার চেয়ে ভালো কিছু করা যেত", "Throwing Poké Balls at them would've worked better"],
  ["বাবা-মা বলেছিল ঘুমিয়ে পড়তে… 🛌", "Mom said it's time to sleep… 🛌"],
  ["আজকের পাঠ: ট্যাঙ্কিং ≠ জেতা", "Today's lesson: tanking ≠ winning"],
];
export const FLAWLESS_LINES: Pair[] = [
  ["ফ্ললেস ভিক্টরি! একটাও পড়েনি 👑", "FLAWLESS victory! Not a single faint 👑"],
  ["একদম ঝাড়ু-পেটা ধুয়ে-মুছে সাফ!", "Absolute sweep, wiped clean!"],
];
export const CLOSE_LINES: Pair[] = [
  ["শ্বাসরুদ্ধকর! শেষ পোকেমনে জিত 😮‍💨", "Nail-biter! Won with the last Pokémon 😮‍💨"],
];
export const QUICK_LINES: Pair[] = [
  ["মাত্র কয়েক টার্নেই শেষ ⚡", "Over in a few turns ⚡"],
];

/** A stable pick for a given battle, so everyone sees the same line for the same result. */
export function pickLine(list: Pair[], seed: number): Pair {
  return list[Math.abs(Math.floor(seed * 2654435761)) % list.length];
}

export function titleFor(stats: { wins: number; losses: number; streak: number; cpuLosses: number; games: number }): Pair | null {
  const rate = stats.games ? stats.wins / stats.games : 0;
  if (stats.games >= 3 && stats.wins === 0) return ["ফ্রি-তে এক্সপ দাতা 🎁", "Free XP provider 🎁"];
  if (stats.streak <= -3) return ["টানা হারের মহারাজ 👑", "King of the losing streak 👑"];
  if (stats.streak >= 5) return ["থামানোই যাচ্ছে না 🔥", "Unstoppable 🔥"];
  if (stats.cpuLosses >= 2) return ["CPU-র কাছেও হেরেছে! 🤖", "Lost to the CPU too! 🤖"];
  if (stats.games >= 5 && rate >= 0.8) return ["টাইপ চার্টের দেবতা 🧠", "Type-chart deity 🧠"];
  if (stats.games >= 5 && rate <= 0.25) return ["আশার আলো এখনও নেভেনি 🕯️", "Hope still flickers 🕯️"];
  if (stats.streak >= 3) return ["গরম আছে ♨️", "On a roll ♨️"];
  return null;
}
