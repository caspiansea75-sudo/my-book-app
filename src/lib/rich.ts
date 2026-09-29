import type { TextRun } from "@/lib/book";
import { TEXT_EFFECTS } from "@/lib/text-style";

export type Style = Omit<TextRun, "t">;
type Ch = { ch: string; st: Style };

const EFFECT_IDS: string[] = TEXT_EFFECTS.map((f) => f.id);

export function runsToText(runs: TextRun[] | undefined): string {
  return (runs ?? []).map((r) => r.t).join("");
}

export function textToRuns(text: string): TextRun[] {
  return text ? [{ t: text }] : [];
}

export function hasStyledRuns(runs: TextRun[]): boolean {
  return runs.some((r) => r.b || r.i || r.u || r.c || (r.fx && r.fx.length));
}

function styleKey(s: Style): string {
  return [s.b ? 1 : 0, s.i ? 1 : 0, s.u ? 1 : 0, s.c ?? "", [...(s.fx ?? [])].sort().join(",")].join("|");
}

function cleanStyle(s: Style): Style {
  const out: Style = {};
  if (s.b) out.b = true;
  if (s.i) out.i = true;
  if (s.u) out.u = true;
  if (s.c) out.c = s.c;
  if (s.fx && s.fx.length) out.fx = [...new Set(s.fx)];
  return out;
}

function expand(runs: TextRun[]): Ch[] {
  const out: Ch[] = [];
  for (const r of runs) {
    const st = cleanStyle(r);
    for (const ch of r.t.split("")) out.push({ ch, st });
  }
  return out;
}

function compress(chars: Ch[]): TextRun[] {
  const out: TextRun[] = [];
  let lastKey = "";
  for (const { ch, st } of chars) {
    const key = styleKey(st);
    if (out.length && key === lastKey) {
      out[out.length - 1]!.t += ch;
    } else {
      out.push({ t: ch, ...cleanStyle(st) });
      lastKey = key;
    }
  }
  return out;
}

export function normalizeRuns(runs: TextRun[]): TextRun[] {
  return compress(expand(runs));
}

export function applyToRange(
  runs: TextRun[],
  start: number,
  end: number,
  fn: (s: Style) => Style,
): TextRun[] {
  const chars = expand(runs);
  for (let k = Math.max(0, start); k < Math.min(end, chars.length); k++) {
    chars[k]!.st = cleanStyle(fn(chars[k]!.st));
  }
  return compress(chars);
}

export function allInRange(
  runs: TextRun[],
  start: number,
  end: number,
  pred: (s: Style) => boolean,
): boolean {
  const chars = expand(runs);
  const s = Math.max(0, start);
  const e = Math.min(end, chars.length);
  if (e <= s) return false;
  for (let k = s; k < e; k++) if (!pred(chars[k]!.st)) return false;
  return true;
}

export function insertText(runs: TextRun[], pos: number, text: string): TextRun[] {
  const chars = expand(runs);
  const neighbour = chars[pos - 1] ?? chars[pos];
  const st = neighbour ? neighbour.st : {};
  chars.splice(pos, 0, ...text.split("").map((ch) => ({ ch, st })));
  return compress(chars);
}

export function removeRange(runs: TextRun[], start: number, end: number): TextRun[] {
  const chars = expand(runs);
  chars.splice(start, Math.max(0, end - start));
  return compress(chars);
}

export function concatRuns(a: TextRun[], b: TextRun[]): TextRun[] {
  return normalizeRuns([...a, ...b]);
}

/** Non-overlapping start offsets of `find` inside `text`. */
export function findMatches(text: string, find: string): number[] {
  if (!find) return [];
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf(find, from);
    if (at < 0) break;
    out.push(at);
    from = at + find.length;
  }
  return out;
}

export function replaceMatches(
  runs: TextRun[],
  find: string,
  repl: string,
  only?: number,
): { runs: TextRun[]; count: number } {
  const text = runsToText(runs);
  const at = findMatches(text, find);
  if (!at.length) return { runs, count: 0 };
  const chars = expand(runs);
  const out: Ch[] = [];
  let cursor = 0;
  let count = 0;
  for (const m of at) {
    if (only != null && m !== only) continue;
    out.push(...chars.slice(cursor, m));
    const st = chars[m]!.st;
    out.push(...repl.split("").map((ch) => ({ ch, st })));
    cursor = m + find.length;
    count += 1;
  }
  out.push(...chars.slice(cursor));
  return { runs: compress(out), count };
}

/* ---------- DOM <-> runs (client only) ---------- */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function runsToHtml(runs: TextRun[]): string {
  return runs
    .map((r) => {
      const inner = esc(r.t).replace(/\n/g, "<br>");
      const styled = r.b || r.i || r.u || r.c || (r.fx && r.fx.length);
      if (!styled) return inner;
      const css: string[] = [];
      if (r.b) css.push("font-weight:700");
      if (r.i) css.push("font-style:italic");
      if (r.u) css.push("text-decoration:underline");
      if (r.c) css.push(`color:${r.c}`);
      const cls = ["tx-inl", ...(r.fx ?? []).filter((f) => EFFECT_IDS.includes(f)).map((f) => `tx-${f}`)];
      return `<span class="${cls.join(" ")}" style="${css.join(";")}">${inner}</span>`;
    })
    .join("");
}

function rgbToHex(v: string): string | undefined {
  const m = v.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) {
    return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  }
  if (/^#[0-9a-f]{3,8}$/i.test(v.trim())) return v.trim().toLowerCase();
  return undefined;
}

export function domToRuns(root: Node): TextRun[] {
  const pieces: TextRun[] = [];
  const push = (t: string, st: Style) => {
    if (t) pieces.push({ t, ...cleanStyle(st) });
  };
  const lastText = () => pieces.map((p) => p.t).join("");

  const walk = (node: Node, st: Style) => {
    if (node.nodeType === 3) {
      push((node as Text).data.replace(/\u200b/g, "").replace(/\u00a0/g, " "), st);
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    let next = st;
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === "br") {
        push("\n", st);
        return;
      }
      if ((tag === "div" || tag === "p") && pieces.length && !lastText().endsWith("\n")) {
        push("\n", st);
      }
      next = { ...st, fx: [...(st.fx ?? [])] };
      if (tag === "b" || tag === "strong") next.b = true;
      if (tag === "i" || tag === "em") next.i = true;
      if (tag === "u") next.u = true;
      const s = el.style;
      if (s) {
        const fw = s.fontWeight;
        if (fw === "bold" || (fw && Number(fw) >= 600)) next.b = true;
        if (s.fontStyle === "italic") next.i = true;
        if ((s.textDecorationLine || s.textDecoration || "").includes("underline")) next.u = true;
        if (s.color) {
          const hex = rgbToHex(s.color);
          if (hex) next.c = hex;
        }
      }
      const attrColor = el.getAttribute("color");
      if (attrColor) {
        const hex = rgbToHex(attrColor);
        if (hex) next.c = hex;
      }
      el.classList.forEach((cls) => {
        const id = cls.startsWith("tx-") ? cls.slice(3) : "";
        if (id && EFFECT_IDS.includes(id) && !next.fx!.includes(id)) next.fx!.push(id);
      });
    }
    node.childNodes.forEach((c) => walk(c, next));
  };
  walk(root, {});
  return normalizeRuns(pieces);
}

function lengthOf(n: Node): number {
  if (n.nodeType === 3) return (n as Text).data.length;
  if (n.nodeName === "BR") return 1;
  let total = 0;
  n.childNodes.forEach((c) => (total += lengthOf(c)));
  return total;
}

export function offsetOf(root: Node, node: Node, off: number): number {
  let total = 0;
  let found = false;
  const walk = (n: Node) => {
    if (found) return;
    if (n === node) {
      if (n.nodeType === 3) total += off;
      else for (let k = 0; k < off; k++) total += lengthOf(n.childNodes[k]!);
      found = true;
      return;
    }
    if (n.nodeType === 3) {
      total += (n as Text).data.length;
      return;
    }
    if (n.nodeName === "BR") {
      total += 1;
      return;
    }
    n.childNodes.forEach((c) => walk(c));
  };
  walk(root);
  return total;
}

function locate(root: Node, pos: number): [Node, number] {
  let remaining = pos;
  let result: [Node, number] | null = null;
  const walk = (n: Node) => {
    if (result) return;
    if (n.nodeType === 3) {
      const len = (n as Text).data.length;
      if (remaining <= len) result = [n, remaining];
      else remaining -= len;
      return;
    }
    if (n.nodeName === "BR") {
      if (remaining <= 0) {
        const parent = n.parentNode!;
        result = [parent, Array.prototype.indexOf.call(parent.childNodes, n)];
      } else remaining -= 1;
      return;
    }
    n.childNodes.forEach((c) => walk(c));
  };
  walk(root);
  return result ?? [root, root.childNodes.length];
}

export function setOffsets(root: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const [sn, so] = locate(root, start);
  const [en, eo] = locate(root, end);
  const range = document.createRange();
  range.setStart(sn, so);
  range.setEnd(en, eo);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function getOffsets(root: HTMLElement): [number, number] | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  return [offsetOf(root, r.startContainer, r.startOffset), offsetOf(root, r.endContainer, r.endOffset)];
}
