import { i as formatCount } from "./db-D7frQ7S3.mjs";
import { S as require_jsx_runtime, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { b as ChevronLeft, u as PenLine, v as CloudRain, x as BookOpen } from "../_libs/lucide-react.mjs";
import { a as Route$4, l as THEMES, u as useReaderStore } from "./router-DJg4bJt1.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { t as CoverArt } from "./cover-art-DTsfMB5d.mjs";
import { n as WarningGate, t as AmbientAudio } from "./warning-gate-Bqt0AB-M.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/book._bookSlug-BkWgDnC_.js
var import_jsx_runtime = require_jsx_runtime();
function BookCoverPage({ book }) {
	const lastSlug = useReaderStore((s) => s.lastByBook[book.slug]);
	const theme = useReaderStore((s) => s.theme);
	const setTheme = useReaderStore((s) => s.setTheme);
	const first = book.chapters[0]?.slug || "01";
	const resume = lastSlug || first;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative min-h-dvh",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AmbientAudio, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningGate, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoverArt, {
					title: book.title,
					tagline: book.tagline,
					coverUrl: book.coverUrl,
					slug: book.slug,
					className: "aspect-[3/4] w-full max-w-sm justify-self-center rounded-xl shadow-soft lg:justify-self-end"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "stagger-in",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/",
							className: "pressable mb-6 inline-flex items-center gap-1 font-sans text-xs text-muted hover:text-fg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {
								className: "size-3.5",
								strokeWidth: 1.75
							}), "লাইব্রেরি"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center gap-2 font-sans text-xs tracking-widest text-lamp",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudRain, {
								className: "size-4",
								strokeWidth: 1.6
							}), book.tagline]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "cover-title mt-5 font-display text-4xl font-semibold leading-tight sm:text-6xl",
							children: book.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-5 max-w-lg font-display text-base leading-relaxed text-muted sm:text-lg",
							children: book.description
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-8 flex flex-wrap gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/read/$bookSlug/$slug",
									params: {
										bookSlug: book.slug,
										slug: resume
									},
									className: "pressable lamp-glow inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-5 font-sans text-sm font-medium text-accent-fg",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, {
										className: "size-4",
										strokeWidth: 1.75
									}), lastSlug && lastSlug !== first ? "যেখানে ছিলেন" : "পড়া শুরু করুন"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/read/$bookSlug/$slug",
									params: {
										bookSlug: book.slug,
										slug: first
									},
									className: "pressable inline-flex h-12 items-center rounded-lg border border-border bg-surface px-5 font-sans text-sm text-fg",
									children: "প্রথম আপডেট"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/studio/$bookSlug",
									params: { bookSlug: book.slug },
									className: "pressable inline-flex h-12 items-center gap-2 rounded-lg border border-border px-4 font-sans text-sm text-muted hover:text-fg",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, {
										className: "size-4",
										strokeWidth: 1.75
									}), book.origin === "studio" ? "সম্পাদনা" : "ছবি যোগ"]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-10 flex flex-wrap gap-1.5",
							children: THEMES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setTheme(t.id),
								className: cn("pressable h-10 rounded-full px-3 font-sans text-xs", theme === t.id ? "bg-accent text-accent-fg" : "border border-border text-muted hover:text-fg"),
								children: t.label
							}, t.id))
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mx-auto max-w-5xl px-5 pb-24 sm:px-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-6 flex items-end justify-between gap-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "সূচিপত্র"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 font-sans text-sm text-muted",
						children: [
							formatCount(book.chapterCount),
							" আপডেট · ",
							formatCount(book.paraCount),
							" অনুচ্ছেদ"
						]
					})] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "grid gap-2 sm:grid-cols-2",
					children: book.chapters.map((ch) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/read/$bookSlug/$slug",
						params: {
							bookSlug: book.slug,
							slug: ch.slug
						},
						className: "pressable flex h-full flex-col rounded-lg border border-border bg-surface p-4 hover:bg-surface-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-base",
								children: ch.title
							}), ch.hasNsfw ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-sans text-xs text-nsfw",
								children: "সংবেদনশীল"
							}) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-2 line-clamp-2 font-sans text-xs leading-relaxed text-muted",
							children: ch.excerpt
						})]
					}) }, ch.slug))
				})]
			})
		]
	});
}
function BookPage() {
	const book = Route$4.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookCoverPage, { book });
}
//#endregion
export { BookPage as component };
