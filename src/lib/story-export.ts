import type { Chapter, Paragraph, TextRun } from "@/lib/book";

/** Turning stories into .md / .txt files and zipping them. Pure code — runs in the browser. */

export type ExportFormat = "md" | "txt";

export type ExportBook = {
  slug: string;
  title: string;
  titleEn: string;
  author: string;
  tagline: string;
  description: string;
};

export type ExportChapter = Pick<Chapter, "title" | "titleEn" | "sections"> & { status?: "draft" | "published"; missing?: boolean };

const DRAFT = "খসড়া";

/* ------------------------------ text pieces ------------------------------ */

function mdEscape(s: string): string {
  return s.replace(/([\\*_`])/g, "\\$1");
}

function mdRuns(runs: TextRun[]): string {
  return runs
    .map((r) => {
      const t = mdEscape(r.t);
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t) as RegExpExecArray;
      let core = m[2];
      if (!core) return t;
      if (r.u) core = `<u>${core}</u>`;
      if (r.i) core = `*${core}*`;
      if (r.b) core = `**${core}**`;
      return m[1] + core + m[3];
    })
    .join("");
}

/** Stops a line from turning into a heading / quote / list when it is just story text. */
function mdBlockSafe(line: string): string {
  return line.replace(/^(\s*)(#|>|[-+]\s|\d+[.)]\s)/, "$1\\$2");
}

const abs = (u: string, origin: string) => (u.startsWith("/") ? origin + u : u);

function mediaLink(p: Paragraph, origin: string): string {
  if (p.url) return abs(p.url, origin);
  if (p.mediaId) return `${origin}/api/media/${p.mediaId}`;
  return "";
}

function paragraph(p: Paragraph, fmt: ExportFormat, origin: string): string | null {
  if (p.kind === "break") return fmt === "md" ? "* * *" : "* * *";
  if (p.kind === "image" || p.kind === "video") {
    const url = mediaLink(p, origin);
    const cap = (p.caption ?? "").trim();
    if (fmt === "md") return p.kind === "image" ? `![${cap}](${url})` : `[ভিডিও${cap ? `: ${cap}` : ""}](${url})`;
    return `[${p.kind === "image" ? "ছবি" : "ভিডিও"}${cap ? `: ${cap}` : ""}]${url ? ` ${url}` : ""}`;
  }
  const hasRuns = Array.isArray(p.runs) && p.runs.length > 0;
  const plain = hasRuns ? p.runs!.map((r) => r.t).join("") : p.text;
  if (!plain.trim()) return null;
  if (fmt === "txt") return plain.replace(/\r\n?/g, "\n").trim();
  const body = hasRuns ? mdRuns(p.runs!) : mdEscape(p.text);
  return body
    .replace(/\r\n?/g, "\n")
    .trim()
    .split("\n")
    .map(mdBlockSafe)
    .join("  \n");
}

/* ------------------------------ whole book ------------------------------ */

export function renderBook(book: ExportBook, chapters: ExportChapter[], fmt: ExportFormat, origin: string): string {
  const out: string[] = [];
  const md = fmt === "md";

  out.push(md ? `# ${book.title}` : `${book.title}\n${"=".repeat(Math.min(60, Math.max(8, Array.from(book.title).length)))}`);
  if (book.titleEn.trim()) out.push(md ? `*${mdEscape(book.titleEn.trim())}*` : book.titleEn.trim());
  if (book.author.trim()) out.push(md ? `**লেখক:** ${mdEscape(book.author.trim())}` : `লেখক: ${book.author.trim()}`);
  if (book.tagline.trim()) out.push(md ? `> ${mdEscape(book.tagline.trim())}` : book.tagline.trim());
  if (book.description.trim()) out.push(md ? mdEscape(book.description.trim()).replace(/\n/g, "  \n") : book.description.trim());
  out.push(md ? "---" : "-".repeat(40));

  for (const ch of chapters) {
    const draft = ch.status === "draft" ? ` (${DRAFT})` : "";
    const en = ch.titleEn.trim() ? ` — ${ch.titleEn.trim()}` : "";
    const heading = `${ch.title}${en}${draft}`;
    out.push(md ? `## ${mdEscape(heading)}` : `${heading}\n${"-".repeat(Math.min(60, Math.max(6, Array.from(heading).length)))}`);
    if (ch.missing) {
      out.push(md ? "*[এই অধ্যায়টি আনা যায়নি]*" : "[এই অধ্যায়টি আনা যায়নি]");
      continue;
    }
    for (const sec of ch.sections) {
      if (sec.title.trim()) out.push(md ? `### ${mdEscape(sec.title.trim())}` : `[${sec.title.trim()}]`);
      for (const p of sec.paragraphs) {
        const text = paragraph(p, fmt, origin);
        if (text) out.push(text);
      }
    }
  }
  return out.join("\n\n") + "\n";
}

/* ------------------------------ files & zip ------------------------------ */

export function safeFileName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type ZipFile = { name: string; text: string };

/** A plain (uncompressed) .zip with UTF-8 file names — opens in Windows, Mac and phones. */
export function makeZip(files: ZipFile[], when = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const dosDate = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);

    const lh = new Uint8Array(30 + name.length);
    const l = new DataView(lh.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true); // UTF-8 names
    l.setUint16(8, 0, true); // stored
    l.setUint16(10, dosTime, true);
    l.setUint16(12, dosDate, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, name.length, true);
    l.setUint16(28, 0, true);
    lh.set(name, 30);

    const ch = new Uint8Array(46 + name.length);
    const c = new DataView(ch.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, dosTime, true);
    c.setUint16(14, dosDate, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    ch.set(name, 46);

    locals.push(lh, data);
    centrals.push(ch);
    offset += lh.length + data.length;
  }

  const centralSize = centrals.reduce((n, p) => n + p.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);

  const all = [...locals, ...centrals, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Saves a file in the browser (browser only). */
export function saveBlob(data: BlobPart | Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
