import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { ChapterMeta } from "@/lib/book";
import { formatCount } from "@/lib/book";
import { useReaderStore } from "@/lib/reader-store";
import { cn } from "@/lib/utils";

export function TocList({
  bookSlug,
  chapters,
  activeSlug,
  onNavigate,
}: {
  bookSlug: string;
  chapters: ChapterMeta[];
  activeSlug?: string;
  onNavigate?: () => void;
}) {
  const progress = useReaderStore((s) => s.progress);

  return (
    <nav aria-label="সূচিপত্র" className="flex flex-col gap-1 pb-8">
      {chapters.map((ch) => {
        const active = ch.slug === activeSlug;
        const read = Boolean(progress[ch.slug]);
        return (
          <Link
            key={ch.slug}
            to="/read/$bookSlug/$slug"
            params={{ bookSlug, slug: ch.slug }}
            onClick={onNavigate}
            data-active={active}
            className={cn(
              "toc-link pressable group flex items-start gap-3 rounded-md px-3 py-2",
              "text-left transition-colors duration-150",
              active ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span
              className={cn(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                active ? "bg-lamp" : read ? "bg-accent" : "bg-subtle/50",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("font-display text-sm font-medium", active ? "text-fg" : "text-fg/90")}>
                  {ch.title}
                </span>
                {ch.hasNsfw ? (
                  <span className="font-sans text-xs text-nsfw/80">সং</span>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate font-sans text-xs text-muted">
                {ch.excerpt}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TocDrawer({
  bookSlug,
  open,
  onClose,
  chapters,
  activeSlug,
}: {
  bookSlug: string;
  open: boolean;
  onClose: () => void;
  chapters: ChapterMeta[];
  activeSlug?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-60 bg-bg/50 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        data-open={open}
        className="drawer fixed inset-y-0 left-0 z-70 flex w-80 flex-col border-r border-border bg-surface shadow-soft"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="font-display text-base">সূচিপত্র</p>
            <p className="font-sans text-xs text-muted">{formatCount(chapters.length)}টি আপডেট · দ্রুত যান</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable grid size-11 place-items-center rounded-md text-muted hover:text-fg"
            aria-label="সূচি বন্ধ করুন"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pt-3">
          <TocList bookSlug={bookSlug} chapters={chapters} activeSlug={activeSlug} onNavigate={onClose} />
        </div>
      </aside>
    </>
  );
}
