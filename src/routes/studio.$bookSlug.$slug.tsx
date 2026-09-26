import { useEffect, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { SiteNav } from "@/components/book/site-nav";
import { ChapterEditor } from "@/components/studio/chapter-editor";
import type { Chapter } from "@/lib/book";
import { loadChapterForBook } from "@/lib/load-chapter";
import { resolveBook } from "@/lib/library-api";

export const Route = createFileRoute("/studio/$bookSlug/$slug")({
  loader: async ({ params }) => {
    const book = await resolveBook({ data: { slug: params.bookSlug } });
    if (!book) throw notFound();
    if (params.slug === "new") {
      if (book.origin !== "studio") throw notFound();
      return { book, slug: undefined as string | undefined };
    }
    return { book, slug: params.slug };
  },
  component: StudioChapterPage,
});

function StudioChapterPage() {
  const { book, slug } = Route.useLoaderData();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [ready, setReady] = useState(!slug);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    setReady(false);
    loadChapterForBook(book, slug)
      .then((ch) => {
        if (!live) return;
        setChapter(ch);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "লোড ব্যর্থ");
        setReady(true);
      });
    return () => {
      live = false;
    };
  }, [book, slug]);

  return (
    <main className="relative min-h-dvh">
      <SiteNav active="studio" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <Link
          to="/studio/$bookSlug"
          params={{ bookSlug: book.slug }}
          className="pressable inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
        >
          <ChevronLeft className="size-3.5" />
          {book.title}
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">
          {chapter ? chapter.title : slug ? "অধ্যায়" : "নতুন অধ্যায়"}
        </h1>
        <div className="mt-8">
          {error ? <p className="font-sans text-sm text-nsfw">{error}</p> : null}
          {!ready ? (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-xl bg-surface" />
              <div className="h-40 animate-pulse rounded-xl bg-surface" />
            </div>
          ) : (
            <ChapterEditor key={slug ?? "new"} book={book} chapter={chapter} slug={slug} />
          )}
        </div>
      </section>
    </main>
  );
}
