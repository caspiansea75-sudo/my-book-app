import staticIndex from "@/data/book-index.json";

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
  title: string;
  titleEn: string;
  language: string;
  chapterCount: number;
  paraCount: number;
  nsfwCount: number;
  chars: number;
  chapters: ChapterMeta[];
};

export const bookIndex = staticIndex as BookIndex;

export async function loadChapter(slug: string): Promise<Chapter> {
  const res = await fetch(`/book/chapters/${slug}.json`);
  if (!res.ok) throw new Error("এই আপডেটটি পাওয়া যায়নি");
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
