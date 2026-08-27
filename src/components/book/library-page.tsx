import { Link } from "@tanstack/react-router";
import { BookOpen, CloudRain } from "lucide-react";
import { listBooks, formatCount } from "@/lib/book";
import { THEMES, useReaderStore, type ThemeId } from "@/lib/reader-store";
import { cn } from "@/lib/utils";

export function LibraryPage() {
  const theme = useReaderStore((s) => s.theme);
  const setTheme = useReaderStore((s) => s.setTheme);
  const books = listBooks();

  return (
    <main className="relative min-h-dvh">
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="flex items-center gap-2 font-sans text-xs tracking-widest text-lamp">
          <CloudRain className="size-4" strokeWidth={1.6} />
          গল্প সংগ্রহ
        </p>
        <h1 className="mt-5 font-display text-3xl font-semibold leading-tight sm:text-5xl">
          আপনার লাইব্রেরি
        </h1>

        <div className="mt-8 flex flex-wrap gap-1.5">
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

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {books.map((book) => (
            <Link
              key={book.slug}
              to="/book/$bookSlug"
              params={{ bookSlug: book.slug }}
              className="pressable flex flex-col rounded-xl border border-border bg-surface p-5 hover:bg-surface-2"
            >
              <span className="font-sans text-xs tracking-widest text-lamp">{book.tagline}</span>
              <span className="mt-2 font-display text-xl font-semibold">{book.title}</span>
              <span className="mt-2 line-clamp-3 font-sans text-sm leading-relaxed text-muted">
                {book.description}
              </span>
              <span className="mt-4 flex items-center gap-2 font-sans text-xs text-muted">
                <BookOpen className="size-3.5" strokeWidth={1.75} />
                {formatCount(book.chapterCount)} আপডেট
              </span>
            </Link>
          ))}

          {books.length === 0 ? (
            <p className="font-sans text-sm text-muted">এখনো কোনো গল্প যোগ করা হয়নি।</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
