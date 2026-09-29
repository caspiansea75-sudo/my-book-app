import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireMember } from "@/lib/members-core";

/** Admin only: hide something from every member, or show it again. */
export const setHidden = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kind: z.enum(["book", "manga", "media"]),
      key: z.string().min(1).max(200),
      hidden: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    if (me.role !== "admin") throw new Error("শুধু অ্যাডমিন লুকাতে বা দেখাতে পারবেন");
    const sql = await getSql();
    if (data.hidden) {
      await sql`insert into hidden_items (kind, key) values (${data.kind}, ${data.key}) on conflict do nothing`;
    } else {
      await sql`delete from hidden_items where kind = ${data.kind} and key = ${data.key}`;
    }
    return { ok: true };
  });
