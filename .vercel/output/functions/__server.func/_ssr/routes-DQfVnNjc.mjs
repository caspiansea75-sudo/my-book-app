import { i as formatCount } from "./db-D7frQ7S3.mjs";
import { S as require_jsx_runtime, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as Images, v as CloudRain, x as BookOpen } from "../_libs/lucide-react.mjs";
import { c as Route$7, l as THEMES, u as useReaderStore } from "./router-DJg4bJt1.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { t as CoverArt } from "./cover-art-DTsfMB5d.mjs";
import { t as SiteNav } from "./site-nav-BIlEvupY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DQfVnNjc.js
var import_jsx_runtime = require_jsx_runtime();
function LibraryPage({ books }) {
	const theme = useReaderStore((s) => s.theme);
	const setTheme = useReaderStore((s) => s.setTheme);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative min-h-dvh",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, { active: "library" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "stagger-in mx-auto max-w-2xl text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center justify-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudRain, {
								className: "size-4",
								strokeWidth: 1.6
							}), "গল্প সংগ্রহ"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-5 font-display text-4xl font-semibold leading-tight sm:text-6xl",
							children: "আপনার লাইব্রেরি"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mx-auto mt-4 max-w-lg font-sans text-sm leading-relaxed text-muted sm:text-base",
							children: "রাতে পড়ার বই, প্রচ্ছদ, ছবি ও ভিডিও — সব এক জায়গায়। স্টুডিও থেকে নতুন গল্প যোগ করুন।"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-8 flex flex-wrap items-center justify-center gap-1.5",
					children: THEMES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setTheme(t.id),
						className: cn("pressable h-10 rounded-full px-3 font-sans text-xs", theme === t.id ? "bg-accent text-accent-fg" : "border border-border text-muted hover:text-fg"),
						children: t.label
					}, t.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-12 grid gap-5 sm:grid-cols-2",
					children: [books.map((book) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/book/$bookSlug",
						params: { bookSlug: book.slug },
						className: "pressable group flex flex-col overflow-hidden rounded-xl border border-border bg-surface hover:bg-surface-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoverArt, {
							title: book.title,
							tagline: book.tagline,
							coverUrl: book.coverUrl,
							slug: book.slug,
							className: "aspect-[16/10] w-full"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex flex-1 flex-col p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-sans text-xs tracking-widest text-lamp",
									children: book.tagline
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-2 font-display text-xl font-semibold",
									children: book.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-2 line-clamp-3 font-sans text-sm leading-relaxed text-muted",
									children: book.description
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mt-4 flex items-center gap-2 font-sans text-xs text-muted",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, {
											className: "size-3.5",
											strokeWidth: 1.75
										}),
										formatCount(book.chapterCount),
										" আপডেট",
										book.origin === "studio" ? " · স্টুডিও" : null
									]
								})
							]
						})]
					}, book.slug)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/studio",
						className: "pressable flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center hover:bg-surface",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Images, {
								className: "size-6 text-lamp",
								strokeWidth: 1.6
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-3 font-display text-lg",
								children: "নতুন বই"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 max-w-xs font-sans text-sm text-muted",
								children: "স্টুডিওতে প্রচ্ছদ, অধ্যায়, ছবি ও ভিডিও যোগ করুন। GitHub-এ ফাইল তোলার দরকার নেই।"
							})
						]
					})]
				})
			]
		})]
	});
}
function Home() {
	const books = Route$7.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryPage, { books });
}
//#endregion
export { Home as component };
