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
  | "burrow" // dig under the floor, untouchable, and burst out at the end
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
    m({ id: "dig", name: "Dig", type: "Ground", kind: "burrow", power: 1.9, cd: 4.6, range: 270, desc: "Burrow under the floor, untouchable, and burst out under your foe." }),
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
  { id: "garchomp", num: 445, name: "Garchomp", types: ["Dragon", "Ground"], bs: [108, 130, 95, 80, 85, 102], moves: ["dragonrush", "earthquake", "stoneedge", "dig"], role: "brawler", size: 30, blurb: "Fast, tough and heavy-handed. Digs under the floor." },
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
  { id: "absol", num: 359, name: "Absol", types: ["Dark"], bs: [65, 130, 60, 75, 60, 75], moves: ["nightslash", "shadowclaw", "swordsdance", "aerialace"], role: "brawler", size: 26, blurb: "A sharp, fast cutter. Mega Absol Z waits for you." },
  { id: "clefable", num: 36, name: "Clefable", types: ["Fairy"], bs: [95, 70, 73, 95, 90, 60], moves: ["moonblast", "psybeam", "calmmind", "recover"], role: "bomber", size: 26, blurb: "Moonlight, patience and self-healing." },
  { id: "starmie", num: 121, name: "Starmie", types: ["Water", "Psychic"], bs: [60, 75, 85, 100, 85, 115], moves: ["waterpulse", "psychic", "icebeam", "recover"], role: "shooter", size: 24, blurb: "Fast, bright and tricky to pin down." },
  { id: "victreebel", num: 71, name: "Victreebel", types: ["Grass", "Poison"], bs: [80, 105, 65, 100, 70, 70], moves: ["razorleaf", "sludgebomb", "leafblade", "synthesis"], role: "bomber", size: 28, blurb: "Leaves and poison from a distance." },
  { id: "meganium", num: 154, name: "Meganium", types: ["Grass"], bs: [80, 82, 100, 83, 100, 80], moves: ["razorleaf", "solarbeam", "bodyslam", "synthesis"], role: "shooter", size: 30, blurb: "Steady, tough and gentle healing." },
  { id: "feraligatr", num: 160, name: "Feraligatr", types: ["Water"], bs: [85, 105, 100, 79, 83, 78], moves: ["waterpulse", "crunch", "surf", "swordsdance"], role: "brawler", size: 30, blurb: "Bites hard once it is powered up." },
  { id: "emboar", num: 500, name: "Emboar", types: ["Fire", "Fighting"], bs: [110, 123, 65, 100, 65, 65], moves: ["flamethrower", "flareblitz", "crosschop", "fireblast"], role: "brawler", size: 32, blurb: "A heavy fire fighter with big HP." },
  { id: "excadrill", num: 530, name: "Excadrill", types: ["Ground", "Steel"], bs: [110, 135, 60, 50, 65, 88], moves: ["bulletpunch", "dig", "stoneedge", "swordsdance"], role: "brawler", size: 28, blurb: "Drills through anything at speed, even under the floor." },
  { id: "chandelure", num: 609, name: "Chandelure", types: ["Ghost", "Fire"], bs: [60, 55, 90, 145, 90, 80], moves: ["shadowball", "flamethrower", "fireblast", "calmmind"], role: "bomber", size: 26, blurb: "Ghost fire. Fragile, with a huge reach." },
  { id: "chesnaught", num: 652, name: "Chesnaught", types: ["Grass", "Fighting"], bs: [88, 107, 122, 74, 75, 64], moves: ["leafblade", "dynamicpunch", "kingsshield", "synthesis"], role: "brawler", size: 30, blurb: "A spiky wall that hits back." },
  { id: "delphox", num: 655, name: "Delphox", types: ["Fire", "Psychic"], bs: [75, 69, 72, 114, 100, 104], moves: ["flamethrower", "psybeam", "fireblast", "calmmind"], role: "shooter", size: 26, blurb: "Fire and mind, from a safe distance." },
  { id: "hawlucha", num: 701, name: "Hawlucha", types: ["Fighting", "Flying"], bs: [78, 92, 75, 74, 63, 118], moves: ["aerialace", "closecombat", "bravebird", "swordsdance"], role: "brawler", size: 24, blurb: "A flying wrestler. Dive in, then dive out." },
  { id: "skarmory", num: 227, name: "Skarmory", types: ["Steel", "Flying"], bs: [65, 80, 140, 40, 70, 70], moves: ["airslash", "flashcannon", "bravebird", "protect"], role: "shooter", size: 28, blurb: "Steel wings. Very hard to hurt." },
  { id: "froslass", num: 478, name: "Froslass", types: ["Ice", "Ghost"], bs: [70, 80, 70, 80, 70, 110], moves: ["icebeam", "shadowball", "blizzard", "shadowsneak"], role: "shooter", size: 24, blurb: "Cold and quick. Freezes what it touches." },
  { id: "mimikyu", num: 778, name: "Mimikyu", types: ["Ghost", "Fairy"], bs: [55, 90, 80, 50, 105, 96], moves: ["shadowclaw", "moonblast", "swordsdance", "shadowsneak"], role: "brawler", size: 22, blurb: "Small, spooky, and terribly strong in a Z-Move." },
  { id: "corviknight", num: 823, name: "Corviknight", types: ["Flying", "Steel"], bs: [98, 87, 105, 53, 85, 67], moves: ["bravebird", "flashcannon", "aerialace", "kingsshield"], role: "brawler", size: 32, blurb: "An armoured crow. Gigantamax is a sight." },
  { id: "hydreigon", num: 635, name: "Hydreigon", types: ["Dark", "Dragon"], bs: [92, 105, 90, 125, 90, 98], moves: ["darkpulse", "dragonpulse", "dracometeor", "flashcannon"], role: "bomber", size: 30, blurb: "Three heads, three kinds of trouble." },
  { id: "kommoo", num: 784, name: "Kommo-o", types: ["Dragon", "Fighting"], bs: [75, 110, 125, 100, 105, 85], moves: ["dragonpulse", "closecombat", "outrage", "swordsdance"], role: "brawler", size: 30, blurb: "Scales that ring. Great Z-Move." },
  { id: "zeraora", num: 807, name: "Zeraora", types: ["Electric"], bs: [88, 112, 75, 102, 80, 143], moves: ["wildcharge", "thunderbolt", "quickattack", "aurasphere"], role: "brawler", size: 24, blurb: "The fastest of the fast. Mega Zeraora is out of this world." },
  { id: "darkrai", num: 491, name: "Darkrai", types: ["Dark"], bs: [70, 90, 90, 135, 90, 125], moves: ["darkpulse", "shadowball", "nightslash", "calmmind"], role: "bomber", size: 26, blurb: "Nightmares in the arena." },
  { id: "heatran", num: 485, name: "Heatran", types: ["Fire", "Steel"], bs: [91, 90, 106, 130, 106, 77], moves: ["flamethrower", "flashcannon", "earthquake", "protect"], role: "shooter", size: 30, blurb: "A molten tank." },
  { id: "golurk", num: 623, name: "Golurk", types: ["Ground", "Ghost"], bs: [89, 124, 80, 55, 80, 55], moves: ["earthquake", "shadowclaw", "dynamicpunch", "stoneedge"], role: "brawler", size: 34, blurb: "A giant that shakes the floor." },
  { id: "raichu", num: 26, name: "Raichu", types: ["Electric"], bs: [60, 90, 55, 90, 80, 110], moves: ["thundershock", "thunderbolt", "quickattack", "wildcharge"], role: "shooter", size: 24, blurb: "Mega Raichu X or Y for a shock finish." },
  { id: "staraptor", num: 398, name: "Staraptor", types: ["Normal", "Flying"], bs: [85, 120, 70, 50, 60, 100], moves: ["bravebird", "aerialace", "closecombat", "extremespeed"], role: "brawler", size: 28, blurb: "Divebombs from every direction." },
  { id: "baxcalibur", num: 998, name: "Baxcalibur", types: ["Dragon", "Ice"], bs: [115, 145, 92, 75, 86, 87], moves: ["icebeam", "dragonrush", "blizzard", "outrage"], role: "brawler", size: 32, blurb: "Ice and dragon fury." },
  { id: "chimecho", num: 358, name: "Chimecho", types: ["Psychic"], bs: [75, 50, 80, 95, 90, 65], moves: ["psychic", "psybeam", "recover", "calmmind"], role: "bomber", size: 20, blurb: "A tiny bell with a big mind." },
  { id: "crabominable", num: 740, name: "Crabominable", types: ["Fighting", "Ice"], bs: [97, 132, 77, 62, 67, 43], moves: ["dynamicpunch", "crosschop", "icebeam", "blizzard"], role: "brawler", size: 32, blurb: "Frozen fists." },
  { id: "golisopod", num: 768, name: "Golisopod", types: ["Bug", "Water"], bs: [75, 125, 140, 60, 90, 40], moves: ["xscissor", "waterpulse", "closecombat", "protect"], role: "brawler", size: 30, blurb: "Armour first, claws second." },
  { id: "scovillain", num: 952, name: "Scovillain", types: ["Grass", "Fire"], bs: [65, 108, 65, 108, 65, 75], moves: ["flamethrower", "razorleaf", "solarbeam", "synthesis"], role: "shooter", size: 26, blurb: "Spicy two-faced attacker." },
  { id: "glimmora", num: 970, name: "Glimmora", types: ["Rock", "Poison"], bs: [83, 55, 90, 130, 81, 86], moves: ["sludgebomb", "rockslide", "stoneedge", "darkpulse"], role: "bomber", size: 26, blurb: "Crystal blasts from above." },
  { id: "tatsugiri", num: 978, name: "Tatsugiri", types: ["Dragon", "Water"], bs: [68, 50, 60, 120, 95, 82], moves: ["dragonpulse", "hydropump", "dracometeor", "calmmind"], role: "shooter", size: 20, blurb: "Small, but it sits in a very big dragon." },
  { id: "meowstic", num: 678, name: "Meowstic", types: ["Psychic"], bs: [74, 48, 76, 83, 81, 104], moves: ["psybeam", "shadowball", "calmmind", "recover"], role: "shooter", size: 22, blurb: "Quick psychic cat." },
  { id: "magearna", num: 801, name: "Magearna", types: ["Steel", "Fairy"], bs: [80, 95, 115, 130, 115, 65], moves: ["flashcannon", "moonblast", "shadowball", "kingsshield"], role: "bomber", size: 28, blurb: "A wind-up wonder. Mega form too." },
  { id: "mewtwo", num: 150, name: "Mewtwo", types: ["Psychic"], bs: [106, 110, 90, 154, 90, 130], moves: ["psystrike", "shadowball", "aurasphere", "recover"], role: "shooter", size: 30, blurb: "The first boss. Reach wave 5 to play as it.", unlock: 5 },
  { id: "rayquaza", num: 384, name: "Rayquaza", types: ["Dragon", "Flying"], bs: [105, 150, 90, 150, 90, 95], moves: ["dragonpulse", "dracometeor", "aerialace", "outrage"], role: "brawler", size: 34, blurb: "The sky boss. Reach wave 10 to play as it.", unlock: 10 },
];

export const speciesOf = (id: string) => ROSTER.find((s) => s.id === id) ?? ROSTER[0]!;

/** Foes for the survival waves, easiest first. */
export const FOE_POOL = ["pikachu", "jolteon", "umbreon", "gengar", "sceptile", "arcanine", "gyarados", "lucario", "scizor", "machamp", "greninja", "venusaur", "blastoise", "charizard", "blaziken", "lapras", "garchomp", "gardevoir", "metagross", "tyranitar", "salamence", "dragonite", "dragapult", "aegislash", "snorlax", "alakazam", "hydreigon", "kommoo", "corviknight", "heatran", "darkrai", "baxcalibur", "zeraora"];

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

/* ------------------------------------------------------------------ gimmicks */

export type GimmickKind = "awaken" | "mega" | "zmove" | "dynamax" | "tera";

export const GIMMICKS: Record<GimmickKind, { icon: string; label: string; bn: string; short: string; blurb: string; blurbBn: string }> = {
  awaken: { icon: "⚡", label: "Awaken", bn: "জাগরণ", short: "AWAKEN", blurb: "A shockwave, then 8 seconds of more damage, speed and faster recharge.", blurbBn: "একটি ঝলক, তারপর ৮ সেকেন্ড বেশি ড্যামেজ, গতি ও দ্রুত রিচার্জ।" },
  mega: { icon: "💎", label: "Mega Evolution", bn: "মেগা বিবর্তন", short: "MEGA", blurb: "Evolve for 15 seconds: new look, stronger stats, sometimes a new type. Z forms also pulse on every move.", blurbBn: "১৫ সেকেন্ডের জন্য নতুন রূপ: বেশি শক্তি, কখনো নতুন টাইপ। Z রূপ প্রতিটি চালে ঢেউ ছাড়ে।" },
  zmove: { icon: "✨", label: "Z-Move", bn: "জেড-মুভ", short: "Z-MOVE", blurb: "A cinematic finisher of your type that hits every foe on the floor and cannot be dodged.", blurbBn: "আপনার টাইপের সিনেমাটিক ফিনিশার: মাঠের সব শত্রুকে আঘাত করে, এড়ানো যায় না।" },
  dynamax: { icon: "🌋", label: "Dynamax / Gigantamax", bn: "ডায়নাম্যাক্স / গিগান্টাম্যাক্স", short: "MAX", blurb: "Grow huge for 12 seconds: +50% HP, moves become Max Moves with area blasts and weather. Gigantamax forms add a G-Max blast.", blurbBn: "১২ সেকেন্ড বিশাল হয়ে যান: +৫০% HP, চালগুলো এলাকা-বিস্ফোরণ ও আবহাওয়াসহ ম্যাক্স মুভ হয়। গিগান্টাম্যাক্সে বাড়তি বিস্ফোরণ।" },
  tera: { icon: "🔮", label: "Terastallize", bn: "টেরাস্টালাইজ", short: "TERA", blurb: "Become a crystal of any type for 25 seconds: a crystal shield, a stronger same-type bonus, and your 4th move turns into Tera Blast.", blurbBn: "২৫ সেকেন্ডের জন্য যেকোনো টাইপের ক্রিস্টাল: ক্রিস্টাল ঢাল, শক্তিশালী একই-টাইপ বোনাস, আর ৪র্থ চাল হয় টেরা ব্লাস্ট।" },
};

export const TERA_TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];

export type MegaForm = {
  id: string;
  name: string;
  /** The sprite name on the picture server. */
  sprite: string;
  /** Types after evolving, when they change. */
  types?: string[];
  /** Attack, defence and speed multipliers while evolved. */
  p?: number;
  d?: number;
  s?: number;
  /** The new Z forms: they send out a pulse with every move. */
  z?: boolean;
  /** Introduced with Legends Z-A or its Mega Dimension DLC. */
  za?: boolean;
};
const mf = (id: string, name: string, o: Partial<MegaForm> = {}): MegaForm => ({ id, name, sprite: id, ...o });

export const MEGAS: Record<string, MegaForm[]> = {
  charizard: [mf("charizard-megax", "Mega Charizard X", { types: ["Fire", "Dragon"], p: 1.34, d: 1.3, s: 1.0 }), mf("charizard-megay", "Mega Charizard Y", { p: 1.36, d: 1.12, s: 1.08 })],
  venusaur: [mf("venusaur-mega", "Mega Venusaur", { p: 1.2, d: 1.35, s: 1.0 })],
  blastoise: [mf("blastoise-mega", "Mega Blastoise", { p: 1.3, d: 1.2, s: 1.0 })],
  gengar: [mf("gengar-mega", "Mega Gengar", { p: 1.2, d: 1.1, s: 1.18 })],
  lucario: [mf("lucario-mega", "Mega Lucario", { p: 1.3, d: 1.1, s: 1.12 }), mf("lucario-megaz", "Mega Lucario Z", { types: ["Fighting", "Steel"], p: 1.42, d: 1.2, s: 1.18, z: true, za: true })],
  garchomp: [mf("garchomp-mega", "Mega Garchomp", { p: 1.28, d: 1.12, s: 1.0 }), mf("garchomp-megaz", "Mega Garchomp Z", { types: ["Dragon"], p: 1.42, d: 1.2, s: 1.15, z: true, za: true })],
  gardevoir: [mf("gardevoir-mega", "Mega Gardevoir", { p: 1.3, d: 1.2, s: 1.0 })],
  alakazam: [mf("alakazam-mega", "Mega Alakazam", { p: 1.3, d: 1.15, s: 1.12 })],
  scizor: [mf("scizor-mega", "Mega Scizor", { p: 1.25, d: 1.25, s: 1.05 })],
  gyarados: [mf("gyarados-mega", "Mega Gyarados", { types: ["Water", "Dark"], p: 1.28, d: 1.25, s: 1.05 })],
  tyranitar: [mf("tyranitar-mega", "Mega Tyranitar", { p: 1.25, d: 1.3, s: 1.05 })],
  blaziken: [mf("blaziken-mega", "Mega Blaziken", { p: 1.3, d: 1.1, s: 1.15 })],
  salamence: [mf("salamence-mega", "Mega Salamence", { p: 1.3, d: 1.2, s: 1.05 })],
  metagross: [mf("metagross-mega", "Mega Metagross", { p: 1.28, d: 1.25, s: 1.1 })],
  absol: [mf("absol-mega", "Mega Absol", { p: 1.3, d: 1.1, s: 1.1 }), mf("absol-megaz", "Mega Absol Z", { types: ["Dark", "Ghost"], p: 1.42, d: 1.15, s: 1.2, z: true, za: true })],
  mewtwo: [mf("mewtwo-megax", "Mega Mewtwo X", { types: ["Psychic", "Fighting"], p: 1.3, d: 1.2, s: 1.05 }), mf("mewtwo-megay", "Mega Mewtwo Y", { p: 1.32, d: 1.15, s: 1.1 })],
  // new in Pokémon Legends: Z-A
  dragonite: [mf("dragonite-mega", "Mega Dragonite", { p: 1.28, d: 1.25, s: 1.05, za: true })],
  greninja: [mf("greninja-mega", "Mega Greninja", { p: 1.28, d: 1.12, s: 1.15, za: true })],
  delphox: [mf("delphox-mega", "Mega Delphox", { p: 1.3, d: 1.15, s: 1.08, za: true })],
  chesnaught: [mf("chesnaught-mega", "Mega Chesnaught", { p: 1.25, d: 1.3, s: 1.0, za: true })],
  emboar: [mf("emboar-mega", "Mega Emboar", { p: 1.3, d: 1.2, s: 1.0, za: true })],
  feraligatr: [mf("feraligatr-mega", "Mega Feraligatr", { p: 1.3, d: 1.2, s: 1.05, za: true })],
  meganium: [mf("meganium-mega", "Mega Meganium", { p: 1.2, d: 1.3, s: 1.0, za: true })],
  clefable: [mf("clefable-mega", "Mega Clefable", { p: 1.25, d: 1.25, s: 1.0, za: true })],
  starmie: [mf("starmie-mega", "Mega Starmie", { p: 1.28, d: 1.15, s: 1.12, za: true })],
  victreebel: [mf("victreebel-mega", "Mega Victreebel", { p: 1.28, d: 1.15, s: 1.0, za: true })],
  excadrill: [mf("excadrill-mega", "Mega Excadrill", { p: 1.3, d: 1.2, s: 1.1, za: true })],
  froslass: [mf("froslass-mega", "Mega Froslass", { p: 1.25, d: 1.15, s: 1.12, za: true })],
  hawlucha: [mf("hawlucha-mega", "Mega Hawlucha", { p: 1.3, d: 1.1, s: 1.15, za: true })],
  // new in the Mega Dimension DLC
  raichu: [mf("raichu-megax", "Mega Raichu X", { p: 1.35, d: 1.1, s: 1.05, za: true }), mf("raichu-megay", "Mega Raichu Y", { p: 1.3, d: 1.1, s: 1.15, za: true })],
  zeraora: [mf("zeraora-mega", "Mega Zeraora", { types: ["Electric"], p: 1.3, d: 1.15, s: 1.15, za: true })],
  heatran: [mf("heatran-mega", "Mega Heatran", { types: ["Fire", "Steel"], p: 1.28, d: 1.25, s: 1.05, za: true })],
  darkrai: [mf("darkrai-mega", "Mega Darkrai", { types: ["Dark"], p: 1.3, d: 1.15, s: 1.1, za: true })],
  golurk: [mf("golurk-mega", "Mega Golurk", { types: ["Ground", "Ghost"], p: 1.28, d: 1.25, s: 1.0, za: true })],
  staraptor: [mf("staraptor-mega", "Mega Staraptor", { types: ["Fighting", "Flying"], p: 1.3, d: 1.1, s: 1.12, za: true })],
  baxcalibur: [mf("baxcalibur-mega", "Mega Baxcalibur", { types: ["Dragon", "Ice"], p: 1.3, d: 1.2, s: 1.05, za: true })],
  chimecho: [mf("chimecho-mega", "Mega Chimecho", { types: ["Psychic", "Steel"], p: 1.3, d: 1.25, s: 1.05, za: true })],
  crabominable: [mf("crabominable-mega", "Mega Crabominable", { types: ["Fighting", "Ice"], p: 1.28, d: 1.2, s: 1.05, za: true })],
  golisopod: [mf("golisopod-mega", "Mega Golisopod", { types: ["Bug", "Steel"], p: 1.28, d: 1.25, s: 1.05, za: true })],
  scovillain: [mf("scovillain-mega", "Mega Scovillain", { types: ["Grass", "Fire"], p: 1.3, d: 1.1, s: 1.05, za: true })],
  glimmora: [mf("glimmora-mega", "Mega Glimmora", { types: ["Rock", "Poison"], p: 1.3, d: 1.15, s: 1.05, za: true })],
  tatsugiri: [mf("tatsugiri-mega", "Mega Tatsugiri", { types: ["Dragon", "Water"], p: 1.3, d: 1.15, s: 1.08, za: true })],
  meowstic: [mf("meowstic-mega", "Mega Meowstic", { types: ["Psychic"], p: 1.28, d: 1.15, s: 1.1, za: true })],
  magearna: [mf("magearna-mega", "Mega Magearna", { types: ["Steel", "Fairy"], p: 1.3, d: 1.25, s: 1.0, za: true })],
};

/** Pokémon that can Gigantamax (their Dynamax looks different and ends with an extra blast). */
export const GMAX = new Set(["charizard", "venusaur", "blastoise", "pikachu", "gengar", "lapras", "snorlax", "machamp", "corviknight"]);

export const Z_MOVES: Record<string, { name: string; bn: string }> = {
  Normal: { name: "Breakneck Blitz", bn: "ব্রেকনেক ব্লিটজ" },
  Fire: { name: "Inferno Overdrive", bn: "ইনফার্নো ওভারড্রাইভ" },
  Water: { name: "Hydro Vortex", bn: "হাইড্রো ভর্টেক্স" },
  Electric: { name: "Gigavolt Havoc", bn: "গিগাভোল্ট হ্যাভক" },
  Grass: { name: "Bloom Doom", bn: "ব্লুম ডুম" },
  Ice: { name: "Subzero Slammer", bn: "সাবজিরো স্ল্যামার" },
  Fighting: { name: "All-Out Pummeling", bn: "অল-আউট পামেলিং" },
  Poison: { name: "Acid Downpour", bn: "অ্যাসিড ডাউনপাউর" },
  Ground: { name: "Tectonic Rage", bn: "টেকটনিক রেজ" },
  Flying: { name: "Supersonic Skystrike", bn: "সুপারসনিক স্কাইস্ট্রাইক" },
  Psychic: { name: "Shattered Psyche", bn: "শ্যাটার্ড সাইকি" },
  Bug: { name: "Savage Spin-Out", bn: "স্যাভেজ স্পিন-আউট" },
  Rock: { name: "Continental Crush", bn: "কন্টিনেন্টাল ক্রাশ" },
  Ghost: { name: "Never-Ending Nightmare", bn: "নেভার-এন্ডিং নাইটমেয়ার" },
  Dragon: { name: "Devastating Drake", bn: "ডেভাস্টেটিং ড্রেক" },
  Dark: { name: "Black Hole Eclipse", bn: "ব্ল্যাক হোল ইক্লিপস" },
  Steel: { name: "Corkscrew Crash", bn: "কর্কস্ক্রু ক্র্যাশ" },
  Fairy: { name: "Twinkle Tackle", bn: "টুইঙ্কল ট্যাকল" },
};
/** A few Pokémon have a Z-Move of their own. */
export const Z_SIGNATURE: Record<string, { name: string; bn: string; type: string }> = {
  pikachu: { name: "Catastropika", bn: "ক্যাটাস্ট্রোপিকা", type: "Electric" },
  snorlax: { name: "Pulverizing Pancake", bn: "পালভারাইজিং প্যানকেক", type: "Normal" },
  mimikyu: { name: "Let's Snuggle Forever", bn: "লেটস স্ন্যাগল ফরএভার", type: "Fairy" },
  kommoo: { name: "Clangorous Soulblaze", bn: "ক্ল্যাঙ্গরাস সোলব্লেজ", type: "Dragon" },
};

/** Moves any Pokémon may learn as coverage, on top of its own types and the Normal moves. */
const COVERAGE = ["shadowball", "icebeam", "thunderbolt", "flashcannon", "darkpulse", "earthquake", "stoneedge", "sludgebomb", "psychic", "surf", "flamethrower", "dragonpulse", "aurasphere", "airslash", "xscissor", "crunch", "closecombat"];

/** Every move this Pokémon can choose from: its own default four first, then its types, Normal moves and some coverage. */
export function movePool(id: string): string[] {
  const sp = ROSTER.find((s) => s.id === id);
  if (!sp) return [];
  const out = new Set<string>(sp.moves);
  const ids = Object.keys(MOVES);
  for (const k of ids) if (sp.types.includes(MOVES[k]!.type)) out.add(k);
  for (const k of ids) if (MOVES[k]!.type === "Normal") out.add(k);
  for (const k of COVERAGE) if (MOVES[k]) out.add(k);
  return [...out];
}

/** Four different moves from this Pokémon's pool; anything wrong or missing falls back to its default four. */
export function cleanMoves(id: string, moves?: readonly string[] | null): [string, string, string, string] {
  const sp = ROSTER.find((s) => s.id === id);
  const def = (sp?.moves ?? ["quickattack", "protect", "recover", "swordsdance"]) as [string, string, string, string];
  if (!moves || moves.length !== 4) return def;
  const pool = new Set(movePool(id));
  if (!moves.every((m) => pool.has(m)) || new Set(moves).size !== 4) return def;
  return [moves[0]!, moves[1]!, moves[2]!, moves[3]!];
}

/** The most a Pokémon can do with each gimmick: which ones this species can use. */
export function gimmicksFor(id: string): GimmickKind[] {
  const out: GimmickKind[] = ["awaken", "zmove", "dynamax", "tera"];
  if (MEGAS[id]) out.splice(1, 0, "mega");
  return out;
}

/* ------------------------------------------------------- how each one moves */

export type Loco = "walk" | "run" | "fly" | "float" | "surf" | "slither";
const L = (loco: Loco, ids: string) => ids.split(" ").map((id) => [id, loco] as const);
/** Flyers hover and cross pits; floaters drift and cross pits; runners gallop; surfers swim; slitherers coil. */
export const LOCO: Record<string, Loco> = Object.fromEntries([
  ...L("fly", "charizard dragonite salamence staraptor skarmory corviknight rayquaza hydreigon scizor"),
  ...L("float", "mewtwo gengar alakazam gardevoir chandelure froslass darkrai chimecho magearna metagross starmie dragapult aegislash meowstic tatsugiri glimmora"),
  ...L("run", "pikachu raichu jolteon arcanine zeraora lucario umbreon absol sceptile blaziken greninja hawlucha excadrill garchomp"),
  ...L("surf", "lapras"),
  ...L("slither", "gyarados"),
]);
export const locoOf = (sp: Species): Loco => LOCO[sp.id] ?? (sp.types.includes("Flying") ? "fly" : sp.types.includes("Ghost") ? "float" : "walk");
/** The ones that burrow when they roll. */
export const DIGGERS = new Set(["garchomp", "excadrill"]);
export const isSwimmer = (sp: Species) => sp.types.includes("Water") || locoOf(sp) === "surf" || locoOf(sp) === "slither";
