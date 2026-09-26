import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = Number.parseInt(params.id, 10);
        if (!Number.isFinite(id) || id <= 0) {
          return new Response("Not found", { status: 404 });
        }
        const sql = await getSql();
        const rows = await sql<{
          mime: string;
          source: string;
          url: string | null;
          data: string | null;
          thumb: string | null;
        }>`
          select mime, source, url, data, thumb from media where id = ${id} limit 1
        `;
        const row = rows[0];
        if (!row) return new Response("Not found", { status: 404 });

        const wantThumb = new URL(request.url).searchParams.get("thumb") === "1";
        if (wantThumb && row.thumb) {
          if (row.thumb.startsWith("http")) {
            return Response.redirect(row.thumb, 302);
          }
          const bytes = Buffer.from(row.thumb, "base64");
          return new Response(bytes, {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "public, max-age=31536000, immutable",
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
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
