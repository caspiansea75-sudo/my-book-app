/**
 * Every Mega form's own special move: its name, what it does, and which look (see components/pokemon/arena-megafx.ts) with its two colours.
 * "id | move name | description | look | main colour | second colour"
 */
export type MegaStyle = "inferno" | "tide" | "thunder" | "aura" | "psychic" | "shadow" | "blades" | "frost" | "dragon" | "tempest" | "quake" | "starlight" | "toxic" | "swarm" | "claws" | "verdant" | "magma" | "pulse" | "cosmic";
export type MegaMove = { name: string; desc: string; style: MegaStyle; c1: string; c2: string };

const RAW = `
charizard-megax|Blue Dragon Inferno|Blue-white dragon fire roars out in a ring around you.|inferno|#3f9bff|#e6f4ff
charizard-megay|Sunfire Eruption|Sun-bright flames erupt in towering columns.|inferno|#ff7a1f|#ffe27a
rayquaza-mega|Sky Pillar Cyclone|A green sky-dragon's spiral tears the air apart.|dragon|#2fd08a|#e0fff0
venusaur-mega|Verdant Bloom Blast|Giant petals and spores burst from the bloom on its back.|verdant|#5fd05f|#ffc2ea
blastoise-mega|Cannon Tsunami|Shoulder cannons fire rings of crashing torrents.|tide|#3f86ff|#d2eaff
gengar-mega|Void Shadow Embrace|A black void opens and phantom hands reach out.|shadow|#5a2f9a|#c692ff
lucario-mega|Aura Surge|Spirit aura spirals inward, then bursts out as a shockwave.|aura|#4aa8ff|#eaf2ff
lucario-megaz|Z Aura Brand|A razor cross of steel-bright aura cuts through the arena.|blades|#8ec0ff|#ffd84d
garchomp-mega|Sandstorm Slash|Sand and blades whip out in a spinning storm.|tempest|#d8b070|#fff0c8
garchomp-megaz|Z Dragon Rend|Dragon-blue slashes rip in from every side.|claws|#7a5cff|#cfc6ff
gardevoir-mega|Wedding Wish|A pink-white light of devotion blooms and stars drift out.|starlight|#ff9be0|#ffffff
alakazam-mega|Spoon Shock|Spinning psychic rings and floating orbs warp the air.|psychic|#ffd24d|#ff8bd8
scizor-mega|Twin Pincer Cross|Crossing pincer slashes of red steel.|blades|#ff4d4d|#ffd0d0
gyarados-mega|Tyrant Maelstrom|A dark whirlpool of fury rages around you.|tide|#3a5fb8|#d94a4a
tyranitar-mega|Fault Line Crush|The ground splits and boulders hurl into the air.|quake|#8a9a52|#e8d9a0
blaziken-mega|Blast Kick Blaze|Fiery spiral kicks leave flaming arcs all round.|inferno|#ff6a1a|#ffd070
salamence-mega|Dragon Wing Storm|Two huge wing slashes and a spiral of dragon winds.|dragon|#e8504a|#ffd6c8
metagross-mega|Quad Meteor Mash|Four steel limbs slam out in a cross, bolts racing along the lines.|pulse|#9aa8c8|#ffd84d
absol-mega|Calamity Wing Slash|White wings and a razor scythe of dark light.|claws|#d8d8ff|#6a4aa8
absol-megaz|Z Calamity Eclipse|Dark and ghostly claws tear out of an eclipse.|shadow|#4a3a7a|#e8e0ff
mewtwo-megax|Fighting Mind Break|Psychic shockwaves carried on fists of force.|aura|#c070ff|#ff9a6a
mewtwo-megay|Psystrike Overmind|Great rings of pure mind-power rip outward.|psychic|#c9a0ff|#ffffff
steelix-mega|Iron Serpent Crash|A giant steel body slams the floor, cracks racing out.|quake|#9aa4b0|#e0e6f0
sceptile-mega|Leaf Blade Tempest|Dragon-leaf blades spin out in a storm.|verdant|#46c76a|#e0ffa0
kyogre-primal|Origin Tide|A primal flood rises in enormous rings.|tide|#2a5cff|#b8e8ff
groudon-primal|Precipice Magma|The ground cracks with lava and flames burst up.|magma|#ff5a1a|#ffd24d
latias-mega|Mist Dragon Veil|A soft mist of light and red-white dragon pulses.|starlight|#ff6a7a|#ffffff
latios-mega|Luster Dive|Blue light streaks outward in a dragon's dive.|dragon|#4a8cff|#d8e8ff
diancie-mega|Diamond Storm|A bloom of pink gem shards flies outward.|frost|#ff9bd0|#fff0fa
ampharos-mega|Lightning Flare Dragon|Thunder bolts and dragon-fire flashes radiate outward.|thunder|#ffd84d|#ff6a4a
heracross-mega|Horn Pierce Rush|Piercing horn charges burst out in a swarm.|swarm|#5a9a3a|#ffd070
houndoom-mega|Hellfire Howl|Dark-purple fire erupts as it howls.|inferno|#a040ff|#ff6a3a
aggron-mega|Iron Armor Quake|A steel body-slam shockwave splits the floor.|quake|#8a94a8|#dfe6f2
manectric-mega|Voltage Mane Storm|Its mane crackles and bolts fork in every direction.|thunder|#4aeaff|#ffffff
sharpedo-mega|Jaw Torpedo|Fin blades and water arcs slice out all round.|tide|#3a7fd0|#ff6a4a
camerupt-mega|Eruption Peak|Twin volcano bursts of magma.|magma|#ff7a2a|#ffd070
altaria-mega|Cloud Song|Dragon-fairy cloud winds sparkle and spin.|tempest|#bfe0ff|#ffd6f0
banette-mega|Curse Zipper|Cursed shadows and a creeping red grin.|shadow|#3a2f5a|#ff4a6a
glalie-mega|Frozen Maw|Ice shards and a freezing roar.|frost|#9fd8ff|#ffffff
lopunny-mega|Mach Kick Rush|Rapid claw-kick slashes.|claws|#ffb8d0|#fff0f6
gallade-mega|Psycho Blade Dance|Blades of mind-light dance out.|blades|#6ae0a0|#e0fff2
abomasnow-mega|Blizzard Giant|A heavy blizzard rolls out from its body.|frost|#cfe8ff|#ffffff
pinsir-mega|Horn Crush Wings|A winged horn rush explodes outward.|swarm|#c8a04a|#fff0b0
aerodactyl-mega|Prehistoric Gale|Screaming prehistoric winds with flying rocks.|tempest|#8a7a9a|#d8d0e8
kangaskhan-mega|Parental Pounce|Powerful twin claws strike out together.|claws|#d8a070|#ffe8c8
slowbro-mega|Shell Daze Bomb|Psychic mist as the shell bursts.|psychic|#ff9ac8|#c8a0ff
beedrill-mega|Triple Stinger Barrage|A barrage of stingers spirals out.|swarm|#ffd02a|#ff6a2a
pidgeot-mega|Hurricane Pass|A ring of hurricane winds.|tempest|#ffe08a|#ffffff
sableye-mega|Gem Glare|Gem lights flash in the dark.|shadow|#7a3acf|#7ad8ff
medicham-mega|Zen Meditation Burst|Calm aura rings flow outward.|aura|#ff8ad8|#ffffff
swampert-mega|Mud Tsunami|A tide of mud and water crashes out.|tide|#3a7acf|#8a6a3a
dragonite-mega|Mega Hurricane Dive|Dragon winds dive and spiral.|dragon|#ffa23a|#fff0c8
delphox-mega|Mystic Flame Magic|Psychic-pink flames dance out.|inferno|#ff5ac8|#ffd0f0
chesnaught-mega|Spiky Shell Slam|Thorns and a heavy shockwave.|verdant|#6ac24a|#c8a040
emboar-mega|Heavy Flame Stomp|A stomp that throws up flames and cracks.|magma|#ff6a2a|#ffe070
feraligatr-mega|Crunch Wave|A jaw-shaped wave crashes out.|tide|#2a7acf|#e8d0a0
meganium-mega|Healing Bloom Aroma|Petals of a healing bloom drift out.|verdant|#ff9ac8|#d8ffb8
clefable-mega|Moonlit Stardust|Stars and moon-glow rain down.|starlight|#ffc0e0|#ffffff
starmie-mega|Cosmic Core Burst|Star-shaped waves from the core.|cosmic|#ff7ab8|#ffd84d
victreebel-mega|Acid Bloom Gulp|Toxic spores and acid bubbles.|toxic|#a8d04a|#c860e0
excadrill-mega|Drill Quake|A drilling vortex and flying shards.|quake|#a8b0c0|#ffd070
froslass-mega|Snow Veil Curse|Ghostly snow swirls out.|frost|#bfe8ff|#b080ff
hawlucha-mega|Flying Press Smash|Winged arcs and a diving slam.|tempest|#ff5a5a|#ffe070
raichu-megax|Thunder Surge X|A heavy thunderstorm bursts out.|thunder|#ffcc2a|#ff8a2a
raichu-megay|Voltage Gale Y|Quick forking sparks.|thunder|#ffe84a|#ffffff
zeraora-mega|Plasma Fist Flurry|A flurry of lightning punches.|thunder|#ffd24d|#4ae0ff
heatran-mega|Magma Core Eruption|Lava and hot steel.|magma|#ff5a2a|#c8c8d8
darkrai-mega|Nightmare Void|Dark nightmares pour out.|shadow|#2a1a4a|#a04aff
golurk-mega|Ancient Titan Quake|A clay titan stomps; ghost-green light leaks.|quake|#b09a68|#7affc0
staraptor-mega|Brave Talon Dive|A falcon's wind dive.|tempest|#ff8a5a|#ffe0c0
baxcalibur-mega|Glaive Frost Dragon|An ice-blade dragon storm.|frost|#7ad0ff|#8a6aff
chimecho-mega|Wind Chime Resonance|Rings of sound.|psychic|#8acbff|#e0f0ff
crabominable-mega|Ice Hammer Fury|Ice pillars burst up.|frost|#8ad0ff|#ffffff
golisopod-mega|First Impression Rush|Armour-plate slashes.|blades|#c8c060|#e0e8f0
scovillain-mega|Spicy Fire Spray|Spicy flames with green spores.|inferno|#ff4a2a|#6ad04a
glimmora-mega|Toxic Crystal Bloom|Crystals and poison bloom.|toxic|#c070ff|#ff9ad0
tatsugiri-mega|Counter Dragon Splash|A splash of sauce and dragon water.|tide|#ff8a5a|#4ac8ff
meowstic-mega|Psychic Pounce|Psychic rings and sparkles.|psychic|#6ab0ff|#ffd0f0
magearna-mega|Fleur Cannon Pulse|Clockwork pulses along the lines.|pulse|#ff9ad0|#c8d0e0
magearna-original|Original Color Fleur Cannon|Bright clockwork pulses.|pulse|#ffd84d|#ffffff
`;
export const MEGA_MOVES: Record<string, MegaMove> = Object.fromEntries(
  RAW.trim().split("\n").map((l) => {
    const [id, name, desc, style, c1, c2] = l.split("|");
    return [id!, { name: name!, desc: desc!, style: style as MegaStyle, c1: c1!, c2: c2! }];
  }),
);

/** The look a form without its own entry gets, from the type of its move. */
export const STYLE_OF_TYPE: Record<string, MegaStyle> = {
  Fire: "inferno", Water: "tide", Electric: "thunder", Psychic: "psychic", Ghost: "shadow", Dark: "shadow", Steel: "blades", Ice: "frost", Dragon: "dragon",
  Flying: "tempest", Ground: "quake", Rock: "quake", Fairy: "starlight", Poison: "toxic", Bug: "swarm", Fighting: "aura", Grass: "verdant", Normal: "cosmic",
};
