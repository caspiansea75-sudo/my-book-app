/**
 * A small ZIP / CBZ reader that runs in the browser with no extra library.
 * Reads the list of files first (cheap), and unpacks a file only when asked, so a big chapter never has to sit
 * in memory all at once. Handles stored and deflate-compressed files (what practically every ZIP / CBZ uses).
 */
import { naturalCompare } from "@/lib/page-images";

export type ZipErrorCode = "not-zip" | "zip64" | "unsupported";
export class ZipError extends Error {
  code: ZipErrorCode;
  constructor(code: ZipErrorCode) {
    super(code);
    this.code = code;
  }
}

export type ZipEntry = { path: string; size: number; read: () => Promise<Uint8Array> };

export const MAX_ZIP_IMAGE_BYTES = 30 * 1024 * 1024;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", bmp: "image/bmp" };
export const mimeFromName = (name: string) => MIME[(/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase()] ?? "application/octet-stream";

function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder(utf8Flag ? "utf-8" : "latin1").decode(bytes);
  }
}

async function readLimited(stream: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new ZipError("unsupported");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export async function readZip(file: Blob): Promise<ZipEntry[]> {
  const size = file.size;
  if (size < 22) throw new ZipError("not-zip");
  const tailLen = Math.min(size, 65557);
  const tail = new Uint8Array(await file.slice(size - tailLen).arrayBuffer());
  const tv = new DataView(tail.buffer);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("not-zip");
  const count = tv.getUint16(eocd + 10, true);
  const cdSize = tv.getUint32(eocd + 12, true);
  const cdOffset = tv.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ZipError("zip64");
  if (cdOffset + cdSize > size) throw new ZipError("not-zip");
  const cd = new Uint8Array(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const dv = new DataView(cd.buffer);
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new ZipError("not-zip");
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const rawSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const path = decodeName(cd.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0);
    p += 46 + nameLen + extraLen + commentLen;
    const encrypted = (flags & 1) !== 0;
    entries.push({
      path,
      size: rawSize,
      read: async () => {
        if (encrypted || (method !== 0 && method !== 8)) throw new ZipError("unsupported");
        if (rawSize > MAX_ZIP_IMAGE_BYTES) throw new ZipError("unsupported");
        const head = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
        if (head.getUint32(0, true) !== 0x04034b50) throw new ZipError("not-zip");
        const start = localOffset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
        const packed = file.slice(start, start + compSize);
        if (method === 0) return new Uint8Array(await packed.arrayBuffer());
        return readLimited(packed.stream().pipeThrough(new DecompressionStream("deflate-raw")) as ReadableStream<Uint8Array>, MAX_ZIP_IMAGE_BYTES);
      },
    });
  }
  return entries;
}

/** The page pictures inside a ZIP, in reading order (page2 before page10), without folders or system leftovers. */
export function pageEntries(entries: ZipEntry[]): ZipEntry[] {
  return entries
    .filter((e) => {
      if (e.path.endsWith("/")) return false;
      if (/(^|\/)(__MACOSX|\.git)\//i.test(e.path)) return false;
      const base = e.path.split("/").pop() ?? "";
      if (!base || base.startsWith(".") || base.toLowerCase() === "thumbs.db") return false;
      return IMAGE_EXT.test(base);
    })
    .sort((a, b) => naturalCompare(a.path, b.path));
}
