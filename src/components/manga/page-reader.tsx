import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Panel = { kind: "image" | "video"; src: string; caption?: string | null };

/**
 * One panel at a time, fitted to the screen. Tap the sides, swipe, use arrow keys or the
 * buttons. `rtl` flips everything for right-to-left manga. One extra slide at the end
 * holds `end` (chapter navigation).
 */
export function PageReader({
  panels,
  index,
  onIndex,
  rtl,
  paused,
  onZoom,
  end,
  className,
}: {
  panels: Panel[];
  index: number;
  onIndex: (n: number) => void;
  rtl: boolean;
  paused: boolean;
  onZoom: (i: number) => void;
  end: ReactNode;
  className?: string;
}) {
  const total = panels.length;
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = (d: number) => onIndex(Math.max(0, Math.min(total, index + d)));
  const panel = index < total ? panels[index] : null;

  useEffect(() => {
    if (paused) return;
    const step = (d: number) => onIndex(Math.max(0, Math.min(total, index + d)));
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable]")) return;
      if (e.key === "ArrowRight") step(rtl ? -1 : 1);
      else if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, rtl, index, total, onIndex]);

  useEffect(() => {
    for (const p of panels.slice(index + 1, index + 3)) {
      if (p.kind === "image") new Image().src = p.src;
    }
  }, [panels, index]);

  function onTap(e: MouseEvent<HTMLDivElement>) {
    if (!panel) return; // the last slide (comments + chapter links) is not a tap zone
    if ((e.target as HTMLElement).closest("video,a,button,input,textarea")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.3) go(rtl ? 1 : -1);
    else if (x > 0.7) go(rtl ? -1 : 1);
    else if (panel?.kind === "image") onZoom(index);
  }

  const leftIsNext = rtl;
  const shown = Math.min(index + 1, total);

  return (
    <div className={cn("relative flex select-none flex-col", className)} style={{ height: "calc(100dvh - 7rem)" }}>
      <div
        className="relative min-h-0 flex-1"
        onClick={onTap}
        onTouchStart={(e) => {
          const t = e.touches[0];
          const typing = (e.target as HTMLElement).closest("input,textarea");
          touch.current = t && !typing ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          const t = e.changedTouches[0];
          if (!s || !t) return;
          const dx = t.clientX - s.x;
          const dy = t.clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go((rtl ? dx > 0 : dx < 0) ? 1 : -1);
        }}
      >
        <div className="absolute inset-0 grid place-items-center overflow-y-auto p-1">
          {panel ? (
            panel.kind === "image" ? (
              <img
                key={index}
                src={panel.src}
                alt={panel.caption ?? ""}
                draggable={false}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <video key={index} src={panel.src} controls playsInline className="max-h-full max-w-full" />
            )
          ) : (
            <div className="w-full max-w-2xl [align-self:safe_center]">{end}</div>
          )}
        </div>
        {panel?.caption ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-3 py-1.5 text-center font-sans text-xs text-white/70">
            {panel.caption}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => go(leftIsNext ? 1 : -1)}
          disabled={leftIsNext ? index >= total : index <= 0}
          aria-label={leftIsNext ? "পরের পাতা" : "আগের পাতা"}
          className="pressable grid size-11 shrink-0 place-items-center rounded-full text-white/80 disabled:opacity-25"
        >
          <ChevronLeft className="size-6" strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1" dir={rtl ? "rtl" : "ltr"}>
          <div className="h-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white/70 transition-[width] duration-200" style={{ width: `${(shown / Math.max(total, 1)) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-center font-sans text-xs text-white/50">
            {`${shown.toLocaleString("bn-BD")} / ${total.toLocaleString("bn-BD")}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => go(leftIsNext ? -1 : 1)}
          disabled={leftIsNext ? index <= 0 : index >= total}
          aria-label={leftIsNext ? "আগের পাতা" : "পরের পাতা"}
          className="pressable grid size-11 shrink-0 place-items-center rounded-full text-white/80 disabled:opacity-25"
        >
          <ChevronRight className="size-6" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
