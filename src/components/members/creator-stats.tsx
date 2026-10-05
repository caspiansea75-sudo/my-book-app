import { Link } from "@tanstack/react-router";
import { Award, BarChart3, BookOpen, Eye, Heart, Images, MessageCircle } from "lucide-react";
import { StatsLine } from "@/components/engagement/stats-line";
import { formatCount } from "@/lib/book";
import type { CreatorStats, CreatorWork } from "@/lib/social-api";

/**
 * "লেখকের পরিসংখ্যান" — on a profile: how a member's stories and manga are doing
 * (views, likes, comments, votes). Renders nothing for someone who has made neither.
 */
export function CreatorStatsSection({ stats }: { stats: CreatorStats }) {
  if (stats.works.length === 0) return null;
  const { totals } = stats;
  const net = totals.up - totals.down;
  const tiles = [
    { Icon: Eye, label: "ভিউ", n: totals.views },
    { Icon: Heart, label: "পছন্দ", n: totals.likes },
    { Icon: MessageCircle, label: "মন্তব্য", n: totals.comments },
  ];

  return (
    <section aria-labelledby="creator-stats-title" className="mt-12">
      <p className="flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
        <BarChart3 className="size-4" strokeWidth={1.6} aria-hidden="true" />
        <span id="creator-stats-title">লেখকের পরিসংখ্যান</span>
      </p>
      <p className="mt-2 font-sans text-sm text-muted">সব অধ্যায় মিলিয়ে ভিউ, পছন্দ, মন্তব্য ও ভোট</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ Icon, label, n }) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <span className="flex items-center gap-1.5 font-sans text-xs text-muted">
              <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </span>
            <span className="mt-1 block font-display text-2xl font-semibold text-fg">{formatCount(n)}</span>
          </div>
        ))}
        <div className="rounded-xl border border-border bg-surface p-4">
          <span className="flex items-center gap-1.5 font-sans text-xs text-muted">
            <Award className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>ভোট</span>
          </span>
          <span className={net < 0 ? "mt-1 block font-display text-2xl font-semibold text-nsfw" : "mt-1 block font-display text-2xl font-semibold text-fg"}>
            {net < 0 ? "−" : ""}
            {formatCount(Math.abs(net))}
          </span>
          <span className="mt-0.5 flex items-center gap-2 font-sans text-[11px] text-subtle">
            <span title="উপরে ভোট">
              ▲ <span>{formatCount(totals.up)}</span>
            </span>
            <span title="নিচে ভোট">
              ▼ <span>{formatCount(totals.down)}</span>
            </span>
          </span>
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {stats.works.map((w) => (
          <WorkRow key={`${w.kind}:${w.slug}`} work={w} />
        ))}
      </ul>
    </section>
  );
}

function WorkRow({ work: w }: { work: CreatorWork }) {
  const cover = (
    <span className="grid aspect-[3/4] w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2 text-lamp">
      {w.coverUrl ? (
        <img src={w.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : w.kind === "story" ? (
        <BookOpen className="size-5" strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Images className="size-5" strokeWidth={1.5} aria-hidden="true" />
      )}
    </span>
  );
  const body = (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-sans text-sm text-fg">{w.title}</span>
      <span className="mt-0.5 block font-sans text-xs text-subtle">
        <span>{w.kind === "story" ? "গল্প" : "মাঙ্গা"}</span> · <span>{formatCount(w.chapters)}</span> <span>অধ্যায়</span>
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <StatsLine
          size="xs"
          stats={{ views: w.views, likes: w.likes, comments: w.comments, score: w.up - w.down }}
        />
        <span className="inline-flex items-center gap-2 font-sans text-[11px] text-subtle">
          <span title="উপরে ভোট">
            ▲ <span>{formatCount(w.up)}</span>
          </span>
          <span title="নিচে ভোট">
            ▼ <span>{formatCount(w.down)}</span>
          </span>
        </span>
      </span>
    </span>
  );
  const cls = "pressable flex items-start gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-surface-2";
  return (
    <li>
      {w.kind === "story" ? (
        <Link to="/book/$bookSlug" params={{ bookSlug: w.slug }} className={cls}>
          {cover}
          {body}
        </Link>
      ) : (
        <Link to="/manga/$seriesSlug" params={{ seriesSlug: w.slug }} className={cls}>
          {cover}
          {body}
        </Link>
      )}
    </li>
  );
}
