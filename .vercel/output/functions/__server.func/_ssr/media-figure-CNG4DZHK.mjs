import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { i as parseVideoUrl } from "./media-url-Dg7Csuwg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/media-figure-CNG4DZHK.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MediaFigure({ kind, src, url, caption, className, onOpen }) {
	if (kind === "video") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VideoFigure, {
		src,
		url,
		caption,
		className
	});
	const imageSrc = src || url;
	if (!imageSrc) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
		className: cn("media-block", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "media-frame pressable",
			onClick: onOpen,
			"aria-label": caption || "ছবি বড় করে দেখুন",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: imageSrc,
				alt: caption || ""
			})
		}), caption ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", { children: caption }) : null]
	});
}
function VideoFigure({ src, url, caption, className }) {
	const parsed = parseVideoUrl(url || src || "");
	const [failed, setFailed] = (0, import_react.useState)(false);
	if (parsed?.provider === "youtube" || parsed?.provider === "vimeo") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
		className: cn("media-block", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "media-frame media-frame-video",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
				src: parsed.embedUrl,
				title: caption || "ভিডিও",
				allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
				allowFullScreen: true
			})
		}), caption ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", { children: caption }) : null]
	});
	const videoSrc = src || url;
	if (!videoSrc) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
		className: cn("media-block", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "media-frame media-frame-video",
			children: failed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "grid h-full place-items-center px-4 text-center font-sans text-sm text-muted",
				children: "ভিডিও চালানো যায়নি"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				src: videoSrc,
				controls: true,
				playsInline: true,
				preload: "metadata",
				onError: () => setFailed(true)
			})
		}), caption ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", { children: caption }) : null]
	});
}
//#endregion
export { MediaFigure as t };
