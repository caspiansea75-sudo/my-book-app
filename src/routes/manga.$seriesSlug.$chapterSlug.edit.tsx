import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute, notFound, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronLeft, GripVertical, ImagePlus, PenLine, Trash2 } from "lucide-react";
import { SiteNav } from "@/components/book/site-nav";
import { MultiUploader } from "@/components/media/multi-uploader";
import { PanelPicker } from "@/components/manga/panel-picker";
import { loadVault } from "@/lib/media-folders-api";
import { redirectGuest } from "@/lib/auth/guest";
import { canEditOwner } from "@/lib/use-me";
import {
  addMangaPanels,
  deleteMangaChapter,
  getMangaChapterForEdit,
  removeMangaPanel,
  reorderMangaPanels,
  updateMangaChapterTitle,
  type MangaPanel,
} from "@/lib/manga-api";

export const Route = createFileRoute("/manga/$seriesSlug/$chapterSlug/edit")({
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: "/login" });
    redirectGuest(context.me, "create");
  },
  loader: async ({ params, context }) => {
    const [chapter, vault] = await Promise.all([
      getMangaChapterForEdit({ data: { seriesSlug: params.seriesSlug, chapterSlug: params.chapterSlug } }),
      loadVault(),
    ]);
    if (!chapter) throw notFound();
    if (!canEditOwner(context.me, chapter.ownerId)) {
      throw redirect({ to: "/manga/$seriesSlug", params: { seriesSlug: params.seriesSlug } });
    }
    return { chapter, vault };
  },
  component: MangaEditPage,
});

function MangaEditPage() {
  const { chapter, vault } = Route.useLoaderData();
  const { seriesSlug, chapterSlug } = Route.useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(chapter.panels.length === 0);
  const [titleEditOpen, setTitleEditOpen] = useState(false);
  const [title, setTitle] = useState(chapter.chapterTitle);
  const [savingTitle, setSavingTitle] = useState(false);

  const [panels, setPanels] = useState<MangaPanel[]>(chapter.panels);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  useEffect(() => setPanels(chapter.panels), [chapter.panels]);

  async function refresh() {
    await router.invalidate();
  }

  async function saveTitle(e: FormEvent) {
    e.preventDefault();
    setSavingTitle(true);
    try {
      await updateMangaChapterTitle({ data: { seriesSlug, chapterSlug, title } });
      setTitleEditOpen(false);
      await refresh();
    } finally {
      setSavingTitle(false);
    }
  }

  async function removeChapter() {
    if (!window.confirm("এই অধ্যায় ও এর সব প্যানেল মুছে ফেলবেন?")) return;
    await deleteMangaChapter({ data: { seriesSlug, chapterSlug } });
    await navigate({ to: "/manga/$seriesSlug", params: { seriesSlug } });
  }

  async function handleAddMany(mediaIds: number[]) {
    try {
      await addMangaPanels({ data: { seriesSlug, chapterSlug, mediaIds } });
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "প্যানেল যোগ হয়নি");
      throw err;
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

  async function applyOrder(next: typeof panels) {
    setPanels(next); // show the new order immediately
    try {
      await reorderMangaPanels({ data: { panelIds: next.map((p) => p.id) } });
    } finally {
      await refresh();
    }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= panels.length) return;
    const next = [...panels];
    [next[index], next[target]] = [next[target]!, next[index]!];
    await applyOrder(next);
  }

  async function handleDrop(to: number) {
    const from = dragIndex;
    setDragIndex(null);
    setOverIndex(null);
    if (from == null || from === to) return;
    const next = [...panels];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    await applyOrder(next);
  }

  const usedIds = new Set(panels.map((p) => p.mediaId));

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
        {titleEditOpen ? (
          <form onSubmit={(e) => void saveTitle(e)} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field-input max-w-xs"
              autoFocus
            />
            <button
              type="submit"
              disabled={savingTitle || !title.trim()}
              className="pressable h-10 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg disabled:opacity-50"
            >
              সংরক্ষণ
            </button>
            <button
              type="button"
              onClick={() => {
                setTitleEditOpen(false);
                setTitle(chapter.chapterTitle);
              }}
              className="pressable h-10 rounded-lg border border-border px-4 font-sans text-sm text-muted"
            >
              বাতিল
            </button>
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTitleEditOpen(true)}
              className="pressable inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-muted hover:text-fg"
            >
              <PenLine className="size-3.5" strokeWidth={1.75} />
              নাম বদলান
            </button>
            <button
              type="button"
              onClick={() => void removeChapter()}
              className="pressable inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-nsfw"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              অধ্যায় মুছুন
            </button>
          </div>
        )}
        <p className="mt-3 font-sans text-sm text-muted">
          প্যানেল যোগ করুন, উপরে-নিচে সাজান। উপরের প্যানেলটাই প্রথমে দেখা যাবে।
        </p>

        <h2 className="mt-10 font-display text-xl">প্যানেলসমূহ ({panels.length})</h2>
        {panels.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-muted">এখনো কোনো প্যানেল যোগ হয়নি — নিচ থেকে ছবি বেছে নিন।</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {panels.map((p, i) => (
              <li
                key={p.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overIndex !== i) setOverIndex(i);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleDrop(i);
                }}
                className={`flex items-center gap-3 rounded-lg border bg-surface p-2.5 ${
                  overIndex === i && dragIndex !== null && dragIndex !== i ? "border-lamp" : "border-border"
                } ${dragIndex === i ? "opacity-40" : ""}`}
              >
                <GripVertical className="hidden size-4 shrink-0 cursor-grab text-subtle sm:block" strokeWidth={1.75} />
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
                    disabled={i === panels.length - 1}
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
            aria-expanded={pickerOpen}
            className="pressable inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg"
          >
            <ImagePlus className="size-4" strokeWidth={1.75} />
            চিত্রশালা থেকে প্যানেল যোগ করুন
          </button>
        </div>

        {pickerOpen ? (
          <div className="mt-5 rounded-xl border border-border bg-surface p-4">
            <PanelPicker folders={vault.folders} items={vault.items} usedIds={usedIds} onAdd={handleAddMany} />
            <details className="mt-6 rounded-lg border border-border p-3">
              <summary className="cursor-pointer font-sans text-sm text-muted">নতুন ছবি আপলোড করে সরাসরি যোগ করুন</summary>
              <div className="mt-3">
                <MultiUploader targetLabel="এই অধ্যায়" onUploaded={handleAddMany} />
              </div>
            </details>
          </div>
        ) : null}
      </section>
    </main>
  );
}
