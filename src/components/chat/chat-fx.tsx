import { useState, type ReactNode } from "react";
import "@/components/chat/chat-fx.css";

/* ---------- text effects: start a message with /shake, /rainbow ... ---------- */

export const EFFECTS = [
  { cmd: "shake", hint: "কাঁপবে" },
  { cmd: "rainbow", hint: "রংধনু" },
  { cmd: "glow", hint: "জ্বলজ্বল" },
  { cmd: "wave", hint: "ঢেউ" },
  { cmd: "spin", hint: "ঘুরবে" },
  { cmd: "blink", hint: "মিটমিট" },
  { cmd: "type", hint: "টাইপ হবে" },
  { cmd: "big", hint: "বড়" },
  { cmd: "tiny", hint: "ছোট" },
  { cmd: "whisper", hint: "ফিসফিস" },
  { cmd: "spoiler", hint: "ক্লিক করলে দেখা যাবে" },
] as const;

const EFFECT_SET = new Set<string>(EFFECTS.map((e) => e.cmd));

export function parseEffect(body: string): { effect: string | null; text: string } {
  const m = /^\/([a-z]+)\s+([\s\S]+)$/.exec(body);
  if (m && EFFECT_SET.has(m[1])) return { effect: m[1], text: m[2] };
  return { effect: null, text: body };
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u;
export const isEmojiOnly = (s: string) => EMOJI_ONLY.test(s.trim());

function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment);
  return Array.from(s);
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: ReactNode[] = [];
  let at = 0;
  for (;;) {
    const hit = lower.indexOf(needle, at);
    if (hit < 0) break;
    if (hit > at) out.push(text.slice(at, hit));
    out.push(
      <mark key={hit} className="cx-hit">
        {text.slice(hit, hit + needle.length)}
      </mark>,
    );
    at = hit + needle.length;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

/** Renders a message body with its effect (if any). */
export function MsgText({ body, q = "" }: { body: string; q?: string }) {
  const [open, setOpen] = useState(false);
  if (isEmojiOnly(body)) return <span className="cx-bigemoji">{body}</span>;
  const { effect, text } = parseEffect(body);
  const inner = <Highlight text={text} q={q} />;
  switch (effect) {
    case "wave":
      return (
        <span className="fx-wave" aria-label={text}>
          {graphemes(text).map((g, k) => (
            <span key={k} style={{ ["--k" as string]: k }} aria-hidden="true">
              {g === " " ? "\u00a0" : g}
            </span>
          ))}
        </span>
      );
    case "spoiler":
      return (
        <span
          className="fx-spoiler"
          data-open={open}
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        >
          {inner}
        </span>
      );
    case null:
      return inner;
    default:
      return <span className={`fx-${effect}`}>{inner}</span>;
  }
}

/* ---------- particles ---------- */

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function layer(html: string, ms: number) {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.createElement("div");
  el.className = "cx-fly-layer";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = html;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), ms);
}

export function confetti() {
  const bits = ["🎉", "🎊", "✨", "⭐", "💫"];
  let h = "";
  for (let i = 0; i < 46; i++) {
    h += `<span class="cx-p" style="--x:${rand(0, 100)}%;--s:${rand(16, 30)}px;--d:${rand(1.8, 3.2)}s;--dx:${rand(-120, 120)}px;--rot:${rand(-540, 540)}deg;animation-delay:${rand(0, 0.6)}s">${bits[i % bits.length]}</span>`;
  }
  layer(h, 4200);
}

export function hearts(emoji = "❤️") {
  let h = "";
  for (let i = 0; i < 22; i++) {
    h += `<span class="cx-h" style="--x:${rand(5, 92)}%;--by:${rand(0, 30)}%;--s:${rand(18, 40)}px;--d:${rand(1.6, 2.8)}s;--dx:${rand(-60, 60)}px;animation-delay:${rand(0, 0.5)}s">${emoji}</span>`;
  }
  layer(h, 3600);
}

export function emojiRain(emoji: string) {
  let h = "";
  for (let i = 0; i < 30; i++) {
    h += `<span class="cx-p" style="--x:${rand(0, 100)}%;--s:${rand(18, 32)}px;--d:${rand(2, 3.4)}s;--dx:${rand(-40, 40)}px;--rot:${rand(-200, 200)}deg;animation-delay:${rand(0, 0.8)}s">${emoji}</span>`;
  }
  layer(h, 4600);
}

/** A little heart where you double-tapped. */
export function heartAt(x: number, y: number) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.createElement("div");
  el.className = "cx-heart";
  el.textContent = "❤️";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 950);
}

/** Look at a message and fire a matching celebration. */
export function reactToText(body: string) {
  if (/🎉|🎊|congrat|happy birthday|অভিনন্দন|শুভ জন্মদিন/i.test(body)) confetti();
  else if (/❤|😍|🥰|💖|💕|ভালোবাসি/.test(body)) hearts(/💖|💕/.test(body) ? "💖" : "❤️");
  else if (/🔥/.test(body)) emojiRain("🔥");
  else if (/❄|⛄|snow|তুষার/i.test(body)) emojiRain("❄️");
  else if (/🌸/.test(body)) emojiRain("🌸");
}
