/**
 * A visual identity for every move. Each move gets a "motif" (the shape language of its art: slashing crescents,
 * claw rakes, fist shock-bursts, vortices, crystal sprays, lightning, gas clouds, rock chunks, feathers, droplets…), a
 * colour variant of its type and a surface texture. The motif decides what the move looks like at three moments:
 *   - the cast (a muzzle flourish and a mark on the floor under the caster),
 *   - the flight (projectile bodies and the trail behind them / behind a dash),
 *   - the impact (a motif-specific burst and a textured mark left on the floor).
 * Built to the layered recipe the reference sheets use: ground decal + core + trail ribbon + particles + shock ring + glow.
 * The renderer owns the particle list; this module only asks for particles through `SpecCtx` and draws shot bodies.
 */
import type { MoveDef } from "@/lib/pokemon/arena-data";
import type { SpecCtx, SP } from "./arena-spec";
import { texPat, typeTex, type TexKind } from "./arena-tex";
import { layeredBurst, layeredCast, layeredHit } from "./arena-layers";

export type Motif =
  | "orb" | "blade" | "claw" | "fist" | "kick" | "wave" | "vortex" | "beam" | "spike" | "cloud" | "bolt" | "flame"
  | "rock" | "leaf" | "drop" | "star" | "sonic" | "wing" | "drill" | "tail" | "gem" | "wisp" | "bomb" | "rune";

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

/* ------------------------------------------------------------------ colours */

type Pal = [string, string, string, string]; // dark, mid, light, core
const PAL: Record<string, Pal[]> = {
  Fire: [["#a02608", "#ff5a1a", "#ffb02e", "#fff3b0"], ["#5a0a1a", "#d41e3c", "#ff6a4a", "#ffd0c0"], ["#b8680a", "#ffc83a", "#fff08a", "#ffffff"]],
  Water: [["#12408a", "#2f86e0", "#79c8ff", "#e6f6ff"], ["#0a4a5a", "#18a8b8", "#6adfe0", "#e0ffff"], ["#0a1030", "#26407a", "#6a8ad0", "#d8e4ff"]],
  Electric: [["#a8780a", "#ffd21a", "#fff07a", "#ffffff"], ["#2a40b0", "#6aa0ff", "#c0dcff", "#ffffff"], ["#5a1a9a", "#c07aff", "#fff07a", "#ffffff"]],
  Grass: [["#1d5a24", "#3fae48", "#9be06a", "#f0ffc8"], ["#4a6a10", "#9acd32", "#d8f080", "#fffff0"], ["#0f3a30", "#2a8a64", "#7ad0a0", "#e0fff0"]],
  Ice: [["#2a78b0", "#7ad0f0", "#c8f0ff", "#ffffff"], ["#6a86b8", "#c0d6f0", "#f0f8ff", "#ffffff"], ["#4a3a9a", "#9a8af0", "#d8d0ff", "#ffffff"]],
  Fighting: [["#8a2010", "#e0502a", "#ffa04a", "#fff0d0"], ["#7a5a10", "#d8a82a", "#ffe07a", "#fffbe0"], ["#4a5a6a", "#a8b8c8", "#e8f0f8", "#ffffff"]],
  Poison: [["#4a1478", "#9a3ad8", "#d08aff", "#f6e0ff"], ["#1d6a10", "#5ac22a", "#b0f06a", "#f0ffd0"], ["#6a0a4a", "#d03a9a", "#ff8ad0", "#ffe0f4"]],
  Ground: [["#5a3a1a", "#a8763a", "#dcb070", "#f6e6c0"], ["#7a5a10", "#c89a2a", "#f0cc6a", "#fff4c0"], ["#4a4038", "#8a8074", "#c4baa8", "#f0ece0"]],
  Flying: [["#6a86b0", "#b0cae8", "#e8f2ff", "#ffffff"], ["#2a8a90", "#5ac8c8", "#b0f0f0", "#ffffff"], ["#6a7080", "#b0b8c8", "#e8ecf4", "#ffffff"]],
  Psychic: [["#8a1a70", "#ff5ac0", "#ffb0e4", "#fff0fa"], ["#4a2a9a", "#9a6aff", "#d0baff", "#f6f0ff"], ["#1a6a9a", "#4ac8f0", "#b0ecff", "#f0ffff"]],
  Bug: [["#4a6a10", "#9ac22a", "#d0ea6a", "#f6ffd0"], ["#8a6a0a", "#e0b82a", "#fff07a", "#fffff0"], ["#5a3a10", "#c07a2a", "#f0b060", "#fff0d8"]],
  Rock: [["#5a4a30", "#a08a60", "#d8c496", "#f6ecd0"], ["#4a4a54", "#8a8a98", "#c8c8d8", "#f0f0f8"], ["#7a4a10", "#d0902a", "#ffd070", "#fff4d0"]],
  Ghost: [["#2a1450", "#6a3ac0", "#b08aff", "#ece0ff"], ["#141a4a", "#3a4ac0", "#8a9aff", "#e0e6ff"], ["#0a3a40", "#2a9a9a", "#7adcd0", "#e0fffa"]],
  Dragon: [["#2a2a8a", "#5a6aff", "#9ad0ff", "#f0f8ff"], ["#4a1a80", "#9a4aff", "#ffd05a", "#fff6d8"], ["#7a1a2a", "#e0405a", "#6ac0ff", "#f0f0ff"]],
  Dark: [["#120a22", "#5a3a8a", "#a07ad0", "#e4d8f8"], ["#2a0a10", "#8a1a2a", "#e0506a", "#ffd8e0"], ["#0a0a2a", "#2a3a7a", "#6a80d0", "#e0e8ff"]],
  Steel: [["#4a566a", "#9aa8be", "#dce4f0", "#ffffff"], ["#6a4a2a", "#c0905a", "#f0d0a0", "#fff4e0"], ["#2a5a6a", "#5aa8c0", "#b0e4f4", "#f0ffff"]],
  Fairy: [["#a83a78", "#ff8ac8", "#ffd0ec", "#fff6fc"], ["#6a4a9a", "#c0a0ff", "#ece0ff", "#ffffff"], ["#9a7a2a", "#ffd86a", "#fff0b0", "#ffffff"]],
  Normal: [["#6a6a74", "#b8b8c8", "#eaeaf2", "#ffffff"], ["#7a6a4a", "#cdb98a", "#f0e4c4", "#fffaf0"], ["#7a6a7a", "#d0b0d8", "#f4e4f8", "#ffffff"]],
};

/* ------------------------------------------------------------------ the motif of every move */

/** "id:motif" or "id:motif:colourVariant (0-2)". Moves not listed fall back to a motif chosen from their kind and name. */
const TABLE = `
flamethrower:flame flamewheel:vortex firepunch:fist:1 flareblitz:flame:1 blazekick:kick fireblast:bomb willowisp:wisp heatwave:wave overheat:beam:1 eruption:rock sacredfire:wing:2 blastburn:bomb:1 fusionflare:orb:2 firespin:vortex:1
waterpulse:orb surf:wave hydropump:beam aquatail:tail aquajet:drill waterfall:drop:1 scald:cloud:1 watershuriken:star:2 muddywater:wave:2 originpulse:vortex:1 waterspout:vortex whirlpool:vortex:1 hydrocannon:bomb bubblebeam:drop
razorleaf:leaf leafblade:blade:1 leafstorm:leaf:1 solarbeam:beam:2 energyball:orb:1 gigadrain:wisp:1 woodhammer:fist:2 seedbomb:bomb spore:cloud stunspore:cloud:1 sleeppowder:cloud:2 petaldance:leaf:2 frenzyplant:spike aromatherapy:star:1 synthesis:leaf:2
thundershock:bolt thunderbolt:bolt:1 thunder:bolt:2 shockwave:wisp:1 chargebeam:beam nuzzle:star spark:star:1 thunderpunch:fist wildcharge:vortex volttackle:vortex:1 electroball:orb discharge:bolt:1 zapcannon:beam:1 fusionbolt:bolt:2 plasmafists:fist:2 boltstrike:bolt thunderwave:wave:1
powdersnow:cloud iceshard:gem icebeam:beam glaciate:spike:1 iciclecrash:spike blizzard:cloud:1 icepunch:fist frostbreath:cloud:2 freezedry:beam:1
aurasphere:orb:2 closecombat:fist:1 dynamicpunch:fist:1 crosschop:blade:2 drainpunch:fist:2 superpower:fist:1 sacredsword:blade:1 skyuppercut:kick:1 forcepalm:wave:1 machpunch:fist bulkup:star:1 brickbreak:fist:2 focusblast:bomb:2
toxic:cloud sludgebomb:bomb venoshock:drop:2 poisonjab:drill acidspray:drop:1 sludgewave:wave gunkshot:bomb:2
earthquake:wave:1 earthpower:spike dig:rock:1 bulldoze:rock bulldozeX:rock precipiceblades:spike:1 mudshot:drop:2 highhorsepower:rock:2 drillrun:drill shoreup:star
gust:wing airslash:blade aerialace:wing:1 bravebird:wing:2 hurricane:vortex dragonascent:wing dragonascentX:wing skyattack:wing:1 aeroblast:beam drillpeck:drill:1 wingattack:wing:2 oblivionwing:wing roost:wing
psyshock:orb psybeam:beam futuresight:rune psychic:sonic extrasensory:sonic:1 psychocut:blade:1 photongeyser:beam:2 prismaticlaser:beam esperwing:wing:1 psychoboost:orb:1 zenheadbutt:kick:1 psystrike:orb:2 psywave:sonic:2 hypnosis:sonic:1 calmmind:rune:2
bugbuzz:sonic:2 uturn:vortex:2 megahorn:drill:1 signalbeam:beam:1 lunge:claw:1 silverwind:wing:2 pinmissile:spike:2 xscissor:blade:2 quiverdance:star:2
powergem:gem:1 rockblast:rock:1 headsmash:rock:2 ancientpower:rock:1 diamondstorm:gem rocktomb:rock stoneedge:gem:2 rockslide:rock accelerock:kick:2 meteormash:fist:1
hex:wisp:1 poltergeist:rune:1 spectralthief:claw:2 shadowforce:vortex:1 astralbarrage:wisp:2 moongeistbeam:beam:1 shadowclaw:claw shadowball:orb shadowsneak:tail:2 phantomforce:vortex confuseray:wisp:2 shadowblast:beam
dragonclaw:claw:1 dragontail:tail:1 spacialrend:blade:2 roaroftime:sonic:1 coreenforcer:beam:2 clangingscales:sonic:2 dragondance:vortex:2 dragonbreath:flame:1 eternabeam:beam:1 dragonrush:drill:1 dragonpulse:orb:1 dracometeor:bomb:1 outrage:vortex:1
foulplay:claw:1 suckerpunch:fist:1 knockoff:fist:2 nightdaze:sonic:1 nastyplot:rune:1 pursuit:tail:1 crunch:claw:2 darkpulse:sonic darkvoid:vortex:1 nightslash:blade:1
ironhead:kick:1 irontail:tail gyroball:vortex:2 doomdesire:rune:1 steelbeam:beam:1 steelwing:wing:1 behemothblade:blade bulletpunch:fist:1 flashcannon:orb:1 kingsshield:rune:2 irondefense:rune
dazzlinggleam:star playrough:claw:2 drainingkiss:star:1 fleurcannon:beam:2 lightofruin:bomb:2 mistyexplosion:cloud:2 geomancy:star:2 fairywind:wing:2 moonlight:star moonblast:orb:1
hypervoice:sonic boomburst:sonic:2 doubleedge:kick:2 gigaimpact:fist:2 judgment:rune:2 hyperbeam:beam:2 triattack:star:2 swift:star slash:claw:1 slackoff:wing:1 strength:fist:2 quickattack:tail bodyslam:fist:1 extremespeed:drill:2 swordsdance:blade:2
hiddenpower:orb:2 supersonic:sonic sing:sonic:1 doubleteam:wisp:2 agility:wing:1 recover:star:2 protect:rune:1 rest:star:2 sleepy:cloud
`;

const MOTIF = new Map<string, { m: Motif; v: number }>();
for (const tok of TABLE.split(/\s+/)) {
  if (!tok) continue;
  const [id, m, v] = tok.split(":");
  if (id && m) MOTIF.set(id, { m: m as Motif, v: Number(v ?? 0) });
}

export type Sig = { motif: Motif; pal: Pal; tex: TexKind; seed: number; rot: number; big: boolean };
const cache = new Map<string, Sig>();
/** The colours of a type (one of its three colour variants). */
export const typePal = (type: string, v = 0): Pal => {
  const a = PAL[type] ?? PAL.Normal!;
  return a[v % a.length]!;
};

const KIND_MOTIF: Record<string, Motif> = { beam: "beam", bolt: "beam", lob: "bomb", nova: "wave", dash: "fist", proj: "orb", spread: "star", homing: "wisp", par: "bolt", buff: "star", heal: "star", guard: "rune", grab: "claw", burrow: "rock" };

/** The identity of a move: computed once, the same everywhere (cast, flight, impact, aim preview). */
export function sigOf(mv: Pick<MoveDef, "id" | "type" | "kind">): Sig {
  let s = cache.get(mv.id);
  if (s) return s;
  const e = MOTIF.get(mv.id);
  const h = hash(mv.id);
  const motif = e?.m ?? KIND_MOTIF[mv.kind] ?? "orb";
  const pals = PAL[mv.type] ?? PAL.Normal!;
  const pal = pals[(e ? e.v : Math.floor(h * 3)) % pals.length]!;
  // some motifs bring their own surface: rocks are stone, claws and blades are keen like metal, gas is cloud
  let tex = typeTex(mv.type);
  if (motif === "rock") tex = "rock";
  else if (motif === "cloud") tex = mv.type === "Poison" ? "venom" : tex;
  else if ((motif === "claw" || motif === "blade") && (mv.type === "Steel" || mv.type === "Normal" || mv.type === "Dragon")) tex = "metal";
  s = { motif, pal, tex, seed: h * 1000, rot: h * TAU, big: mv.kind === "lob" || mv.kind === "nova" || mv.kind === "bolt" };
  cache.set(mv.id, s);
  return s;
}

/* ------------------------------------------------------------------ small helpers over the renderer */

type Cx = SpecCtx;
const add = (c: Cx, p: SP) => c.add(p);

/** A floor mark with a texture, laid under whatever just happened. */
function mark(c: Cx, kind: Sig["motif"], sg: Sig, x: number, y: number, r: number, life: number, ang = 0, style: "glyph" | "scar" | "splat" | "rays" | "ring" = "ring") {
  c.decal({ kind: "vfx", x, y, r: Math.min(r, 70), life: Math.min(life, style === "scar" ? 1.3 : 1.1), seed: sg.seed, ang, vfx: { style, motif: kind, pal: sg.pal, tex: sg.tex } });
}

function ringOf(c: Cx, sg: Sig, x: number, y: number, r: number, life = 0.45) {
  add(c, { kind: "gring", x, y: y + 6, life, size: 6, grow: r / life, color: sg.pal[2] });
  add(c, { kind: "gring", x, y: y + 6, life: life * 0.7, size: 3, grow: (r * 0.7) / (life * 0.7), color: sg.pal[3] });
}

/* ------------------------------------------------------------------ cast */

export function vfxCast(mv: MoveDef, e: { x: number; y: number; dir: number; tx: number; ty: number }, c: Cx) {
  const sg = sigOf(mv);
  const [dk, md, lt, core] = sg.pal;
  const ux = Math.cos(e.dir), uy = Math.sin(e.dir);
  const nx = -uy, ny = ux;
  const x = e.x + ux * 14, y = e.y + uy * 14;
  const A = (p: SP) => add(c, p);
  // every move: a glow at the muzzle and a faint mark under the caster
  A({ kind: "glow", x, y, life: 0.28, size: 10, grow: 70, color: md });
  switch (sg.motif) {
    case "blade":
    case "tail":
      for (let i = 0; i < 3; i++) A({ kind: "arc", x: x + ux * (20 + i * 12), y: y + uy * (20 + i * 12), vx: ux * 160, vy: uy * 160, life: 0.3 + i * 0.05, size: 5 + i * 1.5, rot: e.dir + rnd(-0.1, 0.1), vr: 0, color: i ? md : lt });
      for (let i = 0; i < 8; i++) A({ kind: "spark", x, y, vx: ux * rnd(120, 340) + nx * rnd(-90, 90), vy: uy * rnd(120, 340) + ny * rnd(-90, 90), life: 0.3, size: rnd(1.5, 3), color: core });
      break;
    case "claw":
      for (let k = -1; k <= 1; k++) for (let i = 0; i < 5; i++) A({ kind: "streak", x: x + ux * 10 + nx * k * 13, y: y + uy * 10 + ny * k * 13, vx: ux * 380 + nx * k * 30, vy: uy * 380 + ny * k * 30, life: 0.22, size: rnd(9, 16), color: i % 2 ? lt : core });
      break;
    case "fist":
    case "kick":
      ringOf(c, sg, x, y, 56, 0.32);
      for (let i = 0; i < 12; i++) A({ kind: "streak", x: x - ux * rnd(0, 40) + nx * rnd(-24, 24), y: y - uy * rnd(0, 40) + ny * rnd(-24, 24), vx: -ux * 300, vy: -uy * 300, life: 0.25, size: rnd(8, 16), color: i % 2 ? lt : "#ffffff" });
      A({ kind: "star", x: x + ux * 16, y: y + uy * 16, life: 0.25, size: 10, vr: 8, rot: 0, color: core });
      break;
    case "wave":
    case "sonic":
      for (let i = 0; i < 3; i++) c.later(i * 0.08, () => ringOf(c, sg, e.x, e.y, 70 + i * 26, 0.5));
      break;
    case "vortex":
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; A({ kind: "dot", x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 12, vx: Math.cos(a + 1.5) * 150 + ux * 60, vy: Math.sin(a + 1.5) * 110 + uy * 60, life: 0.5, size: rnd(2.5, 4.5), color: i % 2 ? md : lt }); }
      break;
    case "beam":
      A({ kind: "cross", x, y, life: 0.22, size: 40, color: core });
      for (let i = 0; i < 8; i++) A({ kind: "spark", x, y, vx: ux * rnd(160, 420) + rnd(-80, 80), vy: uy * rnd(160, 420) + rnd(-80, 80), life: 0.35, size: rnd(1.6, 3), color: i % 2 ? lt : core });
      break;
    case "spike":
    case "gem":
      for (let i = 0; i < 9; i++) A({ kind: "shard", x: x + ux * rnd(10, 70) + nx * rnd(-22, 22), y: y + uy * rnd(10, 70) + ny * rnd(-22, 22), vx: ux * rnd(60, 240), vy: uy * rnd(60, 240) - 60, g: 280, life: 0.55, size: rnd(3, 6), rot: rnd(0, 6), vr: rnd(-9, 9), color: i % 3 ? lt : "#ffffff" });
      break;
    case "cloud":
      for (let i = 0; i < 8; i++) A({ kind: "smoke", x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: ux * rnd(40, 150) + rnd(-25, 25), vy: uy * rnd(40, 150) + rnd(-25, 25), life: 0.8, size: rnd(8, 14), grow: 26, color: i % 2 ? md : lt });
      break;
    case "bolt":
      for (let i = 0; i < 5; i++) { const a = e.dir + rnd(-0.9, 0.9); A({ kind: "bolt", x, y, life: 0.22, color: i % 2 ? core : lt, x2: x + Math.cos(a) * rnd(40, 80), y2: y + Math.sin(a) * rnd(40, 80), seed: i * 13 + 1 }); }
      break;
    case "flame":
      for (let i = 0; i < 9; i++) A({ kind: "flame", x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: ux * rnd(60, 220) + rnd(-30, 30), vy: uy * rnd(60, 220) - rnd(20, 90), life: 0.55, size: rnd(7, 12), color: i % 2 ? lt : md });
      break;
    case "rock":
      for (let i = 0; i < 8; i++) A({ kind: "plank", x: e.x + rnd(-24, 24), y: e.y + rnd(-8, 12), vx: rnd(-60, 60), vy: rnd(-260, -120), g: 700, life: 0.8, size: rnd(4, 8), rot: rnd(0, 6), vr: rnd(-8, 8), color: i % 2 ? dk : lt });
      for (let i = 0; i < 4; i++) A({ kind: "puff", x: e.x + rnd(-20, 20), y: e.y + 12, vx: rnd(-60, 60), vy: rnd(-30, 0), life: 0.6, size: 8, grow: 22, color: "#c9b79a" });
      break;
    case "leaf":
      for (let i = 0; i < 10; i++) A({ kind: "leaf", x, y, vx: ux * rnd(80, 260) + rnd(-70, 70), vy: uy * rnd(80, 260) + rnd(-70, 70), g: 40, life: 0.8, size: rnd(3.5, 6), rot: rnd(0, 6), vr: rnd(-12, 12), color: pick([dk, md, lt]) });
      break;
    case "drop":
      for (let i = 0; i < 9; i++) A({ kind: i % 2 ? "bubble" : "dot", x, y, vx: ux * rnd(60, 220) + rnd(-60, 60), vy: uy * rnd(60, 220) + rnd(-60, 60), g: i % 2 ? -20 : 300, life: 0.7, size: rnd(2.5, 5), color: i % 2 ? lt : md });
      break;
    case "star":
      for (let i = 0; i < 10; i++) A({ kind: "star", x, y, vx: rnd(-170, 170) + ux * 60, vy: rnd(-170, 170) + uy * 60, life: 0.6, size: rnd(4, 8), vr: rnd(-6, 6), rot: 0, color: i % 3 ? lt : core });
      break;
    case "wing":
      for (let i = -1; i <= 1; i += 2) A({ kind: "arc", x: e.x + nx * i * 18, y: e.y + ny * i * 18, vx: ux * 110, vy: uy * 110, life: 0.34, size: 6, rot: e.dir + i * 0.55, vr: 0, color: lt });
      for (let i = 0; i < 8; i++) A({ kind: "puff", x: e.x + rnd(-14, 14), y: e.y + rnd(-6, 8), vx: rnd(-50, 50) - ux * 70, vy: rnd(-40, 20) - uy * 70, life: 0.5, size: 6, grow: 16, color: "#ffffff" });
      break;
    case "drill":
      for (let i = 0; i < 14; i++) { const a = i * 0.9; A({ kind: "streak", x: x + ux * i * 6 + Math.cos(a) * 10 * nx, y: y + uy * i * 6 + Math.cos(a) * 10 * ny, vx: ux * 300, vy: uy * 300, life: 0.25, size: rnd(8, 14), color: i % 2 ? lt : core }); }
      break;
    case "wisp":
      for (let i = 0; i < 6; i++) A({ kind: "dot", x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-50, 50), vy: rnd(-90, -20), g: -40, life: 0.8, size: rnd(3, 6), color: i % 2 ? lt : md });
      break;
    case "bomb":
      A({ kind: "smoke", x: e.x, y: e.y, vx: 0, vy: -30, life: 0.7, size: 12, grow: 30, color: dk });
      for (let i = 0; i < 6; i++) A({ kind: "spark", x, y, vx: ux * rnd(80, 260) + rnd(-60, 60), vy: uy * rnd(80, 260) - rnd(0, 140), g: 300, life: 0.5, size: rnd(1.8, 3.2), color: i % 2 ? lt : core });
      break;
    case "rune":
      mark(c, "rune", sg, e.x, e.y + 6, 44, 1.1, 0, "glyph");
      for (let i = 0; i < 8; i++) A({ kind: "star", x: e.x + rnd(-30, 30), y: e.y + rnd(-4, 14), vx: 0, vy: rnd(-90, -40), life: 0.8, size: rnd(3, 6), color: i % 2 ? lt : core });
      break;
    default: // orb
      ringOf(c, sg, x, y, 34, 0.3);
      for (let i = 0; i < 6; i++) A({ kind: "spark", x, y, vx: ux * rnd(80, 260) + rnd(-70, 70), vy: uy * rnd(80, 260) + rnd(-70, 70), life: 0.35, size: rnd(1.6, 3), color: i % 2 ? lt : core });
  }
  layeredCast(mv.type, e.x, e.y + 6, sg.pal, c);
}

/* ------------------------------------------------------------------ impact */

export function vfxHit(mvId: string, mv: Pick<MoveDef, "id" | "type" | "kind">, x: number, y: number, heavy: boolean, dx: number, dy: number, c: Cx) {
  const sg = sigOf(mv);
  const [dk, md, lt, core] = sg.pal;
  const A = (p: SP) => add(c, p);
  const k = heavy ? 1.5 : 1;
  const ang = Math.atan2(dy || 0.0001, dx || 0.0001);
  switch (sg.motif) {
    case "claw":
      for (let i = -1; i <= 1; i++) A({ kind: "streak", x: x + Math.cos(ang + 1.57) * i * 11 - Math.cos(ang) * 20, y: y + Math.sin(ang + 1.57) * i * 11 - Math.sin(ang) * 20, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, life: 0.2, size: 16, color: lt });
      mark(c, "claw", sg, x, y + 4, 34 * k, 2.2, ang, "scar");
      break;
    case "blade":
      A({ kind: "arc", x, y, vx: Math.cos(ang) * 40, vy: Math.sin(ang) * 40, life: 0.28, size: 8 * k, rot: ang - 0.5, vr: 4, color: lt });
      A({ kind: "cross", x, y, life: 0.2, size: 46 * k, color: core });
      mark(c, "blade", sg, x, y + 4, 38 * k, 2, ang, "scar");
      break;
    case "fist":
    case "kick":
      ringOf(c, sg, x, y, 62 * k, 0.38);
      for (let i = 0; i < 9 * k; i++) A({ kind: "star", x, y, vx: Math.cos(ang) * rnd(40, 240) + rnd(-180, 180), vy: Math.sin(ang) * rnd(40, 240) + rnd(-180, 180), life: 0.45, size: rnd(4, 8), vr: 8, rot: 0, color: i % 2 ? lt : core });
      if (heavy) mark(c, "fist", sg, x, y + 6, 44, 1.6, 0, "splat");
      break;
    case "wave":
    case "sonic":
      for (let i = 0; i < 2; i++) c.later(i * 0.07, () => ringOf(c, sg, x, y, 70 + i * 30, 0.5));
      break;
    case "vortex":
      for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; A({ kind: "dot", x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 8, vx: Math.cos(a + 1.5) * 150, vy: Math.sin(a + 1.5) * 110 - 30, life: 0.5, size: rnd(2.5, 4.5), color: i % 2 ? md : lt }); }
      break;
    case "beam":
      A({ kind: "glow", x, y, life: 0.3, size: 12, grow: 80, color: md });
      for (let i = 0; i < 10; i++) A({ kind: "spark", x, y, vx: rnd(-240, 240), vy: rnd(-240, 240), life: 0.35, size: rnd(1.6, 3), color: i % 2 ? lt : core });
      mark(c, "beam", sg, x, y + 4, 28 * k, 1.6, 0, "rays");
      break;
    case "spike":
    case "gem":
      for (let i = 0; i < 10 * k; i++) A({ kind: "shard", x, y, vx: rnd(-240, 240), vy: rnd(-340, -60), g: 620, life: 0.7, size: rnd(3, 6), rot: rnd(0, 6), vr: rnd(-10, 10), color: i % 3 ? lt : "#ffffff" });
      mark(c, "spike", sg, x, y + 6, 40 * k, 2.4, 0, "rays");
      break;
    case "cloud":
      for (let i = 0; i < 8 * k; i++) A({ kind: "smoke", x: x + rnd(-12, 12), y: y + rnd(-8, 8), vx: rnd(-50, 50), vy: rnd(-60, -10), life: 1, size: rnd(9, 15), grow: 24, color: i % 2 ? md : lt });
      mark(c, "cloud", sg, x, y + 6, 44 * k, 2.6, 0, "splat");
      break;
    case "bolt":
      for (let i = 0; i < 6; i++) { const a = rnd(0, TAU); A({ kind: "bolt", x, y, life: 0.22, color: i % 2 ? core : lt, x2: x + Math.cos(a) * rnd(30, 60 * k), y2: y + Math.sin(a) * rnd(24, 50 * k), seed: i * 11 + 5 }); }
      c.scorch(x, y + 6, 26 * k, mv.type);
      break;
    case "flame":
    case "bomb":
      for (let i = 0; i < 8 * k; i++) A({ kind: "flame", x: x + rnd(-10, 10), y: y + rnd(-4, 8), vx: rnd(-70, 70), vy: rnd(-200, -80), life: rnd(0.5, 0.9), size: rnd(8, 14), color: i % 2 ? lt : md });
      for (let i = 0; i < 8; i++) A({ kind: "spark", x, y, vx: rnd(-260, 260), vy: rnd(-300, -40), g: 360, life: 0.8, size: rnd(1.8, 3.2), color: i % 2 ? core : lt });
      c.scorch(x, y + 6, 32 * k, mv.type);
      break;
    case "rock":
      for (let i = 0; i < 9 * k; i++) A({ kind: "plank", x: x + rnd(-14, 14), y, vx: rnd(-170, 170), vy: rnd(-330, -90), g: 760, life: 0.9, size: rnd(4, 9), rot: rnd(0, 6), vr: rnd(-8, 8), color: i % 2 ? dk : lt });
      for (let i = 0; i < 4; i++) A({ kind: "puff", x: x + rnd(-16, 16), y: y + 6, vx: rnd(-70, 70), vy: rnd(-40, 0), life: 0.7, size: 9, grow: 24, color: "#c9b79a" });
      mark(c, "rock", sg, x, y + 8, 42 * k, 2.4, 0, "splat");
      break;
    case "leaf":
      for (let i = 0; i < 12 * k; i++) A({ kind: "leaf", x, y, vx: rnd(-230, 230), vy: rnd(-260, 40), g: 140, life: 1, size: rnd(3.5, 6.5), rot: rnd(0, 6), vr: rnd(-12, 12), color: pick([dk, md, lt]) });
      break;
    case "drop":
      for (let i = 0; i < 12 * k; i++) A({ kind: i % 3 ? "dot" : "bubble", x, y, vx: rnd(-200, 200), vy: rnd(-300, -60), g: 640, life: 0.8, size: rnd(2.5, 5.5), color: i % 2 ? lt : md });
      mark(c, "drop", sg, x, y + 6, 36 * k, 2.4, 0, "splat");
      break;
    case "star":
      for (let i = 0; i < 12 * k; i++) A({ kind: "star", x, y, vx: rnd(-220, 220), vy: rnd(-220, 220), life: 0.7, size: rnd(4, 8), vr: rnd(-6, 6), rot: 0, color: i % 3 ? lt : core });
      break;
    case "wing":
      A({ kind: "arc", x, y, life: 0.3, size: 7 * k, rot: ang - 0.4, vr: 5, color: lt });
      for (let i = 0; i < 8; i++) A({ kind: "puff", x: x + rnd(-10, 10), y: y + rnd(-8, 8), vx: rnd(-100, 100), vy: rnd(-70, 30), life: 0.6, size: 6, grow: 18, color: "#ffffff" });
      ringOf(c, sg, x, y, 46 * k, 0.3);
      break;
    case "drill":
      for (let i = 0; i < 12; i++) { const a = ang + rnd(-0.7, 0.7); A({ kind: "spark", x, y, vx: Math.cos(a) * rnd(100, 340), vy: Math.sin(a) * rnd(100, 340), life: 0.4, size: rnd(1.8, 3.4), color: i % 2 ? lt : core }); }
      mark(c, "drill", sg, x, y + 6, 30 * k, 1.8, ang, "scar");
      break;
    case "wisp":
      for (let i = 0; i < 8; i++) A({ kind: "dot", x: x + rnd(-12, 12), y: y + rnd(-6, 10), vx: rnd(-40, 40), vy: rnd(-130, -40), g: -60, life: 0.9, size: rnd(3, 6), color: i % 2 ? lt : md });
      break;
    case "rune":
      mark(c, "rune", sg, x, y + 6, 44 * k, 1.8, 0, "glyph");
      A({ kind: "glow", x, y, life: 0.4, size: 12, grow: 90, color: md });
      break;
    default: // orb
      ringOf(c, sg, x, y, 48 * k, 0.4);
      A({ kind: "glow", x, y, life: 0.3, size: 10, grow: 70, color: lt });
      for (let i = 0; i < 8 * k; i++) A({ kind: "spark", x, y, vx: rnd(-260, 260), vy: rnd(-260, 260), life: 0.4, size: rnd(1.8, 3.2), color: i % 2 ? lt : core });
  }
  impactFx(sg, x, y, k, c);
  // a heavy hit also gets the quick layers of its type: a flash, a shockwave and a few flying pieces
  if (heavy) layeredBurst(mv.type, x, y, 46 * k, "core", sg.pal, c);
  else layeredHit(mv.type, x, y, dx, dy, sg.pal, c);
}

/** Extra flavour for every impact, chosen by the move's texture: a handful of particles that look like the element
 *  (stone chips and dust, ice shards and snow, water droplets and mist, embers and sparks, leaves, venom bubbles,
 *  lightning forks, shadow wisps). Kept small so the move's own animation stays readable. */
function impactFx(sg: Sig, x: number, y: number, k: number, c: Cx) {
  const [dk, md, lt, core] = sg.pal;
  const A = (p: SP) => add(c, p);
  const n = Math.round(6 * k);
  switch (sg.tex) {
    case "rock": case "sand": case "metal":
      for (let i = 0; i < n; i++) A({ kind: "plank", x: x + rnd(-8, 8), y, vx: rnd(-150, 150), vy: rnd(-300, -100), g: 820, life: rnd(0.5, 0.9), size: rnd(3, 6), rot: rnd(0, 6), vr: rnd(-10, 10), color: i % 3 === 0 ? lt : i % 3 === 1 ? md : dk });
      for (let i = 0; i < 3; i++) A({ kind: "puff", x: x + rnd(-10, 10), y: y + 4, vx: rnd(-50, 50), vy: rnd(-30, 0), life: 0.6, size: 7, grow: 18, color: sg.tex === "sand" ? "#e0c98f" : "#b8ab97" });
      break;
    case "ice":
      for (let i = 0; i < n; i++) A({ kind: "shard", x, y, vx: rnd(-200, 200), vy: rnd(-260, -60), g: 520, life: rnd(0.5, 0.9), size: rnd(3, 6), rot: rnd(0, 6), vr: rnd(-9, 9), color: i % 2 ? lt : "#ffffff" });
      for (let i = 0; i < 5; i++) A({ kind: "flake", x: x + rnd(-14, 14), y: y - rnd(0, 14), vx: rnd(-30, 30), vy: rnd(10, 40), life: 0.9, size: rnd(2, 4), color: "#ffffff" });
      A({ kind: "cross", x, y, life: 0.2, size: 26 * k, color: core });
      break;
    case "water":
      for (let i = 0; i < n + 3; i++) A({ kind: i % 3 ? "dot" : "bubble", x: x + rnd(-6, 6), y, vx: rnd(-160, 160), vy: rnd(-300, -100), g: 760, life: rnd(0.5, 0.9), size: rnd(2.2, 4.5), color: i % 2 ? lt : core });
      for (let i = 0; i < 3; i++) A({ kind: "puff", x: x + rnd(-8, 8), y, vx: rnd(-40, 40), vy: rnd(-70, -20), life: 0.6, size: 6, grow: 16, color: "#e8f6ff" });
      break;
    case "lava": case "fire":
      for (let i = 0; i < n; i++) A({ kind: "spark", x, y, vx: rnd(-180, 180), vy: rnd(-260, -60), g: 380, life: rnd(0.5, 0.9), size: rnd(1.8, 3.2), color: i % 2 ? core : lt });
      for (let i = 0; i < 2; i++) A({ kind: "smoke", x: x + rnd(-8, 8), y, vx: rnd(-14, 14), vy: rnd(-70, -30), life: 0.9, size: 8, grow: 16, color: "#3a2a26" });
      break;
    case "grass":
      for (let i = 0; i < n + 2; i++) A({ kind: "leaf", x, y, vx: rnd(-170, 170), vy: rnd(-230, -30), g: 160, life: rnd(0.8, 1.2), size: rnd(3, 5.5), rot: rnd(0, 6), vr: rnd(-10, 10), color: i % 3 === 0 ? lt : i % 3 === 1 ? md : dk });
      break;
    case "venom":
      for (let i = 0; i < n; i++) A({ kind: "bubble", x: x + rnd(-10, 10), y: y + rnd(-4, 6), vx: rnd(-40, 40), vy: rnd(-110, -40), g: -30, life: rnd(0.7, 1.1), size: rnd(3, 6), color: i % 2 ? lt : md });
      for (let i = 0; i < 3; i++) A({ kind: "splat", x: x + rnd(-14, 14), y: y + rnd(-6, 6), life: 0.8, size: rnd(5, 9), color: md });
      break;
    case "plasma":
      for (let i = 0; i < 4; i++) { const a = rnd(0, TAU); A({ kind: "bolt", x, y, life: 0.2, color: i % 2 ? core : lt, x2: x + Math.cos(a) * rnd(24, 52) * k, y2: y + Math.sin(a) * rnd(18, 40) * k, seed: i * 7 + 3 }); }
      for (let i = 0; i < n; i++) A({ kind: "spark", x, y, vx: rnd(-220, 220), vy: rnd(-220, 220), life: 0.35, size: rnd(1.6, 2.8), color: i % 2 ? "#ffffff" : lt });
      break;
    case "shade": case "aura":
      for (let i = 0; i < n; i++) A({ kind: "dot", x: x + rnd(-10, 10), y: y + rnd(-4, 8), vx: rnd(-35, 35), vy: rnd(-120, -40), g: -50, life: rnd(0.7, 1.1), size: rnd(2.5, 5), color: i % 2 ? lt : md });
      A({ kind: "glow", x, y, life: 0.35, size: 8, grow: 60, color: md });
      break;
    default:
      for (let i = 0; i < n; i++) A({ kind: "star", x, y, vx: rnd(-190, 190), vy: rnd(-190, 190), life: 0.55, size: rnd(3, 6), vr: rnd(-6, 6), rot: 0, color: i % 2 ? lt : core });
  }
}

/** The big moment of a zone move (lob / nova / line strike): a floor mark and a scaled-up motif burst at its centre. */
export function vfxStrike(mv: MoveDef, x: number, y: number, r: number, c: Cx) {
  const sg = sigOf(mv);
  const rr = Math.max(40, Math.min(220, r));
  vfxHit(mv.id, mv, x, y, true, 0, -1, c);
  // then the slow layers of its type: a floor decal, a dome, pieces orbiting, rising or swirling
  layeredBurst(mv.type, x, y, rr, "rest", sg.pal, c);
  mark(c, sg.motif, sg, x, y + 4, rr, 1.1, 0, sg.motif === "rune" ? "glyph" : sg.motif === "spike" || sg.motif === "beam" ? "rays" : sg.motif === "rock" || sg.motif === "cloud" || sg.motif === "drop" || sg.motif === "bomb" || sg.motif === "flame" ? "splat" : "ring");
}

/** A dash leaves its own kind of wake. Called every frame while the move is running. */
export function vfxDash(mv: MoveDef, f: { x: number; y: number; dash?: { dx: number; dy: number } | null }, c: Cx) {
  const sg = sigOf(mv);
  const [dk, md, lt, core] = sg.pal;
  const d = f.dash;
  if (!d || Math.random() > 0.75) return;
  const x = f.x, y = f.y + 4;
  const A = (p: SP) => add(c, p);
  switch (sg.motif) {
    case "claw": case "blade": A({ kind: "streak", x, y: y - 10, vx: -d.dx * 260, vy: -d.dy * 260, life: 0.26, size: rnd(12, 20), color: lt }); A({ kind: "spark", x, y, vx: rnd(-90, 90), vy: rnd(-90, 90), life: 0.3, size: 2, color: core }); break;
    case "fist": case "kick": A({ kind: "star", x, y, vx: -d.dx * 120 + rnd(-60, 60), vy: -d.dy * 120 + rnd(-60, 60), life: 0.35, size: rnd(4, 7), vr: 8, rot: 0, color: Math.random() < 0.5 ? lt : core }); break;
    case "vortex": case "drill": { const a = Math.random() * TAU; A({ kind: "dot", x: x + Math.cos(a) * 16, y: y + Math.sin(a) * 12, vx: Math.cos(a + 1.5) * 90, vy: Math.sin(a + 1.5) * 70, life: 0.4, size: rnd(2.5, 4), color: Math.random() < 0.5 ? md : lt }); break; }
    case "wing": A({ kind: "puff", x, y, vx: -d.dx * 60 + rnd(-30, 30), vy: -d.dy * 60 + rnd(-30, 30), life: 0.45, size: 6, grow: 16, color: "#ffffff" }); A({ kind: "arc", x, y, life: 0.2, size: 5, rot: Math.atan2(d.dy, d.dx), vr: 0, color: lt }); break;
    case "flame": A({ kind: "flame", x, y, vx: rnd(-40, 40), vy: rnd(-90, -30), life: 0.5, size: rnd(7, 12), color: Math.random() < 0.5 ? lt : md }); break;
    case "bolt": { const a = Math.random() * TAU; A({ kind: "bolt", x, y, life: 0.16, color: lt, x2: x + Math.cos(a) * 34, y2: y + Math.sin(a) * 28, seed: (Math.random() * 99) | 0 }); break; }
    case "rock": A({ kind: "plank", x, y, vx: rnd(-60, 60), vy: rnd(-140, -50), g: 600, life: 0.6, size: rnd(3, 6), rot: rnd(0, 6), vr: 6, color: Math.random() < 0.5 ? dk : lt }); break;
    case "drop": A({ kind: "bubble", x, y, vx: rnd(-40, 40), vy: rnd(-60, -10), g: -20, life: 0.6, size: rnd(2.5, 5), color: lt }); break;
    default: A({ kind: "glow", x, y, life: 0.3, size: 8, grow: 24, color: md }); A({ kind: "spark", x, y, vx: rnd(-80, 80), vy: rnd(-80, 80), life: 0.3, size: 2, color: lt });
  }
}

/** A trail behind a flying shot. Returns true when it handled the trail (the renderer then skips its type-based one). */
export function vfxTrail(mv: MoveDef, p: { x: number; y: number; vx: number; vy: number }, c: Cx): boolean {
  const sg = sigOf(mv);
  const [dk, md, lt, core] = sg.pal;
  if (Math.random() > 0.8) return true;
  const A = (q: SP) => add(c, q);
  // on a fast device every shot also leaves a soft glowing wake
  if (c.q >= 0.9 && c.load < 0.7 && Math.random() < 0.4) A({ kind: "glow", x: p.x, y: p.y, life: 0.26, size: 4, grow: 40, color: md });
  const bx = p.x + rnd(-3, 3), by = p.y + rnd(-3, 3);
  const bvx = -p.vx * 0.1, bvy = -p.vy * 0.1;
  switch (sg.motif) {
    case "blade": case "wing": A({ kind: "spark", x: bx, y: by, vx: bvx + rnd(-50, 50), vy: bvy + rnd(-50, 50), life: 0.35, size: rnd(1.6, 2.6), color: lt }); break;
    case "leaf": A({ kind: "leaf", x: bx, y: by, vx: bvx + rnd(-40, 40), vy: bvy + rnd(-40, 40), g: 50, life: 0.7, size: rnd(3, 5), rot: rnd(0, 6), vr: rnd(-10, 10), color: pick([dk, md, lt]) }); break;
    case "cloud": A({ kind: "smoke", x: bx, y: by, vx: rnd(-25, 25), vy: rnd(-30, 0), life: 0.8, size: rnd(6, 10), grow: 18, color: Math.random() < 0.5 ? md : lt }); break;
    case "gem": case "spike": A({ kind: "shard", x: bx, y: by, vx: bvx + rnd(-30, 30), vy: bvy + rnd(-30, 30), life: 0.5, size: rnd(2, 3.6), rot: rnd(0, 6), vr: 8, color: Math.random() < 0.5 ? lt : "#ffffff" }); break;
    case "drop": A({ kind: "bubble", x: bx, y: by, vx: bvx + rnd(-25, 25), vy: bvy + rnd(-40, -5), g: -20, life: 0.6, size: rnd(2.5, 4.5), color: lt }); break;
    case "flame": case "bomb": A({ kind: "flame", x: bx, y: by, vx: bvx + rnd(-30, 30), vy: bvy + rnd(-60, -20), life: 0.45, size: rnd(4, 8), color: Math.random() < 0.5 ? lt : md }); break;
    case "bolt": A({ kind: "spark", x: bx, y: by, vx: rnd(-200, 200), vy: rnd(-200, 200), life: 0.2, size: rnd(1.5, 3), color: Math.random() < 0.5 ? lt : core }); break;
    case "star": A({ kind: "star", x: bx, y: by, vx: bvx + rnd(-60, 60), vy: bvy + rnd(-60, 60), life: 0.45, size: rnd(3, 5), vr: 6, rot: 0, color: Math.random() < 0.5 ? lt : core }); break;
    case "rock": A({ kind: "plank", x: bx, y: by, vx: bvx + rnd(-40, 40), vy: bvy + rnd(-20, 50), g: 300, life: 0.5, size: rnd(2.5, 4.5), rot: rnd(0, 6), vr: 6, color: Math.random() < 0.5 ? dk : lt }); break;
    case "wisp": case "orb": A({ kind: "dot", x: bx, y: by, vx: bvx + rnd(-25, 25), vy: bvy + rnd(-45, -5), g: -30, life: 0.55, size: rnd(2.5, 4.5), color: Math.random() < 0.5 ? md : lt }); break;
    default: A({ kind: "spark", x: bx, y: by, vx: bvx + rnd(-50, 50), vy: bvy + rnd(-50, 50), life: 0.4, size: rnd(1.6, 2.8), color: Math.random() < 0.5 ? lt : core });
  }
  return true;
}

/* ------------------------------------------------------------------ projectile bodies */

/** Shot ids that already have their own hand-made art in arena-art (they keep it). */
export const OWN_SHOT_ART = new Set([
  "confuseray", "supersonic", "sing", "hypnosis", "spore", "toxic", "powdersnow", "hiddenpower", "shockwave", "energyball", "gigadrain", "signalbeam",
  "willowisp", "dragonpulse", "dragonbreath", "shadowball", "aurasphere", "razorleaf", "leafstorm", "stoneedge", "psybeam", "psystrike", "thundershock",
  "waterpulse", "flashcannon", "airslash", "darkpulse", "moonblast",
]);

function shaded(g: CanvasRenderingContext2D, sg: Sig, r: number, t: number) {
  const [dk, md, lt] = sg.pal;
  // a textured, shaded sphere: texture through the body, light from the top-left, a dark rim
  g.save();
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.clip();
  g.fillStyle = md;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.globalAlpha = 0.9;
  g.fillStyle = texPat(g, sg.tex, t * 40, t * 18, r / 26, sg.rot);
  g.fillRect(-r, -r, r * 2, r * 2);
  g.globalAlpha = 1;
  const sh = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  sh.addColorStop(0, "rgba(255,255,255,.55)");
  sh.addColorStop(0.45, "rgba(255,255,255,0)");
  sh.addColorStop(1, "rgba(0,0,0,.5)");
  g.fillStyle = sh;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
  g.strokeStyle = dk;
  g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.stroke();
}

function halo(g: CanvasRenderingContext2D, r: number, color: string, k = 2.6) {
  g.save();
  g.globalCompositeOperation = "lighter";
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * k);
  gr.addColorStop(0, color);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.globalAlpha = 0.55;
  g.beginPath();
  g.arc(0, 0, r * k, 0, TAU);
  g.fill();
  g.restore();
}

/**
 * The body of a projectile (the renderer has already moved the origin to the shot). `ang` is its heading. Returns false
 * for moves that keep the older hand-made art.
 */
export function vfxShot(g: CanvasRenderingContext2D, mv: MoveDef, ang: number, r: number, age: number, t: number): boolean {
  if (OWN_SHOT_ART.has(mv.id)) return false;
  const sg = sigOf(mv);
  const [dk, md, lt, core] = sg.pal;
  const wob = 1 + Math.sin(t * 18 + sg.seed) * 0.06;
  switch (sg.motif) {
    case "blade": case "tail": {
      // a crescent sweeping forward, textured, with a bright edge
      g.save();
      g.rotate(ang);
      halo(g, r, md, 2.2);
      const R = r * 2.6;
      g.beginPath();
      g.arc(-R * 0.45, 0, R, -0.8, 0.8);
      g.arc(-R * 0.1, 0, R * 0.88, 0.75, -0.75, true);
      g.closePath();
      g.fillStyle = texPat(g, sg.tex, t * 60, 0, 0.5, 0);
      g.fill();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = lt;
      g.lineWidth = r * 0.35;
      g.lineCap = "round";
      g.beginPath();
      g.arc(-R * 0.45, 0, R, -0.78, 0.78);
      g.stroke();
      g.strokeStyle = core;
      g.lineWidth = r * 0.14;
      g.beginPath();
      g.arc(-R * 0.45, 0, R, -0.7, 0.7);
      g.stroke();
      g.restore();
      return true;
    }
    case "claw": {
      g.save();
      g.rotate(ang);
      halo(g, r, md, 2);
      g.globalCompositeOperation = "lighter";
      for (let k = -1; k <= 1; k++) {
        const gr = g.createLinearGradient(-r * 3, 0, r * 1.2, 0);
        gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.7, lt); gr.addColorStop(1, core);
        g.strokeStyle = gr; g.lineWidth = r * 0.5; g.lineCap = "round";
        g.beginPath(); g.moveTo(-r * 3, k * r * 0.9 - r * 0.3); g.quadraticCurveTo(-r, k * r * 0.9 - r * 0.7, r * 1.2, k * r * 0.9 + r * 0.2); g.stroke();
      }
      g.restore();
      return true;
    }
    case "gem": case "spike": {
      // a faceted crystal pointing forward, spinning a little
      g.save();
      g.rotate(ang);
      halo(g, r, md, 2.2);
      const L = r * 2.4, Wd = r * 0.95;
      g.beginPath(); g.moveTo(L, 0); g.lineTo(0, -Wd); g.lineTo(-L * 0.7, 0); g.lineTo(0, Wd); g.closePath();
      g.fillStyle = texPat(g, sg.tex, 0, t * 30, 0.5, sg.rot); g.fill();
      g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.moveTo(L, 0); g.lineTo(0, -Wd); g.lineTo(-L * 0.7, 0); g.lineTo(L * 0.1, -Wd * 0.1); g.closePath(); g.fill();
      g.fillStyle = "rgba(0,0,40,.28)"; g.beginPath(); g.moveTo(L, 0); g.lineTo(0, Wd); g.lineTo(-L * 0.7, 0); g.lineTo(L * 0.1, Wd * 0.1); g.closePath(); g.fill();
      g.strokeStyle = lt; g.lineWidth = 1.2; g.beginPath(); g.moveTo(L, 0); g.lineTo(0, -Wd); g.lineTo(-L * 0.7, 0); g.lineTo(0, Wd); g.closePath(); g.stroke();
      g.restore();
      return true;
    }
    case "cloud": {
      // a lumpy gas ball: several soft puffs sharing the type's cloud texture
      halo(g, r, md, 2.4);
      g.save();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 1.5 + sg.seed, rr = r * (0.55 + 0.15 * Math.sin(t * 4 + i));
        g.globalAlpha = 0.85;
        g.fillStyle = i % 2 ? md : lt;
        g.beginPath(); g.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.45, rr, 0, TAU); g.fill();
      }
      g.globalAlpha = 0.5; g.fillStyle = texPat(g, sg.tex, t * 20, 0, 0.5, 0);
      g.beginPath(); g.arc(0, 0, r * 0.95, 0, TAU); g.fill();
      g.restore();
      return true;
    }
    case "bolt": {
      // a crackling ball with arcs jumping off it
      halo(g, r, md, 3);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = lt; g.lineWidth = 1.8; g.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const a = sg.seed + i * 1.26 + Math.floor(t * 18) * 0.7;
        g.beginPath(); g.moveTo(0, 0);
        let x = 0, y = 0;
        for (let s2 = 0; s2 < 3; s2++) { x += Math.cos(a + (s2 % 2 ? 0.5 : -0.5)) * r * 0.9; y += Math.sin(a + (s2 % 2 ? 0.5 : -0.5)) * r * 0.9; g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
      shaded(g, sg, r * 0.7 * wob, t);
      g.fillStyle = core; g.beginPath(); g.arc(0, 0, r * 0.3, 0, TAU); g.fill();
      return true;
    }
    case "flame": case "bomb": {
      // a ball of fire: textured core, tongues streaming back
      g.save();
      g.rotate(ang);
      halo(g, r, md, 2.8);
      for (let i = 0; i < 4; i++) {
        const o = (i - 1.5) * r * 0.5;
        g.fillStyle = i % 2 ? md : lt;
        g.beginPath(); g.moveTo(r * 0.6, o * 0.4); g.quadraticCurveTo(-r * 1.2, o + Math.sin(t * 20 + i) * r * 0.4, -r * (2.4 + (i % 2) * 0.8), o * 0.6); g.quadraticCurveTo(-r * 1.1, o * 1.3 + r * 0.3, r * 0.6, o * 0.4 + r * 0.4); g.fill();
      }
      g.restore();
      shaded(g, sg, r * wob, t);
      g.fillStyle = core; g.globalAlpha = 0.8; g.beginPath(); g.arc(-r * 0.15, -r * 0.15, r * 0.35, 0, TAU); g.fill(); g.globalAlpha = 1;
      return true;
    }
    case "star": {
      halo(g, r, md, 2.4);
      g.save();
      g.rotate(t * 5 + sg.seed);
      g.fillStyle = md; g.strokeStyle = core; g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r * 1.5; g.lineTo(Math.cos((i / 10) * TAU) * rr, Math.sin((i / 10) * TAU) * rr); }
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = core; g.beginPath(); g.arc(0, 0, r * 0.35, 0, TAU); g.fill();
      g.restore();
      return true;
    }
    case "wing": {
      g.save();
      g.rotate(ang);
      halo(g, r, md, 2);
      g.globalCompositeOperation = "lighter";
      for (const s2 of [-1, 1]) {
        g.fillStyle = lt; g.globalAlpha = 0.85;
        g.beginPath(); g.moveTo(r * 0.8, 0); g.quadraticCurveTo(-r * 0.3, s2 * r * 2.4, -r * 2.4, s2 * r * 1.7 * (1 + Math.sin(t * 16) * 0.12)); g.quadraticCurveTo(-r * 0.9, s2 * r * 0.7, r * 0.8, 0); g.fill();
        g.fillStyle = core; g.globalAlpha = 0.9;
        g.beginPath(); g.moveTo(r * 0.7, 0); g.quadraticCurveTo(-r * 0.2, s2 * r * 1.2, -r * 1.3, s2 * r * 0.9); g.quadraticCurveTo(-r * 0.4, s2 * r * 0.3, r * 0.7, 0); g.fill();
      }
      g.restore();
      return true;
    }
    case "drop": {
      // a teardrop of liquid pointing along its path, with a bright highlight
      g.save();
      g.rotate(ang);
      halo(g, r, md, 2);
      g.beginPath(); g.moveTo(r * 1.9, 0); g.quadraticCurveTo(r * 0.3, -r * 1.25, -r * 0.9, 0); g.quadraticCurveTo(r * 0.3, r * 1.25, r * 1.9, 0); g.closePath();
      g.fillStyle = texPat(g, sg.tex, t * 50, 0, r / 26, 0); g.fill();
      g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(r * 0.4, -r * 0.45, r * 0.55, r * 0.22, -0.3, 0, TAU); g.fill();
      g.strokeStyle = dk; g.lineWidth = 1.2; g.stroke();
      g.restore();
      return true;
    }
    case "rock": {
      // a jagged lump of stone, tumbling
      g.save();
      g.rotate(t * 6 + sg.seed);
      g.beginPath();
      for (let i = 0; i < 8; i++) { const rr = r * (0.8 + 0.35 * Math.sin(sg.seed * (i + 1))); g.lineTo(Math.cos((i / 8) * TAU) * rr, Math.sin((i / 8) * TAU) * rr); }
      g.closePath();
      g.fillStyle = texPat(g, "rock", 0, 0, r / 24, sg.rot); g.fill();
      g.fillStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(-r * 0.7, -r * 0.2); g.lineTo(-r * 0.1, -r * 0.8); g.closePath(); g.fill();
      g.strokeStyle = "#2a2118"; g.lineWidth = 1.6; g.stroke();
      g.restore();
      return true;
    }
    case "leaf": {
      g.save();
      g.rotate(ang + Math.sin(t * 14) * 0.25);
      halo(g, r, md, 1.8);
      g.beginPath(); g.moveTo(r * 1.8, 0); g.quadraticCurveTo(0, -r * 1.3, -r * 1.4, 0); g.quadraticCurveTo(0, r * 1.3, r * 1.8, 0); g.closePath();
      g.fillStyle = texPat(g, sg.tex, 0, 0, r / 24, 0); g.fill();
      g.strokeStyle = lt; g.lineWidth = 1.2; g.beginPath(); g.moveTo(r * 1.7, 0); g.lineTo(-r * 1.3, 0); g.stroke();
      g.strokeStyle = dk; g.lineWidth = 1; g.beginPath(); g.moveTo(r * 1.8, 0); g.quadraticCurveTo(0, -r * 1.3, -r * 1.4, 0); g.quadraticCurveTo(0, r * 1.3, r * 1.8, 0); g.stroke();
      g.restore();
      return true;
    }
    case "sonic": {
      // widening arcs of sound/psychic force travelling forward
      g.save();
      g.rotate(ang);
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const ph = (t * 3 + i / 3) % 1;
        g.globalAlpha = 1 - ph;
        g.strokeStyle = i % 2 ? lt : md; g.lineWidth = r * (0.5 - ph * 0.3); g.lineCap = "round";
        g.beginPath(); g.arc(-r * 0.6 - ph * r * 2.4, 0, r * (0.9 + ph * 1.6), -0.9, 0.9); g.stroke();
      }
      g.globalAlpha = 1; g.fillStyle = core; g.beginPath(); g.arc(0, 0, r * 0.4, 0, TAU); g.fill();
      g.restore();
      return true;
    }
    case "wisp": {
      halo(g, r, md, 2.8);
      g.save(); g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 3; k++) {
        const a = t * 4 + k * 2.09, px = Math.cos(a) * r * 0.7, py = Math.sin(a) * r * 0.5;
        for (const [sc, cc] of [[1, md], [0.6, lt], [0.28, core]] as const) {
          g.fillStyle = cc; g.beginPath();
          g.moveTo(px, py - r * 1.5 * sc); g.quadraticCurveTo(px + r * 0.8 * sc, py, px, py + r * 0.6 * sc); g.quadraticCurveTo(px - r * 0.8 * sc, py, px, py - r * 1.5 * sc); g.fill();
        }
      }
      g.restore();
      return true;
    }
    case "drill": case "beam": {
      // a spiralling dart with a bright tip
      g.save();
      g.rotate(ang);
      halo(g, r, md, 2.2);
      g.fillStyle = texPat(g, sg.tex, t * 60, 0, 0.5, 0);
      g.beginPath(); g.moveTo(r * 2.4, 0); g.lineTo(-r * 1.2, -r * 0.9); g.lineTo(-r * 1.2, r * 0.9); g.closePath(); g.fill();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = lt; g.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) { const x = r * 2 - i * r * 0.85 - ((t * 40) % (r * 0.85)); g.beginPath(); g.moveTo(x, -r * 0.8 * (1 - (r * 2 - x) / (r * 3.6))); g.lineTo(x - r * 0.4, r * 0.8 * (1 - (r * 2 - x) / (r * 3.6))); g.stroke(); }
      g.fillStyle = core; g.beginPath(); g.arc(r * 2.2, 0, r * 0.35, 0, TAU); g.fill();
      g.restore();
      return true;
    }
    default: {
      // orb: a shaded textured sphere, a ring of orbiting motes and a hot core
      halo(g, r, md, 2.8);
      shaded(g, sg, r * wob, t);
      g.save();
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.09 + sg.seed; g.fillStyle = i % 2 ? lt : core; g.beginPath(); g.arc(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35 * 0.7, Math.max(1.4, r * 0.14), 0, TAU); g.fill(); }
      g.restore();
      return true;
    }
  }
}

/* ------------------------------------------------------------------ floor marks */

export type VfxDecal = { style: "glyph" | "scar" | "splat" | "rays" | "ring" | "rune"; motif: Motif; pal: Pal; tex: TexKind };

/** Draw one floor mark. `u` runs 0 → 1 over its life; `d` is the decal from the renderer. */
export function drawVfxDecal(g: CanvasRenderingContext2D, d: { x: number; y: number; r: number; seed: number; ang: number; vfx: VfxDecal }, u: number) {
  const { style, pal, tex } = d.vfx;
  const [dk, md, lt, core] = pal;
  // small, brief and type-specific: no discs, rings or stains, so the move's own animation stays readable
  const R = Math.min(d.r, 90) * 0.7;
  const e = 1 - (1 - Math.min(1, u * 6)) ** 3; // bursts out fast, then settles
  let sd = d.seed * 9301 + 49297;
  const rn = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  const hot = Math.max(0, 1 - u * 2.2);
  g.save();
  g.translate(d.x, d.y);
  g.lineCap = "round";
  g.lineJoin = "round";
  if (style === "rune") {
    // the runic ground ring of the sheets: thin, flares in, turns a little and fades
    const Rr = Math.min(d.r, 110) * (0.55 + 0.45 * e);
    const fade = u < 0.12 ? u / 0.12 : Math.max(0, 1 - (u - 0.12) / 0.88);
    g.rotate(d.ang + u * 0.9);
    g.globalCompositeOperation = "lighter";
    const fl = g.createRadialGradient(0, 0, Rr * 0.2, 0, 0, Rr);
    fl.addColorStop(0, "rgba(0,0,0,0)");
    fl.addColorStop(1, md + "30");
    g.globalAlpha = fade;
    g.fillStyle = fl;
    g.beginPath(); g.arc(0, 0, Rr, 0, TAU); g.fill();
    g.strokeStyle = md; g.lineWidth = 2.2; g.globalAlpha = 0.85 * fade;
    g.beginPath(); g.arc(0, 0, Rr, 0, TAU); g.stroke();
    g.strokeStyle = lt; g.lineWidth = 1.1; g.globalAlpha = 0.7 * fade;
    g.beginPath(); g.arc(0, 0, Rr * 0.74, 0, TAU); g.stroke();
    // twelve glyphs between the two rings, each a short strange stroke
    g.strokeStyle = core; g.lineWidth = 1.3; g.globalAlpha = 0.9 * fade;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const r0 = Rr * 0.8, w = Rr * 0.07;
      const kind = Math.floor(rn() * 3);
      g.beginPath();
      if (kind === 0) { g.moveTo(ca * r0, sa * r0); g.lineTo(ca * (r0 + Rr * 0.13), sa * (r0 + Rr * 0.13)); }
      else if (kind === 1) { g.moveTo(ca * r0 - sa * w, sa * r0 + ca * w); g.lineTo(ca * (r0 + Rr * 0.1), sa * (r0 + Rr * 0.1)); g.lineTo(ca * r0 + sa * w, sa * r0 - ca * w); }
      else { g.moveTo(ca * r0 - sa * w, sa * r0 + ca * w); g.lineTo(ca * r0 + sa * w, sa * r0 - ca * w); g.moveTo(ca * r0, sa * r0); g.lineTo(ca * (r0 + Rr * 0.12), sa * (r0 + Rr * 0.12)); }
      g.stroke();
    }
    g.restore();
    return;
  }
  if (style === "scar") {
    // claw / blade scratches: three thin slashes
    g.rotate(d.ang);
    for (let k = -1; k <= 1; k++) {
      g.beginPath(); g.moveTo(-R * 0.8, k * R * 0.3 - R * 0.2); g.quadraticCurveTo(0, k * R * 0.3 - R * 0.04, R * 0.8, k * R * 0.3 + R * 0.22);
      g.strokeStyle = "rgba(10,6,12,.5)"; g.lineWidth = 3; g.stroke();
      g.globalCompositeOperation = "lighter"; g.strokeStyle = md; g.globalAlpha = 0.8 * hot; g.lineWidth = 1.2; g.stroke();
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
  } else if (tex === "rock" || tex === "sand" || tex === "metal") {
    // the ground splits: jagged cracks run out of the point of impact and chips of stone jump from them
    g.scale(1, 0.72);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rn() * 0.7, L = R * (0.6 + rn() * 0.5) * e;
      let x = 0, y = 0;
      const pts: [number, number][] = [[0, 0]];
      for (let k = 1; k <= 3; k++) { x = Math.cos(a + (rn() - 0.5) * 0.7) * L * (k / 3); y = Math.sin(a + (rn() - 0.5) * 0.7) * L * (k / 3); pts.push([x, y]); }
      g.beginPath(); pts.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.strokeStyle = "rgba(14,9,6,.8)"; g.lineWidth = 3.2; g.stroke();
      g.strokeStyle = lt; g.globalAlpha = 0.45; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
    }
    for (let i = 0; i < 5; i++) {
      const a = rn() * TAU, dd = R * (0.3 + rn() * 0.6) * e, h = Math.sin(Math.min(1, u * 3) * Math.PI) * 14;
      const s = 2 + rn() * 3;
      g.fillStyle = texPat(g, tex, i * 9, 0, 0.5, i); g.beginPath(); g.moveTo(Math.cos(a) * dd - s, Math.sin(a) * dd - h); g.lineTo(Math.cos(a) * dd + s, Math.sin(a) * dd - h - s); g.lineTo(Math.cos(a) * dd + s * 0.6, Math.sin(a) * dd - h + s); g.closePath(); g.fill();
    }
  } else if (tex === "ice") {
    // frost shards stand up out of the floor and sparkle
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rn(), dd = R * (0.15 + rn() * 0.5), h = (10 + rn() * 18) * e, w = 3 + rn() * 3;
      const bx = Math.cos(a) * dd, by = Math.sin(a) * dd * 0.7;
      g.fillStyle = lt; g.strokeStyle = core; g.lineWidth = 1; g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(bx - w, by); g.lineTo(bx + rn() * 3 - 1, by - h); g.lineTo(bx + w, by); g.closePath(); g.fill(); g.stroke(); g.globalAlpha = 0.45; g.fillStyle = texPat(g, "ice", bx * 3, by * 3, 0.5); g.fill(); g.globalAlpha = 0.85;
      g.fillStyle = md; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + rn() * 3 - 1, by - h); g.lineTo(bx + w, by); g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) { const sx = (rn() - 0.5) * R * 1.3, sy = (rn() - 0.5) * R * 0.7 - 6, k = 2 + 3 * Math.abs(Math.sin(u * 9 + i)); g.strokeStyle = "#fff"; g.lineWidth = 1; g.beginPath(); g.moveTo(sx - k, sy); g.lineTo(sx + k, sy); g.moveTo(sx, sy - k); g.lineTo(sx, sy + k); g.stroke(); }
  } else if (tex === "water") {
    // a splash: a crown of droplets thrown up and falling back, with a few thin curling streaks
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rn() * 0.4, dd = R * (0.35 + rn() * 0.55) * e, h = Math.sin(Math.min(1, u * 2.4) * Math.PI) * (16 + rn() * 22);
      const px = Math.cos(a) * dd, py = Math.sin(a) * dd * 0.6 - h, s = 1.8 + rn() * 2.4;
      g.fillStyle = i % 3 ? lt : core; g.globalAlpha = 0.9 * (1 - u);
      g.beginPath(); g.arc(px, py, s, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(px - s * 0.7, py - s * 0.3); g.lineTo(px, py - s * 2.6); g.lineTo(px + s * 0.7, py - s * 0.3); g.fill();
    }
    g.globalAlpha = 0.8 * (1 - u); g.strokeStyle = lt; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const sx = (i - 1) * R * 0.35, hh = (14 + rn() * 12) * Math.min(1, u * 5); g.beginPath(); g.moveTo(sx, 0); g.quadraticCurveTo(sx + (i - 1) * 8, -hh, sx + (i - 1) * 16, -hh * 0.4); g.stroke(); }
    g.globalAlpha = 1;
  } else if (tex === "lava" || tex === "fire") {
    // scorched, glowing fissures that cool to black, with a few embers lifting off
    g.scale(1, 0.72);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + rn(), L = R * (0.5 + rn() * 0.5) * e;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - 0.2) * L * 0.5, Math.sin(a - 0.2) * L * 0.5); g.lineTo(Math.cos(a + 0.15) * L, Math.sin(a + 0.15) * L);
      g.strokeStyle = "rgba(25,12,8,.7)"; g.lineWidth = 3; g.stroke();
      g.globalCompositeOperation = "lighter"; g.strokeStyle = md; g.globalAlpha = hot; g.lineWidth = 1.6; g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? lt : md; g.globalAlpha = (1 - u) * 0.9; g.beginPath(); g.arc((rn() - 0.5) * R, (rn() - 0.5) * R * 0.5 - u * 40 * (0.5 + rn()), 1.6, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  } else if (tex === "grass") {
    // torn leaves spin out and drift down
    for (let i = 0; i < 7; i++) {
      const a = rn() * TAU, dd = R * (0.3 + rn() * 0.6) * e, fall = u * 14;
      g.save(); g.translate(Math.cos(a) * dd, Math.sin(a) * dd * 0.6 - Math.sin(Math.min(1, u * 2.5) * Math.PI) * 14 + fall); g.rotate(a + u * 5 * (i % 2 ? 1 : -1));
      g.globalAlpha = 1 - u * 0.8; g.fillStyle = i % 3 === 0 ? lt : i % 3 === 1 ? md : dk;
      g.beginPath(); g.moveTo(-5, 0); g.quadraticCurveTo(0, -3.5, 5, 0); g.quadraticCurveTo(0, 3.5, -5, 0); g.fill();
      g.restore();
    }
  } else if (tex === "venom") {
    // a few small toxic droplets that sit and bubble
    g.scale(1, 0.72);
    for (let i = 0; i < 5; i++) {
      const a = rn() * TAU, dd = R * (0.2 + rn() * 0.7) * e, s = 3 + rn() * 4;
      g.fillStyle = dk; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(Math.cos(a) * dd, Math.sin(a) * dd, s * 1.3, s, 0, 0, TAU); g.fill();
      g.fillStyle = md; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(Math.cos(a) * dd, Math.sin(a) * dd - 1, s, s * 0.7, 0, 0, TAU); g.fill();
      g.fillStyle = lt; g.globalAlpha = 0.8; g.beginPath(); g.arc(Math.cos(a) * dd - s * 0.3, Math.sin(a) * dd - s * 0.4, s * 0.25, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  } else if (tex === "plasma") {
    // forked lightning running over the floor
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      if (rn() < 0.2 + u * 0.5) continue;
      const a = (i / 4) * TAU + rn(), L = R * (0.7 + rn() * 0.4) * e;
      g.beginPath(); g.moveTo(0, 0);
      for (let k = 1; k <= 4; k++) g.lineTo(Math.cos(a) * L * (k / 4) + (rn() - 0.5) * 9, Math.sin(a) * L * (k / 4) * 0.7 + (rn() - 0.5) * 9);
      g.strokeStyle = md; g.lineWidth = 3; g.globalAlpha = 0.5 * hot + 0.1; g.stroke();
      g.strokeStyle = core; g.lineWidth = 1.2; g.globalAlpha = 0.9 * hot + 0.1; g.stroke();
    }
    g.globalAlpha = 1;
  } else if (tex === "shade") {
    // thin wisps of darkness curling away
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + rn(), L = R * (0.6 + rn() * 0.5) * e;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + 0.9) * L * 0.6, Math.sin(a + 0.9) * L * 0.4 - 6, Math.cos(a) * L, Math.sin(a) * L * 0.6 - 14 * u);
      g.strokeStyle = dk; g.globalAlpha = 0.55 * (1 - u); g.lineWidth = 4; g.stroke();
      g.strokeStyle = md; g.globalAlpha = 0.5 * (1 - u); g.lineWidth = 1.4; g.stroke();
    }
    g.globalAlpha = 1;
  } else {
    // everything else (psychic, fairy, normal, dragon...): a quick burst of sparkles with short rays
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + rn(), dd = R * (0.25 + rn() * 0.6) * e, k = (2 + rn() * 3) * (1 - u * 0.6);
      const px = Math.cos(a) * dd, py = Math.sin(a) * dd * 0.65 - u * 10;
      g.globalAlpha = 1 - u; g.fillStyle = i % 2 ? lt : core;
      g.beginPath(); g.moveTo(px, py - k * 1.6); g.lineTo(px + k * 0.4, py - k * 0.4); g.lineTo(px + k * 1.6, py); g.lineTo(px + k * 0.4, py + k * 0.4); g.lineTo(px, py + k * 1.6); g.lineTo(px - k * 0.4, py + k * 0.4); g.lineTo(px - k * 1.6, py); g.lineTo(px - k * 0.4, py - k * 0.4); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
  }
  g.restore();
}
