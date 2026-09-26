import { o as __toESM } from "../_runtime.mjs";
import { n as __exportAll, t as getSql } from "./db-D7frQ7S3.mjs";
import { S as require_jsx_runtime, X as require_react, Y as notFound, _ as createFileRoute, d as Scripts, f as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, v as createRootRoute, x as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as number, c as union, i as literal, n as array, o as object, r as boolean, s as string, t as _enum } from "../_libs/zod.mjs";
import { s as TriangleAlert } from "../_libs/lucide-react.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/library-api-DVWd_Gm6.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function mergeInserts(chapter, inserts) {
	if (inserts.length === 0) return chapter;
	const grouped = /* @__PURE__ */ new Map();
	for (const item of inserts) {
		const key = item.after_para_id || "";
		const list = grouped.get(key) ?? [];
		list.push(item);
		grouped.set(key, list);
	}
	const inject = (afterId) => {
		const list = grouped.get(afterId);
		if (!list) return [];
		return list.map((item, i) => ({
			id: `ins-${item.media_id}-${i}`,
			kind: item.kind,
			text: "",
			nsfw: false,
			mediaId: item.media_id,
			url: item.source === "url" ? item.url ?? void 0 : void 0,
			caption: item.caption
		}));
	};
	const sections = chapter.sections.map((section) => {
		const paragraphs = [...inject("")];
		for (const para of section.paragraphs) {
			paragraphs.push(para);
			paragraphs.push(...inject(para.id));
		}
		return {
			...section,
			paragraphs
		};
	});
	if (sections.length === 0) return {
		...chapter,
		sections: [{
			id: "main",
			title: "",
			paragraphs: inject("")
		}]
	};
	return {
		...chapter,
		sections
	};
}
var listLibrary = createServerFn({ method: "GET" }).handler(createSsrRpc("2560a55a5f26af31f201af9d6b5fcc9474a406b59825add3c4bb290c09c79d91"));
var resolveBook = createServerFn({ method: "GET" }).validator(object({ slug: string().min(1) })).handler(createSsrRpc("5b7b2fb0e1d643bc7346066c6ea15e315488cc1a96824da9b05935e059cc7aec"));
var loadStudioChapter = createServerFn({ method: "GET" }).validator(object({
	bookSlug: string().min(1),
	slug: string().min(1)
})).handler(createSsrRpc("8fa818629d9314f253ddbcde55fbe348ae389e77eb885babc5ec65a2d1d4cb4d"));
var loadChapterInserts = createServerFn({ method: "GET" }).validator(object({
	bookSlug: string().min(1),
	slug: string().min(1)
})).handler(createSsrRpc("a8518d1c731b3166bfb7614e466983d1a8710ce40a2ae4c90c3618b30f727e96"));
var listMedia = createServerFn({ method: "GET" }).handler(createSsrRpc("8c90a071a2d8b7c1e1dec1dbf3f62696021e5947972adf838bb4b5e4a0f96953"));
createServerFn({ method: "GET" }).validator(object({ id: number().int().positive() })).handler(createSsrRpc("af4dc59754256805cb367ba4b44f0757eb4c317711754f756c689184930639b1"));
var uploadSchema = object({
	kind: _enum(["image", "video"]),
	title: string().max(160).default(""),
	mime: string().min(1).max(120),
	source: _enum(["upload", "url"]),
	url: string().max(2e3).optional(),
	data: string().optional(),
	thumb: string().optional(),
	width: number().int().optional(),
	height: number().int().optional(),
	bytes: number().int().nonnegative().optional()
});
var createMedia = createServerFn({ method: "POST" }).validator(uploadSchema).handler(createSsrRpc("d60940ded800e029b46c3a1109af670892225ef84506186fbc10ce353d7db93a"));
var deleteMedia = createServerFn({ method: "POST" }).validator(object({ id: number().int().positive() })).handler(createSsrRpc("a8e26e8f6a27d62263133905362563ca0db18400f87d0c4f504e39c0f495a86f"));
var bookSchema = object({
	slug: string().min(1).max(80).optional(),
	title: string().min(1).max(160),
	titleEn: string().max(160).optional(),
	author: string().max(120).optional(),
	tagline: string().max(200).optional(),
	description: string().max(1200).optional(),
	coverMediaId: number().int().positive().nullable().optional()
});
var createBook = createServerFn({ method: "POST" }).validator(bookSchema).handler(createSsrRpc("c6b41aa2de4cd33fc5a79a82dd62a33b9b3ec2ce8e9d463dead3ace1a9bc480b"));
var updateBook = createServerFn({ method: "POST" }).validator(bookSchema.extend({ slug: string().min(1) })).handler(createSsrRpc("ed10c078eb879841a25a4701d760afee8b52575522b3918b782aa5b5ddb3d908"));
var setBookCover = createServerFn({ method: "POST" }).validator(object({
	slug: string().min(1),
	mediaId: number().int().positive().nullable()
})).handler(createSsrRpc("6485bb57ca7e15b3aa008e7903c2fec6e7f18bcdc237dbcc8fc68b6443cd4dd5"));
var chapterSchema = object({
	bookSlug: string().min(1),
	slug: string().min(1).max(40).optional(),
	title: string().min(1).max(160),
	titleEn: string().max(160).optional(),
	excerpt: string().max(400).optional(),
	sections: array(object({
		id: string(),
		title: string(),
		paragraphs: array(object({
			id: string(),
			kind: _enum([
				"p",
				"break",
				"image",
				"video"
			]),
			text: string().optional().default(""),
			nsfw: boolean().optional().default(false),
			mediaId: number().int().positive().optional(),
			url: string().optional(),
			caption: string().optional()
		}))
	}))
});
var saveStudioChapter = createServerFn({ method: "POST" }).validator(chapterSchema).handler(createSsrRpc("71904f5d43ff086368995bc63a4c798afb881b830784de7828d61daa4bed00f3"));
var insertSchema = object({
	bookSlug: string().min(1),
	chapterSlug: string().min(1),
	items: array(object({
		afterParaId: string(),
		mediaId: number().int().positive(),
		caption: string().max(300).optional().default("")
	}))
});
var saveChapterInserts = createServerFn({ method: "POST" }).validator(insertSchema).handler(createSsrRpc("8b7deecd246d7acca7b3b765d1be8406221754aefda47838d349dc3d9274fd04"));
var deleteStudioChapter = createServerFn({ method: "POST" }).validator(object({
	bookSlug: string().min(1),
	slug: string().min(1)
})).handler(createSsrRpc("9f244514620b4a1494df8e16e2459559f86927a96b5067e14260d577d278a006"));
var deleteStudioBook = createServerFn({ method: "POST" }).validator(object({ slug: string().min(1) })).handler(createSsrRpc("84255b995f80e0ed73e6d603e5fae2e4affea4d7c90d158abce6e3fd55e24626"));
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-DJg4bJt1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var THEMES = [
	{
		id: "monsoon",
		label: "বর্ষা রাত",
		hint: "ধানমন্ডি বৃষ্টি"
	},
	{
		id: "cafe",
		label: "কফি হাউস",
		hint: "অ্যাম্বার ল্যাম্প"
	},
	{
		id: "manuscript",
		label: "হাতের খাতা",
		hint: "ক্রীম কাগজ"
	},
	{
		id: "leather",
		label: "পুরান ঢাকা",
		hint: "চামড়ার মলাট"
	}
];
var useReaderStore = create()(persist((set, get) => ({
	theme: "monsoon",
	fontSize: 19,
	nsfwMode: "hidden",
	inverted: [],
	lastByBook: {},
	progress: {},
	audioOn: false,
	warned: false,
	setTheme: (theme) => set({ theme }),
	setFontSize: (n) => set({ fontSize: Math.min(24, Math.max(16, n)) }),
	showAllNsfw: () => set({
		nsfwMode: "shown",
		inverted: []
	}),
	hideAllNsfw: () => set({
		nsfwMode: "hidden",
		inverted: []
	}),
	togglePara: (id) => set((s) => ({ inverted: s.inverted.includes(id) ? s.inverted.filter((x) => x !== id) : [...s.inverted, id] })),
	isParaVisible: (id, nsfw) => {
		if (!nsfw) return true;
		const { nsfwMode, inverted } = get();
		const flipped = inverted.includes(id);
		return nsfwMode === "shown" ? !flipped : flipped;
	},
	setLastSlug: (bookSlug, slug) => set((s) => ({ lastByBook: {
		...s.lastByBook,
		[bookSlug]: slug
	} })),
	lastSlugFor: (bookSlug) => get().lastByBook[bookSlug],
	setProgress: (key, paraId) => set((s) => ({ progress: {
		...s.progress,
		[key]: paraId
	} })),
	setAudioOn: (audioOn) => set({ audioOn }),
	setWarned: () => set({ warned: true })
}), {
	name: "golpo-reader-v2",
	partialize: (s) => ({
		theme: s.theme,
		fontSize: s.fontSize,
		nsfwMode: s.nsfwMode,
		inverted: s.inverted.slice(-400),
		lastByBook: s.lastByBook,
		progress: s.progress,
		audioOn: s.audioOn,
		warned: s.warned
	})
}));
var DROPS = Array.from({ length: 42 }, (_, i) => ({
	left: `${(i * 17 + 8) % 100}%`,
	delay: `${i * .37 % 4.8}s`,
	duration: `${2.4 + i % 7 * .28}s`,
	height: `${10 + i % 5 * 3}vh`,
	opacity: .18 + i % 5 * .06
}));
function RainLayer() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rain-layer",
		"aria-hidden": "true",
		children: DROPS.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
			left: d.left,
			animationDelay: d.delay,
			animationDuration: d.duration,
			height: d.height,
			opacity: d.opacity
		} }, i))
	});
}
function ThemeRoot({ children }) {
	const theme = useReaderStore((s) => s.theme);
	(0, import_react.useEffect)(() => {
		document.documentElement.dataset.theme = theme;
		const meta = document.querySelector("meta[name=\"theme-color\"]");
		const bg = getComputedStyle(document.documentElement).getPropertyValue("--book-bg").trim();
		if (meta && bg) meta.setAttribute("content", bg);
	}, [theme]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-dvh bg-bg text-fg",
		children: [
			children,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RainLayer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "book-grain",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "book-vignette",
				"aria-hidden": "true"
			})
		]
	});
}
var styles_default = "/assets/styles-DAGdkaxD.css";
var APP_NAME = "গল্প সংগ্রহ";
var Route$8 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#0c1016"
			},
			{
				name: "description",
				content: "একটি নৈশ লাইব্রেরি — গল্প পড়ুন, ছবি ও ভিডিও যোগ করুন।"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@400;500;600;700&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "bn",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "antialiased",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeRoot, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	})
});
var $$splitComponentImporter$6 = () => import("./routes-DQfVnNjc.mjs");
var Route$7 = createFileRoute("/")({
	loader: () => listLibrary(),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./gallery-B015wHfS.mjs");
var Route$6 = createFileRoute("/gallery")({
	loader: () => listMedia(),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./studio-BhoYt9j-.mjs");
var Route$5 = createFileRoute("/studio")({
	loader: () => listLibrary(),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./book._bookSlug-BkWgDnC_.mjs");
var Route$4 = createFileRoute("/book/$bookSlug")({
	loader: async ({ params }) => {
		const book = await resolveBook({ data: { slug: params.bookSlug } });
		if (!book) throw notFound();
		return book;
	},
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./studio._bookSlug-1wdFfUgi.mjs");
var Route$3 = createFileRoute("/studio/$bookSlug")({
	loader: async ({ params }) => {
		const book = await resolveBook({ data: { slug: params.bookSlug } });
		if (!book) throw notFound();
		return {
			book,
			media: await listMedia()
		};
	},
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var Route$2 = createFileRoute("/api/media/$id")({ server: { handlers: { GET: async ({ params, request }) => {
	const id = Number.parseInt(params.id, 10);
	if (!Number.isFinite(id) || id <= 0) return new Response("Not found", { status: 404 });
	const row = (await (await getSql())`
          select mime, source, url, data, thumb from media where id = ${id} limit 1
        `)[0];
	if (!row) return new Response("Not found", { status: 404 });
	if (new URL(request.url).searchParams.get("thumb") === "1" && row.thumb) {
		if (row.thumb.startsWith("http")) return Response.redirect(row.thumb, 302);
		const bytes = Buffer.from(row.thumb, "base64");
		return new Response(bytes, { headers: {
			"Content-Type": "image/jpeg",
			"Cache-Control": "public, max-age=31536000, immutable"
		} });
	}
	if (row.source === "url" && row.url) return Response.redirect(row.url, 302);
	if (!row.data) return new Response("Not found", { status: 404 });
	const bytes = Buffer.from(row.data, "base64");
	return new Response(bytes, { headers: {
		"Content-Type": row.mime || "application/octet-stream",
		"Cache-Control": "public, max-age=31536000, immutable"
	} });
} } } });
var $$splitComponentImporter$1 = () => import("./read._bookSlug._slug-xsu6NLyA.mjs");
var Route$1 = createFileRoute("/read/$bookSlug/$slug")({
	loader: async ({ params }) => {
		const book = await resolveBook({ data: { slug: params.bookSlug } });
		if (!book) throw notFound();
		return { book };
	},
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./studio._bookSlug._slug-DYpKSz9O.mjs");
var Route = createFileRoute("/studio/$bookSlug/$slug")({
	loader: async ({ params }) => {
		const book = await resolveBook({ data: { slug: params.bookSlug } });
		if (!book) throw notFound();
		if (params.slug === "new") {
			if (book.origin !== "studio") throw notFound();
			return {
				book,
				slug: void 0
			};
		}
		return {
			book,
			slug: params.slug
		};
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var IndexRoute = Route$7.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$8
});
var GalleryRoute = Route$6.update({
	id: "/gallery",
	path: "/gallery",
	getParentRoute: () => Route$8
});
var StudioRoute = Route$5.update({
	id: "/studio",
	path: "/studio",
	getParentRoute: () => Route$8
});
var BookBookSlugRoute = Route$4.update({
	id: "/book/$bookSlug",
	path: "/book/$bookSlug",
	getParentRoute: () => Route$8
});
var StudioBookSlugRoute = Route$3.update({
	id: "/$bookSlug",
	path: "/$bookSlug",
	getParentRoute: () => StudioRoute
});
var ApiMediaIdRoute = Route$2.update({
	id: "/api/media/$id",
	path: "/api/media/$id",
	getParentRoute: () => Route$8
});
var ReadBookSlugSlugRoute = Route$1.update({
	id: "/read/$bookSlug/$slug",
	path: "/read/$bookSlug/$slug",
	getParentRoute: () => Route$8
});
var StudioBookSlugRouteChildren = { StudioBookSlugSlugRoute: Route.update({
	id: "/$slug",
	path: "/$slug",
	getParentRoute: () => StudioBookSlugRoute
}) };
var StudioRouteChildren = { StudioBookSlugRoute: StudioBookSlugRoute._addFileChildren(StudioBookSlugRouteChildren) };
var rootRouteChildren = {
	IndexRoute,
	GalleryRoute,
	StudioRoute: StudioRoute._addFileChildren(StudioRouteChildren),
	BookBookSlugRoute,
	ApiMediaIdRoute,
	ReadBookSlugSlugRoute
};
var routeTree = Route$8._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { updateBook as C, setBookCover as S, loadChapterInserts as _, Route$4 as a, saveChapterInserts as b, Route$7 as c, createBook as d, createMedia as f, listMedia as g, deleteStudioChapter as h, Route$3 as i, THEMES as l, deleteStudioBook as m, Route as n, Route$5 as o, deleteMedia as p, Route$1 as r, Route$6 as s, router_exports as t, useReaderStore as u, loadStudioChapter as v, saveStudioChapter as x, mergeInserts as y };
