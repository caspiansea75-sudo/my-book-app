import type { CSSProperties } from "react";
import "@/components/media/media-effects.css";

/** Title words that fade in from a blur, then a warm light drifts across them. */
export function FxWords({ text }: { text: string }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      {text.split(" ").map((word, i) => (
        <span key={i} aria-hidden="true" className="mf-word" style={{ "--w": i } as CSSProperties}>
          {word}
        </span>
      ))}
    </>
  );
}

/** Soft lamp glow behind the page header. Put it first inside a `mf-page` main. */
export function FxAurora() {
  return <div className="mf-aurora" aria-hidden="true" />;
}

/** Stagger index for `mf-rise` cards. */
export function fxIndex(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}
