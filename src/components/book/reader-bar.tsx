import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  List,
  Minus,
  Plus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { THEMES, useReaderStore, type ThemeId } from "@/lib/reader-store";
import { cn } from "@/lib/utils";

export function ReaderBar({
  bookSlug,
  title,
  onOpenToc,
  prevSlug,
  nextSlug,
}: {
  bookSlug: string;
  title: string;
  onOpenToc: () => void;
  prevSlug?: string;
  nextSlug?: string;
}) {
  const nsfwMode = useReaderStore((s) => s.nsfwMode);
  const showAll = useReaderStore((s) => s.showAllNsfw);
  const hideAll = useReaderStore((s) => s.hideAllNsfw);
  const fontSize = useReaderStore((s) => s.fontSize);
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const theme = useReaderStore((s) => s.theme);
  const setTheme = useReaderStore((s) => s.setTheme);
  const audioOn = useReaderStore((s) => s.audioOn);
  const setAudioOn = useReaderStore((s) => s.setAudioOn);

  const cycleTheme = () => {
    const i = THEMES.findIndex((t) => t.id === theme);
    const next = THEMES[(i + 1) % THEMES.length];
    if (next) setTheme(next.id as ThemeId);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="flex items-center gap-1 px-2 py-1 sm:px-3">
        <button
          type="button"
          onClick={onOpenToc}
          className="pressable grid size-11 shrink-0 place-items-center rounded-md text-fg hover:bg-surface-2 lg:hidden"
          aria-label="সূচিপত্র"
        >
          <List className="size-5" strokeWidth={1.75} />
        </button>

        <Link
          to="/"
          className="pressable flex items-center gap-2 rounded-md px-2 py-2 text-muted hover:text-fg"
        >
          <BookOpen className="size-4" strokeWidth={1.75} />
          <span className="hidden font-display text-sm sm:inline">পটিয়সী</span>
        </Link>

        <p className="min-w-0 flex-1 truncate px-1 text-center font-display text-sm text-fg">
          {title}
        </p>

        <div className="flex items-center">
          {prevSlug ? (
            <Link
              to="/read/$bookSlug/$slug"
              params={{ bookSlug, slug: prevSlug }}
              className="pressable grid size-11 place-items-center rounded-md text-fg hover:bg-surface-2"
              aria-label="আগের আপডেট"
            >
              <ChevronLeft className="size-5" strokeWidth={1.75} />
            </Link>
          ) : (
            <span className="grid size-11 place-items-center text-subtle">
              <ChevronLeft className="size-5" strokeWidth={1.75} />
            </span>
          )}
          {nextSlug ? (
            <Link
              to="/read/$bookSlug/$slug"
              params={{ bookSlug, slug: nextSlug }}
              className="pressable grid size-11 place-items-center rounded-md text-fg hover:bg-surface-2"
              aria-label="পরের আপডেট"
            >
              <ChevronRight className="size-5" strokeWidth={1.75} />
            </Link>
          ) : (
            <span className="grid size-11 place-items-center text-subtle">
              <ChevronRight className="size-5" strokeWidth={1.75} />
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto border-t border-border px-2 py-1 sm:px-3">
        <button
          type="button"
          onClick={nsfwMode === "shown" ? hideAll : showAll}
          className={cn(
            "pressable inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 font-sans text-xs",
            nsfwMode === "shown"
              ? "border-nsfw/40 bg-nsfw/10 text-nsfw"
              : "border-border bg-surface text-muted",
          )}
        >
          {nsfwMode === "shown" ? (
            <Eye className="size-3.5" strokeWidth={1.75} />
          ) : (
            <EyeOff className="size-3.5" strokeWidth={1.75} />
          )}
          {nsfwMode === "shown" ? "সব লুকান" : "সব দেখান"}
        </button>

        <div className="inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-surface">
          <button
            type="button"
            onClick={() => setFontSize(fontSize - 1)}
            className="pressable grid size-10 place-items-center text-muted hover:text-fg"
            aria-label="অক্ষর ছোট"
          >
            <Minus className="size-3.5" strokeWidth={1.75} />
          </button>
          <span className="min-w-8 text-center font-sans text-xs tabular-nums text-muted">
            {fontSize}
          </span>
          <button
            type="button"
            onClick={() => setFontSize(fontSize + 1)}
            className="pressable grid size-10 place-items-center text-muted hover:text-fg"
            aria-label="অক্ষর বড়"
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setAudioOn(!audioOn)}
          className="pressable grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-muted hover:text-fg"
          aria-label={audioOn ? "আওয়াজ বন্ধ" : "লোফাই বৃষ্টি"}
        >
          {audioOn ? (
            <Volume2 className="size-4" strokeWidth={1.75} />
          ) : (
            <VolumeX className="size-4" strokeWidth={1.75} />
          )}
        </button>

        <button
          type="button"
          onClick={cycleTheme}
          className="pressable h-10 shrink-0 rounded-full bg-accent px-3 font-sans text-xs text-accent-fg lg:hidden"
        >
          {THEMES.find((t) => t.id === theme)?.label}
        </button>

        <div className="ml-auto hidden gap-1 lg:flex">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id as ThemeId)}
              className={cn(
                "pressable h-10 shrink-0 rounded-full px-3 font-sans text-xs",
                theme === t.id
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
