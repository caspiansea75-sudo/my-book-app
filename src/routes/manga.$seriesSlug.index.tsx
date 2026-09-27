import { useState, type FormEvent } from "react";
import { Link, createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { BookImage, PenLine, Play, Plus } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { SiteNav } from "@/components/book/site-nav";
import { createMangaChapter, getMangaSeries } from "@/lib/manga-api";
import { mediaSrc } from "@/lib/media-url";

export const Route = createFileRoute("/manga/$seriesSlug/")({
  loader: async ({ params }) => {
    const series = await getMangaSeries({ data: { slug: params.seriesSlug } });
    if (!series) throw notFound();
    return { series };
  },
  component: MangaSeriesPage,
});

function MangaSeriesPage() {
  const { series } = Route.useLoaderData();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(series.chapters.length === 0);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createMangaChapter({ data: { seriesSlug: series.slug, title } });
      setTitle("");
      setShowForm(false);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "তৈরি হয়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh">
      <SiteNav active="manga" />
      <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
        <Link
          to="/manga"
          className="pressable inline-flex items-center gap-1.5 font-sans text-xs text-muted hover:text-fg"
        >
          <BookImage className="size-3.5" strokeWidth={1.75} />
          মাঙ্গা
        </Link>

        <div className="mt-4 flex flex-col gap-5 sm:flex-row">
          <CoverArt
            title={series.title}
            coverUrl={series.coverMediaId ? mediaSrc(series.coverMediaId) : null}
            slug={series.slug}
            className="h-56 w-44 shrink-0 rounded-lg"
          />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">{series.title}</h1>
            {series.description ? (
              <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted">{series.description}</p>
            ) : null}
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="pressable mt-5 inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg"
            >
              <Plus className="size-4" strokeWidth={1.75} />
              নতুন অধ্যায়
            </button>
          </div>
        </div>

        {showForm ? (
          <form
            onSubmit={(e) => void onCreate(e)}
            className="mt-6 rounded-xl border border-border bg-surface p-5"
          >
            <label className="block">
              <span className="mb-1.5 block font-sans text-xs text-muted">অধ্যায়ের শিরোনাম</span>
              <input
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="field-input"
              />
            </label>
            {error ? <p className="mt-3 font-sans text-sm text-nsfw">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="pressable mt-4 inline-flex h-11 items-center rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg disabled:opacity-50"
            >
              {busy ? "তৈরি হচ্ছে…" : "অধ্যায় খুলুন"}
            </button>
          </form>
        ) : null}

        <h2 className="mt-12 font-display text-2xl">অধ্যায়সমূহ</h2>
        {series.chapters.length === 0 ? (
          <p className="mt-4 font-sans text-sm text-muted">এখনো কোনো অধ্যায় নেই।</p>
        ) : (
          <div className="stagger-in mt-5 space-y-2.5">
            {series.chapters.map((c) => (
              <div
                key={c.slug}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base">{c.title}</p>
                  <p className="mt-0.5 font-sans text-xs text-muted">{c.panelCount} প্যানেল</p>
                </div>
                <Link
                  to="/manga/$seriesSlug/$chapterSlug/edit"
                  params={{ seriesSlug: series.slug, chapterSlug: c.slug }}
                  className="pressable inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-muted hover:text-fg"
                >
                  <PenLine className="size-3.5" strokeWidth={1.75} />
                  সম্পাদনা
                </Link>
                {c.panelCount > 0 ? (
                  <Link
                    to="/manga/$seriesSlug/$chapterSlug"
                    params={{ seriesSlug: series.slug, chapterSlug: c.slug }}
                    className="pressable inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3 font-sans text-xs text-accent-fg"
                  >
                    <Play className="size-3.5" strokeWidth={1.75} />
                    পড়ুন
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
