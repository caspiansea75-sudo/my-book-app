import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { assertBookAccess, assertSeriesAccess, requireMember } from "@/lib/members-core";

/**
 * Mark a story or a manga as 18+ (or not) by hand. The owner or the admin can do it.
 * Nothing is ever marked automatically: a new story / manga starts as "not 18+".
 */
export const setAdult = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kind: z.enum(["book", "manga"]),
      key: z.string().min(1).max(200),
      adult: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    if (data.kind === "book") await assertBookAccess(me, data.key);
    else await assertSeriesAccess(me, data.key);
    const sql = await getSql();
    await sql`
      insert into adult_flags (kind, key, adult)
      values (${data.kind}, ${data.key}, ${data.adult})
      on conflict (kind, key) do update set adult = excluded.adult
    `;
    return { ok: true, adult: data.adult };
  });
