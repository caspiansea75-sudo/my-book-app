import { Eye, EyeOff } from "lucide-react";
import type { Paragraph } from "@/lib/book";
import { useReaderStore } from "@/lib/reader-store";

export function SensitiveBlock({
  para,
  fontSize,
}: {
  para: Paragraph;
  fontSize: number;
}) {
  const nsfwMode = useReaderStore((s) => s.nsfwMode);
  const flipped = useReaderStore((s) => s.inverted.includes(para.id));
  const toggle = useReaderStore((s) => s.togglePara);
  const visible = nsfwMode === "shown" ? !flipped : flipped;

  if (!visible) {
    return (
      <div className="nsfw-veil overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          onClick={() => toggle(para.id)}
          className="pressable flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="flex min-w-0 items-center gap-3">
            <EyeOff className="size-4 shrink-0 text-subtle" strokeWidth={1.75} />
            <span className="font-sans text-sm text-muted">
              সংবেদনশীল অংশ লুকানো আছে
            </span>
          </span>
          <span className="shrink-0 font-sans text-xs tracking-wide text-lamp">
            দেখুন
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="nsfw-shown">
      <button
        type="button"
        onClick={() => toggle(para.id)}
        className="pressable absolute -top-1 right-0 z-10 inline-flex items-center gap-1 rounded-full border border-border bg-surface/90 px-2 py-1 font-sans text-xs text-muted"
        aria-label="এই অংশ লুকান"
      >
        <Eye className="size-3" strokeWidth={1.75} />
        লুকান
      </button>
      <p className="nsfw-text pr-16" style={{ fontSize: `${fontSize}px` }}>
        {para.text}
      </p>
    </div>
  );
}
