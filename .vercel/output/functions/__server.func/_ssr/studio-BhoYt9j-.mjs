import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, X as require_react, b as useNavigate, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as PenLine } from "../_libs/lucide-react.mjs";
import { d as createBook, o as Route$5 } from "./router-DJg4bJt1.mjs";
import { t as CoverArt } from "./cover-art-DTsfMB5d.mjs";
import { t as SiteNav } from "./site-nav-BIlEvupY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/studio-BhoYt9j-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function StudioHome() {
	const books = Route$5.useLoaderData();
	const navigate = useNavigate();
	const [title, setTitle] = (0, import_react.useState)("");
	const [titleEn, setTitleEn] = (0, import_react.useState)("");
	const [tagline, setTagline] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	async function onCreate(e) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const result = await createBook({ data: {
				title,
				titleEn,
				tagline,
				description
			} });
			await navigate({
				to: "/studio/$bookSlug",
				params: { bookSlug: result.slug }
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "তৈরি হয়নি");
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative min-h-dvh",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, { active: "studio" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mx-auto max-w-5xl px-5 py-12 sm:px-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, {
						className: "size-4",
						strokeWidth: 1.6
					}), "সম্পাদনা কক্ষ"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-4 font-display text-4xl font-semibold sm:text-5xl",
					children: "স্টুডিও"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted",
					children: "নতুন বই লিখুন, প্রচ্ছদ তুলুন, অধ্যায়ে ছবি ও ভিডিও বসান। সবকিছু সাইটেই থাকে — Vercel ডিপ্লয়ের সাথে সংরক্ষিত, GitHub-এ মিডিয়া কমিট করতে হয় না।"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: (e) => void onCreate(e),
					className: "mt-10 rounded-xl border border-border bg-surface p-5 sm:p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "নতুন বই"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 grid gap-3 sm:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mb-1.5 block font-sans text-xs text-muted",
									children: "শিরোনাম"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									required: true,
									value: title,
									onChange: (e) => setTitle(e.target.value),
									className: "field-input"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mb-1.5 block font-sans text-xs text-muted",
									children: "English title (slug-এর জন্য)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: titleEn,
									onChange: (e) => setTitleEn(e.target.value),
									className: "field-input"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mt-3 block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1.5 block font-sans text-xs text-muted",
								children: "ট্যাগলাইন"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: tagline,
								onChange: (e) => setTagline(e.target.value),
								className: "field-input"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mt-3 block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1.5 block font-sans text-xs text-muted",
								children: "পরিচিতি"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: description,
								onChange: (e) => setDescription(e.target.value),
								rows: 3,
								className: "field-input"
							})]
						}),
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 font-sans text-sm text-nsfw",
							children: error
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							disabled: busy || !title.trim(),
							className: "pressable mt-5 inline-flex h-12 items-center rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg disabled:opacity-50",
							children: busy ? "তৈরি হচ্ছে…" : "বই খুলুন"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-14 font-display text-2xl",
					children: "বইসমূহ"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-5 grid gap-4 sm:grid-cols-2",
					children: books.map((book) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/studio/$bookSlug",
						params: { bookSlug: book.slug },
						className: "pressable flex gap-4 overflow-hidden rounded-xl border border-border bg-surface p-3 hover:bg-surface-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoverArt, {
							title: book.title,
							tagline: book.tagline,
							coverUrl: book.coverUrl,
							slug: book.slug,
							className: "h-28 w-24 shrink-0 rounded-lg"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0 py-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block font-sans text-xs text-lamp",
									children: book.origin === "studio" ? "স্টুডিও বই" : "মূল সংগ্রহ"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-1 block font-display text-lg",
									children: book.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-1 block font-sans text-xs text-muted",
									children: book.origin === "studio" ? "লেখা ও মিডিয়া সম্পাদনা" : "প্রচ্ছদ ও ছবি যোগ করুন"
								})
							]
						})]
					}, book.slug))
				})
			]
		})]
	});
}
//#endregion
export { StudioHome as component };
