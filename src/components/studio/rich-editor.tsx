import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { KeyboardEvent, ClipboardEvent } from "react";
import type { ParaAlign, TextRun } from "@/lib/book";
import {
  allInRange,
  applyToRange,
  domToRuns,
  getOffsets,
  insertText,
  normalizeRuns,
  removeRange,
  runsToHtml,
  runsToText,
  setOffsets,
} from "@/lib/rich";
import { effectClass } from "@/lib/text-style";
import { cn } from "@/lib/utils";

export type FormatCmd =
  | { k: "b" }
  | { k: "i" }
  | { k: "u" }
  | { k: "c"; v?: string }
  | { k: "fx"; id: string }
  | { k: "clear" }
  | { k: "quote" }
  | { k: "dash" };

export type RichHandle = {
  hasSelection: () => boolean;
  /** Applies to the selected text, or to the whole paragraph when nothing is selected. */
  format: (cmd: FormatCmd, opts?: { selectionOnly?: boolean }) => boolean;
  focusAt: (pos: "start" | "end" | number) => void;
  select: (start: number, end: number) => void;
};

type Props = {
  runs: TextRun[];
  readOnly?: boolean;
  bare?: boolean;
  color?: string;
  effects?: string[];
  align?: ParaAlign;
  placeholder?: string;
  onChange: (runs: TextRun[]) => void;
  onSplit: (head: TextRun[], tail: TextRun[]) => void;
  onPasteParts: (head: TextRun[], rest: string[], tail: TextRun[]) => void;
  onBackspaceStart: () => void;
  onSceneBreak: () => void;
};

export const RichEditor = forwardRef<RichHandle, Props>(function RichEditor(props, ref) {
  const { runs, readOnly, bare, color, effects, align, placeholder } = props;
  const el = useRef<HTMLDivElement>(null);
  const lastSig = useRef<string | null>(null);
  const lastSel = useRef<[number, number] | null>(null);
  const cb = useRef(props);
  cb.current = props;

  function readRuns(): TextRun[] {
    const node = el.current;
    if (!node || node.textContent === "") return [];
    return domToRuns(node);
  }

  function paint(next: TextRun[]) {
    const node = el.current;
    if (node) node.innerHTML = runsToHtml(next);
  }

  // Sync the DOM only when the text was changed from outside (undo, restore, replace…).
  useLayoutEffect(() => {
    const sig = JSON.stringify(runs);
    if (sig !== lastSig.current) {
      paint(runs);
      lastSig.current = sig;
      lastSel.current = null;
    }
  }, [runs]);

  useEffect(() => {
    function onSel() {
      const node = el.current;
      if (!node || document.activeElement !== node) return;
      const o = getOffsets(node);
      lastSel.current = o && o[0] !== o[1] ? o : null;
    }
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  function currentSel(): [number, number] | null {
    const node = el.current;
    if (!node) return null;
    const live = document.activeElement === node ? getOffsets(node) : null;
    const sel = live ?? lastSel.current;
    return sel && sel[0] !== sel[1] ? sel : null;
  }

  function commit(next: TextRun[], sel?: [number, number]) {
    const norm = normalizeRuns(next);
    lastSig.current = JSON.stringify(norm);
    paint(norm);
    const node = el.current;
    if (sel && node) {
      node.focus();
      setOffsets(node, sel[0], sel[1]);
      lastSel.current = sel[0] !== sel[1] ? sel : null;
    }
    cb.current.onChange(norm);
  }

  function format(cmd: FormatCmd, opts?: { selectionOnly?: boolean }): boolean {
    const node = el.current;
    if (!node || cb.current.readOnly) return false;
    const sel = currentSel();
    if (!sel && opts?.selectionOnly) return false;
    const cur = readRuns();
    const text = runsToText(cur);
    const [s, e] = sel ?? [0, text.length];
    let next = cur;
    let newSel: [number, number] | undefined = sel ?? undefined;

    switch (cmd.k) {
      case "b":
      case "i":
      case "u": {
        const k = cmd.k;
        const on = allInRange(cur, s, e, (st) => Boolean(st[k]));
        next = applyToRange(cur, s, e, (st) => ({ ...st, [k]: !on }) as typeof st);
        break;
      }
      case "c":
        next = applyToRange(cur, s, e, (st) => ({ ...st, c: cmd.v }));
        break;
      case "fx": {
        const on = allInRange(cur, s, e, (st) => Boolean(st.fx?.includes(cmd.id)));
        next = applyToRange(cur, s, e, (st) => ({
          ...st,
          fx: on ? (st.fx ?? []).filter((x) => x !== cmd.id) : [...(st.fx ?? []), cmd.id],
        }));
        break;
      }
      case "clear":
        next = applyToRange(cur, s, e, () => ({}));
        break;
      case "quote": {
        const wrapped = e - s >= 2 && text[s] === "“" && text[e - 1] === "”";
        if (wrapped) {
          next = removeRange(removeRange(cur, e - 1, e), s, s + 1);
          if (newSel) newSel = [s, e - 2];
        } else {
          next = insertText(insertText(cur, e, "”"), s, "“");
          if (newSel) newSel = [s, e + 2];
        }
        break;
      }
      case "dash": {
        if (text.startsWith("― ")) {
          next = removeRange(cur, 0, 2);
          if (newSel) newSel = [Math.max(0, s - 2), Math.max(0, e - 2)];
        } else {
          next = insertText(cur, 0, "― ");
          if (newSel) newSel = [s + 2, e + 2];
        }
        break;
      }
    }
    commit(next, newSel);
    return true;
  }

  function focusAt(pos: "start" | "end" | number) {
    const node = el.current;
    if (!node) return;
    node.focus();
    const total = runsToText(readRuns()).length;
    const at = pos === "start" ? 0 : pos === "end" ? total : Math.min(pos, total);
    setOffsets(node, at, at);
    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function select(start: number, end: number) {
    const node = el.current;
    if (!node) return;
    node.focus();
    setOffsets(node, start, end);
    lastSel.current = start !== end ? [start, end] : null;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  useImperativeHandle(ref, () => ({ hasSelection: () => Boolean(currentSel()), format, focusAt, select }), []);

  /** Cuts everything after the caret out of the editor and returns [head, tail]. */
  function splitAtCaret(): { head: TextRun[]; tail: TextRun[] } | null {
    const node = el.current;
    const sel = window.getSelection();
    if (!node || !sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!node.contains(range.endContainer)) return null;
    if (!range.collapsed) range.deleteContents();
    const tailRange = document.createRange();
    tailRange.setStart(range.endContainer, range.endOffset);
    tailRange.setEnd(node, node.childNodes.length);
    const frag = tailRange.extractContents();
    const tail = domToRuns(frag);
    const head = readRuns();
    lastSig.current = JSON.stringify(head);
    return { head, tail };
  }

  function insertPlain(text: string) {
    const sel = window.getSelection();
    const node = el.current;
    if (!sel || !sel.rangeCount || !node) return;
    const range = sel.getRangeAt(0);
    if (!node.contains(range.endContainer)) return;
    range.deleteContents();
    const tn = document.createTextNode(text);
    range.insertNode(tn);
    range.setStartAfter(tn);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function onInput() {
    const node = el.current;
    if (!node) return;
    if (node.textContent === "" && node.innerHTML !== "") node.innerHTML = "";
    const next = readRuns();
    lastSig.current = JSON.stringify(next);
    cb.current.onChange(next);
  }

  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    if (cb.current.readOnly) return;
    if (ev.nativeEvent.isComposing || ev.keyCode === 229) return;
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && !ev.shiftKey && !ev.altKey) {
      const k = ev.key.toLowerCase();
      if (k === "b" || k === "i" || k === "u") {
        ev.preventDefault();
        format({ k });
        return;
      }
    }
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      if (mod) {
        cb.current.onSceneBreak();
        return;
      }
      const parts = splitAtCaret();
      if (parts) cb.current.onSplit(parts.head, parts.tail);
      return;
    }
    if (ev.key === "Backspace") {
      const node = el.current;
      const o = node ? getOffsets(node) : null;
      if (o && o[0] === 0 && o[1] === 0) {
        ev.preventDefault();
        cb.current.onBackspaceStart();
      }
    }
  }

  function onPaste(ev: ClipboardEvent<HTMLDivElement>) {
    if (cb.current.readOnly) return;
    ev.preventDefault();
    const raw = ev.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    if (!raw.trim()) return;
    const parts = raw
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length <= 1) {
      insertPlain(parts[0] ?? raw.trim());
      onInput();
      return;
    }
    insertPlain(parts[0]!);
    const cut = splitAtCaret();
    if (cut) cb.current.onPasteParts(cut.head, parts.slice(1), cut.tail);
  }

  return (
    <div
      ref={el}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={cn(
        "field-input rich-edit min-h-28 font-display leading-relaxed",
        bare && "rich-bare",
        readOnly && "cursor-not-allowed opacity-70",
        effectClass(effects),
      )}
      style={{ color: color || undefined, textAlign: align }}
    />
  );
});
