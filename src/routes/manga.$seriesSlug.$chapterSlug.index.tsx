import { useMemo, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Lightbox, type LightboxItem } from "@/components/book/lightbox";
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
  const [open, setOpen] = useState<number | null>(null);

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
      </header>

      {chapter.panels.length === 0 ? (
        <p className="px-6 py-24 text-center font-sans text-sm text-white/50">এই অধ্যায়ে এখনো কোনো প্যানেল নেই।</p>
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

      {open != null ? (
        <Lightbox items={lightboxItems} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
      ) : null}
    </div>
  );
}
