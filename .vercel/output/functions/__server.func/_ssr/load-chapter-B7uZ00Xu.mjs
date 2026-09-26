import { l as padSlug, s as loadCanonChapter } from "./db-D7frQ7S3.mjs";
import { _ as loadChapterInserts, v as loadStudioChapter, y as mergeInserts } from "./router-DJg4bJt1.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/load-chapter-B7uZ00Xu.js
async function loadChapterForBook(book, rawSlug) {
	const slug = padSlug(rawSlug);
	if (book.origin === "studio") {
		const chapter = await loadStudioChapter({ data: {
			bookSlug: book.slug,
			slug
		} });
		if (!chapter) throw new Error("এই আপডেটটি পাওয়া যায়নি");
		return chapter;
	}
	const chapter = await loadCanonChapter(book.slug, slug);
	const inserts = await loadChapterInserts({ data: {
		bookSlug: book.slug,
		slug
	} });
	return mergeInserts(chapter, inserts);
}
//#endregion
export { loadChapterForBook as t };
