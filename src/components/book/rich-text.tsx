import { Fragment, type ReactNode } from "react";
import type { Paragraph, TextRun } from "@/lib/book";
import { effectClass } from "@/lib/text-style";
import { cn } from "@/lib/utils";

export function renderRuns(runs: TextRun[]): ReactNode {
  return runs.map((r, idx) => {
    const parts = r.t.split("\n");
    const nodes = parts.map((part, k) => (
      <Fragment key={k}>
        {k > 0 ? <br /> : null}
        {part}
      </Fragment>
    ));
    const styled = r.b || r.i || r.u || r.c || (r.fx && r.fx.length);
    if (!styled) return <Fragment key={idx}>{nodes}</Fragment>;
    return (
      <span
        key={idx}
        className={cn("tx-inl", effectClass(r.fx))}
        style={{
          fontWeight: r.b ? 700 : undefined,
          fontStyle: r.i ? "italic" : undefined,
          textDecoration: r.u ? "underline" : undefined,
          color: r.c || undefined,
        }}
      >
        {nodes}
      </span>
    );
  });
}

/** Paragraph text with the writer's colors, effects, alignment and per-word formatting. */
export function RichText({ para }: { para: Paragraph }) {
  const hasRuns = Boolean(para.runs && para.runs.length);
  if (!hasRuns && !para.color && !para.effects?.length && !para.align) {
    return <>{para.text}</>;
  }
  return (
    <span
      className={cn("block", effectClass(para.effects))}
      style={{ color: para.color || undefined, textAlign: para.align }}
    >
      {hasRuns ? renderRuns(para.runs!) : para.text}
    </span>
  );
}
