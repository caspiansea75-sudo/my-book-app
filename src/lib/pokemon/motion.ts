/** How a move is performed, worked out from its name, type and category. Shared by the arena and the sound. */

export type Motion = "dash" | "jump" | "spin" | "dig" | "bite" | "uppercut" | "slam" | "charge" | "dance" | "curl" | "heal" | "roar" | "quake";
export const RX = {
  quake: /^(earthquake|magnitude|bulldoze|stomping tantrum|fissure|precipice blades)$/i,
  dig: /^(dig|burrow|sand tomb)$/i,
  jump: /(jump|bounce|flying press|sky|dive|pounce|leap|brave bird|^fly$|acrobatics|dragon ascent|aerial|stomp|plunge|hyperspace)/i,
  spin: /(spin|gyro|twister|whirl|roll|tornado|drill|screw|blade|wheel|pinwheel)/i,
  bite: /(bite|crunch|fang|chomp|gnaw|peck|horn|pierce|sting|claw|slash|scratch|cut|shear)/i,
  slam: /(slam|hammer|smash|crush|body|double.edge|take down|giga impact|wild charge|head|explosion|self-destruct|tackle|bulk)/i,
  curl: /(protect|detect|harden|withdraw|defense curl|iron defense|barrier|acid armor|cotton guard|shelter|endure|spiky shield|king's shield|baneful bunker|obstruct|substitute|light screen|reflect|aurora veil|mist|safeguard|wide guard|quick guard|mat block|silk trap|burning bulwark)/i,
  heal: /(recover|roost|heal|synthesis|moonlight|morning sun|soft-?boiled|slack off|milk drink|rest|wish|shore up|life dew|jungle healing|aqua ring|ingrain|strength sap)/i,
  dance: /(dance|swords|nasty plot|calm mind|bulk up|agility|growth|work up|coil|shell smash|tail glow|geomancy|meditate|hone claws|sharpen|howl|cosmic power|amnesia|minimize|rock polish|autotomize|belly drum|victory)/i,
};
export function motionFor(name: string, type: string, cat?: string): Motion {
  if (cat === "Status") {
    if (RX.curl.test(name)) return "curl";
    if (RX.heal.test(name)) return "heal";
    if (RX.dance.test(name)) return "dance";
    return "roar";
  }
  if (RX.quake.test(name)) return "quake";
  if (RX.dig.test(name)) return "dig";
  if (cat === "Special") return "charge";
  if (RX.jump.test(name)) return "jump";
  if (RX.spin.test(name)) return "spin";
  if (RX.bite.test(name)) return "bite";
  if (RX.slam.test(name)) return "slam";
  if (type === "Fighting") return "uppercut";
  return "dash";
}


/** Status moves that change the whole field (weather, terrain, hazards, screens…), not one Pokémon. */
export const FIELD_RX = /^(rain dance|sunny day|sandstorm|hail|snowscape|chilly reception|stealth rock|spikes|toxic spikes|sticky web|reflect|light screen|aurora veil|trick room|tailwind|gravity|magic room|wonder room|electric terrain|grassy terrain|misty terrain|psychic terrain|haze|safeguard|mist|lucky chant|court change|defog|rapid spin|mortal spin|steel roller|ice spinner)$/i;

/** Status moves that put something on the foe: ailments and stat drops. */
export const AILMENT_RX = /(thunder wave|toxic|will-o-wisp|sleep powder|spore|hypnosis|lovely kiss|sing|glare|stun spore|poison powder|poison gas|yawn|confuse ray|supersonic|swagger|flatter|teeter dance|dark void|grass whistle|leech seed|curse|nightmare|attract|taunt|torment|encore|disable|screech|growl|leer|tail whip|string shot|charm|feather dance|metal sound|fake tears|scary face|sweet scent|captivate|eerie impulse|tickle|memento|parting shot|venom drench|noble roar|baby-doll eyes|confide|snarl|kinesis|sand attack|smokescreen|flash|mud-slap|cotton spore)/i;
