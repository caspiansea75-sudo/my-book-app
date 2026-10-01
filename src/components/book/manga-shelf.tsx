import { Link } from "@tanstack/react-router";
import { BookImage, Play, Plus } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { fxIndex } from "@/components/media/fx";
import { formatCount } from "@/lib/book";
import type { MangaSeriesCard } from "@/lib/manga-api";
import { mediaSrc } from "@/lib/media-url";
import { cn } from "@/lib/utils";

/** The manga collection inside the library: open a series, or start reading its first chapter right here. */
export function MangaShelf({
  series,
  total,
  searching,
  canCreate,
}: {
  series: MangaSeriesCard[];
  /** How many manga exist before the search box is applied. */
  total: number;
  searching: boolean;
  canCreate: boolean;
}) {
  if (total === 0 && !canCreate) return null;

  return (
    <section id="manga-collection" className="mt-14" aria-label="মাঙ্গা সংগ্রহ">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
            <BookImage className="size-4" strokeWidth={1.6} />
            মাঙ্গা সংগ্রহ
          </p>
          <h2 className="mt-2 font-display text-2xl">মাঙ্গা পড়ুন</h2>
          <p className="mt-1 font-sans text-sm text-muted">
            {searching ? `${formatCount(series.length)}টি মাঙ্গা` : "পছন্দের মাঙ্গা বেছে সরাসরি পড়া শুরু করুন।"}
          </p>
        </div>
        <Link
          to="/manga"
          className="pressable inline-flex h-10 items-center rounded-full border border-border px-4 font-sans text-xs text-muted hover:text-fg"
        >
          সব মাঙ্গা
        </Link>
      </div>

      {total > 0 && series.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-border p-6 text-center font-sans text-sm text-muted">
          কোনো মাঙ্গা মেলেনি
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {series.map((s, i) => (
            <div
              key={s.slug}
              className={cn(
                "mf-card mf-rise flex flex-col overflow-hidden rounded-xl border border-border bg-surface",
                s.hidden && "opacity-50",
              )}
              style={fxIndex(i)}
            >
              <Link
                to="/manga/$seriesSlug"
                params={{ seriesSlug: s.slug }}
                className="pressable block hover:bg-surface-2"
              >
                <CoverArt
                  title={s.title}
                  coverUrl={s.coverMediaId ? mediaSrc(s.coverMediaId) : null}
                  slug={s.slug}
                  className="aspect-[3/4] w-full"
                />
                <span className="block px-3 pt-3">
                  <span className="block truncate font-display text-base">{s.title}</span>
                  {s.author ? <span className="mt-0.5 block truncate font-sans text-xs text-lamp">{s.author}</span> : null}
                  <span className="mt-1 block font-sans text-xs text-muted">
                    {s.chapterCount === 1 ? `${formatCount(1)} অধ্যায়` : `${formatCount(s.chapterCount)} অধ্যায়`}
                  </span>
                </span>
              </Link>
              <div className="mt-auto p-3">
                {s.firstChapterSlug ? (
                  <Link
                    to="/manga/$seriesSlug/$chapterSlug"
                    params={{ seriesSlug: s.slug, chapterSlug: s.firstChapterSlug }}
                    className="pressable inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent font-sans text-sm text-accent-fg"
                  >
                    <Play className="size-4" />
                    পড়া শুরু করুন
                  </Link>
                ) : (
                  <span className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-border font-sans text-xs text-subtle">
                    এখনো অধ্যায় নেই
                  </span>
                )}
              </div>
            </div>
          ))}

          {canCreate && !searching ? (
            <Link
              to="/manga"
              style={fxIndex(series.length)}
              className="mf-card mf-rise pressable flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center hover:bg-surface"
            >
              <Plus className="size-6 text-lamp" strokeWidth={1.6} />
              <span className="mt-3 font-display text-lg">নতুন মাঙ্গা</span>
              <span className="mt-1 max-w-xs font-sans text-sm text-muted">চিত্রশালার ছবি দিয়ে প্যানেল সাজান।</span>
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
