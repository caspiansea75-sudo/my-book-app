import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CloudRain,
  Eye,
  EyeOff,
  Grid3x3,
  Images,
  LayoutGrid,
  List,
  Search,
  Shuffle,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { LibraryCard, type CardMeta } from "@/components/book/library-card";
import {
  MangaBody,
  MangaFilterPanel,
  MangaToolbar,
  useMangaLibrary,
} from "@/components/book/manga-shelf";
import { SiteNav } from "@/components/book/site-nav";
import { FxAurora, FxWords, fxIndex } from "@/components/media/fx";
import { formatCount, type LibraryBookCard } from "@/lib/book";
import type { MangaSeriesCard } from "@/lib/manga-api";
import {
  LIB_DEFAULTS,
  SHELF_LABEL,
  SORTS,
  useLibraryStore,
  type LibSort,
  type LibView,
  type Shelf,
  type SourceFilter,
  type StatusFilter,
} from "@/lib/library-store";
import { THEMES, useReaderStore, type ThemeId } from "@/lib/reader-store";
import { useMe } from "@/lib/use-me";
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

const SOURCES: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "সব" },
  { id: "studio", label: "স্টুডিও" },
  { id: "canon", label: "GitHub" },
];

function norm(s: string): string {
  return s.normalize("NFC").replace(/[\u200c\u200d]/g, "").toLowerCase();
}

function splitTags(tagline: string): string[] {
  return tagline
    .split(/[·|,،]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function initialOf(title: string): string {
  const first = Array.from(title.trim())[0] ?? "";
  return first.toUpperCase();
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
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

export function LibraryPage({ books, manga = [] }: { books: LibraryBookCard[]; manga?: MangaSeriesCard[] }) {
  const theme = useReaderStore((s) => s.theme);
  const setTheme = useReaderStore((s) => s.setTheme);
  const progress = useReaderStore((s) => s.progress);
  const lastByBook = useReaderStore((s) => s.lastByBook);
  const navigate = useNavigate();
  const me = useMe();

  // Personal data (saved in this browser) is applied only after mount so the server HTML matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const stored = useLibraryStore();
  const prefs = mounted ? stored : { ...stored, ...LIB_DEFAULTS };
  const { setPrefs, toggleFav, setShelf } = stored;

  const [query, setQuery] = useState("");
  // Stories and manga are two tabs at the top, so manga never needs a long scroll. The choice is remembered.
  const [tab, setTab] = useState<"books" | "manga">("books");
  useEffect(() => {
    try {
      if (window.localStorage.getItem("bk-lib-tab") === "manga") setTab("manga");
    } catch {
      /* storage unavailable */
    }
  }, []);
  function pickTab(next: "books" | "manga") {
    setTab(next);
    try {
      window.localStorage.setItem("bk-lib-tab", next);
    } catch {
      /* storage unavailable */
    }
  }
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [allTags, setAllTags] = useState(false);
  const dragSlug = useRef<string | null>(null);
  const [overSlug, setOverSlug] = useState<string | null>(null);

  const openedMap = useMemo(() => {
    const m = new Map<string, number>();
    if (!mounted) return m;
    for (const key of Object.keys(progress)) {
      const i = key.indexOf(":");
      if (i > 0) m.set(key.slice(0, i), (m.get(key.slice(0, i)) ?? 0) + 1);
    }
    return m;
  }, [progress, mounted]);

  const metas = useMemo(() => {
    const out = new Map<string, CardMeta & { tags: string[] }>();
    for (const b of books) {
      const opened = Math.min(openedMap.get(b.slug) ?? 0, Math.max(b.chapterCount, 0));
      const auto: Shelf | undefined =
        opened === 0 ? undefined : b.chapterCount > 0 && opened >= b.chapterCount ? "done" : "reading";
      out.set(b.slug, {
        opened,
        unread: opened > 0 ? Math.max(0, b.chapterCount - opened) : 0,
        status: prefs.shelves[b.slug] ?? auto,
        sensitive: (b.nsfwCount ?? 0) > 0,
        fav: prefs.favs.includes(b.slug),
        tags: splitTags(b.tagline),
      });
    }
    return out;
  }, [books, openedMap, prefs.shelves, prefs.favs]);

  const anySensitive = useMemo(() => books.some((b) => (b.nsfwCount ?? 0) > 0), [books]);

  const tagList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of metas.values()) for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "bn"));
  }, [metas]);

  const authors = useMemo(
    () => [...new Set(books.map((b) => b.author).filter(Boolean))].sort((a, b) => a.localeCompare(b, "bn")),
    [books],
  );

  const terms = useMemo(() => norm(query).split(/\s+/).filter(Boolean), [query]);

  const orderedSlugs = () => {
    const known = new Map(prefs.order.map((s, i) => [s, i]));
    return books
      .map((b, idx) => ({ slug: b.slug, key: known.get(b.slug) ?? 100000 + idx }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.slug);
  };

  const filtered = useMemo(() => {
    const list = books
      .map((book, idx) => ({ book, idx }))
      .filter(({ book }) => {
        const m = metas.get(book.slug)!;
        if (prefs.source !== "all" && book.origin !== prefs.source) return false;
        if (prefs.tag && !m.tags.includes(prefs.tag)) return false;
        if (prefs.author && book.author !== prefs.author) return false;
        if (prefs.hideSensitive && m.sensitive) return false;
        if (prefs.status === "fav" && !m.fav) return false;
        if (prefs.status === "unread" && m.status) return false;
        if ((prefs.status === "reading" || prefs.status === "later" || prefs.status === "done") && m.status !== prefs.status) {
          return false;
        }
        if (terms.length) {
          const hay = norm([book.title, book.titleEn, book.author, book.tagline, book.description].join(" "));
          if (!terms.every((t) => hay.includes(t))) return false;
        }
        return true;
      });

    const manualIdx = new Map(prefs.order.map((s, i) => [s, i]));
    const by = (fn: (a: (typeof list)[number], b: (typeof list)[number]) => number) =>
      list.sort((a, b) => fn(a, b) || a.idx - b.idx);

    switch (prefs.sort) {
      case "newest":
        by((a, b) => (b.book.createdAt ?? 0) - (a.book.createdAt ?? 0));
        break;
      case "oldest":
        by((a, b) => (a.book.createdAt ?? 0) - (b.book.createdAt ?? 0));
        break;
      case "az":
        by((a, b) => a.book.title.localeCompare(b.book.title, "bn"));
        break;
      case "za":
        by((a, b) => b.book.title.localeCompare(a.book.title, "bn"));
        break;
      case "most":
        by((a, b) => b.book.chapterCount - a.book.chapterCount);
        break;
      case "least":
        by((a, b) => a.book.chapterCount - b.book.chapterCount);
        break;
      case "recent":
        by((a, b) => (prefs.lastReadAt[b.book.slug] ?? 0) - (prefs.lastReadAt[a.book.slug] ?? 0));
        break;
      case "manual":
        by((a, b) => (manualIdx.get(a.book.slug) ?? 100000 + a.idx) - (manualIdx.get(b.book.slug) ?? 100000 + b.idx));
        break;
      default:
        break;
    }
    return list.map((x) => x.book);
  }, [books, metas, prefs, terms]);

  const ml = useMangaLibrary(manga, terms, mounted);

  const continueBooks = useMemo(() => {
    if (!mounted) return [];
    return books
      .filter((b) => lastByBook[b.slug] && !(prefs.hideSensitive && metas.get(b.slug)?.sensitive))
      .map((b) => ({ book: b, at: prefs.lastReadAt[b.slug] ?? 0, slug: lastByBook[b.slug]! }))
      .sort((a, b) => b.at - a.at)
      .slice(0, 8);
  }, [books, lastByBook, prefs.lastReadAt, prefs.hideSensitive, metas, mounted]);

  const activeCount =
    (prefs.source !== "all" ? 1 : 0) +
    (prefs.tag ? 1 : 0) +
    (prefs.author ? 1 : 0) +
    (prefs.status !== "all" ? 1 : 0) +
    (prefs.hideSensitive ? 1 : 0);

  function resetAll() {
    setQuery("");
    setPrefs({ source: "all", tag: null, author: null, status: "all", hideSensitive: false });
  }

  function surprise() {
    const pool = filtered.length ? filtered : books;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) void navigate({ to: "/book/$bookSlug", params: { bookSlug: pick.slug } });
  }

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

  function jumpTo(letter: string) {
    const hit = filtered.find((b) => initialOf(b.title) === letter);
    if (hit) document.getElementById(`book-${hit.slug}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const manual = prefs.sort === "manual";
  const letters = useMemo(
    () => (prefs.sort === "az" && filtered.length >= 6 ? [...new Set(filtered.map((b) => initialOf(b.title)))] : []),
    [prefs.sort, filtered],
  );

  return (
    <main className="mf-page relative min-h-dvh">
      <FxAurora />
      <SiteNav active="library" />
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mf-eyebrow mx-auto flex items-center justify-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
            <CloudRain className="size-4" strokeWidth={1.6} />
            গল্প সংগ্রহ
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-6xl [&>.mf-word:last-child]:mr-0">
            <FxWords text="আপনার লাইব্রেরি" />
          </h1>
          <p
            className="mf-rise mx-auto mt-4 max-w-lg font-sans text-sm leading-relaxed text-muted sm:text-base"
            style={fxIndex(6)}
          >
            রাতে পড়ার বই, প্রচ্ছদ, ছবি ও ভিডিও — সব এক জায়গায়। স্টুডিও থেকে নতুন গল্প যোগ করুন।
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id as ThemeId)}
              className={cn(
                "pressable h-10 rounded-full px-3 font-sans text-xs",
                theme === t.id
                  ? "bg-accent text-accent-fg"
                  : "border border-border text-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "books" && continueBooks.length ? (
          <div className="mt-10">
            <h2 className="mb-3 font-display text-lg">পড়া চালিয়ে যান</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {continueBooks.map(({ book, slug }) => {
                const m = metas.get(book.slug)!;
                const n = Number.parseInt(slug, 10);
                return (
                  <Link
                    key={book.slug}
                    to="/read/$bookSlug/$slug"
                    params={{ bookSlug: book.slug, slug }}
                    className="pressable group flex w-64 shrink-0 items-center gap-3 rounded-xl border border-border bg-surface p-2 hover:bg-surface-2"
                  >
                    <span
                      className={cn(
                        "w-12 shrink-0 overflow-hidden rounded-lg",
                        prefs.blurCovers && m.sensitive && "cover-blur",
                      )}
                    >
                      <CoverArt
                        title={book.title}
                        tagline={book.tagline}
                        coverUrl={book.coverUrl}
                        slug={book.slug}
                        className="aspect-[3/4] w-full"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold">{book.title}</span>
                      <span className="mt-0.5 block font-sans text-[11px] text-muted">
                        {Number.isFinite(n) ? `অধ্যায় ${formatCount(n)}` : "শেষ পড়া অধ্যায়"} ·{" "}
                        {formatCount(m.opened)}/{formatCount(book.chapterCount)}
                      </span>
                      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-lamp"
                          style={{
                            width: `${book.chapterCount ? Math.min(100, (m.opened / book.chapterCount) * 100) : 0}%`,
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

        <div className="sticky top-[4.5rem] z-30 mt-10 space-y-2 rounded-2xl border border-border bg-bg/85 p-2 backdrop-blur-md">
          {manga.length > 0 || me ? (
            <div role="tablist" className="flex gap-1 rounded-full border border-border p-0.5">
              {(
                [
                  { id: "books", label: "গল্প", n: filtered.length },
                  { id: "manga", label: "মাঙ্গা", n: ml.filtered.length },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => pickTab(t.id)}
                  className={cn(
                    "pressable inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full font-sans text-sm",
                    tab === t.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <span>{t.label}</span>
                  <span className="text-xs opacity-70">{formatCount(t.n)}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("");
                }}
                placeholder={tab === "books" ? "বই, লেখক বা ট্যাগ খুঁজুন…" : "মাঙ্গা বা লেখক খুঁজুন…"}
                aria-label={tab === "books" ? "বই খুঁজুন" : "মাঙ্গা খুঁজুন"}
                className="field-input"
                style={{ paddingLeft: 36, paddingRight: 36 }}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="মুছুন"
                  className="pressable absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            {tab === "books" ? (
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
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "pressable inline-flex h-11 items-center gap-1.5 rounded-full border px-3 font-sans text-xs",
                filtersOpen || activeCount ? "border-lamp text-lamp" : "border-border text-muted hover:text-fg",
              )}
            >
              <SlidersHorizontal className="size-4" />
              ফিল্টার{activeCount ? ` (${formatCount(activeCount)})` : ""}
            </button>

            {anySensitive ? (
              <button
                type="button"
                title={prefs.hideSensitive ? "সংবেদনশীল বই দেখান" : "সংবেদনশীল বই লুকান"}
                aria-label={prefs.hideSensitive ? "সংবেদনশীল বই দেখান" : "সংবেদনশীল বই লুকান"}
                onClick={() => setPrefs({ hideSensitive: !prefs.hideSensitive })}
                className={cn(
                  "pressable grid size-11 place-items-center rounded-full border",
                  prefs.hideSensitive ? "border-lamp text-lamp" : "border-border text-muted hover:text-fg",
                )}
              >
                {prefs.hideSensitive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            ) : null}

            <button
              type="button"
              title="যেকোনো একটি বই"
              aria-label="যেকোনো একটি বই"
              onClick={surprise}
              className="pressable grid size-11 place-items-center rounded-full border border-border text-muted hover:text-lamp"
            >
              <Shuffle className="size-4" />
            </button>
              </>
            ) : (
              <MangaToolbar ml={ml} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 font-sans text-xs text-muted">
            {tab === "books" ? (
              <span className="text-fg">{formatCount(filtered.length)}টি বই</span>
            ) : (
              <span className="text-fg">{formatCount(ml.filtered.length)}টি মাঙ্গা</span>
            )}
            {tab === "books" && manual ? <span>টেনে এনে বা তীর বোতামে ক্রম বদলান</span> : null}
            {query || (tab === "books" ? activeCount : ml.activeCount) ? (
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  ml.reset();
                }}
                className="pressable text-lamp"
              >
                সব ফিল্টার মুছুন
              </button>
            ) : null}
          </div>
        </div>

        {tab === "manga" && ml.filtersOpen ? <MangaFilterPanel ml={ml} /> : null}

        {tab === "books" && filtersOpen ? (
          <div className="mt-3 space-y-3 rounded-2xl border border-border bg-surface p-4">
            <FilterRow label="উৎস">
              {SOURCES.map((s) => (
                <Chip key={s.id} active={prefs.source === s.id} onClick={() => setPrefs({ source: s.id })}>
                  {s.label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="শেলফ">
              {STATUSES.map((s) => (
                <Chip key={s.id} active={prefs.status === s.id} onClick={() => setPrefs({ status: s.id })}>
                  {s.label}
                </Chip>
              ))}
            </FilterRow>
            {tagList.length ? (
              <FilterRow label="ট্যাগ">
                {(allTags ? tagList : tagList.slice(0, 12)).map(([tag, count]) => (
                  <Chip
                    key={tag}
                    active={prefs.tag === tag}
                    onClick={() => setPrefs({ tag: prefs.tag === tag ? null : tag })}
                  >
                    {tag} · {formatCount(count)}
                  </Chip>
                ))}
                {tagList.length > 12 ? (
                  <button
                    type="button"
                    onClick={() => setAllTags((v) => !v)}
                    className="pressable font-sans text-xs text-lamp"
                  >
                    {allTags ? "কম দেখান" : `আরও ${formatCount(tagList.length - 12)}টি`}
                  </button>
                ) : null}
              </FilterRow>
            ) : null}
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
            {anySensitive ? (
              <FilterRow label="সংবেদনশীল">
                <Chip active={prefs.hideSensitive} onClick={() => setPrefs({ hideSensitive: !prefs.hideSensitive })}>
                  বই লুকান
                </Chip>
                <Chip active={prefs.blurCovers} onClick={() => setPrefs({ blurCovers: !prefs.blurCovers })}>
                  প্রচ্ছদ ঝাপসা
                </Chip>
              </FilterRow>
            ) : null}
          </div>
        ) : null}

        {tab === "books" && letters.length ? (
          <div className="mt-3 flex flex-wrap gap-1">
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

        {tab === "books" && filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-display text-lg">কোনো বই মেলেনি</p>
            <p className="mt-1 font-sans text-sm text-muted">অন্য শব্দে খুঁজুন, অথবা ফিল্টার সরিয়ে দেখুন।</p>
            <button
              type="button"
              onClick={resetAll}
              className="pressable mt-4 inline-flex h-10 items-center rounded-full bg-accent px-4 font-sans text-xs text-accent-fg"
            >
              সব ফিল্টার মুছুন
            </button>
          </div>
        ) : null}

        <div className={cn("mt-6", GRID[prefs.view])} style={tab === "books" ? undefined : { display: "none" }}>
          {filtered.map((book, i) => (
            <LibraryCard
              key={book.slug}
              index={i}
              book={book}
              view={prefs.view}
              meta={metas.get(book.slug)!}
              blur={prefs.blurCovers}
              terms={terms}
              manual={manual}
              over={overSlug === book.slug && dragSlug.current !== book.slug}
              drag={{
                draggable: true,
                onDragStart: () => {
                  dragSlug.current = book.slug;
                },
                onDragOver: (e) => {
                  e.preventDefault();
                  if (overSlug !== book.slug) setOverSlug(book.slug);
                },
                onDrop: (e) => {
                  e.preventDefault();
                  if (dragSlug.current) moveTo(dragSlug.current, book.slug);
                  dragSlug.current = null;
                  setOverSlug(null);
                },
                onDragEnd: () => {
                  dragSlug.current = null;
                  setOverSlug(null);
                },
              }}
              onFav={() => toggleFav(book.slug)}
              onShelf={(s) => setShelf(book.slug, s)}
              onMove={(dir) => {
                const neighbour = filtered[i + dir];
                if (neighbour) moveTo(book.slug, neighbour.slug);
              }}
            />
          ))}

          {me ? (
            <Link
              to="/studio"
              style={fxIndex(filtered.length)}
              className={cn(
                "mf-card mf-rise pressable flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center hover:bg-surface",
                prefs.view === "list" || prefs.view === "covers" ? "min-h-24" : "min-h-64",
              )}
            >
              <Images className="size-6 text-lamp" strokeWidth={1.6} />
              <span className="mt-3 font-display text-lg">নতুন বই</span>
              <span className="mt-1 max-w-xs font-sans text-sm text-muted">
                স্টুডিওতে প্রচ্ছদ, অধ্যায়, ছবি ও ভিডিও যোগ করুন। GitHub-এ ফাইল তোলার দরকার নেই।
              </span>
            </Link>
          ) : null}
        </div>

        {tab === "manga" ? (
          <MangaBody
            ml={ml}
            terms={terms}
            canCreate={Boolean(me)}
            searching={terms.length > 0}
            onResetAll={() => {
              resetAll();
              ml.reset();
            }}
          />
        ) : null}
      </section>
    </main>
  );
}
