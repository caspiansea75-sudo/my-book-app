import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Grid3x3, LayoutGrid, List, Plus, Shuffle, SlidersHorizontal, Square } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import type { CardMeta } from "@/components/book/library-card";
import { MangaCard } from "@/components/book/manga-card";
import { fxIndex } from "@/components/media/fx";
import { formatCount } from "@/lib/book";
import {
  SHELF_LABEL,
  SORTS,
  type LibSort,
  type LibView,
  type Shelf,
  type StatusFilter,
} from "@/lib/library-store";
import type { MangaSeriesCard } from "@/lib/manga-api";
import { MANGA_LIB_DEFAULTS, useMangaLibraryStore } from "@/lib/manga-library-store";
import { mediaSrc } from "@/lib/media-url";
import { cn } from "@/lib/utils";

const VIEWS: { id: LibView; label: string; icon: typeof Square }[] = [
  { id: "large", label: "বড় কার্ড", icon: Square },
  { id: "compact", label: "ছোট গ্রিড", icon: LayoutGrid },
  { id: "list", label: "তালিকা", icon: List },
  { id: "covers", label: "শুধু প্রচ্ছদ", icon: Grid3x3 },
];

const GRID: Record<LibView, string> = {
  large: "grid gap-5 sm:grid-cols-2",
  compact: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
  list: "grid gap-2",
  covers: "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6",
};

const STATUSES: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "সব" },
  { id: "fav", label: "প্রিয়" },
  { id: "reading", label: SHELF_LABEL.reading },
  { id: "later", label: SHELF_LABEL.later },
  { id: "done", label: SHELF_LABEL.done },
  { id: "unread", label: "অপঠিত" },
];

const norm = (s: string) => s.normalize("NFC").replace(/[\u200c\u200d]/g, "").toLowerCase();
const initialOf = (title: string) => (Array.from(title.trim())[0] ?? "").toUpperCase();

/** Everything the manga tab needs: the saved settings, the filtered list and the actions. */
export function useMangaLibrary(manga: MangaSeriesCard[], terms: string[], mounted: boolean) {
  const stored = useMangaLibraryStore();
  // Personal data lives in this browser, so it is applied after mount to keep the server HTML identical.
  const prefs = mounted ? stored : { ...stored, ...MANGA_LIB_DEFAULTS };
  const { setPrefs, toggleFav, setShelf } = stored;
  const navigate = useNavigate();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const dragSlug = useRef<string | null>(null);
  const [overSlug, setOverSlug] = useState<string | null>(null);

  const metas = useMemo(() => {
    const out = new Map<string, CardMeta>();
    for (const m of manga) {
      const opened = Math.min(prefs.read[m.slug]?.length ?? 0, Math.max(m.chapterCount, 0));
      const auto: Shelf | undefined =
        opened === 0 ? undefined : m.chapterCount > 0 && opened >= m.chapterCount ? "done" : "reading";
      out.set(m.slug, {
        opened,
        unread: opened > 0 ? Math.max(0, m.chapterCount - opened) : 0,
        status: prefs.shelves[m.slug] ?? auto,
        sensitive: false,
        fav: prefs.favs.includes(m.slug),
      });
    }
    return out;
  }, [manga, prefs.read, prefs.shelves, prefs.favs]);

  const authors = useMemo(
    () => [...new Set(manga.map((m) => m.author).filter(Boolean))].sort((a, b) => a.localeCompare(b, "bn")),
    [manga],
  );

  const filtered = useMemo(() => {
    const list = manga
      .map((series, idx) => ({ series, idx }))
      .filter(({ series }) => {
        const m = metas.get(series.slug)!;
        if (prefs.author && series.author !== prefs.author) return false;
        if (prefs.status === "fav" && !m.fav) return false;
        if (prefs.status === "unread" && m.status) return false;
        if ((prefs.status === "reading" || prefs.status === "later" || prefs.status === "done") && m.status !== prefs.status) {
          return false;
        }
        if (terms.length) {
          const hay = norm([series.title, series.titleEn ?? "", series.author, series.description].join(" "));
          if (!terms.every((t) => hay.includes(t))) return false;
        }
        return true;
      });
    const manualIdx = new Map(prefs.order.map((s, i) => [s, i]));
    const by = (fn: (a: (typeof list)[number], b: (typeof list)[number]) => number) =>
      list.sort((a, b) => fn(a, b) || a.idx - b.idx);
    switch (prefs.sort) {
      case "newest":
        by((a, b) => (b.series.createdAt ?? 0) - (a.series.createdAt ?? 0));
        break;
      case "oldest":
        by((a, b) => (a.series.createdAt ?? 0) - (b.series.createdAt ?? 0));
        break;
      case "az":
        by((a, b) => a.series.title.localeCompare(b.series.title, "bn"));
        break;
      case "za":
        by((a, b) => b.series.title.localeCompare(a.series.title, "bn"));
        break;
      case "most":
        by((a, b) => b.series.chapterCount - a.series.chapterCount);
        break;
      case "least":
        by((a, b) => a.series.chapterCount - b.series.chapterCount);
        break;
      case "recent":
        by((a, b) => (prefs.lastReadAt[b.series.slug] ?? 0) - (prefs.lastReadAt[a.series.slug] ?? 0));
        break;
      case "manual":
        by((a, b) => (manualIdx.get(a.series.slug) ?? 100000 + a.idx) - (manualIdx.get(b.series.slug) ?? 100000 + b.idx));
        break;
      default:
        break;
    }
    return list.map((x) => x.series);
  }, [manga, metas, prefs, terms]);

  const activeCount = (prefs.author ? 1 : 0) + (prefs.status !== "all" ? 1 : 0);

  const continueList = useMemo(() => {
    if (!mounted) return [];
    return manga
      .filter((m) => prefs.lastChapter[m.slug])
      .map((m) => ({ series: m, at: prefs.lastReadAt[m.slug] ?? 0, chapter: prefs.lastChapter[m.slug]! }))
      .sort((a, b) => b.at - a.at)
      .slice(0, 8);
  }, [manga, prefs.lastChapter, prefs.lastReadAt, mounted]);

  const orderedSlugs = () => {
    const known = new Map(prefs.order.map((s, i) => [s, i]));
    return manga
      .map((m, idx) => ({ slug: m.slug, key: known.get(m.slug) ?? 100000 + idx }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.slug);
  };

  function moveTo(from: string, to: string) {
    if (from === to) return;
    const list = orderedSlugs();
    const fi = list.indexOf(from);
    const ti = list.indexOf(to);
    if (fi < 0 || ti < 0) return;
    list.splice(fi, 1);
    list.splice(ti, 0, from);
    setPrefs({ order: list });
  }

  function surprise() {
    const pool = filtered.length ? filtered : manga;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) void navigate({ to: "/manga/$seriesSlug", params: { seriesSlug: pick.slug } });
  }

  return {
    manga,
    prefs,
    setPrefs,
    toggleFav,
    setShelf,
    metas,
    authors,
    filtered,
    activeCount,
    continueList,
    filtersOpen,
    setFiltersOpen,
    dragSlug,
    overSlug,
    setOverSlug,
    moveTo,
    surprise,
    reset: () => setPrefs({ author: null, status: "all" }),
  };
}
export type MangaLib = ReturnType<typeof useMangaLibrary>;

/** Sort, view, filters and a random pick — sits in the library's top bar. */
export function MangaToolbar({ ml }: { ml: MangaLib }) {
  const { prefs, setPrefs, activeCount, filtersOpen, setFiltersOpen } = ml;
  return (
    <>
      <select
        value={prefs.sort}
        onChange={(e) => setPrefs({ sort: e.target.value as LibSort })}
        aria-label="সাজান"
        className="h-11 rounded-lg border border-border bg-surface px-3 font-sans text-xs text-fg"
      >
        {SORTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="flex rounded-full border border-border p-0.5">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              type="button"
              title={v.label}
              aria-label={v.label}
              onClick={() => setPrefs({ view: v.id })}
              className={cn(
                "pressable grid size-9 place-items-center rounded-full",
                prefs.view === v.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setFiltersOpen(!filtersOpen)}
        className={cn(
          "pressable inline-flex h-11 items-center gap-1.5 rounded-full border px-3 font-sans text-xs",
          filtersOpen || activeCount ? "border-lamp text-lamp" : "border-border text-muted hover:text-fg",
        )}
      >
        <SlidersHorizontal className="size-4" />
        ফিল্টার{activeCount ? ` (${formatCount(activeCount)})` : ""}
      </button>

      <button
        type="button"
        title="যেকোনো একটি মাঙ্গা"
        aria-label="যেকোনো একটি মাঙ্গা"
        onClick={ml.surprise}
        className="pressable grid size-11 place-items-center rounded-full border border-border text-muted hover:text-lamp"
      >
        <Shuffle className="size-4" />
      </button>
    </>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable h-8 rounded-full px-3 font-sans text-xs",
        active ? "bg-accent text-accent-fg" : "border border-border text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 shrink-0 font-sans text-[11px] text-muted">{label}</span>
      {children}
    </div>
  );
}

export function MangaFilterPanel({ ml }: { ml: MangaLib }) {
  const { prefs, setPrefs, authors } = ml;
  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-surface p-4">
      <FilterRow label="শেলফ">
        {STATUSES.map((s) => (
          <Chip key={s.id} active={prefs.status === s.id} onClick={() => setPrefs({ status: s.id })}>
            {s.label}
          </Chip>
        ))}
      </FilterRow>
      {authors.length > 1 ? (
        <FilterRow label="লেখক">
          <select
            value={prefs.author ?? ""}
            onChange={(e) => setPrefs({ author: e.target.value || null })}
            aria-label="লেখক"
            className="h-9 rounded-lg border border-border bg-bg px-3 font-sans text-xs text-fg"
          >
            <option value="">সব লেখক</option>
            {authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </FilterRow>
      ) : null}
    </div>
  );
}

/** The manga themselves: continue-reading row, A–Z strip and the grid. */
export function MangaBody({
  ml,
  terms,
  canCreate,
  searching,
  onResetAll,
}: {
  ml: MangaLib;
  terms: string[];
  canCreate: boolean;
  searching: boolean;
  onResetAll: () => void;
}) {
  const { prefs, filtered, metas, manga } = ml;
  const manual = prefs.sort === "manual";
  const letters = useMemo(
    () => (prefs.sort === "az" && filtered.length >= 6 ? [...new Set(filtered.map((m) => initialOf(m.title)))] : []),
    [prefs.sort, filtered],
  );

  function jumpTo(letter: string) {
    const hit = filtered.find((m) => initialOf(m.title) === letter);
    if (hit) document.getElementById(`manga-${hit.slug}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (manga.length === 0 && !canCreate) return null;

  return (
    <div className="mt-6">
      {ml.continueList.length ? (
        <div className="mb-8">
          <h2 className="mb-3 font-display text-lg">পড়া চালিয়ে যান</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {ml.continueList.map(({ series, chapter }) => {
              const m = metas.get(series.slug)!;
              return (
                <Link
                  key={series.slug}
                  to="/manga/$seriesSlug/$chapterSlug"
                  params={{ seriesSlug: series.slug, chapterSlug: chapter }}
                  className="pressable group flex w-64 shrink-0 items-center gap-3 rounded-xl border border-border bg-surface p-2 hover:bg-surface-2"
                >
                  <span className="w-12 shrink-0 overflow-hidden rounded-lg">
                    <CoverArt
                      title={series.title}
                      coverUrl={series.coverMediaId ? mediaSrc(series.coverMediaId) : null}
                      slug={series.slug}
                      className="aspect-[3/4] w-full"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-semibold">{series.title}</span>
                    <span className="mt-0.5 block font-sans text-[11px] text-muted">
                      শেষ পড়া অধ্যায় · {formatCount(m.opened)}/{formatCount(series.chapterCount)}
                    </span>
                    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-surface-2">
                      <span
                        className="block h-full rounded-full bg-lamp"
                        style={{
                          width: `${series.chapterCount ? Math.min(100, (m.opened / series.chapterCount) * 100) : 0}%`,
                        }}
                      />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {letters.length ? (
        <div className="mb-3 flex flex-wrap gap-1">
          {letters.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => jumpTo(l)}
              className="pressable grid size-8 place-items-center rounded-full border border-border font-display text-sm text-muted hover:text-lamp"
            >
              {l}
            </button>
          ))}
        </div>
      ) : null}

      {manga.length > 0 && filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-display text-lg">কোনো মাঙ্গা মেলেনি</p>
          <p className="mt-1 font-sans text-sm text-muted">অন্য শব্দে খুঁজুন, অথবা ফিল্টার সরিয়ে দেখুন।</p>
          <button
            type="button"
            onClick={onResetAll}
            className="pressable mt-4 inline-flex h-10 items-center rounded-full bg-accent px-4 font-sans text-xs text-accent-fg"
          >
            সব ফিল্টার মুছুন
          </button>
        </div>
      ) : null}

      <div className={cn(GRID[prefs.view])}>
        {filtered.map((series, i) => (
          <MangaCard
            key={series.slug}
            index={i}
            series={series}
            view={prefs.view}
            meta={metas.get(series.slug)!}
            resumeChapter={prefs.lastChapter[series.slug] ?? series.firstChapterSlug ?? null}
            terms={terms}
            manual={manual}
            over={ml.overSlug === series.slug && ml.dragSlug.current !== series.slug}
            drag={{
              draggable: true,
              onDragStart: () => {
                ml.dragSlug.current = series.slug;
              },
              onDragOver: (e) => {
                e.preventDefault();
                if (ml.overSlug !== series.slug) ml.setOverSlug(series.slug);
              },
              onDrop: (e) => {
                e.preventDefault();
                if (ml.dragSlug.current) ml.moveTo(ml.dragSlug.current, series.slug);
                ml.dragSlug.current = null;
                ml.setOverSlug(null);
              },
              onDragEnd: () => {
                ml.dragSlug.current = null;
                ml.setOverSlug(null);
              },
            }}
            onFav={() => ml.toggleFav(series.slug)}
            onShelf={(s) => ml.setShelf(series.slug, s)}
            onMove={(dir) => {
              const neighbour = filtered[i + dir];
              if (neighbour) ml.moveTo(series.slug, neighbour.slug);
            }}
          />
        ))}

        {canCreate && !searching ? (
          <Link
            to="/manga"
            style={fxIndex(filtered.length)}
            className={cn(
              "mf-card mf-rise pressable flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center hover:bg-surface",
              prefs.view === "list" || prefs.view === "covers" ? "min-h-24" : "min-h-64",
            )}
          >
            <Plus className="size-6 text-lamp" strokeWidth={1.6} />
            <span className="mt-3 font-display text-lg">নতুন মাঙ্গা</span>
            <span className="mt-1 max-w-xs font-sans text-sm text-muted">চিত্রশালার ছবি দিয়ে প্যানেল সাজান।</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
