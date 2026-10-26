import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireMember } from "@/lib/members-core";
import { ROSTER, TERA_TYPES, gimmicksFor } from "@/lib/pokemon/arena-data";

/**
 * Arena Brawl multiplayer lobby: rooms for 2-5 members. The lobby lives in the database; once the host starts the
 * fight the members connect to each other directly (WebRTC, signaled through /api/rtc).
 */

export type ArenaPick = { species: string; gimmick: string; mega: string; tera: string };
export type ArenaSeat = ArenaPick & { memberId: number; name: string; avatarUrl: string | null; host: boolean };
export type ArenaRoomView = {
  id: number;
  hostId: number;
  max: number;
  status: "open" | "playing" | "done";
  round: number;
  seats: ArenaSeat[];
  /** The signaling room name to use while the fight runs. */
  rtcRoom: string;
  you: number;
};
export type ArenaRoomListItem = { id: number; host: string; max: number; count: number; names: string[] };
export type ArenaLobby = { rooms: ArenaRoomListItem[]; mine: number | null };

/** A seat that has not pinged for this long is empty (closed tab, lost connection). */
const SEAT_TTL_S = 30;

const pickSchema = z.object({
  species: z.string().max(40),
  gimmick: z.string().max(12),
  mega: z.string().max(40).default(""),
  tera: z.string().max(12).default(""),
});

function cleanPick(p: z.infer<typeof pickSchema>): ArenaPick {
  const sp = ROSTER.find((s) => s.id === p.species && !s.unlock) ?? ROSTER.find((s) => !s.unlock) ?? ROSTER[0]!;
  const allowed = gimmicksFor(sp.id) as string[];
  const gimmick = allowed.includes(p.gimmick) ? p.gimmick : "awaken";
  return { species: sp.id, gimmick, mega: p.mega, tera: TERA_TYPES.includes(p.tera) ? p.tera : (sp.types[0] ?? "Normal") };
}

async function sweep() {
  const sql = await getSql();
  await sql`delete from arena_room_players where seen_at < now() - make_interval(secs => ${SEAT_TTL_S})`;
  // a room whose host left is gone; a room nobody sits in is gone
  await sql`delete from arena_rooms r where not exists (select 1 from arena_room_players p where p.room_id = r.id and p.member_id = r.host_id)`;
  await sql`delete from arena_rooms where updated_at < now() - interval '3 hours'`;
}

type RoomRow = { id: number; host_id: number; max_players: number; status: "open" | "playing" | "done"; round: number };

async function viewOf(room: RoomRow, youId: number): Promise<ArenaRoomView> {
  const sql = await getSql();
  const rows = await sql<{ member_id: number; species: string; gimmick: string; mega: string; tera: string; display_name: string; avatar_id: number | null }>`
    select p.member_id, p.species, p.gimmick, p.mega, p.tera, m.display_name, m.avatar_id
    from arena_room_players p join members m on m.id = p.member_id
    where p.room_id = ${room.id} order by p.joined_at
  `;
  return {
    id: room.id,
    hostId: room.host_id,
    max: room.max_players,
    status: room.status,
    round: room.round,
    rtcRoom: `arena-${room.id}-${room.round}`,
    you: youId,
    seats: rows.map((r) => ({
      memberId: r.member_id,
      name: r.display_name,
      avatarUrl: r.avatar_id ? `/api/chat-image/${r.avatar_id}` : null,
      host: r.member_id === room.host_id,
      species: r.species,
      gimmick: r.gimmick,
      mega: r.mega,
      tera: r.tera,
    })),
  };
}

async function roomOf(id: number): Promise<RoomRow> {
  const sql = await getSql();
  const rows = await sql<RoomRow>`select id, host_id, max_players, status, round from arena_rooms where id = ${id}`;
  if (!rows[0]) throw new Error("এই রুমটি আর নেই / This room is gone");
  return rows[0];
}

export const arenaLobby = createServerFn({ method: "GET" }).handler(async (): Promise<ArenaLobby> => {
  const me = await requireMember();
  await sweep();
  const sql = await getSql();
  const rooms = await sql<{ id: number; max_players: number; host: string; names: string[] | string | null }>`
    select r.id, r.max_players, h.display_name as host,
      (select array_agg(m.display_name order by p.joined_at) from arena_room_players p join members m on m.id = p.member_id where p.room_id = r.id) as names
    from arena_rooms r join members h on h.id = r.host_id
    where r.status = 'open'
    order by r.updated_at desc limit 30
  `;
  const mine = await sql<{ room_id: number }>`select room_id from arena_room_players where member_id = ${me.id} limit 1`;
  // some drivers hand an array column back as the text "{a,b}"
  const listOf = (v: string[] | string | null): string[] => (Array.isArray(v) ? v : typeof v === "string" ? v.replace(/^\{|\}$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).filter(Boolean) : []);
  return {
    rooms: rooms.map((r) => ({ id: r.id, host: r.host, max: r.max_players, count: listOf(r.names).length, names: listOf(r.names) })).filter((r) => r.count < r.max || mine[0]?.room_id === r.id),
    mine: mine[0]?.room_id ?? null,
  };
});

export const arenaCreate = createServerFn({ method: "POST" })
  .validator(z.object({ max: z.number().int().min(2).max(5), pick: pickSchema }))
  .handler(async ({ data }): Promise<ArenaRoomView> => {
    const me = await requireMember();
    const sql = await getSql();
    await sweep();
    await sql`delete from arena_room_players where member_id = ${me.id}`;
    await sql`delete from arena_rooms r where host_id = ${me.id}`;
    const made = await sql<RoomRow>`
      insert into arena_rooms (host_id, max_players) values (${me.id}, ${data.max})
      returning id, host_id, max_players, status, round
    `;
    const room = made[0]!;
    const p = cleanPick(data.pick);
    await sql`insert into arena_room_players (room_id, member_id, species, gimmick, mega, tera) values (${room.id}, ${me.id}, ${p.species}, ${p.gimmick}, ${p.mega}, ${p.tera})`;
    return viewOf(room, me.id);
  });

export const arenaJoin = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int(), pick: pickSchema }))
  .handler(async ({ data }): Promise<ArenaRoomView> => {
    const me = await requireMember();
    const sql = await getSql();
    await sweep();
    const room = await roomOf(data.id);
    const seated = await sql<{ member_id: number }>`select member_id from arena_room_players where room_id = ${room.id}`;
    const already = seated.some((s) => s.member_id === me.id);
    if (!already) {
      if (room.status !== "open") throw new Error("লড়াই শুরু হয়ে গেছে / The fight has already started");
      if (seated.length >= room.max_players) throw new Error("রুম ভরে গেছে / The room is full");
      await sql`delete from arena_room_players where member_id = ${me.id}`;
      const p = cleanPick(data.pick);
      await sql`insert into arena_room_players (room_id, member_id, species, gimmick, mega, tera) values (${room.id}, ${me.id}, ${p.species}, ${p.gimmick}, ${p.mega}, ${p.tera})`;
      await sql`update arena_rooms set updated_at = now() where id = ${room.id}`;
    }
    return viewOf(room, me.id);
  });

/** Polled every second or so by everybody in the room: it is also the "I am still here" ping. */
export const arenaRoomGet = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }): Promise<ArenaRoomView | null> => {
    const me = await requireMember();
    const sql = await getSql();
    await sql`update arena_room_players set seen_at = now() where room_id = ${data.id} and member_id = ${me.id}`;
    await sweep();
    const rows = await sql<RoomRow>`select id, host_id, max_players, status, round from arena_rooms where id = ${data.id}`;
    if (!rows[0]) return null;
    const v = await viewOf(rows[0], me.id);
    return v.seats.some((s) => s.memberId === me.id) ? v : null;
  });

export const arenaPickSet = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int(), pick: pickSchema }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    const room = await roomOf(data.id);
    if (room.status !== "open") return { ok: false };
    const p = cleanPick(data.pick);
    await sql`update arena_room_players set species = ${p.species}, gimmick = ${p.gimmick}, mega = ${p.mega}, tera = ${p.tera} where room_id = ${data.id} and member_id = ${me.id}`;
    return { ok: true };
  });

export const arenaLeave = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    await sql`delete from arena_room_players where room_id = ${data.id} and member_id = ${me.id}`;
    await sweep();
    return { ok: true };
  });

export const arenaStart = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }): Promise<ArenaRoomView> => {
    const me = await requireMember();
    const sql = await getSql();
    const room = await roomOf(data.id);
    if (room.host_id !== me.id) throw new Error("শুধু হোস্ট শুরু করতে পারে / Only the host can start");
    const n = await sql<{ c: number }>`select count(*)::int as c from arena_room_players where room_id = ${room.id}`;
    if ((n[0]?.c ?? 0) < 2) throw new Error("কমপক্ষে ২ জন লাগবে / At least 2 players are needed");
    await sql`update arena_rooms set status = 'playing', updated_at = now() where id = ${room.id}`;
    return viewOf({ ...room, status: "playing" }, me.id);
  });

/** Back to the lobby for another round, keeping everyone seated. */
export const arenaRematch = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }): Promise<ArenaRoomView> => {
    const me = await requireMember();
    const sql = await getSql();
    const room = await roomOf(data.id);
    if (room.host_id !== me.id) throw new Error("শুধু হোস্ট / Only the host can do this");
    await sql`update arena_rooms set status = 'open', round = round + 1, updated_at = now() where id = ${room.id}`;
    return viewOf({ ...room, status: "open", round: room.round + 1 }, me.id);
  });
