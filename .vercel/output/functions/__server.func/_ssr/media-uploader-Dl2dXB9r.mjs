import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Upload, h as ImagePlus, i as Video, p as Link2 } from "../_libs/lucide-react.mjs";
import { f as createMedia } from "./router-DJg4bJt1.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { t as isHttpUrl } from "./media-url-Dg7Csuwg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/media-uploader-Dl2dXB9r.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var IMAGE_MAX_BYTES = 9e5;
var VIDEO_MAX_BYTES = 24e5;
var GIF_MAX_BYTES = 9e5;
function readAsDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(/* @__PURE__ */ new Error("ফাইল পড়া যায়নি"));
		reader.onload = () => {
			if (typeof reader.result === "string") resolve(reader.result);
			else reject(/* @__PURE__ */ new Error("ফাইল পড়া যায়নি"));
		};
		reader.readAsDataURL(file);
	});
}
function stripDataUrl(dataUrl) {
	const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
	if (!match?.[1] || !match[2]) throw new Error("অবৈধ ফাইল");
	return {
		mime: match[1],
		base64: match[2]
	};
}
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(/* @__PURE__ */ new Error("ছবি খোলা যায়নি"));
		img.src = src;
	});
}
function canvasToJpeg(canvas, quality) {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(/* @__PURE__ */ new Error("ছবি তৈরি যায়নি"));
				return;
			}
			const reader = new FileReader();
			reader.onerror = () => reject(/* @__PURE__ */ new Error("ছবি তৈরি যায়নি"));
			reader.onload = () => {
				if (typeof reader.result === "string") resolve(reader.result);
				else reject(/* @__PURE__ */ new Error("ছবি তৈরি যায়নি"));
			};
			reader.readAsDataURL(blob);
		}, "image/jpeg", quality);
	});
}
function drawContain(img, maxEdge) {
	const sw = "videoWidth" in img ? img.videoWidth || img.width : img.width;
	const sh = "videoHeight" in img ? img.videoHeight || img.height : img.height;
	const scale = Math.min(1, maxEdge / Math.max(sw, sh));
	const width = Math.max(1, Math.round(sw * scale));
	const height = Math.max(1, Math.round(sh * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("ছবি তৈরি যায়নি");
	ctx.fillStyle = "#111318";
	ctx.fillRect(0, 0, width, height);
	ctx.drawImage(img, 0, 0, width, height);
	return {
		canvas,
		width,
		height
	};
}
async function prepareImageUpload(file) {
	if (!file.type.startsWith("image/")) throw new Error("এটি একটি ছবি নয়");
	if (file.size > 12582912) throw new Error("ছবি ১২ এমবি-র বেশি হতে পারবে না");
	const title = file.name.replace(/\.[^.]+$/, "");
	if (file.type === "image/gif") {
		if (file.size > GIF_MAX_BYTES) throw new Error("GIF ৯০০ কেবি-র বেশি হতে পারবে না");
		const { mime, base64 } = stripDataUrl(await readAsDataUrl(file));
		return {
			kind: "image",
			mime,
			base64,
			thumb: base64,
			width: 0,
			height: 0,
			bytes: file.size,
			title
		};
	}
	const img = await loadImage(await readAsDataUrl(file));
	let quality = .8;
	let maxEdge = 1400;
	let last = null;
	for (let i = 0; i < 6; i += 1) {
		const { canvas, width, height } = drawContain(img, maxEdge);
		const dataUrl = await canvasToJpeg(canvas, quality);
		const { base64 } = stripDataUrl(dataUrl);
		const bytes = Math.ceil(base64.length * 3 / 4);
		last = {
			dataUrl,
			width,
			height,
			bytes
		};
		if (bytes <= IMAGE_MAX_BYTES) break;
		quality = Math.max(.52, quality - .08);
		maxEdge = Math.max(720, Math.round(maxEdge * .82));
	}
	if (!last || last.bytes > IMAGE_MAX_BYTES) throw new Error("ছবি আরও ছোট করে তুলুন");
	const { canvas: thumbCanvas } = drawContain(img, 480);
	const thumb = stripDataUrl(await canvasToJpeg(thumbCanvas, .62)).base64;
	return {
		kind: "image",
		mime: "image/jpeg",
		base64: stripDataUrl(last.dataUrl).base64,
		thumb,
		width: last.width,
		height: last.height,
		bytes: last.bytes,
		title
	};
}
async function prepareVideoUpload(file) {
	if (!file.type.startsWith("video/")) throw new Error("এটি একটি ভিডিও নয়");
	if (file.size > VIDEO_MAX_BYTES) throw new Error("ভিডিও আপলোড সর্বোচ্চ ২.৪ এমবি। বড় ফাইলের জন্য YouTube বা সরাসরি লিংক দিন।");
	const dataUrl = await readAsDataUrl(file);
	const { mime, base64 } = stripDataUrl(dataUrl);
	return {
		kind: "video",
		mime,
		base64,
		thumb: await captureVideoFrame(dataUrl),
		width: null,
		height: null,
		bytes: file.size,
		title: file.name.replace(/\.[^.]+$/, "")
	};
}
function captureVideoFrame(src) {
	return new Promise((resolve) => {
		const video = document.createElement("video");
		video.muted = true;
		video.playsInline = true;
		video.preload = "metadata";
		const fail = () => resolve(null);
		video.onerror = fail;
		video.onloadeddata = () => {
			try {
				video.currentTime = Math.min(.4, (video.duration || 1) * .08);
			} catch {
				fail();
			}
		};
		video.onseeked = () => {
			try {
				const { canvas } = drawContain(video, 640);
				canvas.toBlob((blob) => {
					if (!blob) {
						resolve(null);
						return;
					}
					const reader = new FileReader();
					reader.onload = () => {
						if (typeof reader.result === "string") resolve(stripDataUrl(reader.result).base64);
						else resolve(null);
					};
					reader.onerror = fail;
					reader.readAsDataURL(blob);
				}, "image/jpeg", .64);
			} catch {
				fail();
			}
		};
		video.src = src;
	});
}
function MediaUploader({ onUploaded, compact = false }) {
	const inputRef = (0, import_react.useRef)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [link, setLink] = (0, import_react.useState)("");
	const [dragging, setDragging] = (0, import_react.useState)(false);
	async function handleFiles(files) {
		const file = files[0];
		if (!file) return;
		setBusy(true);
		setError(null);
		try {
			if (file.type.startsWith("image/")) {
				const prepared = await prepareImageUpload(file);
				onUploaded((await createMedia({ data: {
					kind: "image",
					title: prepared.title,
					mime: prepared.mime,
					source: "upload",
					data: prepared.base64,
					thumb: prepared.thumb,
					width: prepared.width,
					height: prepared.height,
					bytes: prepared.bytes
				} })).id, "image");
			} else if (file.type.startsWith("video/")) {
				const prepared = await prepareVideoUpload(file);
				onUploaded((await createMedia({ data: {
					kind: "video",
					title: prepared.title,
					mime: prepared.mime,
					source: "upload",
					data: prepared.base64,
					thumb: prepared.thumb ?? void 0,
					bytes: prepared.bytes
				} })).id, "video");
			} else setError("শুধু ছবি বা ভিডিও");
		} catch (err) {
			setError(err instanceof Error ? err.message : "আপলোড ব্যর্থ");
		} finally {
			setBusy(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}
	async function handleLink() {
		const url = link.trim();
		if (!isHttpUrl(url)) {
			setError("সঠিক https লিংক দিন");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const kind = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url) ? "image" : "video";
			const result = await createMedia({ data: {
				kind,
				title: "",
				mime: kind === "image" ? "image/url" : "video/url",
				source: "url",
				url
			} });
			setLink("");
			onUploaded(result.id, kind);
		} catch (err) {
			setError(err instanceof Error ? err.message : "লিংক যোগ হয়নি");
		} finally {
			setBusy(false);
		}
	}
	function onDrop(e) {
		e.preventDefault();
		setDragging(false);
		if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("space-y-3", compact && "space-y-2"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				onDragOver: (e) => {
					e.preventDefault();
					setDragging(true);
				},
				onDragLeave: () => setDragging(false),
				onDrop,
				className: cn("rounded-xl border border-dashed px-4 py-6 text-center", dragging ? "border-lamp bg-surface-2" : "border-border bg-surface"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center justify-center gap-2 font-sans text-sm text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
							className: "size-4",
							strokeWidth: 1.7
						}), "ছবি বা ছোট ভিডিও এখানে ছাড়ুন"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 flex flex-wrap items-center justify-center gap-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							disabled: busy,
							onClick: () => inputRef.current?.click(),
							className: "pressable inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg disabled:opacity-60",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImagePlus, {
								className: "size-4",
								strokeWidth: 1.75
							}), busy ? "যাচ্ছে…" : "ফাইল বাছুন"]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 font-sans text-xs text-subtle",
						children: "ছবি স্বয়ংক্রিয়ভাবে ছোট হয়। ভিডিও আপলোড সর্বোচ্চ ২.৪ এমবি — বড় ফাইলের জন্য লিংক দিন।"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						type: "file",
						accept: "image/*,video/*",
						className: "hidden",
						onChange: (e) => {
							if (e.target.files) handleFiles(e.target.files);
						}
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2 sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "relative min-w-0 flex-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "ভিডিও বা ছবির লিংক"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link2, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: link,
							onChange: (e) => setLink(e.target.value),
							placeholder: "YouTube, Vimeo বা সরাসরি ছবি/ভিডিও লিংক",
							className: "h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-9 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-lamp"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					disabled: busy || !link.trim(),
					onClick: () => void handleLink(),
					className: "pressable inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 font-sans text-sm text-fg disabled:opacity-50",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Video, {
						className: "size-4",
						strokeWidth: 1.75
					}), "লিংক যোগ"]
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-sans text-sm text-nsfw",
				children: error
			}) : null
		]
	});
}
//#endregion
export { MediaUploader as t };
