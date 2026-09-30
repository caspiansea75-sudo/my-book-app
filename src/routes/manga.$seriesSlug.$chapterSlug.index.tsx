import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Lightbox, type LightboxItem } from "@/components/book/lightbox";
import { PageReader } from "@/components/manga/page-reader";
import { getMangaChapterForReading } from "@/lib/manga-api";

export const Route = createFileRoute("/manga/$seriesSlug/$chapterSlug/")({
  loader: async ({ params }) => {
    const chapter = await getMangaChapterForReading({
      data: { seriesSlug: params.seriesSlug, chapterSlug: params.chapterSlug },
    });
    if (!chapter) throw notFound();
    return { chapter };
  },
  component: MangaReaderPage,
});

function MangaReaderPage() {
  const { chapter } = Route.useLoaderData();
  const { chapterSlug } = Route.useParams();
  const [open, setOpen] = useState<number | null>(null);
  const [mode, setModeState] = useState<"scroll" | "pages">("scroll");
  const [rtl, setRtlState] = useState(false);
  const [page, setPage] = useState(0);
  const total = chapter.panels.length;
  const pageKey = `manga-page:${chapter.seriesSlug}/${chapterSlug}`;

  useEffect(() => {
    try {
      const p = JSON.parse(window.localStorage.getItem("manga-reader") ?? "{}") as { mode?: string; rtl?: boolean };
      if (p.mode === "pages") setModeState("pages");
      if (p.rtl) setRtlState(true);
    } catch {
      // no saved preference
    }
  }, []);

  useEffect(() => {
    try {
      const n = Number(window.localStorage.getItem(pageKey));
      setPage(Number.isFinite(n) && n > 0 && n < total ? n : 0);
    } catch {
      setPage(0);
    }
  }, [pageKey, total]);

  function savePrefs(m: "scroll" | "pages", r: boolean) {
    try {
      window.localStorage.setItem("manga-reader", JSON.stringify({ mode: m, rtl: r }));
    } catch {
      // ignore
    }
  }
  function setMode(m: "scroll" | "pages") {
    setModeState(m);
    savePrefs(m, rtl);
  }
  function toggleRtl() {
    setRtlState(!rtl);
    savePrefs(mode, !rtl);
  }
  function goPage(n: number) {
    setPage(n);
    try {
      if (n > 0 && n < total) window.localStorage.setItem(pageKey, String(n));
      else window.localStorage.removeItem(pageKey);
    } catch {
      // ignore
    }
  }

  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      chapter.panels.map((p, i) => ({
        id: String(i),
        kind: p.kind,
        src: p.src,
        caption: p.caption || undefined,
      })),
    [chapter.panels],
  );

  const chapterNav = (
    <nav className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-10">
        {chapter.prevSlug ? (
          <Link
            to="/manga/$seriesSlug/$chapterSlug"
            params={{ seriesSlug: chapter.seriesSlug, chapterSlug: chapter.prevSlug }}
            className="pressable inline-flex h-12 items-center rounded-lg border border-white/15 px-4 font-sans text-sm text-white"
          >
            আগের অধ্যায়
          </Link>
        ) : (
          <span />
        )}
        {chapter.nextSlug ? (
          <Link
            to="/manga/$seriesSlug/$chapterSlug"
            params={{ seriesSlug: chapter.seriesSlug, chapterSlug: chapter.nextSlug }}
            className="pressable inline-flex h-12 items-center rounded-lg bg-white px-4 font-sans text-sm text-[#0a0a0a]"
          >
            পরের অধ্যায়
          </Link>
        ) : (
          <Link
            to="/manga/$seriesSlug"
            params={{ seriesSlug: chapter.seriesSlug }}
            className="pressable inline-flex h-12 items-center rounded-lg border border-white/15 px-4 font-sans text-sm text-white"
          >
            সিরিজে ফিরুন
          </Link>
        )}
      </nav>
  );

  return (
    <div className="min-h-dvh bg-[#0a0a0a]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2">
          <Link
            to="/manga/$seriesSlug"
            params={{ seriesSlug: chapter.seriesSlug }}
            className="pressable grid size-10 shrink-0 place-items-center rounded-full text-white/70 hover:text-white"
            aria-label="সিরিজে ফিরুন"
          >
            <X className="size-5" strokeWidth={1.75} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-sans text-[11px] tracking-wide text-white/50">{chapter.seriesTitle}</p>
            <p className="truncate font-display text-sm text-white">{chapter.chapterTitle}</p>
          </div>
          <div className="flex shrink-0 items-center">
            {chapter.prevSlug ? (
              <Link
                to="/manga/$seriesSlug/$chapterSlug"
                params={{ seriesSlug: chapter.seriesSlug, chapterSlug: chapter.prevSlug }}
                className="pressable grid size-10 place-items-center rounded-full text-white/70 hover:text-white"
                aria-label="আগের অধ্যায়"
              >
                <ChevronLeft className="size-5" strokeWidth={1.75} />
              </Link>
            ) : (
              <span className="grid size-10 place-items-center text-white/20">
                <ChevronLeft className="size-5" strokeWidth={1.75} />
              </span>
            )}
            {chapter.nextSlug ? (
              <Link
                to="/manga/$seriesSlug/$chapterSlug"
                params={{ seriesSlug: chapter.seriesSlug, chapterSlug: chapter.nextSlug }}
                className="pressable grid size-10 place-items-center rounded-full text-white/70 hover:text-white"
                aria-label="পরের অধ্যায়"
              >
                <ChevronRight className="size-5" strokeWidth={1.75} />
              </Link>
            ) : (
              <span className="grid size-10 place-items-center text-white/20">
                <ChevronRight className="size-5" strokeWidth={1.75} />
              </span>
            )}
          </div>
        </div>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 pb-2">
          <div role="group" className="inline-flex rounded-full border border-white/15 p-0.5 font-sans text-xs">
            {(
              [
                ["scroll", "স্ক্রোল"],
                ["pages", "পাতা"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
                className={
                  mode === id
                    ? "pressable h-8 rounded-full bg-white px-3 text-[#0a0a0a]"
                    : "pressable h-8 rounded-full px-3 text-white/60"
                }
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "pages" ? (
            <button
              type="button"
              onClick={toggleRtl}
              className="pressable inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 font-sans text-xs text-white/80"
            >
              <ArrowLeftRight className="size-3.5" strokeWidth={1.75} />
              {rtl ? "ডান থেকে বাঁয়ে" : "বাঁ থেকে ডানে"}
            </button>
          ) : null}
        </div>
      </header>

      {chapter.panels.length === 0 ? (
        <p className="px-6 py-24 text-center font-sans text-sm text-white/50">এই অধ্যায়ে এখনো কোনো প্যানেল নেই।</p>
      ) : mode === "pages" ? (
        <PageReader
          panels={chapter.panels}
          index={page}
          onIndex={goPage}
          rtl={rtl}
          paused={open != null}
          onZoom={setOpen}
          end={chapterNav}
        />
      ) : (
        <div className="mx-auto flex max-w-2xl flex-col">
          {chapter.panels.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(i)}
              className="block w-full"
            >
              {p.kind === "image" ? (
                <img src={p.src} alt={p.caption} className="block w-full" loading="lazy" />
              ) : (
                <video src={p.src} className="block w-full" controls playsInline />
              )}
              {p.caption ? (
                <p className="bg-[#0a0a0a] px-4 py-2 text-center font-sans text-xs text-white/50">{p.caption}</p>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {mode === "scroll" || total === 0 ? chapterNav : null}

      {open != null ? (
        <Lightbox items={lightboxItems} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
      ) : null}
    </div>
  );
}
