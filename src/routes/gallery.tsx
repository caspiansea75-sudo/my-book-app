import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Images, Trash2, Video } from "lucide-react";
import { Lightbox, type LightboxItem } from "@/components/book/lightbox";
import { SiteNav } from "@/components/book/site-nav";
import { MediaUploader } from "@/components/studio/media-uploader";
import { deleteMedia, listMedia, type MediaItem } from "@/lib/library-api";

export const Route = createFileRoute("/gallery")({
  loader: () => listMedia(),
  component: GalleryPage,
});

function GalleryPage() {
  const initial = Route.useLoaderData();
  const [items, setItems] = useState<MediaItem[]>(initial);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [open, setOpen] = useState<number | null>(null);

  async function refresh() {
    setItems(await listMedia());
  }

  const visible = items.filter((item) => (filter === "all" ? true : item.kind === filter));
  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      visible.map((item) => ({
        id: String(item.id),
        kind: item.kind,
        src: item.src,
        url: item.url ?? undefined,
        title: item.title,
      })),
    [visible],
  );

  return (
    <main className="relative min-h-dvh">
      <SiteNav active="gallery" />
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <p className="flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
          <Images className="size-4" strokeWidth={1.6} />
          চিত্রশালা
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">ছবি ও ভিডিও</h1>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted">
          প্রচ্ছদ, অধ্যায়ের ছবি, বা আলাদা অ্যালবাম — এখানে আপলোড করুন। ছোট ক্লিপ সরাসরি, বড় ভিডিও YouTube বা
          লিংক দিয়ে।
        </p>

        <div className="mt-8">
          <MediaUploader
            onUploaded={() => {
              void refresh();
            }}
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-1.5">
          {(
            [
              ["all", "সব"],
              ["image", "ছবি"],
              ["video", "ভিডিও"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={
                filter === id
                  ? "pressable h-10 rounded-full bg-accent px-3 font-sans text-xs text-accent-fg"
                  : "pressable h-10 rounded-full border border-border px-3 font-sans text-xs text-muted"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="mt-12 font-sans text-sm text-muted">এখনো কিছু যোগ হয়নি। একটি ছবি তুলে শুরু করুন।</p>
        ) : (
          <div className="gallery-grid mt-8">
            {visible.map((item, i) => (
              <article key={item.id} className="gallery-tile group">
                <button
                  type="button"
                  className="block h-full w-full"
                  onClick={() => setOpen(i)}
                  aria-label={item.title || item.kind}
                >
                  {item.kind === "image" ? (
                    <img src={item.thumbSrc || item.src} alt={item.title} />
                  ) : item.thumbSrc ? (
                    <span className="relative block h-full">
                      <img src={item.thumbSrc} alt={item.title} />
                      <span className="absolute inset-0 grid place-items-center bg-bg/25">
                        <Video className="size-8 text-fg" />
                      </span>
                    </span>
                  ) : (
                    <span className="grid h-full min-h-40 place-items-center bg-surface-2 text-lamp">
                      <Video className="size-8" />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="pressable absolute top-2 right-2 grid size-10 place-items-center rounded-full bg-bg/70 text-muted opacity-0 group-hover:opacity-100"
                  aria-label="মুছুন"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await deleteMedia({ data: { id: item.id } });
                    await refresh();
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      {open != null ? (
        <Lightbox items={lightboxItems} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
      ) : null}
    </main>
  );
}
