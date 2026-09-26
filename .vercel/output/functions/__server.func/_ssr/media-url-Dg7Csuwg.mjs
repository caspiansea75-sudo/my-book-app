//#region node_modules/.nitro/vite/services/ssr/assets/media-url-Dg7Csuwg.js
function parseVideoUrl(raw) {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	try {
		const u = new URL(trimmed);
		if (!/^https?:$/.test(u.protocol)) return null;
		const host = u.hostname.replace(/^www\./, "");
		if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
			const fromQuery = u.searchParams.get("v");
			const parts = u.pathname.split("/").filter(Boolean);
			const fromPath = parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" ? parts[1] : void 0;
			const id = fromQuery || fromPath;
			if (id) return youtubeRef(id);
		}
		if (host === "youtu.be") {
			const id = u.pathname.split("/").filter(Boolean)[0];
			if (id) return youtubeRef(id);
		}
		if (host === "vimeo.com" || host === "player.vimeo.com") {
			const parts = u.pathname.split("/").filter(Boolean);
			const id = parts[0] === "video" ? parts[1] : parts[0];
			if (id && /^\d+$/.test(id)) return {
				provider: "vimeo",
				id,
				embedUrl: `https://player.vimeo.com/video/${id}`,
				thumbUrl: null,
				watchUrl: `https://vimeo.com/${id}`
			};
		}
		return {
			provider: "file",
			url: trimmed,
			embedUrl: trimmed,
			thumbUrl: null,
			watchUrl: trimmed
		};
	} catch {
		return null;
	}
}
function youtubeRef(id) {
	const clean = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16);
	return {
		provider: "youtube",
		id: clean,
		embedUrl: `https://www.youtube.com/embed/${clean}`,
		thumbUrl: `https://img.youtube.com/vi/${clean}/hqdefault.jpg`,
		watchUrl: `https://www.youtube.com/watch?v=${clean}`
	};
}
function isHttpUrl(raw) {
	try {
		const u = new URL(raw.trim());
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}
function mediaSrc(id) {
	return `/api/media/${id}`;
}
function mediaThumbSrc(id) {
	return `/api/media/${id}?thumb=1`;
}
//#endregion
export { parseVideoUrl as i, mediaSrc as n, mediaThumbSrc as r, isHttpUrl as t };
