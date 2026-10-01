import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { requireMember } from "@/lib/members-core";

/** A member counts as online if their open tab checked in within this many seconds. */
export const ONLINE_WINDOW_SECONDS = 75;

export type PresenceRow = { id: number; online: boolean; secondsAgo: number | null };

/** Called every ~30 s by every signed-in member's open tab. */
export const sendHeartbeat = createServerFn({ method: "POST" }).handler(async (): Promise<{ ok: true }> => {
  const me = await requireMember();
  const sql = await getSql();
  // Skip the write if we just wrote (keeps the database quiet).
  await sql`
    update members set last_seen_at = now()
    where id = ${me.id} and (last_seen_at is null or last_seen_at < now() - interval '15 seconds')
  `;
  return { ok: true };
});

/** Who is online right now. Admin only — everyone else gets an error. */
export const listPresence = createServerFn({ method: "GET" }).handler(async (): Promise<PresenceRow[]> => {
  const me = await requireMember();
  if (me.role !== "admin") throw new Error("এই তথ্য শুধু অ্যাডমিনের জন্য");
  const sql = await getSql();
  const rows = await sql<{ id: number; ago: number | string | null }>`
    select id, extract(epoch from (now() - last_seen_at))::int as ago from members
  `;
  return rows.map((r) => {
    const ago = r.ago == null ? null : Number(r.ago);
    return { id: r.id, secondsAgo: ago, online: ago != null && ago <= ONLINE_WINDOW_SECONDS };
  });
});
