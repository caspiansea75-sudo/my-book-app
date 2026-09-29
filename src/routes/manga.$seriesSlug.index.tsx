import { useState, type FormEvent } from "react";
import { Link, createFileRoute, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { BookImage, ImagePlus, PenLine, Play, Plus, Trash2 } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { SiteNav } from "@/components/book/site-nav";
import { HideToggle } from "@/components/members/hide-toggle";
import { FxAurora, FxWords, fxIndex } from "@/components/media/fx";
import { MediaUploader } from "@/components/studio/media-uploader";
import { listMedia } from "@/lib/library-api";
import { mediaSrc } from "@/lib/media-url";
import { useCanEdit } from "@/lib/use-me";
import {
  createMangaChapter,
  deleteMangaChapter,
  deleteMangaSeries,
  getMangaSeries,
  setMangaCover,
  updateMangaSeries,
} from "@/lib/manga-api";

export const Route = createFileRoute("/manga/$seriesSlug/")({
  loader: async ({ params }) => {
    const [series, media] = await Promise.all([
      getMangaSeries({ data: { slug: params.seriesSlug } }),
      listMedia(),
    ]);
    if (!series) throw notFound();
    return { series, media };
  },
  component: MangaSeriesPage,
});

function MangaSeriesPage() {
  const { series, media } = Route.useLoaderData();
  const canEdit = useCanEdit(series.ownerId);
  const router = useRouter();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [title, setTitle] = useState(series.title);
  const [description, setDescription] = useState(series.description);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [showChapterForm, setShowChapterForm] = useState(canEdit && series.chapters.length === 0);
  const [chapterTitle, setChapterTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreateChapter(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createMangaChapter({ data: { seriesSlug: series.slug, title: chapterTitle } });
      setChapterTitle("");
      setShowChapterForm(false);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "তৈরি হয়নি");
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    setSavingMeta(true);
    setMetaError(null);
    try {
      await updateMangaSeries({ data: { slug: series.slug, title, description } });
      setEditOpen(false);
      await router.invalidate();
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ");
    } finally {
      setSavingMeta(false);
    }
  }

  async function pickCover(id: number) {
    await setMangaCover({ data: { slug: series.slug, mediaId: id } });
    setCoverOpen(false);
    await router.invalidate();
  }

  async function removeSeries() {
    if (!window.confirm("এই মাঙ্গা এবং এর সব অধ্যায়/প্যানেল স্থায়ীভাবে মুছে ফেলবেন?")) return;
    await deleteMangaSeries({ data: { slug: series.slug } });
    await navigate({ to: "/manga" });
  }

  async function removeChapter(chapterSlug: string) {
    if (!window.confirm("এই অধ্যায় ও এর সব প্যানেল মুছে ফেলবেন?")) return;
    await deleteMangaChapter({ data: { seriesSlug: series.slug, chapterSlug } });
    await router.invalidate();
  }

  return (
    <main className="mf-page relative min-h-dvh">
      <FxAurora />
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
          <div className="shrink-0">
            <CoverArt
              title={series.title}
              coverUrl={series.coverMediaId ? mediaSrc(series.coverMediaId) : null}
              slug={series.slug}
              className="h-56 w-44 rounded-lg"
            />
            {canEdit ? (
              <button
                type="button"
                onClick={() => setCoverOpen((v) => !v)}
                className="pressable mt-2 inline-flex h-9 w-44 items-center justify-center gap-1.5 rounded-lg border border-border font-sans text-xs text-fg"
              >
                <ImagePlus className="size-3.5" strokeWidth={1.75} />
                প্রচ্ছদ
              </button>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            {editOpen ? (
              <form onSubmit={(e) => void saveMeta(e)} className="space-y-2.5">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="field-input"
                />
                {metaError ? <p className="font-sans text-sm text-nsfw">{metaError}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingMeta || !title.trim()}
                    className="pressable h-10 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg disabled:opacity-50"
                  >
                    সংরক্ষণ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditOpen(false);
                      setTitle(series.title);
                      setDescription(series.description);
                    }}
                    className="pressable h-10 rounded-lg border border-border px-4 font-sans text-sm text-muted"
                  >
                    বাতিল
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h1 className="font-display text-3xl font-semibold sm:text-4xl"><FxWords text={series.title} /></h1>
                <HideToggle kind="manga" id={series.slug} hidden={!!series.hidden} variant="pill" className="mt-3" />
                {series.description ? (
                  <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted">{series.description}</p>
                ) : null}
                {canEdit ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChapterForm((v) => !v)}
                      className="pressable inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg"
                    >
                      <Plus className="size-4" strokeWidth={1.75} />
                      নতুন অধ্যায়
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
                      className="pressable inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-4 font-sans text-sm text-fg"
                    >
                      <PenLine className="size-4" strokeWidth={1.75} />
                      সম্পাদনা
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSeries()}
                      className="pressable inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-4 font-sans text-sm text-nsfw"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                      মাঙ্গা মুছুন
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {canEdit && coverOpen ? (
          <div className="mt-6 rounded-xl border border-border bg-surface p-4">
            <p className="mb-3 font-display">প্রচ্ছদের ছবি</p>
            <MediaUploader compact onUploaded={(id) => void pickCover(id)} />
            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {media
                .filter((m) => m.kind === "image")
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void pickCover(item.id)}
                    className="pressable overflow-hidden rounded-md border border-border"
                  >
                    <img src={item.thumbSrc || item.src} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
            </div>
          </div>
        ) : null}

        {canEdit && showChapterForm ? (
          <form
            onSubmit={(e) => void onCreateChapter(e)}
            className="mt-6 rounded-xl border border-border bg-surface p-5"
          >
            <label className="block">
              <span className="mb-1.5 block font-sans text-xs text-muted">অধ্যায়ের শিরোনাম</span>
              <input
                required
                autoFocus
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                className="field-input"
              />
            </label>
            {error ? <p className="mt-3 font-sans text-sm text-nsfw">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || !chapterTitle.trim()}
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
          <div className="mt-5 space-y-2.5">
            {series.chapters.map((c, i) => (
              <div
                key={c.slug}
                style={fxIndex(i)}
                className="mf-card mf-rise flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base">{c.title}</p>
                  <p className="mt-0.5 font-sans text-xs text-muted">{c.panelCount} প্যানেল</p>
                </div>
                {canEdit ? (
                  <Link
                    to="/manga/$seriesSlug/$chapterSlug/edit"
                    params={{ seriesSlug: series.slug, chapterSlug: c.slug }}
                    className="pressable inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-muted hover:text-fg"
                  >
                    <PenLine className="size-3.5" strokeWidth={1.75} />
                    সম্পাদনা
                  </Link>
                ) : null}
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
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void removeChapter(c.slug)}
                    className="pressable grid size-9 shrink-0 place-items-center rounded-full text-nsfw/80 hover:text-nsfw"
                    aria-label="অধ্যায় মুছুন"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
