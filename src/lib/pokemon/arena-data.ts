/**
 * Arena Brawl: the roster, the moves and the perks. Plain data, no DOM — the engine reads it,
 * the screens draw from it.
 */

export type MoveKind =
  | "proj" //   one shot flying in a line
  | "spread" // a fan of shots
  | "homing" // a shot that bends towards the nearest foe
  | "beam" //   a short stream held in front of you
  | "dash" //   a rush forward that hits everything on the way
  | "nova" //   a burst all around you
  | "lob" //    lands on the target spot after a moment (a telegraphed circle)
  | "bolt" //   a long line that strikes after a short wind-up
  | "guard" //  a shield
  | "heal" //   recovery over a moment
  | "buff"; //  more damage for a while

export type StatusKind = "brn" | "psn" | "par" | "frz";

export type MoveDef = {
  id: string;
  name: string;
  type: string;
  kind: MoveKind;
  /** Damage as a multiple of a standard hit. */
  power: number;
  /** Seconds before it can be used again. */
  cd: number;
  /** Shots in a spread / hits in a beam. */
  n?: number;
  /** Projectile speed (px/s), dash length, nova radius, bolt length… whichever fits the kind. */
  range?: number;
  speed?: number;
  /** Seconds of wind-up (shown as a warning when an enemy uses it). */
  windup?: number;
  status?: { kind: StatusKind; chance: number };
  pierce?: boolean;
  desc: string;
};

const m = (d: MoveDef): MoveDef => d;

export const MOVES: Record<string, MoveDef> = Object.fromEntries(
  [
    m({ id: "flamethrower", name: "Flamethrower", type: "Fire", kind: "beam", power: 0.42, cd: 2.6, n: 9, range: 260, status: { kind: "brn", chance: 0.18 }, desc: "A stream of fire that burns what it touches." }),
    m({ id: "fireblast", name: "Fire Blast", type: "Fire", kind: "lob", power: 2.2, cd: 5.5, range: 340, windup: 0.55, status: { kind: "brn", chance: 0.5 }, desc: "A huge blast that lands where you aim." }),
    m({ id: "flamewheel", name: "Flame Wheel", type: "Fire", kind: "dash", power: 1.2, cd: 3.4, range: 230, status: { kind: "brn", chance: 0.3 }, desc: "Roll through foes, trailing flame." }),
    m({ id: "waterpulse", name: "Water Pulse", type: "Water", kind: "proj", power: 1.0, cd: 1.1, speed: 480, desc: "A quick ball of water." }),
    m({ id: "hydropump", name: "Hydro Pump", type: "Water", kind: "beam", power: 0.52, cd: 3.4, n: 8, range: 300, desc: "A powerful jet of water." }),
    m({ id: "surf", name: "Surf", type: "Water", kind: "nova", power: 1.7, cd: 5.0, range: 150, windup: 0.3, desc: "A wave that pushes everything away." }),
    m({ id: "razorleaf", name: "Razor Leaf", type: "Grass", kind: "spread", power: 0.62, cd: 1.7, n: 5, speed: 520, desc: "A fan of sharp leaves." }),
    m({ id: "solarbeam", name: "Solar Beam", type: "Grass", kind: "bolt", power: 2.6, cd: 6.5, range: 520, windup: 0.6, pierce: true, desc: "A long beam of light after a short charge." }),
    m({ id: "synthesis", name: "Synthesis", type: "Grass", kind: "heal", power: 0.35, cd: 9, desc: "Recover some HP." }),
    m({ id: "thundershock", name: "Thunder Shock", type: "Electric", kind: "proj", power: 0.8, cd: 0.8, speed: 640, status: { kind: "par", chance: 0.15 }, desc: "A fast spark." }),
    m({ id: "thunderbolt", name: "Thunderbolt", type: "Electric", kind: "bolt", power: 1.9, cd: 4.6, range: 480, windup: 0.4, status: { kind: "par", chance: 0.3 }, desc: "A lightning line that strikes fast." }),
    m({ id: "thunder", name: "Thunder", type: "Electric", kind: "lob", power: 2.3, cd: 6, range: 340, windup: 0.5, status: { kind: "par", chance: 0.4 }, desc: "Lightning that falls on the target spot." }),
    m({ id: "quickattack", name: "Quick Attack", type: "Normal", kind: "dash", power: 0.8, cd: 1.8, range: 210, desc: "A blink-fast rush." }),
    m({ id: "shadowball", name: "Shadow Ball", type: "Ghost", kind: "proj", power: 1.35, cd: 1.7, speed: 400, desc: "A dark ball, slow but heavy." }),
    m({ id: "shadowsneak", name: "Shadow Sneak", type: "Ghost", kind: "dash", power: 0.9, cd: 2.4, range: 220, desc: "Slip forward through foes." }),
    m({ id: "sludgebomb", name: "Sludge Bomb", type: "Poison", kind: "lob", power: 1.8, cd: 4.6, range: 320, windup: 0.5, status: { kind: "psn", chance: 0.5 }, desc: "Toxic sludge lobbed at the spot." }),
    m({ id: "darkpulse", name: "Dark Pulse", type: "Dark", kind: "spread", power: 0.7, cd: 2.0, n: 3, speed: 440, desc: "Waves of dark energy." }),
    m({ id: "crunch", name: "Crunch", type: "Dark", kind: "dash", power: 1.3, cd: 3.0, range: 200, desc: "Lunge and bite." }),
    m({ id: "aurasphere", name: "Aura Sphere", type: "Fighting", kind: "homing", power: 1.25, cd: 2.2, speed: 440, desc: "A sphere that never misses for long." }),
    m({ id: "bulletpunch", name: "Bullet Punch", type: "Steel", kind: "dash", power: 0.95, cd: 1.9, range: 200, desc: "A very fast punch." }),
    m({ id: "closecombat", name: "Close Combat", type: "Fighting", kind: "nova", power: 2.0, cd: 4.6, range: 120, windup: 0.2, desc: "A flurry of blows all around." }),
    m({ id: "swordsdance", name: "Swords Dance", type: "Normal", kind: "buff", power: 1.45, cd: 10, desc: "Hit much harder for a while." }),
    m({ id: "dragonrush", name: "Dragon Rush", type: "Dragon", kind: "dash", power: 1.5, cd: 3.4, range: 240, desc: "A crashing charge." }),
    m({ id: "dragonpulse", name: "Dragon Pulse", type: "Dragon", kind: "proj", power: 1.5, cd: 1.9, speed: 460, pierce: true, desc: "A shockwave that passes through." }),
    m({ id: "earthquake", name: "Earthquake", type: "Ground", kind: "nova", power: 1.9, cd: 5.2, range: 170, windup: 0.35, desc: "The whole ground shakes." }),
    m({ id: "stoneedge", name: "Stone Edge", type: "Rock", kind: "spread", power: 0.85, cd: 2.4, n: 4, speed: 500, desc: "Jagged stones fly out." }),
    m({ id: "rockslide", name: "Rock Slide", type: "Rock", kind: "lob", power: 1.9, cd: 5, range: 320, windup: 0.5, desc: "Boulders fall on the spot." }),
    m({ id: "psybeam", name: "Psybeam", type: "Psychic", kind: "proj", power: 1.0, cd: 1.2, speed: 520, desc: "A shimmering ray." }),
    m({ id: "psychic", name: "Psychic", type: "Psychic", kind: "nova", power: 1.6, cd: 4.4, range: 140, windup: 0.3, desc: "A burst of mind power." }),
    m({ id: "psystrike", name: "Psystrike", type: "Psychic", kind: "proj", power: 2.2, cd: 3.2, speed: 460, pierce: true, desc: "A piercing psychic blast." }),
    m({ id: "moonblast", name: "Moonblast", type: "Fairy", kind: "lob", power: 1.9, cd: 4.8, range: 330, windup: 0.5, desc: "Moonlight falls on the spot." }),
    m({ id: "calmmind", name: "Calm Mind", type: "Psychic", kind: "buff", power: 1.4, cd: 10, desc: "Focus: hit much harder for a while." }),
    m({ id: "recover", name: "Recover", type: "Normal", kind: "heal", power: 0.4, cd: 9, desc: "Recover some HP." }),
    m({ id: "protect", name: "Protect", type: "Normal", kind: "guard", power: 0, cd: 6, desc: "Block almost everything for a moment." }),
    m({ id: "flashcannon", name: "Flash Cannon", type: "Steel", kind: "proj", power: 1.3, cd: 1.8, speed: 500, desc: "A beam of metal light." }),
    m({ id: "xscissor", name: "X-Scissor", type: "Bug", kind: "nova", power: 1.5, cd: 3.4, range: 120, windup: 0.2, desc: "Cross slashes all around." }),
    m({ id: "airslash", name: "Air Slash", type: "Flying", kind: "spread", power: 0.7, cd: 1.8, n: 3, speed: 560, desc: "Blades of air." }),
    m({ id: "icebeam", name: "Ice Beam", type: "Ice", kind: "beam", power: 0.45, cd: 3.0, n: 8, range: 280, status: { kind: "frz", chance: 0.12 }, desc: "A freezing stream." }),
    m({ id: "flareblitz", name: "Flare Blitz", type: "Fire", kind: "dash", power: 1.9, cd: 4.2, range: 250, status: { kind: "brn", chance: 0.3 }, desc: "A blazing charge that burns everything it hits." }),
    m({ id: "blazekick", name: "Blaze Kick", type: "Fire", kind: "dash", power: 1.4, cd: 3.0, range: 220, status: { kind: "brn", chance: 0.2 }, desc: "A flaming flying kick." }),
    m({ id: "bravebird", name: "Brave Bird", type: "Flying", kind: "dash", power: 1.8, cd: 4.0, range: 270, desc: "Dive at full speed." }),
    m({ id: "aerialace", name: "Aerial Ace", type: "Flying", kind: "dash", power: 1.0, cd: 2.2, range: 240, desc: "A swift, sure slash." }),
    m({ id: "watershuriken", name: "Water Shuriken", type: "Water", kind: "spread", power: 0.55, cd: 1.5, n: 4, speed: 660, desc: "Throwing stars of water." }),
    m({ id: "nightslash", name: "Night Slash", type: "Dark", kind: "dash", power: 1.3, cd: 2.4, range: 220, desc: "Slash through in the dark." }),
    m({ id: "meteormash", name: "Meteor Mash", type: "Steel", kind: "dash", power: 1.6, cd: 3.2, range: 220, desc: "A fist like a falling star." }),
    m({ id: "zenheadbutt", name: "Zen Headbutt", type: "Psychic", kind: "dash", power: 1.5, cd: 3.0, range: 220, desc: "A charge with a focused mind." }),
    m({ id: "dracometeor", name: "Draco Meteor", type: "Dragon", kind: "lob", power: 2.9, cd: 7, range: 360, windup: 0.7, desc: "Meteors fall on the target spot." }),
    m({ id: "outrage", name: "Outrage", type: "Dragon", kind: "nova", power: 2.3, cd: 5.5, range: 150, windup: 0.3, desc: "A furious burst all around." }),
    m({ id: "wildcharge", name: "Wild Charge", type: "Electric", kind: "dash", power: 1.7, cd: 3.4, range: 240, status: { kind: "par", chance: 0.25 }, desc: "Crackle through foes." }),
    m({ id: "extremespeed", name: "Extreme Speed", type: "Normal", kind: "dash", power: 1.1, cd: 2.0, range: 290, desc: "Faster than the eye." }),
    m({ id: "blizzard", name: "Blizzard", type: "Ice", kind: "nova", power: 2.0, cd: 5.5, range: 190, windup: 0.35, status: { kind: "frz", chance: 0.25 }, desc: "A freezing storm all around." }),
    m({ id: "crosschop", name: "Cross Chop", type: "Fighting", kind: "dash", power: 1.5, cd: 3.0, range: 210, desc: "Two chops in one rush." }),
    m({ id: "dynamicpunch", name: "Dynamic Punch", type: "Fighting", kind: "nova", power: 2.3, cd: 5.0, range: 125, windup: 0.3, status: { kind: "par", chance: 0.4 }, desc: "A punch that shakes everything." }),
    m({ id: "bodyslam", name: "Body Slam", type: "Normal", kind: "dash", power: 1.5, cd: 3.2, range: 200, status: { kind: "par", chance: 0.3 }, desc: "Crush them under your weight." }),
    m({ id: "rest", name: "Rest", type: "Psychic", kind: "heal", power: 0.55, cd: 14, desc: "Recover a lot of HP." }),
    m({ id: "leafblade", name: "Leaf Blade", type: "Grass", kind: "dash", power: 1.4, cd: 2.6, range: 220, desc: "Slice with a blade of leaf." }),
    m({ id: "leafstorm", name: "Leaf Storm", type: "Grass", kind: "spread", power: 0.62, cd: 4.2, n: 7, speed: 560, desc: "A whirl of leaves in every direction ahead." }),
    m({ id: "shadowclaw", name: "Shadow Claw", type: "Ghost", kind: "dash", power: 1.3, cd: 2.4, range: 220, desc: "Rake through with a claw of shadow." }),
    m({ id: "phantomforce", name: "Phantom Force", type: "Ghost", kind: "dash", power: 1.9, cd: 5.0, range: 270, desc: "Vanish and strike." }),
    m({ id: "kingsshield", name: "King's Shield", type: "Steel", kind: "guard", power: 0, cd: 6, desc: "Block almost everything for a moment." }),
    m({ id: "hyperbeam", name: "Hyper Beam", type: "Normal", kind: "bolt", power: 3.2, cd: 8, range: 560, windup: 0.7, pierce: true, desc: "An enormous beam after a long charge." }),
  ].map((d) => [d.id, d]),
);

export type Species = {
  id: string; //       the sprite name
  num: number;
  name: string;
  types: string[];
  /** hp, atk, def, spa, spd, spe (base stats) */
  bs: [number, number, number, number, number, number];
  moves: [string, string, string, string];
  role: "brawler" | "shooter" | "bomber";
  /** Bigger Pokémon get a bigger body. */
  size: number;
  blurb: string;
  /** Needs this wave reached in Survival before it can be played. */
  unlock?: number;
};

export const ROSTER: Species[] = [
  { id: "charizard", num: 6, name: "Charizard", types: ["Fire", "Flying"], bs: [78, 84, 78, 109, 85, 100], moves: ["flamethrower", "airslash", "flamewheel", "fireblast"], role: "shooter", size: 30, blurb: "Burning streams and a big finishing blast." },
  { id: "blastoise", num: 9, name: "Blastoise", types: ["Water"], bs: [79, 83, 100, 85, 105, 78], moves: ["waterpulse", "hydropump", "surf", "protect"], role: "shooter", size: 30, blurb: "Sturdy. Push foes away and block when pressed." },
  { id: "venusaur", num: 3, name: "Venusaur", types: ["Grass", "Poison"], bs: [80, 82, 83, 100, 100, 80], moves: ["razorleaf", "solarbeam", "sludgebomb", "synthesis"], role: "bomber", size: 30, blurb: "Leaves, a long beam, poison, and self-healing." },
  { id: "pikachu", num: 25, name: "Pikachu", types: ["Electric"], bs: [35, 55, 40, 50, 50, 90], moves: ["thundershock", "quickattack", "thunderbolt", "thunder"], role: "shooter", size: 20, blurb: "Small and fast. Hard to hit, quick to strike." },
  { id: "gengar", num: 94, name: "Gengar", types: ["Ghost", "Poison"], bs: [60, 65, 60, 130, 75, 110], moves: ["shadowball", "shadowsneak", "sludgebomb", "darkpulse"], role: "bomber", size: 26, blurb: "Slippery and strong, but fragile." },
  { id: "lucario", num: 448, name: "Lucario", types: ["Fighting", "Steel"], bs: [70, 110, 70, 115, 70, 90], moves: ["aurasphere", "bulletpunch", "closecombat", "swordsdance"], role: "brawler", size: 26, blurb: "Close combat and a homing sphere. Great combos." },
  { id: "garchomp", num: 445, name: "Garchomp", types: ["Dragon", "Ground"], bs: [108, 130, 95, 80, 85, 102], moves: ["dragonrush", "earthquake", "stoneedge", "dragonpulse"], role: "brawler", size: 30, blurb: "Fast, tough and heavy-handed." },
  { id: "gardevoir", num: 282, name: "Gardevoir", types: ["Psychic", "Fairy"], bs: [68, 65, 65, 125, 115, 80], moves: ["psybeam", "moonblast", "calmmind", "shadowball"], role: "bomber", size: 26, blurb: "Moonlight and focus for slow, heavy hits." },
  { id: "alakazam", num: 65, name: "Alakazam", types: ["Psychic"], bs: [55, 50, 45, 135, 95, 120], moves: ["psybeam", "psychic", "recover", "shadowball"], role: "shooter", size: 24, blurb: "Very fast, very fragile. Heals itself." },
  { id: "dragonite", num: 149, name: "Dragonite", types: ["Dragon", "Flying"], bs: [91, 134, 95, 100, 100, 80], moves: ["dragonpulse", "dragonrush", "hyperbeam", "protect"], role: "brawler", size: 32, blurb: "A huge charge and an even bigger beam." },
  { id: "scizor", num: 212, name: "Scizor", types: ["Bug", "Steel"], bs: [70, 130, 100, 55, 80, 65], moves: ["bulletpunch", "xscissor", "swordsdance", "flashcannon"], role: "brawler", size: 26, blurb: "Power up, then rush in." },
  { id: "gyarados", num: 130, name: "Gyarados", types: ["Water", "Flying"], bs: [95, 125, 79, 60, 100, 81], moves: ["hydropump", "crunch", "dragonpulse", "surf"], role: "brawler", size: 34, blurb: "Wide and wild." },
  { id: "umbreon", num: 197, name: "Umbreon", types: ["Dark"], bs: [95, 65, 110, 60, 130, 65], moves: ["darkpulse", "quickattack", "protect", "recover"], role: "shooter", size: 24, blurb: "A tank that outlasts anyone." },
  { id: "tyranitar", num: 248, name: "Tyranitar", types: ["Rock", "Dark"], bs: [100, 134, 110, 95, 100, 61], moves: ["stoneedge", "crunch", "earthquake", "rockslide"], role: "brawler", size: 32, blurb: "Slow, strong and everywhere at once." },
  { id: "blaziken", num: 257, name: "Blaziken", types: ["Fire", "Fighting"], bs: [80, 120, 70, 110, 70, 80], moves: ["flamethrower", "blazekick", "closecombat", "swordsdance"], role: "brawler", size: 28, blurb: "Kicks and flames. Power up, then pile on." },
  { id: "greninja", num: 658, name: "Greninja", types: ["Water", "Dark"], bs: [72, 95, 67, 103, 71, 122], moves: ["watershuriken", "nightslash", "icebeam", "darkpulse"], role: "shooter", size: 24, blurb: "Very fast. Throws stars, slips in with a slash." },
  { id: "metagross", num: 376, name: "Metagross", types: ["Steel", "Psychic"], bs: [80, 135, 130, 95, 90, 70], moves: ["meteormash", "zenheadbutt", "earthquake", "flashcannon"], role: "brawler", size: 32, blurb: "A slow, heavy wall of metal." },
  { id: "salamence", num: 373, name: "Salamence", types: ["Dragon", "Flying"], bs: [95, 135, 80, 110, 80, 100], moves: ["dragonpulse", "aerialace", "dracometeor", "outrage"], role: "brawler", size: 32, blurb: "Meteors from above and a furious burst." },
  { id: "jolteon", num: 135, name: "Jolteon", types: ["Electric"], bs: [65, 65, 60, 110, 95, 130], moves: ["thundershock", "thunderbolt", "quickattack", "wildcharge"], role: "shooter", size: 22, blurb: "The fastest of all. Sparks everywhere." },
  { id: "arcanine", num: 59, name: "Arcanine", types: ["Fire"], bs: [90, 110, 80, 100, 80, 95], moves: ["flamethrower", "flareblitz", "extremespeed", "fireblast"], role: "brawler", size: 28, blurb: "Charges across the whole arena." },
  { id: "lapras", num: 131, name: "Lapras", types: ["Water", "Ice"], bs: [130, 85, 80, 85, 95, 60], moves: ["waterpulse", "icebeam", "surf", "blizzard"], role: "shooter", size: 32, blurb: "Big HP. Freezes foes solid." },
  { id: "machamp", num: 68, name: "Machamp", types: ["Fighting"], bs: [90, 130, 80, 65, 85, 55], moves: ["crosschop", "dynamicpunch", "stoneedge", "protect"], role: "brawler", size: 30, blurb: "Four fists. Slow, but crushing." },
  { id: "snorlax", num: 143, name: "Snorlax", types: ["Normal"], bs: [160, 110, 65, 65, 110, 30], moves: ["bodyslam", "earthquake", "hyperbeam", "rest"], role: "brawler", size: 34, blurb: "A mountain of HP. Sleeps off any damage." },
  { id: "sceptile", num: 254, name: "Sceptile", types: ["Grass"], bs: [70, 85, 65, 105, 85, 120], moves: ["leafblade", "leafstorm", "dragonpulse", "aerialace"], role: "shooter", size: 26, blurb: "Quick blades and a storm of leaves." },
  { id: "dragapult", num: 887, name: "Dragapult", types: ["Dragon", "Ghost"], bs: [88, 120, 75, 100, 75, 142], moves: ["dragonpulse", "shadowball", "phantomforce", "dracometeor"], role: "bomber", size: 28, blurb: "Blindingly fast, with a meteor to finish." },
  { id: "aegislash", num: 681, name: "Aegislash", types: ["Steel", "Ghost"], bs: [60, 50, 140, 50, 140, 60], moves: ["shadowclaw", "flashcannon", "kingsshield", "swordsdance"], role: "brawler", size: 26, blurb: "Hold the shield, then strike." },
  { id: "mewtwo", num: 150, name: "Mewtwo", types: ["Psychic"], bs: [106, 110, 90, 154, 90, 130], moves: ["psystrike", "shadowball", "aurasphere", "recover"], role: "shooter", size: 30, blurb: "The first boss. Reach wave 5 to play as it.", unlock: 5 },
  { id: "rayquaza", num: 384, name: "Rayquaza", types: ["Dragon", "Flying"], bs: [105, 150, 90, 150, 90, 95], moves: ["dragonpulse", "dracometeor", "aerialace", "outrage"], role: "brawler", size: 34, blurb: "The sky boss. Reach wave 10 to play as it.", unlock: 10 },
];

export const speciesOf = (id: string) => ROSTER.find((s) => s.id === id) ?? ROSTER[0]!;

/** Foes for the survival waves, easiest first. */
export const FOE_POOL = ["pikachu", "jolteon", "umbreon", "gengar", "sceptile", "arcanine", "gyarados", "lucario", "scizor", "machamp", "greninja", "venusaur", "blastoise", "charizard", "blaziken", "lapras", "garchomp", "gardevoir", "metagross", "tyranitar", "salamence", "dragonite", "dragapult", "aegislash", "snorlax", "alakazam"];

export type Perk = { id: string; name: string; desc: string; icon: string };
export const PERKS: Perk[] = [
  { id: "power", name: "Power Up", desc: "+18% damage", icon: "💥" },
  { id: "swift", name: "Swift Feet", desc: "+14% move speed", icon: "👟" },
  { id: "haste", name: "Quick Recovery", desc: "Moves recharge 15% faster", icon: "⏱️" },
  { id: "vigor", name: "Vigor", desc: "+25% max HP and heal that much", icon: "💚" },
  { id: "drain", name: "Life Drain", desc: "Heal 7% of the damage you deal", icon: "🩸" },
  { id: "roll", name: "Nimble Roll", desc: "Dodge recharges 30% faster", icon: "🌀" },
  { id: "crit", name: "Sharp Eyes", desc: "+14% chance of a critical hit", icon: "🎯" },
  { id: "guardian", name: "Tough Skin", desc: "Take 12% less damage", icon: "🛡️" },
];

export type FieldKind = "none" | "sun" | "rain" | "sand" | "hail";
export const FIELDS: Record<Exclude<FieldKind, "none">, { icon: string; name: string; bn: string; up: string[]; down: string[]; chip: string[] }> = {
  sun: { icon: "☀️", name: "Harsh Sun", bn: "কড়া রোদ", up: ["Fire"], down: ["Water"], chip: [] },
  rain: { icon: "🌧️", name: "Heavy Rain", bn: "ভারী বৃষ্টি", up: ["Water", "Electric"], down: ["Fire"], chip: [] },
  sand: { icon: "🏜️", name: "Sandstorm", bn: "বালুঝড়", up: ["Rock", "Ground"], down: [], chip: ["Rock", "Ground", "Steel"] },
  hail: { icon: "❄️", name: "Hailstorm", bn: "শিলাবৃষ্টি", up: ["Ice"], down: [], chip: ["Ice"] },
};

export type ItemKind = "heal" | "orb" | "boots" | "crystal";
export const ITEMS: Record<ItemKind, { icon: string; color: string; name: string; bn: string }> = {
  heal: { icon: "❤", color: "#ff6b81", name: "Berry", bn: "বেরি" },
  orb: { icon: "⚡", color: "#ffe14d", name: "Energy Orb", bn: "এনার্জি অর্ব" },
  boots: { icon: "➤", color: "#7fe3ff", name: "Speed Boots", bn: "স্পিড বুট" },
  crystal: { icon: "◆", color: "#d28bff", name: "Power Crystal", bn: "পাওয়ার ক্রিস্টাল" },
};
