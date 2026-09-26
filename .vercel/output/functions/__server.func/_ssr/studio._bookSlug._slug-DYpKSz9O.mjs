import { o as __toESM } from "../_runtime.mjs";
import { c as newBlockId, l as padSlug } from "./db-D7frQ7S3.mjs";
import { S as require_jsx_runtime, X as require_react, b as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { b as ChevronLeft, c as Trash2, h as ImagePlus, i as Video, l as Plus, o as Type } from "../_libs/lucide-react.mjs";
import { b as saveChapterInserts, g as listMedia, h as deleteStudioChapter, n as Route, x as saveStudioChapter } from "./router-DJg4bJt1.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { t as MediaFigure } from "./media-figure-CNG4DZHK.mjs";
import { t as SiteNav } from "./site-nav-BIlEvupY.mjs";
import { t as MediaUploader } from "./media-uploader-Dl2dXB9r.mjs";
import { t as loadChapterForBook } from "./load-chapter-B7uZ00Xu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/studio._bookSlug._slug-DYpKSz9O.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function blocksFromChapter(chapter) {
	if (!chapter) return [{
		key: newBlockId("p"),
		type: "p",
		text: "",
		nsfw: false,
		originId: newBlockId("p")
	}];
	const out = [];
	for (const section of chapter.sections) for (const para of section.paragraphs) if (para.kind === "break") out.push({
		key: para.id,
		type: "break",
		originId: para.id
	});
	else if (para.kind === "image" && para.mediaId) out.push({
		key: para.id,
		type: "image",
		mediaId: para.mediaId,
		caption: para.caption ?? "",
		originId: para.id
	});
	else if (para.kind === "video") out.push({
		key: para.id,
		type: "video",
		mediaId: para.mediaId,
		url: para.url,
		caption: para.caption ?? "",
		originId: para.id
	});
	else out.push({
		key: para.id,
		type: "p",
		text: para.text,
		nsfw: para.nsfw,
		originId: para.id
	});
	return out.length ? out : [{
		key: newBlockId("p"),
		type: "p",
		text: "",
		nsfw: false,
		originId: newBlockId("p")
	}];
}
function toSections(blocks) {
	return [{
		id: "main",
		title: "",
		paragraphs: blocks.map((block) => {
			if (block.type === "break") return {
				id: block.originId,
				kind: "break",
				text: "",
				nsfw: false
			};
			if (block.type === "image") return {
				id: block.originId,
				kind: "image",
				text: "",
				nsfw: false,
				mediaId: block.mediaId,
				caption: block.caption
			};
			if (block.type === "video") return {
				id: block.originId,
				kind: "video",
				text: "",
				nsfw: false,
				mediaId: block.mediaId,
				url: block.url,
				caption: block.caption
			};
			return {
				id: block.originId,
				kind: "p",
				text: block.text,
				nsfw: block.nsfw
			};
		})
	}];
}
function ChapterEditor({ book, chapter, slug }) {
	const navigate = useNavigate();
	const canon = book.origin !== "studio";
	const [title, setTitle] = (0, import_react.useState)(chapter?.title ?? "");
	const [titleEn, setTitleEn] = (0, import_react.useState)(chapter?.titleEn ?? "");
	const [excerpt, setExcerpt] = (0, import_react.useState)(chapter?.excerpt ?? "");
	const [blocks, setBlocks] = (0, import_react.useState)(() => blocksFromChapter(chapter));
	const [picker, setPicker] = (0, import_react.useState)(null);
	const [library, setLibrary] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const mediaIds = (0, import_react.useMemo)(() => new Set(blocks.flatMap((b) => b.type === "image" || b.type === "video" ? [b.mediaId] : [])), [blocks]);
	function update(i, patch) {
		setBlocks((list) => list.map((b, idx) => idx === i ? {
			...b,
			...patch
		} : b));
	}
	function insertAt(i, block) {
		setBlocks((list) => {
			const next = [...list];
			next.splice(i, 0, block);
			return next;
		});
	}
	function removeAt(i) {
		setBlocks((list) => list.filter((_, idx) => idx !== i));
	}
	async function openPicker(index) {
		setPicker(index);
		if (!library) setLibrary(await listMedia());
	}
	function pickMedia(item) {
		if (picker == null) return;
		const key = newBlockId(item.kind === "image" ? "img" : "vid");
		const block = item.kind === "image" ? {
			key,
			type: "image",
			mediaId: item.id,
			caption: item.title,
			originId: key
		} : {
			key,
			type: "video",
			mediaId: item.id,
			url: item.url ?? void 0,
			caption: item.title,
			originId: key
		};
		insertAt(picker, block);
		setPicker(null);
	}
	async function onUploaded(id, kind) {
		const items = await listMedia();
		setLibrary(items);
		const found = items.find((m) => m.id === id);
		if (!found || picker == null) return;
		pickMedia(found);
	}
	async function save() {
		setBusy(true);
		setError(null);
		try {
			if (canon) {
				if (!slug) throw new Error("অধ্যায় খুঁজে পাওয়া যায়নি");
				const items = [];
				let lastPara = "";
				for (const block of blocks) if (block.type === "p" || block.type === "break") lastPara = block.originId;
				else if (block.type === "image" || block.type === "video" && block.mediaId) items.push({
					afterParaId: lastPara,
					mediaId: block.mediaId,
					caption: block.caption
				});
				await saveChapterInserts({ data: {
					bookSlug: book.slug,
					chapterSlug: slug,
					items
				} });
			} else {
				const result = await saveStudioChapter({ data: {
					bookSlug: book.slug,
					slug,
					title,
					titleEn,
					excerpt,
					sections: toSections(blocks)
				} });
				if (!slug) {
					await navigate({
						to: "/studio/$bookSlug/$slug",
						params: {
							bookSlug: book.slug,
							slug: result.slug
						}
					});
					return;
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ");
		} finally {
			setBusy(false);
		}
	}
	async function removeChapter() {
		if (canon || !slug) return;
		if (!window.confirm("এই অধ্যায় মুছে ফেলবেন?")) return;
		await deleteStudioChapter({ data: {
			bookSlug: book.slug,
			slug
		} });
		await navigate({
			to: "/studio/$bookSlug",
			params: { bookSlug: book.slug }
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "শিরোনাম",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: title,
						onChange: (e) => setTitle(e.target.value),
						disabled: canon,
						className: "field-input"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "English title",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: titleEn,
						onChange: (e) => setTitleEn(e.target.value),
						disabled: canon,
						className: "field-input"
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "সারাংশ",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					value: excerpt,
					onChange: (e) => setExcerpt(e.target.value),
					disabled: canon,
					rows: 2,
					className: "field-input min-h-16"
				})
			}),
			canon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-lg border border-border bg-surface px-4 py-3 font-sans text-sm text-muted",
				children: "মূল পাঠ GitHub থেকে আসে। এখানে অনুচ্ছেদের মাঝে ছবি ও ভিডিও বসান — লেখা থাকবে অক্ষত।"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: blocks.map((block, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-xl border border-border bg-surface p-3",
					children: [
						block.type === "p" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: block.text,
							onChange: (e) => update(i, { text: e.target.value }),
							disabled: canon,
							rows: 4,
							className: "field-input min-h-28 font-display leading-relaxed",
							placeholder: "অনুচ্ছেদ লিখুন…"
						}) : null,
						block.type === "break" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "scene-break py-2",
							children: "দৃশ্য বিরতি"
						}) : null,
						block.type === "image" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaFigure, {
								kind: "image",
								src: `/api/media/${block.mediaId}`,
								caption: block.caption
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: block.caption,
								onChange: (e) => update(i, { caption: e.target.value }),
								placeholder: "ক্যাপশন",
								className: "field-input"
							})]
						}) : null,
						block.type === "video" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaFigure, {
								kind: "video",
								src: block.mediaId ? `/api/media/${block.mediaId}` : void 0,
								url: block.url,
								caption: block.caption
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: block.caption,
								onChange: (e) => update(i, { caption: e.target.value }),
								placeholder: "ক্যাপশন",
								className: "field-input"
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: "ছবি",
									onClick: () => void openPicker(i + 1),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImagePlus, { className: "size-3.5" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: "ভিডিও",
									onClick: () => void openPicker(i + 1),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Video, { className: "size-3.5" })
								}),
								!canon ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: "অনুচ্ছেদ",
									onClick: () => insertAt(i + 1, {
										key: newBlockId("p"),
										type: "p",
										text: "",
										nsfw: false,
										originId: newBlockId("p")
									}),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Type, { className: "size-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: "বিরতি",
									onClick: () => insertAt(i + 1, {
										key: newBlockId("br"),
										type: "break",
										originId: newBlockId("br")
									}),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" })
								})] }) : null,
								(!canon || block.type === "image" || block.type === "video") && blocks.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									label: "মুছুন",
									onClick: () => removeAt(i),
									danger: true,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
								}) : null
							]
						})
					]
				}, block.key))
			}),
			picker != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl border border-border bg-surface-2 p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-base",
							children: "মিডিয়া বাছুন"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "pressable text-sm text-muted",
							onClick: () => setPicker(null),
							children: "বন্ধ"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaUploader, {
						compact: true,
						onUploaded: (id, kind) => void onUploaded(id, kind)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4",
						children: (library ?? []).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => pickMedia(item),
							className: cn("pressable overflow-hidden rounded-lg border border-border bg-surface", mediaIds.has(item.id) && "ring-1 ring-lamp"),
							children: item.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: item.thumbSrc || item.src,
								alt: "",
								className: "aspect-square w-full object-cover"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "grid aspect-square place-items-center text-lamp",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Video, { className: "size-6" })
							})
						}, item.id))
					})
				]
			}) : null,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-sans text-sm text-nsfw",
				children: error
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: busy || !title.trim(),
						onClick: () => void save(),
						className: "pressable inline-flex h-12 items-center rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg disabled:opacity-50",
						children: busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"
					}),
					slug && !canon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void removeChapter(),
						className: "pressable inline-flex h-12 items-center rounded-lg border border-border px-4 font-sans text-sm text-nsfw",
						children: "অধ্যায় মুছুন"
					}) : null,
					slug ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: `/read/${book.slug}/${padSlug(slug)}`,
						className: "pressable inline-flex h-12 items-center rounded-lg border border-border px-4 font-sans text-sm text-fg",
						children: "পড়ে দেখুন"
					}) : null
				]
			})
		]
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mb-1.5 block font-sans text-xs tracking-wide text-muted",
			children: label
		}), children]
	});
}
function IconBtn({ children, label, onClick, danger }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: cn("pressable inline-flex h-9 items-center gap-1 rounded-full px-2.5 font-sans text-[11px]", danger ? "text-nsfw hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-fg"),
		children: [children, label]
	});
}
function StudioChapterPage() {
	const { book, slug } = Route.useLoaderData();
	const [chapter, setChapter] = (0, import_react.useState)(null);
	const [ready, setReady] = (0, import_react.useState)(!slug);
	const [error, setError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!slug) return;
		let live = true;
		setReady(false);
		loadChapterForBook(book, slug).then((ch) => {
			if (!live) return;
			setChapter(ch);
			setReady(true);
		}).catch((err) => {
			if (!live) return;
			setError(err instanceof Error ? err.message : "লোড ব্যর্থ");
			setReady(true);
		});
		return () => {
			live = false;
		};
	}, [book, slug]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative min-h-dvh",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, { active: "studio" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mx-auto max-w-3xl px-5 py-10 sm:px-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/studio/$bookSlug",
					params: { bookSlug: book.slug },
					className: "pressable inline-flex items-center gap-1 text-xs text-muted hover:text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-3.5" }), book.title]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-4 font-display text-3xl font-semibold",
					children: chapter ? chapter.title : slug ? "অধ্যায়" : "নতুন অধ্যায়"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8",
					children: [error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-sans text-sm text-nsfw",
						children: error
					}) : null, !ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-24 animate-pulse rounded-xl bg-surface" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-surface" })]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChapterEditor, {
						book,
						chapter,
						slug
					}, slug ?? "new")]
				})
			]
		})]
	});
}
//#endregion
export { StudioChapterPage as component };
