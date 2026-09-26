import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cover-art-DTsfMB5d.js
var import_jsx_runtime = require_jsx_runtime();
function tone(slug) {
	let n = 0;
	for (let i = 0; i < slug.length; i += 1) n = (n + slug.charCodeAt(i) * (i + 3)) % 360;
	return n;
}
function CoverArt({ title, tagline, coverUrl, slug, className }) {
	const initial = title.trim().slice(0, 1) || "গ";
	const shift = tone(slug);
	if (coverUrl) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("cover-plate relative overflow-hidden", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: coverUrl,
			alt: "",
			className: "h-full w-full object-cover"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cover-plate-veil" })]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("cover-plate relative overflow-hidden", className),
		style: { background: `linear-gradient(${140 + shift % 40}deg, var(--book-surface-2), color-mix(in oklab, var(--book-accent) 28%, var(--book-bg)))` },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "cover-plate-lines",
			"aria-hidden": "true"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 flex h-full flex-col justify-between p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-sans text-[10px] tracking-[0.22em] text-lamp/90 uppercase",
					children: tagline ? tagline.split("·")[0]?.trim() : "গল্প"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-5xl font-semibold leading-none text-fg/90",
					children: initial
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "line-clamp-2 font-display text-sm leading-snug text-fg",
					children: title
				})
			]
		})]
	});
}
//#endregion
export { CoverArt as t };
