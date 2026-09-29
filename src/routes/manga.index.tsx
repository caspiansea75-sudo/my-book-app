import { useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookImage } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { SiteNav } from "@/components/book/site-nav";
import { FxAurora, FxWords, fxIndex } from "@/components/media/fx";
import { createMangaSeries, listMangaSeries } from "@/lib/manga-api";
import { mediaSrc } from "@/lib/media-url";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/manga/")({
  loader: () => listMangaSeries(),
  component: MangaHub,
});

function MangaHub() {
  const series = Route.useLoaderData();
  const me = useMe();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await createMangaSeries({ data: { title, titleEn, description } });
      await navigate({ to: "/manga/$seriesSlug", params: { seriesSlug: result.slug } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "তৈরি হয়নি");
      setBusy(false);
    }
  }

  return (
    <main className="mf-page relative min-h-dvh">
      <FxAurora />
      <SiteNav active="manga" />
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <p className="mf-eyebrow flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
          <BookImage className="size-4" strokeWidth={1.6} />
          মাঙ্গা
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl"><FxWords text="মাঙ্গা স্টুডিও" /></h1>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted">
          চিত্রশালার ছবি দিয়ে প্যানেল সাজিয়ে নিজের মাঙ্গা তৈরি করুন, আর স্ক্রল করে মাঙ্গার মতো পড়ুন।
        </p>

        {me ? (
          <form
            onSubmit={(e) => void onCreate(e)}
            className="mt-10 rounded-xl border border-border bg-surface p-5 sm:p-6"
          >
            <h2 className="font-display text-xl">নতুন মাঙ্গা</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block font-sans text-xs text-muted">শিরোনাম</span>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="field-input"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-sans text-xs text-muted">English title (slug-এর জন্য)</span>
                <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="field-input" />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1.5 block font-sans text-xs text-muted">পরিচিতি</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="field-input"
              />
            </label>
            {error ? <p className="mt-3 font-sans text-sm text-nsfw">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="pressable mt-5 inline-flex h-12 items-center rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg disabled:opacity-50"
            >
              {busy ? "তৈরি হচ্ছে…" : "মাঙ্গা খুলুন"}
            </button>
          </form>
        ) : null}

        <h2 className="mt-14 font-display text-2xl">সব মাঙ্গা</h2>
        {series.length === 0 ? (
          <p className="mt-4 font-sans text-sm text-muted">এখনো কোনো মাঙ্গা তৈরি হয়নি।</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {series.map((s, i) => (
              <Link
                key={s.slug}
                to="/manga/$seriesSlug"
                params={{ seriesSlug: s.slug }}
                className={`mf-card mf-rise pressable group overflow-hidden rounded-xl border border-border bg-surface ${s.hidden ? "opacity-50" : ""}`}
                style={fxIndex(i)}
              >
                <CoverArt
                  title={s.title}
                  coverUrl={s.coverMediaId ? mediaSrc(s.coverMediaId) : null}
                  slug={s.slug}
                  className="aspect-[3/4] w-full"
                />
                <div className="p-3">
                  <p className="font-display text-lg">{s.title}</p>
                  {s.author ? <p className="mt-0.5 font-sans text-xs text-lamp">{s.author}</p> : null}
                  <p className="mt-1 font-sans text-xs text-muted">{s.chapterCount} অধ্যায়</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
