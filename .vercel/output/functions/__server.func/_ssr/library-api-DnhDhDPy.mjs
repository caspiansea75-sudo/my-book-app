import { a as getCanonBook, c as newBlockId, d as summarizeBody, o as listCanonBooks, r as emptyChapterBody, t as getSql, u as slugifyTitle } from "./db-D7frQ7S3.mjs";
import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { a as number, n as array, o as object, r as boolean, s as string, t as _enum } from "../_libs/zod.mjs";
import { i as parseVideoUrl, n as mediaSrc, r as mediaThumbSrc } from "./media-url-Dg7Csuwg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/library-api-DnhDhDPy.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var IMAGE_MAX = 12e5;
var VIDEO_MAX = 32e5;
function asMedia(row) {
	const uploaded = row.source === "upload";
	const src = uploaded ? mediaSrc(row.id) : row.url ?? mediaSrc(row.id);
	const thumbSrc = row.thumb ? row.thumb.startsWith("http") ? row.thumb : mediaThumbSrc(row.id) : uploaded ? mediaThumbSrc(row.id) : row.url ?? null;
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
		createdAt: row.created_at
	};
}
function parseBody(raw) {
	const value = typeof raw === "string" ? JSON.parse(raw) : raw;
	if (!value || typeof value !== "object") return emptyChapterBody();
	const sections = value.sections;
	if (!Array.isArray(sections) || sections.length === 0) return emptyChapterBody();
	return { sections };
}
function metaFromBody(id, slug, title, titleEn, excerpt, body) {
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
		hasNsfw: stats.hasNsfw
	};
}
function uniqueSlug(base, taken) {
	const root = slugifyTitle(base) || `golpo-${Date.now().toString(36)}`;
	if (!taken.has(root)) return root;
	for (let i = 2; i < 80; i += 1) {
		const next = `${root}-${i}`;
		if (!taken.has(next)) return next;
	}
	return `${root}-${Date.now().toString(36)}`;
}
async function studioBookIndex(row) {
	const metas = (await (await getSql())`
    select id, book_id, slug, title, title_en, excerpt, sort_order, body
    from library_chapters
    where book_id = ${row.id}
    order by sort_order asc, id asc
  `).map((ch) => metaFromBody(ch.id, ch.slug, ch.title, ch.title_en, ch.excerpt, parseBody(ch.body)));
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
		coverUrl: row.cover_media_id ? mediaSrc(row.cover_media_id) : null
	};
}
async function coverMap() {
	const rows = await (await getSql())`
    select book_slug, media_id from book_covers
  `;
	return new Map(rows.map((r) => [r.book_slug, mediaSrc(r.media_id)]));
}
var listLibrary_createServerFn_handler = createServerRpc({
	id: "2560a55a5f26af31f201af9d6b5fcc9474a406b59825add3c4bb290c09c79d91",
	name: "listLibrary",
	filename: "src/lib/library-api.ts"
}, (opts) => listLibrary.__executeServer(opts));
var listLibrary = createServerFn({ method: "GET" }).handler(listLibrary_createServerFn_handler, async () => {
	const sql = await getSql();
	const covers = await coverMap();
	const studioRows = await sql`
    select id, slug, title, title_en, author, tagline, description, cover_media_id, created_at
    from library_books
    order by created_at desc
  `;
	const counts = await sql`
    select book_id, count(*)::int as n from library_chapters group by book_id
  `;
	const countMap = new Map(counts.map((c) => [c.book_id, c.n]));
	const studio = studioRows.map((row) => ({
		slug: row.slug,
		title: row.title,
		titleEn: row.title_en,
		author: row.author,
		tagline: row.tagline,
		description: row.description,
		chapterCount: countMap.get(row.id) ?? 0,
		origin: "studio",
		coverUrl: row.cover_media_id ? mediaSrc(row.cover_media_id) : covers.get(row.slug) ?? null
	}));
	const canon = listCanonBooks().map((book) => ({
		slug: book.slug,
		title: book.title,
		titleEn: book.titleEn,
		author: book.author,
		tagline: book.tagline,
		description: book.description,
		chapterCount: book.chapterCount,
		origin: "canon",
		coverUrl: covers.get(book.slug) ?? null
	}));
	return [...studio, ...canon];
});
var resolveBook_createServerFn_handler = createServerRpc({
	id: "5b7b2fb0e1d643bc7346066c6ea15e315488cc1a96824da9b05935e059cc7aec",
	name: "resolveBook",
	filename: "src/lib/library-api.ts"
}, (opts) => resolveBook.__executeServer(opts));
var resolveBook = createServerFn({ method: "GET" }).validator(object({ slug: string().min(1) })).handler(resolveBook_createServerFn_handler, async ({ data }) => {
	const canon = getCanonBook(data.slug);
	const covers = await coverMap();
	if (canon) return {
		...canon,
		origin: "canon",
		coverUrl: covers.get(canon.slug) ?? null
	};
	const row = (await (await getSql())`
      select id, slug, title, title_en, author, tagline, description, cover_media_id, created_at
      from library_books
      where slug = ${data.slug}
      limit 1
    `)[0];
	if (!row) return null;
	return studioBookIndex(row);
});
var loadStudioChapter_createServerFn_handler = createServerRpc({
	id: "8fa818629d9314f253ddbcde55fbe348ae389e77eb885babc5ec65a2d1d4cb4d",
	name: "loadStudioChapter",
	filename: "src/lib/library-api.ts"
}, (opts) => loadStudioChapter.__executeServer(opts));
var loadStudioChapter = createServerFn({ method: "GET" }).validator(object({
	bookSlug: string().min(1),
	slug: string().min(1)
})).handler(loadStudioChapter_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const book = (await sql`
      select id, slug, title, title_en, author, tagline, description, cover_media_id, created_at
      from library_books where slug = ${data.bookSlug} limit 1
    `)[0];
	if (!book) return null;
	const row = (await sql`
      select id, book_id, slug, title, title_en, excerpt, sort_order, body
      from library_chapters
      where book_id = ${book.id} and slug = ${data.slug}
      limit 1
    `)[0];
	if (!row) return null;
	const body = parseBody(row.body);
	const stats = summarizeBody(body.sections);
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		titleEn: row.title_en,
		excerpt: row.excerpt || stats.excerpt,
		paraCount: stats.paraCount,
		nsfwCount: stats.nsfwCount,
		chars: stats.chars,
		sections: body.sections
	};
});
var loadChapterInserts_createServerFn_handler = createServerRpc({
	id: "a8518d1c731b3166bfb7614e466983d1a8710ce40a2ae4c90c3618b30f727e96",
	name: "loadChapterInserts",
	filename: "src/lib/library-api.ts"
}, (opts) => loadChapterInserts.__executeServer(opts));
var loadChapterInserts = createServerFn({ method: "GET" }).validator(object({
	bookSlug: string().min(1),
	slug: string().min(1)
})).handler(loadChapterInserts_createServerFn_handler, async ({ data }) => {
	return await (await getSql())`
      select i.after_para_id, i.media_id, i.caption, m.kind, m.source, m.url
      from chapter_inserts i
      join media m on m.id = i.media_id
      where i.book_slug = ${data.bookSlug} and i.chapter_slug = ${data.slug}
      order by i.sort_order asc, i.id asc
    `;
});
var listMedia_createServerFn_handler = createServerRpc({
	id: "8c90a071a2d8b7c1e1dec1dbf3f62696021e5947972adf838bb4b5e4a0f96953",
	name: "listMedia",
	filename: "src/lib/library-api.ts"
}, (opts) => listMedia.__executeServer(opts));
var listMedia = createServerFn({ method: "GET" }).handler(listMedia_createServerFn_handler, async () => {
	return (await (await getSql())`
    select id, kind, title, mime, source, url, thumb, width, height, bytes, created_at
    from media
    order by created_at desc
    limit 240
  `).map(asMedia);
});
var getMediaRecord_createServerFn_handler = createServerRpc({
	id: "af4dc59754256805cb367ba4b44f0757eb4c317711754f756c689184930639b1",
	name: "getMediaRecord",
	filename: "src/lib/library-api.ts"
}, (opts) => getMediaRecord.__executeServer(opts));
var getMediaRecord = createServerFn({ method: "GET" }).validator(object({ id: number().int().positive() })).handler(getMediaRecord_createServerFn_handler, async ({ data }) => {
	const row = (await (await getSql())`
      select id, kind, title, mime, source, url, thumb, width, height, bytes, created_at, data
      from media where id = ${data.id} limit 1
    `)[0];
	if (!row) return null;
	return {
		...asMedia(row),
		data: row.data
	};
});
var uploadSchema = object({
	kind: _enum(["image", "video"]),
	title: string().max(160).default(""),
	mime: string().min(1).max(120),
	source: _enum(["upload", "url"]),
	url: string().max(2e3).optional(),
	data: string().optional(),
	thumb: string().optional(),
	width: number().int().optional(),
	height: number().int().optional(),
	bytes: number().int().nonnegative().optional()
});
var createMedia_createServerFn_handler = createServerRpc({
	id: "d60940ded800e029b46c3a1109af670892225ef84506186fbc10ce353d7db93a",
	name: "createMedia",
	filename: "src/lib/library-api.ts"
}, (opts) => createMedia.__executeServer(opts));
var createMedia = createServerFn({ method: "POST" }).validator(uploadSchema).handler(createMedia_createServerFn_handler, async ({ data }) => {
	if (data.source === "url") {
		const url = data.url?.trim() ?? "";
		if (!url) throw new Error("লিংক দিন");
		if (data.kind === "video") {
			const parsed = parseVideoUrl(url);
			if (!parsed) throw new Error("ভিডিও লিংকটি চেনা যায়নি");
			const thumb = parsed.provider === "youtube" ? parsed.thumbUrl : data.thumb ?? null;
			const id = (await (await getSql())`
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
        `)[0]?.id;
			if (!id) throw new Error("সংরক্ষণ হয়নি");
			return { id };
		}
		const id = (await (await getSql())`
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
      `)[0]?.id;
		if (!id) throw new Error("সংরক্ষণ হয়নি");
		return { id };
	}
	const payload = data.data ?? "";
	if (!payload) throw new Error("ফাইল খালি");
	const bytes = data.bytes ?? Math.ceil(payload.length * 3 / 4);
	if (data.kind === "image" && bytes > IMAGE_MAX) throw new Error("ছবিটি অনেক বড়");
	if (data.kind === "video" && bytes > VIDEO_MAX) throw new Error("ভিডিওটি অনেক বড়");
	const id = (await (await getSql())`
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
    `)[0]?.id;
	if (!id) throw new Error("সংরক্ষণ হয়নি");
	return { id };
});
var deleteMedia_createServerFn_handler = createServerRpc({
	id: "a8e26e8f6a27d62263133905362563ca0db18400f87d0c4f504e39c0f495a86f",
	name: "deleteMedia",
	filename: "src/lib/library-api.ts"
}, (opts) => deleteMedia.__executeServer(opts));
var deleteMedia = createServerFn({ method: "POST" }).validator(object({ id: number().int().positive() })).handler(deleteMedia_createServerFn_handler, async ({ data }) => {
	await (await getSql())`delete from media where id = ${data.id}`;
	return { ok: true };
});
var bookSchema = object({
	slug: string().min(1).max(80).optional(),
	title: string().min(1).max(160),
	titleEn: string().max(160).optional(),
	author: string().max(120).optional(),
	tagline: string().max(200).optional(),
	description: string().max(1200).optional(),
	coverMediaId: number().int().positive().nullable().optional()
});
var createBook_createServerFn_handler = createServerRpc({
	id: "c6b41aa2de4cd33fc5a79a82dd62a33b9b3ec2ce8e9d463dead3ace1a9bc480b",
	name: "createBook",
	filename: "src/lib/library-api.ts"
}, (opts) => createBook.__executeServer(opts));
var createBook = createServerFn({ method: "POST" }).validator(bookSchema).handler(createBook_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const existing = await sql`select slug from library_books`;
	const taken = /* @__PURE__ */ new Set([...listCanonBooks().map((b) => b.slug), ...existing.map((b) => b.slug)]);
	const created = (await sql`
      insert into library_books (slug, title, title_en, author, tagline, description, cover_media_id)
      values (
        ${uniqueSlug(data.slug || data.titleEn || data.title, taken)},
        ${data.title},
        ${data.titleEn ?? ""},
        ${data.author ?? ""},
        ${data.tagline ?? ""},
        ${data.description ?? ""},
        ${data.coverMediaId ?? null}
      )
      returning slug
    `)[0]?.slug;
	if (!created) throw new Error("বই তৈরি হয়নি");
	return { slug: created };
});
var updateBook_createServerFn_handler = createServerRpc({
	id: "ed10c078eb879841a25a4701d760afee8b52575522b3918b782aa5b5ddb3d908",
	name: "updateBook",
	filename: "src/lib/library-api.ts"
}, (opts) => updateBook.__executeServer(opts));
var updateBook = createServerFn({ method: "POST" }).validator(bookSchema.extend({ slug: string().min(1) })).handler(updateBook_createServerFn_handler, async ({ data }) => {
	await (await getSql())`
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
var setBookCover_createServerFn_handler = createServerRpc({
	id: "6485bb57ca7e15b3aa008e7903c2fec6e7f18bcdc237dbcc8fc68b6443cd4dd5",
	name: "setBookCover",
	filename: "src/lib/library-api.ts"
}, (opts) => setBookCover.__executeServer(opts));
var setBookCover = createServerFn({ method: "POST" }).validator(object({
	slug: string().min(1),
	mediaId: number().int().positive().nullable()
})).handler(setBookCover_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	if ((await sql`select id from library_books where slug = ${data.slug} limit 1`)[0]) {
		await sql`update library_books set cover_media_id = ${data.mediaId} where slug = ${data.slug}`;
		return { ok: true };
	}
	if (!getCanonBook(data.slug)) throw new Error("বই পাওয়া যায়নি");
	if (data.mediaId == null) await sql`delete from book_covers where book_slug = ${data.slug}`;
	else await sql`
        insert into book_covers (book_slug, media_id)
        values (${data.slug}, ${data.mediaId})
        on conflict (book_slug) do update set media_id = excluded.media_id
      `;
	return { ok: true };
});
var chapterSchema = object({
	bookSlug: string().min(1),
	slug: string().min(1).max(40).optional(),
	title: string().min(1).max(160),
	titleEn: string().max(160).optional(),
	excerpt: string().max(400).optional(),
	sections: array(object({
		id: string(),
		title: string(),
		paragraphs: array(object({
			id: string(),
			kind: _enum([
				"p",
				"break",
				"image",
				"video"
			]),
			text: string().optional().default(""),
			nsfw: boolean().optional().default(false),
			mediaId: number().int().positive().optional(),
			url: string().optional(),
			caption: string().optional()
		}))
	}))
});
var saveStudioChapter_createServerFn_handler = createServerRpc({
	id: "71904f5d43ff086368995bc63a4c798afb881b830784de7828d61daa4bed00f3",
	name: "saveStudioChapter",
	filename: "src/lib/library-api.ts"
}, (opts) => saveStudioChapter.__executeServer(opts));
var saveStudioChapter = createServerFn({ method: "POST" }).validator(chapterSchema).handler(saveStudioChapter_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const book = (await sql`select id from library_books where slug = ${data.bookSlug} limit 1`)[0];
	if (!book) throw new Error("বই পাওয়া যায়নি");
	const sections = data.sections.map((section) => ({
		id: section.id || newBlockId("s"),
		title: section.title,
		paragraphs: section.paragraphs.map((p) => ({
			id: p.id || newBlockId("p"),
			kind: p.kind,
			text: p.text ?? "",
			nsfw: Boolean(p.nsfw),
			mediaId: p.mediaId,
			url: p.url,
			caption: p.caption
		}))
	}));
	const stats = summarizeBody(sections);
	const excerpt = data.excerpt || stats.excerpt;
	const existing = await sql`
      select slug, sort_order from library_chapters where book_id = ${book.id}
    `;
	const slug = data.slug && existing.some((c) => c.slug === data.slug) ? data.slug : uniqueSlug(data.slug || String(existing.length + 1).padStart(2, "0"), new Set(existing.map((c) => c.slug)));
	const sortOrder = existing.find((c) => c.slug === slug)?.sort_order ?? existing.length + 1;
	const body = JSON.stringify({ sections });
	await sql.query(`insert into library_chapters (book_id, slug, title, title_en, excerpt, sort_order, body)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb)
       on conflict (book_id, slug) do update set
         title = excluded.title,
         title_en = excluded.title_en,
         excerpt = excluded.excerpt,
         body = excluded.body`, [
		book.id,
		slug,
		data.title,
		data.titleEn ?? "",
		excerpt,
		sortOrder,
		body
	]);
	return { slug };
});
var insertSchema = object({
	bookSlug: string().min(1),
	chapterSlug: string().min(1),
	items: array(object({
		afterParaId: string(),
		mediaId: number().int().positive(),
		caption: string().max(300).optional().default("")
	}))
});
var saveChapterInserts_createServerFn_handler = createServerRpc({
	id: "8b7deecd246d7acca7b3b765d1be8406221754aefda47838d349dc3d9274fd04",
	name: "saveChapterInserts",
	filename: "src/lib/library-api.ts"
}, (opts) => saveChapterInserts.__executeServer(opts));
var saveChapterInserts = createServerFn({ method: "POST" }).validator(insertSchema).handler(saveChapterInserts_createServerFn_handler, async ({ data }) => {
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
var deleteStudioChapter_createServerFn_handler = createServerRpc({
	id: "9f244514620b4a1494df8e16e2459559f86927a96b5067e14260d577d278a006",
	name: "deleteStudioChapter",
	filename: "src/lib/library-api.ts"
}, (opts) => deleteStudioChapter.__executeServer(opts));
var deleteStudioChapter = createServerFn({ method: "POST" }).validator(object({
	bookSlug: string().min(1),
	slug: string().min(1)
})).handler(deleteStudioChapter_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const book = (await sql`select id from library_books where slug = ${data.bookSlug} limit 1`)[0];
	if (!book) throw new Error("বই পাওয়া যায়নি");
	await sql`delete from library_chapters where book_id = ${book.id} and slug = ${data.slug}`;
	return { ok: true };
});
var deleteStudioBook_createServerFn_handler = createServerRpc({
	id: "84255b995f80e0ed73e6d603e5fae2e4affea4d7c90d158abce6e3fd55e24626",
	name: "deleteStudioBook",
	filename: "src/lib/library-api.ts"
}, (opts) => deleteStudioBook.__executeServer(opts));
var deleteStudioBook = createServerFn({ method: "POST" }).validator(object({ slug: string().min(1) })).handler(deleteStudioBook_createServerFn_handler, async ({ data }) => {
	await (await getSql())`delete from library_books where slug = ${data.slug}`;
	return { ok: true };
});
//#endregion
export { createBook_createServerFn_handler, createMedia_createServerFn_handler, deleteMedia_createServerFn_handler, deleteStudioBook_createServerFn_handler, deleteStudioChapter_createServerFn_handler, getMediaRecord_createServerFn_handler, listLibrary_createServerFn_handler, listMedia_createServerFn_handler, loadChapterInserts_createServerFn_handler, loadStudioChapter_createServerFn_handler, resolveBook_createServerFn_handler, saveChapterInserts_createServerFn_handler, saveStudioChapter_createServerFn_handler, setBookCover_createServerFn_handler, updateBook_createServerFn_handler };
