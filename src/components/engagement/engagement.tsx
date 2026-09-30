import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/members/avatar";
import {
  addComment,
  deleteComment,
  getEngagement,
  toggleLike,
  type Comment,
  type Engagement as EngagementData,
} from "@/lib/engagement-api";
import { cn } from "@/lib/utils";

type Props = {
  kind: "story" | "manga";
  /** Book slug (story) or series slug (manga). */
  parent: string;
  /** Chapter slug. */
  item: string;
  /** "dark" is for the always-dark manga reader; "theme" follows the site theme. */
  tone?: "theme" | "dark";
};

const TONES = {
  theme: {
    wrap: "border-border",
    title: "text-fg",
    muted: "text-muted",
    btn: "border-border bg-surface text-fg",
    input: "border-border bg-surface text-fg placeholder:text-subtle",
    card: "border-border bg-surface/60",
    send: "bg-accent text-accent-fg",
  },
  dark: {
    wrap: "border-white/10",
    title: "text-white",
    muted: "text-white/50",
    btn: "border-white/15 bg-white/5 text-white",
    input: "border-white/15 bg-white/5 text-white placeholder:text-white/40",
    card: "border-white/10 bg-white/5",
    send: "bg-white text-[#0a0a0a]",
  },
} as const;

const MAX = 1000;

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
}

const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : "কিছু ভুল হয়েছে");

/** Like button + comment thread for one story chapter or manga chapter. */
export function Engagement({ kind, parent, item, tone = "theme" }: Props) {
  const t = TONES[tone];
  const target = { kind, parent, item } as const;
  const [data, setData] = useState<EngagementData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setData(null);
    setError(null);
    setDraft("");
    getEngagement({ data: { kind, parent, item } })
      .then((d) => {
        if (mine === seq.current) setData(d);
      })
      .catch((e: unknown) => {
        if (mine === seq.current) setError(msg(e));
      });
    return () => {
      seq.current++;
    };
  }, [kind, parent, item]);

  async function onLike() {
    if (!data || likeBusy) return;
    const before = data;
    setLikeBusy(true);
    setData({
      ...data,
      liked: !data.liked,
      likeCount: Math.max(0, data.likeCount + (data.liked ? -1 : 1)),
    });
    try {
      const r = await toggleLike({ data: target });
      setData((d) => (d ? { ...d, liked: r.liked, likeCount: r.likeCount } : d));
    } catch (e) {
      setData(before);
      setError(msg(e));
    } finally {
      setLikeBusy(false);
    }
  }

  async function onPost() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    try {
      const c = await addComment({ data: { ...target, body } });
      setData((d) =>
        d ? { ...d, comments: [...d.comments, c], commentCount: d.commentCount + 1 } : d,
      );
      setDraft("");
    } catch (e) {
      setError(msg(e));
    } finally {
      setPosting(false);
    }
  }

  async function onDelete(c: Comment) {
    if (!window.confirm("মন্তব্যটি মুছে ফেলবেন?")) return;
    try {
      await deleteComment({ data: { id: c.id } });
      setData((d) =>
        d
          ? {
              ...d,
              comments: d.comments.filter((x) => x.id !== c.id),
              commentCount: Math.max(0, d.commentCount - 1),
            }
          : d,
      );
    } catch (e) {
      setError(msg(e));
    }
  }

  return (
    <section className={cn("mt-10 border-t pt-6 font-sans", t.wrap)} aria-label="মন্তব্য ও লাইক">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onLike}
          disabled={!data}
          aria-pressed={data?.liked ?? false}
          className={cn(
            "pressable inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm disabled:opacity-50",
            t.btn,
          )}
        >
          <Heart
            className={cn("size-4", data?.liked && "fill-red-500 text-red-500")}
            strokeWidth={1.75}
          />
          <span>{data?.liked ? "পছন্দ করেছেন" : "পছন্দ"}</span>
          <span className={t.muted}>{data?.likeCount ?? 0}</span>
        </button>
        <span className={cn("inline-flex items-center gap-1.5 text-sm", t.muted)}>
          <MessageCircle className="size-4" strokeWidth={1.75} />
          {data?.commentCount ?? 0}
        </span>
      </div>

      <h3 className={cn("mt-6 font-display text-base", t.title)}>মন্তব্য</h3>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void onPost();
            }
          }}
          rows={2}
          placeholder="আপনার মন্তব্য লিখুন…"
          disabled={!data}
          className={cn(
            "min-h-[3.25rem] flex-1 resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50",
            t.input,
          )}
        />
        <button
          type="button"
          onClick={() => void onPost()}
          disabled={!data || posting || !draft.trim()}
          aria-label="মন্তব্য পাঠান"
          className={cn(
            "pressable grid size-11 shrink-0 place-items-center rounded-lg disabled:opacity-40",
            t.send,
          )}
        >
          <Send className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      {!data && !error ? (
        <div className="mt-4 space-y-3">
          <div className="h-14 animate-pulse rounded-lg bg-white/5" />
          <div className="h-14 animate-pulse rounded-lg bg-white/5" />
        </div>
      ) : null}

      {data && data.comments.length === 0 ? (
        <p className={cn("mt-4 text-sm", t.muted)}>এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্যটি আপনিই করুন।</p>
      ) : null}

      {data && data.commentCount > data.comments.length ? (
        <p className={cn("mt-4 text-xs", t.muted)}>শুধু সাম্প্রতিক মন্তব্যগুলো দেখানো হচ্ছে।</p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {data?.comments.map((c) => (
          <li key={c.id} className={cn("flex gap-3 rounded-lg border p-3", t.card)}>
            <Avatar name={c.displayName} url={c.avatarUrl} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <Link
                  to="/u/$username"
                  params={{ username: c.username }}
                  className={cn("truncate text-sm font-medium hover:underline", t.title)}
                >
                  {c.displayName}
                </Link>
                <span className={cn("shrink-0 text-[11px]", t.muted)}>{when(c.createdAt)}</span>
                {c.canDelete ? (
                  <button
                    type="button"
                    onClick={() => void onDelete(c)}
                    aria-label="মন্তব্য মুছুন"
                    className={cn("pressable ml-auto grid size-7 shrink-0 place-items-center rounded-full", t.muted)}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
              <p className={cn("mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed", t.title)}>
                {c.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
