import { useEffect, useRef, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { listExportBooks, loadExportStudioBook, type ExportListItem } from "@/lib/export-api";
import { makeZip, renderBook, safeFileName, saveBlob, type ExportChapter, type ExportFormat } from "@/lib/story-export";
import { canonChapterUrl, type Chapter } from "@/lib/book";
import { cn } from "@/lib/utils";

const FETCH_AT_ONCE = 6;

/** Admin only: pick stories and save them as .md or .txt (a .zip when you pick more than one). */
export function StoryExport() {
  const [books, setBooks] = useState<ExportListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [fmt, setFmt] = useState<ExportFormat>("md");
  const [drafts, setDrafts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [warn, setWarn] = useState(false);
  const [ready, setReady] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    setBooks(null);
    setError(null);
    listExportBooks({ data: { drafts } })
      .then((list) => !stop && setBooks(list))
      .catch((e: unknown) => !stop && setError(e instanceof Error ? e.message : "গল্প তালিকা লোড হয়নি"));
    return () => {
      stop = true;
    };
  }, [drafts]);

  const toggle = (slug: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  async function fetchCanonChapter(bookSlug: string, chSlug: string): Promise<ExportChapter> {
    try {
      const res = await fetch(canonChapterUrl(bookSlug, chSlug));
      if (!res.ok) throw new Error("missing");
      const ch = (await res.json()) as Chapter;
      return { title: ch.title, titleEn: ch.titleEn, sections: ch.sections, status: "published" };
    } catch {
      setWarn(true);
      return { title: chSlug, titleEn: "", sections: [], missing: true };
    }
  }

  async function build(book: ExportListItem): Promise<{ name: string; text: string }> {
    let chapters: ExportChapter[];
    if (book.origin === "studio") {
      chapters = await loadExportStudioBook({ data: { slug: book.slug, drafts } });
      setProgress((p) => ({ ...p, done: p.done + chapters.length }));
    } else {
      chapters = new Array<ExportChapter>(book.chapters.length);
      let next = 0;
      const worker = async () => {
        for (;;) {
          const k = next++;
          if (k >= book.chapters.length) return;
          chapters[k] = await fetchCanonChapter(book.slug, book.chapters[k].slug);
          if (alive.current) setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      };
      await Promise.all(Array.from({ length: Math.min(FETCH_AT_ONCE, book.chapters.length) }, worker));
      if (book.extraBook) {
        const more = await loadExportStudioBook({ data: { slug: book.extraBook, drafts } });
        chapters.push(...more);
        setProgress((p) => ({ ...p, done: p.done + more.length }));
      }
    }
    const text = renderBook(book, chapters, fmt, window.location.origin);
    return { name: safeFileName(book.title, book.slug), text };
  }

  async function run(list: ExportListItem[]) {
    if (!list.length || busy) return;
    setBusy(true);
    setWarn(false);
    setReady(false);
    setError(null);
    setProgress({ done: 0, total: list.reduce((n, b) => n + b.chapterCount, 0) });
    try {
      const made: { name: string; text: string }[] = [];
      for (const book of list) made.push(await build(book));
      const day = new Date().toISOString().slice(0, 10);
      if (made.length === 1) {
        saveBlob(`\uFEFF${made[0].text}`, `${made[0].name}.${fmt}`, "text/plain;charset=utf-8");
      } else {
        const used = new Set<string>();
        const files = made.map((f) => {
          let name = `${f.name}.${fmt}`;
          for (let i = 2; used.has(name.toLowerCase()); i++) name = `${f.name} (${i}).${fmt}`;
          used.add(name.toLowerCase());
          return { name, text: `\uFEFF${f.text}` };
        });
        saveBlob(makeZip(files), `stories-${day}.zip`, "application/zip");
      }
      if (alive.current) setReady(true);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "ডাউনলোড করা যায়নি");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  const chosen = (books ?? []).filter((b) => picked.has(b.slug));
  const allOn = books != null && books.length > 0 && picked.size === books.length;
  const pct = progress.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <section className="mf-card mt-10 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <FileText className="size-5 text-lamp" strokeWidth={1.6} />
        <span>গল্প ডাউনলোড</span>
      </h2>
      <p className="mt-1 font-sans text-xs text-muted">সব গল্প .txt বা .md ফাইলে নামান। শুধু অ্যাডমিন এটি করতে পারেন।</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-sans text-sm">
        <div className="flex items-center gap-2" role="radiogroup" aria-label="ফরম্যাট">
          <span className="text-xs text-muted">ফরম্যাট</span>
          {(["md", "txt"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={fmt === f}
              onClick={() => setFmt(f)}
              className={cn("pressable rounded-full border px-3 py-1 text-xs", fmt === f ? "border-lamp bg-accent text-accent-fg" : "border-border text-muted hover:text-fg")}
            >
              {f === "md" ? "Markdown (.md)" : "Text (.txt)"}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={drafts} onChange={(e) => setDrafts(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          <span>খসড়া অধ্যায়ও নিন</span>
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 font-sans text-sm text-nsfw">
          {error}
        </p>
      ) : null}
      {books == null && !error ? <p className="mt-4 font-sans text-sm text-muted">লোড হচ্ছে…</p> : null}

      {books && books.length > 0 ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPicked(allOn ? new Set() : new Set(books.map((b) => b.slug)))}
              className="pressable rounded-full border border-border px-3 py-1.5 font-sans text-xs text-muted hover:text-fg"
            >
              {allOn ? "বাছাই বাতিল" : "সব বাছুন"}
            </button>
            <button
              type="button"
              disabled={busy || chosen.length === 0}
              onClick={() => void run(chosen)}
              className="pressable inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 font-sans text-xs text-accent-fg disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" strokeWidth={1.75} />}
              <span>{busy ? "তৈরি হচ্ছে…" : "নির্বাচিত গল্প ডাউনলোড"}</span>
              {chosen.length ? <span>({chosen.length.toLocaleString("bn-BD")})</span> : null}
            </button>
          </div>

          {busy ? (
            <div className="mt-3" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-lamp transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 font-sans text-[11px] text-muted">
                <span>{progress.done.toLocaleString("bn-BD")}</span> / <span>{progress.total.toLocaleString("bn-BD")}</span> <span>টি অধ্যায়</span>
              </p>
            </div>
          ) : null}
          {ready && !busy ? <p className="mt-3 font-sans text-xs text-emerald-400">ডাউনলোড শেষ</p> : null}
          {warn && !busy ? <p className="mt-1 font-sans text-xs text-nsfw">কিছু অধ্যায় আনা যায়নি</p> : null}

          <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
            {books.map((b) => (
              <li key={b.slug} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={picked.has(b.slug)}
                  onChange={() => toggle(b.slug)}
                  aria-label={b.title}
                  className="size-4 shrink-0 accent-[var(--color-accent)]"
                />
                <span className="min-w-0 flex-1">
                  <span data-no-i18n className="block truncate font-display text-sm">
                    {b.title}
                  </span>
                  <span className="font-sans text-[11px] text-muted">
                    <span>{b.chapterCount.toLocaleString("bn-BD")}</span> <span>টি অধ্যায়</span> · <span>{b.origin === "studio" ? "স্টুডিও" : "মূল সংগ্রহ"}</span>
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run([b])}
                  aria-label="ডাউনলোড"
                  title="ডাউনলোড"
                  className="pressable grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted hover:text-fg disabled:opacity-50"
                >
                  <Download className="size-4" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {books && books.length === 0 ? <p className="mt-4 font-sans text-sm text-muted">এখনো কোনো গল্প নেই।</p> : null}
    </section>
  );
}
