import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { MediaFigure } from "@/components/book/media-figure";

export type LightboxItem = {
  id: string;
  kind: "image" | "video";
  src?: string;
  url?: string;
  title?: string;
  caption?: string;
};

export function Lightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndex: (next: number) => void;
}) {
  const item = items[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, items.length, onClose, onIndex]);

  if (!item) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.title || "মিডিয়া"}>
      <button type="button" className="lightbox-scrim" onClick={onClose} aria-label="বন্ধ" />
      <div className="lightbox-stage">
        <MediaFigure kind={item.kind} src={item.src} url={item.url} caption={item.caption || item.title} />
      </div>
      <button
        type="button"
        className="lightbox-btn lightbox-close"
        onClick={onClose}
        aria-label="বন্ধ"
      >
        <X className="size-5" strokeWidth={1.75} />
      </button>
      {items.length > 1 ? (
        <>
          <button
            type="button"
            className="lightbox-btn lightbox-prev"
            onClick={() => onIndex((index - 1 + items.length) % items.length)}
            aria-label="আগের"
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="lightbox-btn lightbox-next"
            onClick={() => onIndex((index + 1) % items.length)}
            aria-label="পরের"
          >
            <ChevronRight className="size-5" strokeWidth={1.75} />
          </button>
        </>
      ) : null}
    </div>
  );
}
