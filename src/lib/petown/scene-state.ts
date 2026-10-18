/**
 * Turns a Petown battle into what the Pokémon arena scene (components/pokemon/arena.tsx) draws, so the Petown battle
 * gets the same attack, hit, faint and status animations as the regular battles.
 */
import type { BState, Mon as SceneMon, SideId } from "@/lib/pokemon/protocol";
import type { SpriteInfo } from "@/lib/pokemon/shared";
import { LEVEL, activeWeather, type Battle, type Mon, type Weather } from "@/lib/petown/engine";

/** The weather names the scene's backdrop and chips know. */
export const WEATHER_ATTR: Record<Weather, string> = {
  sun: "SunnyDay", rain: "RainDance", sand: "Sandstorm", hail: "Hail", harshsun: "DesolateLand", heavyrain: "PrimordialSea", wind: "DeltaStream",
};

/** Stage keys the scene's chips use. */
const BOOST_KEY: Record<string, string> = { atk: "atk", def: "def", spa: "spa", spd: "spd", spe: "spe", acc: "accuracy", eva: "evasion" };

/** The condition shown next to the name: a major status, else confusion / infatuation. */
export function statusCode(m: Mon): string {
  return m.status ?? (m.vol.cnf > 0 ? "CNF" : m.vol.inf > 0 ? "LOVE" : "");
}

export function sceneMon(m: Mon): SceneMon {
  const boosts: Record<string, number> = {};
  for (const [k, v] of Object.entries(m.stages)) if (v !== 0) boosts[BOOST_KEY[k] ?? k] = v;
  return {
    name: m.name,
    species: m.name,
    level: LEVEL,
    gender: "",
    hp: m.hp,
    maxHp: m.maxHp,
    status: statusCode(m),
    fainted: m.fainted,
    boosts,
    volatiles: [],
    mega: m.form === 1 || m.form === 3,
    revealed: true,
  };
}

export function toBState(b: Battle): BState {
  const w = activeWeather(b);
  const side = (id: SideId, name: string, s: Battle["sides"][number]) => ({
    id,
    name,
    size: s.mons.length,
    team: s.mons.map(sceneMon),
    active: sceneMon(s.mons[s.active]),
    conditions: [] as string[],
  });
  return {
    gen: 9,
    turn: b.round,
    sides: { p1: side("p1", "You", b.sides[0]), p2: side("p2", "CPU", b.sides[1]) },
    weather: w ? WEATHER_ATTR[w] : "",
    terrain: "",
    rooms: [],
    ended: b.winner !== -1,
    winner: b.winner === -1 ? null : b.winner === 0 ? "You" : "CPU",
    pendingEffect: null,
    lastMove: null,
  };
}

/** Sprite lookup by name for every Pokémon in the battle. Forms with no sprite get an empty id (shows a Poké Ball). */
export function spritesFor(b: Battle): Record<string, SpriteInfo> {
  const out: Record<string, SpriteInfo> = {};
  for (const s of b.sides) for (const m of s.mons) out[m.name] = { id: m.sprite, num: m.num, types: m.types };
  return out;
}

/** CSS filter that tints a lookalike sprite so it reads as its own form (see the sprite resolver in the data build). */
export const tintOf = (m: Mon | undefined): string => (m && m.hue ? `hue-rotate(${m.hue}deg) saturate(1.2)` : "hue-rotate(0deg)");

export const sideId = (s: 0 | 1): SideId => (s === 0 ? "p1" : "p2");
