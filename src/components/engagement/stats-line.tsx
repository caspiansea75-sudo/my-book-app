import { useEffect, useState } from "react";
import { Award, Eye, Heart, MessageCircle } from "lucide-react";
import { getContentStats, type ContentStats } from "@/lib/engagement-api";
import { formatCount } from "@/lib/book";
import { cn } from "@/lib/utils";

const ZERO: ContentStats = { views: 0, likes: 0, comments: 0, score: 0 };

/** Views / likes / comments totals for stories or manga (loaded once, from all chapters). */
export function useContentStats(kind: "story" | "manga", parents?: string[]): Record<string, ContentStats> {
  const [stats, setStats] = useState<Record<string, ContentStats>>({});
  const key = parents ? parents.join("|") : "*";
  useEffect(() => {
    let stop = false;
    getContentStats({ data: { kind, parents } })
      .then((s) => !stop && setStats(s))
      .catch(() => undefined);
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, key]);
  return stats;
}

/** 👁 views · ♥ likes · 💬 comments */
export function StatsLine({ stats, className, size = "sm" }: { stats?: ContentStats; className?: string; size?: "xs" | "sm" }) {
  const s = stats ?? ZERO;
  const icon = size === "xs" ? "size-3" : "size-3.5";
  const items = [
    { Icon: Eye, n: s.views, label: "ভিউ" },
    { Icon: Heart, n: s.likes, label: "পছন্দ" },
    { Icon: MessageCircle, n: s.comments, label: "মন্তব্য" },
    { Icon: Award, n: s.score, label: "সুনাম" },
  ] as const;
  return (
    <span className={cn("inline-flex items-center gap-3 font-sans text-muted", size === "xs" ? "text-[11px]" : "text-xs", className)}>
      {items.map(({ Icon, n, label }) => (
        <span key={label} className="inline-flex items-center gap-1" title={label} aria-label={`${label} ${formatCount(n)}`}>
          <Icon className={icon} strokeWidth={1.75} aria-hidden="true" />
          <span className={label === "সুনাম" && n < 0 ? "text-nsfw" : undefined}>
            {n < 0 ? "−" : ""}
            {formatCount(Math.abs(n))}
          </span>
        </span>
      ))}
    </span>
  );
}
