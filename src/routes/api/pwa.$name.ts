import { createFileRoute } from "@tanstack/react-router";
import { PWA_ICONS } from "@/lib/pwa-icons";

/**
 * What a browser needs to install the site as an app: its manifest (name, colours, icons) and the icons.
 *
 *   /api/pwa/manifest.webmanifest
 *   /api/pwa/icon-192.png  icon-512.png  icon-180.png  icon-maskable-512.png
 */
export const APP_INSTALL_NAME = "BookofCaspi";

const MANIFEST = {
  name: APP_INSTALL_NAME,
  short_name: APP_INSTALL_NAME,
  description: "একটি নৈশ লাইব্রেরি — গল্প পড়ুন, ছবি ও ভিডিও যোগ করুন।",
  id: "/",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "any",
  background_color: "#0c1016",
  theme_color: "#0c1016",
  lang: "bn",
  icons: [
    { src: "/api/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/api/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/api/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export const Route = createFileRoute("/api/pwa/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (params.name === "manifest.webmanifest") {
          return new Response(JSON.stringify(MANIFEST), {
            headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
          });
        }
        const b64 = PWA_ICONS[params.name];
        if (!b64) return new Response("Not found", { status: 404 });
        return new Response(Buffer.from(b64, "base64"), {
          headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
        });
      },
    },
  },
});
