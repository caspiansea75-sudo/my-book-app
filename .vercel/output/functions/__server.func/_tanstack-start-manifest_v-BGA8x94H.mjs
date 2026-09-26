//#region node_modules/.nitro/vite/services/ssr/assets/_tanstack-start-manifest_v-BGA8x94H.js
var tsrStartManifest = () => ({ routes: {
	__root__: {
		filePath: "/workspace/src/routes/__root.tsx",
		children: [
			"/",
			"/gallery",
			"/studio",
			"/book/$bookSlug",
			"/api/media/$id",
			"/read/$bookSlug/$slug"
		],
		preloads: ["/assets/index-qbHokjEj.js", "/assets/rolldown-runtime-hePW80VL.js"],
		scripts: [{ attrs: {
			type: "module",
			async: !0,
			src: "/assets/index-qbHokjEj.js"
		} }]
	},
	"/": {
		filePath: "/workspace/src/routes/index.tsx",
		children: void 0,
		preloads: [
			"/assets/routes-BIwLb-Eb.js",
			"/assets/utils-Cz_IX1uD.js",
			"/assets/cloud-rain-BFZBCjZl.js",
			"/assets/site-nav-DgpvqBK2.js",
			"/assets/cover-art-BxdNG5gd.js",
			"/assets/book-BVHq9QGW.js"
		]
	},
	"/gallery": {
		filePath: "/workspace/src/routes/gallery.tsx",
		children: void 0,
		preloads: [
			"/assets/gallery-CWGHh5EJ.js",
			"/assets/lightbox-DaKD1fQy.js",
			"/assets/media-uploader-BH-8T8KX.js",
			"/assets/site-nav-DgpvqBK2.js",
			"/assets/trash-2-DPFN-Tiz.js"
		]
	},
	"/studio": {
		filePath: "/workspace/src/routes/studio.tsx",
		children: ["/studio/$bookSlug"],
		preloads: [
			"/assets/studio-Cr2OOOHr.js",
			"/assets/site-nav-DgpvqBK2.js",
			"/assets/pen-line-DvP7WkNw.js",
			"/assets/cover-art-BxdNG5gd.js"
		]
	},
	"/book/$bookSlug": {
		filePath: "/workspace/src/routes/book.$bookSlug.tsx",
		children: void 0,
		preloads: [
			"/assets/book._bookSlug-B9naN-6L.js",
			"/assets/utils-Cz_IX1uD.js",
			"/assets/chevron-left-DuRFELBU.js",
			"/assets/cloud-rain-BFZBCjZl.js",
			"/assets/pen-line-DvP7WkNw.js",
			"/assets/cover-art-BxdNG5gd.js",
			"/assets/warning-gate-dV4bBkM9.js",
			"/assets/book-BVHq9QGW.js"
		]
	},
	"/studio/$bookSlug": {
		filePath: "/workspace/src/routes/studio.$bookSlug.tsx",
		children: ["/studio/$bookSlug/$slug"],
		preloads: [
			"/assets/studio._bookSlug-Cwt0jDxM.js",
			"/assets/chevron-left-DuRFELBU.js",
			"/assets/media-uploader-BH-8T8KX.js",
			"/assets/plus-CLuZWl1m.js",
			"/assets/book-BVHq9QGW.js"
		]
	},
	"/read/$bookSlug/$slug": {
		filePath: "/workspace/src/routes/read.$bookSlug.$slug.tsx",
		children: void 0,
		preloads: [
			"/assets/read._bookSlug._slug-DjZEOYFH.js",
			"/assets/utils-Cz_IX1uD.js",
			"/assets/chevron-left-DuRFELBU.js",
			"/assets/lightbox-DaKD1fQy.js",
			"/assets/plus-CLuZWl1m.js",
			"/assets/warning-gate-dV4bBkM9.js",
			"/assets/book-BVHq9QGW.js",
			"/assets/media-url-QNHVX7Hx.js",
			"/assets/media-figure-EQzfOR_I.js",
			"/assets/load-chapter-DI4t-GTK.js"
		]
	},
	"/studio/$bookSlug/$slug": {
		filePath: "/workspace/src/routes/studio.$bookSlug.$slug.tsx",
		children: void 0,
		preloads: [
			"/assets/studio._bookSlug._slug-Cc58fONm.js",
			"/assets/utils-Cz_IX1uD.js",
			"/assets/trash-2-DPFN-Tiz.js",
			"/assets/media-figure-EQzfOR_I.js",
			"/assets/load-chapter-DI4t-GTK.js"
		]
	}
} });
//#endregion
export { tsrStartManifest };
