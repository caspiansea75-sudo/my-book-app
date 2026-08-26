import { Link } from "@tanstack/react-router";
import { BookOpen, CloudRain } from "lucide-react";
import { bookIndex, formatCount } from "@/lib/book";
import { THEMES, useReaderStore, type ThemeId } from "@/lib/reader-store";
import { WarningGate } from "@/components/book/warning-gate";
import { AmbientAudio } from "@/components/book/ambient-audio";
import { cn } from "@/lib/utils";

export function CoverPage() {
  const lastSlug = useReaderStore((s) => s.lastSlug);
  const theme = useReaderStore((s) => s.theme);
  const setTheme = useReaderStore((s) => s.setTheme);
  const book = bookIndex;

  return (
    <main className="relative min-h-dvh">
      <AmbientAudio />
      <WarningGate />

      <section className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-5 py-16 sm:px-8">
        <div className="stagger-in">
          <p className="flex items-center gap-2 font-sans text-xs tracking-widest text-lamp">
            <CloudRain className="size-4" strokeWidth={1.6} />
            ঢাকার রাত · একটি ওয়েব বই
          </p>
          <h1 className="cover-title mt-5 font-display text-4xl font-semibold leading-tight sm:text-6xl">
            অঘটনঘটন
            <br />
            পটিয়সী
          </h1>
          <p className="mt-5 max-w-lg font-display text-base leading-relaxed text-muted sm:text-lg">
            সিনথিয়া করিম আর সৈয়দ মাহফুজ। নর্থ সাউথ আর জগন্নাথ। যে সম্পর্ক পরিবার মানতে চায় না,
            আর যে ছেলে অসম্ভবকে সম্ভব করতে নামে।
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/read/$slug"
              params={{ slug: lastSlug || "01" }}
              className="pressable lamp-glow inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-5 font-sans text-sm font-medium text-accent-fg"
            >
              <BookOpen className="size-4" strokeWidth={1.75} />
              {lastSlug && lastSlug !== "01" ? "যেখানে ছিলেন" : "পড়া শুরু করুন"}
            </Link>
            <Link
              to="/read/$slug"
              params={{ slug: "01" }}
              className="pressable inline-flex h-12 items-center rounded-lg border border-border bg-surface px-5 font-sans text-sm text-fg"
            >
              প্রথম আপডেট
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

      <section className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
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
                to="/read/$slug"
                params={{ slug: ch.slug }}
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
