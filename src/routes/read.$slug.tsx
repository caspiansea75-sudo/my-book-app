import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { bookIndex, loadChapter, padSlug, type Chapter } from "@/lib/book";
import { useReaderStore } from "@/lib/reader-store";
import { AmbientAudio } from "@/components/book/ambient-audio";
import { ChapterBody } from "@/components/book/chapter-body";
import { ReaderBar } from "@/components/book/reader-bar";
import { TocDrawer, TocList } from "@/components/book/toc";
import { WarningGate } from "@/components/book/warning-gate";

export const Route = createFileRoute("/read/$slug")({
  component: ReaderPage,
});

function ReaderPage() {
  const { slug: rawSlug } = Route.useParams();
  const slug = padSlug(rawSlug);
  const book = bookIndex;
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const fontSize = useReaderStore((s) => s.fontSize);
  const setLastSlug = useReaderStore((s) => s.setLastSlug);
  const setProgress = useReaderStore((s) => s.setProgress);

  useEffect(() => {
    let live = true;
    setChapter(null);
    setError(null);
    loadChapter(slug)
      .then((ch) => {
        if (!live) return;
        setChapter(ch);
        setLastSlug(slug);
        setProgress(slug, ch.sections[0]?.paragraphs[0]?.id ?? slug);
        window.scrollTo(0, 0);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "লোড ব্যর্থ");
      });
    return () => {
      live = false;
    };
  }, [slug, setLastSlug, setProgress]);

  const nav = useMemo(() => {
    const i = book.chapters.findIndex((c) => c.slug === slug);
    return {
      prev: i > 0 ? book.chapters[i - 1]?.slug : undefined,
      next: i >= 0 && i < book.chapters.length - 1 ? book.chapters[i + 1]?.slug : undefined,
    };
  }, [book.chapters, slug]);

  return (
    <div className="min-h-dvh bg-bg">
      <AmbientAudio />
      <WarningGate />
      <ReaderBar
        title={chapter?.title ?? "পড়া হচ্ছে…"}
        onOpenToc={() => setTocOpen(true)}
        prevSlug={nav.prev}
        nextSlug={nav.next}
      />

      <div className="mx-auto flex max-w-6xl">
        <aside className="toc-rail sticky top-28 hidden w-72 shrink-0 overflow-y-auto border-r border-border bg-surface/40 px-2 py-6 lg:block">
          <p className="mb-3 px-3 font-sans text-xs tracking-widest text-subtle">সূচিপত্র</p>
          <TocList chapters={book.chapters} activeSlug={slug} />
        </aside>

        <div className="min-w-0 flex-1">
          {error ? (
            <div className="mx-auto max-w-md px-6 py-24 text-center">
              <p className="font-display text-xl">পাতা মেলেনি</p>
              <p className="mt-2 font-sans text-sm text-muted">{error}</p>
              <Link
                to="/"
                className="pressable mt-6 inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm text-accent-fg"
              >
                প্রচ্ছদে ফিরুন
              </Link>
            </div>
          ) : !chapter ? (
            <div className="mx-auto max-w-2xl space-y-4 px-6 py-16">
              <div className="mx-auto h-8 w-40 animate-pulse rounded bg-surface-2" />
              <div className="h-24 animate-pulse rounded bg-surface" />
              <div className="h-24 animate-pulse rounded bg-surface" />
              <div className="h-24 animate-pulse rounded bg-surface" />
            </div>
          ) : (
            <>
              <ChapterBody chapter={chapter} fontSize={fontSize} />
              <nav className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pb-16">
                {nav.prev ? (
                  <Link
                    to="/read/$slug"
                    params={{ slug: nav.prev }}
                    className="pressable inline-flex h-12 items-center rounded-lg border border-border bg-surface px-4 font-sans text-sm text-fg"
                  >
                    আগের আপডেট
                  </Link>
                ) : (
                  <span />
                )}
                {nav.next ? (
                  <Link
                    to="/read/$slug"
                    params={{ slug: nav.next }}
                    className="pressable inline-flex h-12 items-center rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg"
                  >
                    পরের আপডেট
                  </Link>
                ) : (
                  <Link
                    to="/"
                    className="pressable inline-flex h-12 items-center rounded-lg border border-border px-4 font-sans text-sm text-fg"
                  >
                    প্রচ্ছদ
                  </Link>
                )}
              </nav>
            </>
          )}
        </div>
      </div>

      <TocDrawer
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        chapters={book.chapters}
        activeSlug={slug}
      />
    </div>
  );
}
