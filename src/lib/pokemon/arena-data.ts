/**
 * Arena Brawl: the roster, the moves and the perks. Plain data, no DOM — the engine reads it,
 * the screens draw from it.
 */

import { LEARNSETS } from "@/lib/pokemon/arena-learnsets";

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
  | "buff" //  more damage for a while
  | "grab"; //  lift a foe in front of you, then throw it

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
  /** Borrow another move's impact art (see the renderer's moveFx). */
  fx?: string;
  /** Seconds a whirl stays and keeps hurting (lob moves). */
  linger?: number;
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
    m({ id: "darkvoid", name: "Dark Void", type: "Dark", kind: "lob", power: 2.0, cd: 5.0, range: 330, windup: 0.6, desc: "A black void opens where you aim and swallows what is inside." }),
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
    m({ id: "psychic", name: "Psychic", type: "Psychic", kind: "nova", power: 1.6, cd: 4.4, range: 140, windup: 0.3, fx: "levitate", desc: "A burst of mind power." }),
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
    m({ id: "psychicgrip", name: "Psychic Grip", type: "Psychic", kind: "grab", power: 2.6, cd: 7, range: 380, fx: "levitate", desc: "Lift a foe with your mind, hold it, then hurl it away." }),
    m({ id: "firespin", name: "Fire Spin", type: "Fire", kind: "lob", power: 1.4, cd: 6.5, range: 320, windup: 0.45, linger: 2.8, status: { kind: "brn", chance: 0.35 }, fx: "firespin", desc: "A fire tornado that stays and keeps burning." }),
    m({ id: "whirlpool", name: "Whirlpool", type: "Water", kind: "lob", power: 1.3, cd: 6.5, range: 320, windup: 0.45, linger: 2.8, fx: "whirlpool", desc: "A whirlpool that holds foes in its swirl." }),
    m({ id: "sandtomb", name: "Sand Tomb", type: "Ground", kind: "lob", power: 1.3, cd: 6.5, range: 320, windup: 0.45, linger: 2.8, fx: "sandtomb", desc: "A column of sand that traps and scrapes." }),
    m({ id: "doubleteam", name: "Double Team", type: "Normal", kind: "buff", power: 1.3, cd: 10, fx: "clones", desc: "Afterimages circle you: hit harder for a while." }),
    m({ id: "agility", name: "Agility", type: "Psychic", kind: "buff", power: 1.3, cd: 10, fx: "clones", desc: "Blur into afterimages: hit harder for a while." }),
    m({ id: "heatwave", name: "Heat Wave", type: "Fire", kind: "nova", power: 1.9, cd: 5, range: 180, windup: 0.3, status: { kind: "brn", chance: 0.3 }, fx: "fireblast", desc: "A scorching wave all around." }),
    m({ id: "overheat", name: "Overheat", type: "Fire", kind: "bolt", power: 2.6, cd: 6.5, range: 480, windup: 0.5, status: { kind: "brn", chance: 0.3 }, pierce: true, desc: "A huge line of flame." }),
    m({ id: "firepunch", name: "Fire Punch", type: "Fire", kind: "dash", power: 1.4, cd: 2.6, range: 210, status: { kind: "brn", chance: 0.25 }, desc: "A burning fist." }),
    m({ id: "eruption", name: "Eruption", type: "Fire", kind: "lob", power: 3.0, cd: 8, range: 340, windup: 0.7, status: { kind: "brn", chance: 0.4 }, fx: "fireblast", desc: "A volcano erupts on the spot." }),
    m({ id: "sacredfire", name: "Sacred Fire", type: "Fire", kind: "proj", power: 1.6, cd: 2.2, speed: 480, status: { kind: "brn", chance: 0.4 }, desc: "A holy flame that burns." }),
    m({ id: "blastburn", name: "Blast Burn", type: "Fire", kind: "lob", power: 3.2, cd: 9, range: 340, windup: 0.7, status: { kind: "brn", chance: 0.5 }, fx: "fireblast", desc: "A devastating blast of fire." }),
    m({ id: "fusionflare", name: "Fusion Flare", type: "Fire", kind: "lob", power: 2.4, cd: 6, range: 340, windup: 0.55, status: { kind: "brn", chance: 0.3 }, fx: "fireblast", desc: "A giant flame falls where you aim." }),
    m({ id: "aquatail", name: "Aqua Tail", type: "Water", kind: "dash", power: 1.5, cd: 3, range: 220, desc: "Sweep through with a heavy tail." }),
    m({ id: "waterfall", name: "Waterfall", type: "Water", kind: "dash", power: 1.4, cd: 2.8, range: 220, desc: "Climb through foes like a cascade." }),
    m({ id: "scald", name: "Scald", type: "Water", kind: "proj", power: 1.1, cd: 1.5, speed: 500, status: { kind: "brn", chance: 0.2 }, desc: "Boiling water that may burn." }),
    m({ id: "aquajet", name: "Aqua Jet", type: "Water", kind: "dash", power: 0.85, cd: 1.6, range: 230, desc: "A fast jet of water." }),
    m({ id: "muddywater", name: "Muddy Water", type: "Water", kind: "nova", power: 1.7, cd: 5, range: 160, windup: 0.3, fx: "surf", desc: "A wave of mud all around." }),
    m({ id: "originpulse", name: "Origin Pulse", type: "Water", kind: "spread", power: 0.8, cd: 3, n: 5, speed: 560, desc: "Beams of blue light in a fan." }),
    m({ id: "waterspout", name: "Water Spout", type: "Water", kind: "lob", power: 2.8, cd: 7.5, range: 340, windup: 0.6, fx: "surf", desc: "A great waterspout on the target." }),
    m({ id: "hydrocannon", name: "Hydro Cannon", type: "Water", kind: "bolt", power: 2.7, cd: 6.5, range: 500, windup: 0.6, pierce: true, desc: "A long burst of water." }),
    m({ id: "bubblebeam", name: "Bubble Beam", type: "Water", kind: "beam", power: 0.38, cd: 2.2, n: 8, range: 240, desc: "A stream of bubbles." }),
    m({ id: "energyball", name: "Energy Ball", type: "Grass", kind: "proj", power: 1.3, cd: 1.8, speed: 480, desc: "A ball of green energy." }),
    m({ id: "gigadrain", name: "Giga Drain", type: "Grass", kind: "homing", power: 1.1, cd: 2.4, speed: 420, desc: "Seeks a foe and drains it." }),
    m({ id: "woodhammer", name: "Wood Hammer", type: "Grass", kind: "dash", power: 1.8, cd: 4, range: 230, desc: "Charge with a heavy body." }),
    m({ id: "seedbomb", name: "Seed Bomb", type: "Grass", kind: "lob", power: 1.6, cd: 4.4, range: 320, windup: 0.45, desc: "Seeds burst on the spot." }),
    m({ id: "petaldance", name: "Petal Dance", type: "Grass", kind: "nova", power: 1.9, cd: 5, range: 160, windup: 0.3, fx: "closecombat", desc: "A storm of petals all around." }),
    m({ id: "frenzyplant", name: "Frenzy Plant", type: "Grass", kind: "lob", power: 3.0, cd: 8, range: 330, windup: 0.7, fx: "rockslide", desc: "Giant roots smash the spot." }),
    m({ id: "aromatherapy", name: "Aromatherapy", type: "Grass", kind: "heal", power: 0.32, cd: 10, desc: "A sweet scent restores HP." }),
    m({ id: "discharge", name: "Discharge", type: "Electric", kind: "nova", power: 1.7, cd: 4.8, range: 170, windup: 0.25, status: { kind: "par", chance: 0.3 }, fx: "thunder", desc: "Electricity bursts all around." }),
    m({ id: "volttackle", name: "Volt Tackle", type: "Electric", kind: "dash", power: 1.9, cd: 4.4, range: 250, status: { kind: "par", chance: 0.3 }, desc: "A crackling full-body charge." }),
    m({ id: "zapcannon", name: "Zap Cannon", type: "Electric", kind: "bolt", power: 2.8, cd: 7, range: 520, windup: 0.65, status: { kind: "par", chance: 0.5 }, pierce: true, fx: "laser", desc: "A huge bolt that paralyses." }),
    m({ id: "spark", name: "Spark", type: "Electric", kind: "dash", power: 1.1, cd: 2.2, range: 220, status: { kind: "par", chance: 0.2 }, desc: "A sparkling tackle." }),
    m({ id: "electroball", name: "Electro Ball", type: "Electric", kind: "proj", power: 1.5, cd: 2, speed: 480, desc: "A ball of lightning." }),
    m({ id: "fusionbolt", name: "Fusion Bolt", type: "Electric", kind: "dash", power: 1.7, cd: 3.6, range: 240, desc: "A bolt rush." }),
    m({ id: "plasmafists", name: "Plasma Fists", type: "Electric", kind: "dash", power: 1.5, cd: 3, range: 210, desc: "Fists wrapped in lightning." }),
    m({ id: "boltstrike", name: "Bolt Strike", type: "Electric", kind: "lob", power: 2.5, cd: 6, range: 340, windup: 0.6, status: { kind: "par", chance: 0.4 }, fx: "thunder", desc: "A great bolt falls on the spot." }),
    m({ id: "iceshard", name: "Ice Shard", type: "Ice", kind: "proj", power: 0.75, cd: 0.9, speed: 700, desc: "A very fast sliver of ice." }),
    m({ id: "iciclecrash", name: "Icicle Crash", type: "Ice", kind: "lob", power: 1.8, cd: 4.8, range: 320, windup: 0.5, status: { kind: "frz", chance: 0.15 }, fx: "rockslide", desc: "Icicles fall on the spot." }),
    m({ id: "icepunch", name: "Ice Punch", type: "Ice", kind: "dash", power: 1.4, cd: 2.8, range: 210, status: { kind: "frz", chance: 0.2 }, desc: "A freezing fist." }),
    m({ id: "glaciate", name: "Glaciate", type: "Ice", kind: "nova", power: 1.8, cd: 5, range: 170, windup: 0.3, status: { kind: "frz", chance: 0.3 }, fx: "blizzard", desc: "Freezing air all around." }),
    m({ id: "frostbreath", name: "Frost Breath", type: "Ice", kind: "spread", power: 0.6, cd: 1.7, n: 5, speed: 540, desc: "A fan of cold breath." }),
    m({ id: "freezedry", name: "Freeze-Dry", type: "Ice", kind: "beam", power: 0.46, cd: 3, n: 8, range: 280, status: { kind: "frz", chance: 0.15 }, desc: "A frosty stream." }),
    m({ id: "focusblast", name: "Focus Blast", type: "Fighting", kind: "lob", power: 2.1, cd: 5.4, range: 330, windup: 0.5, fx: "dynamicpunch", desc: "A focused blast that lands where you aim." }),
    m({ id: "drainpunch", name: "Drain Punch", type: "Fighting", kind: "dash", power: 1.3, cd: 2.6, range: 210, desc: "A punch that drains HP." }),
    m({ id: "superpower", name: "Superpower", type: "Fighting", kind: "dash", power: 1.9, cd: 4.4, range: 230, desc: "All your strength in one rush." }),
    m({ id: "sacredsword", name: "Sacred Sword", type: "Fighting", kind: "dash", power: 1.5, cd: 3, range: 220, desc: "Cut through with a holy sword." }),
    m({ id: "skyuppercut", name: "Sky Uppercut", type: "Fighting", kind: "dash", power: 1.3, cd: 2.8, range: 210, desc: "An upward punch." }),
    m({ id: "forcepalm", name: "Force Palm", type: "Fighting", kind: "nova", power: 1.3, cd: 3.4, range: 110, status: { kind: "par", chance: 0.3 }, fx: "dynamicpunch", desc: "A palm strike that shakes." }),
    m({ id: "bulkup", name: "Bulk Up", type: "Fighting", kind: "buff", power: 1.35, cd: 10, desc: "Tense up: hit harder for a while." }),
    m({ id: "machpunch", name: "Mach Punch", type: "Fighting", kind: "dash", power: 0.8, cd: 1.5, range: 190, desc: "A lightning-fast punch." }),
    m({ id: "brickbreak", name: "Brick Break", type: "Fighting", kind: "dash", power: 1.3, cd: 2.6, range: 210, desc: "A shattering chop." }),
    m({ id: "poisonjab", name: "Poison Jab", type: "Poison", kind: "dash", power: 1.3, cd: 2.6, range: 210, status: { kind: "psn", chance: 0.3 }, desc: "A toxic stab." }),
    m({ id: "gunkshot", name: "Gunk Shot", type: "Poison", kind: "lob", power: 2.2, cd: 5.5, range: 330, windup: 0.5, status: { kind: "psn", chance: 0.5 }, fx: "sludgebomb", desc: "Garbage hurled at the spot." }),
    m({ id: "venoshock", name: "Venoshock", type: "Poison", kind: "proj", power: 1.2, cd: 1.7, speed: 460, status: { kind: "psn", chance: 0.4 }, desc: "A shot of venom." }),
    m({ id: "acidspray", name: "Acid Spray", type: "Poison", kind: "spread", power: 0.6, cd: 2, n: 5, speed: 500, status: { kind: "psn", chance: 0.2 }, desc: "A fan of acid." }),
    m({ id: "sludgewave", name: "Sludge Wave", type: "Poison", kind: "nova", power: 1.8, cd: 5, range: 160, windup: 0.3, status: { kind: "psn", chance: 0.4 }, fx: "sludgebomb", desc: "A wave of sludge." }),
    m({ id: "earthpower", name: "Earth Power", type: "Ground", kind: "lob", power: 2.0, cd: 4.8, range: 330, windup: 0.5, fx: "earthquake", desc: "The ground erupts at the spot." }),
    m({ id: "bulldoze", name: "Bulldoze", type: "Ground", kind: "nova", power: 1.5, cd: 3.6, range: 150, windup: 0.25, fx: "earthquake", desc: "Stomp the ground flat." }),
    m({ id: "precipiceblades", name: "Precipice Blades", type: "Ground", kind: "nova", power: 2.5, cd: 6.5, range: 190, windup: 0.4, fx: "earthquake", desc: "Blades of rock burst up all around." }),
    m({ id: "mudshot", name: "Mud Shot", type: "Ground", kind: "spread", power: 0.65, cd: 1.8, n: 5, speed: 500, desc: "A fan of mud." }),
    m({ id: "highhorsepower", name: "High Horsepower", type: "Ground", kind: "dash", power: 1.7, cd: 3.8, range: 230, desc: "A heavy charge." }),
    m({ id: "drillrun", name: "Drill Run", type: "Ground", kind: "dash", power: 1.6, cd: 3.4, range: 230, desc: "Spin like a drill." }),
    m({ id: "shoreup", name: "Shore Up", type: "Ground", kind: "heal", power: 0.4, cd: 9, desc: "Gather sand and recover." }),
    m({ id: "hurricane", name: "Hurricane", type: "Flying", kind: "lob", power: 2.0, cd: 4.8, range: 330, windup: 0.5, desc: "A storm on the spot." }),
    m({ id: "dragonascent", name: "Dragon Ascent", type: "Flying", kind: "dash", power: 1.9, cd: 4.6, range: 270, desc: "Soar through foes." }),
    m({ id: "skyattack", name: "Sky Attack", type: "Flying", kind: "dash", power: 1.8, cd: 4.2, range: 260, desc: "A glowing dive." }),
    m({ id: "aeroblast", name: "Aeroblast", type: "Flying", kind: "bolt", power: 2.7, cd: 6.5, range: 500, windup: 0.6, pierce: true, desc: "A cutting jet of air." }),
    m({ id: "roost", name: "Roost", type: "Flying", kind: "heal", power: 0.4, cd: 9, desc: "Land and recover." }),
    m({ id: "drillpeck", name: "Drill Peck", type: "Flying", kind: "dash", power: 1.4, cd: 2.8, range: 220, desc: "A spinning peck." }),
    m({ id: "gust", name: "Gust", type: "Flying", kind: "proj", power: 0.9, cd: 1, speed: 560, desc: "A quick gust." }),
    m({ id: "wingattack", name: "Wing Attack", type: "Flying", kind: "dash", power: 1.2, cd: 2.4, range: 220, desc: "Strike with wings." }),
    m({ id: "oblivionwing", name: "Oblivion Wing", type: "Flying", kind: "homing", power: 1.2, cd: 2.4, speed: 440, desc: "Wings of light seek the foe." }),
    m({ id: "futuresight", name: "Future Sight", type: "Psychic", kind: "lob", power: 2.4, cd: 6.4, range: 340, windup: 0.8, desc: "An attack from the future lands soon." }),
    m({ id: "psyshock", name: "Psyshock", type: "Psychic", kind: "proj", power: 1.4, cd: 1.9, speed: 520, desc: "A psychic shot." }),
    m({ id: "extrasensory", name: "Extrasensory", type: "Psychic", kind: "nova", power: 1.5, cd: 4, range: 150, windup: 0.25, fx: "levitate", desc: "A mind burst all around." }),
    m({ id: "psychocut", name: "Psycho Cut", type: "Psychic", kind: "spread", power: 0.75, cd: 2.2, n: 3, speed: 560, desc: "Blades of mind power." }),
    m({ id: "photongeyser", name: "Photon Geyser", type: "Psychic", kind: "lob", power: 2.6, cd: 6.5, range: 330, windup: 0.6, desc: "A pillar of light." }),
    m({ id: "prismaticlaser", name: "Prismatic Laser", type: "Psychic", kind: "bolt", power: 3.0, cd: 7.5, range: 540, windup: 0.7, pierce: true, fx: "laser", desc: "A dazzling laser." }),
    m({ id: "esperwing", name: "Esper Wing", type: "Psychic", kind: "spread", power: 0.7, cd: 2, n: 3, speed: 540, desc: "Feathers of mind power." }),
    m({ id: "psychoboost", name: "Psycho Boost", type: "Psychic", kind: "proj", power: 2.6, cd: 5, speed: 460, pierce: true, desc: "An overwhelming psychic ball." }),
    m({ id: "bugbuzz", name: "Bug Buzz", type: "Bug", kind: "nova", power: 1.6, cd: 4.4, range: 150, windup: 0.3, desc: "A buzzing shockwave." }),
    m({ id: "uturn", name: "U-turn", type: "Bug", kind: "dash", power: 1.0, cd: 1.8, range: 240, desc: "A swift strike and away." }),
    m({ id: "megahorn", name: "Megahorn", type: "Bug", kind: "dash", power: 1.8, cd: 3.8, range: 230, desc: "A huge horn charge." }),
    m({ id: "signalbeam", name: "Signal Beam", type: "Bug", kind: "proj", power: 1.1, cd: 1.4, speed: 520, desc: "A flashing beam." }),
    m({ id: "lunge", name: "Lunge", type: "Bug", kind: "dash", power: 1.1, cd: 2, range: 220, desc: "Leap at the foe." }),
    m({ id: "silverwind", name: "Silver Wind", type: "Bug", kind: "spread", power: 0.7, cd: 2, n: 4, speed: 520, desc: "Shining scales in a fan." }),
    m({ id: "pinmissile", name: "Pin Missile", type: "Bug", kind: "spread", power: 0.55, cd: 1.6, n: 5, speed: 580, desc: "A volley of needles." }),
    m({ id: "quiverdance", name: "Quiver Dance", type: "Bug", kind: "buff", power: 1.4, cd: 10, desc: "A dance: hit harder for a while." }),
    m({ id: "powergem", name: "Power Gem", type: "Rock", kind: "proj", power: 1.4, cd: 1.9, speed: 480, desc: "A beam of glowing gems." }),
    m({ id: "rockblast", name: "Rock Blast", type: "Rock", kind: "spread", power: 0.7, cd: 2, n: 5, speed: 540, desc: "A volley of rocks." }),
    m({ id: "headsmash", name: "Head Smash", type: "Rock", kind: "dash", power: 2.0, cd: 4.6, range: 230, desc: "A reckless smash." }),
    m({ id: "ancientpower", name: "Ancient Power", type: "Rock", kind: "nova", power: 1.6, cd: 4.6, range: 160, windup: 0.3, fx: "rockslide", desc: "Primal force all around." }),
    m({ id: "diamondstorm", name: "Diamond Storm", type: "Rock", kind: "nova", power: 2.0, cd: 5.5, range: 170, windup: 0.35, fx: "rockslide", desc: "A storm of diamonds." }),
    m({ id: "rocktomb", name: "Rock Tomb", type: "Rock", kind: "lob", power: 1.4, cd: 3.6, range: 320, windup: 0.45, fx: "rockslide", desc: "Boulders trap the spot." }),
    m({ id: "accelerock", name: "Accelerock", type: "Rock", kind: "dash", power: 0.9, cd: 1.5, range: 210, desc: "A rocky blink." }),
    m({ id: "hex", name: "Hex", type: "Ghost", kind: "proj", power: 1.3, cd: 1.8, speed: 420, desc: "A curse in a ball." }),
    m({ id: "poltergeist", name: "Poltergeist", type: "Ghost", kind: "dash", power: 1.7, cd: 3.8, range: 240, desc: "Haunted objects strike." }),
    m({ id: "spectralthief", name: "Spectral Thief", type: "Ghost", kind: "dash", power: 1.4, cd: 3, range: 230, desc: "Strike from the shadow." }),
    m({ id: "shadowforce", name: "Shadow Force", type: "Ghost", kind: "dash", power: 1.9, cd: 5, range: 270, desc: "Vanish, then hit hard." }),
    m({ id: "astralbarrage", name: "Astral Barrage", type: "Ghost", kind: "spread", power: 0.8, cd: 3.2, n: 6, speed: 480, desc: "A swarm of ghosts." }),
    m({ id: "moongeistbeam", name: "Moongeist Beam", type: "Ghost", kind: "bolt", power: 2.7, cd: 6.5, range: 500, windup: 0.6, pierce: true, desc: "A beam of moonlight." }),
    m({ id: "dragonclaw", name: "Dragon Claw", type: "Dragon", kind: "dash", power: 1.5, cd: 3, range: 220, desc: "Slash with a claw." }),
    m({ id: "dragontail", name: "Dragon Tail", type: "Dragon", kind: "dash", power: 1.2, cd: 2.4, range: 220, desc: "A heavy tail sweep." }),
    m({ id: "spacialrend", name: "Spacial Rend", type: "Dragon", kind: "bolt", power: 2.8, cd: 6.5, range: 520, windup: 0.6, pierce: true, desc: "Tear space in a line." }),
    m({ id: "roaroftime", name: "Roar of Time", type: "Dragon", kind: "bolt", power: 3.0, cd: 7.5, range: 560, windup: 0.7, pierce: true, desc: "A time-warping beam." }),
    m({ id: "coreenforcer", name: "Core Enforcer", type: "Dragon", kind: "bolt", power: 2.5, cd: 6, range: 500, windup: 0.55, pierce: true, desc: "A beam that cuts through." }),
    m({ id: "clangingscales", name: "Clanging Scales", type: "Dragon", kind: "nova", power: 2.0, cd: 5, range: 150, windup: 0.3, fx: "outrage", desc: "A ringing burst." }),
    m({ id: "dragondance", name: "Dragon Dance", type: "Dragon", kind: "buff", power: 1.4, cd: 10, desc: "A dance: hit harder for a while." }),
    m({ id: "dragonbreath", name: "Dragon Breath", type: "Dragon", kind: "proj", power: 0.9, cd: 1, speed: 540, status: { kind: "par", chance: 0.15 }, desc: "A quick breath." }),
    m({ id: "eternabeam", name: "Eternabeam", type: "Dragon", kind: "bolt", power: 3.2, cd: 8, range: 580, windup: 0.8, pierce: true, desc: "A gigantic beam." }),
    m({ id: "foulplay", name: "Foul Play", type: "Dark", kind: "dash", power: 1.5, cd: 3.2, range: 220, desc: "Turn their strength against them." }),
    m({ id: "suckerpunch", name: "Sucker Punch", type: "Dark", kind: "dash", power: 1.0, cd: 1.8, range: 200, desc: "A sneaky quick punch." }),
    m({ id: "knockoff", name: "Knock Off", type: "Dark", kind: "dash", power: 1.3, cd: 2.6, range: 220, desc: "A rough hit." }),
    m({ id: "nightdaze", name: "Night Daze", type: "Dark", kind: "nova", power: 1.7, cd: 4.6, range: 150, windup: 0.3, desc: "A shockwave of darkness." }),
    m({ id: "nastyplot", name: "Nasty Plot", type: "Dark", kind: "buff", power: 1.4, cd: 10, desc: "Scheme: hit harder for a while." }),
    m({ id: "pursuit", name: "Pursuit", type: "Dark", kind: "dash", power: 1.0, cd: 1.8, range: 230, desc: "Chase them down." }),
    m({ id: "ironhead", name: "Iron Head", type: "Steel", kind: "dash", power: 1.5, cd: 3, range: 220, desc: "A hard headbutt." }),
    m({ id: "irontail", name: "Iron Tail", type: "Steel", kind: "dash", power: 1.4, cd: 3, range: 210, desc: "A steel tail slam." }),
    m({ id: "gyroball", name: "Gyro Ball", type: "Steel", kind: "dash", power: 1.4, cd: 3, range: 220, desc: "Spin and crash into them." }),
    m({ id: "doomdesire", name: "Doom Desire", type: "Steel", kind: "lob", power: 2.4, cd: 6.4, range: 340, windup: 0.8, desc: "Destruction falls soon after." }),
    m({ id: "steelbeam", name: "Steel Beam", type: "Steel", kind: "bolt", power: 2.5, cd: 6, range: 500, windup: 0.6, pierce: true, fx: "laser", desc: "A beam of steel." }),
    m({ id: "irondefense", name: "Iron Defense", type: "Steel", kind: "guard", power: 0, cd: 6, desc: "Harden and block almost everything." }),
    m({ id: "steelwing", name: "Steel Wing", type: "Steel", kind: "dash", power: 1.2, cd: 2.4, range: 220, desc: "Strike with hard wings." }),
    m({ id: "behemothblade", name: "Behemoth Blade", type: "Steel", kind: "dash", power: 2.0, cd: 4.6, range: 250, desc: "A giant sword slash." }),
    m({ id: "dazzlinggleam", name: "Dazzling Gleam", type: "Fairy", kind: "nova", power: 1.6, cd: 4.4, range: 160, windup: 0.3, desc: "A flash of light." }),
    m({ id: "playrough", name: "Play Rough", type: "Fairy", kind: "dash", power: 1.5, cd: 3, range: 220, desc: "A rough, cute tackle." }),
    m({ id: "drainingkiss", name: "Draining Kiss", type: "Fairy", kind: "homing", power: 1.0, cd: 2, speed: 420, desc: "A kiss that seeks the foe." }),
    m({ id: "fleurcannon", name: "Fleur Cannon", type: "Fairy", kind: "bolt", power: 2.8, cd: 7, range: 520, windup: 0.65, pierce: true, desc: "A beam of fairy light." }),
    m({ id: "lightofruin", name: "Light of Ruin", type: "Fairy", kind: "lob", power: 2.5, cd: 6.5, range: 340, windup: 0.7, desc: "A giant light." }),
    m({ id: "mistyexplosion", name: "Misty Explosion", type: "Fairy", kind: "nova", power: 2.3, cd: 6.5, range: 180, windup: 0.45, desc: "A big misty blast." }),
    m({ id: "geomancy", name: "Geomancy", type: "Fairy", kind: "buff", power: 1.5, cd: 11, desc: "Gather power: hit harder for a while." }),
    m({ id: "fairywind", name: "Fairy Wind", type: "Fairy", kind: "proj", power: 0.9, cd: 1, speed: 540, desc: "A light breeze." }),
    m({ id: "moonlight", name: "Moonlight", type: "Fairy", kind: "heal", power: 0.4, cd: 9, desc: "Moonlight restores HP." }),
    m({ id: "hypervoice", name: "Hyper Voice", type: "Normal", kind: "nova", power: 1.5, cd: 3.8, range: 150, windup: 0.25, desc: "A loud shout all around." }),
    m({ id: "doubleedge", name: "Double-Edge", type: "Normal", kind: "dash", power: 1.8, cd: 4, range: 240, desc: "A reckless charge." }),
    m({ id: "gigaimpact", name: "Giga Impact", type: "Normal", kind: "dash", power: 2.2, cd: 6, range: 260, desc: "All out collision." }),
    m({ id: "judgment", name: "Judgment", type: "Normal", kind: "bolt", power: 3.0, cd: 7.5, range: 540, windup: 0.7, pierce: true, desc: "A divine beam." }),
    m({ id: "boomburst", name: "Boomburst", type: "Normal", kind: "nova", power: 2.2, cd: 6, range: 180, windup: 0.4, fx: "outrage", desc: "A deafening burst." }),
    m({ id: "triattack", name: "Tri Attack", type: "Normal", kind: "spread", power: 0.8, cd: 2.2, n: 3, speed: 520, status: { kind: "par", chance: 0.15 }, desc: "Three beams." }),
    m({ id: "swift", name: "Swift", type: "Normal", kind: "homing", power: 0.9, cd: 1.4, speed: 560, desc: "Stars that always hit." }),
    m({ id: "slash", name: "Slash", type: "Normal", kind: "dash", power: 1.1, cd: 2, range: 210, desc: "A sharp slash." }),
    m({ id: "slackoff", name: "Slack Off", type: "Normal", kind: "heal", power: 0.4, cd: 9, desc: "Rest and recover." }),
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
  { id: "mewtwo", num: 150, name: "Mewtwo", types: ["Psychic"], bs: [106, 110, 90, 154, 90, 130], moves: ["psystrike", "shadowball", "psychicgrip", "recover"], role: "shooter", size: 30, blurb: "The first boss. Reach wave 5 to play as it.", unlock: 5 },
  { id: "rayquaza", num: 384, name: "Rayquaza", types: ["Dragon", "Flying"], bs: [105, 150, 90, 150, 90, 95], moves: ["dragonpulse", "dracometeor", "aerialace", "outrage"], role: "brawler", size: 34, blurb: "The sky boss. Reach wave 10 to play as it.", unlock: 10 },
  { id: "onix", num: 95, name: "Onix", types: ["Rock", "Ground"], bs: [65, 75, 160, 35, 50, 70], moves: ["rockslide", "irontail", "earthquake", "protect"], role: "brawler", size: 38, blurb: "A giant rock snake. Slow to hurt, heavy to meet." },
  { id: "steelix", num: 208, name: "Steelix", types: ["Steel", "Ground"], bs: [75, 85, 200, 55, 65, 30], moves: ["ironhead", "earthquake", "stoneedge", "irondefense"], role: "brawler", size: 40, blurb: "An iron serpent with a huge guard." },
  { id: "sandaconda", num: 844, name: "Sandaconda", types: ["Ground"], bs: [72, 107, 125, 65, 70, 71], moves: ["earthpower", "highhorsepower", "stoneedge", "protect"], role: "brawler", size: 34, blurb: "A sand snake that coils and crushes." },
  { id: "lugia", num: 249, name: "Lugia", types: ["Psychic", "Flying"], bs: [106, 90, 130, 90, 154, 110], moves: ["aeroblast", "psychic", "hydropump", "roost"], role: "bomber", size: 36, blurb: "Legendary guardian of the seas. A cutting blast of air." },
  { id: "hooh", num: 250, name: "Ho-Oh", types: ["Fire", "Flying"], bs: [106, 130, 90, 110, 154, 90], moves: ["sacredfire", "bravebird", "earthquake", "recover"], role: "brawler", size: 36, blurb: "Legendary rainbow bird with holy flame." },
  { id: "kyogre", num: 382, name: "Kyogre", types: ["Water"], bs: [100, 100, 90, 150, 140, 90], moves: ["originpulse", "waterspout", "icebeam", "calmmind"], role: "bomber", size: 38, blurb: "Legendary sea. Primal Reversion makes it vast." },
  { id: "groudon", num: 383, name: "Groudon", types: ["Ground"], bs: [100, 150, 140, 100, 90, 90], moves: ["precipiceblades", "eruption", "stoneedge", "swordsdance"], role: "brawler", size: 38, blurb: "Legendary continent. Primal Reversion sets it ablaze." },
  { id: "dialga", num: 483, name: "Dialga", types: ["Steel", "Dragon"], bs: [100, 120, 120, 150, 100, 90], moves: ["roaroftime", "flashcannon", "dracometeor", "irondefense"], role: "bomber", size: 36, blurb: "Legendary master of time." },
  { id: "palkia", num: 484, name: "Palkia", types: ["Water", "Dragon"], bs: [90, 120, 100, 150, 120, 100], moves: ["spacialrend", "hydropump", "dragonpulse", "surf"], role: "bomber", size: 36, blurb: "Legendary master of space." },
  { id: "giratina", num: 487, name: "Giratina", types: ["Ghost", "Dragon"], bs: [150, 100, 120, 100, 120, 90], moves: ["shadowforce", "dragonclaw", "shadowball", "dragonpulse"], role: "brawler", size: 36, blurb: "Legendary ruler of the Distortion World." },
  { id: "arceus", num: 493, name: "Arceus", types: ["Normal"], bs: [120, 120, 120, 120, 120, 120], moves: ["judgment", "hyperbeam", "extremespeed", "recover"], role: "bomber", size: 34, blurb: "The original one. Judgment for all.", unlock: 15 },
  { id: "mew", num: 151, name: "Mew", types: ["Psychic"], bs: [100, 100, 100, 100, 100, 100], moves: ["psychic", "aurasphere", "shadowball", "calmmind"], role: "shooter", size: 20, blurb: "Small, mythical and able to do anything." },
  { id: "raikou", num: 243, name: "Raikou", types: ["Electric"], bs: [90, 85, 75, 115, 100, 115], moves: ["thunderbolt", "thunder", "extremespeed", "crunch"], role: "shooter", size: 28, blurb: "Legendary thunder beast." },
  { id: "entei", num: 244, name: "Entei", types: ["Fire"], bs: [115, 115, 85, 90, 75, 100], moves: ["sacredfire", "flareblitz", "extremespeed", "earthquake"], role: "brawler", size: 30, blurb: "Legendary volcano beast." },
  { id: "suicune", num: 245, name: "Suicune", types: ["Water"], bs: [100, 75, 115, 90, 115, 85], moves: ["hydropump", "icebeam", "surf", "calmmind"], role: "shooter", size: 30, blurb: "Legendary north wind." },
  { id: "latias", num: 380, name: "Latias", types: ["Dragon", "Psychic"], bs: [80, 80, 90, 110, 130, 110], moves: ["dragonpulse", "psyshock", "dracometeor", "recover"], role: "shooter", size: 26, blurb: "Swift and kind. Becomes a Mega." },
  { id: "latios", num: 381, name: "Latios", types: ["Dragon", "Psychic"], bs: [80, 90, 80, 130, 110, 110], moves: ["dragonpulse", "psyshock", "dracometeor", "calmmind"], role: "shooter", size: 26, blurb: "Fast and sharp. Becomes a Mega." },
  { id: "deoxys", num: 386, name: "Deoxys", types: ["Psychic"], bs: [50, 150, 50, 150, 50, 150], moves: ["psystrike", "zenheadbutt", "shadowball", "extremespeed"], role: "shooter", size: 24, blurb: "Glass cannon from space." },
  { id: "reshiram", num: 643, name: "Reshiram", types: ["Dragon", "Fire"], bs: [100, 120, 100, 150, 120, 90], moves: ["fusionflare", "dragonpulse", "outrage", "flamethrower"], role: "bomber", size: 36, blurb: "Legendary white dragon of truth." },
  { id: "zekrom", num: 644, name: "Zekrom", types: ["Dragon", "Electric"], bs: [100, 150, 120, 120, 100, 90], moves: ["boltstrike", "dragonclaw", "outrage", "wildcharge"], role: "brawler", size: 36, blurb: "Legendary black dragon of ideals." },
  { id: "kyurem", num: 646, name: "Kyurem", types: ["Dragon", "Ice"], bs: [125, 130, 90, 130, 90, 95], moves: ["icebeam", "dragonpulse", "glaciate", "outrage"], role: "bomber", size: 36, blurb: "Legendary frozen dragon." },
  { id: "xerneas", num: 716, name: "Xerneas", types: ["Fairy"], bs: [126, 131, 95, 131, 98, 99], moves: ["moonblast", "dazzlinggleam", "geomancy", "closecombat"], role: "bomber", size: 34, blurb: "Legendary life-giver." },
  { id: "yveltal", num: 717, name: "Yveltal", types: ["Dark", "Flying"], bs: [126, 131, 95, 131, 98, 99], moves: ["darkpulse", "hurricane", "oblivionwing", "nightdaze"], role: "bomber", size: 36, blurb: "Legendary destroyer." },
  { id: "solgaleo", num: 791, name: "Solgaleo", types: ["Psychic", "Steel"], bs: [137, 137, 107, 113, 89, 97], moves: ["meteormash", "zenheadbutt", "flareblitz", "ironhead"], role: "brawler", size: 34, blurb: "Legendary beast of the sun." },
  { id: "lunala", num: 792, name: "Lunala", types: ["Psychic", "Ghost"], bs: [137, 113, 89, 137, 107, 97], moves: ["moongeistbeam", "psyshock", "moonblast", "shadowball"], role: "bomber", size: 36, blurb: "Legendary beast of the moon." },
  { id: "necrozma", num: 800, name: "Necrozma", types: ["Psychic"], bs: [97, 107, 101, 127, 89, 79], moves: ["prismaticlaser", "photongeyser", "flashcannon", "calmmind"], role: "bomber", size: 30, blurb: "A prism that devours light.", unlock: 12 },
  { id: "zacian", num: 888, name: "Zacian", types: ["Fairy"], bs: [92, 120, 115, 80, 115, 138], moves: ["playrough", "ironhead", "closecombat", "swordsdance"], role: "brawler", size: 30, blurb: "Legendary hero with a blade." },
  { id: "zamazenta", num: 889, name: "Zamazenta", types: ["Fighting"], bs: [92, 120, 115, 80, 115, 138], moves: ["closecombat", "ironhead", "crunch", "irondefense"], role: "brawler", size: 30, blurb: "Legendary hero with a shield." },
  { id: "eternatus", num: 890, name: "Eternatus", types: ["Poison", "Dragon"], bs: [140, 85, 95, 145, 95, 130], moves: ["eternabeam", "sludgebomb", "dracometeor", "flamethrower"], role: "bomber", size: 40, blurb: "The enormous source of the Darkest Day.", unlock: 15 },
  { id: "zygarde", num: 718, name: "Zygarde", types: ["Dragon", "Ground"], bs: [108, 100, 121, 81, 95, 95], moves: ["precipiceblades", "dragonpulse", "outrage", "protect"], role: "brawler", size: 34, blurb: "Legendary order keeper." },
  { id: "diancie", num: 719, name: "Diancie", types: ["Rock", "Fairy"], bs: [50, 100, 150, 100, 150, 50], moves: ["diamondstorm", "moonblast", "powergem", "protect"], role: "bomber", size: 22, blurb: "A jewel that becomes a Mega." },
  { id: "marshadow", num: 802, name: "Marshadow", types: ["Fighting", "Ghost"], bs: [90, 125, 80, 90, 90, 125], moves: ["shadowclaw", "closecombat", "spectralthief", "aurasphere"], role: "brawler", size: 22, blurb: "A shadow with its own Z-Move." },
  { id: "tapukoko", num: 785, name: "Tapu Koko", types: ["Electric", "Fairy"], bs: [70, 115, 85, 95, 75, 130], moves: ["wildcharge", "dazzlinggleam", "thunderbolt", "playrough"], role: "shooter", size: 24, blurb: "Island guardian. Swift and sparky." },
  { id: "ampharos", num: 181, name: "Ampharos", types: ["Electric"], bs: [90, 75, 85, 115, 90, 55], moves: ["thunderbolt", "dragonpulse", "powergem", "protect"], role: "shooter", size: 28, blurb: "A shining light that becomes a Mega." },
  { id: "heracross", num: 214, name: "Heracross", types: ["Bug", "Fighting"], bs: [80, 125, 75, 40, 95, 85], moves: ["megahorn", "closecombat", "stoneedge", "swordsdance"], role: "brawler", size: 26, blurb: "A horn charge. Becomes a Mega." },
  { id: "houndoom", num: 229, name: "Houndoom", types: ["Dark", "Fire"], bs: [75, 90, 50, 110, 80, 95], moves: ["flamethrower", "darkpulse", "crunch", "sludgebomb"], role: "shooter", size: 26, blurb: "Fire and dark. Becomes a Mega." },
  { id: "aggron", num: 306, name: "Aggron", types: ["Steel", "Rock"], bs: [70, 110, 180, 60, 60, 50], moves: ["ironhead", "earthquake", "rockslide", "protect"], role: "brawler", size: 30, blurb: "Iron armour. Becomes a Mega." },
  { id: "manectric", num: 310, name: "Manectric", types: ["Electric"], bs: [70, 75, 60, 105, 60, 105], moves: ["thunderbolt", "flamethrower", "wildcharge", "quickattack"], role: "shooter", size: 24, blurb: "Sparking speed. Becomes a Mega." },
  { id: "sharpedo", num: 319, name: "Sharpedo", types: ["Water", "Dark"], bs: [70, 120, 40, 95, 40, 95], moves: ["crunch", "waterfall", "darkpulse", "aquajet"], role: "brawler", size: 26, blurb: "A fast bite. Becomes a Mega." },
  { id: "camerupt", num: 323, name: "Camerupt", types: ["Fire", "Ground"], bs: [70, 100, 70, 105, 75, 40], moves: ["eruption", "earthpower", "flamethrower", "protect"], role: "bomber", size: 28, blurb: "A walking volcano. Becomes a Mega." },
  { id: "altaria", num: 334, name: "Altaria", types: ["Dragon", "Flying"], bs: [75, 70, 90, 70, 105, 80], moves: ["dragonpulse", "hurricane", "moonblast", "roost"], role: "shooter", size: 26, blurb: "A cloud-like dragon. Becomes a Mega." },
  { id: "banette", num: 354, name: "Banette", types: ["Ghost"], bs: [64, 115, 65, 83, 63, 65], moves: ["shadowclaw", "phantomforce", "shadowball", "swordsdance"], role: "brawler", size: 22, blurb: "A grudge doll. Becomes a Mega." },
  { id: "glalie", num: 362, name: "Glalie", types: ["Ice"], bs: [80, 80, 80, 80, 80, 80], moves: ["icebeam", "crunch", "blizzard", "earthquake"], role: "shooter", size: 24, blurb: "A floating ice face. Becomes a Mega." },
  { id: "lopunny", num: 428, name: "Lopunny", types: ["Normal"], bs: [65, 76, 84, 54, 96, 105], moves: ["extremespeed", "closecombat", "bodyslam", "quickattack"], role: "brawler", size: 22, blurb: "Quick kicks. Becomes a Mega." },
  { id: "gallade", num: 475, name: "Gallade", types: ["Psychic", "Fighting"], bs: [68, 125, 65, 65, 115, 80], moves: ["psychocut", "closecombat", "leafblade", "swordsdance"], role: "brawler", size: 26, blurb: "A blade knight. Becomes a Mega." },
  { id: "abomasnow", num: 460, name: "Abomasnow", types: ["Grass", "Ice"], bs: [90, 92, 75, 92, 85, 60], moves: ["blizzard", "woodhammer", "energyball", "icepunch"], role: "bomber", size: 30, blurb: "A snowy giant. Becomes a Mega." },
  { id: "pinsir", num: 127, name: "Pinsir", types: ["Bug"], bs: [65, 125, 100, 55, 70, 85], moves: ["xscissor", "closecombat", "earthquake", "swordsdance"], role: "brawler", size: 24, blurb: "A crushing grip. Becomes a Mega." },
  { id: "aerodactyl", num: 142, name: "Aerodactyl", types: ["Rock", "Flying"], bs: [80, 105, 65, 60, 75, 130], moves: ["stoneedge", "aerialace", "crunch", "dragonclaw"], role: "brawler", size: 28, blurb: "Ancient flyer. Becomes a Mega." },
  { id: "kangaskhan", num: 115, name: "Kangaskhan", types: ["Normal"], bs: [105, 95, 80, 40, 80, 90], moves: ["bodyslam", "crunch", "earthquake", "extremespeed"], role: "brawler", size: 30, blurb: "A parent that fights hard. Becomes a Mega." },
  { id: "slowbro", num: 80, name: "Slowbro", types: ["Water", "Psychic"], bs: [95, 75, 110, 100, 80, 30], moves: ["surf", "psychic", "icebeam", "rest"], role: "bomber", size: 28, blurb: "Slow, but calm and heavy." },
  { id: "beedrill", num: 15, name: "Beedrill", types: ["Bug", "Poison"], bs: [65, 90, 40, 45, 80, 75], moves: ["xscissor", "poisonjab", "aerialace", "swordsdance"], role: "brawler", size: 22, blurb: "A swarm stinger. Becomes a Mega." },
  { id: "pidgeot", num: 18, name: "Pidgeot", types: ["Normal", "Flying"], bs: [83, 80, 75, 70, 70, 101], moves: ["airslash", "bravebird", "extremespeed", "roost"], role: "shooter", size: 26, blurb: "A fast bird. Becomes a Mega." },
  { id: "sableye", num: 302, name: "Sableye", types: ["Dark", "Ghost"], bs: [50, 75, 75, 65, 65, 50], moves: ["shadowclaw", "foulplay", "darkpulse", "recover"], role: "brawler", size: 20, blurb: "Sneaky gem eater. Becomes a Mega." },
  { id: "medicham", num: 308, name: "Medicham", types: ["Fighting", "Psychic"], bs: [60, 60, 75, 60, 75, 80], moves: ["closecombat", "zenheadbutt", "psychic", "bulkup"], role: "brawler", size: 24, blurb: "Focused monk. Becomes a Mega." },
  { id: "swampert", num: 260, name: "Swampert", types: ["Water", "Ground"], bs: [100, 110, 90, 85, 90, 60], moves: ["waterfall", "earthquake", "icebeam", "surf"], role: "brawler", size: 28, blurb: "A sturdy swimmer. Becomes a Mega." },
  { id: "eevee", num: 133, name: "Eevee", types: ["Normal"], bs: [55, 55, 50, 45, 65, 55], moves: ["quickattack", "swift", "bodyslam", "shadowball"], role: "shooter", size: 18, blurb: "Small but can Gigantamax and use a Z-Move." },
  { id: "incineroar", num: 727, name: "Incineroar", types: ["Fire", "Dark"], bs: [95, 115, 90, 80, 90, 60], moves: ["flareblitz", "knockoff", "crosschop", "swordsdance"], role: "brawler", size: 30, blurb: "A wrestling cat with its own Z-Move." },
  { id: "decidueye", num: 724, name: "Decidueye", types: ["Grass", "Ghost"], bs: [78, 107, 75, 100, 100, 70], moves: ["leafblade", "shadowsneak", "leafstorm", "phantomforce"], role: "shooter", size: 26, blurb: "An archer owl with its own Z-Move." },
  { id: "primarina", num: 730, name: "Primarina", types: ["Water", "Fairy"], bs: [80, 74, 74, 126, 116, 60], moves: ["hydropump", "moonblast", "icebeam", "calmmind"], role: "bomber", size: 26, blurb: "A singing sea lion with its own Z-Move." },
  { id: "lycanroc", num: 745, name: "Lycanroc", types: ["Rock"], bs: [75, 115, 65, 55, 65, 112], moves: ["stoneedge", "crunch", "closecombat", "accelerock"], role: "brawler", size: 26, blurb: "A rock wolf with its own Z-Move." },
  { id: "toxtricity", num: 849, name: "Toxtricity", types: ["Electric", "Poison"], bs: [75, 98, 70, 114, 70, 75], moves: ["thunderbolt", "sludgebomb", "discharge", "protect"], role: "shooter", size: 28, blurb: "A punk. Can Gigantamax." },
  { id: "cinderace", num: 815, name: "Cinderace", types: ["Fire"], bs: [80, 116, 75, 65, 75, 119], moves: ["flareblitz", "blazekick", "aerialace", "swordsdance"], role: "brawler", size: 24, blurb: "A striker. Can Gigantamax." },
  { id: "rillaboom", num: 812, name: "Rillaboom", types: ["Grass"], bs: [100, 125, 90, 60, 70, 85], moves: ["woodhammer", "leafblade", "earthquake", "swordsdance"], role: "brawler", size: 30, blurb: "A drummer. Can Gigantamax." },
  { id: "inteleon", num: 818, name: "Inteleon", types: ["Water"], bs: [70, 85, 65, 125, 65, 120], moves: ["hydrocannon", "icebeam", "aerialace", "darkpulse"], role: "shooter", size: 26, blurb: "A spy. Can Gigantamax." },
  { id: "urshifu", num: 892, name: "Urshifu", types: ["Fighting", "Dark"], bs: [100, 130, 100, 63, 60, 97], moves: ["suckerpunch", "closecombat", "waterfall", "swordsdance"], role: "brawler", size: 28, blurb: "A master of strikes. Can Gigantamax." },
  { id: "hatterene", num: 858, name: "Hatterene", types: ["Psychic", "Fairy"], bs: [57, 90, 95, 136, 103, 29], moves: ["psychic", "dazzlinggleam", "darkpulse", "calmmind"], role: "bomber", size: 26, blurb: "A silent witch. Can Gigantamax." },
  { id: "grimmsnarl", num: 861, name: "Grimmsnarl", types: ["Dark", "Fairy"], bs: [95, 120, 65, 95, 75, 60], moves: ["playrough", "foulplay", "suckerpunch", "swordsdance"], role: "brawler", size: 28, blurb: "A scary scarf. Can Gigantamax." },
  { id: "kingler", num: 99, name: "Kingler", types: ["Water"], bs: [55, 130, 115, 50, 50, 75], moves: ["waterfall", "xscissor", "stoneedge", "swordsdance"], role: "brawler", size: 26, blurb: "A huge claw. Can Gigantamax." },
  { id: "butterfree", num: 12, name: "Butterfree", types: ["Bug", "Flying"], bs: [60, 45, 50, 90, 80, 70], moves: ["bugbuzz", "psychic", "airslash", "quiverdance"], role: "shooter", size: 22, blurb: "A butterfly. Can Gigantamax." },
  { id: "melmetal", num: 809, name: "Melmetal", types: ["Steel"], bs: [135, 143, 143, 80, 65, 34], moves: ["ironhead", "earthquake", "thunderbolt", "protect"], role: "brawler", size: 28, blurb: "A heavy bolt. Can Gigantamax." },
  { id: "duraludon", num: 884, name: "Duraludon", types: ["Steel", "Dragon"], bs: [70, 95, 115, 120, 50, 85], moves: ["flashcannon", "dragonpulse", "dracometeor", "ironhead"], role: "shooter", size: 28, blurb: "A tall tower. Can Gigantamax." },
  { id: "coalossal", num: 839, name: "Coalossal", types: ["Rock", "Fire"], bs: [110, 80, 120, 80, 90, 30], moves: ["rockslide", "flamethrower", "overheat", "protect"], role: "bomber", size: 28, blurb: "A burning mound. Can Gigantamax." },
  { id: "centiskorch", num: 851, name: "Centiskorch", types: ["Fire", "Bug"], bs: [100, 115, 65, 90, 90, 65], moves: ["flamewheel", "xscissor", "firepunch", "megahorn"], role: "brawler", size: 30, blurb: "A fiery centipede. Can Gigantamax." },
  { id: "drednaw", num: 834, name: "Drednaw", types: ["Water", "Rock"], bs: [90, 115, 90, 48, 68, 74], moves: ["waterfall", "stoneedge", "crunch", "earthquake"], role: "brawler", size: 28, blurb: "A snapping turtle. Can Gigantamax." },
  { id: "orbeetle", num: 826, name: "Orbeetle", types: ["Bug", "Psychic"], bs: [60, 45, 110, 80, 120, 90], moves: ["bugbuzz", "psychic", "signalbeam", "calmmind"], role: "shooter", size: 24, blurb: "A psychic ladybug. Can Gigantamax." },
  { id: "copperajah", num: 879, name: "Copperajah", types: ["Steel"], bs: [122, 130, 69, 80, 69, 30], moves: ["ironhead", "earthquake", "playrough", "protect"], role: "brawler", size: 32, blurb: "A copper elephant. Can Gigantamax." },
  { id: "garbodor", num: 569, name: "Garbodor", types: ["Poison"], bs: [80, 95, 82, 60, 82, 75], moves: ["gunkshot", "sludgebomb", "crunch", "protect"], role: "bomber", size: 26, blurb: "A trash heap. Can Gigantamax." },
  { id: "alcremie", num: 869, name: "Alcremie", types: ["Fairy"], bs: [65, 60, 75, 110, 121, 64], moves: ["dazzlinggleam", "moonblast", "psychic", "recover"], role: "shooter", size: 22, blurb: "A sweet cream. Can Gigantamax." },
  { id: "appletun", num: 842, name: "Appletun", types: ["Grass", "Dragon"], bs: [110, 85, 80, 100, 80, 30], moves: ["energyball", "dragonpulse", "bodyslam", "recover"], role: "bomber", size: 26, blurb: "A sweet apple. Can Gigantamax." },
  { id: "flapple", num: 841, name: "Flapple", types: ["Grass", "Dragon"], bs: [70, 110, 80, 95, 60, 70], moves: ["woodhammer", "dragonrush", "aerialace", "swordsdance"], role: "brawler", size: 24, blurb: "A tart apple. Can Gigantamax." },
  { id: "volcarona", num: 637, name: "Volcarona", types: ["Bug", "Fire"], bs: [85, 60, 65, 135, 105, 100], moves: ["bugbuzz", "flamethrower", "quiverdance", "psychic"], role: "shooter", size: 26, blurb: "A sun moth." },
  { id: "haxorus", num: 612, name: "Haxorus", types: ["Dragon"], bs: [76, 147, 90, 60, 70, 97], moves: ["dragonclaw", "earthquake", "outrage", "swordsdance"], role: "brawler", size: 28, blurb: "Axe-edged tusks." },
  { id: "gholdengo", num: 1000, name: "Gholdengo", types: ["Steel", "Ghost"], bs: [87, 60, 95, 133, 91, 84], moves: ["shadowball", "flashcannon", "thunderbolt", "nastyplot"], role: "bomber", size: 24, blurb: "A golden ghost." },
  { id: "infernape", num: 392, name: "Infernape", types: ["Fire", "Fighting"], bs: [76, 104, 71, 104, 71, 108], moves: ["flareblitz", "closecombat", "aerialace", "swordsdance"], role: "brawler", size: 26, blurb: "A flaming fighter." },
  { id: "weavile", num: 461, name: "Weavile", types: ["Dark", "Ice"], bs: [70, 120, 65, 45, 85, 125], moves: ["icepunch", "nightslash", "iceshard", "swordsdance"], role: "brawler", size: 24, blurb: "Claws of ice." },
  { id: "empoleon", num: 395, name: "Empoleon", types: ["Water", "Steel"], bs: [84, 86, 88, 111, 101, 60], moves: ["hydropump", "flashcannon", "icebeam", "protect"], role: "shooter", size: 28, blurb: "An emperor penguin." },
  { id: "torterra", num: 389, name: "Torterra", types: ["Grass", "Ground"], bs: [95, 109, 105, 75, 85, 56], moves: ["woodhammer", "earthquake", "rockslide", "synthesis"], role: "brawler", size: 30, blurb: "A continent on its back." },
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
  steelix: [mf("steelix-mega", "Mega Steelix", { p: 1.25, d: 1.3, s: 1.0 })],
  sceptile: [mf("sceptile-mega", "Mega Sceptile", { types: ["Grass", "Dragon"], p: 1.28, d: 1.12, s: 1.1 })],
  kyogre: [mf("kyogre-primal", "Primal Kyogre", { p: 1.32, d: 1.2, s: 1.0 })],
  groudon: [mf("groudon-primal", "Primal Groudon", { types: ["Ground", "Fire"], p: 1.32, d: 1.2, s: 1.0 })],
  latias: [mf("latias-mega", "Mega Latias", { p: 1.28, d: 1.2, s: 1.08 })],
  latios: [mf("latios-mega", "Mega Latios", { p: 1.3, d: 1.15, s: 1.1 })],
  diancie: [mf("diancie-mega", "Mega Diancie", { p: 1.32, d: 1.1, s: 1.2 })],
  ampharos: [mf("ampharos-mega", "Mega Ampharos", { types: ["Electric", "Dragon"], p: 1.28, d: 1.2, s: 1.0 })],
  heracross: [mf("heracross-mega", "Mega Heracross", { p: 1.32, d: 1.15, s: 1.0 })],
  houndoom: [mf("houndoom-mega", "Mega Houndoom", { p: 1.28, d: 1.1, s: 1.1 })],
  aggron: [mf("aggron-mega", "Mega Aggron", { types: ["Steel"], p: 1.22, d: 1.4, s: 1.0 })],
  manectric: [mf("manectric-mega", "Mega Manectric", { p: 1.28, d: 1.1, s: 1.12 })],
  sharpedo: [mf("sharpedo-mega", "Mega Sharpedo", { p: 1.3, d: 1.1, s: 1.05 })],
  camerupt: [mf("camerupt-mega", "Mega Camerupt", { p: 1.28, d: 1.25, s: 1.0 })],
  altaria: [mf("altaria-mega", "Mega Altaria", { types: ["Dragon", "Fairy"], p: 1.25, d: 1.2, s: 1.05 })],
  banette: [mf("banette-mega", "Mega Banette", { p: 1.32, d: 1.1, s: 1.05 })],
  glalie: [mf("glalie-mega", "Mega Glalie", { p: 1.3, d: 1.15, s: 1.05 })],
  lopunny: [mf("lopunny-mega", "Mega Lopunny", { types: ["Normal", "Fighting"], p: 1.28, d: 1.1, s: 1.15 })],
  gallade: [mf("gallade-mega", "Mega Gallade", { p: 1.32, d: 1.1, s: 1.05 })],
  abomasnow: [mf("abomasnow-mega", "Mega Abomasnow", { p: 1.25, d: 1.25, s: 1.0 })],
  pinsir: [mf("pinsir-mega", "Mega Pinsir", { types: ["Bug", "Flying"], p: 1.3, d: 1.1, s: 1.12 })],
  aerodactyl: [mf("aerodactyl-mega", "Mega Aerodactyl", { p: 1.28, d: 1.15, s: 1.1 })],
  kangaskhan: [mf("kangaskhan-mega", "Mega Kangaskhan", { p: 1.28, d: 1.2, s: 1.1 })],
  slowbro: [mf("slowbro-mega", "Mega Slowbro", { p: 1.2, d: 1.4, s: 1.0 })],
  beedrill: [mf("beedrill-mega", "Mega Beedrill", { p: 1.35, d: 1.0, s: 1.2 })],
  pidgeot: [mf("pidgeot-mega", "Mega Pidgeot", { p: 1.25, d: 1.1, s: 1.15 })],
  sableye: [mf("sableye-mega", "Mega Sableye", { p: 1.25, d: 1.4, s: 1.0 })],
  medicham: [mf("medicham-mega", "Mega Medicham", { p: 1.28, d: 1.1, s: 1.1 })],
  swampert: [mf("swampert-mega", "Mega Swampert", { p: 1.3, d: 1.2, s: 1.0 })],
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
export const GMAX = new Set(["charizard", "venusaur", "blastoise", "pikachu", "gengar", "lapras", "snorlax", "machamp", "corviknight", "eevee", "kingler", "butterfree", "melmetal", "duraludon", "coalossal", "centiskorch", "drednaw", "orbeetle", "copperajah", "garbodor", "toxtricity", "cinderace", "rillaboom", "inteleon", "urshifu", "hatterene", "grimmsnarl", "alcremie", "appletun", "flapple", "sandaconda"]);

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
  eevee: { name: "Extreme Evoboost", bn: "Extreme Evoboost", type: "Normal" },
  incineroar: { name: "Malicious Moonsault", bn: "Malicious Moonsault", type: "Dark" },
  decidueye: { name: "Sinister Arrow Raid", bn: "Sinister Arrow Raid", type: "Ghost" },
  primarina: { name: "Oceanic Operetta", bn: "Oceanic Operetta", type: "Water" },
  marshadow: { name: "Soul-Stealing 7-Star Strike", bn: "Soul-Stealing 7-Star Strike", type: "Ghost" },
  mew: { name: "Genesis Supernova", bn: "Genesis Supernova", type: "Psychic" },
  lycanroc: { name: "Splintered Stormshards", bn: "Splintered Stormshards", type: "Rock" },
  solgaleo: { name: "Searing Sunraze Smash", bn: "Searing Sunraze Smash", type: "Steel" },
  lunala: { name: "Menacing Moonraze Maelstrom", bn: "Menacing Moonraze Maelstrom", type: "Ghost" },
  necrozma: { name: "Light That Burns the Sky", bn: "Light That Burns the Sky", type: "Psychic" },
  tapukoko: { name: "Gigavolt Havoc", bn: "Gigavolt Havoc", type: "Electric" },
  mimikyu: { name: "Let's Snuggle Forever", bn: "লেটস স্ন্যাগল ফরএভার", type: "Fairy" },
  kommoo: { name: "Clangorous Soulblaze", bn: "ক্ল্যাঙ্গরাস সোলব্লেজ", type: "Dragon" },
};

/**
 * Every move this Pokémon can choose from: the ones it can really learn (see arena-learnsets), its own types' moves
 * first. Anything not in the table (a new Pokémon) gets its types' moves, the Normal moves and a little coverage.
 */
/** Signature moves: only the Pokémon that have them in their default four can use them. */
const SIGNATURE = new Set(["roaroftime", "spacialrend", "aeroblast", "sacredfire", "blastburn", "eternabeam", "judgment", "prismaticlaser", "moongeistbeam", "coreenforcer", "behemothblade", "fleurcannon", "lightofruin", "precipiceblades", "originpulse", "waterspout", "eruption", "psychoboost", "photongeyser", "doomdesire", "zapcannon", "boltstrike", "fusionflare", "fusionbolt", "astralbarrage", "futuresight", "diamondstorm", "oblivionwing", "darkvoid", "hydrocannon", "dragonascent", "steelbeam", "mistyexplosion", "frenzyplant", "headsmash", "gigaimpact", "plasmafists", "clangingscales", "shadowforce"]);

export function movePool(id: string): string[] {
  const sp = ROSTER.find((s) => s.id === id);
  if (!sp) return [];
  const known = LEARNSETS[id];
  let list: string[];
  if (known) {
    const set = new Set([...sp.moves, ...known].filter((m) => MOVES[m]));
    for (const k of Object.keys(MOVES)) if (sp.types.includes(MOVES[k]!.type) && !SIGNATURE.has(k)) set.add(k);
    list = [...set];
  }
  else {
    const set = new Set<string>(sp.moves);
    for (const k of Object.keys(MOVES)) if ((sp.types.includes(MOVES[k]!.type) || MOVES[k]!.type === "Normal") && !SIGNATURE.has(k)) set.add(k);
    for (const k of ["shadowball", "icebeam", "thunderbolt", "flashcannon", "earthquake", "stoneedge", "psychic", "surf", "flamethrower"]) if (MOVES[k]) set.add(k);
    list = [...set];
  }
  const rank = (m: string) => (sp.types.includes(MOVES[m]!.type) ? 0 : MOVES[m]!.type === "Normal" ? 2 : 1);
  return list.map((m, i) => [m, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
}

/** How far a move reaches (px): used to show where it will land while aiming. */
export function moveReach(mv: MoveDef): number {
  if (mv.kind === "nova") return mv.range ?? 120;
  const r = mv.range ?? (mv.speed ? mv.speed * 0.8 : 300);
  return Math.max(110, Math.min(440, r));
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
  ...L("fly", "charizard dragonite salamence staraptor skarmory corviknight rayquaza hydreigon scizor lugia hooh latias latios reshiram yveltal lunala eternatus tapukoko butterfree orbeetle pidgeot beedrill aerodactyl altaria volcarona"),
  ...L("float", "mewtwo gengar alakazam gardevoir chandelure froslass darkrai chimecho magearna metagross starmie dragapult aegislash meowstic tatsugiri glimmora mew deoxys diancie necrozma banette glalie giratina arceus kyogre alcremie hatterene"),
  ...L("run", "pikachu raichu jolteon arcanine zeraora lucario umbreon absol sceptile blaziken greninja hawlucha excadrill garchomp raikou entei suicune xerneas solgaleo zacian zamazenta marshadow houndoom manectric lopunny lycanroc cinderace eevee weavile infernape"),
  ...L("surf", "lapras"),
  ...L("slither", "gyarados onix steelix sandaconda"),
]);
export const locoOf = (sp: Species): Loco => LOCO[sp.id] ?? (sp.types.includes("Flying") ? "fly" : sp.types.includes("Ghost") ? "float" : "walk");
/** The ones that burrow when they roll. */
export const DIGGERS = new Set(["garchomp", "excadrill"]);
export const isSwimmer = (sp: Species) => sp.types.includes("Water") || locoOf(sp) === "surf" || locoOf(sp) === "slither";

/** The legendary and mythical ones (for the picker's filter). */
export const LEGENDARY = new Set(["mewtwo", "rayquaza", "heatran", "darkrai", "magearna", "zeraora", "lugia", "hooh", "kyogre", "groudon", "dialga", "palkia", "giratina", "arceus", "mew", "raikou", "entei", "suicune", "latias", "latios", "deoxys", "reshiram", "zekrom", "kyurem", "xerneas", "yveltal", "solgaleo", "lunala", "necrozma", "zacian", "zamazenta", "eternatus", "zygarde", "diancie", "marshadow", "tapukoko"]);
