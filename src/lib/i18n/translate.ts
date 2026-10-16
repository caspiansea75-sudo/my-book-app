import { EXACT, PATTERNS } from "@/lib/i18n/dict";
import { AUTH_EXACT } from "@/lib/i18n/dict-auth";
import { CHAT_EXACT } from "@/lib/i18n/dict-chat";
import { GALLERY_EXACT, GALLERY_PATTERNS } from "@/lib/i18n/dict-gallery";
import { LIBRARY_EXACT, LIBRARY_PATTERNS } from "@/lib/i18n/dict-library";
import { STUDIO_EXACT } from "@/lib/i18n/dict-studio";
import { FIXES_EXACT, FIXES_PATTERNS } from "@/lib/i18n/dict-fixes";
import { FX_EXACT } from "@/lib/i18n/dict-fx";

const PATTERN_LIST = [...GALLERY_PATTERNS, ...LIBRARY_PATTERNS, ...PATTERNS, ...FIXES_PATTERNS].map(([src, en]) => [new RegExp(src), en] as const);
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

const DICTS = [FX_EXACT, AUTH_EXACT, GALLERY_EXACT, LIBRARY_EXACT, STUDIO_EXACT, CHAT_EXACT, EXACT, FIXES_EXACT];
const has = Object.prototype.hasOwnProperty;
function exact(core: string): string | null {
  for (const d of DICTS) if (has.call(d, core)) return d[core];
  return null;
}

function lookup(core: string): string | null {
  const hit = exact(core);
  if (hit != null) return hit;
  // "…;" "…," "…:" after a translated phrase
  const last = core.slice(-1);
  const head = ";,".includes(last) ? exact(core.slice(0, -1)) : null;
  if (head != null) return head + last;
  for (const [rx, en] of PATTERN_LIST) {
    const p = rx.exec(core);
    if (p) return en.replace(/\{(\d)\}/g, (_, n) => number(p[Number(n)] ?? ""));
  }
  return NUMERIC.test(core) && /[০-৯]/.test(core) ? toLatinDigits(core) : null;
}
