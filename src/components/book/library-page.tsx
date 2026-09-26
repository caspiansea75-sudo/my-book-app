import { Link } from "@tanstack/react-router";
import { BookOpen, CloudRain, Images } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { SiteNav } from "@/components/book/site-nav";
import { formatCount, type LibraryBookCard } from "@/lib/book";
import { THEMES, useReaderStore, type ThemeId } from "@/lib/reader-store";
import { cn } from "@/lib/utils";

export function LibraryPage({ books }: { books: LibraryBookCard[] }) {
  const theme = useReaderStore((s) => s.theme);
  const setTheme = useReaderStore((s) => s.setTheme);

  return (
    <main className="relative min-h-dvh">
      <SiteNav active="library" />
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="stagger-in mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
            <CloudRain className="size-4" strokeWidth={1.6} />
            গল্প সংগ্রহ
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-6xl">
            আপনার লাইব্রেরি
          </h1>
          <p className="mx-auto mt-4 max-w-lg font-sans text-sm leading-relaxed text-muted sm:text-base">
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

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {books.map((book) => (
            <Link
              key={book.slug}
              to="/book/$bookSlug"
              params={{ bookSlug: book.slug }}
              className="pressable group flex flex-col overflow-hidden rounded-xl border border-border bg-surface hover:bg-surface-2"
            >
              <CoverArt
                title={book.title}
                tagline={book.tagline}
                coverUrl={book.coverUrl}
                slug={book.slug}
                className="aspect-[16/10] w-full"
              />
              <span className="flex flex-1 flex-col p-5">
                <span className="font-sans text-xs tracking-widest text-lamp">{book.tagline}</span>
                <span className="mt-2 font-display text-xl font-semibold">{book.title}</span>
                <span className="mt-2 line-clamp-3 font-sans text-sm leading-relaxed text-muted">
                  {book.description}
                </span>
                <span className="mt-4 flex items-center gap-2 font-sans text-xs text-muted">
                  <BookOpen className="size-3.5" strokeWidth={1.75} />
                  {formatCount(book.chapterCount)} আপডেট
                  {book.origin === "studio" ? " · স্টুডিও" : null}
                </span>
              </span>
            </Link>
          ))}

          <Link
            to="/studio"
            className="pressable flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center hover:bg-surface"
          >
            <Images className="size-6 text-lamp" strokeWidth={1.6} />
            <span className="mt-3 font-display text-lg">নতুন বই</span>
            <span className="mt-1 max-w-xs font-sans text-sm text-muted">
              স্টুডিওতে প্রচ্ছদ, অধ্যায়, ছবি ও ভিডিও যোগ করুন। GitHub-এ ফাইল তোলার দরকার নেই।
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
