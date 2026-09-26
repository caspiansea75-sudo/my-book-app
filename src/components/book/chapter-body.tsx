import { useMemo, useState } from "react";
import type { Chapter, Paragraph } from "@/lib/book";
import { mediaSrc } from "@/lib/media-url";
import { SensitiveBlock } from "@/components/book/sensitive-block";
import { MediaFigure } from "@/components/book/media-figure";
import { Lightbox, type LightboxItem } from "@/components/book/lightbox";

export function ChapterBody({
  chapter,
  fontSize,
  bookSlug,
}: {
  chapter: Chapter;
  fontSize: number;
  bookSlug?: string;
}) {
  let firstBody = true;
  const [open, setOpen] = useState<number | null>(null);

  const mediaItems = useMemo(() => {
    const items: { para: Paragraph; item: LightboxItem }[] = [];
    for (const section of chapter.sections) {
      for (const para of section.paragraphs) {
        if (para.kind === "image" || para.kind === "video") {
          items.push({
            para,
            item: {
              id: para.id,
              kind: para.kind,
              src: para.mediaId ? mediaSrc(para.mediaId) : undefined,
              url: para.url,
              caption: para.caption,
            },
          });
        }
      }
    }
    return items;
  }, [chapter]);

  return (
    <article className="chapter-body mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-10 text-center">
        <p className="ornament mb-3 text-[10px]">✦</p>
        <p className="font-sans text-xs tracking-widest text-lamp">{chapter.titleEn}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl">{chapter.title}</h1>
        {chapter.excerpt ? (
          <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-muted">
            {chapter.excerpt}
          </p>
        ) : null}
        <p className="ornament mt-6 text-[10px]">✦</p>
      </header>

      {chapter.sections.map((section) => (
        <section key={section.id} id={section.id} className="mb-4">
          {section.title ? (
            <h2 className="mb-6 mt-10 font-display text-xl font-medium text-lamp">{section.title}</h2>
          ) : null}
          {section.paragraphs.map((para) => {
            if (para.kind === "break") {
              return (
                <div key={para.id} className="scene-break" aria-hidden="true">
                  ❦
                </div>
              );
            }
            if (para.kind === "image" || para.kind === "video") {
              firstBody = false;
              const idx = mediaItems.findIndex((m) => m.para.id === para.id);
              return (
                <MediaFigure
                  key={para.id}
                  kind={para.kind}
                  src={para.mediaId ? mediaSrc(para.mediaId) : undefined}
                  url={para.url}
                  caption={para.caption}
                  onOpen={para.kind === "image" ? () => setOpen(idx) : undefined}
                />
              );
            }
            if (para.nsfw) {
              firstBody = false;
              return (
                <SensitiveBlock
                  key={para.id}
                  para={para}
                  fontSize={fontSize}
                  toggleId={bookSlug ? `${bookSlug}:${para.id}` : para.id}
                />
              );
            }
            const drop = firstBody;
            firstBody = false;
            return (
              <p
                key={para.id}
                id={para.id}
                className={drop ? "drop-cap text-fg" : "text-fg"}
                style={{ fontSize: `${fontSize}px` }}
              >
                {para.text}
              </p>
            );
          })}
        </section>
      ))}

      {open != null ? (
        <Lightbox
          items={mediaItems.map((m) => m.item)}
          index={open}
          onClose={() => setOpen(null)}
          onIndex={setOpen}
        />
      ) : null}
    </article>
  );
}
