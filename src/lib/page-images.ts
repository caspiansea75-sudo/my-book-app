/**
 * Finds the pictures on a web page, in the order they appear, so a whole chapter can be imported from one link.
 * Pure text processing (no network, no DOM) so it runs on the server and is easy to test.
 */
export type PageImage = {
  url: string;
  /** a smaller picture to show in the preview, when the page links a small version to a big one */
  preview?: string;
  alt?: string;
  width?: number;
  height?: number;
  /** probably not a page: a logo, icon, avatar, advert, the page's share picture… (shown, but not ticked) */
  junk: boolean;
};
export type PageScan = { title: string; images: PageImage[] };

export const MAX_SCAN_IMAGES = 200;
const IMG_EXT = /\.(?:jpe?g|png|webp|avif|gif|bmp)(?:$|[?#])/i;
const SKIP_EXT = /\.(?:svg|ico|css|js|json|woff2?|ttf|mp4|webm|mp3)(?:$|[?#])/i;
const JUNK_NAME = /(?:^|[/_.-])(?:logo|icons?|favicon|sprite|avatars?|emoji|emoticons?|badges?|banners?|ads?|advert|pixel|tracking|loader|loading|spinner|placeholder|blank|spacer|button|btn|social|share)(?:[/_.\d-]|$)/i;

const ENTITIES: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">", "&#x2f;": "/", "&#47;": "/" };
export const decodeEntities = (s: string) => s.replace(/&(?:amp|quot|#39|apos|lt|gt|#x2F|#47);/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const rx = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(tag))) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

/** The biggest picture named in a srcset ("a.jpg 480w, b.jpg 1080w"). */
function bestFromSrcset(srcset: string): string | null {
  let best: { url: string; size: number } | null = null;
  for (const part of srcset.split(",")) {
    const bits = part.trim().split(/\s+/);
    if (!bits[0] || bits[0].startsWith("data:")) continue;
    const d = bits[1] ?? "";
    const size = /w$/.test(d) ? parseFloat(d) : /x$/.test(d) ? parseFloat(d) * 1000 : 1;
    if (!best || size > best.size) best = { url: bits[0], size: Number.isFinite(size) ? size : 1 };
  }
  return best?.url ?? null;
}

const LAZY_KEYS = ["data-original", "data-src", "data-lazy-src", "data-lazy", "data-url", "data-echo", "data-full", "data-large-file", "src"];

export function extractImages(html: string, pageUrl: string): PageScan {
  const baseHref = /<base\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
  let base: URL;
  try {
    base = new URL(baseHref ? decodeEntities(baseHref) : pageUrl, pageUrl);
  } catch {
    base = new URL(pageUrl);
  }
  const resolve = (raw: string): string | null => {
    const r = raw.trim().replace(/\\\//g, "/");
    if (!r || r.startsWith("data:") || r.startsWith("blob:") || r.startsWith("javascript:")) return null;
    try {
      const u = new URL(r, base);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      u.hash = "";
      return u.toString();
    } catch {
      return null;
    }
  };

  const found: { at: number; image: PageImage }[] = [];
  const seen = new Map<string, number>();
  const add = (at: number, url: string | null, extra: Partial<PageImage> & { isMeta?: boolean } = {}) => {
    if (!url || SKIP_EXT.test(url)) return;
    const { isMeta, ...rest } = extra;
    const existing = seen.get(url);
    if (existing !== undefined) {
      // the same picture again (for example a <noscript> copy): keep the first, but learn its size
      const img = found[existing].image;
      img.width ??= rest.width;
      img.height ??= rest.height;
      return;
    }
    const junk = !!isMeta || JUNK_NAME.test(new URL(url).pathname) || (!!rest.width && !!rest.height && rest.width < 200 && rest.height < 200);
    seen.set(url, found.length);
    found.push({ at, image: { url, junk, ...rest } });
  };

  // <img> (and <source> in <picture>), including lazy-loading attributes and a surrounding link to the full-size file
  const tagRx = /<(img|source)\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRx.exec(html))) {
    const a = attrs(m[0]);
    let raw: string | null = null;
    for (const key of ["data-srcset", "srcset"]) if (!raw && a[key]) raw = bestFromSrcset(a[key]);
    if (!raw) for (const key of LAZY_KEYS) if (!raw && a[key] && !a[key].startsWith("data:")) raw = a[key];
    const small = resolve(raw ?? "");
    let full = small;
    // <a href="big.jpg"><img src="small.jpg"></a>
    const before = html.slice(Math.max(0, m.index - 400), m.index);
    const anchor = /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*$/i.exec(before);
    const href = anchor ? attrs(anchor[0]).href : "";
    const linked = href && IMG_EXT.test(href) ? resolve(href) : null;
    if (linked) full = linked;
    const w = a.width ? parseInt(a.width, 10) : undefined;
    const h = a.height ? parseInt(a.height, 10) : undefined;
    add(m.index, full, { preview: linked && small && small !== linked ? small : undefined, alt: a.alt || undefined, width: Number.isFinite(w) ? w : undefined, height: Number.isFinite(h) ? h : undefined });
  }

  // the page's share picture (usually the cover, not a page)
  const metaRx = /<meta\b[^>]*>/gi;
  while ((m = metaRx.exec(html))) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || "").toLowerCase();
    if (key === "og:image" || key === "twitter:image" || key === "og:image:url") add(m.index, resolve(a.content ?? ""), { isMeta: true });
  }

  // picture addresses written inside scripts / JSON (many reader pages list their pages that way)
  const rawRx = /https?:(?:\\?\/){2}(?:[^\s"'<>)\\]|\\\/)+?\.(?:jpe?g|png|webp|avif|gif)(?:\?(?:[^\s"'<>)\\]|\\\/)*)?/gi;
  while ((m = rawRx.exec(html))) add(m.index, resolve(decodeEntities(m[0])));

  found.sort((x, y) => x.at - y.at);
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, " ").trim() ?? "").slice(0, 160);
  return { title, images: found.slice(0, MAX_SCAN_IMAGES).map((f) => f.image) };
}

/** Sorts file names the way people read them: page2 before page10. */
export const naturalCompare = (a: string, b: string) => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare(a, b);
