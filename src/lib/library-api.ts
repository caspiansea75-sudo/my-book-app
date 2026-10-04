import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  adultMap,
  assertBookAccess,
  assertMediaAccess,
  hiddenSet,
  isHidden,
  requireMember,
} from "@/lib/members-core";
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
  owner_id?: number | null;
  owner_name?: string | null;
  created_at: string;
};

export type MediaItem = {
  hidden?: boolean;
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
  ownerId: number | null;
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
  owner_id?: number | null;
  owner_name?: string | null;
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
  status?: string;
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
    ownerId: row.owner_id ?? null,
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
  status: "draft" | "published" = "published",
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
    status,
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

/** Extra chapters of an original story are stored under a hidden "companion" book. */
const EXT_PREFIX = "ext--";

async function extensionBook(canonSlug: string, create: boolean): Promise<{ id: number; slug: string } | null> {
  const sql = await getSql();
  const rows = await sql<{ id: number; slug: string }>`select id, slug from library_books where extends_slug = ${canonSlug} limit 1`;
  if (rows[0] || !create) return rows[0] ?? null;
  const canon = getCanonBook(canonSlug);
  if (!canon) return null;
  const made = await sql<{ id: number; slug: string }>`
    insert into library_books (slug, title, title_en, extends_slug)
    values (${EXT_PREFIX + canonSlug}, ${canon.title}, ${canon.titleEn}, ${canonSlug})
    on conflict (slug) do update set extends_slug = excluded.extends_slug
    returning id, slug
  `;
  return made[0] ?? null;
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

async function studioBookIndex(row: BookRow, drafts = false): Promise<BookIndex> {
  const sql = await getSql();
  const chapters = await sql<ChapterRow>`
    select id, book_id, slug, title, title_en, excerpt, sort_order, body, status
    from library_chapters
    where book_id = ${row.id} and deleted_at is null and (${drafts}::boolean or status = 'published')
    order by sort_order asc, id asc
  `;
  const metas = chapters.map((ch) =>
    metaFromBody(
      ch.id,
      ch.slug,
      ch.title,
      ch.title_en,
      ch.excerpt,
      parseBody(ch.body),
      ch.status === "draft" ? "draft" : "published",
    ),
  );
  const paraCount = metas.reduce((n, c) => n + c.paraCount, 0);
  const nsfwCount = metas.reduce((n, c) => n + c.nsfwCount, 0);
  const chars = metas.reduce((n, c) => n + c.chars, 0);
  return {
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en,
    author: row.author || row.owner_name || "",
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
    ownerId: row.owner_id ?? null,
  };
}

async function coverMap(): Promise<Map<string, string>> {
  const sql = await getSql();
  const rows = await sql<{ book_slug: string; media_id: number }>`
    select book_slug, media_id from book_covers
  `;
  return new Map(rows.map((r) => [r.book_slug, mediaSrc(r.media_id)]));
}

async function authorMap(): Promise<Map<string, string>> {
  const sql = await getSql();
  const rows = await sql<{ key: string; author: string }>`select key, author from author_overrides where kind = 'book'`;
  return new Map(rows.map((r) => [r.key, r.author]));
}

/** The JSON books ship with a placeholder writer; treat it as "not set". */
function cleanAuthor(name: string | undefined): string {
  const v = (name ?? "").trim();
  return !v || /^(অজানা|unknown|anonymous|n\/a)$/i.test(v) ? "" : v;
}

function toMs(v: unknown): number {
  const t = new Date(v as string | number | Date).getTime();
  return Number.isFinite(t) ? t : 0;
}

export const listLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireMember();
  const hid = await hiddenSet("book");
  const sql = await getSql();
  const covers = await coverMap();
  const authors = await authorMap();
  const adults = await adultMap("book");
  const studioRows = await sql<BookRow>`
    select id, slug, title, title_en, author, tagline, description, cover_media_id, owner_id, created_at,
      (select m.display_name from members m where m.id = library_books.owner_id) as owner_name
    from library_books
    where deleted_at is null and extends_slug is null
    order by created_at desc
  `;
  const extraRows = await sql<{ extends_slug: string; n: number }>`
    select b.extends_slug, (count(*) filter (where c.status = 'published'))::int as n
    from library_chapters c join library_books b on b.id = c.book_id
    where b.extends_slug is not null and c.deleted_at is null
    group by b.extends_slug
  `;
  const extraCount = new Map(extraRows.map((r) => [r.extends_slug, Number(r.n)]));
  const counts = await sql<{ book_id: number; pub: number; total: number }>`
    select book_id,
      (count(*) filter (where status = 'published'))::int as pub,
      count(*)::int as total
    from library_chapters
    where deleted_at is null
    group by book_id
  `;
  const countMap = new Map(counts.map((c) => [c.book_id, c]));
  const studio: LibraryBookCard[] = studioRows.flatMap((row) => {
    const c = countMap.get(row.id) ?? { pub: 0, total: 0 };
    const mine = me.role === "admin" || row.owner_id === me.id;
    // Nobody but the author and the admin sees a book whose chapters are all still drafts.
    if (!mine && c.total > 0 && c.pub === 0) return [];
    const card: LibraryBookCard = {
      slug: row.slug,
      title: row.title,
      titleEn: row.title_en,
      author: row.author || row.owner_name || "",
      tagline: row.tagline,
      description: row.description,
      chapterCount: mine ? c.total : c.pub,
      origin: "studio",
      coverUrl: row.cover_media_id ? mediaSrc(row.cover_media_id) : covers.get(row.slug) ?? null,
      nsfwCount: 0,
      adult: adults.get(row.slug) ?? false,
      createdAt: toMs(row.created_at),
      ownerId: row.owner_id ?? null,
    };
    return [card];
  });
  const canon: LibraryBookCard[] = listCanonBooks().map((book) => ({
    slug: book.slug,
    title: book.title,
    titleEn: book.titleEn,
    author: authors.get(book.slug) ?? cleanAuthor(book.author),
    tagline: book.tagline,
    description: book.description,
    chapterCount: book.chapterCount + (extraCount.get(book.slug) ?? 0),
    origin: "canon",
    coverUrl: covers.get(book.slug) ?? null,
    nsfwCount: book.nsfwCount,
    adult: adults.get(book.slug) ?? book.nsfwCount > 0,
    createdAt: 0,
    ownerId: null,
  }));
  const all = [...studio, ...canon].map((b) => ({ ...b, hidden: hid.has(b.slug) }));
  return me.role === "admin" ? all : all.filter((b) => !b.hidden);
});

export const resolveBook = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1), drafts: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    if (me.role !== "admin" && (await isHidden("book", data.slug))) return null;
    const canon = getCanonBook(data.slug);
    const covers = await coverMap();
    const authors = await authorMap();
    const adults = await adultMap("book");
    if (canon) {
      const ext = await extensionBook(canon.slug, false);
      let extras: ChapterMeta[] = [];
      if (ext) {
        const sqlx = await getSql();
        const rowsx = await sqlx<BookRow>`select id, slug, title, title_en, author, tagline, description, cover_media_id, owner_id, created_at from library_books where id = ${ext.id} limit 1`;
        const withDrafts = Boolean(data.drafts) && me.role === "admin";
        extras = rowsx[0] ? (await studioBookIndex(rowsx[0], withDrafts)).chapters.map((c) => ({ ...c, extra: true })) : [];
      }
      return {
        ...canon,
        chapters: [...canon.chapters, ...extras],
        chapterCount: canon.chapterCount + extras.length,
        paraCount: canon.paraCount + extras.reduce((n, c) => n + c.paraCount, 0),
        chars: canon.chars + extras.reduce((n, c) => n + c.chars, 0),
        adult: adults.get(canon.slug) ?? canon.nsfwCount > 0,
        author: authors.get(canon.slug) ?? cleanAuthor(canon.author),
        origin: "canon" as const,
        coverUrl: covers.get(canon.slug) ?? null,
        ownerId: null,
      };
    }
    const sql = await getSql();
    const rows = await sql<BookRow>`
      select id, slug, title, title_en, author, tagline, description, cover_media_id, owner_id, created_at,
      (select m.display_name from members m where m.id = library_books.owner_id) as owner_name
      from library_books
      where slug = ${data.slug} and deleted_at is null
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    // Drafts are only ever listed for the author and the admin, and only when asked for (the studio).
    const withDrafts = Boolean(data.drafts) && (me.role === "admin" || row.owner_id === me.id);
    const index = await studioBookIndex(row, withDrafts);
    return { ...index, adult: adults.get(row.slug) ?? false };
  });

export const loadStudioChapter = createServerFn({ method: "GET" })
  .validator(z.object({ bookSlug: z.string().min(1), slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    if (me.role !== "admin" && (await isHidden("book", data.bookSlug))) return null;
    const sql = await getSql();
    const books = await sql<BookRow>`
      select id, slug, title, title_en, author, tagline, description, cover_media_id, owner_id, created_at
      from library_books
      where ((slug = ${data.bookSlug} and extends_slug is null) or extends_slug = ${data.bookSlug}) and deleted_at is null
      limit 1
    `;
    const book = books[0];
    if (!book) return null;
    const chapters = await sql<ChapterRow>`
      select id, book_id, slug, title, title_en, excerpt, sort_order, body, status
      from library_chapters
      where book_id = ${book.id} and slug = ${data.slug} and deleted_at is null
      limit 1
    `;
    const row = chapters[0];
    if (!row) return null;
    const isDraft = row.status === "draft";
    if (isDraft && me.role !== "admin" && book.owner_id !== me.id) return null;
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
      status: isDraft ? "draft" : "published",
      extra: getCanonBook(data.bookSlug) ? true : undefined,
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
  const me = await requireMember();
  const hid = await hiddenSet("media");
  const sql = await getSql();
  const rows = await sql<MediaRow>`
    select id, kind, title, mime, source, url, thumb, width, height, bytes, owner_id, created_at
    from media
    where deleted_at is null
    order by created_at desc
    limit 240
  `;
  const all = rows.map((r) => ({ ...asMedia(r), hidden: hid.has(String(r.id)) }));
  return me.role === "admin" ? all : all.filter((m) => !m.hidden);
});

export const getMediaRecord = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    if (me.role !== "admin" && (await isHidden("media", String(data.id)))) return null;
    const sql = await getSql();
    const rows = await sql<MediaRow & { data: string | null }>`
      select id, kind, title, mime, source, url, thumb, width, height, bytes, created_at, data
      from media where id = ${data.id} and deleted_at is null limit 1
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
    const me = await requireMember();
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
        await (await getSql())`update media set owner_id = ${me.id} where id = ${id}`;
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
      await (await getSql())`update media set owner_id = ${me.id} where id = ${id}`;
      return { id };
    }

    const payload = data.data ?? "";
    if (!payload) throw new Error("ফাইল খালি");
    const bytes = data.bytes ?? Math.ceil((payload.length * 3) / 4);
    if (data.kind === "image" && bytes > IMAGE_MAX) throw new Error("ছবিটি অনেক বড়");
    if (data.kind === "video" && bytes > VIDEO_MAX) throw new Error("ভিডিওটি অনেক বড়");
    // Big file -> Vercel Blob (url saved in Neon). If Blob is off or fails, keep it in Neon.
    const { putMedia } = await import("@/lib/blob-store.server");
    const blobUrl = await putMedia(payload, data.mime);
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      insert into media (kind, title, mime, source, url, data, thumb, width, height, bytes)
      values (
        ${data.kind},
        ${data.title || (data.kind === "image" ? "ছবি" : "ভিডিও")},
        ${data.mime},
        ${"upload"},
        ${blobUrl},
        ${blobUrl ? null : payload},
        ${data.thumb ?? null},
        ${data.width ?? null},
        ${data.height ?? null},
        ${bytes}
      )
      returning id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("সংরক্ষণ হয়নি");
    await (await getSql())`update media set owner_id = ${me.id} where id = ${id}`;
    return { id };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertMediaAccess(me, [data.id]);
    const sql = await getSql();
    await sql`update media set deleted_at = now(), deleted_by = ${me.id} where id = ${data.id} and deleted_at is null`;
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
    const me = await requireMember();
    const sql = await getSql();
    const existing = await sql<{ slug: string }>`select slug from library_books`;
    const taken = new Set([
      ...listCanonBooks().map((b) => b.slug),
      ...existing.map((b) => b.slug),
    ]);
    const slug = uniqueSlug(data.slug || data.titleEn || data.title, taken);
    const rows = await sql<{ slug: string }>`
      insert into library_books (slug, title, title_en, author, tagline, description, cover_media_id, owner_id)
      values (
        ${slug},
        ${data.title},
        ${data.titleEn ?? ""},
        ${data.author ?? ""},
        ${data.tagline ?? ""},
        ${data.description ?? ""},
        ${data.coverMediaId ?? null},
        ${me.id}
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
    const me = await requireMember();
    await assertBookAccess(me, data.slug);
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
    const me = await requireMember();
    await assertBookAccess(me, data.slug);
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
  /** Omit to leave an existing chapter's status as it is (new chapters then start published). */
  status: z.enum(["draft", "published"]).optional(),
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
          color: z.string().max(40).optional(),
          effects: z.array(z.string().max(24)).max(10).optional(),
          align: z.enum(["left", "center", "right"]).optional(),
          runs: z
            .array(
              z.object({
                t: z.string(),
                b: z.boolean().optional(),
                i: z.boolean().optional(),
                u: z.boolean().optional(),
                c: z.string().max(40).optional(),
                fx: z.array(z.string().max(24)).max(10).optional(),
              }),
            )
            .max(3000)
            .optional(),
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
    const me = await requireMember();
    await assertBookAccess(me, data.bookSlug);
    const sql = await getSql();
    const canonBook = getCanonBook(data.bookSlug);
    let book: { id: number } | undefined;
    if (canonBook) {
      // The text of the original chapters never changes; only new chapters can be added.
      if (data.slug && canonBook.chapters.some((c) => c.slug === data.slug)) {
        throw new Error("মূল অধ্যায়ের লেখা বদলানো যায় না");
      }
      book = (await extensionBook(canonBook.slug, true)) ?? undefined;
    } else {
      const books = await sql<{ id: number }>`
        select id from library_books where slug = ${data.bookSlug} and deleted_at is null limit 1
      `;
      book = books[0];
    }
    if (!book) throw new Error("বই পাওয়া যায়নি");
    const sections: Section[] = data.sections.map((section) => ({
      id: section.id || newBlockId("s"),
      title: section.title,
      paragraphs: section.paragraphs.map((p) => ({
        id: p.id || newBlockId("p"),
        kind: p.kind,
        text: p.text ?? "",
        nsfw: Boolean(p.nsfw),
        color: p.color || undefined,
        effects: p.effects && p.effects.length ? p.effects : undefined,
        align: p.align,
        runs: p.runs && p.runs.length ? p.runs : undefined,
        mediaId: p.mediaId,
        url: p.url,
        caption: p.caption,
      })),
    }));
    const stats = summarizeBody(sections);
    const excerpt = data.excerpt || stats.excerpt;
    // Chapters in the trash still hold their slug (so a restore never collides with a new chapter).
    const existing = await sql<{ slug: string; sort_order: number; deleted_at: string | null }>`
      select slug, sort_order, deleted_at from library_chapters where book_id = ${book.id}
    `;
    const live = existing.filter((c) => !c.deleted_at);
    const taken = new Set([...existing.map((c) => c.slug), ...(canonBook ? canonBook.chapters.map((c) => c.slug) : [])]);
    const nextNumber = (canonBook ? canonBook.chapterCount : 0) + existing.length + 1;
    const slug =
      data.slug && live.some((c) => c.slug === data.slug)
        ? data.slug
        : uniqueSlug(data.slug || String(nextNumber).padStart(2, "0"), taken);
    const sortOrder = live.find((c) => c.slug === slug)?.sort_order ?? existing.length + 1;
    const body = JSON.stringify({ sections });
    await sql.query(
      `insert into library_chapters (book_id, slug, title, title_en, excerpt, sort_order, body, status)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb, coalesce($8::text, 'published'))
       on conflict (book_id, slug) do update set
         title = excluded.title,
         title_en = excluded.title_en,
         excerpt = excluded.excerpt,
         body = excluded.body,
         status = coalesce($8::text, library_chapters.status)`,
      [book.id, slug, data.title, data.titleEn ?? "", excerpt, sortOrder, body, data.status ?? null],
    );
    return { slug, status: data.status ?? null };
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
    const me = await requireMember();
    await assertBookAccess(me, data.bookSlug);
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
    const me = await requireMember();
    await assertBookAccess(me, data.bookSlug);
    const sql = await getSql();
    const books = await sql<{ id: number }>`
      select id from library_books where (slug = ${data.bookSlug} and extends_slug is null) or extends_slug = ${data.bookSlug} limit 1
    `;
    const book = books[0];
    if (!book) throw new Error("বই পাওয়া যায়নি");
    // Goes to the trash — it can be restored from Studio › Trash.
    await sql`
      update library_chapters set deleted_at = now(), deleted_by = ${me.id}
      where book_id = ${book.id} and slug = ${data.slug} and deleted_at is null
    `;
    return { ok: true };
  });

export const deleteStudioBook = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertBookAccess(me, data.slug);
    const sql = await getSql();
    await sql`update library_books set deleted_at = now(), deleted_by = ${me.id} where slug = ${data.slug} and deleted_at is null`;
    return { ok: true };
  });

/* ---------------------------------------------------------------- trash */

export type TrashItem = {
  kind: "book" | "chapter" | "media";
  id: number;
  title: string;
  /** Where it came from: the book of a chapter, or "image"/"video" for media. */
  sub: string;
  deletedAt: string;
  thumbSrc: string | null;
};

const trashKind = z.enum(["book", "chapter", "media"]);

/** What the member has deleted (the admin sees everyone's), newest first. */
export const listTrash = createServerFn({ method: "GET" }).handler(async (): Promise<TrashItem[]> => {
  const me = await requireMember();
  const admin = me.role === "admin";
  const sql = await getSql();
  const out: TrashItem[] = [];

  const books = await sql<{ id: number; title: string; author: string; deleted_at: string }>`
    select id, title, author, deleted_at from library_books
    where deleted_at is not null and (${admin}::boolean or owner_id = ${me.id})
    order by deleted_at desc
  `;
  for (const b of books) {
    out.push({ kind: "book", id: b.id, title: b.title, sub: b.author, deletedAt: new Date(b.deleted_at).toISOString(), thumbSrc: null });
  }

  const chapters = await sql<{ id: number; title: string; book_title: string; deleted_at: string }>`
    select c.id, c.title, b.title as book_title, c.deleted_at
    from library_chapters c
    join library_books b on b.id = c.book_id
    where c.deleted_at is not null and b.deleted_at is null
      and (${admin}::boolean or b.owner_id = ${me.id})
    order by c.deleted_at desc
  `;
  for (const c of chapters) {
    out.push({ kind: "chapter", id: c.id, title: c.title, sub: c.book_title, deletedAt: new Date(c.deleted_at).toISOString(), thumbSrc: null });
  }

  const media = await sql<{
    id: number;
    kind: "image" | "video";
    title: string;
    source: "upload" | "url";
    url: string | null;
    has_thumb: boolean;
    deleted_at: string;
  }>`
    select id, kind, title, source, url, (thumb is not null) as has_thumb, deleted_at
    from media
    where deleted_at is not null and (${admin}::boolean or owner_id = ${me.id})
    order by deleted_at desc
    limit 500
  `;
  for (const m of media) {
    out.push({
      kind: "media",
      id: m.id,
      title: m.title || (m.kind === "image" ? "ছবি" : "ভিডিও"),
      sub: m.kind === "image" ? "ছবি" : "ভিডিও",
      deletedAt: new Date(m.deleted_at).toISOString(),
      thumbSrc: m.kind === "image" && (m.source === "upload" || m.has_thumb) ? mediaThumbSrc(m.id) : null,
    });
  }
  return out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
});

async function assertTrashAccess(me: { id: number; role: string }, kind: "book" | "chapter" | "media", id: number) {
  const sql = await getSql();
  const rows =
    kind === "book"
      ? await sql<{ owner_id: number | null; deleted_at: string | null; book_deleted: string | null }>`
          select owner_id, deleted_at, null::timestamptz as book_deleted from library_books where id = ${id} limit 1`
      : kind === "chapter"
        ? await sql<{ owner_id: number | null; deleted_at: string | null; book_deleted: string | null }>`
            select b.owner_id, c.deleted_at, b.deleted_at as book_deleted
            from library_chapters c join library_books b on b.id = c.book_id where c.id = ${id} limit 1`
        : await sql<{ owner_id: number | null; deleted_at: string | null; book_deleted: string | null }>`
            select owner_id, deleted_at, null::timestamptz as book_deleted from media where id = ${id} limit 1`;
  const row = rows[0];
  if (!row || !row.deleted_at) throw new Error("ট্রাশে পাওয়া যায়নি");
  if (me.role !== "admin" && row.owner_id !== me.id) throw new Error("এটি আপনার তৈরি নয়");
  return row;
}

export const restoreTrash = createServerFn({ method: "POST" })
  .validator(z.object({ kind: trashKind, id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const row = await assertTrashAccess(me, data.kind, data.id);
    const sql = await getSql();
    if (data.kind === "book") {
      await sql`update library_books set deleted_at = null, deleted_by = null where id = ${data.id}`;
    } else if (data.kind === "chapter") {
      if (row.book_deleted) throw new Error("আগে বইটি ট্রাশ থেকে ফেরত আনুন");
      await sql`update library_chapters set deleted_at = null, deleted_by = null where id = ${data.id}`;
    } else {
      await sql`update media set deleted_at = null, deleted_by = null where id = ${data.id}`;
    }
    return { ok: true };
  });

/** The only place anything is really erased. Only works on things already in the trash. */
export const purgeTrash = createServerFn({ method: "POST" })
  .validator(z.object({ kind: trashKind, id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertTrashAccess(me, data.kind, data.id);
    const sql = await getSql();
    if (data.kind === "book") await sql`delete from library_books where id = ${data.id} and deleted_at is not null`;
    else if (data.kind === "chapter") await sql`delete from library_chapters where id = ${data.id} and deleted_at is not null`;
    else {
      const gone = await sql<{ url: string | null }>`delete from media where id = ${data.id} and deleted_at is not null returning url`;
      const { deleteMediaFile } = await import("@/lib/blob-store.server");
      await deleteMediaFile(gone[0]?.url);
    }
    return { ok: true };
  });

export { mergeInserts };
