import { del, get, put } from "@vercel/blob";

/**
 * Vercel Blob (PRIVATE store) storage for uploaded media (images / videos).
 * Neon keeps the text data; big files go here so both quotas are used.
 * If neither BLOB_READ_WRITE_TOKEN nor BLOB_STORE_ID is set or Blob fails (e.g. full), the caller
 * falls back to saving the file inside Neon, so uploads never just break.
 */
export function blobEnabled(): boolean {
  // Older stores use BLOB_READ_WRITE_TOKEN; new private stores use BLOB_STORE_ID + Vercel's automatic login (OIDC).
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_STORE_ID?.trim());
}

export function isBlobUrl(url: string | null | undefined): boolean {
  return Boolean(url && /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url));
}

/** Upload base64 data to Blob. Returns the public URL, or null if it could not be stored there. */
export async function putMedia(base64: string, mime: string): Promise<string | null> {
  if (!blobEnabled()) return null;
  try {
    const ext = (mime.split("/")[1] ?? "bin").split(";")[0].replace(/[^a-z0-9]/gi, "") || "bin";
    const res = await put(`media/${Date.now()}.${ext}`, Buffer.from(base64, "base64"), {
      access: "private",
      contentType: mime,
      addRandomSuffix: true,
    });
    return res.url;
  } catch (err) {
    console.error("[blob] upload failed, falling back to Neon:", err);
    return null;
  }
}

/** Stream a private Blob file (only call after the viewer has been authenticated). */
export async function getMediaFile(url: string) {
  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return { stream: result.stream, contentType: result.blob.contentType };
}

/** Remove a file from Blob (no-op for non-Blob URLs). */
export async function deleteMediaFile(url: string | null | undefined): Promise<void> {
  if (!isBlobUrl(url)) return;
  try {
    await del(url as string);
  } catch (err) {
    console.error("[blob] delete failed:", err);
  }
}
