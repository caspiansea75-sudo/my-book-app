import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * Admin-only backup: everything in the database as one JSON file, streamed so a
 * big library never has to fit in memory. Passwords and login sessions are never
 * included. Items in the trash are included too.
 *
 *   /api/backup            full backup, with pictures and videos
 *   /api/backup?media=0    text only (stories, comments, chat…) — small and quick
 */

type Plan = {
  table: string;
  /** Explicit column list; default is every column. */
  cols?: string;
  /** Page through rows by id (for big tables) instead of one query. */
  paged?: boolean;
  /** Replaces `cols` when the backup is text-only. */
  slimCols?: string;
  order?: string;
};

const PLAN: Plan[] = [
  { table: "members", cols: "id, username, display_name, role, created_at, bio, avatar_id", order: "id" },
  { table: "library_books", order: "id" },
  { table: "library_chapters", paged: true },
  { table: "chapter_inserts", order: "id" },
  { table: "book_covers", order: "book_slug" },
  { table: "author_overrides", order: "kind, key" },
  { table: "hidden_items", order: "kind, key" },
  { table: "manga_series", order: "id" },
  { table: "manga_chapters", order: "id" },
  { table: "manga_panels", order: "id" },
  { table: "media_folders", order: "id" },
  { table: "media_folder_items", order: "media_id" },
  {
    table: "media",
    paged: true,
    slimCols: "id, kind, title, mime, source, url, width, height, bytes, created_at, owner_id, deleted_at, deleted_by",
  },
  { table: "content_likes", order: "created_at, member_id" },
  { table: "content_comments", paged: true },
  { table: "chat_messages", paged: true },
  { table: "chat_reactions", order: "message_id, member_id" },
  { table: "chat_reports", order: "id" },
  { table: "chat_images", paged: true, slimCols: "id, owner_id, mime, bytes, created_at" },
];

const enc = new TextEncoder();

export const Route = createFileRoute("/api/backup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { memberFromCookieHeader } = await import("@/lib/members-core");
        const me = await memberFromCookieHeader(request.headers.get("cookie"));
        if (!me) return new Response("Unauthorized", { status: 401 });
        if (me.role !== "admin") return new Response("Forbidden", { status: 403 });

        const withMedia = new URL(request.url).searchParams.get("media") !== "0";
        const sql = await getSql();
        const day = new Date().toISOString().slice(0, 10);

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const put = (text: string) => controller.enqueue(enc.encode(text));
            try {
              put(
                `{"format":"my-book-app-backup","version":1,"createdAt":${JSON.stringify(new Date().toISOString())},` +
                  `"includesMedia":${withMedia},"tables":{`,
              );
              let firstTable = true;
              for (const plan of PLAN) {
                put(`${firstTable ? "" : ","}${JSON.stringify(plan.table)}:[`);
                firstTable = false;
                const cols = !withMedia && plan.slimCols ? plan.slimCols : (plan.cols ?? "*");
                try {
                  let first = true;
                  const emit = (rows: unknown[]) => {
                    for (const row of rows) {
                      put(`${first ? "" : ","}${JSON.stringify(row)}`);
                      first = false;
                    }
                  };
                  if (plan.paged) {
                    // Heavy tables (picture data, chapter text) come in small batches.
                    const batch = plan.table === "media" || plan.table === "chat_images" ? 10 : 200;
                    let after = 0;
                    for (;;) {
                      const rows = await sql.query<{ id: number }>(
                        `select ${cols} from ${plan.table} where id > $1 order by id asc limit ${batch}`,
                        [after],
                      );
                      if (rows.length === 0) break;
                      emit(rows);
                      after = rows[rows.length - 1].id;
                      if (rows.length < batch) break;
                    }
                  } else {
                    emit(await sql.query(`select ${cols} from ${plan.table}${plan.order ? ` order by ${plan.order}` : ""}`));
                  }
                } catch (err) {
                  // One missing or broken table must not ruin the rest of the backup.
                  put(`${JSON.stringify({ backupError: err instanceof Error ? err.message : String(err) })}`);
                }
                put("]");
              }
              put("}}");
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="my-book-app-backup-${day}${withMedia ? "" : "-text-only"}.json"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
