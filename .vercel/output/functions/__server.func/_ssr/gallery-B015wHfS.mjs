import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as Trash2, i as Video, m as Images } from "../_libs/lucide-react.mjs";
import { g as listMedia, p as deleteMedia, s as Route$6 } from "./router-DJg4bJt1.mjs";
import { t as Lightbox } from "./lightbox-BTn5x8wL.mjs";
import { t as SiteNav } from "./site-nav-BIlEvupY.mjs";
import { t as MediaUploader } from "./media-uploader-Dl2dXB9r.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/gallery-B015wHfS.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function GalleryPage() {
	const initial = Route$6.useLoaderData();
	const [items, setItems] = (0, import_react.useState)(initial);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [open, setOpen] = (0, import_react.useState)(null);
	async function refresh() {
		setItems(await listMedia());
	}
	const visible = items.filter((item) => filter === "all" ? true : item.kind === filter);
	const lightboxItems = (0, import_react.useMemo)(() => visible.map((item) => ({
		id: String(item.id),
		kind: item.kind,
		src: item.src,
		url: item.url ?? void 0,
		title: item.title
	})), [visible]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative min-h-dvh",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, { active: "gallery" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mx-auto max-w-5xl px-5 py-12 sm:px-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Images, {
							className: "size-4",
							strokeWidth: 1.6
						}), "চিত্রশালা"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-4 font-display text-4xl font-semibold sm:text-5xl",
						children: "ছবি ও ভিডিও"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted",
						children: "প্রচ্ছদ, অধ্যায়ের ছবি, বা আলাদা অ্যালবাম — এখানে আপলোড করুন। ছোট ক্লিপ সরাসরি, বড় ভিডিও YouTube বা লিংক দিয়ে।"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-8",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaUploader, { onUploaded: () => {
							refresh();
						} })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-8 flex flex-wrap gap-1.5",
						children: [
							["all", "সব"],
							["image", "ছবি"],
							["video", "ভিডিও"]
						].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setFilter(id),
							className: filter === id ? "pressable h-10 rounded-full bg-accent px-3 font-sans text-xs text-accent-fg" : "pressable h-10 rounded-full border border-border px-3 font-sans text-xs text-muted",
							children: label
						}, id))
					}),
					visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-12 font-sans text-sm text-muted",
						children: "এখনো কিছু যোগ হয়নি। একটি ছবি তুলে শুরু করুন।"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "gallery-grid mt-8",
						children: visible.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "gallery-tile group",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "block h-full w-full",
								onClick: () => setOpen(i),
								"aria-label": item.title || item.kind,
								children: item.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: item.thumbSrc || item.src,
									alt: item.title
								}) : item.thumbSrc ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "relative block h-full",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: item.thumbSrc,
										alt: item.title
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "absolute inset-0 grid place-items-center bg-bg/25",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Video, { className: "size-8 text-fg" })
									})]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "grid h-full min-h-40 place-items-center bg-surface-2 text-lamp",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Video, { className: "size-8" })
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "pressable absolute top-2 right-2 grid size-10 place-items-center rounded-full bg-bg/70 text-muted opacity-0 group-hover:opacity-100",
								"aria-label": "মুছুন",
								onClick: async (e) => {
									e.stopPropagation();
									await deleteMedia({ data: { id: item.id } });
									await refresh();
								},
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
							})]
						}, item.id))
					})
				]
			}),
			open != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lightbox, {
				items: lightboxItems,
				index: open,
				onClose: () => setOpen(null),
				onIndex: setOpen
			}) : null
		]
	});
}
//#endregion
export { GalleryPage as component };
