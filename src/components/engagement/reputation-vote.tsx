import { useEffect, useRef, useState } from "react";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { castVote, getReputation, type Reputation } from "@/lib/engagement-api";
import { formatCount } from "@/lib/book";
import { cn } from "@/lib/utils";

const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : "কিছু ভুল হয়েছে");

/** Reputation of a whole story or manga series: members vote up or down, once each. */
export function ReputationVote({ kind, parent, className }: { kind: "story" | "manga"; parent: string; className?: string }) {
  const [rep, setRep] = useState<Reputation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setRep(null);
    setError(null);
    getReputation({ data: { kind, parent } })
      .then((r) => mine === seq.current && setRep(r))
      .catch(() => undefined);
    return () => {
      seq.current++;
    };
  }, [kind, parent]);

  async function vote(dir: 1 | -1) {
    if (!rep || busy || !rep.canVote) return;
    const next = rep.mine === dir ? 0 : dir; // tapping your own vote again takes it back
    const before = rep;
    // Show the change straight away, then let the server have the final say.
    const up = before.up - (before.mine === 1 ? 1 : 0) + (next === 1 ? 1 : 0);
    const down = before.down - (before.mine === -1 ? 1 : 0) + (next === -1 ? 1 : 0);
    setRep({ ...before, mine: next, up, down, score: up - down });
    setBusy(true);
    setError(null);
    try {
      setRep(await castVote({ data: { kind, parent, value: next } }));
    } catch (e) {
      setRep(before);
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  const score = rep?.score ?? 0;
  const locked = !rep || !rep.canVote;
  const btn = "pressable grid size-9 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className={cn("font-sans", className)}>
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-1.5 py-1" role="group" aria-label="সুনাম">
        <button
          type="button"
          onClick={() => void vote(1)}
          disabled={locked}
          aria-pressed={rep?.mine === 1}
          aria-label="উপরে ভোট"
          title={rep && !rep.canVote ? "নিজের লেখায় ভোট দেওয়া যায় না" : "ভালো লাগলে উপরে ভোট দিন"}
          className={cn(btn, rep?.mine === 1 ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}
        >
          <ArrowBigUp className={cn("size-5", rep?.mine === 1 && "fill-current")} strokeWidth={1.75} />
        </button>
        <span className="min-w-[2.5rem] text-center">
          <span className={cn("block text-sm font-semibold leading-none", score < 0 ? "text-nsfw" : score > 0 ? "text-lamp" : "text-fg")}>
            {score < 0 ? "−" : ""}
            {formatCount(Math.abs(score))}
          </span>
          <span className="mt-0.5 block text-[10px] leading-none text-subtle">সুনাম</span>
        </span>
        <button
          type="button"
          onClick={() => void vote(-1)}
          disabled={locked}
          aria-pressed={rep?.mine === -1}
          aria-label="নিচে ভোট"
          title={rep && !rep.canVote ? "নিজের লেখায় ভোট দেওয়া যায় না" : "পছন্দ না হলে নিচে ভোট দিন"}
          className={cn(btn, rep?.mine === -1 ? "bg-nsfw/20 text-nsfw" : "text-muted hover:text-fg")}
        >
          <ArrowBigDown className={cn("size-5", rep?.mine === -1 && "fill-current")} strokeWidth={1.75} />
        </button>
      </div>
      {rep ? (
        <span className="ml-3 text-[11px] text-subtle" title="উপরে ও নিচে ভোট">
          ▲ {formatCount(rep.up)} · ▼ {formatCount(rep.down)}
        </span>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-nsfw">
          {error}
        </p>
      ) : null}
    </div>
  );
}
