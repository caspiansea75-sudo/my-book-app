import { createFileRoute } from "@tanstack/react-router";

/**
 * Passes Pokémon Showdown's animated sprites through this site, so the browser gets them from the same address
 * as the page. That way they play the same in every browser, whatever the picture server's sharing rules say.
 */
const KINDS = new Set(["ani", "ani-back", "dex", "gen5"]);
const cache = new Map<string, { body: ArrayBuffer; type: string }>();

export const Route = createFileRoute("/api/sprite")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const k = u.searchParams.get("k") ?? "";
        const id = u.searchParams.get("id") ?? "";
        if (!KINDS.has(k) || !/^[a-z0-9-]{1,40}$/.test(id)) return new Response("bad request", { status: 400 });
        const key = `${k}/${id}`;
        let hit = cache.get(key);
        if (!hit) {
          const ext = k.startsWith("ani") ? "gif" : "png";
          const r = await fetch(`https://play.pokemonshowdown.com/sprites/${k}/${id}.${ext}`).catch(() => null);
          if (!r || !r.ok) return new Response("not found", { status: 404, headers: { "cache-control": "public, max-age=300" } });
          hit = { body: await r.arrayBuffer(), type: ext === "gif" ? "image/gif" : "image/png" };
          if (cache.size < 600) cache.set(key, hit);
        }
        return new Response(hit.body, { headers: { "content-type": hit.type, "cache-control": "public, max-age=604800, s-maxage=2592000, immutable" } });
      },
    },
  },
});
