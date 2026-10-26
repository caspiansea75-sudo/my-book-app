import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * WebRTC signaling relay for Arena Brawl rooms. It only passes small "offer / answer / ice" notes between
 * the members of one room; the game itself then flows directly from browser to browser.
 * Room names look like `arena-<roomId>-<round>` and only the members seated in that room may use them.
 */
const PEER_TTL_S = 20;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function authorise(request: Request, room: string, peer: string) {
  const { memberFromCookieHeader } = await import("@/lib/members-core");
  const me = await memberFromCookieHeader(request.headers.get("cookie"));
  if (!me || me.role === "guest") return null;
  if (peer !== `m${me.id}`) return null;
  const m = /^arena-(\d+)-(\d+)$/.exec(room);
  if (!m) return null;
  const sql = await getSql();
  const ok = await sql`select 1 from arena_room_players where room_id = ${Number(m[1])} and member_id = ${me.id}`;
  return ok.length ? me : null;
}

export const Route = createFileRoute("/api/rtc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const room = u.searchParams.get("room") ?? "";
        const peer = u.searchParams.get("peer") ?? "";
        const since = Number(u.searchParams.get("since") ?? 0) || 0;
        const me = await authorise(request, room, peer);
        if (!me) return json({ error: "forbidden" }, 403);
        const name = (u.searchParams.get("name") || me.displayName).slice(0, 40);
        const sql = await getSql();
        await sql`
          insert into rtc_peers (room, peer, name, seen_at) values (${room}, ${peer}, ${name}, now())
          on conflict (room, peer) do update set name = excluded.name, seen_at = now()
        `;
        await sql`delete from rtc_peers where room = ${room} and seen_at < now() - make_interval(secs => ${PEER_TTL_S})`;
        const peers = await sql<{ id: string; name: string }>`select peer as id, name from rtc_peers where room = ${room}`;
        const sig = await sql<{ id: number; from: string; kind: string; payload: unknown }>`
          select id, from_peer as "from", kind, payload from rtc_signals
          where room = ${room} and to_peer = ${peer} and id > ${since} order by id limit 200
        `;
        if (Math.random() < 0.05) await sql`delete from rtc_signals where created_at < now() - interval '10 minutes'`;
        return json({ peers, signals: sig.map((s) => ({ ...s, id: Number(s.id) })) });
      },
      POST: async ({ request }) => {
        let b: { op?: string; room?: string; peer?: string; from?: string; to?: string; kind?: string; payload?: unknown };
        try {
          b = await request.json();
        } catch {
          return json({ error: "bad json" }, 400);
        }
        const room = b.room ?? "";
        const sql = await getSql();
        if (b.op === "leave") {
          const me = await authorise(request, room, b.peer ?? "");
          if (!me) return json({ error: "forbidden" }, 403);
          await sql`delete from rtc_peers where room = ${room} and peer = ${b.peer!}`;
          return json({ ok: true });
        }
        if (b.op === "signal") {
          const me = await authorise(request, room, b.from ?? "");
          if (!me) return json({ error: "forbidden" }, 403);
          if (!b.to || !["offer", "answer", "ice"].includes(b.kind ?? "")) return json({ error: "bad signal" }, 400);
          await sql`
            insert into rtc_signals (room, from_peer, to_peer, kind, payload)
            values (${room}, ${b.from!}, ${b.to}, ${b.kind!}, ${JSON.stringify(b.payload ?? null)}::jsonb)
          `;
          return json({ ok: true });
        }
        return json({ error: "unknown op" }, 400);
      },
    },
  },
});
