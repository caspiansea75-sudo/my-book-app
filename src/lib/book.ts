export type ParaKind = "p" | "break" | "image" | "video";

export type TextRun = {
  t: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  c?: string;
  fx?: string[];
};

export type ParaAlign = "left" | "center" | "right";

export type Paragraph = {
  id: string;
  text: string;
  kind: ParaKind;
  nsfw: boolean;
  color?: string;
  effects?: string[];
  runs?: TextRun[];
  align?: ParaAlign;
  mediaId?: number;
  url?: string;
  caption?: string;
};

export type Section = {
  id: string;
  title: string;
  paragraphs: Paragraph[];
};

export type Chapter = {
  id: number;
  slug: string;
  title: string;
  titleEn: string;
  excerpt: string;
  paraCount: number;
  nsfwCount: number;
  chars: number;
  sections: Section[];
  /** Studio chapters only: a draft is visible to its author and the admin, nobody else. */
  status?: "draft" | "published";
  /** Added from the Studio to an original story (the first chapters come from the story files). */
  extra?: boolean;
};

export type ChapterMeta = Omit<Chapter, "sections"> & { hasNsfw: boolean };

export type BookOrigin = "canon" | "studio";

export type BookIndex = {
  slug: string;
  title: string;
  titleEn: string;
  author: string;
  language: string;
  tagline: string;
  description: string;
  chapterCount: number;
  paraCount: number;
  nsfwCount: number;
  chars: number;
  chapters: ChapterMeta[];
  origin?: BookOrigin;
  coverUrl?: string | null;
  /** Member who created it (null = made before accounts, or an original book). */
  ownerId?: number | null;
  /** Marked 18+ by hand (or, for the old bundled stories, until someone decides otherwise). */
  adult?: boolean;
};

export type LibraryBookCard = {
  hidden?: boolean;
  slug: string;
  title: string;
  titleEn: string;
  author: string;
  tagline: string;
  description: string;
  chapterCount: number;
  origin: BookOrigin;
  coverUrl: string | null;
  nsfwCount?: number;
  /** 18+ mark: set by hand; the old bundled stories fall back to their flagged-paragraph count. */
  adult?: boolean;
  createdAt?: number;
  /** When the newest chapter went up (ms). 0 = no date known. */
  updatedAt?: number;
  ownerId?: number | null;
};

const bookModules = import.meta.glob<{ default: BookIndex }>("/src/data/books/*.json", {
  eager: true,
});

const books: BookIndex[] = Object.values(bookModules)
  .map((mod) => ({ ...mod.default, origin: "canon" as const }))
  .sort((a, b) => a.title.localeCompare(b.title, "bn"));

export function listCanonBooks(): BookIndex[] {
  return books;
}

export function getCanonBook(bookSlug: string): BookIndex | undefined {
  return books.find((b) => b.slug === bookSlug);
}

export function canonChapterUrl(bookSlug: string, slug: string): string {
  return `/books/${bookSlug}/chapters/${slug}.json`;
}

export async function loadCanonChapter(bookSlug: string, slug: string): Promise<Chapter> {
  const res = await fetch(canonChapterUrl(bookSlug, slug));
  if (!res.ok) throw new Error("এই আপডেটটি পাওয়া যায়নি");
  return res.json() as Promise<Chapter>;
}

export function formatCount(n: number): string {
  return n.toLocaleString("bn-BD");
}

export function padSlug(raw: string): string {
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return String(n).padStart(2, "0");
  return raw;
}

export function slugifyTitle(input: string): string {
  const ascii = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return ascii;
}

export function newBlockId(prefix = "b"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function summarizeBody(sections: Section[]): {
  paraCount: number;
  nsfwCount: number;
  chars: number;
  excerpt: string;
  hasNsfw: boolean;
} {
  let paraCount = 0;
  let nsfwCount = 0;
  let chars = 0;
  let excerpt = "";
  for (const section of sections) {
    for (const para of section.paragraphs) {
      if (para.kind === "p") {
        paraCount += 1;
        chars += para.text.length;
        if (para.nsfw) nsfwCount += 1;
        if (!excerpt && para.text.trim()) excerpt = para.text.trim().slice(0, 110);
      }
    }
  }
  if (excerpt.length === 110) excerpt = `${excerpt}…`;
  return { paraCount, nsfwCount, chars, excerpt, hasNsfw: nsfwCount > 0 };
}

export function emptyChapterBody(): { sections: Section[] } {
  return {
    sections: [{ id: "main", title: "", paragraphs: [] }],
  };
}
