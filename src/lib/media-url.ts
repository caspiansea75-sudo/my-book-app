export type VideoRef =
  | {
      provider: "youtube";
      id: string;
      embedUrl: string;
      thumbUrl: string;
      watchUrl: string;
    }
  | {
      provider: "vimeo";
      id: string;
      embedUrl: string;
      thumbUrl: null;
      watchUrl: string;
    }
  | {
      provider: "file";
      url: string;
      embedUrl: string;
      thumbUrl: null;
      watchUrl: string;
    };

/**
 * Rewrites known "share page" links (Google Drive, Dropbox, Imgur, GitHub)
 * into a direct-file URL that can be dropped straight into <img>/<video src>.
 * Anything it doesn't recognize is returned unchanged.
 */
export function normalizeMediaUrl(raw: string): string {
  const trimmed = raw.trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return trimmed;
  }
  if (!/^https?:$/.test(u.protocol)) return trimmed;
  const host = u.hostname.replace(/^www\./, "");

  // Google Drive: /file/d/<id>/view or open?id=<id> or uc?id=<id>
  if (host === "drive.google.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    const dIdx = parts.indexOf("d");
    if (dIdx !== -1 && parts[dIdx + 1]) id = parts[dIdx + 1];
    if (!id) id = u.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    return trimmed;
  }

  // Dropbox: force the raw-content variant instead of the HTML preview page.
  if (host === "dropbox.com") {
    u.searchParams.set("dl", "1");
    return u.toString();
  }

  // Imgur page links (imgur.com/<id>) -> direct i.imgur.com file link.
  if (host === "imgur.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 1 && /^[a-zA-Z0-9]+$/.test(parts[0].replace(/\.\w+$/, ""))) {
      const hasExt = /\.\w+$/.test(parts[0]);
      const file = hasExt ? parts[0] : `${parts[0]}.jpg`;
      return `https://i.imgur.com/${file}`;
    }
    return trimmed;
  }

  // GitHub file "blob" view -> raw.githubusercontent.com
  if (host === "github.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    const blobIdx = parts.indexOf("blob");
    if (blobIdx !== -1) {
      const rest = [...parts.slice(0, blobIdx), ...parts.slice(blobIdx + 1)];
      return `https://raw.githubusercontent.com/${rest.join("/")}`;
    }
    return trimmed;
  }

  return trimmed;
}

/**
 * Tries to load `url` as an image in the browser to tell images and
 * videos apart when the URL itself has no file extension to go on
 * (Drive/Dropbox/etc links after normalizeMediaUrl). Resolves "video"
 * on error or if nothing happens within `timeoutMs`.
 */
export function detectMediaKind(url: string, timeoutMs = 4000): Promise<"image" | "video"> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (kind: "image" | "video") => {
      if (settled) return;
      settled = true;
      resolve(kind);
    };
    img.onload = () => finish("image");
    img.onerror = () => finish("video");
    img.src = url;
    setTimeout(() => finish("video"), timeoutMs);
  });
}

export function parseVideoUrl(raw: string): VideoRef | null {
  const trimmed = normalizeMediaUrl(raw.trim());
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const fromQuery = u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      const fromPath =
        parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" ? parts[1] : undefined;
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
      if (id && /^\d+$/.test(id)) {
        return {
          provider: "vimeo",
          id,
          embedUrl: `https://player.vimeo.com/video/${id}`,
          thumbUrl: null,
          watchUrl: `https://vimeo.com/${id}`,
        };
      }
    }

    return {
      provider: "file",
      url: trimmed,
      embedUrl: trimmed,
      thumbUrl: null,
      watchUrl: trimmed,
    };
  } catch {
    return null;
  }
}

function youtubeRef(id: string): VideoRef {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16);
  return {
    provider: "youtube",
    id: clean,
    embedUrl: `https://www.youtube.com/embed/${clean}`,
    thumbUrl: `https://img.youtube.com/vi/${clean}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${clean}`,
  };
}

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function mediaSrc(id: number): string {
  return `/api/media/${id}`;
}

export function mediaThumbSrc(id: number): string {
  return `/api/media/${id}?thumb=1`;
}
