import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getMediaFile, isBlobUrl } from "@/lib/blob-store.server";

export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = Number.parseInt(params.id, 10);
        if (!Number.isFinite(id) || id <= 0) {
          return new Response("Not found", { status: 404 });
        }
        const { memberFromCookieHeader, isHidden } = await import("@/lib/members-core");
        const viewer = await memberFromCookieHeader(request.headers.get("cookie"));
        if (!viewer) return new Response("Unauthorized", { status: 401 });
        if (viewer.role !== "admin" && (await isHidden("media", String(id)))) {
          return new Response("Not found", { status: 404 });
        }
        const sql = await getSql();
        const rows = await sql<{
          mime: string;
          source: string;
          url: string | null;
          data: string | null;
          thumb: string | null;
          owner_id: number | null;
          deleted_at: string | null;
        }>`
          select mime, source, url, data, thumb, owner_id, deleted_at from media where id = ${id} limit 1
        `;
        const row = rows[0];
        if (!row) return new Response("Not found", { status: 404 });
        // Files in the trash are only shown to their owner and the admin (for the Trash page).
        if (row.deleted_at && viewer.role !== "admin" && row.owner_id !== viewer.id) {
          return new Response("Not found", { status: 404 });
        }

        const wantThumb = new URL(request.url).searchParams.get("thumb") === "1";
        if (wantThumb && row.thumb) {
          if (row.thumb.startsWith("http")) {
            return Response.redirect(row.thumb, 302);
          }
          const bytes = Buffer.from(row.thumb, "base64");
          return new Response(bytes, {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "private, max-age=31536000, immutable",
            },
          });
        }

        if (row.url && isBlobUrl(row.url)) {
          // Private Blob: viewer was already checked above, so stream it through the server.
          const file = await getMediaFile(row.url);
          if (!file) return new Response("Not found", { status: 404 });
          return new Response(file.stream, {
            headers: {
              "Content-Type": row.mime || file.contentType || "application/octet-stream",
              "Cache-Control": "private, max-age=31536000, immutable",
            },
          });
        }
        if (row.source === "url" && row.url) {
          return Response.redirect(row.url, 302);
        }
        if (!row.data) return new Response("Not found", { status: 404 });
        const bytes = Buffer.from(row.data, "base64");
        return new Response(bytes, {
          headers: {
            "Content-Type": row.mime || "application/octet-stream",
            "Cache-Control": "private, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
