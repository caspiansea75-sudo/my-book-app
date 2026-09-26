import { S as require_jsx_runtime, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as Images, u as PenLine, x as BookOpen } from "../_libs/lucide-react.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/site-nav-BIlEvupY.js
var import_jsx_runtime = require_jsx_runtime();
var ITEMS = [
	{
		to: "/",
		label: "লাইব্রেরি",
		icon: BookOpen,
		id: "library"
	},
	{
		to: "/gallery",
		label: "চিত্রশালা",
		icon: Images,
		id: "gallery"
	},
	{
		to: "/studio",
		label: "স্টুডিও",
		icon: PenLine,
		id: "studio"
	}
];
function SiteNav({ active }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
		className: "relative z-20 border-b border-border/80 bg-bg/80 backdrop-blur-md",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/",
				className: "pressable flex min-w-0 items-center gap-2 text-fg",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "grid size-8 place-items-center rounded-md bg-surface-2 text-lamp",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, {
						className: "size-4",
						strokeWidth: 1.7
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate font-display text-sm tracking-wide",
					children: "গল্প সংগ্রহ"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "flex items-center gap-1",
				children: ITEMS.map((item) => {
					const Icon = item.icon;
					const on = item.id === active;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.to,
						className: cn("pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3 font-sans text-xs", on ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							className: "size-3.5",
							strokeWidth: 1.75
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden sm:inline",
							children: item.label
						})]
					}, item.id);
				})
			})]
		})
	});
}
//#endregion
export { SiteNav as t };
