import { EXACT, PATTERNS } from "@/lib/i18n/dict";
import { CHAT_EXACT } from "@/lib/i18n/dict-chat";
import { STUDIO_EXACT } from "@/lib/i18n/dict-studio";

const PATTERN_LIST = PATTERNS.map(([src, en]) => [new RegExp(src), en] as const);
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const NUMERIC = /^[\s০-৯0-9.,/:–-]+$/;

const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
const number = (s: string) => (NUMERIC.test(s) ? toLatinDigits(s) : s);

/** English for one piece of interface text, or null if there is none. Surrounding spaces are kept. */
export function translateText(text: string): string | null {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (!m || !m[2]) return null;
  const [, lead, core, trail] = m;
  const hit = lookup(core);
  return hit == null ? null : lead + hit + trail;
}

function lookup(core: string): string | null {
  if (core in STUDIO_EXACT) return STUDIO_EXACT[core];
  if (core in CHAT_EXACT) return CHAT_EXACT[core];
  if (core in EXACT) return EXACT[core];
  // "…;" "…," "…:" after a translated phrase
  const last = core.slice(-1);
  if (";,".includes(last) && core.slice(0, -1) in EXACT) return EXACT[core.slice(0, -1)] + last;
  for (const [rx, en] of PATTERN_LIST) {
    const p = rx.exec(core);
    if (p) return en.replace(/\{(\d)\}/g, (_, n) => number(p[Number(n)] ?? ""));
  }
  return NUMERIC.test(core) && /[০-৯]/.test(core) ? toLatinDigits(core) : null;
}
