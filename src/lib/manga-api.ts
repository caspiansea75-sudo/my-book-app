import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { assertPanelAccess, assertSeriesAccess, hiddenSet, isHidden, requireMember } from "@/lib/members-core";
import { slugifyTitle } from "@/lib/book";

function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugifyTitle(base) || `manga-${Date.now().toString(36)}`;
  if (!taken.has(root)) return root;
  for (let i = 2; i < 80; i += 1) {
    const next = `${root}-${i}`;
    if (!taken.has(next)) return next;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export type MangaSeriesCard = {
  author: string;
  hidden?: boolean;
  slug: string;
  title: string;
  description: string;
  coverMediaId: number | null;
  chapterCount: number;
};

export type MangaChapterMeta = {
  slug: string;
  title: string;
  sortOrder: number;
  panelCount: number;
  coverMediaId: number | null;
};

export type MangaPanel = {
  id: number;
  mediaId: number;
  kind: "image" | "video";
  src: string;
  caption: string;
  sortOrder: number;
};

export const updateMangaSeries = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(1),
      title: z.string().min(1).max(160),
      description: z.string().max(1200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.slug);
    const sql = await getSql();
    await sql`
      update manga_series
      set title = ${data.title}, description = ${data.description ?? ""}
      where slug = ${data.slug}
    `;
    return { ok: true };
  });

export const setMangaCover = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().min(1), mediaId: z.number().int().positive().nullable() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.slug);
    const sql = await getSql();
    await sql`update manga_series set cover_media_id = ${data.mediaId} where slug = ${data.slug}`;
    return { ok: true };
  });

export const deleteMangaSeries = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.slug);
    const sql = await getSql();
    await sql`delete from manga_series where slug = ${data.slug}`;
    return { ok: true };
  });

export const deleteMangaChapter = createServerFn({ method: "POST" })
  .validator(z.object({ seriesSlug: z.string().min(1), chapterSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.seriesSlug);
    const sql = await getSql();
    await sql`
      delete from manga_chapters c
      using manga_series s
      where c.series_id = s.id and s.slug = ${data.seriesSlug} and c.slug = ${data.chapterSlug}
    `;
    return { ok: true };
  });

export const updateMangaChapterTitle = createServerFn({ method: "POST" })
  .validator(
    z.object({ seriesSlug: z.string().min(1), chapterSlug: z.string().min(1), title: z.string().min(1).max(160) }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.seriesSlug);
    const sql = await getSql();
    await sql`
      update manga_chapters c
      set title = ${data.title}
      from manga_series s
      where c.series_id = s.id and s.slug = ${data.seriesSlug} and c.slug = ${data.chapterSlug}
    `;
    return { ok: true };
  });

export const listMangaSeries = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireMember();
  const hid = await hiddenSet("manga");
  const sql = await getSql();
  const rows = await sql<{
    slug: string;
    title: string;
    description: string;
    cover_media_id: number | null;
    chapter_count: string;
    author: string;
    owner_name: string | null;
  }>`
    select s.slug, s.title, s.description, s.cover_media_id, s.author,
      (select m.display_name from members m where m.id = s.owner_id) as owner_name,
      count(c.id) as chapter_count
    from manga_series s
    left join manga_chapters c on c.series_id = s.id
    group by s.id
    order by s.created_at desc
  `;
  const list = rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    description: r.description,
    coverMediaId: r.cover_media_id,
    chapterCount: Number(r.chapter_count),
    author: r.author || r.owner_name || "",
  })) satisfies MangaSeriesCard[];
  const shown = list.map((x) => ({ ...x, hidden: hid.has(x.slug) }));
  return me.role === "admin" ? shown : shown.filter((x) => !x.hidden);
});

export const createMangaSeries = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1).max(160),
      titleEn: z.string().max(160).optional(),
      description: z.string().max(1200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    const existing = await sql<{ slug: string }>`select slug from manga_series`;
    const slug = uniqueSlug(data.titleEn || data.title, new Set(existing.map((r) => r.slug)));
    const rows = await sql<{ slug: string }>`
      insert into manga_series (slug, title, title_en, description, owner_id)
      values (${slug}, ${data.title}, ${data.titleEn ?? ""}, ${data.description ?? ""}, ${me.id})
      returning slug
    `;
    const created = rows[0]?.slug;
    if (!created) throw new Error("মাঙ্গা তৈরি হয়নি");
    return { slug: created };
  });

export const getMangaSeries = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const hiddenNow = await isHidden("manga", data.slug);
    if (me.role !== "admin" && hiddenNow) return null;
    const sql = await getSql();
    const seriesRows = await sql<{
      id: number;
      slug: string;
      title: string;
      description: string;
      cover_media_id: number | null;
      owner_id: number | null;
      author: string;
      owner_name: string | null;
    }>`select id, slug, title, description, cover_media_id, owner_id, author,
      (select m.display_name from members m where m.id = manga_series.owner_id) as owner_name from manga_series where slug = ${data.slug} limit 1`;
    const series = seriesRows[0];
    if (!series) return null;

    const chapterRows = await sql<{
      slug: string;
      title: string;
      sort_order: number;
      panel_count: string;
      cover_media_id: number | null;
    }>`
      select c.slug, c.title, c.sort_order,
        count(p.id) as panel_count,
        min(p.media_id) filter (where p.sort_order = (
          select min(p2.sort_order) from manga_panels p2 where p2.chapter_id = c.id
        )) as cover_media_id
      from manga_chapters c
      left join manga_panels p on p.chapter_id = c.id
      where c.series_id = ${series.id}
      group by c.id
      order by c.sort_order asc, c.id asc
    `;

    return {
      hidden: hiddenNow,
      author: series.author || series.owner_name || "",
      slug: series.slug,
      title: series.title,
      description: series.description,
      coverMediaId: series.cover_media_id,
      ownerId: series.owner_id ?? null,
      chapters: chapterRows.map((r) => ({
        slug: r.slug,
        title: r.title,
        sortOrder: r.sort_order,
        panelCount: Number(r.panel_count),
        coverMediaId: r.cover_media_id,
      })) satisfies MangaChapterMeta[],
    };
  });

export const createMangaChapter = createServerFn({ method: "POST" })
  .validator(z.object({ seriesSlug: z.string().min(1), title: z.string().min(1).max(160) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.seriesSlug);
    const sql = await getSql();
    const seriesRows = await sql<{ id: number }>`select id from manga_series where slug = ${data.seriesSlug} limit 1`;
    const seriesId = seriesRows[0]?.id;
    if (!seriesId) throw new Error("মাঙ্গা পাওয়া যায়নি");

    const existing = await sql<{ slug: string; sort_order: number }>`
      select slug, sort_order from manga_chapters where series_id = ${seriesId}
    `;
    const slug = uniqueSlug(data.title, new Set(existing.map((r) => r.slug)));
    const nextOrder = existing.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1;

    const rows = await sql<{ slug: string }>`
      insert into manga_chapters (series_id, slug, title, sort_order)
      values (${seriesId}, ${slug}, ${data.title}, ${nextOrder})
      returning slug
    `;
    const created = rows[0]?.slug;
    if (!created) throw new Error("অধ্যায় তৈরি হয়নি");
    return { slug: created };
  });

export const getMangaChapterForEdit = createServerFn({ method: "GET" })
  .validator(z.object({ seriesSlug: z.string().min(1), chapterSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    if (me.role !== "admin" && (await isHidden("manga", data.seriesSlug))) return null;
    const sql = await getSql();
    const rows = await sql<{
      chapter_id: number;
      chapter_title: string;
      series_title: string;
      owner_id: number | null;
      panel_id: number | null;
      media_id: number | null;
      kind: "image" | "video" | null;
      thumb: string | null;
      url: string | null;
      source: "upload" | "url" | null;
      caption: string | null;
      sort_order: number | null;
    }>`
      select c.id as chapter_id, c.title as chapter_title, s.title as series_title, s.owner_id,
        p.id as panel_id, p.media_id, m.kind, m.thumb, m.url, m.source,
        p.caption, p.sort_order
      from manga_chapters c
      join manga_series s on s.id = c.series_id
      left join manga_panels p on p.chapter_id = c.id
        and not exists (select 1 from media d where d.id = p.media_id and d.deleted_at is not null)
      left join media m on m.id = p.media_id
      where s.slug = ${data.seriesSlug} and c.slug = ${data.chapterSlug}
      order by p.sort_order asc nulls last
    `;
    if (!rows.length) return null;
    const first = rows[0];
    const panels: MangaPanel[] = rows
      .filter((r) => r.panel_id != null)
      .map((r) => ({
        id: r.panel_id!,
        mediaId: r.media_id!,
        kind: r.kind!,
        src: r.source === "upload" ? `/api/media/${r.media_id}` : (r.url ?? r.thumb ?? ""),
        caption: r.caption ?? "",
        sortOrder: r.sort_order ?? 0,
      }));
    return {
      chapterTitle: first.chapter_title,
      seriesTitle: first.series_title,
      ownerId: first.owner_id ?? null,
      panels,
    };
  });

export const addMangaPanel = createServerFn({ method: "POST" })
  .validator(
    z.object({
      seriesSlug: z.string().min(1),
      chapterSlug: z.string().min(1),
      mediaId: z.number().int().positive(),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.seriesSlug);
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      select c.id from manga_chapters c
      join manga_series s on s.id = c.series_id
      where s.slug = ${data.seriesSlug} and c.slug = ${data.chapterSlug}
      limit 1
    `;
    const chapterId = rows[0]?.id;
    if (!chapterId) throw new Error("অধ্যায় পাওয়া যায়নি");
    const maxRows = await sql<{ max: number | null }>`
      select max(sort_order) as max from manga_panels where chapter_id = ${chapterId}
    `;
    const nextOrder = (maxRows[0]?.max ?? -1) + 1;
    await sql`
      insert into manga_panels (chapter_id, media_id, sort_order)
      values (${chapterId}, ${data.mediaId}, ${nextOrder})
    `;
    return { ok: true };
  });

export const removeMangaPanel = createServerFn({ method: "POST" })
  .validator(z.object({ panelId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertPanelAccess(me, [data.panelId]);
    const sql = await getSql();
    await sql`delete from manga_panels where id = ${data.panelId}`;
    return { ok: true };
  });

export const reorderMangaPanels = createServerFn({ method: "POST" })
  .validator(z.object({ panelIds: z.array(z.number().int().positive()).min(1) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertPanelAccess(me, data.panelIds);
    const sql = await getSql();
    for (let i = 0; i < data.panelIds.length; i += 1) {
      await sql`update manga_panels set sort_order = ${i} where id = ${data.panelIds[i]}`;
    }
    return { ok: true };
  });

export const getMangaChapterForReading = createServerFn({ method: "GET" })
  .validator(z.object({ seriesSlug: z.string().min(1), chapterSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    if (me.role !== "admin" && (await isHidden("manga", data.seriesSlug))) return null;
    const sql = await getSql();
    const seriesRows = await sql<{ id: number; slug: string; title: string }>`
      select id, slug, title from manga_series where slug = ${data.seriesSlug} limit 1
    `;
    const series = seriesRows[0];
    if (!series) return null;

    const chapters = await sql<{ id: number; slug: string; title: string; sort_order: number }>`
      select id, slug, title, sort_order from manga_chapters
      where series_id = ${series.id}
      order by sort_order asc, id asc
    `;
    const idx = chapters.findIndex((c) => c.slug === data.chapterSlug);
    if (idx === -1) return null;
    const current = chapters[idx];

    const panelRows = await sql<{
      media_id: number;
      kind: "image" | "video";
      thumb: string | null;
      url: string | null;
      source: "upload" | "url";
      caption: string;
      sort_order: number;
    }>`
      select m.id as media_id, m.kind, m.thumb, m.url, m.source, p.caption, p.sort_order
      from manga_panels p
      join media m on m.id = p.media_id and m.deleted_at is null
      where p.chapter_id = ${current.id}
      order by p.sort_order asc
    `;

    return {
      seriesSlug: series.slug,
      seriesTitle: series.title,
      chapterTitle: current.title,
      chapterSlug: current.slug,
      prevSlug: idx > 0 ? chapters[idx - 1]?.slug : undefined,
      nextSlug: idx < chapters.length - 1 ? chapters[idx + 1]?.slug : undefined,
      panels: panelRows.map((r) => ({
        mediaId: r.media_id,
        kind: r.kind,
        src: r.source === "upload" ? `/api/media/${r.media_id}` : (r.url ?? r.thumb ?? ""),
        caption: r.caption,
        sortOrder: r.sort_order,
      })),
    };
  });

/** Add several panels at once, keeping the order given. */
export const addMangaPanels = createServerFn({ method: "POST" })
  .validator(
    z.object({
      seriesSlug: z.string().min(1),
      chapterSlug: z.string().min(1),
      mediaIds: z.array(z.number().int().positive()).min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertSeriesAccess(me, data.seriesSlug);
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      select c.id from manga_chapters c
      join manga_series s on s.id = c.series_id
      where s.slug = ${data.seriesSlug} and c.slug = ${data.chapterSlug}
      limit 1
    `;
    const chapterId = rows[0]?.id;
    if (!chapterId) throw new Error("অধ্যায় পাওয়া যায়নি");
    const maxRows = await sql<{ max: number | null }>`
      select max(sort_order) as max from manga_panels where chapter_id = ${chapterId}
    `;
    const base = (maxRows[0]?.max ?? -1) + 1;
    await sql.query(
      `insert into manga_panels (chapter_id, media_id, sort_order)
       select $1::int, t.id, $2::int + t.ord::int - 1
       from unnest($3::int[]) with ordinality as t(id, ord)
       join media m on m.id = t.id and m.deleted_at is null
       order by t.ord`,
      [chapterId, base, data.mediaIds],
    );
    return { ok: true, added: data.mediaIds.length };
  });
