import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertSeriesAccess, requireMember } from "@/lib/members-core";
import type { PageScan } from "@/lib/page-images";
import { extractImages } from "@/lib/page-images";

/**
 * Importing a chapter from a web page, or copying a picture from a web address.
 * Only signed-in members who own the series can use these (so they are not an open proxy), and the actual
 * fetching is done by remote-fetch.server.ts, which refuses internal addresses and caps size and time.
 */

const MAX_PAGE_BYTES = 3 * 1024 * 1024;
/** A picture comes back inside one reply, which the host limits to about 4.5 MB once encoded, so keep pictures under this. */
export const MAX_COPY_BYTES = 3_200_000;

/* a gentle brake: how many scans / picture copies one member may do in a while (per server instance) */
const hits = new Map<string, number[]>();
function rateOk(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  return true;
}

const MESSAGES: Record<string, string> = {
  "bad-url": "এটি সঠিক ওয়েব লিংক নয় (http:// বা https:// দিয়ে শুরু হতে হবে)",
  blocked: "এই ঠিকানা থেকে আনা যাবে না",
  timeout: "সাইটটি সাড়া দিতে অনেক দেরি করেছে",
  "too-large": "ফাইলটি অনেক বড়",
  "bad-status": "সাইটটি পেজ বা ছবি দিতে রাজি হয়নি (লিংক বা অনুমতি দেখুন)",
  "bad-type": "এটি ছবি নয়",
  network: "সাইটে পৌঁছানো গেল না",
};
const TOO_FAST = "একটু থামুন — অল্প সময়ে অনেক অনুরোধ হয়ে গেছে, কিছুক্ষণ পর আবার চেষ্টা করুন";

function friendly(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  if (code && MESSAGES[code]) return new Error(MESSAGES[code]);
  console.error("remote import failed", e);
  return new Error(MESSAGES.network);
}

export const scanPageImages = createServerFn({ method: "POST" })
  .validator(z.object({ seriesSlug: z.string().min(1).max(120), url: z.string().min(8).max(2000) }))
  .handler(async ({ data }): Promise<PageScan & { pageUrl: string }> => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.seriesSlug);
    if (!rateOk(`scan:${me.id}`, 12, 60_000)) throw new Error(TOO_FAST);
    const rf = await import("@/lib/remote-fetch.server");
    try {
      const r = await rf.safeGet(data.url, { maxBytes: MAX_PAGE_BYTES, accept: "text/html,application/xhtml+xml,*/*;q=0.5" });
      // a link straight to one picture is fine too
      if (r.contentType.startsWith("image/") || rf.sniffImage(r.body)) return { title: "", images: [{ url: r.finalUrl, junk: false }], pageUrl: r.finalUrl };
      return { ...extractImages(rf.decodeBody(r.body, r.contentType), r.finalUrl), pageUrl: r.finalUrl };
    } catch (e) {
      throw friendly(e);
    }
  });

export const fetchRemoteImage = createServerFn({ method: "POST" })
  .validator(z.object({ seriesSlug: z.string().min(1).max(120), url: z.string().min(8).max(2000), referer: z.string().max(2000).optional() }))
  .handler(async ({ data }): Promise<{ mime: string; base64: string; bytes: number; name: string }> => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.seriesSlug);
    if (!rateOk(`img:${me.id}`, 400, 10 * 60_000)) throw new Error(TOO_FAST);
    const rf = await import("@/lib/remote-fetch.server");
    try {
      const r = await rf.safeGet(data.url, { maxBytes: MAX_COPY_BYTES, accept: "image/avif,image/webp,image/*,*/*;q=0.8", referer: data.referer });
      const mime = rf.sniffImage(r.body);
      if (!mime) throw Object.assign(new Error("not an image"), { code: "bad-type" });
      const name = decodeURIComponent(new URL(r.finalUrl).pathname.split("/").pop() || "page").slice(0, 80);
      return { mime, base64: r.body.toString("base64"), bytes: r.body.length, name };
    } catch (e) {
      throw friendly(e);
    }
  });
