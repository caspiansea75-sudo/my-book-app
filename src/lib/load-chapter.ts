import {
  loadCanonChapter,
  padSlug,
  type BookIndex,
  type Chapter,
} from "@/lib/book";
import {
  loadChapterInserts,
  loadStudioChapter,
  mergeInserts,
} from "@/lib/library-api";

export async function loadChapterForBook(book: BookIndex, rawSlug: string): Promise<Chapter> {
  const slug = padSlug(rawSlug);
  if (book.origin === "studio") {
    const chapter = await loadStudioChapter({ data: { bookSlug: book.slug, slug } });
    if (!chapter) throw new Error("এই আপডেটটি পাওয়া যায়নি");
    return chapter;
  }
  const chapter = await loadCanonChapter(book.slug, slug);
  const inserts = await loadChapterInserts({ data: { bookSlug: book.slug, slug } });
  return mergeInserts(chapter, inserts);
}
