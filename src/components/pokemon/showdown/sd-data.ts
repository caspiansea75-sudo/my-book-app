/**
 * Fight Showdown: who can fight and what they can do. Plain data, no DOM.
 * Everything is worked out from the Arena roster (types, base stats, size, role) so every Pokémon there can fight here too.
 */
import { MOVES, ROSTER, Z_MOVES, Z_SIGNATURE, locoOf, type Loco, type Species } from "@/lib/pokemon/arena-data";
import { TYPE_COLOR } from "@/lib/pokemon/shared";

export type SuperKind = "rush" | "beam" | "blast";
export type Fighter = {
  id: string;
  num: number;
  name: string;
  types: string[];
  color: string;
  blurb: string;
  maxHp: number;
  /** walking speed, px/s */
  walk: number;
  /** damage multiplier (attack side) and incoming-damage multiplier (defence side) */
  power: number;
  guard: number;
  /** drawn height of the picture in world pixels, and half the body width */
  h: number;
  bw: number;
  special: { name: string; type: string; speed: number; color: string };
  sup: { name: string; bn: string; type: string; kind: SuperKind };
  role: Species["role"];
  /** how it gets about: decides how it is animated (hovering, slithering, running…) */
  loco: Loco;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const SPECIAL_SPEED: Record<string, number> = { Electric: 760, Psychic: 560, Fire: 600, Water: 540, Ice: 620, Ghost: 480, Dark: 520, Dragon: 600, Fairy: 540, Poison: 500, Grass: 560, Flying: 700, Steel: 640, Rock: 460, Ground: 480, Fighting: 600, Bug: 600, Normal: 580 };

function build(sp: Species): Fighter {
  const [hp, atk, def, spa, spd, spe] = sp.bs;
  const t0 = sp.types[0] ?? "Normal";
  // the first of its Arena moves that shares its type names its special; otherwise its first move does
  const mv = sp.moves.map((m) => MOVES[m]).filter(Boolean);
  const pick = mv.find((m) => m!.type === t0) ?? mv[0];
  const sig = Z_SIGNATURE[sp.id];
  const z = sig ?? Z_MOVES[t0] ?? { name: "Final Burst", bn: "ফাইনাল বার্স্ট" };
  const kind: SuperKind = sp.role === "brawler" ? "rush" : sp.role === "shooter" ? "beam" : "blast";
  return {
    id: sp.id,
    num: sp.num,
    name: sp.name,
    types: sp.types,
    color: TYPE_COLOR[t0] ?? "#ffffff",
    blurb: sp.blurb,
    maxHp: Math.round(clamp(86 + (hp - 70) * 0.55 + (def + spd - 160) * 0.12, 72, 128)),
    walk: Math.round(clamp(150 + spe * 1.05, 190, 300)),
    power: clamp(0.8 + Math.max(atk, spa) / 260, 0.85, 1.35),
    guard: clamp(1.18 - (def + spd) / 600, 0.82, 1.1),
    h: Math.round(clamp(96 + sp.size * 3.6, 130, 230)),
    bw: Math.round(clamp(24 + sp.size * 0.9, 34, 58)),
    special: {
      name: pick?.name ?? "Energy Ball",
      type: pick?.type ?? t0,
      speed: SPECIAL_SPEED[pick?.type ?? t0] ?? 580,
      color: TYPE_COLOR[pick?.type ?? t0] ?? "#ffffff",
    },
    sup: { name: z.name, bn: z.bn, type: sig?.type ?? t0, kind },
    role: sp.role,
    loco: locoOf(sp),
  };
}

const cache = new Map<string, Fighter>();
export function fighterOf(id: string): Fighter {
  let f = cache.get(id);
  if (!f) {
    const sp = ROSTER.find((s) => s.id === id) ?? ROSTER[0]!;
    f = build(sp);
    cache.set(sp.id, f);
    cache.set(id, f);
  }
  return f;
}
export const FIGHTER_IDS: string[] = ROSTER.map((s) => s.id);

export type StageId = "stadium" | "volcano" | "harbor" | "forest";
export const STAGES: { id: StageId; name: string; bn: string }[] = [
  { id: "stadium", name: "Grand Stadium", bn: "গ্র্যান্ড স্টেডিয়াম" },
  { id: "volcano", name: "Lava Crater", bn: "লাভা গহ্বর" },
  { id: "harbor", name: "Sunset Harbor", bn: "সূর্যাস্ত বন্দর" },
  { id: "forest", name: "Moonlit Forest", bn: "চাঁদনী বন" },
];

export type Level = "easy" | "normal" | "hard";
export const LEVELS: { id: Level; name: string; bn: string }[] = [
  { id: "easy", name: "Easy", bn: "সহজ" },
  { id: "normal", name: "Normal", bn: "মাঝারি" },
  { id: "hard", name: "Hard", bn: "কঠিন" },
];
