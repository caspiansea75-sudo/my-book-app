import { useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowDownUp, Check, ChevronRight, Folder, ImagePlus, ListOrdered, Loader2, Search, X } from "lucide-react";
import type { VaultFolder, VaultItem } from "@/lib/media-folders-api";
import { cn } from "@/lib/utils";

type View = "all" | number | null; // "all" = every image, null = images not in any folder
type SortMode = "new" | "old" | "name";

const PAGE_SIZE = 120;
const bn = (n: number) => n.toLocaleString("bn-BD");
const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * Pick many images from the gallery in one go: browse by folder, search, tick as many as
 * you like (shift-click selects a range), see them in the order they'll become panels,
 * then add them all with one tap.
 */
export function PanelPicker({
  folders,
  items,
  usedIds,
  onAdd,
}: {
  folders: VaultFolder[];
  items: VaultItem[];
  /** Media ids already used as panels in this chapter. */
  usedIds: Set<number>;
  onAdd: (mediaIds: number[]) => Promise<void>;
}) {
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("new");
  const [hideUsed, setHideUsed] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [busy, setBusy] = useState(false);
  const lastClicked = useRef<number | null>(null);

  const images = useMemo(() => items.filter((i) => i.kind === "image"), [items]);
  const byId = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  /** Folder ids that belong to the current folder, including all nested ones. */
  const scopeIds = useMemo(() => {
    if (typeof view !== "number") return null;
    const ids = new Set<number>([view]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders) {
        if (f.parentId != null && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          grew = true;
        }
      }
    }
    return ids;
  }, [view, folders]);

  const breadcrumb = useMemo(() => {
    const trail: VaultFolder[] = [];
    let cur = typeof view === "number" ? folderById.get(view) : undefined;
    while (cur) {
      trail.unshift(cur);
      cur = cur.parentId != null ? folderById.get(cur.parentId) : undefined;
    }
    return trail;
  }, [view, folderById]);

  const childFolders = useMemo(() => {
    const parent = typeof view === "number" ? view : null;
    if (view === null) return [];
    return folders.filter((f) => (f.parentId ?? null) === parent);
  }, [view, folders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = images.filter((i) => {
      if (view === null && i.folderId != null) return false;
      if (scopeIds && (i.folderId == null || !scopeIds.has(i.folderId))) return false;
      if (hideUsed && usedIds.has(i.id)) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list];
    if (sort === "old") list.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
    else if (sort === "name") list.sort((a, b) => naturalCompare(a.title, b.title) || a.id - b.id);
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    return list;
  }, [images, view, scopeIds, hideUsed, usedIds, query, sort]);

  const shown = visible.slice(0, limit);

  function changeView(next: View) {
    setView(next);
    setLimit(PAGE_SIZE);
    lastClicked.current = null;
  }

  function toggle(id: number, index: number, e: MouseEvent) {
    if (e.shiftKey && lastClicked.current != null) {
      const from = Math.min(lastClicked.current, index);
      const to = Math.max(lastClicked.current, index);
      const range = shown.slice(from, to + 1).map((i) => i.id);
      setSelected((cur) => [...cur, ...range.filter((rid) => !cur.includes(rid))]);
    } else {
      setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    }
    lastClicked.current = index;
  }

  function selectAllVisible() {
    setSelected((cur) => [...cur, ...visible.map((i) => i.id).filter((id) => !cur.includes(id))]);
  }

  function deselectVisible() {
    const ids = new Set(visible.map((i) => i.id));
    setSelected((cur) => cur.filter((id) => !ids.has(id)));
  }

  /** Put the picked images in file-name order (page 1, 2, 3 …). */
  function orderByName() {
    setSelected((cur) =>
      [...cur].sort((a, b) => {
        const A = byId.get(a);
        const B = byId.get(b);
        return naturalCompare(A?.title ?? "", B?.title ?? "") || a - b;
      }),
    );
  }

  async function submit() {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    try {
      await onAdd(selected);
      setSelected([]);
      lastClicked.current = null;
    } finally {
      setBusy(false);
    }
  }

  const allVisibleSelected = visible.length > 0 && visible.every((i) => selectedSet.has(i.id));

  return (
    <div className={cn(selected.length > 0 && "pb-40")}>
      {/* Where am I */}
      <nav className="flex flex-wrap items-center gap-1 font-sans text-sm" aria-label="ফোল্ডার">
        <button
          type="button"
          onClick={() => changeView("all")}
          className={cn("pressable rounded-full px-3 py-1", view === "all" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}
        >
          সব ছবি ({bn(images.length)})
        </button>
        {breadcrumb.map((f) => (
          <span key={f.id} className="inline-flex items-center gap-1">
            <ChevronRight className="size-3.5 text-subtle" strokeWidth={1.75} />
            <button
              type="button"
              onClick={() => changeView(f.id)}
              className={cn("pressable rounded-full px-3 py-1", view === f.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}
            >
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Folder chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {view === "all" ? (
          <button
            type="button"
            onClick={() => changeView(null)}
            className="pressable inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-muted hover:text-fg"
          >
            <ImagePlus className="size-3.5" strokeWidth={1.75} />
            ফোল্ডারের বাইরের ছবি
          </button>
        ) : view === null ? (
          <span className="inline-flex h-9 items-center rounded-full bg-surface-2 px-3 font-sans text-xs text-fg">
            ফোল্ডারের বাইরের ছবি
          </span>
        ) : null}
        {childFolders.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => changeView(f.id)}
            className="pressable inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-fg hover:border-lamp"
          >
            <Folder className="size-3.5 text-muted" strokeWidth={1.75} />
            {f.name}
            <span className="text-subtle">{bn(f.itemCount)}</span>
          </button>
        ))}
      </div>

      {/* Search, sort, bulk actions */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">ছবি খুঁজুন</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="ফাইলের নাম দিয়ে খুঁজুন"
            className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-lamp"
          />
        </label>
        <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 font-sans text-xs text-muted">
          <ArrowDownUp className="size-3.5" strokeWidth={1.75} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="bg-transparent text-fg outline-none"
            aria-label="সাজানো"
          >
            <option value="new">নতুন আগে</option>
            <option value="old">পুরনো আগে</option>
            <option value="name">নাম অনুযায়ী</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 font-sans text-xs">
        <button
          type="button"
          onClick={allVisibleSelected ? deselectVisible : selectAllVisible}
          disabled={visible.length === 0}
          className="pressable inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-fg disabled:opacity-40"
        >
          <Check className="size-3.5" strokeWidth={1.75} />
          {allVisibleSelected ? "এখানকার বাছাই বাতিল" : `এখানকার সব বাছুন (${bn(visible.length)})`}
        </button>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-muted">
          <input type="checkbox" checked={hideUsed} onChange={(e) => setHideUsed(e.target.checked)} className="accent-current" />
          এই অধ্যায়ে যোগ করা ছবি লুকান
        </label>
        <span className="text-subtle hidden sm:inline">Shift চেপে ক্লিক করলে একসাথে অনেকগুলো বাছা যায়</span>
      </div>

      {/* Image grid */}
      {visible.length === 0 ? (
        <p className="mt-6 font-sans text-sm text-muted">এখানে কোনো ছবি নেই।</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {shown.map((img, index) => {
            const pos = selected.indexOf(img.id);
            const isSel = pos !== -1;
            const used = usedIds.has(img.id);
            return (
              <button
                key={img.id}
                type="button"
                onClick={(e) => toggle(img.id, index, e)}
                aria-pressed={isSel}
                title={img.title}
                className={cn(
                  "pressable group relative aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                  isSel ? "border-lamp" : "border-border",
                )}
              >
                <img
                  src={img.thumbSrc || img.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={cn("h-full w-full object-cover transition-opacity", isSel && "opacity-70", used && !isSel && "opacity-50")}
                />
                {isSel ? (
                  <span className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-lamp font-sans text-xs font-semibold text-bg">
                    {bn(pos + 1)}
                  </span>
                ) : (
                  <span className="absolute top-1.5 left-1.5 size-6 rounded-full border border-fg/40 bg-bg/40 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
                {used ? (
                  <span className="absolute right-1 bottom-1 rounded-full bg-bg/80 px-1.5 py-0.5 font-sans text-[10px] text-muted">
                    যোগ করা
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      {visible.length > shown.length ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            className="pressable h-10 rounded-lg border border-border px-4 font-sans text-sm text-fg"
          >
            আরও দেখান ({bn(visible.length - shown.length)})
          </button>
        </div>
      ) : null}

      {/* Sticky tray: selected images in panel order + one-tap add */}
      {selected.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto max-w-4xl px-5 py-3 sm:px-8">
            <div className="flex gap-1.5 overflow-x-auto pb-2">
              {selected.map((id, i) => {
                const img = byId.get(id);
                if (!img) return null;
                return (
                  <div key={id} className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md border border-border">
                    <img src={img.thumbSrc || img.src} alt="" className="h-full w-full object-cover" />
                    <span className="absolute bottom-0 left-0 rounded-tr bg-bg/80 px-1 font-sans text-[10px] text-fg">{bn(i + 1)}</span>
                    <button
                      type="button"
                      onClick={() => setSelected((cur) => cur.filter((x) => x !== id))}
                      className="absolute top-0 right-0 grid size-4 place-items-center bg-bg/80 text-fg"
                      aria-label="বাদ দিন"
                    >
                      <X className="size-3" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto font-sans text-sm text-fg">{bn(selected.length)}টি বাছা হয়েছে</span>
              <button
                type="button"
                onClick={orderByName}
                className="pressable inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 font-sans text-xs text-muted hover:text-fg"
              >
                <ListOrdered className="size-4" strokeWidth={1.75} />
                নাম অনুযায়ী সাজান
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="pressable h-10 rounded-lg border border-border px-3 font-sans text-xs text-muted hover:text-fg"
              >
                সব বাদ দিন
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="pressable inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : <ImagePlus className="size-4" strokeWidth={1.75} />}
                {bn(selected.length)}টি প্যানেল যোগ করুন
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
