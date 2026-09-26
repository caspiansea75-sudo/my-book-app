import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  emptyChapterBody,
  getCanonBook,
  listCanonBooks,
  newBlockId,
  slugifyTitle,
  summarizeBody,
  type BookIndex,
  type Chapter,
  type ChapterMeta,
  type LibraryBookCard,
  type Paragraph,
  type Section,
} from "@/lib/book";
import { mediaSrc, mediaThumbSrc, parseVideoUrl } from "@/lib/media-url";

type MediaRow = {
  id: number;
  kind: "image" | "video";
  title: string;
  mime: string;
  source: "upload" | "url";
  url: string | null;
  thumb: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  created_at: string;
};

export type MediaItem = {
  id: number;
  kind: "image" | "video";
  title: string;
  mime: string;
  source: "upload" | "url";
  url: string | null;
  src: string;
  thumbSrc: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  createdAt: string;
};

type BookRow = {
  id: number;
  slug: string;
  title: string;
  title_en: string;
  author: string;
  tagline: string;
  description: string;
  cover_media_id: number | null;
  created_at: string;
};

type ChapterRow = {
  id: number;
  book_id: number;
  slug: string;
  title: string;
  title_en: string;
  excerpt: string;
  sort_order: number;
  body: unknown;
};

type InsertRow = {
  after_para_id: string;
  media_id: number;
  caption: string;
  kind: "image" | "video";
  source: "upload" | "url";
  url: string | null;
};

const IMAGE_MAX = 1_200_000;
const VIDEO_MAX = 3_200_000;

function asMedia(row: MediaRow): MediaItem {
  const uploaded = row.source === "upload";
  const src = uploaded ? mediaSrc(row.id) : (row.url ?? mediaSrc(row.id));
  const thumbSrc = row.thumb
    ? row.thumb.startsWith("http")
      ? row.thumb
      : mediaThumbSrc(row.id)
    : uploaded
      ? mediaThumbSrc(row.id)
      : (row.url ?? null);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    mime: row.mime,
    source: row.source,
    url: row.url,
    src,
    thumbSrc,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    createdAt: row.created_at,
  };
}

function parseBody(raw: unknown): { sections: Section[] } {
  const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!value || typeof value !== "object") return emptyChapterBody();
  const sections = (value as { sections?: Section[] }).sections;
  if (!Array.isArray(sections) || sections.length === 0) return emptyChapterBody();
  return { sections };
}

function metaFromBody(
  id: number,
  slug: string,
  title: string,
  titleEn: string,
  excerpt: string,
  body: { sections: Section[] },
): ChapterMeta {
  const stats = summarizeBody(body.sections);
  return {
    id,
    slug,
    title,
    titleEn,
    excerpt: excerpt || stats.excerpt,
    paraCount: stats.paraCount,
    nsfwCount: stats.nsfwCount,
    chars: stats.chars,
    hasNsfw: stats.hasNsfw,
  };
}

function mergeInserts(chapter: Chapter, inserts: InsertRow[]): Chapter {
  if (inserts.length === 0) return chapter;
  const grouped = new Map<string, InsertRow[]>();
  for (const item of inserts) {
    const key = item.after_para_id || "";
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }
  const inject = (afterId: string): Paragraph[] => {
    const list = grouped.get(afterId);
    if (!list) return [];
    return list.map((item, i) => ({
      id: `ins-${item.media_id}-${i}`,
      kind: item.kind,
      text: "",
      nsfw: false,
      mediaId: item.media_id,
      url: item.source === "url" ? (item.url ?? undefined) : undefined,
      caption: item.caption,
    }));
  };
  const sections = chapter.sections.map((section) => {
    const paragraphs: Paragraph[] = [...inject("")];
    for (const para of section.paragraphs) {
      paragraphs.push(para);
      paragraphs.push(...inject(para.id));
    }
    return { ...section, paragraphs };
  });
  if (sections.length === 0) {
    return { ...chapter, sections: [{ id: "main", title: "", paragraphs: inject("") }] };
  }
  return { ...chapter, sections };
}

function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugifyTitle(base) || `golpo-${Date.now().toString(36)}`;
  if (!taken.has(root)) return root;
  for (let i = 2; i < 80; i += 1) {
    const next = `${root}-${i}`;
    if (!taken.has(next)) return next;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function studioBookIndex(row: BookRow): Promise<BookIndex> {
  const sql = await getSql();
  const chapters = await sql<ChapterRow>`
    select id, book_id, slug, title, title_en, excerpt, sort_order, body
    from library_chapters
    where book_id = ${row.id}
    order by sort_order asc, id asc
  `;
  const metas = chapters.map((ch) =>
    metaFromBody(ch.id, ch.slug, ch.title, ch.title_en, ch.excerpt, parseBody(ch.body)),
  );
  const paraCount = metas.reduce((n, c) => n + c.paraCount, 0);
  const nsfwCount = metas.reduce((n, c) => n + c.nsfwCount, 0);
  const chars = metas.reduce((n, c) => n + c.chars, 0);
  return {
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en,
    author: row.author,
    language: "bn",
    tagline: row.tagline,
    description: row.description,
    chapterCount: metas.length,
    paraCount,
    nsfwCount,
    chars,
    chapters: metas,
    origin: "studio",
    coverUrl: row.cover_media_id ? mediaSrc(row.cover_media_id) : null,
  };
}

async function coverMap(): Promise<Map<string, string>> {
  const sql = await getSql();
  const rows = await sql<{ book_slug: string; media_id: number }>`
    select book_slug, media_id from book_covers
  `;
  return new Map(rows.map((r) => [r.book_slug, mediaSrc(r.media_id)]));
}

export const listLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const covers = await coverMap();
  const studioRows = await sql<BookRow>`
    select id, slug, title, title_en, author, tagline, description, cover_media_id, created_at
    from library_books
    order by created_at desc
  `;
  const counts = await sql<{ book_id: number; n: number }>`
    select book_id, count(*)::int as n from library_chapters group by book_id
  `;
  const countMap = new Map(counts.map((c) => [c.book_id, c.n]));
  const studio: LibraryBookCard[] = studioRows.map((row) => ({
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en,
    author: row.author,
    tagline: row.tagline,
    description: row.description,
    chapterCount: countMap.get(row.id) ?? 0,
    origin: "studio",
    coverUrl: row.cover_media_id ? mediaSrc(row.cover_media_id) : covers.get(row.slug) ?? null,
  }));
  const canon: LibraryBookCard[] = listCanonBooks().map((book) => ({
    slug: book.slug,
    title: book.title,
    titleEn: book.titleEn,
    author: book.author,
    tagline: book.tagline,
    description: book.description,
    chapterCount: book.chapterCount,
    origin: "canon",
    coverUrl: covers.get(book.slug) ?? null,
  }));
  return [...studio, ...canon];
});

export const resolveBook = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const canon = getCanonBook(data.slug);
    const covers = await coverMap();
    if (canon) {
      return {
        ...canon,
        origin: "canon" as const,
        coverUrl: covers.get(canon.slug) ?? null,
      };
    }
    const sql = await getSql();
    const rows = await sql<BookRow>`
      select id, slug, title, title_en, author, tagline, description, cover_media_id, created_at
      from library_books
      where slug = ${data.slug}
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return studioBookIndex(row);
  });

export const loadStudioChapter = createServerFn({ method: "GET" })
  .validator(z.object({ bookSlug: z.string().min(1), slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const books = await sql<BookRow>`
      select id, slug, title, title_en, author, tagline, description, cover_media_id, created_at
      from library_books where slug = ${data.bookSlug} limit 1
    `;
    const book = books[0];
    if (!book) return null;
    const chapters = await sql<ChapterRow>`
      select id, book_id, slug, title, title_en, excerpt, sort_order, body
      from library_chapters
      where book_id = ${book.id} and slug = ${data.slug}
      limit 1
    `;
    const row = chapters[0];
    if (!row) return null;
    const body = parseBody(row.body);
    const stats = summarizeBody(body.sections);
    const chapter: Chapter = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      titleEn: row.title_en,
      excerpt: row.excerpt || stats.excerpt,
      paraCount: stats.paraCount,
      nsfwCount: stats.nsfwCount,
      chars: stats.chars,
      sections: body.sections,
    };
    return chapter;
  });

export const loadChapterInserts = createServerFn({ method: "GET" })
  .validator(z.object({ bookSlug: z.string().min(1), slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<InsertRow>`
      select i.after_para_id, i.media_id, i.caption, m.kind, m.source, m.url
      from chapter_inserts i
      join media m on m.id = i.media_id
      where i.book_slug = ${data.bookSlug} and i.chapter_slug = ${data.slug}
      order by i.sort_order asc, i.id asc
    `;
    return rows;
  });

export async function applyInserts(
  chapter: Chapter,
  bookSlug: string,
  slug: string,
): Promise<Chapter> {
  const inserts = await loadChapterInserts({ data: { bookSlug, slug } });
  return mergeInserts(chapter, inserts);
}

export const listMedia = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<MediaRow>`
    select id, kind, title, mime, source, url, thumb, width, height, bytes, created_at
    from media
    order by created_at desc
    limit 240
  `;
  return rows.map(asMedia);
});

export const getMediaRecord = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<MediaRow & { data: string | null }>`
      select id, kind, title, mime, source, url, thumb, width, height, bytes, created_at, data
      from media where id = ${data.id} limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return { ...asMedia(row), data: row.data };
  });

const uploadSchema = z.object({
  kind: z.enum(["image", "video"]),
  title: z.string().max(160).default(""),
  mime: z.string().min(1).max(120),
  source: z.enum(["upload", "url"]),
  url: z.string().max(2000).optional(),
  data: z.string().optional(),
  thumb: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  bytes: z.number().int().nonnegative().optional(),
});

export const createMedia = createServerFn({ method: "POST" })
  .validator(uploadSchema)
  .handler(async ({ data }) => {
    if (data.source === "url") {
      const url = data.url?.trim() ?? "";
      if (!url) throw new Error("লিংক দিন");
      if (data.kind === "video") {
        const parsed = parseVideoUrl(url);
        if (!parsed) throw new Error("ভিডিও লিংকটি চেনা যায়নি");
        const thumb = parsed.provider === "youtube" ? parsed.thumbUrl : (data.thumb ?? null);
        const sql = await getSql();
        const rows = await sql<{ id: number }>`
          insert into media (kind, title, mime, source, url, data, thumb, width, height, bytes)
          values (
            ${data.kind},
            ${data.title || "ভিডিও"},
            ${"video/url"},
            ${"url"},
            ${parsed.watchUrl ?? url},
            ${null},
            ${thumb},
            ${null},
            ${null},
            ${0}
          )
          returning id
        `;
        const id = rows[0]?.id;
        if (!id) throw new Error("সংরক্ষণ হয়নি");
        return { id };
      }
      const sql = await getSql();
      const rows = await sql<{ id: number }>`
        insert into media (kind, title, mime, source, url, data, thumb, width, height, bytes)
        values (
          ${"image"},
          ${data.title || "ছবি"},
          ${"image/url"},
          ${"url"},
          ${url},
          ${null},
          ${url},
          ${null},
          ${null},
          ${0}
        )
        returning id
      `;
      const id = rows[0]?.id;
      if (!id) throw new Error("সংরক্ষণ হয়নি");
      return { id };
    }

    const payload = data.data ?? "";
    if (!payload) throw new Error("ফাইল খালি");
    const bytes = data.bytes ?? Math.ceil((payload.length * 3) / 4);
    if (data.kind === "image" && bytes > IMAGE_MAX) throw new Error("ছবিটি অনেক বড়");
    if (data.kind === "video" && bytes > VIDEO_MAX) throw new Error("ভিডিওটি অনেক বড়");
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      insert into media (kind, title, mime, source, url, data, thumb, width, height, bytes)
      values (
        ${data.kind},
        ${data.title || (data.kind === "image" ? "ছবি" : "ভিডিও")},
        ${data.mime},
        ${"upload"},
        ${null},
        ${payload},
        ${data.thumb ?? null},
        ${data.width ?? null},
        ${data.height ?? null},
        ${bytes}
      )
      returning id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("সংরক্ষণ হয়নি");
    return { id };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from media where id = ${data.id}`;
    return { ok: true };
  });

const bookSchema = z.object({
  slug: z.string().min(1).max(80).optional(),
  title: z.string().min(1).max(160),
  titleEn: z.string().max(160).optional(),
  author: z.string().max(120).optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().max(1200).optional(),
  coverMediaId: z.number().int().positive().nullable().optional(),
});

export const createBook = createServerFn({ method: "POST" })
  .validator(bookSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const existing = await sql<{ slug: string }>`select slug from library_books`;
    const taken = new Set([
      ...listCanonBooks().map((b) => b.slug),
      ...existing.map((b) => b.slug),
    ]);
    const slug = uniqueSlug(data.slug || data.titleEn || data.title, taken);
    const rows = await sql<{ slug: string }>`
      insert into library_books (slug, title, title_en, author, tagline, description, cover_media_id)
      values (
        ${slug},
        ${data.title},
        ${data.titleEn ?? ""},
        ${data.author ?? ""},
        ${data.tagline ?? ""},
        ${data.description ?? ""},
        ${data.coverMediaId ?? null}
      )
      returning slug
    `;
    const created = rows[0]?.slug;
    if (!created) throw new Error("বই তৈরি হয়নি");
    return { slug: created };
  });

export const updateBook = createServerFn({ method: "POST" })
  .validator(bookSchema.extend({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update library_books
      set title = ${data.title},
          title_en = ${data.titleEn ?? ""},
          author = ${data.author ?? ""},
          tagline = ${data.tagline ?? ""},
          description = ${data.description ?? ""}
      where slug = ${data.slug}
    `;
    return { ok: true };
  });

export const setBookCover = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(1),
      mediaId: z.number().int().positive().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const studio = await sql<{ id: number }>`select id from library_books where slug = ${data.slug} limit 1`;
    if (studio[0]) {
      await sql`update library_books set cover_media_id = ${data.mediaId} where slug = ${data.slug}`;
      return { ok: true };
    }
    if (!getCanonBook(data.slug)) throw new Error("বই পাওয়া যায়নি");
    if (data.mediaId == null) {
      await sql`delete from book_covers where book_slug = ${data.slug}`;
    } else {
      await sql`
        insert into book_covers (book_slug, media_id)
        values (${data.slug}, ${data.mediaId})
        on conflict (book_slug) do update set media_id = excluded.media_id
      `;
    }
    return { ok: true };
  });

const chapterSchema = z.object({
  bookSlug: z.string().min(1),
  slug: z.string().min(1).max(40).optional(),
  title: z.string().min(1).max(160),
  titleEn: z.string().max(160).optional(),
  excerpt: z.string().max(400).optional(),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      paragraphs: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(["p", "break", "image", "video"]),
          text: z.string().optional().default(""),
          nsfw: z.boolean().optional().default(false),
          mediaId: z.number().int().positive().optional(),
          url: z.string().optional(),
          caption: z.string().optional(),
        }),
      ),
    }),
  ),
});

export const saveStudioChapter = createServerFn({ method: "POST" })
  .validator(chapterSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const books = await sql<{ id: number }>`select id from library_books where slug = ${data.bookSlug} limit 1`;
    const book = books[0];
    if (!book) throw new Error("বই পাওয়া যায়নি");
    const sections: Section[] = data.sections.map((section) => ({
      id: section.id || newBlockId("s"),
      title: section.title,
      paragraphs: section.paragraphs.map((p) => ({
        id: p.id || newBlockId("p"),
        kind: p.kind,
        text: p.text ?? "",
        nsfw: Boolean(p.nsfw),
        mediaId: p.mediaId,
        url: p.url,
        caption: p.caption,
      })),
    }));
    const stats = summarizeBody(sections);
    const excerpt = data.excerpt || stats.excerpt;
    const existing = await sql<{ slug: string; sort_order: number }>`
      select slug, sort_order from library_chapters where book_id = ${book.id}
    `;
    const slug =
      data.slug && existing.some((c) => c.slug === data.slug)
        ? data.slug
        : uniqueSlug(
            data.slug || String(existing.length + 1).padStart(2, "0"),
            new Set(existing.map((c) => c.slug)),
          );
    const sortOrder =
      existing.find((c) => c.slug === slug)?.sort_order ?? existing.length + 1;
    const body = JSON.stringify({ sections });
    await sql.query(
      `insert into library_chapters (book_id, slug, title, title_en, excerpt, sort_order, body)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb)
       on conflict (book_id, slug) do update set
         title = excluded.title,
         title_en = excluded.title_en,
         excerpt = excluded.excerpt,
         body = excluded.body`,
      [book.id, slug, data.title, data.titleEn ?? "", excerpt, sortOrder, body],
    );
    return { slug };
  });

const insertSchema = z.object({
  bookSlug: z.string().min(1),
  chapterSlug: z.string().min(1),
  items: z.array(
    z.object({
      afterParaId: z.string(),
      mediaId: z.number().int().positive(),
      caption: z.string().max(300).optional().default(""),
    }),
  ),
});

export const saveChapterInserts = createServerFn({ method: "POST" })
  .validator(insertSchema)
  .handler(async ({ data }) => {
    if (!getCanonBook(data.bookSlug)) throw new Error("শুধু আসল বইয়ে ছবি যোগ করা যায় এই পথে");
    const sql = await getSql();
    await sql`delete from chapter_inserts where book_slug = ${data.bookSlug} and chapter_slug = ${data.chapterSlug}`;
    let order = 0;
    for (const item of data.items) {
      order += 1;
      await sql`
        insert into chapter_inserts (book_slug, chapter_slug, after_para_id, media_id, caption, sort_order)
        values (${data.bookSlug}, ${data.chapterSlug}, ${item.afterParaId}, ${item.mediaId}, ${item.caption ?? ""}, ${order})
      `;
    }
    return { ok: true };
  });

export const deleteStudioChapter = createServerFn({ method: "POST" })
  .validator(z.object({ bookSlug: z.string().min(1), slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const books = await sql<{ id: number }>`select id from library_books where slug = ${data.bookSlug} limit 1`;
    const book = books[0];
    if (!book) throw new Error("বই পাওয়া যায়নি");
    await sql`delete from library_chapters where book_id = ${book.id} and slug = ${data.slug}`;
    return { ok: true };
  });

export const deleteStudioBook = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from library_books where slug = ${data.slug}`;
    return { ok: true };
  });

export { mergeInserts };
