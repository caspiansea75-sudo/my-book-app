import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * Chat pictures and avatars. Signed-in members only, and a picture is only
 * served when the viewer is allowed to see it:
 *  - their own upload,
 *  - any member's avatar,
 *  - a picture in the group chat,
 *  - a picture in a direct message they sent or received.
 */
export const Route = createFileRoute("/api/chat-image/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = Number.parseInt(params.id, 10);
        if (!Number.isFinite(id) || id <= 0) return new Response("Not found", { status: 404 });

        const { memberFromCookieHeader } = await import("@/lib/members-core");
        const me = await memberFromCookieHeader(request.headers.get("cookie"));
        if (!me) return new Response("Unauthorized", { status: 401 });

        const sql = await getSql();
        const rows = await sql<{ mime: string; data: string }>`
          select i.mime, i.data
          from chat_images i
          where i.id = ${id}
            and (
              i.owner_id = ${me.id}
              or exists (select 1 from members m where m.avatar_id = i.id)
              or exists (
                select 1 from chat_messages c
                where c.image_id = i.id
                  and (c.recipient_id is null or c.sender_id = ${me.id} or c.recipient_id = ${me.id})
              )
            )
          limit 1
        `;
        const row = rows[0];
        if (!row) return new Response("Not found", { status: 404 });

        return new Response(Buffer.from(row.data, "base64"), {
          headers: {
            "Content-Type": row.mime || "image/jpeg",
            "Cache-Control": "private, max-age=31536000, immutable",
            Vary: "Cookie",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
