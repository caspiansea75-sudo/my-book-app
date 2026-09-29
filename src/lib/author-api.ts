import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCanonBook } from "@/lib/book";
import { getSql } from "@/lib/db";
import { assertBookAccess, assertSeriesAccess, requireMember } from "@/lib/members-core";

/** Set the writer name shown on a story or manga. Owner or admin only; original (JSON) stories: admin. */
export const setAuthor = createServerFn({ method: "POST" })
  .validator(
    z.object({ kind: z.enum(["book", "manga"]), slug: z.string().min(1), author: z.string().trim().max(80) }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    if (data.kind === "manga") {
      await assertSeriesAccess(me, data.slug);
      await sql`update manga_series set author = ${data.author} where slug = ${data.slug}`;
      return { ok: true };
    }
    await assertBookAccess(me, data.slug);
    const studio = await sql<{ id: number }>`select id from library_books where slug = ${data.slug} limit 1`;
    if (studio[0]) {
      await sql`update library_books set author = ${data.author} where slug = ${data.slug}`;
    } else if (getCanonBook(data.slug)) {
      if (!data.author) {
        await sql`delete from author_overrides where kind = 'book' and key = ${data.slug}`;
      } else {
        await sql`
          insert into author_overrides (kind, key, author) values ('book', ${data.slug}, ${data.author})
          on conflict (kind, key) do update set author = excluded.author
        `;
      }
    } else {
      throw new Error("বইটি পাওয়া যায়নি");
    }
    return { ok: true };
  });
