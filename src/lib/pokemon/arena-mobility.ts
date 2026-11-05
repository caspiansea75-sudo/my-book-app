/**
 * Special movement: one extra move for every type, on its own button (key E).
 * Pure data, shared by the engine, the screens and the renderer.
 */

/** How the move plays out. */
export type MovKind =
  | "leap" // a high arc jump: over obstacles and pits, a slam on landing
  | "run" // a timed burst of speed, with a trail and a touch that hurts
  | "fly" // take off: cross pits and low things, a little faster, for a while
  | "blink" // vanish and appear at the aim point at once
  | "vanish" // fade out, pass through anything, then appear at the aim point
  | "stalk" // step through the shadows to behind the nearest foe
  | "dig"; // burrow under the ground and burst out

export type Trail = "fire" | "water" | "spark" | "leaf" | "frost" | "sludge" | "dust" | "wind" | "stone" | "shade" | "dragon" | "steel" | "spirit" | "silk" | "ember";

export type StatusK = "par" | "brn" | "psn" | "frz" | "cnf";

export type Mobility = {
  type: string;
  name: string;
  icon: string;
  /** One line for the button's tooltip and the move sheet. */
  desc: string;
  kind: MovKind;
  cd: number;
  /** Seconds it lasts. */
  dur: number;
  /** Speed multiplier while it lasts (run / fly). */
  speed?: number;
  /** Distance (leap / blink / vanish / stalk / dig). */
  range?: number;
  trail: Trail;
  /** Damage to whoever it touches, as a share of the usual hit (0 = harmless). */
  dmg?: number;
  kb?: number;
  status?: { kind: StatusK; chance: number };
  /** Damage-shield seconds while it lasts. */
  shield?: number;
  /** Pass over pits and low obstacles (as a flyer does). */
  cross?: boolean;
  /** Not slowed by water or slippery floors. */
  sure?: boolean;
  /** Share of max HP healed over its length. */
  heal?: number;
  /** Seconds of bonus damage on the next hits when it ends. */
  focus?: number;
  /** Leaves toxic puddles behind. */
  puddles?: boolean;
  /** Freezes the water it crosses. */
  freeze?: boolean;
};

export const MOBILITY: Record<string, Mobility> = {
  Normal: { type: "Normal", name: "Hop", icon: "🦘", desc: "A big jump over anything in the way. Shakes the ground when it lands.", kind: "leap", cd: 3.2, dur: 0.6, range: 300, trail: "dust", dmg: 0.6, kb: 260, cross: true },
  Fire: { type: "Fire", name: "Blaze Rush", icon: "🔥", desc: "Sprint wrapped in flame. Leaves a burning trail and scorches what it touches.", kind: "run", cd: 5, dur: 1.4, speed: 2, trail: "fire", dmg: 0.5, kb: 220, status: { kind: "brn", chance: 0.8 } },
  Water: { type: "Water", name: "Aqua Glide", icon: "🌊", desc: "Swim-glide at speed, even across the dry floor. Washes foes aside.", kind: "run", cd: 5, dur: 1.8, speed: 1.9, trail: "water", dmg: 0.35, kb: 360, sure: true },
  Electric: { type: "Electric", name: "Volt Dash", icon: "⚡", desc: "Run as lightning. Blinding speed, and a shock for anyone you pass through.", kind: "run", cd: 5, dur: 1.5, speed: 2.3, trail: "spark", dmg: 0.45, kb: 160, status: { kind: "par", chance: 0.85 }, sure: true },
  Grass: { type: "Grass", name: "Vine Sprint", icon: "🌿", desc: "Vines pull you along. Heals a little and tangles whoever you brush.", kind: "run", cd: 6, dur: 1.8, speed: 1.6, trail: "leaf", dmg: 0.3, kb: 120, status: { kind: "par", chance: 0.9 }, heal: 0.06 },
  Ice: { type: "Ice", name: "Ice Skate", icon: "⛸️", desc: "Skate on a frozen track. Freezes the water you cross and never slips.", kind: "run", cd: 6, dur: 2.2, speed: 1.8, trail: "frost", dmg: 0.3, kb: 180, status: { kind: "frz", chance: 0.3 }, sure: true, freeze: true },
  Fighting: { type: "Fighting", name: "Rush Step", icon: "🥊", desc: "A short, hard charge. Shrugs off hits and knocks foes flying.", kind: "run", cd: 3.5, dur: 0.7, speed: 2.4, trail: "wind", dmg: 0.9, kb: 520, shield: 0.8 },
  Poison: { type: "Poison", name: "Sludge Crawl", icon: "☠️", desc: "Slither along leaving toxic puddles that poison anyone who steps in.", kind: "run", cd: 7, dur: 2.2, speed: 1.5, trail: "sludge", dmg: 0.25, kb: 100, status: { kind: "psn", chance: 0.8 }, puddles: true, sure: true },
  Ground: { type: "Ground", name: "Dig", icon: "⛏️", desc: "Burrow under the floor, untouchable, and burst out under your foes.", kind: "dig", cd: 5, dur: 0.75, range: 340, trail: "dust", dmg: 1, kb: 460, cross: true },
  Flying: { type: "Flying", name: "Sky Soar", icon: "🕊️", desc: "Take to the air: cross pits and obstacles, a rush of wind on take-off.", kind: "fly", cd: 7, dur: 2.4, speed: 1.55, trail: "wind", dmg: 0.2, kb: 300, cross: true, sure: true },
  Psychic: { type: "Psychic", name: "Teleport", icon: "🔮", desc: "Blink instantly to where you are aiming.", kind: "blink", cd: 4, dur: 0.3, range: 400, trail: "spirit", cross: true },
  Bug: { type: "Bug", name: "Skitter", icon: "🕷️", desc: "Scuttle over low obstacles at speed, spinning silk that tangles foes.", kind: "run", cd: 5, dur: 1.4, speed: 1.9, trail: "silk", dmg: 0.25, kb: 100, status: { kind: "par", chance: 0.8 }, cross: true, sure: true },
  Rock: { type: "Rock", name: "Boulder Roll", icon: "🪨", desc: "Curl up and roll. Almost no damage taken, crushes crates and shoves foes.", kind: "run", cd: 7, dur: 1.8, speed: 1.7, trail: "stone", dmg: 0.8, kb: 440, shield: 1.8, sure: true },
  Ghost: { type: "Ghost", name: "Phase Shift", icon: "👻", desc: "Disappear, pass through everything, and reappear where you aim. Spooks those nearby.", kind: "vanish", cd: 6, dur: 0.8, range: 440, trail: "spirit", cross: true, status: { kind: "cnf", chance: 0.7 } },
  Dragon: { type: "Dragon", name: "Draco Flight", icon: "🐉", desc: "Wings out: fly fast over pits and obstacles, knocking foes aside as you pass.", kind: "fly", cd: 7, dur: 2, speed: 1.7, trail: "dragon", dmg: 0.5, kb: 380, cross: true, sure: true },
  Dark: { type: "Dark", name: "Shadow Step", icon: "🌑", desc: "Slip through the shadows to behind the nearest foe. Your next hits bite harder.", kind: "stalk", cd: 5, dur: 0.3, range: 560, trail: "shade", cross: true, focus: 2.5 },
  Steel: { type: "Steel", name: "Iron Charge", icon: "🛡️", desc: "A heavy armoured charge. Blocks nearly everything and hits like a truck.", kind: "run", cd: 6, dur: 1, speed: 1.9, trail: "steel", dmg: 1, kb: 480, shield: 1.2, sure: true },
  Fairy: { type: "Fairy", name: "Pixie Drift", icon: "✨", desc: "Float lightly over the field leaving sparkles that mend you.", kind: "fly", cd: 7, dur: 2.2, speed: 1.4, trail: "ember", dmg: 0, heal: 0.1, cross: true, sure: true },
};

/** The special movement of a Pokémon with these types: `idx` picks the first or the second type (a one-type Pokémon only has the first). */
export const mobilityOf = (types: string[], idx = 0): Mobility => MOBILITY[types[Math.min(idx, types.length - 1)] ?? "Normal"] ?? MOBILITY.Normal!;

/** Where the effects of each trail come from: colours for the renderer. */
export const TRAIL_COL: Record<Trail, [string, string]> = {
  fire: ["#ff9a3c", "#ffe27a"],
  water: ["#59b8ff", "#d6f1ff"],
  spark: ["#ffe94a", "#ffffff"],
  leaf: ["#5fd06a", "#d4ffb0"],
  frost: ["#9fe6ff", "#ffffff"],
  sludge: ["#9a4fd0", "#d9a6ff"],
  dust: ["#b69a6a", "#f0e2c0"],
  wind: ["#e8f2ff", "#ffffff"],
  stone: ["#a39a82", "#d9d1b8"],
  shade: ["#3a2f4d", "#8a6fb0"],
  dragon: ["#6a5cff", "#c5b8ff"],
  steel: ["#b9c3cf", "#ffffff"],
  spirit: ["#b07cff", "#f0dcff"],
  silk: ["#d8e6a0", "#ffffff"],
  ember: ["#ff9ad8", "#fff0fb"],
};
