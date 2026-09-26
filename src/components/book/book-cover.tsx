import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, CloudRain, PenLine } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { AmbientAudio } from "@/components/book/ambient-audio";
import { WarningGate } from "@/components/book/warning-gate";
import { formatCount, type BookIndex } from "@/lib/book";
import { THEMES, useReaderStore, type ThemeId } from "@/lib/reader-store";
import { cn } from "@/lib/utils";

export function BookCoverPage({ book }: { book: BookIndex }) {
  const lastSlug = useReaderStore((s) => s.lastByBook[book.slug]);
  const theme = useReaderStore((s) => s.theme);
  const setTheme = useReaderStore((s) => s.setTheme);
  const first = book.chapters[0]?.slug || "01";
  const resume = lastSlug || first;

  return (
    <main className="relative min-h-dvh">
      <AmbientAudio />
      <WarningGate />

      <section className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <CoverArt
          title={book.title}
          tagline={book.tagline}
          coverUrl={book.coverUrl}
          slug={book.slug}
          className="aspect-[3/4] w-full max-w-sm justify-self-center rounded-xl shadow-soft lg:justify-self-end"
        />

        <div className="stagger-in">
          <Link
            to="/"
            className="pressable mb-6 inline-flex items-center gap-1 font-sans text-xs text-muted hover:text-fg"
          >
            <ChevronLeft className="size-3.5" strokeWidth={1.75} />
            লাইব্রেরি
          </Link>

          <p className="flex items-center gap-2 font-sans text-xs tracking-widest text-lamp">
            <CloudRain className="size-4" strokeWidth={1.6} />
            {book.tagline}
          </p>
          <h1 className="cover-title mt-5 font-display text-4xl font-semibold leading-tight sm:text-6xl">
            {book.title}
          </h1>
          <p className="mt-5 max-w-lg font-display text-base leading-relaxed text-muted sm:text-lg">
            {book.description}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/read/$bookSlug/$slug"
              params={{ bookSlug: book.slug, slug: resume }}
              className="pressable lamp-glow inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-5 font-sans text-sm font-medium text-accent-fg"
            >
              <BookOpen className="size-4" strokeWidth={1.75} />
              {lastSlug && lastSlug !== first ? "যেখানে ছিলেন" : "পড়া শুরু করুন"}
            </Link>
            <Link
              to="/read/$bookSlug/$slug"
              params={{ bookSlug: book.slug, slug: first }}
              className="pressable inline-flex h-12 items-center rounded-lg border border-border bg-surface px-5 font-sans text-sm text-fg"
            >
              প্রথম আপডেট
            </Link>
            <Link
              to="/studio/$bookSlug"
              params={{ bookSlug: book.slug }}
              className="pressable inline-flex h-12 items-center gap-2 rounded-lg border border-border px-4 font-sans text-sm text-muted hover:text-fg"
            >
              <PenLine className="size-4" strokeWidth={1.75} />
              {book.origin === "studio" ? "সম্পাদনা" : "ছবি যোগ"}
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-1.5">
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
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">সূচিপত্র</h2>
            <p className="mt-1 font-sans text-sm text-muted">
              {formatCount(book.chapterCount)} আপডেট · {formatCount(book.paraCount)} অনুচ্ছেদ
            </p>
          </div>
        </div>

        <ol className="grid gap-2 sm:grid-cols-2">
          {book.chapters.map((ch) => (
            <li key={ch.slug}>
              <Link
                to="/read/$bookSlug/$slug"
                params={{ bookSlug: book.slug, slug: ch.slug }}
                className="pressable flex h-full flex-col rounded-lg border border-border bg-surface p-4 hover:bg-surface-2"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-base">{ch.title}</span>
                  {ch.hasNsfw ? (
                    <span className="font-sans text-xs text-nsfw">সংবেদনশীল</span>
                  ) : null}
                </span>
                <span className="mt-2 line-clamp-2 font-sans text-xs leading-relaxed text-muted">
                  {ch.excerpt}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
