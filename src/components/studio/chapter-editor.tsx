import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ImagePlus, Plus, Trash2, Type, Video } from "lucide-react";
import type { BookIndex, Chapter, Paragraph, Section } from "@/lib/book";
import { newBlockId, padSlug } from "@/lib/book";
import {
  deleteStudioChapter,
  listMedia,
  saveChapterInserts,
  saveStudioChapter,
  type MediaItem,
} from "@/lib/library-api";
import { MediaFigure } from "@/components/book/media-figure";
import { MediaUploader } from "@/components/studio/media-uploader";
import { cn } from "@/lib/utils";

type Block =
  | { key: string; type: "p"; text: string; nsfw: boolean; originId: string }
  | { key: string; type: "break"; originId: string }
  | { key: string; type: "image"; mediaId: number; caption: string; originId: string }
  | { key: string; type: "video"; mediaId?: number; url?: string; caption: string; originId: string };

function blocksFromChapter(chapter: Chapter | null): Block[] {
  if (!chapter) {
    return [{ key: newBlockId("p"), type: "p", text: "", nsfw: false, originId: newBlockId("p") }];
  }
  const out: Block[] = [];
  for (const section of chapter.sections) {
    for (const para of section.paragraphs) {
      if (para.kind === "break") {
        out.push({ key: para.id, type: "break", originId: para.id });
      } else if (para.kind === "image" && para.mediaId) {
        out.push({
          key: para.id,
          type: "image",
          mediaId: para.mediaId,
          caption: para.caption ?? "",
          originId: para.id,
        });
      } else if (para.kind === "video") {
        out.push({
          key: para.id,
          type: "video",
          mediaId: para.mediaId,
          url: para.url,
          caption: para.caption ?? "",
          originId: para.id,
        });
      } else {
        out.push({
          key: para.id,
          type: "p",
          text: para.text,
          nsfw: para.nsfw,
          originId: para.id,
        });
      }
    }
  }
  return out.length
    ? out
    : [{ key: newBlockId("p"), type: "p", text: "", nsfw: false, originId: newBlockId("p") }];
}

function toSections(blocks: Block[]): Section[] {
  const paragraphs: Paragraph[] = blocks.map((block) => {
    if (block.type === "break") {
      return { id: block.originId, kind: "break", text: "", nsfw: false };
    }
    if (block.type === "image") {
      return {
        id: block.originId,
        kind: "image",
        text: "",
        nsfw: false,
        mediaId: block.mediaId,
        caption: block.caption,
      };
    }
    if (block.type === "video") {
      return {
        id: block.originId,
        kind: "video",
        text: "",
        nsfw: false,
        mediaId: block.mediaId,
        url: block.url,
        caption: block.caption,
      };
    }
    return { id: block.originId, kind: "p", text: block.text, nsfw: block.nsfw };
  });
  return [{ id: "main", title: "", paragraphs }];
}

export function ChapterEditor({
  book,
  chapter,
  slug,
}: {
  book: BookIndex;
  chapter: Chapter | null;
  slug?: string;
}) {
  const navigate = useNavigate();
  const canon = book.origin !== "studio";
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [titleEn, setTitleEn] = useState(chapter?.titleEn ?? "");
  const [excerpt, setExcerpt] = useState(chapter?.excerpt ?? "");
  const [blocks, setBlocks] = useState<Block[]>(() => blocksFromChapter(chapter));
  const [picker, setPicker] = useState<number | null>(null);
  const [library, setLibrary] = useState<MediaItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaIds = useMemo(
    () => new Set(blocks.flatMap((b) => (b.type === "image" || b.type === "video" ? [b.mediaId] : []))),
    [blocks],
  );

  function update(i: number, patch: Partial<Block>) {
    setBlocks((list) => list.map((b, idx) => (idx === i ? ({ ...b, ...patch } as Block) : b)));
  }

  function insertAt(i: number, block: Block) {
    setBlocks((list) => {
      const next = [...list];
      next.splice(i, 0, block);
      return next;
    });
  }

  function removeAt(i: number) {
    setBlocks((list) => list.filter((_, idx) => idx !== i));
  }

  async function openPicker(index: number) {
    setPicker(index);
    if (!library) setLibrary(await listMedia());
  }

  function pickMedia(item: MediaItem) {
    if (picker == null) return;
    const key = newBlockId(item.kind === "image" ? "img" : "vid");
    const block: Block =
      item.kind === "image"
        ? { key, type: "image", mediaId: item.id, caption: item.title, originId: key }
        : { key, type: "video", mediaId: item.id, url: item.url ?? undefined, caption: item.title, originId: key };
    insertAt(picker, block);
    setPicker(null);
  }

  async function onUploaded(id: number, kind: "image" | "video") {
    const items = await listMedia();
    setLibrary(items);
    const found = items.find((m) => m.id === id);
    if (!found || picker == null) return;
    pickMedia(found);
    void kind;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (canon) {
        if (!slug) throw new Error("অধ্যায় খুঁজে পাওয়া যায়নি");
        const items: { afterParaId: string; mediaId: number; caption: string }[] = [];
        let lastPara = "";
        for (const block of blocks) {
          if (block.type === "p" || block.type === "break") {
            lastPara = block.originId;
          } else if (block.type === "image" || (block.type === "video" && block.mediaId)) {
            items.push({
              afterParaId: lastPara,
              mediaId: block.mediaId as number,
              caption: block.caption,
            });
          }
        }
        await saveChapterInserts({
          data: { bookSlug: book.slug, chapterSlug: slug, items },
        });
      } else {
        const result = await saveStudioChapter({
          data: {
            bookSlug: book.slug,
            slug,
            title,
            titleEn,
            excerpt,
            sections: toSections(blocks),
          },
        });
        if (!slug) {
          await navigate({
            to: "/studio/$bookSlug/$slug",
            params: { bookSlug: book.slug, slug: result.slug },
          });
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  async function removeChapter() {
    if (canon || !slug) return;
    if (!window.confirm("এই অধ্যায় মুছে ফেলবেন?")) return;
    await deleteStudioChapter({ data: { bookSlug: book.slug, slug } });
    await navigate({ to: "/studio/$bookSlug", params: { bookSlug: book.slug } });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="শিরোনাম">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={canon}
            className="field-input"
          />
        </Field>
        <Field label="English title">
          <input
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            disabled={canon}
            className="field-input"
          />
        </Field>
      </div>
      <Field label="সারাংশ">
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          disabled={canon}
          rows={2}
          className="field-input min-h-16"
        />
      </Field>

      {canon ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 font-sans text-sm text-muted">
          মূল পাঠ GitHub থেকে আসে। এখানে অনুচ্ছেদের মাঝে ছবি ও ভিডিও বসান — লেখা থাকবে অক্ষত।
        </p>
      ) : null}

      <div className="space-y-3">
        {blocks.map((block, i) => (
          <article key={block.key} className="rounded-xl border border-border bg-surface p-3">
            {block.type === "p" ? (
              <textarea
                value={block.text}
                onChange={(e) => update(i, { text: e.target.value })}
                disabled={canon}
                rows={4}
                className="field-input min-h-28 font-display leading-relaxed"
                placeholder="অনুচ্ছেদ লিখুন…"
              />
            ) : null}
            {block.type === "break" ? (
              <p className="scene-break py-2">দৃশ্য বিরতি</p>
            ) : null}
            {block.type === "image" ? (
              <div className="space-y-2">
                <MediaFigure kind="image" src={`/api/media/${block.mediaId}`} caption={block.caption} />
                <input
                  value={block.caption}
                  onChange={(e) => update(i, { caption: e.target.value })}
                  placeholder="ক্যাপশন"
                  className="field-input"
                />
              </div>
            ) : null}
            {block.type === "video" ? (
              <div className="space-y-2">
                <MediaFigure
                  kind="video"
                  src={block.mediaId ? `/api/media/${block.mediaId}` : undefined}
                  url={block.url}
                  caption={block.caption}
                />
                <input
                  value={block.caption}
                  onChange={(e) => update(i, { caption: e.target.value })}
                  placeholder="ক্যাপশন"
                  className="field-input"
                />
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-1">
              <IconBtn label="ছবি" onClick={() => void openPicker(i + 1)}>
                <ImagePlus className="size-3.5" />
              </IconBtn>
              <IconBtn label="ভিডিও" onClick={() => void openPicker(i + 1)}>
                <Video className="size-3.5" />
              </IconBtn>
              {!canon ? (
                <>
                  <IconBtn
                    label="অনুচ্ছেদ"
                    onClick={() =>
                      insertAt(i + 1, {
                        key: newBlockId("p"),
                        type: "p",
                        text: "",
                        nsfw: false,
                        originId: newBlockId("p"),
                      })
                    }
                  >
                    <Type className="size-3.5" />
                  </IconBtn>
                  <IconBtn
                    label="বিরতি"
                    onClick={() =>
                      insertAt(i + 1, { key: newBlockId("br"), type: "break", originId: newBlockId("br") })
                    }
                  >
                    <Plus className="size-3.5" />
                  </IconBtn>
                </>
              ) : null}
              {(!canon || block.type === "image" || block.type === "video") && blocks.length > 1 ? (
                <IconBtn label="মুছুন" onClick={() => removeAt(i)} danger>
                  <Trash2 className="size-3.5" />
                </IconBtn>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {picker != null ? (
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-display text-base">মিডিয়া বাছুন</p>
            <button type="button" className="pressable text-sm text-muted" onClick={() => setPicker(null)}>
              বন্ধ
            </button>
          </div>
          <MediaUploader compact onUploaded={(id, kind) => void onUploaded(id, kind)} />
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {(library ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pickMedia(item)}
                className={cn(
                  "pressable overflow-hidden rounded-lg border border-border bg-surface",
                  mediaIds.has(item.id) && "ring-1 ring-lamp",
                )}
              >
                {item.kind === "image" ? (
                  <img src={item.thumbSrc || item.src} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <span className="grid aspect-square place-items-center text-lamp">
                    <Video className="size-6" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="font-sans text-sm text-nsfw">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() => void save()}
          className="pressable inline-flex h-12 items-center rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg disabled:opacity-50"
        >
          {busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}
        </button>
        {slug && !canon ? (
          <button
            type="button"
            onClick={() => void removeChapter()}
            className="pressable inline-flex h-12 items-center rounded-lg border border-border px-4 font-sans text-sm text-nsfw"
          >
            অধ্যায় মুছুন
          </button>
        ) : null}
        {slug ? (
          <a
            href={`/read/${book.slug}/${padSlug(slug)}`}
            className="pressable inline-flex h-12 items-center rounded-lg border border-border px-4 font-sans text-sm text-fg"
          >
            পড়ে দেখুন
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-sans text-xs tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable inline-flex h-9 items-center gap-1 rounded-full px-2.5 font-sans text-[11px]",
        danger ? "text-nsfw hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
      {label}
    </button>
  );
}
