import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Heart,
  Pencil,
} from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { fxIndex } from "@/components/media/fx";
import { formatCount, type LibraryBookCard } from "@/lib/book";
import { SHELF_LABEL, type LibView, type Shelf } from "@/lib/library-store";
import { HideToggle } from "@/components/members/hide-toggle";
import { canEditOwner, useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";

export type CardMeta = {
  opened: number;
  unread: number;
  status?: Shelf;
  sensitive: boolean;
  fav: boolean;
};

export type DragProps = {
  draggable: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
};

export function Mark({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-lamp/25 text-inherit">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone?: "lamp" | "warn" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-sans text-[10px] leading-none backdrop-blur",
        tone === "warn"
          ? "border-nsfw/50 bg-bg/80 text-nsfw"
          : tone === "lamp"
            ? "border-lamp/50 bg-bg/80 text-lamp"
            : "border-border bg-bg/80 text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function Badges({ meta, short }: { meta: CardMeta; short?: boolean }) {
  return (
    <>
      {meta.unread > 0 ? (
        <Pill tone="lamp">{short ? "নতুন" : `${formatCount(meta.unread)}টি না-পড়া`}</Pill>
      ) : null}
      {meta.status ? <Pill>{SHELF_LABEL[meta.status]}</Pill> : null}
      {meta.sensitive ? <Pill tone="warn">{formatCount(18)}+</Pill> : null}
    </>
  );
}

export function RoundBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pressable grid size-8 place-items-center rounded-full border border-border/70 bg-bg/80 backdrop-blur hover:text-lamp",
        active ? "text-lamp" : "text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function ShelfMenu({ shelf, onPick }: { shelf?: Shelf; onPick: (s: Shelf | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function outside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <RoundBtn label="শেলফ" active={Boolean(shelf)} onClick={() => setOpen((v) => !v)}>
        <Bookmark className={cn("size-4", shelf && "fill-current")} />
      </RoundBtn>
      {open ? (
        <div className="absolute right-0 top-9 z-40 w-40 rounded-lg border border-border bg-surface p-1 font-sans text-xs shadow-lg">
          {(Object.keys(SHELF_LABEL) as Shelf[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onPick(s);
                setOpen(false);
              }}
              className={cn(
                "flex w-full rounded-md px-3 py-2 text-left hover:bg-surface-2",
                shelf === s ? "text-lamp" : "text-fg",
              )}
            >
              {SHELF_LABEL[s]}
            </button>
          ))}
          {shelf ? (
            <button
              type="button"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
              className="flex w-full rounded-md px-3 py-2 text-left text-muted hover:bg-surface-2"
            >
              শেলফ থেকে সরান
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Progress({ opened, total }: { opened: number; total: number }) {
  if (opened <= 0 || total <= 0) return null;
  return (
    <span className="mt-3 block h-1 overflow-hidden rounded-full bg-surface-2">
      <span
        className="block h-full rounded-full bg-lamp"
        style={{ width: `${Math.min(100, (opened / total) * 100)}%` }}
      />
    </span>
  );
}

export function LibraryCard({
  index = 0,
  book,
  view,
  meta,
  blur,
  terms,
  manual,
  over,
  drag,
  onFav,
  onShelf,
  onMove,
}: {
  /** Position in the grid, used to stagger the entrance animation. */
  index?: number;
  book: LibraryBookCard;
  view: LibView;
  meta: CardMeta;
  blur: boolean;
  terms: string[];
  manual: boolean;
  over: boolean;
  drag: DragProps;
  onFav: () => void;
  onShelf: (s: Shelf | null) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const me = useMe();
  const blurred = blur && meta.sensitive;
  const vertical = view === "list";
  const cover = (aspect: string) => (
    <div className={cn(blurred && "cover-blur")}>
      <CoverArt
        title={book.title}
        tagline={book.tagline}
        coverUrl={book.coverUrl}
        slug={book.slug}
        className={aspect}
      />
    </div>
  );

  return (
    <div
      id={`book-${book.slug}`}
      style={fxIndex(index)}
      className={cn(
        "mf-tile mf-rise group relative scroll-mt-56 rounded-xl",
        over && "ring-2 ring-lamp",
        manual && "cursor-grab",
        book.hidden && "opacity-50",
      )}
      {...(manual ? drag : {})}
    >
      {view === "large" ? (
        <Link
          to="/book/$bookSlug"
          params={{ bookSlug: book.slug }}
          className="pressable flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface hover:bg-surface-2"
        >
          {cover("aspect-[16/10] w-full")}
          <span className="flex flex-1 flex-col p-5">
            <span className="font-sans text-xs tracking-widest text-lamp">
              <Mark text={book.tagline} terms={terms} />
            </span>
            <span className="mt-2 font-display text-xl font-semibold">
              <Mark text={book.title} terms={terms} />
            </span>
            <span className="mt-2 line-clamp-3 font-sans text-sm leading-relaxed text-muted">
              <Mark text={book.description} terms={terms} />
            </span>
            <span className="mt-4 flex items-center gap-2 font-sans text-xs text-muted">
              <BookOpen className="size-3.5" strokeWidth={1.75} />
              {formatCount(book.chapterCount)} আপডেট
              {book.origin === "studio" ? " · স্টুডিও" : null}
            </span>
            <Progress opened={meta.opened} total={book.chapterCount} />
          </span>
        </Link>
      ) : null}

      {view === "compact" ? (
        <Link
          to="/book/$bookSlug"
          params={{ bookSlug: book.slug }}
          className="pressable flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface hover:bg-surface-2"
        >
          {cover("aspect-[4/5] w-full")}
          <span className="flex flex-1 flex-col p-3">
            <span className="line-clamp-2 font-display text-sm font-semibold leading-snug">
              <Mark text={book.title} terms={terms} />
            </span>
            <span className="mt-1 line-clamp-1 font-sans text-[11px] text-muted">
              <Mark text={book.author} terms={terms} />
            </span>
            <span className="mt-1 font-sans text-[11px] text-muted">
              {formatCount(book.chapterCount)} আপডেট
            </span>
            <Progress opened={meta.opened} total={book.chapterCount} />
          </span>
        </Link>
      ) : null}

      {view === "list" ? (
        <Link
          to="/book/$bookSlug"
          params={{ bookSlug: book.slug }}
          className="pressable flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface p-2 pr-44 hover:bg-surface-2"
        >
          <span className="w-14 shrink-0 overflow-hidden rounded-lg">{cover("aspect-[3/4] w-full")}</span>
          <span className="min-w-0 flex-1 py-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-display text-base font-semibold">
                <Mark text={book.title} terms={terms} />
              </span>
              <Badges meta={meta} short />
            </span>
            <span className="mt-0.5 block truncate font-sans text-xs text-lamp">
              <Mark text={book.tagline} terms={terms} />
            </span>
            <span className="mt-0.5 block truncate font-sans text-xs text-muted">
              {book.author ? `${book.author} · ` : ""}
              {formatCount(book.chapterCount)} আপডেট
            </span>
            <Progress opened={meta.opened} total={book.chapterCount} />
          </span>
        </Link>
      ) : null}

      {view === "covers" ? (
        <Link
          to="/book/$bookSlug"
          params={{ bookSlug: book.slug }}
          className="pressable block overflow-hidden rounded-xl border border-border bg-surface hover:bg-surface-2"
        >
          {cover("aspect-[3/4] w-full")}
          <span className="line-clamp-2 block px-2 py-1.5 font-display text-xs leading-snug">
            <Mark text={book.title} terms={terms} />
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
        <RoundBtn label="প্রিয়" active={meta.fav} onClick={onFav}>
          <Heart className={cn("size-4", meta.fav && "fill-current")} />
        </RoundBtn>
        <HideToggle kind="book" id={book.slug} hidden={!!book.hidden} />
        <ShelfMenu shelf={meta.status} onPick={onShelf} />
        {canEditOwner(me, book.ownerId) && book.origin === "studio" ? (
          <Link
            to="/studio/$bookSlug"
            params={{ bookSlug: book.slug }}
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
