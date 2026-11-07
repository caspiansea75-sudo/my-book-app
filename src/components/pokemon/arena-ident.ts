/**
 * A signature look for the moves that used to share one. Before this, 144 moves had no art of their own and fell back to one of 24
 * shared "motif" animations (13 punches all made the same fist burst, 10 stat boosts the same star glow, 7 beams the same flash...).
 * Each move listed here now has its own cast flourish, its own wake / trail and its own impact, put together from a different
 * geometry (rings, converging dots, falling slabs, fans of streaks, cracks, spirals...) and a different kind of particle.
 * The colours still come from the move's type palette, so a move keeps its element but not its neighbour's animation.
 *
 * A layer is `kind pattern count speed size life colour [gravity] [delay]`.
 *   kinds    st star, sp spark, sk streak, sh shard, pl plank, pf puff, sm smoke, fl flame, bu bubble, dt dot, lf leaf, ar arc,
 *            cr cross, bo bolt, gr ground ring, gl glow, fk flake, cx floor crack
 *   patterns r radial, c cone ahead, u up, i implode, o ring outwards, l line along the hit, s spiral, f fan, d down from the sky,
 *            b behind (the wake), x four diagonals
 *   colour   0 dark, 1 mid, 2 light, 3 core, 4 white, 5 near-black
 */
import type { SpecCtx, SP } from "./arena-spec";

type Layer = { kind: string; pat: string; n: number; spd: number; size: number; life: number; col: number; g: number; delay: number };
type Ident = { c: Layer[]; h: Layer[]; w: Layer[]; shake: number };

const KIND: Record<string, string> = { st: "star", sp: "spark", sk: "streak", sh: "shard", pl: "plank", pf: "puff", sm: "smoke", fl: "flame", bu: "bubble", dt: "dot", lf: "leaf", ar: "arc", cr: "cross", bo: "bolt", gr: "gring", gl: "glow", fk: "flake", cx: "crack" };
const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const parse = (s: string): Layer[] =>
  s.split(",").map((t) => t.trim()).filter(Boolean).map((t) => {
    const [kind, pat, n, spd, size, life, col, g, delay] = t.split(/\s+/);
    return { kind: KIND[kind!] ?? "spark", pat: pat!, n: +n!, spd: +spd!, size: +size!, life: +life!, col: +(col ?? 1), g: +(g ?? 0), delay: +(delay ?? 0) };
  });

/** id | cast | impact | wake or trail | flags (S = shake) */
const TABLE = `
flamethrower|fl c 6 230 9 .4 1|fl u 6 140 9 .55 1,sm u 3 60 12 .8 0||
shadowblast|dt i 10 0 4 .35 1,gl r 1 90 12 .3 0|dt i 12 0 5 .5 1,gr o 1 160 6 .5 1,sm r 4 50 14 .9 5||
psywave|gr o 1 120 5 .4 2,gr o 1 180 5 .55 1,ar o 4 0 8 .5 2|ar o 6 60 7 .5 2,gr o 1 150 5 .45 2||
chargebeam|sp c 8 300 2 .3 3,bo o 3 40 0 .2 3|bo r 5 55 0 .2 3,sp r 10 260 2 .35 2||
hydropump|bu c 8 240 5 .5 2,pf c 4 160 8 .4 4|bu u 10 150 5 .7 2 -40,gr o 1 140 6 .45 2||
solarbeam|dt i 14 0 4 .5 2,gl r 1 120 16 .5 3|lf r 8 160 4 .8 2 80,gl r 1 110 20 .4 3||
icebeam|fk c 8 200 4 .5 2,sh c 4 250 3 .4 2|sh u 8 180 4 .7 2 500,fk r 8 90 4 .8 4||
freezedry|fk c 10 170 3 .6 4|fk o 10 70 4 1 4,gr o 1 110 5 .6 2||
thunderbolt|bo r 4 40 0 .15 3|bo r 8 60 0 .22 3,sp r 8 300 2 .3 3,bo u 3 60 0 .2 3||
aeroblast|ar f 5 220 6 .4 2,pf c 5 200 9 .4 4|ar o 6 90 8 .45 2,gr o 1 170 6 .5 4,sk o 6 250 12 .2 4||
prismaticlaser|sp c 10 260 2 .3 3,st f 5 200 4 .5 2|st o 10 170 5 .55 3,sp r 10 280 2 .35 2,gr o 1 130 6 .5 2||
moongeistbeam|dt i 8 0 4 .4 1,st c 4 140 4 .5 3|st u 8 90 5 .9 2 -20,dt o 8 70 5 .9 1,gr o 1 150 6 .55 1||
steelbeam|sp c 8 280 2 .3 3,pl c 3 220 3 .4 1 500|sh r 10 260 3 .5 2 700,cr r 1 0 50 .2 3||
zapcannon|bo c 5 40 0 .2 3,gl r 1 140 20 .35 2|bo r 7 70 0 .25 3,gr o 1 160 7 .5 1,sp r 8 320 2 .35 3||
fleurcannon|st c 8 240 4 .5 2,gl r 1 120 16 .4 1|st o 8 140 6 .7 2 80,lf r 6 130 4 .8 0 60,gr o 1 140 6 .5 1||
bubblebeam|bu c 8 200 4 .6 2|bu r 8 110 4 .7 2 -30||
judgment|gl r 1 130 14 .5 3,st o 6 100 5 .6 3|ar o 8 0 9 .6 3,gr o 1 190 7 .6 3,cr r 1 0 90 .3 3,sh d 8 400 5 .5 3||S
boltstrike|bo r 6 60 0 .2 3|bo r 10 90 0 .3 3,gr o 1 190 7 .5 2,sp u 10 280 2 .5 3 600||S
synthesis|lf u 8 90 4 1 2 -10,gl r 1 70 16 .6 2|||
recover|st o 8 70 5 .8 2 -20,gr o 1 90 6 .6 2|||
aromatherapy|lf o 8 60 4 1 2,sm o 6 30 12 1.2 4,st u 4 60 4 1 3|||
shoreup|pl u 8 120 4 .8 1 400,pf o 6 60 9 .8 0|||
roost|pf u 6 50 9 1 4,ar o 4 50 7 .9 4|||
slackoff|dt u 6 30 5 1.1 4 -10,sm u 3 25 14 1.2 4|||
moonlight|st d 8 50 5 1 3,gl r 1 80 20 .7 3|||
protect|gr o 1 150 5 .6 2,ar o 6 0 10 .7 3|||
kingsshield|sh o 8 130 5 .6 2,gr o 1 140 6 .6 3|||
irondefense|pl o 8 100 5 .7 1,gr o 1 130 6 .6 2,cr r 1 0 50 .3 3|||
swordsdance|ar x 8 0 12 .5 3,sk f 6 260 14 .35 3|||
calmmind|gr o 1 100 5 .7 2,dt o 8 40 4 1 3|||
doubleteam|dt s 10 90 5 .6 1,gl r 1 70 16 .4 3|||
agility|sk b 8 300 14 .3 3,pf b 4 100 8 .4 4|||
quiverdance|st s 10 80 4 .9 2,ar o 4 0 8 .7 1|||
cosmicpower|st u 8 70 5 1 3 -10,dt i 10 0 3 .6 2,gr o 1 120 5 .6 2|||
amnesia|dt u 6 25 6 1.2 3 -10,gr o 1 90 6 .8 1|||
workup|fl u 6 90 7 .5 1,st r 6 120 4 .4 3|||
coil|ar s 6 0 10 .8 1,gr o 1 100 6 .6 1|||
shellsmash|sh r 10 260 4 .5 3 500,gr o 1 160 7 .4 3|||
harden|sp i 10 0 2 .35 3,cr r 1 0 36 .3 3|||
acidarmor|bu u 8 60 5 .8 1,sm o 4 30 11 .8 1|||
growth|lf u 8 70 5 1 1 -10,gr o 1 90 5 .7 2|||
geomancy|st i 10 0 5 .7 2,gl r 1 110 20 .6 3,gr o 1 130 6 .7 3|||
bulletpunch|sk b 6 360 12 .2 3|st l 6 260 5 .3 3,sp c 8 300 2 .25 3,gr o 1 70 4 .25 3|sk b 1 420 10 .15 3|
meteormash|pl d 6 300 5 .5 1 700,gl r 1 100 14 .3 1|pl u 12 300 5 .8 1 900,gr o 1 160 7 .5 1,sm o 6 60 14 .9 0|fl b 1 80 6 .35 1,sh b 1 120 4 .4 2 300|S
bodyslam|pf b 6 120 9 .4 4|gr o 1 130 7 .35 4,gr o 1 180 6 .55 2,pf o 10 150 11 .6 4|pf b 1 80 8 .4 4|
firepunch|fl c 6 200 8 .35 1|fl r 10 190 8 .55 1,st r 6 170 5 .4 3,gr o 1 90 5 .35 1|fl b 1 70 7 .4 1|
woodhammer|lf c 6 160 4 .6 2|pl r 10 260 4 .6 1 700,lf r 8 150 4 .8 2 80,gr o 1 100 6 .4 2|lf b 1 70 4 .6 2 40|
plasmafists|bo c 4 40 0 .15 3|bo r 8 70 0 .2 3,gl r 1 120 18 .3 2,gr o 1 100 5 .3 3|bo r 1 40 0 .12 3,sp b 1 200 2 .25 3|
icepunch|fk c 8 170 4 .5 2|sh r 10 250 4 .6 2 700,fk r 8 100 4 .8 4,gr o 1 90 5 .4 2|fk b 1 70 4 .5 2|
superpower|gr o 1 90 6 .35 1,sk b 8 300 12 .25 1|cx o 6 70 0 1.4 5,gr o 1 170 8 .5 1,pl r 8 240 4 .7 1 700|sk b 2 300 12 .2 1|S
machpunch|gr o 1 60 4 .2 4|gr o 1 150 5 .25 4,sk r 8 400 10 .15 4,cr r 1 0 40 .15 4|sk b 1 500 8 .1 4|
brickbreak|pl c 5 200 5 .4 1|pl d 12 150 6 .8 1 800,pf o 6 80 9 .6 0,cr r 1 0 54 .2 3|pl b 1 90 4 .4 1 300|
suckerpunch|dt i 8 0 4 .3 5|dt i 10 0 5 .4 5,gr o 1 120 6 .45 0,sk r 6 260 12 .2 3|sm b 1 40 9 .4 5|
knockoff|sp c 6 200 2 .3 3|st u 6 220 6 .8 3 700,ar o 3 0 9 .5 3,gr o 1 100 5 .35 0|sp b 1 150 2 .3 3|
gigaimpact|gl r 1 120 18 .5 1,gr o 1 150 6 .5 1|gr o 1 230 9 .7 1,gr o 1 140 7 .5 2,sh r 12 340 5 .7 2 600,sm o 8 90 16 1 0|fl b 1 100 8 .4 1,sk b 1 400 12 .25 4|S
crunch|sh c 4 260 5 .3 4,sk c 4 300 10 .2 3|sh i 8 0 6 .35 4,gr o 1 110 5 .3 3,cr r 1 0 40 .2 4|dt b 1 60 3 .3 5|
lunge|sk c 6 340 14 .25 1|sk l 5 340 14 .2 1,dt r 6 180 3 .4 1,gr o 1 90 5 .3 1|sk b 1 300 10 .2 1|
spectralthief|dt s 8 100 4 .5 1|dt i 10 0 4 .5 1,st u 6 150 4 .7 3 -50,gr o 1 100 5 .4 1|dt b 2 90 4 .5 1|
foulplay|sp c 6 200 2 .3 5|cr r 1 0 54 .2 5,sk f 7 280 14 .2 1,gr o 1 100 5 .35 1|sm b 1 60 8 .4 5|
playrough|st c 6 220 5 .4 2|st r 10 220 5 .5 2,sk f 6 260 12 .2 3,gr o 1 130 6 .4 2|st b 1 90 4 .4 2|
slash|ar c 3 200 9 .3 4|ar x 4 0 10 .3 3,cr r 1 0 48 .18 4|sk b 1 350 12 .15 4|
blazekick|fl f 5 220 8 .35 1,ar c 1 200 12 .3 3|fl r 8 200 8 .5 1,ar o 2 0 12 .35 3,gr o 1 130 6 .4 1|fl b 1 120 7 .4 1|
zenheadbutt|gr o 1 90 5 .4 2,dt i 6 0 4 .3 2|gr o 1 150 6 .5 2,ar o 6 60 8 .5 2,st r 6 150 5 .4 3|gl b 1 0 10 .3 2|
skyuppercut|sk u 6 300 14 .3 4|sk u 8 400 14 .3 4,pf u 6 120 9 .6 4,gr o 1 90 5 .35 4|sk b 1 250 12 .2 4|
accelerock|pl b 4 200 3 .3 1|pl r 8 260 3 .5 1 600,sk l 5 350 10 .15 4,gr o 1 100 5 .3 1|pl b 1 150 3 .4 1 200,sk b 1 400 10 .15 4|
ironhead|sp c 6 220 2 .3 3|gr o 1 130 6 .4 4,sh r 8 240 3 .5 2 600,cr r 1 0 50 .2 4|sp b 1 120 2 .3 3|
doubleedge|sk b 6 280 12 .25 4|gr o 1 160 7 .45 4,gr o 1 100 5 .3 3 0 .06,st r 10 220 5 .5 3|sk b 1 300 12 .2 4,pf b 1 60 8 .3 4|
quickattack|sk b 5 420 12 .15 4|sk r 6 320 10 .15 4,st c 5 220 4 .35 3|sk b 1 450 10 .12 4|
shadowsneak|sm b 6 80 12 .6 5|sm u 6 60 12 .7 5,dt i 8 0 4 .35 1,gr o 1 90 5 .4 1|sm b 1 40 12 .5 5|
aquatail|bu c 6 200 5 .5 2|bu o 10 100 5 .6 2 -30,ar o 3 0 12 .35 2,gr o 1 130 6 .45 2|bu b 1 60 5 .5 2|
pursuit|sp b 5 220 2 .3 5|sk l 4 320 12 .2 5,dt i 6 0 4 .3 5,gr o 1 90 5 .3 0|sp b 1 160 2 .3 5|
irontail|sp c 5 200 2 .3 3|ar o 2 0 14 .35 3,sh r 8 240 3 .5 2 600,gr o 1 120 6 .4 4|sp b 1 100 2 .3 3,pl b 1 60 3 .3 1 200|
nightslash|ar c 3 240 10 .3 5|ar x 4 0 11 .3 5,cr r 1 0 52 .2 3,sk l 4 320 14 .18 1|sk b 1 320 12 .15 5|
crosschop|ar x 4 0 8 .3 3|cr r 2 0 56 .25 3,ar x 4 0 12 .3 3,gr o 1 100 5 .3 3|sk b 1 280 10 .15 3|
leafblade|lf c 6 200 4 .5 2|lf r 10 190 4 .7 2 60,ar x 3 0 10 .3 2,gr o 1 90 5 .3 2|lf b 1 80 4 .5 2|
sacredsword|gl r 1 80 14 .3 3,sk c 4 260 14 .25 3|cr r 1 0 70 .3 3,sk f 8 300 16 .25 3,st u 6 120 5 .7 3 -20|st b 1 70 4 .5 3|
behemothblade|sp c 6 200 2 .3 3,gl r 1 90 16 .3 1|gr o 1 170 7 .5 1,cr r 1 0 76 .3 3,sh r 8 250 4 .6 1 600,sm o 4 60 14 .8 0|sp b 1 100 2 .3 3|
psychocut|ar f 4 220 8 .3 2|ar x 4 0 10 .3 2,gr o 1 90 5 .3 2||
extremespeed|sk b 8 480 14 .15 4|sk r 10 380 12 .15 4,gr o 1 140 5 .3 4,st r 6 220 4 .4 3|sk b 2 500 12 .12 4|
aquajet|bu b 6 200 5 .5 2|bu o 10 140 5 .6 2 -20,gr o 1 120 6 .4 2|bu b 1 140 5 .5 2,pf b 1 80 8 .3 4|
poisonjab|dt c 5 200 4 .4 1|bu r 8 100 5 .6 1 -20,dt u 6 120 4 .5 3,sm o 4 40 11 .8 1,gr o 1 90 5 .4 1|dt b 1 70 4 .4 1 -10|
drillpeck|ar s 6 0 8 .4 4,sk c 4 250 12 .2 4|ar s 8 0 9 .5 3,pl r 6 220 3 .45 1 500,gr o 1 100 5 .3 4|ar s 1 0 8 .3 4|
megahorn|sk c 5 300 14 .25 2|sh f 8 300 5 .5 2,gr o 1 140 6 .45 2,cr r 1 0 56 .25 4|sp b 1 120 2 .3 2|
flamewheel|fl o 10 160 8 .4 1|fl r 10 220 8 .5 1,gr o 1 120 6 .45 1|fl s 1 120 9 .5 1,sp s 1 200 2 .3 3|
phantomforce|dt s 8 90 4 .5 1|dt i 10 0 4 .5 1,gr o 1 130 6 .5 1,sm o 6 60 12 .8 5|dt s 1 60 4 .5 1|
uturn|ar s 4 0 9 .4 1|ar s 6 0 9 .5 2,gr o 1 100 5 .35 2|ar b 1 80 9 .35 1|
gyroball|ar s 5 0 9 .4 3|sp o 14 260 2 .4 3,gr o 1 120 6 .4 4,ar s 4 0 9 .5 3|sp s 1 140 2 .3 3|
darkvoid|dt i 14 0 5 .5 5,gl r 1 100 20 .5 5|dt i 14 0 5 .6 5,gr o 1 180 7 .6 5,sm o 8 60 16 1.1 5||
bravebird|pf b 5 100 9 .4 4|pf r 10 180 9 .5 4,gr o 1 170 7 .5 4,sk r 8 330 12 .2 2|pf b 1 80 9 .4 4,sk b 1 330 12 .2 4|
aerialace|sk b 6 360 14 .2 4|sk l 5 360 12 .15 4,ar x 3 0 10 .3 2|sk b 1 380 12 .15 4|
wingattack|pf c 6 140 9 .4 4|ar o 6 70 9 .4 4,pf r 6 130 8 .5 4,gr o 1 110 6 .35 4|pf b 1 70 9 .4 4|
steelwing|sp f 6 200 2 .3 3,sh c 2 200 3 .3 4|sh f 8 280 3 .45 3,gr o 1 110 5 .35 3,sp r 8 260 2 .3 4|sp b 1 110 2 .3 3|
gust|pf c 5 150 8 .4 4|ar o 6 80 8 .5 4,pf o 8 110 9 .6 4|pf b 1 40 8 .5 4|
fairywind|st c 5 150 4 .5 2|st o 8 90 5 .6 2,gr o 1 100 5 .45 2|st b 1 50 4 .6 2|
sacredfire|fl c 6 200 8 .4 1,ar c 2 200 12 .3 3|fl u 8 150 8 .6 1,ar o 4 60 12 .5 3,gr o 1 140 6 .5 1|fl b 1 50 8 .5 1,sp b 1 90 2 .4 3|
oblivionwing||st i 8 0 4 .4 1,gr o 1 110 5 .4 1,dt u 6 100 4 .7 1 -30|dt b 1 50 4 .6 1|
esperwing|ar f 3 200 8 .3 2|ar o 4 70 9 .4 2,st r 8 180 4 .5 3||
silverwind|sp o 6 140 2 .5 4|sp o 10 150 2 .6 4,pf o 6 70 8 .6 4|sp b 1 60 2 .5 4|
wildcharge|bo c 5 40 0 .18 3|bo r 8 70 0 .22 3,gr o 1 140 6 .4 3,sp r 10 300 2 .35 3|bo r 1 40 0 .14 3|
volttackle|bo r 4 40 0 .15 3,gl r 1 100 16 .3 3|bo r 10 90 0 .25 3,gr o 1 180 7 .5 3,gl r 1 120 20 .3 2|bo r 2 50 0 .14 3,sp b 1 200 2 .3 3|S
fusionbolt|bo c 5 40 0 .18 3,fl c 3 150 7 .4 1|bo r 6 70 0 .22 3,fl r 6 160 7 .5 1,gr o 1 130 6 .4 1|bo r 1 40 0 .14 3,fl b 1 50 7 .4 1|
discharge|bo o 8 50 0 .18 3|bo o 8 100 0 .25 3,gr o 1 140 6 .4 3||
electroball||bo r 6 60 0 .2 3,gr o 1 110 5 .4 3,gl r 1 100 18 .3 3|sp b 1 60 2 .3 3|
psyshock||gr o 1 120 6 .45 2,gr o 1 70 4 .3 3,dt o 8 80 4 .6 2|dt b 1 40 4 .5 2|
psychoboost|gl r 1 120 18 .5 2,dt i 8 0 4 .4 2|gr o 1 180 8 .6 2,st r 10 200 5 .5 3,gl r 1 140 22 .4 2|dt b 1 60 4 .5 2,sp b 1 100 2 .3 3|S
iceshard||sh r 8 220 3 .5 2 600,fk r 4 70 3 .6 4|fk b 1 50 3 .5 2|
powergem||sh f 10 260 4 .5 2 500,st r 6 150 5 .5 3,gr o 1 110 5 .4 2|st b 1 50 4 .5 2|
muddywater|pf o 8 120 9 .5 1,bu o 6 90 5 .6 2|bu o 10 110 5 .7 1 -10,gr o 1 160 7 .55 1,sm o 6 70 12 .8 1||
forcepalm|gr o 1 80 5 .3 1,ar c 3 200 9 .3 4|gr o 1 160 7 .4 4,cr r 1 0 56 .2 4,sk o 8 250 12 .2 1||
petaldance|lf o 10 90 4 .8 2,st o 4 80 4 .5 3|lf s 12 120 4 .9 2,gr o 1 150 6 .5 2||
glaciate|fk o 10 120 4 .6 2|sh u 10 260 4 .8 2 600,gr o 1 160 7 .5 2,fk o 8 80 4 .9 4||
precipiceblades||pl u 10 340 6 .6 1 900,sh f 6 200 5 .5 3,gr o 1 130 6 .45 1,cx o 6 70 0 1.2 5||
bulldoze||pl r 10 220 5 .6 1 600,sm o 8 100 15 .9 0,gr o 1 160 7 .5 1||
ancientpower|sh i 8 0 4 .4 1,gl r 1 100 16 .4 1|pl u 10 200 5 .8 1,gr o 1 140 7 .5 1,st o 6 80 5 .7 3||
extrasensory|gr o 1 120 5 .5 2,gr o 1 80 4 .4 2|gr o 1 100 5 .4 2,dt o 8 90 4 .6 2,ar o 4 0 8 .5 3||
bugbuzz|sp o 10 150 2 .5 2,ar o 3 0 8 .4 2|sp s 12 180 2 .6 2,gr o 1 130 6 .4 2||
nightdaze|dt i 8 0 4 .4 5,gr o 1 100 5 .5 5|sm o 8 90 14 .9 5,gr o 1 160 7 .55 5,dt r 8 120 4 .5 1||
boomburst|gr o 1 100 5 .4 4,gr o 1 160 6 .5 4|gr o 1 220 8 .7 4,gr o 1 140 6 .5 3 0 .08,pf o 10 160 11 .7 4,ar o 6 0 9 .5 3||S
dazzlinggleam|st o 8 110 5 .5 3,gl r 1 100 18 .4 2|st r 12 220 5 .6 3,gr o 1 160 7 .5 2,cr r 1 0 70 .25 3||
mistyexplosion|sm o 8 100 13 .7 2|sm o 10 130 15 1 2,st u 8 90 4 .8 3 -20,gr o 1 180 8 .6 2||
watershuriken||st r 6 160 5 .4 3,gr o 1 90 5 .3 2,bu o 6 80 4 .5 2|bu b 1 40 4 .4 2|
triattack|st o 3 80 5 .4 1,st o 3 80 5 .4 2|fl r 4 150 7 .4 1,bo r 4 55 0 .2 3,fk r 4 100 3 .5 2,gr o 1 120 6 .4 4||
frostbreath|fk c 10 220 4 .5 2|fk r 10 110 4 .7 4,gr o 1 90 5 .4 2||
acidspray|bu c 8 220 5 .5 1|bu r 8 120 5 .6 1 -10,sm o 4 40 10 .8 1||
mudshot|bu c 6 200 5 .5 1|pl u 8 160 4 .6 1 700,sm o 4 40 11 .8 1,gr o 1 90 5 .3 1|bu b 1 40 6 .4 1|
pinmissile|sh c 6 330 3 .4 2|sh r 6 210 3 .45 2,gr o 1 80 4 .25 2|sp b 1 80 2 .3 2|
rockblast|pl c 5 240 5 .4 1|pl r 10 220 5 .6 1 700,sm o 4 60 11 .7 0,gr o 1 110 6 .4 1|pl b 1 60 4 .4 1 300|
astralbarrage|dt c 8 220 4 .4 1,st c 4 180 4 .5 3|dt o 8 100 4 .7 1,st r 8 170 5 .5 3,gr o 1 120 6 .45 1|dt b 1 50 4 .6 1,st b 1 60 3 .4 3|
hex||dt i 8 0 4 .4 1,gr o 1 110 5 .4 1,sm u 4 50 11 .8 5|dt b 1 40 4 .6 1|
highhorsepower|pl b 5 200 4 .4 1 400|pl u 10 280 5 .7 1 900,sm o 6 80 14 .8 0,gr o 1 150 7 .5 1|pl b 1 100 4 .5 1 400|S
headsmash|gl r 1 90 14 .3 1,pl c 5 220 4 .4 1|pl r 12 300 5 .7 1 900,gr o 1 190 8 .6 1,cx o 6 70 0 1.3 5,sm o 6 90 15 .9 0|pl b 1 100 4 .5 1 400,sm b 1 40 12 .5 0|S
drainingkiss||st u 6 90 5 .8 2 -30,gr o 1 90 5 .4 2|st b 1 40 4 .6 2|
swift||st r 8 180 5 .5 3,gr o 1 90 5 .3 3|st b 2 90 3 .4 3|
seismictoss||gr o 1 160 7 .5 4,cx o 6 60 0 1.1 5,pl r 8 200 4 .6 1 700||S
eruption|sm u 6 80 13 .8 1|pl u 12 360 6 .8 1 800,fl u 8 200 9 .7 1,gr o 1 190 8 .6 1||S
blastburn||fl o 12 160 9 .8 1,gr o 1 200 8 .6 1,fl u 8 200 9 .7 3||S
fusionflare|gl r 1 120 18 .5 3|gl r 1 200 28 .5 3,fl r 10 180 8 .6 1,bo r 5 80 0 .22 3,gr o 1 180 8 .5 1||
earthpower||pl u 10 300 5 .7 1 900,gl r 1 130 18 .4 2,gr o 1 140 6 .5 1||
futuresight|gr o 1 100 5 .5 2|gl r 1 140 24 .6 2,ar o 6 0 9 .6 2,st d 8 200 5 .7 3,gr o 1 170 7 .6 2||
doomdesire||gl r 1 160 24 .7 3,sh d 10 360 5 .6 3,gr o 1 190 8 .7 3,cr r 1 0 90 .3 1||
scald|pf c 6 160 9 .5 4|pf u 8 90 10 .8 4,bu u 6 100 4 .7 2 -20,gr o 1 100 5 .4 2|pf b 1 40 8 .5 4,bu b 1 30 4 .5 2|
venoshock||bu r 8 110 5 .6 1,sm o 4 40 10 .8 1,gr o 1 90 5 .35 1|bu b 1 40 5 .5 1|
waterfall|bu u 6 120 5 .6 2|bu u 10 150 5 .7 2,gr o 1 140 6 .5 2,pf o 6 110 9 .6 4|bu b 1 90 5 .5 2,pf b 1 50 8 .3 4|
flareblitz|fl c 8 220 9 .4 1,gl r 1 100 18 .4 1|fl r 12 220 9 .6 1,gr o 1 160 7 .5 1,fl u 6 160 9 .6 3|fl b 2 80 8 .5 1,sp b 1 100 2 .3 3|S
`;

const IDENT = new Map<string, Ident>();
for (const line of TABLE.split("\n")) {
  if (!line.trim()) continue;
  const [id, c, h, w, f] = line.split("|");
  IDENT.set(id!.trim(), { c: parse(c ?? ""), h: parse(h ?? ""), w: parse(w ?? ""), shake: (f ?? "").includes("S") ? 1 : 0 });
}

/** The ids that have a signature look (the audit reads this). */
export const IDENT_IDS = new Set(IDENT.keys());

type Pal = [string, string, string, string];
const colour = (pal: Pal, i: number) => (i === 4 ? "#ffffff" : i === 5 ? "#150a22" : pal[i] ?? pal[1]);

/** Put a layer's particles into the world. `ang` is the direction the move is travelling (or facing). */
function lay(c: SpecCtx, L: Layer, x: number, y: number, ang: number, pal: Pal, k: number) {
  const n = Math.max(1, Math.round(L.n * k));
  const go = () => {
    const col = colour(pal, L.col);
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    for (let i = 0; i < n; i++) {
      let px = x, py = y, vx = 0, vy = 0, a = rnd(0, TAU), rot = rnd(0, 6), vr = rnd(-8, 8);
      const s = L.spd;
      switch (L.pat) {
        case "c": a = ang + rnd(-0.55, 0.55); vx = Math.cos(a) * s * rnd(0.5, 1); vy = Math.sin(a) * s * rnd(0.5, 1); break;
        case "u": vx = rnd(-0.4, 0.4) * s; vy = -s * rnd(0.6, 1); px += rnd(-14, 14); break;
        case "i": { const R = rnd(30, 52); px = x + Math.cos(a) * R; py = y + Math.sin(a) * R * 0.8; vx = (-Math.cos(a) * R) / L.life; vy = (-Math.sin(a) * R * 0.8) / L.life; break; }
        case "o": a = (i / n) * TAU + rnd(-0.1, 0.1); px = x + Math.cos(a) * 6; py = y + Math.sin(a) * 5; vx = Math.cos(a) * s; vy = Math.sin(a) * s * 0.75; break;
        case "l": { const t = (i / n - 0.5) * 70; px = x + ux * t + nx * rnd(-12, 12); py = y + uy * t + ny * rnd(-12, 12); vx = ux * s; vy = uy * s; break; }
        case "s": a = (i / n) * TAU; px = x + Math.cos(a) * 12; py = y + Math.sin(a) * 9; vx = Math.cos(a + 1.5) * s + Math.cos(a) * s * 0.4; vy = (Math.sin(a + 1.5) * s + Math.sin(a) * s * 0.4) * 0.8; break;
        case "f": a = ang + (n > 1 ? i / (n - 1) - 0.5 : 0) * 2.2; vx = Math.cos(a) * s; vy = Math.sin(a) * s; break;
        case "d": px = x + rnd(-34, 34); py = y - rnd(60, 110); vy = s; break;
        case "b": vx = -ux * s * rnd(0.5, 1) + rnd(-30, 30); vy = -uy * s * rnd(0.5, 1) + rnd(-30, 30); break;
        case "x": a = ang + Math.PI / 4 + (i % 4) * (Math.PI / 2); vx = Math.cos(a) * 40; vy = Math.sin(a) * 40; rot = a; vr = 5; break;
        default: vx = Math.cos(a) * s * rnd(0.4, 1); vy = Math.sin(a) * s * rnd(0.4, 1);
      }
      const p: SP = { kind: L.kind, x: px, y: py, vx, vy, g: L.g, life: L.life * rnd(0.85, 1.15), size: L.size * rnd(0.8, 1.2), color: col, rot, vr };
      if (L.kind === "gring") { p.y = y + 6; p.vx = 0; p.vy = 0; p.size = 6; p.grow = L.spd / L.life; p.life = L.life; }
      else if (L.kind === "glow") { p.vx = 0; p.vy = 0; p.grow = L.spd; }
      else if (L.kind === "cross") { p.vx = 0; p.vy = 0; p.size = L.size; p.life = L.life; }
      else if (L.kind === "crack") { const len = L.spd * rnd(0.5, 1); p.vx = 0; p.vy = 0; p.x2 = x + Math.cos(a) * len; p.y2 = y + Math.sin(a) * len * 0.7; p.x = x; p.y = y + 4; p.color = "#000"; p.seed = Math.floor(rnd(1, 90)); }
      else if (L.kind === "bolt") { const len = rnd(24, 60) + L.spd * 0.3; p.vx = 0; p.vy = 0; p.x2 = x + Math.cos(a) * len; p.y2 = y + Math.sin(a) * len * 0.8; p.seed = Math.floor(rnd(1, 99)); }
      else if (L.kind === "arc") { p.rot = L.pat === "x" ? a : L.pat === "o" || L.pat === "s" ? a : ang + rnd(-0.6, 0.6); p.vr = L.pat === "s" ? 7 : 3; p.size = L.size; }
      c.add(p);
    }
  };
  if (L.delay > 0) c.later(L.delay, go); else go();
}

const thin = (c: SpecCtx) => (c.load > 0.75 ? 0.5 : 1);

/** The cast flourish, or false when this move has no signature look. */
export function identCast(id: string, pal: Pal, x: number, y: number, dir: number, c: SpecCtx): boolean {
  const e = IDENT.get(id);
  if (!e || !e.c.length) return false;
  c.add({ kind: "glow", x, y, life: 0.22, size: 8, grow: 46, color: pal[1] });
  for (const L of e.c) lay(c, L, x, y, dir, pal, thin(c));
  return true;
}

/** The impact, or false when this move has no signature look. */
export function identHit(id: string, pal: Pal, x: number, y: number, heavy: boolean, ang: number, c: SpecCtx): boolean {
  const e = IDENT.get(id);
  if (!e || !e.h.length) return false;
  for (const L of e.h) lay(c, L, x, y, ang, pal, (heavy ? 1.4 : 1) * thin(c));
  if (e.shake && heavy) c.shake(3, 0.16);
  return true;
}

/** The blast of a move that used to borrow another move's explosion: its own hit layers, bigger and wider to fit the blast radius. */
export function identBoom(id: string, pal: Pal, x: number, y: number, r: number, c: SpecCtx): boolean {
  const e = IDENT.get(id);
  if (!e || !e.h.length) return false;
  const k = Math.min(2.2, Math.max(1, r / 70));
  for (const L of e.h) lay(c, { ...L, n: Math.round(L.n * 1.3), spd: L.spd * k, size: L.size * Math.min(1.6, k) }, x, y, 0, pal, thin(c));
  c.shake(Math.min(8, 2 + r / 30), 0.2);
  return true;
}

export const hasWake = (id: string) => (IDENT.get(id)?.w.length ?? 0) > 0;

/** The wake behind a dash or a shot, or false when this move has no signature look. */
export function identWake(id: string, pal: Pal, x: number, y: number, ang: number, c: SpecCtx): boolean {
  const e = IDENT.get(id);
  if (!e || !e.w.length) return false;
  for (const L of e.w) lay(c, L, x, y, ang, pal, thin(c));
  return true;
}
