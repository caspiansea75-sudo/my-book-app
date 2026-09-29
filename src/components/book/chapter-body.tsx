import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Chapter, Paragraph } from "@/lib/book";
import { mediaSrc } from "@/lib/media-url";
import { SensitiveBlock } from "@/components/book/sensitive-block";
import { MediaFigure } from "@/components/book/media-figure";
import { Lightbox, type LightboxItem } from "@/components/book/lightbox";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/book/rich-text";

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
      <header className="stagger-in mb-10 text-center">
        <p className="ornament flicker mb-3 text-[10px]">✦</p>
        <p className="font-sans text-xs tracking-widest text-lamp">{chapter.titleEn}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl">{chapter.title}</h1>
        {chapter.excerpt ? (
          <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-muted">
            {chapter.excerpt}
          </p>
        ) : null}
        <p className="ornament flicker mt-6 text-[10px]">✦</p>
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
              <RevealParagraph
                key={para.id}
                id={para.id}
                className={drop ? "drop-cap text-fg" : "text-fg"}
                style={{ fontSize: `${fontSize}px` }}
              >
                <RichText para={para} />
              </RevealParagraph>
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

/**
 * A paragraph that fades/rises into view the first time it scrolls into
 * the viewport. Falls back to fully visible immediately if
 * IntersectionObserver isn't available (very old browsers) or the id
 * already sits at the top of the page on first paint.
 */
function RevealParagraph({
  id,
  className,
  style,
  children,
}: {
  id: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <p
      ref={ref}
      id={id}
      className={cn(className, "reveal-p", visible && "reveal-p--in")}
      style={style}
    >
      {children}
    </p>
  );
}
