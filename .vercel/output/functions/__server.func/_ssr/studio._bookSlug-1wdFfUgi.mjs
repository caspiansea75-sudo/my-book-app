import { o as __toESM } from "../_runtime.mjs";
import { i as formatCount } from "./db-D7frQ7S3.mjs";
import { S as require_jsx_runtime, X as require_react, b as useNavigate, x as useRouter, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { b as ChevronLeft, h as ImagePlus, l as Plus } from "../_libs/lucide-react.mjs";
import { C as updateBook, S as setBookCover, i as Route$3, m as deleteStudioBook } from "./router-DJg4bJt1.mjs";
import { t as CoverArt } from "./cover-art-DTsfMB5d.mjs";
import { t as SiteNav } from "./site-nav-BIlEvupY.mjs";
import { t as MediaUploader } from "./media-uploader-Dl2dXB9r.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/studio._bookSlug-1wdFfUgi.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function StudioBookPage() {
	const { book, media } = Route$3.useLoaderData();
	const router = useRouter();
	const navigate = useNavigate();
	const canon = book.origin !== "studio";
	const [title, setTitle] = (0, import_react.useState)(book.title);
	const [titleEn, setTitleEn] = (0, import_react.useState)(book.titleEn);
	const [author, setAuthor] = (0, import_react.useState)(book.author);
	const [tagline, setTagline] = (0, import_react.useState)(book.tagline);
	const [description, setDescription] = (0, import_react.useState)(book.description);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [coverOpen, setCoverOpen] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	async function saveMeta(e) {
		e.preventDefault();
		if (canon) return;
		setBusy(true);
		setError(null);
		try {
			await updateBook({ data: {
				slug: book.slug,
				title,
				titleEn,
				author,
				tagline,
				description
			} });
			await router.invalidate();
		} catch (err) {
			setError(err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ");
		} finally {
			setBusy(false);
		}
	}
	async function pickCover(id) {
		await setBookCover({ data: {
			slug: book.slug,
			mediaId: id
		} });
		setCoverOpen(false);
		await router.invalidate();
	}
	async function remove() {
		if (canon) return;
		if (!window.confirm("এই বই মুছে ফেলবেন?")) return;
		await deleteStudioBook({ data: { slug: book.slug } });
		await navigate({ to: "/studio" });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative min-h-dvh",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, { active: "studio" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mx-auto max-w-5xl px-5 py-10 sm:px-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/studio",
					className: "pressable inline-flex items-center gap-1 text-xs text-muted hover:text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-3.5" }), "স্টুডিও"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoverArt, {
						title: book.title,
						tagline: book.tagline,
						coverUrl: book.coverUrl,
						slug: book.slug,
						className: "aspect-[3/4] w-full rounded-xl"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setCoverOpen((v) => !v),
						className: "pressable mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border font-sans text-sm text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImagePlus, { className: "size-4" }), "প্রচ্ছদ"]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-sans text-xs tracking-widest text-lamp",
							children: canon ? "মূল সংগ্রহ" : "স্টুডিও বই"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-2 font-display text-3xl font-semibold sm:text-4xl",
							children: book.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 font-sans text-sm text-muted",
							children: [formatCount(book.chapterCount), " অধ্যায়"]
						}),
						canon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-5 rounded-lg border border-border bg-surface px-4 py-3 font-sans text-sm text-muted",
							children: "এই বইয়ের লেখা অপরিবর্তিত। প্রচ্ছদ বদলান, আর যেকোনো অধ্যায়ে ছবি বা ভিডিও বসান।"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: (e) => void saveMeta(e),
							className: "mt-6 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: title,
									onChange: (e) => setTitle(e.target.value),
									className: "field-input"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: titleEn,
									onChange: (e) => setTitleEn(e.target.value),
									className: "field-input"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: author,
									onChange: (e) => setAuthor(e.target.value),
									className: "field-input",
									placeholder: "লেখক"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: tagline,
									onChange: (e) => setTagline(e.target.value),
									className: "field-input"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									value: description,
									onChange: (e) => setDescription(e.target.value),
									rows: 4,
									className: "field-input"
								}),
								error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-sans text-sm text-nsfw",
									children: error
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										disabled: busy,
										className: "pressable h-11 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg",
										children: "সংরক্ষণ"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void remove(),
										className: "pressable h-11 rounded-lg border border-border px-4 font-sans text-sm text-nsfw",
										children: "বই মুছুন"
									})]
								})
							]
						}),
						coverOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 rounded-xl border border-border bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-3 font-display",
									children: "প্রচ্ছদের ছবি"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaUploader, {
									compact: true,
									onUploaded: (id) => void pickCover(id)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-4 grid grid-cols-4 gap-2",
									children: media.filter((m) => m.kind === "image").map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void pickCover(item.id),
										className: "pressable overflow-hidden rounded-md border border-border",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
											src: item.thumbSrc || item.src,
											alt: "",
											className: "aspect-square w-full object-cover"
										})
									}, item.id))
								})
							]
						}) : null
					] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-12 flex items-end justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "অধ্যায়"
					}), !canon ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/studio/$bookSlug/$slug",
						params: {
							bookSlug: book.slug,
							slug: "new"
						},
						className: "pressable inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "নতুন অধ্যায়"]
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-5 grid gap-2",
					children: book.chapters.map((ch) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/studio/$bookSlug/$slug",
						params: {
							bookSlug: book.slug,
							slug: ch.slug
						},
						className: "pressable flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 hover:bg-surface-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block font-display text-base",
							children: ch.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-1 block font-sans text-xs text-muted",
							children: ch.excerpt
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 font-sans text-xs text-lamp",
							children: canon ? "ছবি যোগ" : "সম্পাদনা"
						})]
					}) }, ch.slug))
				})
			]
		})]
	});
}
//#endregion
export { StudioBookPage as component };
