import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Copy,
  Eraser,
  Eye,
  History,
  ImagePlus,
  Italic,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  Plus,
  Quote,
  Redo2,
  Save,
  Search,
  StickyNote,
  Trash2,
  Type,
  Underline,
  Undo2,
  Video,
  X,
} from "lucide-react";
import type { BookIndex, Chapter, Paragraph, ParaAlign, Section, TextRun } from "@/lib/book";
import { formatCount, newBlockId, padSlug } from "@/lib/book";
import {
  deleteStudioChapter,
  listMedia,
  saveChapterInserts,
  saveStudioChapter,
  type MediaItem,
} from "@/lib/library-api";
import { ChapterBody } from "@/components/book/chapter-body";
import { MediaFigure } from "@/components/book/media-figure";
import { MediaUploader } from "@/components/studio/media-uploader";
import { RichEditor, type FormatCmd, type RichHandle } from "@/components/studio/rich-editor";
import {
  draftKey,
  moveKey,
  noteKey,
  readJson,
  removeKey,
  versionsKey,
  writeJson,
} from "@/lib/editor-storage";
import {
  concatRuns,
  findMatches,
  hasStyledRuns,
  replaceMatches,
  runsToText,
  textToRuns,
} from "@/lib/rich";
import { COLOR_SWATCHES, TEXT_EFFECTS } from "@/lib/text-style";
import { cn } from "@/lib/utils";

type PBlock = {
  key: string;
  type: "p";
  runs: TextRun[];
  nsfw: boolean;
  color?: string;
  effects?: string[];
  align?: ParaAlign;
  originId: string;
};

type Block =
  | PBlock
  | { key: string; type: "break"; originId: string }
  | { key: string; type: "image"; mediaId: number; caption: string; originId: string }
  | { key: string; type: "video"; mediaId?: number; url?: string; caption: string; originId: string };

type Version = {
  at: number;
  note?: string;
  title: string;
  titleEn: string;
  excerpt: string;
  blocks: Block[];
};

type Draft = {
  at: number;
  sig: string;
  title: string;
  titleEn: string;
  excerpt: string;
  blocks: Block[];
};

function newP(runs: TextRun[] = [], extra: Partial<PBlock> = {}): PBlock {
  const id = newBlockId("p");
  return { key: id, type: "p", runs, nsfw: false, originId: id, ...extra };
}

function blocksFromChapter(chapter: Chapter | null): Block[] {
  if (!chapter) return [newP()];
  const out: Block[] = [];
  for (const section of chapter.sections) {
    for (const para of section.paragraphs) {
      if (para.kind === "break") {
        out.push({ key: para.id, type: "break", originId: para.id });
      } else if (para.kind === "image" && para.mediaId) {
        out.push({
          key: para.id,
          type: "image",
          mediaId: para.mediaId,
          caption: para.caption ?? "",
          originId: para.id,
        });
      } else if (para.kind === "video") {
        out.push({
          key: para.id,
          type: "video",
          mediaId: para.mediaId,
          url: para.url,
          caption: para.caption ?? "",
          originId: para.id,
        });
      } else {
        out.push({
          key: para.id,
          type: "p",
          runs: para.runs && para.runs.length ? para.runs : textToRuns(para.text),
          nsfw: para.nsfw,
          color: para.color,
          effects: para.effects,
          align: para.align,
          originId: para.id,
        });
      }
    }
  }
  return out.length ? out : [newP()];
}

function toSections(blocks: Block[]): Section[] {
  const paragraphs: Paragraph[] = blocks.map((block) => {
    if (block.type === "break") {
      return { id: block.originId, kind: "break", text: "", nsfw: false };
    }
    if (block.type === "image") {
      return {
        id: block.originId,
        kind: "image",
        text: "",
        nsfw: false,
        mediaId: block.mediaId,
        caption: block.caption,
      };
    }
    if (block.type === "video") {
      return {
        id: block.originId,
        kind: "video",
        text: "",
        nsfw: false,
        mediaId: block.mediaId,
        url: block.url,
        caption: block.caption,
      };
    }
    return {
      id: block.originId,
      kind: "p",
      text: runsToText(block.runs),
      nsfw: block.nsfw,
      color: block.color,
      effects: block.effects,
      align: block.align,
      runs: hasStyledRuns(block.runs) ? block.runs : undefined,
    };
  });
  return [{ id: "main", title: "", paragraphs }];
}

function sigOf(title: string, titleEn: string, excerpt: string, blocks: Block[]): string {
  const bare = blocks.map((b) => {
    const c = { ...b } as Record<string, unknown>;
    delete c.key;
    delete c.originId;
    return c;
  });
  return JSON.stringify([title, titleEn, excerpt, bare]);
}

function countText(blocks: Block[]): { words: number; chars: number; paras: number } {
  let words = 0;
  let chars = 0;
  let paras = 0;
  for (const b of blocks) {
    if (b.type !== "p") continue;
    const text = runsToText(b.runs);
    if (!text.trim()) continue;
    paras += 1;
    chars += text.replace(/\s/g, "").length;
    words += text.trim().split(/\s+/).filter(Boolean).length;
  }
  return { words, chars, paras };
}

function timeLabel(): string {
  return new Date().toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
}

export function ChapterEditor({
  book,
  chapter,
  slug,
  extra = false,
}: {
  book: BookIndex;
  chapter: Chapter | null;
  slug?: string;
  /** A chapter added from the Studio: fully editable even when the story itself is an original one. */
  extra?: boolean;
}) {
  const navigate = useNavigate();
  const canon = book.origin !== "studio" && !extra;
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [titleEn, setTitleEn] = useState(chapter?.titleEn ?? "");
  const [excerpt, setExcerpt] = useState(chapter?.excerpt ?? "");
  const [blocks, setBlocks] = useState<Block[]>(() => blocksFromChapter(chapter));
  const [picker, setPicker] = useState<number | null>(null);
  const [library, setLibrary] = useState<MediaItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState(false);
  const [focus, setFocus] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [find, setFind] = useState("");
  const [repl, setRepl] = useState("");
  const [cur, setCur] = useState(0);
  const [notes, setNotes] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [status, setStatus] = useState("");
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [hist, setHist] = useState({ u: 0, r: 0 });
  // Draft = only the author and the admin can read it. New chapters start as drafts.
  const [pubStatus, setPubStatus] = useState<"draft" | "published">(chapter?.status ?? (slug ? "published" : "draft"));

  const handles = useRef(new Map<string, RichHandle>());
  const pendingFocus = useRef<{ key: string; pos: "start" | "end" | number } | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const past = useRef<Block[][]>([]);
  const future = useRef<Block[][]>([]);
  const lastCommitted = useRef<Block[]>(blocks);
  const skipHist = useRef(false);
  const savedSig = useRef("");
  if (!savedSig.current) savedSig.current = sigOf(title, titleEn, excerpt, blocks);
  const savedStatus = useRef<"draft" | "published">(pubStatus);
  const firstDraftRun = useRef(true);
  const sigNow = useMemo(() => sigOf(title, titleEn, excerpt, blocks), [title, titleEn, excerpt, blocks]);
  const dirty = sigNow !== savedSig.current || (!canon && pubStatus !== savedStatus.current);

  // Closing the tab or reloading with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mediaIds = useMemo(
    () => new Set(blocks.flatMap((b) => (b.type === "image" || b.type === "video" ? [b.mediaId] : []))),
    [blocks],
  );
  const counts = useMemo(() => countText(blocks), [blocks]);

  /* ---------- history (undo / redo across the whole chapter) ---------- */

  const flush = useCallback(() => {
    if (blocksRef.current === lastCommitted.current) return;
    past.current.push(lastCommitted.current);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    lastCommitted.current = blocksRef.current;
    setHist({ u: past.current.length, r: 0 });
  }, []);

  useEffect(() => {
    if (skipHist.current) {
      skipHist.current = false;
      lastCommitted.current = blocks;
      return;
    }
    const t = setTimeout(flush, 500);
    return () => clearTimeout(t);
  }, [blocks, flush]);

  function undo() {
    flush();
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(blocksRef.current);
    skipHist.current = true;
    lastCommitted.current = prev;
    setBlocks(prev);
    setHist({ u: past.current.length, r: future.current.length });
  }

  function redo() {
    flush();
    const next = future.current.pop();
    if (!next) return;
    past.current.push(blocksRef.current);
    skipHist.current = true;
    lastCommitted.current = next;
    setBlocks(next);
    setHist({ u: past.current.length, r: future.current.length });
  }

  /** Structural change: becomes its own undo step. */
  function mutate(fn: (list: Block[]) => Block[]) {
    flush();
    setBlocks(fn);
  }

  /* ---------- draft auto-save ---------- */

  const dKey = draftKey(book.slug, slug);

  useEffect(() => {
    const d = readJson<Draft>(dKey);
    if (d && d.sig !== savedSig.current && Array.isArray(d.blocks)) setPendingDraft(d);
    setNotes(readJson<string>(noteKey(book.slug, slug)) ?? "");
    if (slug) setVersions(readJson<Version[]>(versionsKey(book.slug, slug)) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstDraftRun.current) {
      firstDraftRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      const sig = sigOf(title, titleEn, excerpt, blocks);
      if (sig === savedSig.current) {
        removeKey(dKey);
        return;
      }
      const draft: Draft = { at: Date.now(), sig, title, titleEn, excerpt, blocks };
      if (writeJson(dKey, draft)) setStatus(`খসড়া সংরক্ষিত ${timeLabel()}`);
    }, 700);
    return () => clearTimeout(t);
  }, [title, titleEn, excerpt, blocks, dKey]);

  function restoreDraft() {
    if (!pendingDraft) return;
    flush();
    setTitle(pendingDraft.title);
    setTitleEn(pendingDraft.titleEn);
    setExcerpt(pendingDraft.excerpt);
    setBlocks(pendingDraft.blocks);
    setPendingDraft(null);
  }

  function discardDraft() {
    removeKey(dKey);
    setPendingDraft(null);
  }

  /* ---------- block operations ---------- */

  function update(i: number, patch: Partial<Block>) {
    setBlocks((list) => list.map((b, idx) => (idx === i ? ({ ...b, ...patch } as Block) : b)));
  }

  function updateKey(key: string, patch: Partial<PBlock>) {
    setBlocks((list) => list.map((b) => (b.key === key && b.type === "p" ? { ...b, ...patch } : b)));
  }

  function insertAt(i: number, block: Block) {
    mutate((list) => {
      const next = [...list];
      next.splice(i, 0, block);
      return next;
    });
  }

  function removeAt(i: number) {
    mutate((list) => list.filter((_, idx) => idx !== i));
  }

  function moveBlock(i: number, dir: -1 | 1) {
    mutate((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function duplicateBlock(i: number) {
    const src = blocksRef.current[i];
    if (!src) return;
    const id = newBlockId(src.type === "image" ? "img" : src.type === "video" ? "vid" : src.type === "break" ? "br" : "p");
    const copy = { ...src, key: id, originId: id } as Block;
    if (copy.type === "p") pendingFocus.current = { key: copy.key, pos: "end" };
    insertAt(i + 1, copy);
  }

  function addParagraphAfter(i: number) {
    const p = newP();
    pendingFocus.current = { key: p.key, pos: "start" };
    insertAt(i + 1, p);
  }

  function setBlockRuns(key: string, runs: TextRun[]) {
    setBlocks((list) => list.map((b) => (b.key === key && b.type === "p" ? { ...b, runs } : b)));
  }

  function splitBlock(key: string, head: TextRun[], tail: TextRun[]) {
    const src = blocksRef.current.find((b) => b.key === key);
    if (!src || src.type !== "p") return;
    const next = newP(tail, { color: src.color, effects: src.effects, align: src.align, nsfw: src.nsfw });
    pendingFocus.current = { key: next.key, pos: "start" };
    mutate((list) => {
      const i = list.findIndex((b) => b.key === key);
      if (i < 0) return list;
      const copy = [...list];
      copy[i] = { ...(copy[i] as PBlock), runs: head };
      copy.splice(i + 1, 0, next);
      return copy;
    });
  }

  function pasteParts(key: string, head: TextRun[], rest: string[], tail: TextRun[]) {
    const src = blocksRef.current.find((b) => b.key === key);
    if (!src || src.type !== "p") return;
    const style = { color: src.color, effects: src.effects, align: src.align, nsfw: src.nsfw };
    const added = rest.map((text, idx) =>
      newP(idx === rest.length - 1 ? concatRuns(textToRuns(text), tail) : textToRuns(text), style),
    );
    const last = added[added.length - 1];
    if (last) pendingFocus.current = { key: last.key, pos: rest[rest.length - 1]!.length };
    mutate((list) => {
      const i = list.findIndex((b) => b.key === key);
      if (i < 0) return list;
      const copy = [...list];
      copy[i] = { ...(copy[i] as PBlock), runs: head };
      copy.splice(i + 1, 0, ...added);
      return copy;
    });
  }

  function backspaceStart(key: string) {
    const list = blocksRef.current;
    const i = list.findIndex((b) => b.key === key);
    const src = list[i];
    if (!src || src.type !== "p") return;
    const prev = list[i - 1];
    const empty = runsToText(src.runs) === "";
    if (empty) {
      if (list.length <= 1) return;
      const next = list[i + 1];
      pendingFocus.current =
        prev && prev.type === "p"
          ? { key: prev.key, pos: "end" }
          : next && next.type === "p"
            ? { key: next.key, pos: "start" }
            : null;
      mutate((l) => l.filter((b) => b.key !== key));
      return;
    }
    if (prev && prev.type === "p") {
      const at = runsToText(prev.runs).length;
      pendingFocus.current = { key: prev.key, pos: at };
      const merged = concatRuns(prev.runs, src.runs);
      mutate((l) =>
        l.filter((b) => b.key !== key).map((b) => (b.key === prev.key ? { ...b, runs: merged } : b)),
      );
    }
  }

  function sceneBreak(key: string) {
    const list = blocksRef.current;
    const i = list.findIndex((b) => b.key === key);
    if (i < 0) return;
    const brId = newBlockId("br");
    const br: Block = { key: brId, type: "break", originId: brId };
    const after = list[i + 1];
    const extra: Block[] = [br];
    if (after && after.type === "p") {
      pendingFocus.current = { key: after.key, pos: "start" };
    } else {
      const p = newP();
      extra.push(p);
      pendingFocus.current = { key: p.key, pos: "start" };
    }
    mutate((l) => {
      const at = l.findIndex((b) => b.key === key);
      if (at < 0) return l;
      const copy = [...l];
      copy.splice(at + 1, 0, ...extra);
      return copy;
    });
  }

  useEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    handles.current.get(p.key)?.focusAt(p.pos);
  }, [blocks]);

  /* ---------- formatting ---------- */

  function fmt(key: string, cmd: FormatCmd) {
    const h = handles.current.get(key);
    if (!h) return;
    const blockLevel = cmd.k === "c" || cmd.k === "fx" || cmd.k === "clear";
    const hadSelection = h.hasSelection();
    const applied = h.format(cmd, { selectionOnly: blockLevel });
    if (cmd.k === "clear" && !hadSelection) {
      h.format(cmd);
      updateKey(key, { color: undefined, effects: undefined, align: undefined });
      return;
    }
    if (applied || !blockLevel) return;
    const src = blocksRef.current.find((b) => b.key === key);
    if (!src || src.type !== "p") return;
    if (cmd.k === "c") updateKey(key, { color: cmd.v });
    if (cmd.k === "fx") {
      const has = (src.effects ?? []).includes(cmd.id);
      updateKey(key, {
        effects: has ? (src.effects ?? []).filter((x) => x !== cmd.id) : [...(src.effects ?? []), cmd.id],
      });
    }
  }

  function setAlign(key: string, align: ParaAlign) {
    const src = blocksRef.current.find((b) => b.key === key);
    if (!src || src.type !== "p") return;
    updateKey(key, { align: src.align === align ? undefined : align });
  }

  /* ---------- find & replace ---------- */

  const matches = useMemo(() => {
    if (!findOpen || !find) return [];
    const out: { key: string; start: number }[] = [];
    for (const b of blocks) {
      if (b.type !== "p") continue;
      for (const at of findMatches(runsToText(b.runs), find)) out.push({ key: b.key, start: at });
    }
    return out;
  }, [blocks, find, findOpen]);

  const matchIdx = matches.length ? ((cur % matches.length) + matches.length) % matches.length : 0;

  function goMatch(dir: 1 | -1) {
    const n = matches.length;
    if (!n) return;
    const ni = (((matchIdx + dir) % n) + n) % n;
    setCur(ni);
    const m = matches[ni]!;
    handles.current.get(m.key)?.select(m.start, m.start + find.length);
  }

  function replaceOne() {
    const m = matches[matchIdx];
    if (!m || canon) return;
    mutate((list) =>
      list.map((b) =>
        b.key === m.key && b.type === "p"
          ? { ...b, runs: replaceMatches(b.runs, find, repl, m.start).runs }
          : b,
      ),
    );
  }

  function replaceAll() {
    if (!find || canon) return;
    let total = 0;
    const next = blocksRef.current.map((b) => {
      if (b.type !== "p") return b;
      const r = replaceMatches(b.runs, find, repl);
      total += r.count;
      return r.count ? { ...b, runs: r.runs } : b;
    });
    if (!total) return;
    mutate(() => next);
    setStatus(`${formatCount(total)} টি বদলানো হয়েছে`);
  }

  /* ---------- versions ---------- */

  function saveVersion(forSlug: string, note?: string) {
    const key = versionsKey(book.slug, forSlug);
    const list = readJson<Version[]>(key) ?? [];
    list.unshift({ at: Date.now(), note, title, titleEn, excerpt, blocks: blocksRef.current });
    let keep = list.slice(0, 15);
    while (keep.length > 1 && !writeJson(key, keep)) keep = keep.slice(0, keep.length - 1);
    if (forSlug === slug) setVersions(keep);
  }

  function restoreVersion(v: Version) {
    if (!window.confirm("এই সংস্করণ ফিরিয়ে আনবেন? বর্তমান লেখা আগে আলাদা সংস্করণ হিসেবে রাখা হবে।")) return;
    if (slug) saveVersion(slug, "পুনরুদ্ধারের আগে");
    flush();
    setTitle(v.title);
    setTitleEn(v.titleEn);
    setExcerpt(v.excerpt);
    setBlocks(v.blocks);
    setVersionsOpen(false);
  }

  /* ---------- media picker (unchanged behavior) ---------- */

  async function openPicker(index: number) {
    setPicker(index);
    if (!library) setLibrary(await listMedia());
  }

  function pickMedia(item: MediaItem) {
    if (picker == null) return;
    const key = newBlockId(item.kind === "image" ? "img" : "vid");
    const block: Block =
      item.kind === "image"
        ? { key, type: "image", mediaId: item.id, caption: item.title, originId: key }
        : { key, type: "video", mediaId: item.id, url: item.url ?? undefined, caption: item.title, originId: key };
    insertAt(picker, block);
    setPicker(null);
  }

  async function onUploaded(id: number, kind: "image" | "video") {
    const items = await listMedia();
    setLibrary(items);
    const found = items.find((m) => m.id === id);
    if (!found || picker == null) return;
    pickMedia(found);
    void kind;
  }

  /* ---------- save / delete ---------- */

  async function save(nextStatus?: "draft" | "published") {
    const target = nextStatus ?? pubStatus;
    setBusy(true);
    setError(null);
    try {
      if (canon) {
        if (!slug) throw new Error("অধ্যায় খুঁজে পাওয়া যায়নি");
        const items: { afterParaId: string; mediaId: number; caption: string }[] = [];
        let lastPara = "";
        for (const block of blocks) {
          if (block.type === "p" || block.type === "break") {
            lastPara = block.originId;
          } else if (block.type === "image" || (block.type === "video" && block.mediaId)) {
            items.push({
              afterParaId: lastPara,
              mediaId: block.mediaId as number,
              caption: block.caption,
            });
          }
        }
        await saveChapterInserts({
          data: { bookSlug: book.slug, chapterSlug: slug, items },
        });
        saveVersion(slug);
      } else {
        const result = await saveStudioChapter({
          data: {
            bookSlug: book.slug,
            slug,
            title,
            titleEn,
            excerpt,
            status: target,
            sections: toSections(blocks),
          },
        });
        saveVersion(result.slug);
        if (!slug) {
          moveKey(noteKey(book.slug, undefined), noteKey(book.slug, result.slug));
          removeKey(dKey);
          await navigate({
            to: "/studio/$bookSlug/$slug",
            params: { bookSlug: book.slug, slug: result.slug },
          });
          return;
        }
      }
      savedSig.current = sigOf(title, titleEn, excerpt, blocks);
      if (!canon) {
        savedStatus.current = target;
        setPubStatus(target);
      }
      removeKey(dKey);
      setStatus(
        !canon && nextStatus
          ? nextStatus === "published"
            ? `প্রকাশিত ${timeLabel()}`
            : `খসড়ায় নেওয়া হয়েছে ${timeLabel()}`
          : `সংরক্ষিত ${timeLabel()}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  async function removeChapter() {
    if (canon || !slug) return;
    if (!window.confirm("এই অধ্যায় ট্রাশে পাঠাবেন? (স্টুডিও › ট্রাশ থেকে ফেরত আনা যাবে)")) return;
    await deleteStudioChapter({ data: { bookSlug: book.slug, slug } });
    await navigate({ to: "/studio/$bookSlug", params: { bookSlug: book.slug } });
  }

  /* ---------- keyboard shortcuts ---------- */

  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key.toLowerCase();
    if (mod && k === "s") {
      ev.preventDefault();
      if (!busy && title.trim()) void save();
      return;
    }
    if (mod && k === "h") {
      ev.preventDefault();
      setFindOpen(true);
      return;
    }
    const inRich = (ev.target as HTMLElement).isContentEditable;
    if (mod && inRich && (k === "z" || k === "y")) {
      ev.preventDefault();
      if (k === "y" || ev.shiftKey) redo();
      else undo();
      return;
    }
    if (ev.key === "Escape") {
      if (focus) setFocus(false);
      else if (preview) setPreview(false);
    }
  }

  const previewChapter: Chapter | null = useMemo(
    () =>
      preview
        ? {
            id: chapter?.id ?? 0,
            slug: slug ?? "new",
            title,
            titleEn,
            excerpt,
            paraCount: 0,
            nsfwCount: 0,
            chars: 0,
            sections: toSections(blocks),
          }
        : null,
    [preview, chapter, slug, title, titleEn, excerpt, blocks],
  );

  const showTools = !focus && !preview;

  return (
    <div
      className={focus ? "fixed inset-0 overflow-auto bg-bg px-4 py-6 sm:px-10" : ""}
      style={focus ? { zIndex: 60 } : undefined}
      onKeyDown={onKeyDown}
    >
      <div className={focus ? "mx-auto max-w-2xl space-y-4" : "space-y-6"}>
        {pendingDraft ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-lamp/40 bg-surface-2 px-4 py-3 font-sans text-sm">
            <span className="text-fg">
              অসংরক্ষিত খসড়া পাওয়া গেছে ({new Date(pendingDraft.at).toLocaleString("bn-BD")})
            </span>
            <span className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={restoreDraft}
                className="pressable rounded-full bg-accent px-3 py-1 text-xs text-accent-fg"
              >
                ফিরিয়ে আনুন
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="pressable rounded-full border border-border px-3 py-1 text-xs text-muted"
              >
                বাদ দিন
              </button>
            </span>
          </div>
        ) : null}

        <div className="sticky top-[4.5rem] z-20 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface/95 p-1.5 backdrop-blur">
          <TopBtn label="আনডু" onClick={undo} disabled={hist.u === 0 && blocks === lastCommitted.current}>
            <Undo2 className="size-3.5" />
          </TopBtn>
          <TopBtn label="রিডু" onClick={redo} disabled={hist.r === 0}>
            <Redo2 className="size-3.5" />
          </TopBtn>
          {!focus ? (
            <>
              <TopBtn label="খুঁজুন" onClick={() => setFindOpen((v) => !v)} active={findOpen}>
                <Search className="size-3.5" />
              </TopBtn>
              <TopBtn label={preview ? "সম্পাদনা" : "প্রিভিউ"} onClick={() => setPreview((v) => !v)} active={preview}>
                {preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
              </TopBtn>
              <TopBtn label="সংস্করণ" onClick={() => setVersionsOpen((v) => !v)} active={versionsOpen}>
                <History className="size-3.5" />
              </TopBtn>
              <TopBtn label="নোট" onClick={() => setNotesOpen((v) => !v)} active={notesOpen}>
                <StickyNote className="size-3.5" />
              </TopBtn>
            </>
          ) : null}
          <span className="ml-auto flex items-center gap-1.5">
            {!canon ? <StatusPill status={pubStatus} /> : null}
            {dirty ? <span className="hidden font-sans text-[11px] text-lamp sm:inline">অসংরক্ষিত</span> : null}
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !title.trim()}
              title={title.trim() ? "সংরক্ষণ (Ctrl+S)" : "আগে শিরোনাম লিখুন"}
              className={cn(
                "pressable inline-flex h-9 items-center gap-1.5 rounded-full px-4 font-sans text-xs disabled:opacity-50",
                dirty ? "bg-accent text-accent-fg" : "border border-border text-muted",
              )}
            >
              <Save className="size-3.5" />
              {busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}
            </button>
            {!canon ? (
              <button
                type="button"
                onClick={() => void save(pubStatus === "published" ? "draft" : "published")}
                disabled={busy || !title.trim()}
                title={pubStatus === "published" ? "সংরক্ষণ করে খসড়ায় ফেরান — পাঠকেরা আর দেখবেন না" : "সংরক্ষণ করে সবার জন্য প্রকাশ করুন"}
                className="pressable hidden h-9 items-center rounded-full border border-border px-3 font-sans text-xs text-fg hover:bg-surface-2 disabled:opacity-50 sm:inline-flex"
              >
                {pubStatus === "published" ? "খসড়ায় ফেরান" : "প্রকাশ করুন"}
              </button>
            ) : null}
            <TopBtn label={focus ? "ফোকাস বন্ধ" : "ফোকাস"} onClick={() => setFocus((v) => !v)} active={focus}>
              {focus ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </TopBtn>
          </span>
        </div>

        {findOpen && !focus ? (
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={find}
                onChange={(e) => {
                  setFind(e.target.value);
                  setCur(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    goMatch(e.shiftKey ? -1 : 1);
                  }
                }}
                placeholder="যা খুঁজবেন"
                className="field-input min-w-40 flex-1"
              />
              {!canon ? (
                <input
                  value={repl}
                  onChange={(e) => setRepl(e.target.value)}
                  placeholder="যা দিয়ে বদলাবেন"
                  className="field-input min-w-40 flex-1"
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-sans text-xs">
              <span className="mr-1 text-muted">
                {find ? `${formatCount(matches.length)} টি মিল` : "লিখে খুঁজুন"}
                {matches.length ? ` · ${formatCount(matchIdx + 1)}/${formatCount(matches.length)}` : ""}
              </span>
              <SmallBtn onClick={() => goMatch(-1)} disabled={!matches.length}>
                আগেরটি
              </SmallBtn>
              <SmallBtn onClick={() => goMatch(1)} disabled={!matches.length}>
                পরেরটি
              </SmallBtn>
              {!canon ? (
                <>
                  <SmallBtn onClick={replaceOne} disabled={!matches.length}>
                    এটি বদলান
                  </SmallBtn>
                  <SmallBtn onClick={replaceAll} disabled={!matches.length}>
                    সব বদলান
                  </SmallBtn>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setFindOpen(false)}
                aria-label="বন্ধ"
                className="pressable ml-auto grid size-7 place-items-center rounded-full text-muted hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        {versionsOpen && !focus ? (
          <div className="rounded-xl border border-border bg-surface-2 p-3 font-sans text-sm">
            <p className="mb-2 text-xs text-muted">
              প্রতিবার সংরক্ষণ করলে একটি সংস্করণ এই ব্রাউজারে রাখা হয় (সর্বোচ্চ ১৫টি)।
            </p>
            {versions.length ? (
              <ul className="space-y-1.5">
                {versions.map((v) => {
                  const c = countText(v.blocks);
                  return (
                    <li
                      key={v.at}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                    >
                      <span className="text-fg">{new Date(v.at).toLocaleString("bn-BD")}</span>
                      <span className="text-xs text-muted">
                        {formatCount(c.words)} শব্দ{v.note ? ` · ${v.note}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => restoreVersion(v)}
                        className="pressable ml-auto rounded-full border border-border px-3 py-1 text-xs text-lamp"
                      >
                        পুনরুদ্ধার
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted">
                {slug ? "এখনো কোনো সংস্করণ নেই — সংরক্ষণ করলে এখানে দেখা যাবে।" : "অধ্যায় প্রথমবার সংরক্ষণের পর সংস্করণ দেখা যাবে।"}
              </p>
            )}
          </div>
        ) : null}

        {notesOpen && !focus ? (
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <p className="mb-2 font-sans text-xs text-muted">
              ব্যক্তিগত নোট — পাঠকেরা কখনো দেখবে না। শুধু এই ব্রাউজারে থাকে।
            </p>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                writeJson(noteKey(book.slug, slug), e.target.value);
              }}
              rows={5}
              placeholder="চরিত্র, পরের দৃশ্যের ধারণা, মনে রাখার কথা…"
              className="field-input min-h-28"
            />
          </div>
        ) : null}

        {showTools ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="শিরোনাম">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={canon}
                  className="field-input"
                />
              </Field>
              <Field label="English title">
                <input
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  disabled={canon}
                  className="field-input"
                />
              </Field>
            </div>
            <Field label="সারাংশ">
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                disabled={canon}
                rows={2}
                className="field-input min-h-16"
              />
            </Field>

            {canon ? (
              <p className="rounded-lg border border-border bg-surface px-4 py-3 font-sans text-sm text-muted">
                মূল পাঠ GitHub থেকে আসে। এখানে অনুচ্ছেদের মাঝে ছবি ও ভিডিও বসান — লেখা থাকবে অক্ষত।
              </p>
            ) : null}
          </>
        ) : null}

        {preview && previewChapter ? (
          <div className="rounded-xl border border-border bg-surface">
            <ChapterBody chapter={previewChapter} fontSize={18} bookSlug={book.slug} />
          </div>
        ) : (
          <div className={focus ? "space-y-2" : "space-y-3"}>
            {blocks.map((block, i) => (
              <article
                key={block.key}
                className={cn(!focus && "rounded-xl border border-border bg-surface p-3")}
              >
                {block.type === "p" ? (
                  <RichEditor
                    ref={(h) => {
                      if (h) handles.current.set(block.key, h);
                      else handles.current.delete(block.key);
                    }}
                    runs={block.runs}
                    readOnly={canon}
                    bare={focus}
                    color={block.color}
                    effects={block.effects}
                    align={block.align}
                    placeholder="অনুচ্ছেদ লিখুন…"
                    onChange={(runs) => setBlockRuns(block.key, runs)}
                    onSplit={(head, tail) => splitBlock(block.key, head, tail)}
                    onPasteParts={(head, rest, tail) => pasteParts(block.key, head, rest, tail)}
                    onBackspaceStart={() => backspaceStart(block.key)}
                    onSceneBreak={() => sceneBreak(block.key)}
                  />
                ) : null}
                {block.type === "p" && !canon && showTools ? (
                  <TextToolbar
                    color={block.color}
                    effects={block.effects ?? []}
                    align={block.align}
                    onFmt={(cmd) => fmt(block.key, cmd)}
                    onAlign={(a) => setAlign(block.key, a)}
                  />
                ) : null}
                {block.type === "break" ? <p className="scene-break py-2">দৃশ্য বিরতি</p> : null}
                {block.type === "image" ? (
                  <div className="space-y-2">
                    <MediaFigure kind="image" src={`/api/media/${block.mediaId}`} caption={block.caption} />
                    <input
                      value={block.caption}
                      onChange={(e) => update(i, { caption: e.target.value })}
                      placeholder="ক্যাপশন"
                      className="field-input"
                    />
                  </div>
                ) : null}
                {block.type === "video" ? (
                  <div className="space-y-2">
                    <MediaFigure
                      kind="video"
                      src={block.mediaId ? `/api/media/${block.mediaId}` : undefined}
                      url={block.url}
                      caption={block.caption}
                    />
                    <input
                      value={block.caption}
                      onChange={(e) => update(i, { caption: e.target.value })}
                      placeholder="ক্যাপশন"
                      className="field-input"
                    />
                  </div>
                ) : null}

                {showTools ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <IconBtn label="ছবি" onClick={() => void openPicker(i + 1)}>
                      <ImagePlus className="size-3.5" />
                    </IconBtn>
                    <IconBtn label="ভিডিও" onClick={() => void openPicker(i + 1)}>
                      <Video className="size-3.5" />
                    </IconBtn>
                    {!canon ? (
                      <>
                        <IconBtn label="অনুচ্ছেদ" onClick={() => addParagraphAfter(i)}>
                          <Type className="size-3.5" />
                        </IconBtn>
                        <IconBtn
                          label="বিরতি"
                          onClick={() =>
                            insertAt(i + 1, { key: newBlockId("br"), type: "break", originId: newBlockId("br") })
                          }
                        >
                          <Plus className="size-3.5" />
                        </IconBtn>
                        <IconBtn label="কপি" onClick={() => duplicateBlock(i)}>
                          <Copy className="size-3.5" />
                        </IconBtn>
                      </>
                    ) : null}
                    {!canon || block.type === "image" || block.type === "video" ? (
                      <>
                        <IconBtn label="উপরে" onClick={() => moveBlock(i, -1)} disabled={i === 0}>
                          <ArrowUp className="size-3.5" />
                        </IconBtn>
                        <IconBtn label="নিচে" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}>
                          <ArrowDown className="size-3.5" />
                        </IconBtn>
                      </>
                    ) : null}
                    {(!canon || block.type === "image" || block.type === "video") && blocks.length > 1 ? (
                      <IconBtn label="মুছুন" onClick={() => removeAt(i)} danger>
                        <Trash2 className="size-3.5" />
                      </IconBtn>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {picker != null && showTools ? (
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-display text-base">মিডিয়া বাছুন</p>
              <button type="button" className="pressable text-sm text-muted" onClick={() => setPicker(null)}>
                বন্ধ
              </button>
            </div>
            <MediaUploader compact onUploaded={(id, kind) => void onUploaded(id, kind)} />
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(library ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickMedia(item)}
                  className={cn(
                    "pressable overflow-hidden rounded-lg border border-border bg-surface",
                    mediaIds.has(item.id) && "ring-1 ring-lamp",
                  )}
                >
                  {item.kind === "image" ? (
                    <img src={item.thumbSrc || item.src} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="grid aspect-square place-items-center text-lamp">
                      <Video className="size-6" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="font-sans text-sm text-nsfw">{error}</p> : null}

        {showTools ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => void save()}
              className="pressable inline-flex h-12 items-center rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg disabled:opacity-50"
            >
              {busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}
            </button>
            {!canon ? (
              <button
                type="button"
                disabled={busy || !title.trim()}
                onClick={() => void save(pubStatus === "published" ? "draft" : "published")}
                className="pressable inline-flex h-12 items-center rounded-lg border border-border px-4 font-sans text-sm text-fg disabled:opacity-50"
              >
                {pubStatus === "published" ? "খসড়ায় ফেরান" : "সংরক্ষণ ও প্রকাশ"}
              </button>
            ) : null}
            {slug && !canon ? (
              <button
                type="button"
                onClick={() => void removeChapter()}
                className="pressable inline-flex h-12 items-center rounded-lg border border-border px-4 font-sans text-sm text-nsfw"
              >
                অধ্যায় মুছুন
              </button>
            ) : null}
            {slug ? (
              <a
                href={`/read/${book.slug}/${padSlug(slug)}`}
                className="pressable inline-flex h-12 items-center rounded-lg border border-border px-4 font-sans text-sm text-fg"
              >
                পড়ে দেখুন
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-full border border-border bg-surface/95 px-4 py-2 font-sans text-[11px] text-muted backdrop-blur">
          <span>শব্দ {formatCount(counts.words)}</span>
          <span>অক্ষর {formatCount(counts.chars)}</span>
          <span>অনুচ্ছেদ {formatCount(counts.paras)}</span>
          {status ? <span className="ml-auto text-lamp">{status}</span> : null}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "draft" | "published" }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 font-sans text-[11px]",
        status === "published" ? "bg-lamp/15 text-lamp" : "border border-border bg-surface-2 text-muted",
      )}
    >
      {status === "published" ? "প্রকাশিত" : "খসড়া"}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-sans text-xs tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "pressable inline-flex h-9 items-center gap-1 rounded-full px-2.5 font-sans text-[11px] disabled:opacity-30",
        danger ? "text-nsfw hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
      {label}
    </button>
  );
}

function TopBtn({
  children,
  label,
  onClick,
  active,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "pressable inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-sans text-xs disabled:opacity-35",
        active ? "bg-surface-2 text-lamp" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SmallBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="pressable rounded-full border border-border px-3 py-1 text-xs text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function FmtBtn({
  children,
  label,
  onClick,
  active,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "pressable inline-grid size-8 place-items-center rounded-md font-sans text-xs",
        active ? "bg-surface text-lamp" : "text-muted hover:bg-surface hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function CustomColor({ onPick }: { onPick: (value: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handler = () => onPick(node.value);
    node.addEventListener("change", handler);
    return () => node.removeEventListener("change", handler);
  }, [onPick]);
  return (
    <label className="pressable inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-border px-2 font-sans text-[11px] text-muted">
      কাস্টম
      <input
        ref={ref}
        type="color"
        defaultValue="#ffffff"
        className="size-4 cursor-pointer border-0 bg-transparent p-0"
      />
    </label>
  );
}

function TextToolbar({
  color,
  effects,
  align,
  onFmt,
  onAlign,
}: {
  color?: string;
  effects: string[];
  align?: ParaAlign;
  onFmt: (cmd: FormatCmd) => void;
  onAlign: (a: ParaAlign) => void;
}) {
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-2 p-2.5">
      <div className="flex flex-wrap items-center gap-0.5">
        <FmtBtn label="মোটা (Ctrl+B)" onClick={() => onFmt({ k: "b" })}>
          <Bold className="size-4" />
        </FmtBtn>
        <FmtBtn label="বাঁকা (Ctrl+I)" onClick={() => onFmt({ k: "i" })}>
          <Italic className="size-4" />
        </FmtBtn>
        <FmtBtn label="দাগ (Ctrl+U)" onClick={() => onFmt({ k: "u" })}>
          <Underline className="size-4" />
        </FmtBtn>
        <span className="mx-1 h-5 w-px bg-border" />
        <FmtBtn label="বাঁ দিকে" active={align === "left"} onClick={() => onAlign("left")}>
          <AlignLeft className="size-4" />
        </FmtBtn>
        <FmtBtn label="মাঝে" active={align === "center"} onClick={() => onAlign("center")}>
          <AlignCenter className="size-4" />
        </FmtBtn>
        <FmtBtn label="ডান দিকে" active={align === "right"} onClick={() => onAlign("right")}>
          <AlignRight className="size-4" />
        </FmtBtn>
        <span className="mx-1 h-5 w-px bg-border" />
        <FmtBtn label="সংলাপ “ ”" onClick={() => onFmt({ k: "quote" })}>
          <Quote className="size-4" />
        </FmtBtn>
        <FmtBtn label="সংলাপ ড্যাশ ―" onClick={() => onFmt({ k: "dash" })}>
          <Minus className="size-4" />
        </FmtBtn>
        <FmtBtn label="ফরম্যাট মুছুন" onClick={() => onFmt({ k: "clear" })}>
          <Eraser className="size-4" />
        </FmtBtn>
      </div>
      <p className="font-sans text-[10px] text-subtle">
        লেখার কিছু অংশ নির্বাচন করলে শুধু সেই অংশে, না করলে পুরো অনুচ্ছেদে প্রযোজ্য।
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-sans text-[11px] text-muted">রং</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFmt({ k: "c", v: undefined })}
          aria-label="ডিফল্ট রং"
          title="ডিফল্ট"
          className={cn(
            "pressable size-6 rounded-full border border-border bg-bg text-[10px] text-muted",
            !color && "ring-1 ring-lamp",
          )}
        >
          ×
        </button>
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c.value}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFmt({ k: "c", v: c.value })}
            aria-label={c.label}
            title={c.label}
            style={{ backgroundColor: c.value }}
            className={cn(
              "pressable size-6 rounded-full border border-border",
              color === c.value && "ring-2 ring-lamp ring-offset-1 ring-offset-transparent",
            )}
          />
        ))}
        <CustomColor onPick={(v) => onFmt({ k: "c", v })} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-sans text-[11px] text-muted">ইফেক্ট</span>
        {TEXT_EFFECTS.map((fx) => (
          <button
            key={fx.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFmt({ k: "fx", id: fx.id })}
            className={cn(
              "pressable h-7 rounded-full border px-2.5 font-sans text-[11px]",
              effects.includes(fx.id) ? "border-lamp text-lamp" : "border-border text-muted hover:text-fg",
            )}
          >
            {fx.label}
          </button>
        ))}
      </div>
    </div>
  );
}
