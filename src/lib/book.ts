export type ParaKind = "p" | "break";

export type Paragraph = {
  id: string;
  text: string;
  kind: ParaKind;
  nsfw: boolean;
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
};

export type ChapterMeta = Omit<Chapter, "sections"> & { hasNsfw: boolean };

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
};

// Every JSON file dropped into src/data/books/ is automatically picked up here.
// No code changes needed to add a new book — just add the JSON file (and its
// matching public/books/<slug>/chapters/*.json files).
const bookModules = import.meta.glob<{ default: BookIndex }>("/src/data/books/*.json", {
  eager: true,
});

const books: BookIndex[] = Object.values(bookModules)
  .map((mod) => mod.default)
  .sort((a, b) => a.title.localeCompare(b.title, "bn"));

export function listBooks(): BookIndex[] {
  return books;
}

export function getBookIndex(bookSlug: string): BookIndex | undefined {
  return books.find((b) => b.slug === bookSlug);
}

export async function loadChapter(bookSlug: string, slug: string): Promise<Chapter> {
  const res = await fetch(`/books/${bookSlug}/chapters/${slug}.json`);
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
