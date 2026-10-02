import { Link } from "@tanstack/react-router";
import { BookImage, Heart, Pencil, Play, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import {
  Badges,
  Mark,
  Progress,
  RoundBtn,
  ShelfMenu,
  type CardMeta,
  type DragProps,
} from "@/components/book/library-card";
import { fxIndex } from "@/components/media/fx";
import { HideToggle } from "@/components/members/hide-toggle";
import { formatCount } from "@/lib/book";
import type { LibView, Shelf } from "@/lib/library-store";
import type { MangaSeriesCard } from "@/lib/manga-api";
import { mediaSrc } from "@/lib/media-url";
import { canEditOwner, useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";

const count = (n: number) => `${formatCount(n)} অধ্যায়`;

/** One manga in the library. Same controls as a story card; the main button reads straight away. */
export function MangaCard({
  index = 0,
  series,
  view,
  meta,
  resumeChapter,
  terms,
  manual,
  over,
  drag,
  onFav,
  onShelf,
  onMove,
}: {
  index?: number;
  series: MangaSeriesCard;
  view: LibView;
  meta: CardMeta;
  /** Chapter to open: the one read last, else the first. Null while there are no chapters. */
  resumeChapter: string | null;
  terms: string[];
  manual: boolean;
  over: boolean;
  drag: DragProps;
  onFav: () => void;
  onShelf: (s: Shelf | null) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const me = useMe();
  const vertical = view === "list";
  const resuming = meta.opened > 0 && resumeChapter != null;
  const cover = (aspect: string) => (
    <CoverArt
      title={series.title}
      coverUrl={series.coverMediaId ? mediaSrc(series.coverMediaId) : null}
      slug={series.slug}
      className={aspect}
    />
  );
  const readLink = (cls: string, withIcon = true) =>
    resumeChapter ? (
      <Link
        to="/manga/$seriesSlug/$chapterSlug"
        params={{ seriesSlug: series.slug, chapterSlug: resumeChapter }}
        className={cls}
      >
        {withIcon ? <Play className="size-4" /> : null}
        {resuming ? "পড়া চালিয়ে যান" : "পড়া শুরু করুন"}
      </Link>
    ) : (
      <span className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-border font-sans text-xs text-subtle">
        এখনো অধ্যায় নেই
      </span>
    );
  const readBtnCls =
    "pressable inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent font-sans text-sm text-accent-fg";
  const seriesLink = { to: "/manga/$seriesSlug" as const, params: { seriesSlug: series.slug } };

  return (
    <div
      id={`manga-${series.slug}`}
      style={fxIndex(index)}
      className={cn(
        "mf-tile mf-rise group relative scroll-mt-56 rounded-xl",
        over && "ring-2 ring-lamp",
        manual && "cursor-grab",
        series.hidden && "opacity-50",
      )}
      {...(manual ? drag : {})}
    >
      {view === "large" || view === "compact" ? (
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
          <Link {...seriesLink} className="pressable flex flex-1 flex-col hover:bg-surface-2">
            {cover(view === "large" ? "aspect-[4/3] w-full" : "aspect-[3/4] w-full")}
            <span className={cn("flex flex-1 flex-col", view === "large" ? "p-5" : "p-3")}>
              {series.author ? (
                <span className="truncate font-sans text-xs text-lamp">
                  <Mark text={series.author} terms={terms} />
                </span>
              ) : null}
              <span
                className={cn(
                  "font-display font-semibold",
                  view === "large" ? "mt-1 text-xl" : "mt-0.5 line-clamp-2 text-sm leading-snug",
                )}
              >
                <Mark text={series.title} terms={terms} />
              </span>
              {view === "large" && series.description ? (
                <span className="mt-2 line-clamp-3 font-sans text-sm leading-relaxed text-muted">
                  <Mark text={series.description} terms={terms} />
                </span>
              ) : null}
              <span className="mt-2 flex items-center gap-2 font-sans text-xs text-muted">
                <BookImage className="size-3.5" strokeWidth={1.75} />
                {count(series.chapterCount)}
              </span>
              <Progress opened={meta.opened} total={series.chapterCount} />
            </span>
          </Link>
          <div className="p-3 pt-0">{readLink(readBtnCls)}</div>
        </div>
      ) : null}

      {view === "list" ? (
        <Link
          {...seriesLink}
          className="pressable flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface p-2 pr-52 hover:bg-surface-2"
        >
          <span className="w-14 shrink-0 overflow-hidden rounded-lg">{cover("aspect-[3/4] w-full")}</span>
          <span className="min-w-0 flex-1 py-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-display text-base font-semibold">
                <Mark text={series.title} terms={terms} />
              </span>
              <Badges meta={meta} short />
            </span>
            <span className="mt-0.5 block truncate font-sans text-xs text-muted">
              {series.author ? `${series.author} · ` : ""}
              {count(series.chapterCount)}
            </span>
            <Progress opened={meta.opened} total={series.chapterCount} />
          </span>
        </Link>
      ) : null}

      {view === "covers" ? (
        <Link
          {...seriesLink}
          className="pressable block overflow-hidden rounded-xl border border-border bg-surface hover:bg-surface-2"
        >
          {cover("aspect-[3/4] w-full")}
          <span className="line-clamp-2 block px-2 py-1.5 font-display text-xs leading-snug">
            <Mark text={series.title} terms={terms} />
          </span>
        </Link>
      ) : null}

      {view !== "list" ? (
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[70%] flex-wrap gap-1">
          <Badges meta={meta} short={view === "covers" || view === "compact"} />
        </div>
      ) : null}

      <div
        className={cn(
          "absolute z-20 flex items-center gap-1",
          vertical ? "right-2 top-1/2 -translate-y-1/2" : "right-2 top-2",
          view === "covers" && "lib-overlay-hover",
        )}
      >
        {manual ? (
          <>
            <RoundBtn label="আগে নিন" onClick={() => onMove(-1)}>
              {vertical ? <ChevronUp className="size-4" /> : <ChevronLeft className="size-4" />}
            </RoundBtn>
            <RoundBtn label="পরে নিন" onClick={() => onMove(1)}>
              {vertical ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </RoundBtn>
          </>
        ) : null}
        {(vertical || view === "covers") && resumeChapter ? (
          <Link
            to="/manga/$seriesSlug/$chapterSlug"
            params={{ seriesSlug: series.slug, chapterSlug: resumeChapter }}
            title="পড়ুন"
            aria-label="পড়ুন"
            className="pressable grid size-8 place-items-center rounded-full border border-border/70 bg-bg/80 text-fg backdrop-blur hover:text-lamp"
          >
            <Play className="size-4" />
          </Link>
        ) : null}
        <RoundBtn label="প্রিয়" active={meta.fav} onClick={onFav}>
          <Heart className={cn("size-4", meta.fav && "fill-current")} />
        </RoundBtn>
        <HideToggle kind="manga" id={series.slug} hidden={!!series.hidden} />
        <ShelfMenu shelf={meta.status} onPick={onShelf} />
        {canEditOwner(me, series.ownerId ?? null) ? (
          <Link
            {...seriesLink}
            title="সম্পাদনা"
            aria-label="সম্পাদনা"
            className="pressable grid size-8 place-items-center rounded-full border border-border/70 bg-bg/80 text-fg backdrop-blur hover:text-lamp"
          >
            <Pencil className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
