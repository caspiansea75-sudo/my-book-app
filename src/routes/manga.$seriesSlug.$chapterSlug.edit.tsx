import { useState } from "react";
import { Link, createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronLeft, ImagePlus, Trash2 } from "lucide-react";
import { SiteNav } from "@/components/book/site-nav";
import { MediaUploader } from "@/components/studio/media-uploader";
import { listMedia, type MediaItem } from "@/lib/library-api";
import {
  addMangaPanel,
  getMangaChapterForEdit,
  removeMangaPanel,
  reorderMangaPanels,
} from "@/lib/manga-api";

export const Route = createFileRoute("/manga/$seriesSlug/$chapterSlug/edit")({
  loader: async ({ params }) => {
    const [chapter, media] = await Promise.all([
      getMangaChapterForEdit({ data: { seriesSlug: params.seriesSlug, chapterSlug: params.chapterSlug } }),
      listMedia(),
    ]);
    if (!chapter) throw notFound();
    return { chapter, media };
  },
  component: MangaEditPage,
});

function MangaEditPage() {
  const { chapter, media } = Route.useLoaderData();
  const { seriesSlug, chapterSlug } = Route.useParams();
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function refresh() {
    await router.invalidate();
  }

  async function handleAdd(mediaId: number) {
    setBusyId(mediaId);
    try {
      await addMangaPanel({ data: { seriesSlug, chapterSlug, mediaId } });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(panelId: number) {
    setBusyId(panelId);
    try {
      await removeMangaPanel({ data: { panelId } });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const next = [...chapter.panels];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index];
    next[index] = next[target]!;
    next[target] = tmp!;
    await reorderMangaPanels({ data: { panelIds: next.map((p) => p.id) } });
    await refresh();
  }

  const images: MediaItem[] = media.filter((m) => m.kind === "image");

  return (
    <main className="relative min-h-dvh">
      <SiteNav active="manga" />
      <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
        <Link
          to="/manga/$seriesSlug"
          params={{ seriesSlug }}
          className="pressable inline-flex items-center gap-1.5 font-sans text-xs text-muted hover:text-fg"
        >
          <ChevronLeft className="size-3.5" strokeWidth={1.75} />
          {chapter.seriesTitle}
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{chapter.chapterTitle}</h1>
        <p className="mt-2 font-sans text-sm text-muted">
          প্যানেল যোগ করুন, উপরে-নিচে সাজান। উপরের প্যানেলটাই প্রথমে দেখা যাবে।
        </p>

        <h2 className="mt-10 font-display text-xl">প্যানেলসমূহ ({chapter.panels.length})</h2>
        {chapter.panels.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-muted">এখনো কোনো প্যানেল যোগ হয়নি — নিচ থেকে ছবি বেছে নিন।</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {chapter.panels.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 font-sans text-xs text-muted">
                  {i + 1}
                </span>
                <img src={p.src} alt="" className="h-20 w-16 shrink-0 rounded-md object-cover" />
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => void handleMove(i, -1)}
                    className="pressable grid size-9 place-items-center rounded-full text-muted hover:text-fg disabled:opacity-30"
                    aria-label="উপরে সরান"
                  >
                    <ArrowUp className="size-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    disabled={i === chapter.panels.length - 1}
                    onClick={() => void handleMove(i, 1)}
                    className="pressable grid size-9 place-items-center rounded-full text-muted hover:text-fg disabled:opacity-30"
                    aria-label="নিচে সরান"
                  >
                    <ArrowDown className="size-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => void handleRemove(p.id)}
                    className="pressable grid size-9 place-items-center rounded-full text-nsfw/80 hover:text-nsfw disabled:opacity-40"
                    aria-label="মুছুন"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="pressable inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg"
          >
            <ImagePlus className="size-4" strokeWidth={1.75} />
            চিত্রশালা থেকে প্যানেল যোগ করুন
          </button>
        </div>

        {pickerOpen ? (
          <div className="mt-5 rounded-xl border border-border bg-surface p-4">
            <MediaUploader onUploaded={(id) => void handleAdd(id)} />
            {images.length === 0 ? (
              <p className="mt-4 font-sans text-sm text-muted">চিত্রশালায় এখনো কোনো ছবি নেই।</p>
            ) : (
              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    disabled={busyId === img.id}
                    onClick={() => void handleAdd(img.id)}
                    className="pressable group relative aspect-square overflow-hidden rounded-lg border border-border disabled:opacity-50"
                  >
                    <img src={img.thumbSrc || img.src} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-bg/0 opacity-0 transition-opacity group-hover:bg-bg/40 group-hover:opacity-100">
                      <ImagePlus className="size-5 text-fg" strokeWidth={1.75} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
