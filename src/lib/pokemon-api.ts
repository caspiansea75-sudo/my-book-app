import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireMember } from "@/lib/members-core";
import {
  formatByGen,
  viewLines,
  type BattleRequest,
  type CpuLevel,
  type DexEntry,
  type ItemInfo,
  type MoveInfo,
  type PokeSet,
  type SpeciesDetail,
  type SpriteInfo,
} from "@/lib/pokemon/shared";

/**
 * Pokémon battles. The battle engine (Pokémon Showdown's, via @pkmn/sim) is loaded lazily and only on the
 * server; every function here checks that the caller is a signed-in member.
 */

export type { DexEntry, ItemInfo, SpeciesDetail };

const ENGINE_DOWN = "পোকেমন ইঞ্জিন চালু হয়নি — সার্ভারে @pkmn/sim প্যাকেজ আছে কিনা দেখুন (npm install)";
const TIMEOUT_SECONDS = 180;

async function loadEngine() {
  try {
    return await import("@/lib/pokemon/engine.server");
  } catch (e) {
    console.error("pokemon engine failed to load", e);
    throw new Error(ENGINE_DOWN);
  }
}

const json = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
};
const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null);
const cleanName = (s: string) => s.replace(/[|\n\r\\]/g, "").trim().slice(0, 20) || "Player";

/* ================================================================ types */

export type PokeTeam = { id: number; name: string; gen: number; sets: PokeSet[]; updatedAt: string };
export type PersonLite = { id: number; username: string; displayName: string; avatarUrl: string | null };
export type BattleListItem = {
  id: number;
  status: "invited" | "active" | "done";
  gen: number;
  you: "p1" | "p2";
  opponent: string;
  opponentId: number | null;
  cpu: boolean;
  turn: number;
  yourTurn: boolean;
  result: "win" | "loss" | "tie" | null;
  createdAt: string;
  lastMoveAt: string;
};
export type Invite = { id: number; from: PersonLite; gen: number; createdAt: string };
export type LobbyData = {
  teams: PokeTeam[];
  battles: BattleListItem[];
  invites: Invite[];
  members: PersonLite[];
};

export type BattleView = {
  unchanged: false;
  id: number;
  rev: number;
  status: "invited" | "active" | "done";
  gen: number;
  you: "p1" | "p2" | null;
  names: { p1: string; p2: string };
  people: { p1: PersonLite | null; p2: PersonLite | null };
  cpu: boolean;
  cpuLevel: CpuLevel | null;
  lines: string[];
  total: number;
  request: BattleRequest | null;
  waitingFor: "you" | "opponent" | null;
  chosen: boolean;
  turn: number;
  winner: "p1" | "p2" | "tie" | null;
  endReason: string | null;
  left: { p1: number | null; p2: number | null };
  sprites: Record<string, SpriteInfo>;
  moves: Record<string, MoveInfo>;
  mySets: PokeSet[] | null;
  /** Both teams once the battle is over; before that only your own. */
  teams: { p1: PokeSet[] | null; p2: PokeSet[] | null };
  canClaimTimeout: boolean;
  createdAt: string;
  finishedAt: string | null;
};
export type BattleReply = BattleView | { unchanged: true; rev: number };

/* ================================================================== dex */

export const pokeDex = createServerFn({ method: "GET" }).handler(async () => {
  await requireMember();
  const eng = await loadEngine();
  return { list: eng.dexList() };
});

export const pokeSpecies = createServerFn({ method: "GET" })
  .validator(z.object({ name: z.string().min(1).max(60) }))
  .handler(async ({ data }): Promise<SpeciesDetail | null> => {
    await requireMember();
    const eng = await loadEngine();
    return eng.speciesDetail(data.name);
  });

export const pokeMoves = createServerFn({ method: "GET" })
  .validator(z.object({ species: z.string().min(1).max(60), gen: z.number().int().min(1).max(9) }))
  .handler(async ({ data }): Promise<MoveInfo[]> => {
    await requireMember();
    const eng = await loadEngine();
    return eng.speciesMoves(data.species, data.gen);
  });

export const pokeMoveInfo = createServerFn({ method: "GET" })
  .validator(z.object({ gen: z.number().int().min(1).max(9), names: z.array(z.string().max(40)).min(1).max(12) }))
  .handler(async ({ data }): Promise<Record<string, MoveInfo>> => {
    await requireMember();
    const eng = await loadEngine();
    return eng.moveInfosByName(data.names, data.gen);
  });

export const pokeItems = createServerFn({ method: "GET" })
  .validator(z.object({ gen: z.number().int().min(1).max(9) }))
  .handler(async ({ data }): Promise<ItemInfo[]> => {
    await requireMember();
    const eng = await loadEngine();
    return eng.itemsList(data.gen);
  });

export const pokeRandomTeam = createServerFn({ method: "POST" })
  .validator(z.object({ gen: z.number().int().min(1).max(9), size: z.number().int().min(1).max(6) }))
  .handler(async ({ data }): Promise<PokeSet[]> => {
    await requireMember();
    const eng = await loadEngine();
    return eng.randomSets(data.gen, data.size);
  });

/* ================================================================ teams */

export const listTeams = createServerFn({ method: "GET" }).handler(async (): Promise<PokeTeam[]> => {
  const me = await requireMember();
  return teamsOf(me.id);
});

async function teamsOf(ownerId: number): Promise<PokeTeam[]> {
  const sql = await getSql();
  const rows = await sql<{ id: number; name: string; gen: number; sets: unknown; updated_at: string | Date }>`
    select id, name, gen, sets, updated_at from poke_teams where owner_id = ${ownerId} order by updated_at desc limit 40
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, gen: r.gen, sets: json<PokeSet[]>(r.sets, []), updatedAt: iso(r.updated_at)! }));
}

export const saveTeam = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.number().int().positive().optional(),
      name: z.string().min(1).max(40),
      gen: z.number().int().min(1).max(9),
      sets: z.array(z.any()).min(1).max(6),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    const eng = await loadEngine();
    const sets = eng.normalizeTeam(data.gen, data.sets);
    const sql = await getSql();
    if (data.id) {
      const rows = await sql<{ id: number }>`
        update poke_teams set name = ${data.name.trim()}, gen = ${data.gen}, sets = ${JSON.stringify(sets)}::jsonb, updated_at = now()
        where id = ${data.id} and owner_id = ${me.id} returning id
      `;
      if (!rows[0]) throw new Error("টিমটি পাওয়া যায়নি");
      return { id: rows[0].id, sets };
    }
    const count = await sql<{ n: number }>`select count(*)::int as n from poke_teams where owner_id = ${me.id}`;
    if ((count[0]?.n ?? 0) >= 20) throw new Error("সর্বোচ্চ ২০টি টিম রাখা যায় — পুরোনো টিম মুছে ফেলুন");
    const rows = await sql<{ id: number }>`
      insert into poke_teams (owner_id, name, gen, sets) values (${me.id}, ${data.name.trim()}, ${data.gen}, ${JSON.stringify(sets)}::jsonb)
      returning id
    `;
    return { id: rows[0].id, sets };
  });

export const deleteTeam = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    await sql`delete from poke_teams where id = ${data.id} and owner_id = ${me.id}`;
    return { ok: true };
  });

/* ============================================================== helpers */

type BattleRow = {
  id: number;
  p1_id: number;
  p2_id: number | null;
  cpu_level: string | null;
  format: string;
  gen: number;
  status: "invited" | "active" | "done" | "declined";
  seed: unknown;
  p1_name: string;
  p2_name: string;
  p1_team: string | null;
  p2_team: string | null;
  p1_sets: unknown;
  p2_sets: unknown;
  sprites: unknown;
  moves: unknown;
  rounds: unknown;
  pending: unknown;
  log: unknown;
  requests: unknown;
  turn: number;
  winner: "p1" | "p2" | "tie" | null;
  end_reason: string | null;
  p1_left: number | null;
  p2_left: number | null;
  rev: number;
  created_at: string | Date;
  last_move_at: string | Date;
  finished_at: string | Date | null;
};

async function loadRow(id: number): Promise<BattleRow | null> {
  const sql = await getSql();
  const rows = await sql<BattleRow>`select * from poke_battles where id = ${id} limit 1`;
  return rows[0] ?? null;
}

async function peopleFor(ids: (number | null)[]): Promise<Map<number, PersonLite>> {
  const list = [...new Set(ids.filter((v): v is number => typeof v === "number"))];
  const out = new Map<number, PersonLite>();
  if (!list.length) return out;
  const sql = await getSql();
  const rows = await sql.query<{ id: number; username: string; display_name: string; avatar_id: number | null }>(
    `select id, username, display_name, avatar_id from members where id = any($1::int[])`,
    [list],
  );
  for (const r of rows) {
    out.set(r.id, { id: r.id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_id ? `/api/chat-image/${r.avatar_id}` : null });
  }
  return out;
}

const sideOf = (row: BattleRow, memberId: number): "p1" | "p2" | null =>
  row.p1_id === memberId ? "p1" : row.p2_id === memberId ? "p2" : null;

const needs = (req: BattleRequest | null | undefined) => !!req && !req.wait;

async function viewOf(row: BattleRow, meId: number, since: number): Promise<BattleView> {
  const you = sideOf(row, meId);
  const log = json<string[]>(row.log, []);
  const view = viewLines(log, you === "p1" ? 1 : you === "p2" ? 2 : 0);
  const requests = json<{ p1?: BattleRequest | null; p2?: BattleRequest | null }>(row.requests, {});
  const pending = json<{ p1?: string; p2?: string }>(row.pending, {});
  const done = row.status === "done";
  const other = you === "p1" ? "p2" : "p1";
  const myReq = you && row.status === "active" ? requests[you] ?? null : null;
  const iNeed = needs(myReq);
  const chosen = !!you && pending[you] !== undefined;
  const theyNeed = !!you && row.status === "active" && row.p2_id != null && needs(requests[other]) && pending[other] === undefined;
  const people = await peopleFor([row.p1_id, row.p2_id]);
  const moves = json<{ p1?: Record<string, MoveInfo>; p2?: Record<string, MoveInfo> }>(row.moves, {});
  const p1sets = json<PokeSet[] | null>(row.p1_sets, null);
  const p2sets = json<PokeSet[] | null>(row.p2_sets, null);
  const idle = (Date.now() - new Date(row.last_move_at).getTime()) / 1000;
  return {
    unchanged: false,
    id: row.id,
    rev: row.rev,
    status: row.status === "declined" ? "done" : row.status,
    gen: row.gen,
    you,
    names: { p1: row.p1_name, p2: row.p2_name },
    people: { p1: people.get(row.p1_id) ?? null, p2: row.p2_id ? people.get(row.p2_id) ?? null : null },
    cpu: row.p2_id == null,
    cpuLevel: (row.cpu_level as CpuLevel | null) ?? null,
    lines: view.slice(Math.max(0, since)),
    total: view.length,
    request: myReq,
    waitingFor: row.status !== "active" ? null : iNeed && !chosen ? "you" : theyNeed ? "opponent" : chosen ? "opponent" : null,
    chosen,
    turn: row.turn,
    winner: row.winner,
    endReason: row.end_reason,
    left: { p1: row.p1_left, p2: row.p2_left },
    sprites: json<Record<string, SpriteInfo>>(row.sprites, {}),
    moves: done ? { ...(moves.p1 ?? {}), ...(moves.p2 ?? {}) } : you ? (moves[you] ?? {}) : {},
    mySets: you === "p1" ? p1sets : you === "p2" ? p2sets : null,
    teams: { p1: done || you === "p1" ? p1sets : null, p2: done || you === "p2" ? p2sets : null },
    canClaimTimeout: !!you && theyNeed && idle > TIMEOUT_SECONDS,
    createdAt: iso(row.created_at)!,
    finishedAt: iso(row.finished_at),
  };
}

type EngineMod = Awaited<ReturnType<typeof loadEngine>>;

function setupOf(row: BattleRow) {
  return {
    format: row.format,
    seed: json<number[]>(row.seed, [1, 2, 3, 4]),
    p1: { name: row.p1_name, team: row.p1_team ?? "" },
    p2: { name: row.p2_name, team: row.p2_team ?? "" },
  };
}

/** The team a member brings to a battle: one of their saved teams, or a random one. */
async function resolveTeam(
  eng: EngineMod,
  ownerId: number,
  gen: number,
  pick: { kind: "saved" | "random"; id?: number; size?: number },
): Promise<PokeSet[]> {
  if (pick.kind === "random") {
    const sets = eng.randomSets(gen, pick.size ?? 6);
    if (!sets.length) throw new Error("র‍্যান্ডম টিম বানানো গেল না, আবার চেষ্টা করুন");
    return sets;
  }
  const sql = await getSql();
  const rows = await sql<{ gen: number; sets: unknown }>`select gen, sets from poke_teams where id = ${pick.id ?? 0} and owner_id = ${ownerId} limit 1`;
  if (!rows[0]) throw new Error("টিমটি পাওয়া যায়নি");
  if (rows[0].gen !== gen) throw new Error(`এই টিমটি জেন ${rows[0].gen}-এর, জেন ${gen}-এর নয়`);
  return eng.normalizeTeam(gen, json<unknown[]>(rows[0].sets, []));
}

const teamPick = z.object({
  kind: z.enum(["saved", "random"]),
  id: z.number().int().positive().optional(),
  size: z.number().int().min(1).max(6).optional(),
});

function bundle(eng: EngineMod, gen: number, a: PokeSet[], b: PokeSet[]) {
  const names = [...a, ...b].map((s) => s.species);
  return {
    sprites: eng.spriteMapFor(names, gen),
    moves: { p1: eng.moveMapFor(a, gen), p2: eng.moveMapFor(b, gen) },
  };
}

/* ================================================================ lobby */

export const lobby = createServerFn({ method: "GET" }).handler(async (): Promise<LobbyData> => {
  const me = await requireMember();
  const sql = await getSql();
  const teams = await teamsOf(me.id);
  const rows = await sql<BattleRow>`
    select * from poke_battles
    where (p1_id = ${me.id} or p2_id = ${me.id}) and status <> 'declined'
    order by (status = 'done'), last_move_at desc
    limit 30
  `;
  const people = await peopleFor(rows.flatMap((r) => [r.p1_id, r.p2_id]));
  const battles: BattleListItem[] = [];
  const invites: Invite[] = [];
  for (const r of rows) {
    const you = sideOf(r, me.id)!;
    if (r.status === "invited" && you === "p2") {
      const from = people.get(r.p1_id);
      if (from) invites.push({ id: r.id, from, gen: r.gen, createdAt: iso(r.created_at)! });
      continue;
    }
    const opponentId = you === "p1" ? r.p2_id : r.p1_id;
    const requests = json<{ p1?: BattleRequest | null; p2?: BattleRequest | null }>(r.requests, {});
    const pending = json<{ p1?: string; p2?: string }>(r.pending, {});
    battles.push({
      id: r.id,
      status: r.status === "declined" ? "done" : r.status,
      gen: r.gen,
      you,
      opponent: opponentId ? people.get(opponentId)?.displayName ?? "?" : "CPU",
      opponentId,
      cpu: r.p2_id == null,
      turn: r.turn,
      yourTurn: r.status === "active" && needs(requests[you]) && pending[you] === undefined,
      result: r.status !== "done" ? null : r.winner === "tie" || !r.winner ? "tie" : r.winner === you ? "win" : "loss",
      createdAt: iso(r.created_at)!,
      lastMoveAt: iso(r.last_move_at)!,
    });
  }
  const mem = await sql<{ id: number; username: string; display_name: string; avatar_id: number | null }>`
    select id, username, display_name, avatar_id from members where role <> 'guest' and id <> ${me.id} order by lower(display_name) limit 200
  `;
  const members: PersonLite[] = mem.map((m) => ({
    id: m.id,
    username: m.username,
    displayName: m.display_name,
    avatarUrl: m.avatar_id ? `/api/chat-image/${m.avatar_id}` : null,
  }));
  return { teams, battles, invites, members };
});

/* ============================================================= start one */

export const createBattle = createServerFn({ method: "POST" })
  .validator(
    z.object({
      gen: z.number().int().min(1).max(9),
      mode: z.enum(["cpu", "pvp"]),
      cpuLevel: z.enum(["easy", "normal", "hard"]).default("normal"),
      opponentId: z.number().int().positive().optional(),
      team: teamPick,
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    const eng = await loadEngine();
    const sql = await getSql();
    const format = formatByGen(data.gen).id;
    const mine = await resolveTeam(eng, me.id, data.gen, data.team);
    const myName = cleanName(me.displayName);
    const seed = JSON.stringify(eng.newSeed());

    if (data.mode === "pvp") {
      if (!data.opponentId || data.opponentId === me.id) throw new Error("প্রতিপক্ষ বেছে নিন");
      const people = await peopleFor([data.opponentId]);
      const opp = people.get(data.opponentId);
      if (!opp) throw new Error("সদস্যকে পাওয়া যায়নি");
      let oppName = cleanName(opp.displayName);
      if (oppName === myName) oppName = `${oppName} ②`;
      const rows = await sql<{ id: number }>`
        insert into poke_battles (p1_id, p2_id, format, gen, status, seed, p1_name, p2_name, p1_team, p1_sets)
        values (${me.id}, ${data.opponentId}, ${format}, ${data.gen}, 'invited', ${seed}::jsonb, ${myName}, ${oppName},
                ${eng.packSets(mine)}, ${JSON.stringify(mine)}::jsonb)
        returning id
      `;
      return { id: rows[0].id, status: "invited" as const };
    }

    const foe = eng.randomSets(data.gen, mine.length);
    if (!foe.length) throw new Error("CPU-র টিম বানানো গেল না, আবার চেষ্টা করুন");
    const setup = {
      format,
      seed: JSON.parse(seed) as number[],
      p1: { name: myName, team: eng.packSets(mine) },
      p2: { name: myName === "CPU" ? "CPU ②" : "CPU", team: eng.packSets(foe) },
    };
    const init = eng.initBattle(setup);
    const extra = bundle(eng, data.gen, mine, foe);
    const rows = await sql<{ id: number }>`
      insert into poke_battles (p1_id, p2_id, cpu_level, format, gen, status, seed, p1_name, p2_name, p1_team, p2_team, p1_sets, p2_sets,
                                sprites, moves, rounds, log, requests, turn)
      values (${me.id}, null, ${data.cpuLevel}, ${format}, ${data.gen}, 'active', ${seed}::jsonb, ${setup.p1.name}, ${setup.p2.name},
              ${setup.p1.team}, ${setup.p2.team}, ${JSON.stringify(mine)}::jsonb, ${JSON.stringify(foe)}::jsonb,
              ${JSON.stringify(extra.sprites)}::jsonb, ${JSON.stringify(extra.moves)}::jsonb, ${JSON.stringify(init.rounds)}::jsonb,
              ${JSON.stringify(init.snapshot.lines)}::jsonb, ${JSON.stringify(init.snapshot.requests)}::jsonb, ${init.snapshot.turn})
      returning id
    `;
    return { id: rows[0].id, status: "active" as const };
  });

export const answerChallenge = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), accept: z.boolean(), team: teamPick.optional() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    const row = await loadRow(data.id);
    if (!row || row.status !== "invited" || row.p2_id !== me.id) throw new Error("এই চ্যালেঞ্জটি আর নেই");
    if (!data.accept) {
      await sql`update poke_battles set status = 'declined', rev = rev + 1 where id = ${row.id} and status = 'invited'`;
      return { id: row.id, status: "declined" as const };
    }
    if (!data.team) throw new Error("আপনার টিম বেছে নিন");
    const eng = await loadEngine();
    const theirs = await resolveTeam(eng, me.id, row.gen, data.team);
    const mine = eng.normalizeTeam(row.gen, json<unknown[]>(row.p1_sets, []));
    const setup = {
      format: row.format,
      seed: json<number[]>(row.seed, [1, 2, 3, 4]),
      p1: { name: row.p1_name, team: row.p1_team ?? eng.packSets(mine) },
      p2: { name: row.p2_name, team: eng.packSets(theirs) },
    };
    const init = eng.initBattle(setup);
    const extra = bundle(eng, row.gen, mine, theirs);
    const updated = await sql<{ id: number }>`
      update poke_battles set status = 'active', p2_team = ${setup.p2.team}, p2_sets = ${JSON.stringify(theirs)}::jsonb,
        sprites = ${JSON.stringify(extra.sprites)}::jsonb, moves = ${JSON.stringify(extra.moves)}::jsonb,
        rounds = ${JSON.stringify(init.rounds)}::jsonb, log = ${JSON.stringify(init.snapshot.lines)}::jsonb,
        requests = ${JSON.stringify(init.snapshot.requests)}::jsonb, turn = ${init.snapshot.turn},
        last_move_at = now(), rev = rev + 1
      where id = ${row.id} and status = 'invited' returning id
    `;
    if (!updated[0]) throw new Error("এই চ্যালেঞ্জটি আর নেই");
    return { id: row.id, status: "active" as const };
  });

export const cancelChallenge = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    await sql`delete from poke_battles where id = ${data.id} and p1_id = ${me.id} and status = 'invited'`;
    return { ok: true };
  });

/* ================================================================ battle */

export const getBattle = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number().int().positive(), since: z.number().int().min(0).default(0), rev: z.number().int().optional() }))
  .handler(async ({ data }): Promise<BattleReply> => {
    const me = await requireMember();
    if (data.rev !== undefined) {
      // Cheap check first, so waiting for the other player does not re-send the whole log every few seconds.
      const sql = await getSql();
      const head = await sql<{ rev: number }>`select rev from poke_battles where id = ${data.id} limit 1`;
      if (head[0] && head[0].rev === data.rev) return { unchanged: true, rev: data.rev };
    }
    const row = await loadRow(data.id);
    if (!row || row.status === "declined") throw new Error("লড়াইটি পাওয়া যায়নি");
    const you = sideOf(row, me.id);
    if (!you && row.status !== "done") throw new Error("চলতি লড়াই শুধু যারা খেলছে তারাই দেখতে পারবে");
    return viewOf(row, me.id, data.since);
  });

const choiceRx = /^(default|switch [1-6]|move [1-4]( (mega|megax|megay|ultra|zmove|dynamax|terastallize))?)$/;

async function persist(
  row: BattleRow,
  res: ReturnType<EngineMod["advance"]>,
): Promise<boolean> {
  const sql = await getSql();
  const snap = res.snapshot;
  const winnerId = snap.winner === "p1" ? row.p1_id : snap.winner === "p2" ? row.p2_id : null;
  const rows = await sql.query<{ rev: number }>(
    `update poke_battles set
       rounds = $3::jsonb, pending = $4::jsonb,
       log = case when $5::boolean then $6::jsonb else log end,
       requests = case when $5::boolean then $7::jsonb else requests end,
       turn = case when $5::boolean then $8::int else turn end,
       last_move_at = case when $5::boolean then now() else last_move_at end,
       status = case when $9::boolean then 'done' else status end,
       winner = case when $9::boolean then $10::text else winner end,
       winner_id = case when $9::boolean then $11::int else winner_id end,
       end_reason = case when $9::boolean then 'normal' else end_reason end,
       p1_left = case when $9::boolean then $12::int else p1_left end,
       p2_left = case when $9::boolean then $13::int else p2_left end,
       finished_at = case when $9::boolean then now() else finished_at end,
       rev = rev + 1
     where id = $1 and rev = $2 and status = 'active'
     returning rev`,
    [
      row.id,
      row.rev,
      JSON.stringify(res.rounds),
      JSON.stringify(res.pending),
      res.progressed,
      JSON.stringify(snap.lines),
      JSON.stringify(snap.requests),
      snap.turn,
      snap.ended,
      snap.winner,
      winnerId,
      snap.left.p1,
      snap.left.p2,
    ],
  );
  return rows.length > 0;
}

export const submitChoice = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), choice: z.string().regex(choiceRx), since: z.number().int().min(0).default(0) }))
  .handler(async ({ data }): Promise<BattleView> => {
    const me = await requireMember();
    const eng = await loadEngine();
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await loadRow(data.id);
      if (!row) throw new Error("লড়াইটি পাওয়া যায়নি");
      const you = sideOf(row, me.id);
      if (!you) throw new Error("আপনি এই লড়াইয়ের খেলোয়াড় নন");
      if (row.status !== "active") throw new Error("লড়াইটি এখন চলছে না");
      const res = eng.advance({
        setup: setupOf(row),
        rounds: json<[string, string][]>(row.rounds, []),
        pending: json<{ p1?: string; p2?: string }>(row.pending, {}),
        cpu: row.p2_id == null ? ((row.cpu_level as CpuLevel) ?? "normal") : null,
        choose: { side: you, choice: data.choice },
      });
      if (!res.ok) throw new Error(res.error ?? "অবৈধ চাল");
      if (await persist(row, res)) {
        const fresh = await loadRow(data.id);
        return viewOf(fresh!, me.id, data.since);
      }
      // Someone else's choice landed at the same moment: run it again on top of theirs.
    }
    throw new Error("একই সময়ে অনেক কিছু হচ্ছে — আবার চেষ্টা করুন");
  });

async function endEarly(id: number, meId: number, reason: "forfeit" | "timeout", since: number): Promise<BattleView> {
  const sql = await getSql();
  const row = await loadRow(id);
  if (!row || row.status !== "active") throw new Error("লড়াইটি এখন চলছে না");
  const you = sideOf(row, meId);
  if (!you) throw new Error("আপনি এই লড়াইয়ের খেলোয়াড় নন");
  const winnerSide = reason === "forfeit" ? (you === "p1" ? "p2" : "p1") : you;
  const loserName = winnerSide === "p1" ? row.p2_name : row.p1_name;
  const winnerName = winnerSide === "p1" ? row.p1_name : row.p2_name;
  const log = json<string[]>(row.log, []);
  log.push(
    `|message|${loserName} ${reason === "forfeit" ? "হার মেনে নিয়েছে" : "সময়মতো চাল দেয়নি"}`,
    `|win|${winnerName}`,
  );
  const winnerId = winnerSide === "p1" ? row.p1_id : row.p2_id;
  await sql.query(
    `update poke_battles set status = 'done', winner = $2, winner_id = $3, end_reason = $4, finished_at = now(),
       log = $5::jsonb, requests = '{}'::jsonb, pending = '{}'::jsonb, rev = rev + 1
     where id = $1 and status = 'active'`,
    [id, winnerSide, winnerId, reason, JSON.stringify(log)],
  );
  const fresh = await loadRow(id);
  return viewOf(fresh!, meId, since);
}

export const forfeitBattle = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), since: z.number().int().min(0).default(0) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    return endEarly(data.id, me.id, "forfeit", data.since);
  });

export const claimTimeout = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), since: z.number().int().min(0).default(0) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const row = await loadRow(data.id);
    if (!row) throw new Error("লড়াইটি পাওয়া যায়নি");
    const view = await viewOf(row, me.id, 0);
    if (!view.canClaimTimeout) throw new Error("এখনও প্রতিপক্ষকে অপেক্ষার সময় দেওয়া হয়েছে");
    return endEarly(data.id, me.id, "timeout", data.since);
  });

/* ================================================================ board */

export type BoardRow = {
  memberId: number;
  name: string;
  username: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  games: number;
  streak: number;
  bestStreak: number;
  cpuLosses: number;
  flawless: number;
};
export type FeedItem = {
  id: number;
  finishedAt: string;
  winner: string;
  loser: string;
  winnerCpu: boolean;
  loserCpu: boolean;
  turns: number;
  winnerLeft: number | null;
  loserLeft: number | null;
  gen: number;
  reason: string;
  tie: boolean;
  flawless: boolean;
};
export type BoardData = { rows: BoardRow[]; feed: FeedItem[] };

export const board = createServerFn({ method: "GET" })
  .validator(z.object({ scope: z.enum(["all", "pvp"]).default("all") }))
  .handler(async ({ data }): Promise<BoardData> => {
    await requireMember();
    const sql = await getSql();
    const rows = await sql<BattleRow & { p1_size: number | null; p2_size: number | null }>`
      select id, p1_id, p2_id, p1_name, p2_name, gen, winner, turn, end_reason, p1_left, p2_left, finished_at,
        jsonb_array_length(coalesce(p1_sets, '[]'::jsonb)) as p1_size, jsonb_array_length(coalesce(p2_sets, '[]'::jsonb)) as p2_size
      from poke_battles where status = 'done' order by finished_at asc limit 3000
    `;
    const people = await peopleFor(rows.flatMap((r) => [r.p1_id, r.p2_id]));
    const stats = new Map<number, BoardRow>();
    const ensure = (id: number): BoardRow => {
      let s = stats.get(id);
      if (!s) {
        const p = people.get(id);
        s = { memberId: id, name: p?.displayName ?? "?", username: p?.username ?? "", avatarUrl: p?.avatarUrl ?? null, wins: 0, losses: 0, ties: 0, games: 0, streak: 0, bestStreak: 0, cpuLosses: 0, flawless: 0 };
        stats.set(id, s);
      }
      return s;
    };
    const feed: FeedItem[] = [];
    for (const r of rows) {
      const cpu = r.p2_id == null;
      const tie = r.winner === "tie" || !r.winner;
      if (data.scope === "pvp" && cpu) continue;
      const winSide: "p1" | "p2" | null = r.winner === "p1" || r.winner === "p2" ? r.winner : null;
      for (const side of ["p1", "p2"] as const) {
        const id = side === "p1" ? r.p1_id : r.p2_id;
        if (id == null) continue;
        const s = ensure(id);
        s.games++;
        if (tie) {
          s.ties++;
          s.streak = 0;
        } else if (winSide === side) {
          s.wins++;
          s.streak = s.streak > 0 ? s.streak + 1 : 1;
          s.bestStreak = Math.max(s.bestStreak, s.streak);
          const mineLeft = side === "p1" ? r.p1_left : r.p2_left;
          const mineSize = side === "p1" ? r.p1_size : r.p2_size;
          if (r.end_reason === "normal" && mineSize && mineLeft === mineSize) s.flawless++;
        } else {
          s.losses++;
          s.streak = s.streak < 0 ? s.streak - 1 : -1;
          if (cpu) s.cpuLosses++;
        }
      }
      const wId = winSide === "p1" ? r.p1_id : winSide === "p2" ? r.p2_id : r.p1_id;
      const lId = winSide === "p1" ? r.p2_id : winSide === "p2" ? r.p1_id : r.p2_id;
      const nameOf = (id: number | null, side: "p1" | "p2") => (id == null ? "CPU" : people.get(id)?.displayName ?? (side === "p1" ? r.p1_name : r.p2_name));
      const wSide: "p1" | "p2" = winSide ?? "p1";
      const lSide: "p1" | "p2" = wSide === "p1" ? "p2" : "p1";
      const wSize = wSide === "p1" ? r.p1_size : r.p2_size;
      const wLeft = wSide === "p1" ? r.p1_left : r.p2_left;
      feed.push({
        id: r.id,
        finishedAt: iso(r.finished_at)!,
        winner: nameOf(wId, wSide),
        loser: nameOf(lId, lSide),
        winnerCpu: wId == null,
        loserCpu: lId == null,
        turns: r.turn,
        winnerLeft: wSide === "p1" ? r.p1_left : r.p2_left,
        loserLeft: lSide === "p1" ? r.p1_left : r.p2_left,
        gen: r.gen,
        reason: r.end_reason ?? "normal",
        tie,
        flawless: !tie && r.end_reason === "normal" && !!wSize && wLeft === wSize,
      });
    }
    const list = [...stats.values()].sort(
      (a, b) => b.wins - a.wins || (b.games ? b.wins / b.games : 0) - (a.games ? a.wins / a.games : 0) || a.losses - b.losses,
    );
    return { rows: list, feed: feed.reverse().slice(0, 30) };
  });

export const engineStatus = createServerFn({ method: "GET" }).handler(async () => {
  await requireMember();
  try {
    const eng = await import("@/lib/pokemon/engine.server");
    return { ok: true as const, version: eng.engineVersion() };
  } catch (e) {
    console.error("pokemon engine check failed", e);
    return { ok: false as const, error: ENGINE_DOWN };
  }
});
