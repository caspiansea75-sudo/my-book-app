import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ArrowDownUp,
  Check,
  ChevronRight,
  Folder,
  ImagePlus,
  ListOrdered,
  ListPlus,
  Loader2,
  Search,
  X,
} from "lucide-react";
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
 *
 * A folder shows only the images that are directly inside it; its sub-folders are chips you
 * can open — or add wholesale with the "+" on the chip. "Select all" skips images already used
 * in the chapter and adds the rest in page order (folder by folder, then by file name).
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
  // Off by default: a folder shows just its own images. On: also the images in its sub-folders.
  const [includeSub, setIncludeSub] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [busy, setBusy] = useState(false);
  const lastClicked = useRef<number | null>(null);

  const images = useMemo(() => items.filter((i) => i.kind === "image"), [items]);
  const byId = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  function flash(text: string, ok = true) {
    setNotice({ text, ok });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }

  /** Folders grouped by parent, each group in natural name order. */
  const kids = useMemo(() => {
    const map = new Map<number | null, VaultFolder[]>();
    for (const f of folders) {
      const key = f.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => naturalCompare(a.name, b.name) || a.id - b.id);
    return map;
  }, [folders]);

  /** Reading order of every folder (depth-first), so a parent's pages come before its sub-folders'. */
  const folderRank = useMemo(() => {
    const rank = new Map<number, number>();
    let n = 0;
    const walk = (parent: number | null) => {
      for (const f of kids.get(parent) ?? []) {
        if (rank.has(f.id)) continue;
        rank.set(f.id, n++);
        walk(f.id);
      }
    };
    walk(null);
    return rank;
  }, [kids]);

  /** A folder's id plus the ids of everything nested inside it. */
  function withDescendants(rootId: number): Set<number> {
    const ids = new Set<number>([rootId]);
    const stack = [rootId];
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      for (const f of kids.get(cur) ?? []) {
        if (!ids.has(f.id)) {
          ids.add(f.id);
          stack.push(f.id);
        }
      }
    }
    return ids;
  }

  const scopeIds = useMemo(() => (typeof view === "number" ? withDescendants(view) : null), [view, kids]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Page order for a batch: folder by folder (parent first), then by file name. */
  function pageOrder(list: VaultItem[]): VaultItem[] {
    const rankOf = (i: VaultItem) => (i.folderId == null ? -1 : (folderRank.get(i.folderId) ?? -1));
    return [...list].sort((a, b) => rankOf(a) - rankOf(b) || naturalCompare(a.title, b.title) || a.id - b.id);
  }

  const breadcrumb = useMemo(() => {
    const trail: VaultFolder[] = [];
    let cur = typeof view === "number" ? folderById.get(view) : undefined;
    const seen = new Set<number>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      trail.unshift(cur);
      cur = cur.parentId != null ? folderById.get(cur.parentId) : undefined;
    }
    return trail;
  }, [view, folderById]);

  const childFolders = useMemo(() => {
    if (view === null) return [];
    return kids.get(typeof view === "number" ? view : null) ?? [];
  }, [view, kids]);

  const searching = query.trim().length > 0;
  // Inside a folder, a search looks through its sub-folders too, so a page is easy to find.
  const deep = typeof view === "number" && (includeSub || searching);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = images.filter((i) => {
      if (view === null && i.folderId != null) return false;
      if (typeof view === "number") {
        if (deep ? i.folderId == null || !scopeIds?.has(i.folderId) : i.folderId !== view) return false;
      }
      if (hideUsed && usedIds.has(i.id)) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list];
    if (sort === "old") list.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
    else if (sort === "name") list.sort((a, b) => naturalCompare(a.title, b.title) || a.id - b.id);
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    return list;
  }, [images, view, deep, scopeIds, hideUsed, usedIds, query, sort]);

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

  /** What "select all" would pick: everything visible that isn't already a panel in this chapter. */
  const selectable = useMemo(() => visible.filter((i) => !usedIds.has(i.id)), [visible, usedIds]);

  function selectAllVisible() {
    const batch = pageOrder(selectable).map((i) => i.id);
    setSelected((cur) => [...cur, ...batch.filter((id) => !cur.includes(id))]);
  }

  function deselectVisible() {
    const ids = new Set(visible.map((i) => i.id));
    setSelected((cur) => cur.filter((id) => !ids.has(id)));
  }

  /** The "+" on a sub-folder chip: queue every new image in that folder (and below) without opening it. */
  function addFolder(folderId: number) {
    const scope = withDescendants(folderId);
    const batch = pageOrder(images.filter((i) => i.folderId != null && scope.has(i.folderId) && !usedIds.has(i.id)));
    const fresh = batch.map((i) => i.id).filter((id) => !selectedSet.has(id));
    if (fresh.length === 0) {
      flash("এই ফোল্ডারে বাছার মতো নতুন ছবি নেই", false);
      return;
    }
    setSelected((cur) => [...cur, ...fresh]);
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
    const count = selected.length;
    try {
      await onAdd(selected);
      setSelected([]);
      lastClicked.current = null;
      flash(`${bn(count)}টি প্যানেল যোগ হয়েছে`);
    } catch {
      flash("যোগ করা যায়নি, আবার চেষ্টা করুন", false);
    } finally {
      setBusy(false);
    }
  }

  const allVisibleSelected = selectable.length > 0 && selectable.every((i) => selectedSet.has(i.id));
  const directCount = typeof view === "number" ? (folderById.get(view)?.itemCount ?? 0) : 0;

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
        {childFolders.map((f) => {
          const subs = kids.get(f.id)?.length ?? 0;
          return (
            <div
              key={f.id}
              className="inline-flex h-9 items-stretch overflow-hidden rounded-full border border-border hover:border-lamp"
            >
              <button
                type="button"
                onClick={() => changeView(f.id)}
                className="pressable inline-flex items-center gap-1.5 pr-2 pl-3 font-sans text-xs text-fg"
              >
                <Folder className="size-3.5 text-muted" strokeWidth={1.75} />
                {f.name}
                <span className="text-subtle">{bn(f.itemCount)}</span>
                {subs > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-subtle" title="সাবফোল্ডার আছে">
                    <Folder className="size-3" strokeWidth={1.75} />
                    {bn(subs)}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => addFolder(f.id)}
                title="এই ফোল্ডারের সব ছবি বাছুন (সাবফোল্ডারসহ)"
                aria-label="এই ফোল্ডারের সব ছবি বাছুন (সাবফোল্ডারসহ)"
                className="pressable grid w-9 place-items-center border-l border-border text-muted hover:bg-surface-2 hover:text-lamp"
              >
                <ListPlus className="size-4" strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
      </div>

      {typeof view === "number" ? (
        <p className="mt-2 font-sans text-xs text-subtle">
          <span>{`এই ফোল্ডারে ${bn(directCount)}টি ছবি`}</span>
          {childFolders.length > 0 ? <span> · {`${bn(childFolders.length)}টি সাবফোল্ডার`}</span> : null}
        </p>
      ) : null}

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
          {allVisibleSelected ? "এখানকার বাছাই বাতিল" : `এখানকার সব বাছুন (${bn(selectable.length)})`}
        </button>
        {typeof view === "number" && childFolders.length > 0 ? (
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-muted">
            <input
              type="checkbox"
              checked={includeSub}
              onChange={(e) => {
                setIncludeSub(e.target.checked);
                setLimit(PAGE_SIZE);
              }}
              className="accent-current"
            />
            সাবফোল্ডারের ছবিও দেখান
          </label>
        ) : null}
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-muted">
          <input type="checkbox" checked={hideUsed} onChange={(e) => setHideUsed(e.target.checked)} className="accent-current" />
          এই অধ্যায়ে যোগ করা ছবি লুকান
        </label>
        <span className="text-subtle hidden sm:inline">Shift চেপে ক্লিক করলে একসাথে অনেকগুলো বাছা যায়</span>
      </div>

      {notice ? (
        <p
          role="status"
          className={cn(
            "mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2 font-sans text-xs",
            notice.ok ? "text-fg" : "text-nsfw",
          )}
        >
          {notice.text}
        </p>
      ) : null}

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
                {deep && img.folderId != null && img.folderId !== view ? (
                  <span className="pointer-events-none absolute bottom-1 left-1 max-w-[70%] truncate rounded-full bg-bg/80 px-1.5 py-0.5 font-sans text-[10px] text-muted">
                    {folderById.get(img.folderId)?.name ?? ""}
                  </span>
                ) : null}
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
