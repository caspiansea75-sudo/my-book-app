import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireMember } from "@/lib/members-core";
import { listCanonBooks, type Section } from "@/lib/book";

/** Story download for the admin. The text is turned into files in the admin's browser. */

export type ExportListItem = {
  slug: string;
  title: string;
  titleEn: string;
  author: string;
  tagline: string;
  description: string;
  origin: "canon" | "studio";
  chapterCount: number;
  /** Built-in stories: the chapter files to fetch. Studio stories are loaded from the database instead. */
  chapters: { slug: string }[];
  /** Original stories: the hidden book that holds chapters added from the Studio (loaded from the database). */
  extraBook?: string;
};

async function requireAdmin() {
  const me = await requireMember();
  if (me.role !== "admin") throw new Error("এই পাতা শুধু অ্যাডমিনের জন্য");
  return me;
}

/** Every story the admin can download: built-in ones and ones written in the studio. */
export const listExportBooks = createServerFn({ method: "GET" })
  .validator(z.object({ drafts: z.boolean() }))
  .handler(async ({ data }): Promise<ExportListItem[]> => {
    await requireAdmin();
    const sql = await getSql();

    const authors = await sql<{ key: string; author: string }>`select key, author from author_overrides where kind = 'book'`;
    const authorOf = new Map(authors.map((a) => [a.key, a.author]));

    const studio = await sql<{
      slug: string;
      title: string;
      title_en: string;
      author: string;
      owner_name: string | null;
      tagline: string;
      description: string;
      n: number;
    }>`
      select b.slug, b.title, b.title_en, b.author, b.tagline, b.description,
        (select m.display_name from members m where m.id = b.owner_id) as owner_name,
        (select count(*)::int from library_chapters c
          where c.book_id = b.id and c.deleted_at is null and (${data.drafts}::boolean or c.status = 'published')) as n
      from library_books b
      where b.deleted_at is null and b.extends_slug is null
      order by b.created_at desc
    `;

    const extras = await sql<{ extends_slug: string; slug: string; n: number }>`
      select b.extends_slug, b.slug,
        (select count(*)::int from library_chapters c
          where c.book_id = b.id and c.deleted_at is null and (${data.drafts}::boolean or c.status = 'published')) as n
      from library_books b
      where b.extends_slug is not null and b.deleted_at is null
    `;
    const extraOf = new Map(extras.map((e) => [e.extends_slug, e]));

    const canon = listCanonBooks().map(
      (b): ExportListItem => ({
        slug: b.slug,
        title: b.title,
        titleEn: b.titleEn,
        author: authorOf.get(b.slug) ?? (/^(অজানা|unknown|anonymous|n\/a)$/i.test(b.author.trim()) ? "" : b.author),
        tagline: b.tagline,
        description: b.description,
        origin: "canon",
        chapterCount: b.chapters.length + Number(extraOf.get(b.slug)?.n ?? 0),
        chapters: b.chapters.map((c) => ({ slug: c.slug })),
        extraBook: extraOf.get(b.slug) && Number(extraOf.get(b.slug)?.n) > 0 ? extraOf.get(b.slug)?.slug : undefined,
      }),
    );

    return [
      ...studio.map(
        (b): ExportListItem => ({
          slug: b.slug,
          title: b.title,
          titleEn: b.title_en,
          author: b.author || b.owner_name || "",
          tagline: b.tagline,
          description: b.description,
          origin: "studio",
          chapterCount: Number(b.n),
          chapters: [],
        }),
      ),
      ...canon,
    ];
  });

function sectionsOf(raw: unknown): Section[] {
  try {
    const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    const sections = (value as { sections?: Section[] } | null)?.sections;
    return Array.isArray(sections) ? sections : [];
  } catch {
    return [];
  }
}

/** The chapters of one studio story, in reading order. */
export const loadExportStudioBook = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1), drafts: z.boolean() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sql = await getSql();
    const rows = await sql<{ title: string; title_en: string; status: string; body: unknown }>`
      select c.title, c.title_en, c.status, c.body
      from library_chapters c
      join library_books b on b.id = c.book_id
      where b.slug = ${data.slug} and b.deleted_at is null and c.deleted_at is null
        and (${data.drafts}::boolean or c.status = 'published')
      order by c.sort_order asc, c.id asc
    `;
    return rows.map((r) => ({
      title: r.title,
      titleEn: r.title_en,
      status: r.status === "draft" ? ("draft" as const) : ("published" as const),
      sections: sectionsOf(r.body),
    }));
  });
