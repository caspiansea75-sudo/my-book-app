import { useEffect, useRef, useState } from "react";
import { EMOJI_GROUPS, loadRecent, saveRecent } from "@/lib/emoji-data";
import { cn } from "@/lib/utils";
import "@/components/chat/chat-fx.css";

/** Tabbed emoji grid. `recent` remembers what was picked (shown on the first tab). */
export function EmojiPicker({
  onPick,
  selected,
  recent = true,
  height = 220,
  className,
}: {
  onPick: (emoji: string) => void;
  selected?: string;
  recent?: boolean;
  height?: number;
  className?: string;
}) {
  const [recents, setRecents] = useState<string[]>([]);
  const [tab, setTab] = useState("smileys");
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recent) return;
    const r = loadRecent();
    setRecents(r);
    if (r.length) setTab("recent");
  }, [recent]);

  useEffect(() => {
    grid.current?.scrollTo({ top: 0 });
  }, [tab]);

  const groups = recent && recents.length ? [{ id: "recent", icon: "🕒", label: "সাম্প্রতিক", emojis: recents }, ...EMOJI_GROUPS] : EMOJI_GROUPS;
  const current = groups.find((g) => g.id === tab) ?? groups[0];

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-1.5 flex gap-0.5 overflow-x-auto pb-1" role="tablist">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={current.id === g.id}
            aria-label={g.label}
            title={g.label}
            onClick={() => setTab(g.id)}
            className={cn("pressable grid size-8 shrink-0 place-items-center rounded-lg text-base", current.id === g.id ? "bg-surface text-fg ring-1 ring-lamp/60" : "opacity-60 hover:bg-surface hover:opacity-100")}
          >
            {g.icon}
          </button>
        ))}
      </div>
      <p className="px-1 pb-1 font-sans text-[11px] text-subtle">{current.label}</p>
      <div ref={grid} style={{ maxHeight: height }} className="grid grid-cols-8 content-start gap-0.5 overflow-y-auto pr-0.5">
        {current.emojis.map((e) => (
          <button
            key={`${current.id}-${e}`}
            type="button"
            onClick={() => {
              onPick(e);
              if (recent) setRecents(saveRecent(e));
            }}
            className={cn("cx-emoji pressable grid aspect-square place-items-center rounded-lg text-xl hover:bg-surface", selected === e && "bg-surface ring-1 ring-lamp")}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
