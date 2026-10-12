// Builds src/data/petown.json from the decoded Petown tables (curated/*.json).
// Usage: node scripts/build-petown-data.mjs <dir-with-curated-json>
import fs from "node:fs";
import path from "node:path";
import { Dex } from "@pkmn/sim";

const dir = process.argv[2] ?? "curated";
const rd = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const species = rd("species.json");
const movesRaw = rd("moves.json");
const abilitiesRaw = rd("abilities.json");
const itemsRaw = rd("hold_items_equipment.json");

const TYPE_CODE = { 0: "Normal", 1: "Fighting", 2: "Flying", 3: "Poison", 4: "Ground", 5: "Rock", 6: "Bug", 7: "Ghost", 8: "Steel", 9: "Fire", 10: "Water", 11: "Grass", 12: "Electric", 13: "Psychic", 14: "Ice", 15: "Dragon", 16: "Dark", 17: "Fairy" };

/* ---- moves: damaging only ---- */
const moves = [];
const moveIdx = new Map();
for (const m of movesRaw) {
  if (!m.name || !m.type || !(m.power > 0) || !m.category || m.category === "status") continue;
  if (/^(Mega|Ultimate)\b/.test(m.name)) continue;
  moveIdx.set(m.id, moves.length);
  moves.push([m.name, m.type, m.category === "physical" ? 0 : 1, Math.round(m.power), m.accuracy > 0 ? Math.min(100, Math.round(m.accuracy)) : 100, Math.max(5, Math.min(40, Math.round(m.pp || 15)))]);
}
const byType = {};
moves.forEach((m, i) => (byType[m[1]] ??= []).push(i));
for (const t in byType) byType[t].sort((a, b) => moves[a][3] - moves[b][3]);

/* ---- items ---- */
const STAT_IDX = { 1: "atk", 2: "def", 3: "spa", 4: "spd", 5: "spe" };
const best = new Map();
for (const it of itemsRaw) {
  const r = it.raw, d = it.description || "", name = it.name;
  if (!name || !d) continue;
  if (/Exclusive|Special item|series|Only for|held by|Can only/i.test(d)) continue;
  const kind = r["2"], tcode = r["4"], stat = r["6"];
  if (typeof tcode !== "number" || tcode === 99 || !(tcode in TYPE_CODE)) continue;
  if (kind === 2 && r["5"] > 1 && stat === 0) {
    const e = { name, kind: "power", type: TYPE_CODE[tcode], v: r["5"], desc: d };
    if (!best.has(name) || best.get(name).v < e.v) best.set(name, e);
  } else if (kind === 1 && typeof stat === "number" && STAT_IDX[stat]) {
    const m = /by (\d+)%|Boost (\d+)%|Increase (\d+)%/i.exec(d);
    const pct = m ? Number(m[1] ?? m[2] ?? m[3]) : 0;
    if (!pct) continue;
    const e = { name, kind: "stat", type: TYPE_CODE[tcode], stat: STAT_IDX[stat], v: 1 + pct / 100, desc: d };
    if (!best.has(name) || best.get(name).v < e.v) best.set(name, e);
  }
}
const items = [...best.values()].map((e) => [e.name, e.kind === "power" ? 0 : 1, e.type, e.stat ?? "", +e.v.toFixed(2), e.desc]);

/* ---- species ---- */
const spriteCache = new Map();
function resolveSprite(name) {
  const base = name.replace(/\s+R2$/, "").replace(/^Ultimate\s+/, "");
  const tries = [base];
  const words = base.split(" ");
  if (words[0] === "Mega") {
    for (let i = 1; i < words.length; i++) tries.push(`Mega ${words.slice(i).join(" ")}`);
  }
  for (let i = 1; i < words.length; i++) tries.push(words.slice(i).join(" "));
  for (const t of tries) {
    const s = Dex.species.get(t);
    if (s.exists) return { id: s.spriteid, num: s.num, exact: t === base };
  }
  return null;
}
const abilityDesc = new Map(abilitiesRaw.map((a) => [a.name, a.description]));
const outSpecies = [];
let noSprite = 0;
for (const s of species) {
  const bs = s.base_stats;
  const v = [bs.HP, bs.Atk, bs.Def, bs.SpA, bs.SpD, bs.Spe];
  if (v.some((x) => !(x > 0))) continue;
  const types = [s.type1, s.type2].filter(Boolean);
  if (!types.length) continue;
  const dmg = (s.default_moves || []).map((m) => moveIdx.get(m.id)).filter((x) => x !== undefined);
  const set = [...new Set(dmg)].slice(0, 4);
  // top up to 4 with strongest-but-reasonable own-type moves, then neutral coverage
  const pool = [];
  for (const t of types) pool.push(...(byType[t] ?? []).filter((i) => moves[i][3] >= 60 && moves[i][3] <= 120).reverse());
  pool.push(...(byType.Normal ?? []).filter((i) => moves[i][3] >= 70 && moves[i][3] <= 110).reverse());
  for (const i of pool) { if (set.length >= 4) break; if (!set.includes(i)) set.push(i); }
  if (!set.some((i) => types.includes(moves[i][1])) && pool.length) set[set.length - 1] = pool[0];
  if (set.length < 2) continue;
  if (!spriteCache.has(s.name)) spriteCache.set(s.name, resolveSprite(s.name));
  const sp = spriteCache.get(s.name);
  if (!sp) noSprite++;
  const form = s.is_ultimate ? 3 : s.is_r2 ? 2 : s.is_mega ? 1 : 0;
  outSpecies.push([s.id, s.name, types, v, s.ability?.name ?? "", set, form, sp ? sp.id : "", sp ? sp.num : 0]);
}
const usedAb = new Set(outSpecies.map((x) => x[4]).filter(Boolean));
const abilities = {};
for (const a of usedAb) abilities[a] = abilityDesc.get(a) ?? "";
const data = { moves, items, abilities, species: outSpecies };
const dest = path.resolve("src/data/petown.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(data));
console.log({ species: outSpecies.length, moves: moves.length, items: items.length, abilities: usedAb.size, noSprite, bytes: fs.statSync(dest).size, byForm: [0, 1, 2, 3].map((f) => outSpecies.filter((x) => x[6] === f).length) });
