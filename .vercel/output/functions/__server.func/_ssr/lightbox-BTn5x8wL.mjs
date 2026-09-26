import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { b as ChevronLeft, t as X, y as ChevronRight } from "../_libs/lucide-react.mjs";
import { t as MediaFigure } from "./media-figure-CNG4DZHK.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/lightbox-BTn5x8wL.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Lightbox({ items, index, onClose, onIndex }) {
	const item = items[index];
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			if (e.key === "Escape") onClose();
			if (e.key === "ArrowRight") onIndex((index + 1) % items.length);
			if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
		};
		window.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [
		index,
		items.length,
		onClose,
		onIndex
	]);
	if (!item) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "lightbox",
		role: "dialog",
		"aria-modal": "true",
		"aria-label": item.title || "মিডিয়া",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "lightbox-scrim",
				onClick: onClose,
				"aria-label": "বন্ধ"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lightbox-stage",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaFigure, {
					kind: item.kind,
					src: item.src,
					url: item.url,
					caption: item.caption || item.title
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "lightbox-btn lightbox-close",
				onClick: onClose,
				"aria-label": "বন্ধ",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
					className: "size-5",
					strokeWidth: 1.75
				})
			}),
			items.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "lightbox-btn lightbox-prev",
				onClick: () => onIndex((index - 1 + items.length) % items.length),
				"aria-label": "আগের",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {
					className: "size-5",
					strokeWidth: 1.75
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "lightbox-btn lightbox-next",
				onClick: () => onIndex((index + 1) % items.length),
				"aria-label": "পরের",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
					className: "size-5",
					strokeWidth: 1.75
				})
			})] }) : null
		]
	});
}
//#endregion
export { Lightbox as t };
