import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Check,
  ChevronRight,
  Folder,
  FolderInput,
  Grid3x3,
  Images,
  FolderPlus,
  Home,
  LayoutGrid,
  Link2,
  List,
  Pencil,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Square,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Lightbox, type LightboxItem } from "@/components/book/lightbox";
import { SiteNav } from "@/components/book/site-nav";
import { HideToggle } from "@/components/members/hide-toggle";
import { MultiUploader } from "@/components/media/multi-uploader";
import { TrashDialog } from "@/components/studio/trash-dialog";
import {
  createFolder,
  deleteFolder,
  deleteMediaSafe,
  getMediaUsage,
  loadVault,
  moveFolder,
  moveMedia,
  renameFolder,
  renameMedia,
  type MediaUsage,
  type Vault,
  type VaultFolder,
  type VaultItem,
} from "@/lib/media-folders-api";
import { useLang } from "@/lib/i18n/lang";
import { useLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import "@/components/media/media-effects.css";

export const Route = createFileRoute("/gallery")({
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: "/login" });
  },
  loader: () => loadVault(),
  component: MediaPage,
});

type SortKey = "new" | "old" | "name-asc" | "name-desc" | "big" | "small";
type TypeFilter = "all" | "image" | "video";
type UsageFilter = "all" | "used" | "unused";
type SourceFilter = "all" | "upload" | "url";
type GalleryView = "large" | "compact" | "list" | "covers";

const VIEWS: { id: GalleryView; label: string; icon: typeof Square }[] = [
  { id: "large", label: "বড় কার্ড", icon: Square },
  { id: "compact", label: "ছোট গ্রিড", icon: LayoutGrid },
  { id: "list", label: "তালিকা", icon: List },
  { id: "covers", label: "শুধু ছবি", icon: Grid3x3 },
];

const TILE_GRID: Record<GalleryView, string> = {
  large: "grid grid-cols-1 gap-4 sm:grid-cols-2",
  compact: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
  list: "grid grid-cols-1 gap-2",
  covers: "grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-7",
};

const FOLDER_GRID: Record<GalleryView, string> = {
  large: "sm:grid-cols-2",
  compact: "sm:grid-cols-2 lg:grid-cols-3",
  list: "grid-cols-1",
  covers: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

const SORTS: [SortKey, string][] = [
  ["new", "নতুন আগে"],
  ["old", "পুরনো আগে"],
  ["name-asc", "নাম A–Z"],
  ["name-desc", "নাম Z–A"],
  ["big", "বড় ফাইল আগে"],
  ["small", "ছোট ফাইল আগে"],
];

const DRAG_TYPE = "application/x-media-ids";
const SORT_STORAGE = "media-page-sort";
const VIEW_STORAGE = "media-page-view";

type Modal =
  | { type: "new-folder"; parentId: number | null }
  | { type: "rename-folder"; folder: VaultFolder }
  | { type: "rename-item"; item: VaultItem }
  | { type: "move"; target: { kind: "items"; ids: number[] } | { kind: "folder"; id: number } }
  | { type: "delete-items"; ids: number[] }
  | { type: "delete-folder"; folder: VaultFolder };

function bn(n: number, fraction = 0): string {
  return n.toLocaleString("bn-BD", { maximumFractionDigits: fraction });
}

function formatBytes(bytes: number): string {
  if (!bytes) return "লিংক";
  if (bytes < 1024 * 1024) return `${bn(Math.max(1, Math.round(bytes / 1024)))} কেবি`;
  return `${bn(bytes / (1024 * 1024), 1)} এমবি`;
}

function displayName(item: VaultItem): string {
  return item.title.trim() || (item.kind === "video" ? "নামহীন ভিডিও" : "নামহীন ছবি");
}

function sortItems(items: VaultItem[], sort: SortKey): VaultItem[] {
  const list = [...items];
  const byName = (a: VaultItem, b: VaultItem) => displayName(a).localeCompare(displayName(b), "bn");
  switch (sort) {
    case "new":
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    case "old":
      return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
    case "name-asc":
      return list.sort(byName);
    case "name-desc":
      return list.sort((a, b) => byName(b, a));
    case "big":
      return list.sort((a, b) => b.bytes - a.bytes || b.id - a.id);
    case "small":
      return list.sort((a, b) => a.bytes - b.bytes || b.id - a.id);
  }
}

function MediaPage() {
  const initial = Route.useLoaderData();
  const lang = useLang();
  const locale = useLocale();
  const [vault, setVault] = useState<Vault>(initial);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<SortKey>("new");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [hiddenOnly, setHiddenOnly] = useState(false);
  // Also list files that sit inside sub-folders of the folder being viewed.
  const [includeSub, setIncludeSub] = useState(false);
  // Search only inside the folder being viewed (and its sub-folders) instead of everywhere.
  const [searchHere, setSearchHere] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<GalleryView>("compact");
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<Modal | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | "home" | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SORT_STORAGE);
      if (saved && SORTS.some(([key]) => key === saved)) setSort(saved as SortKey);
      const savedView = window.localStorage.getItem(VIEW_STORAGE);
      if (savedView && VIEWS.some((v) => v.id === savedView)) setView(savedView as GalleryView);
    } catch {
      // storage unavailable — default sort is fine
    }
  }, []);

  function changeSort(next: SortKey) {
    setSort(next);
    try {
      window.localStorage.setItem(SORT_STORAGE, next);
    } catch {
      // ignore
    }
  }

  function changeView(next: GalleryView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE, next);
    } catch {
      // ignore
    }
  }

  const refresh = useCallback(async () => {
    setVault(await loadVault());
  }, []);

  async function run(action: () => Promise<unknown>, fallback = "কাজটি হয়নি") {
    setNotice(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : fallback);
    }
  }

  const folderById = useMemo(() => new Map(vault.folders.map((f) => [f.id, f])), [vault.folders]);

  // If the folder being viewed disappears (deleted elsewhere), fall back home.
  useEffect(() => {
    if (folderId != null && !folderById.has(folderId)) setFolderId(null);
  }, [folderId, folderById]);

  const trail = useMemo(() => {
    const path: VaultFolder[] = [];
    let cursor = folderId != null ? folderById.get(folderId) : undefined;
    const seen = new Set<number>();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      path.unshift(cursor);
      cursor = cursor.parentId != null ? folderById.get(cursor.parentId) : undefined;
    }
    return path;
  }, [folderId, folderById]);

  const subCount = useMemo(() => {
    const counts = new Map<number | null, number>();
    for (const f of vault.folders) counts.set(f.parentId, (counts.get(f.parentId) ?? 0) + 1);
    return counts;
  }, [vault.folders]);

  const searching = query.trim().length > 0;

  const childrenOf = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const f of vault.folders) {
      if (f.parentId == null) continue;
      const list = map.get(f.parentId) ?? [];
      list.push(f.id);
      map.set(f.parentId, list);
    }
    return map;
  }, [vault.folders]);

  /** The folder being viewed plus every folder inside it, at any depth. */
  const subtree = useMemo(() => {
    if (folderId == null) return null;
    const set = new Set<number>([folderId]);
    const stack = [folderId];
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      for (const child of childrenOf.get(cur) ?? []) {
        if (!set.has(child)) {
          set.add(child);
          stack.push(child);
        }
      }
    }
    return set;
  }, [folderId, childrenOf]);

  /** Files in a folder plus all of its sub-folders. */
  const deepCount = useMemo(() => {
    const memo = new Map<number, number>();
    const calc = (id: number, depth: number): number => {
      const known = memo.get(id);
      if (known != null) return known;
      if (depth > 60) return 0;
      let n = folderById.get(id)?.itemCount ?? 0;
      for (const child of childrenOf.get(id) ?? []) n += calc(child, depth + 1);
      memo.set(id, n);
      return n;
    };
    for (const f of vault.folders) calc(f.id, 0);
    return memo;
  }, [vault.folders, folderById, childrenOf]);

  const pathOf = useCallback(
    (id: number | null): string => {
      const names: string[] = [];
      const seen = new Set<number>();
      let cursor = id != null ? folderById.get(id) : undefined;
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        names.unshift(cursor.name);
        cursor = cursor.parentId != null ? folderById.get(cursor.parentId) : undefined;
      }
      return names.join(" › ");
    },
    [folderById],
  );

  // Which files are listed:
  //  - listAll: from every folder (all-files view, a search over everything, or "include sub-folders" at home)
  //  - scoped:  this folder and the folders inside it
  //  - otherwise: only files directly in this folder
  const searchAll = searching && !(searchHere && folderId != null);
  const listAll = showAll || searchAll || (includeSub && folderId == null);
  const scoped = !listAll && folderId != null && (includeSub || searching);
  const flat = listAll || scoped;
  // Folder cards and "new folder" make sense while browsing, not while searching or listing everything.
  const atFolderView = !showAll && !searching;

  const childFolders = useMemo(() => {
    if (showAll) return [];
    let list: VaultFolder[];
    if (searching) {
      const q = query.trim().toLocaleLowerCase();
      list = vault.folders.filter((f) => {
        if (!f.name.toLocaleLowerCase().includes(q)) return false;
        if (searchHere && folderId != null) return subtree?.has(f.id) === true && f.id !== folderId;
        return true;
      });
    } else {
      list = vault.folders.filter((f) => f.parentId === folderId);
    }
    list = [...list].sort((a, b) => a.name.localeCompare(b.name, "bn"));
    const total = (f: VaultFolder) => deepCount.get(f.id) ?? f.itemCount;
    switch (sort) {
      case "name-desc":
        list.reverse();
        break;
      case "new":
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "old":
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case "big":
        list.sort((a, b) => total(b) - total(a));
        break;
      case "small":
        list.sort((a, b) => total(a) - total(b));
        break;
      default:
        break;
    }
    return list;
  }, [vault.folders, folderId, showAll, searching, searchHere, query, subtree, deepCount, sort]);

  const anyHidden = useMemo(() => vault.items.some((i) => i.hidden), [vault.items]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = vault.items.filter((item) => {
      if (!listAll) {
        if (scoped) {
          if (item.folderId == null || !subtree?.has(item.folderId)) return false;
        } else if (item.folderId !== folderId) {
          return false;
        }
      }
      if (typeFilter !== "all" && item.kind !== typeFilter) return false;
      if (usageFilter === "used" && item.usageCount === 0) return false;
      if (usageFilter === "unused" && item.usageCount > 0) return false;
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      if (hiddenOnly && !item.hidden) return false;
      if (q && !displayName(item).toLocaleLowerCase().includes(q)) return false;
      return true;
    });
    return sortItems(list, sort);
  }, [vault.items, listAll, scoped, subtree, folderId, typeFilter, usageFilter, sourceFilter, hiddenOnly, query, sort]);

  const activeCount =
    (typeFilter !== "all" ? 1 : 0) +
    (usageFilter !== "all" ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    (hiddenOnly ? 1 : 0) +
    (includeSub ? 1 : 0);

  function resetFilters() {
    setQuery("");
    setTypeFilter("all");
    setUsageFilter("all");
    setSourceFilter("all");
    setHiddenOnly(false);
    setIncludeSub(false);
    setSearchHere(false);
  }

  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      visible.map((item) => ({
        id: String(item.id),
        kind: item.kind,
        src: item.src,
        url: item.url ?? undefined,
        title: displayName(item),
      })),
    [visible],
  );

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function goFolder(id: number | null) {
    setFolderId(id);
    setShowAll(false);
    setQuery("");
    exitSelect();
  }

  // ---- drag & drop (desktop) ------------------------------------------------
  function onTileDragStart(e: DragEvent, item: VaultItem) {
    const ids = selected.has(item.id) && selected.size > 0 ? [...selected] : [item.id];
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  }

  function readDragIds(e: DragEvent): number[] | null {
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return null;
    try {
      const ids = JSON.parse(raw) as unknown;
      return Array.isArray(ids) && ids.every((n) => typeof n === "number") ? (ids as number[]) : null;
    } catch {
      return null;
    }
  }

  function dropProps(target: number | "home") {
    return {
      onDragOver: (e: DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(target);
      },
      onDragLeave: () => setDropTarget((cur) => (cur === target ? null : cur)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setDropTarget(null);
        const ids = readDragIds(e);
        if (!ids) return;
        void run(() => moveMedia({ data: { ids, folderId: target === "home" ? null : target } }));
        exitSelect();
      },
    };
  }

  // ---- modal submit handlers ------------------------------------------------
  async function submitName(name: string) {
    if (!modal) return;
    const current = modal;
    setModal(null);
    if (current.type === "new-folder") {
      await run(() => createFolder({ data: { name, parentId: current.parentId } }));
    } else if (current.type === "rename-folder") {
      await run(() => renameFolder({ data: { id: current.folder.id, name } }));
    } else if (current.type === "rename-item") {
      await run(() => renameMedia({ data: { id: current.item.id, title: name } }));
    }
  }

  async function submitMove(dest: number | null) {
    if (!modal || modal.type !== "move") return;
    const { target } = modal;
    setModal(null);
    if (target.kind === "items") {
      await run(() => moveMedia({ data: { ids: target.ids, folderId: dest } }));
      exitSelect();
    } else {
      await run(() => moveFolder({ data: { id: target.id, parentId: dest } }));
    }
  }

  async function confirmDeleteItems(ids: number[], force: boolean) {
    setModal(null);
    await run(async () => {
      const result = await deleteMediaSafe({ data: { ids, force } });
      if (result.skipped.length > 0) {
        setNotice(`${bn(result.skipped.length)} টি ফাইল ব্যবহৃত, তাই রাখা হয়েছে।`);
      }
    });
    exitSelect();
  }

  async function confirmDeleteFolder(folder: VaultFolder) {
    setModal(null);
    if (folderId === folder.id) setFolderId(folder.parentId);
    await run(() => deleteFolder({ data: { id: folder.id } }));
  }

  function renderItem(item: VaultItem, i: number) {
    const isSel = selected.has(item.id);
    const where = flat && item.folderId != null ? pathOf(item.folderId) : "";
    const thumb = item.thumbSrc ? (
      <img src={item.thumbSrc} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
    ) : (
      <span className="grid h-full w-full place-items-center bg-surface-2 text-lamp">
        <Video className="size-8" />
      </span>
    );
    const usageBadge =
      item.usageCount > 0 ? (
        <span
          title="বই, মাঙ্গা বা প্রচ্ছদে ব্যবহৃত"
          className="mf-pop inline-flex h-6 items-center gap-1 rounded-full bg-bg/80 px-2 font-sans text-[0.65rem] text-fg backdrop-blur-sm"
        >
          <Link2 className="size-3" strokeWidth={2} />
          {bn(item.usageCount)}
        </span>
      ) : null;
    const actions = (
      <>
        <HideToggle kind="media" id={item.id} hidden={!!item.hidden} variant="tile" onChanged={() => void refresh()} />
        <TileBtn label="নাম বদলান" onClick={() => setModal({ type: "rename-item", item })}>
          <Pencil className="size-4" />
        </TileBtn>
        <TileBtn
          label="ফোল্ডারে সরান"
          onClick={() => setModal({ type: "move", target: { kind: "items", ids: [item.id] } })}
        >
          <FolderInput className="size-4" />
        </TileBtn>
        <TileBtn label="মুছুন" onClick={() => setModal({ type: "delete-items", ids: [item.id] })}>
          <Trash2 className="size-4" />
        </TileBtn>
      </>
    );
    const checkBox = (
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-2 left-2 grid size-6 place-items-center rounded-md border",
          isSel ? "border-lamp bg-accent text-accent-fg" : "border-border bg-bg/70 text-transparent",
        )}
      >
        <Check className="size-4" strokeWidth={2.25} />
      </span>
    );

    /* ---- list view: one row per file ---- */
    if (view === "list") {
      return (
        <li
          key={item.id}
          draggable
          onDragStart={(e) => onTileDragStart(e, item)}
          style={{ "--i": i } as CSSProperties}
          className={cn(
            "mf-tile mf-rise group relative flex items-center gap-3 rounded-lg border bg-surface p-2",
            isSel ? "border-lamp ring-2 ring-lamp" : "border-border",
          )}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label={displayName(item)}
            aria-pressed={selectMode ? isSel : undefined}
            onClick={() => (selectMode ? toggleSelect(item.id) : setOpen(i))}
          >
            <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
              {thumb}
              {selectMode ? checkBox : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-sans text-sm text-fg">{displayName(item)}</span>
              <span className="block truncate font-sans text-xs text-subtle">
                {lang === "en" ? (item.kind === "video" ? "Video" : "Image") : item.kind === "video" ? "ভিডিও" : "ছবি"} ·{" "}
                {formatBytes(item.bytes)} ·{" "}
                {new Date(item.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                {where ? ` · ${where}` : ""}
              </span>
            </span>
          </button>
          {usageBadge}
          {item.hidden ? (
            <span className="rounded-full bg-bg/80 px-2 py-0.5 font-sans text-[0.65rem] text-lamp">লুকানো</span>
          ) : null}
          {!selectMode ? <div className="flex shrink-0 gap-1">{actions}</div> : null}
        </li>
      );
    }

    /* ---- grid views: large cards, small grid, pictures only ---- */
    const covers = view === "covers";
    return (
      <li
        key={item.id}
        draggable
        onDragStart={(e) => onTileDragStart(e, item)}
        style={{ "--i": i } as CSSProperties}
        className={cn(
          "mf-tile mf-rise group relative overflow-hidden rounded-md border bg-surface",
          view === "large" ? "aspect-[4/3]" : "aspect-square",
          isSel ? "border-lamp ring-2 ring-lamp" : "border-border",
        )}
      >
        <button
          type="button"
          className="block h-full w-full"
          aria-label={displayName(item)}
          aria-pressed={selectMode ? isSel : undefined}
          onClick={() => (selectMode ? toggleSelect(item.id) : setOpen(i))}
        >
          {thumb}
          {item.kind === "video" && item.thumbSrc ? (
            <span className="absolute inset-0 grid place-items-center bg-bg/25">
              <Video className="size-8 text-fg" />
            </span>
          ) : null}
          {!covers ? (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-8 pb-2 text-left">
              <span className={cn("block truncate font-sans text-[#f2ede3]", view === "large" ? "text-sm" : "text-xs")}>
                {displayName(item)}
              </span>
              <span className="block truncate font-sans text-[0.65rem] text-[#f2ede3]/70">
                {formatBytes(item.bytes)}
                {where ? ` · ${where}` : ""}
              </span>
            </span>
          ) : null}
        </button>

        {item.hidden ? (
          <span
            className={cn(
              "pointer-events-none absolute left-2 z-10 rounded-full bg-bg/80 px-2 py-0.5 font-sans text-[0.65rem] text-lamp backdrop-blur-sm",
              covers ? "bottom-2" : "bottom-11",
            )}
          >
            লুকানো
          </span>
        ) : null}
        {usageBadge ? (
          <span
            className={cn(
              "pointer-events-none absolute z-10",
              selectMode ? "top-2 left-10" : "top-2 left-2",
            )}
          >
            {usageBadge}
          </span>
        ) : null}
        {selectMode ? (
          checkBox
        ) : (
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
            {actions}
          </div>
        )}
      </li>
    );
  }

  const targetLabel = trail.length > 0 ? `“${trail[trail.length - 1].name}”` : "হোম";
  const unfiledCount = vault.items.filter((i) => i.folderId == null).length;
  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));

  return (
    <main className="mf-page relative min-h-dvh pb-28">
      <div className="mf-aurora" aria-hidden="true" />
      <SiteNav active="gallery" />
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <p className="mf-eyebrow flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
          <Images className="size-4" strokeWidth={1.6} />
          চিত্রশালা
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl" aria-label="ছবি ও ভিডিও">
          {"ছবি ও ভিডিও".split(" ").map((word, i) => (
            <span key={word} aria-hidden="true" className="mf-word" style={{ "--w": i } as CSSProperties}>
              {word}
            </span>
          ))}
        </h1>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted">
          ফোল্ডার ও সাবফোল্ডার বানিয়ে ছবি ও ভিডিও গুছিয়ে রাখুন। সাজান, খুঁজুন, ফিল্টার করুন, একসাথে অনেকগুলো বেছে সরান —
          ফাইল টেনে ফোল্ডারে ছেড়েও দেওয়া যায়।
        </p>
        <button
          type="button"
          onClick={() => setTrashOpen(true)}
          className="pressable mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 font-sans text-sm text-fg hover:bg-surface-2"
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
          ট্রাশ
        </button>

        {/* Where am I */}
        <nav aria-label="ফোল্ডার পথ" className="mt-8 flex flex-wrap items-center gap-1 font-sans text-sm">
          <button
            type="button"
            onClick={() => goFolder(null)}
            {...dropProps("home")}
            className={cn(
              "pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3",
              folderId == null && !showAll ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              dropTarget === "home" && "ring-2 ring-lamp",
            )}
          >
            <Home className="size-3.5" strokeWidth={1.75} />
            হোম
          </button>
          {trail.map((f, i) => (
            <span key={f.id} className="inline-flex items-center gap-1">
              <ChevronRight className="size-3.5 text-subtle" />
              <button
                type="button"
                onClick={() => goFolder(f.id)}
                {...dropProps(f.id)}
                className={cn(
                  "pressable inline-flex h-10 max-w-[12rem] items-center rounded-full px-3",
                  i === trail.length - 1 && !showAll
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                  dropTarget === f.id && "ring-2 ring-lamp",
                )}
              >
                <span className="truncate">{f.name}</span>
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              setShowAll((v) => !v);
              exitSelect();
            }}
            className={cn(
              "pressable ml-auto inline-flex h-10 items-center rounded-full border px-3 text-xs",
              showAll ? "border-lamp text-fg" : "border-border text-muted",
            )}
            aria-pressed={showAll}
          >
            সব ফাইল ({bn(vault.items.length)})
          </button>
        </nav>

        {/* Toolbar */}
        <div className="sticky top-[4.5rem] z-30 mt-4 space-y-2 rounded-2xl border border-border bg-bg/85 p-2 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-52 flex-1">
              <span className="sr-only">ফাইল বা ফোল্ডার খুঁজুন</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("");
                }}
                placeholder={
                  searchHere && folderId != null ? "এই ফোল্ডারে খুঁজুন…" : "ফাইল বা ফোল্ডারের নাম খুঁজুন…"
                }
                className="h-11 w-full rounded-lg border border-border bg-surface pr-9 pl-9 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-lamp"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="মুছুন"
                  className="pressable absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </label>

            <label className="relative">
              <span className="sr-only">সাজান</span>
              <ArrowUpDown className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <select
                value={sort}
                onChange={(e) => changeSort(e.target.value as SortKey)}
                className="h-11 w-full appearance-none rounded-lg border border-border bg-surface pr-8 pl-9 font-sans text-xs text-fg outline-none focus:border-lamp sm:w-44"
              >
                {SORTS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex rounded-full border border-border p-0.5" role="group" aria-label="দেখার ধরন">
              {VIEWS.map((v) => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.id}
                    type="button"
                    title={v.label}
                    aria-label={v.label}
                    aria-pressed={view === v.id}
                    onClick={() => changeView(v.id)}
                    className={cn(
                      "pressable grid size-9 place-items-center rounded-full",
                      view === v.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={cn(
                "pressable inline-flex h-11 items-center gap-1.5 rounded-full border px-3 font-sans text-xs",
                filtersOpen || activeCount ? "border-lamp text-lamp" : "border-border text-muted hover:text-fg",
              )}
            >
              <SlidersHorizontal className="size-4" />
              ফিল্টার{activeCount ? ` (${bn(activeCount)})` : ""}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 font-sans text-xs text-muted">
            <span className="text-fg">{`${bn(visible.length)}টি ফাইল`}</span>
            {childFolders.length > 0 ? <span>{`${bn(childFolders.length)}টি ফোল্ডার`}</span> : null}
            {scoped ? <span>সাবফোল্ডারসহ</span> : null}
            {query || activeCount ? (
              <button type="button" onClick={resetFilters} className="pressable text-lamp">
                সব ফিল্টার মুছুন
              </button>
            ) : null}
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-3 space-y-3 rounded-2xl border border-border bg-surface p-4">
            <FilterRow label="ধরন">
              {(
                [
                  ["all", "সব"],
                  ["image", "ছবি"],
                  ["video", "ভিডিও"],
                ] as const
              ).map(([id, label]) => (
                <Chip key={id} active={typeFilter === id} onClick={() => setTypeFilter(id)}>
                  {label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="ব্যবহার">
              {(
                [
                  ["all", "সব"],
                  ["used", "ব্যবহৃত"],
                  ["unused", "অব্যবহৃত"],
                ] as const
              ).map(([id, label]) => (
                <Chip key={id} active={usageFilter === id} onClick={() => setUsageFilter(id)}>
                  {label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="উৎস">
              {(
                [
                  ["all", "সব"],
                  ["upload", "আপলোড"],
                  ["url", "লিংক"],
                ] as const
              ).map(([id, label]) => (
                <Chip key={id} active={sourceFilter === id} onClick={() => setSourceFilter(id)}>
                  {label}
                </Chip>
              ))}
            </FilterRow>
            {anyHidden ? (
              <FilterRow label="লুকানো">
                <Chip active={hiddenOnly} onClick={() => setHiddenOnly((v) => !v)}>
                  শুধু লুকানো ফাইল
                </Chip>
              </FilterRow>
            ) : null}
            <FilterRow label="সাবফোল্ডার">
              <Chip active={includeSub} onClick={() => setIncludeSub((v) => !v)}>
                ভেতরের সাবফোল্ডারের ফাইলও দেখান
              </Chip>
              {folderId != null ? (
                <Chip active={searchHere} onClick={() => setSearchHere((v) => !v)}>
                  খোঁজা শুধু এই ফোল্ডারে
                </Chip>
              ) : null}
            </FilterRow>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            aria-expanded={showUpload}
            className="pressable inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-fg"
          >
            <Upload className="size-3.5" strokeWidth={1.75} />
            আপলোড
          </button>
          {atFolderView ? (
            <button
              type="button"
              onClick={() => setModal({ type: "new-folder", parentId: folderId })}
              className="pressable inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-fg"
            >
              <FolderPlus className="size-3.5" strokeWidth={1.75} />
              {folderId != null ? "নতুন সাবফোল্ডার" : "নতুন ফোল্ডার"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            aria-pressed={selectMode}
            className={cn(
              "pressable inline-flex h-10 items-center gap-1.5 rounded-full border px-3 font-sans text-xs",
              selectMode ? "border-lamp text-fg" : "border-border text-fg",
            )}
          >
            <Check className="size-3.5" strokeWidth={1.75} />
            {selectMode ? "বাছাই বন্ধ" : "বাছুন"}
          </button>
        </div>

        {showUpload ? (
          <div className="mt-5">
            <MultiUploader
              targetLabel={targetLabel}
              onUploaded={async (ids) => {
                await run(async () => {
                  if (folderId != null && atFolderView) await moveMedia({ data: { ids, folderId } });
                });
              }}
            />
          </div>
        ) : null}

        {notice ? (
          <p
            role="alert"
            className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 font-sans text-sm text-nsfw"
          >
            {notice}
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="বন্ধ"
              className="pressable grid size-8 shrink-0 place-items-center rounded-full text-muted"
            >
              <X className="size-4" />
            </button>
          </p>
        ) : null}

        {/* Folders (and sub-folders of the folder being viewed) */}
        {childFolders.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-sans text-xs tracking-[0.18em] text-subtle">
              {searching ? "মেলে এমন ফোল্ডার" : folderId != null ? "সাবফোল্ডার" : "ফোল্ডার"} · {bn(childFolders.length)}
            </h2>
            <div key={`f-${folderId}-${showAll}-${view}`} className={cn("mt-3 grid gap-3", FOLDER_GRID[view])}>
              {childFolders.map((f, fi) => {
                const subs = subCount.get(f.id) ?? 0;
                const total = deepCount.get(f.id) ?? f.itemCount;
                return (
                  <div
                    key={f.id}
                    {...dropProps(f.id)}
                    style={{ "--i": fi } as CSSProperties}
                    className={cn(
                      "mf-card mf-rise group flex items-center gap-1 rounded-xl border border-border bg-surface pr-1",
                      dropTarget === f.id && "border-lamp bg-surface-2 ring-2 ring-lamp",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => goFolder(f.id)}
                      className="pressable flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left"
                    >
                      <Folder className="mf-folder-icon size-6 shrink-0 text-lamp" strokeWidth={1.5} />
                      <span className="min-w-0">
                        <span className="mf-name block truncate font-sans text-sm text-fg">{f.name}</span>
                        {searching && f.parentId != null ? (
                          <span className="block truncate font-sans text-[0.65rem] text-subtle">{pathOf(f.parentId)}</span>
                        ) : null}
                        <span className="block font-sans text-xs text-subtle">
                          <span>{`${bn(f.itemCount)}টি ফাইল`}</span>
                          {subs ? <span> · {`${bn(subs)} সাবফোল্ডার`}</span> : null}
                          {subs && total !== f.itemCount ? <span> · {`মোট ${bn(total)}`}</span> : null}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center opacity-70 group-hover:opacity-100 focus-within:opacity-100">
                      <IconBtn label="সাবফোল্ডার বানান" onClick={() => setModal({ type: "new-folder", parentId: f.id })}>
                        <FolderPlus className="size-4" />
                      </IconBtn>
                      <IconBtn label="নাম বদলান" onClick={() => setModal({ type: "rename-folder", folder: f })}>
                        <Pencil className="size-4" />
                      </IconBtn>
                      <IconBtn label="সরান" onClick={() => setModal({ type: "move", target: { kind: "folder", id: f.id } })}>
                        <FolderInput className="size-4" />
                      </IconBtn>
                      <IconBtn label="মুছুন" onClick={() => setModal({ type: "delete-folder", folder: f })}>
                        <Trash2 className="size-4" />
                      </IconBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Files */}
        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-xs tracking-[0.18em] text-subtle">
              {searching ? "খোঁজার ফল" : showAll ? "সব ফাইল" : "ফাইল"} · {bn(visible.length)}
            </h2>
            {selectMode && visible.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelected(allSelected ? new Set() : new Set(visible.map((i) => i.id)))}
                className="pressable h-10 rounded-full px-3 font-sans text-xs text-muted hover:text-fg"
              >
                {allSelected ? "কোনোটিই নয়" : "সব বাছুন"}
              </button>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <p className="mf-empty mt-6 font-sans text-sm text-muted">
              {searching || activeCount > 0
                ? "মেলে এমন কিছু পাওয়া যায়নি।"
                : vault.items.length === 0
                  ? "এখনো কিছু যোগ হয়নি। ওপরের “আপলোড” চেপে শুরু করুন।"
                  : folderId == null && !showAll
                    ? `হোমে আলাদা করা ফাইল নেই${unfiledCount ? "" : " — সবই ফোল্ডারে গোছানো"}।`
                    : "এই ফোল্ডারে এখনো কিছু নেই। ফাইল টেনে এনে ছাড়ুন বা আপলোড করুন।"}
            </p>
          ) : (
            <ul key={`t-${folderId}-${showAll}-${view}`} className={cn("mt-4", TILE_GRID[view])}>
              {visible.map((item, i) => renderItem(item, i))}
            </ul>
          )}
        </div>
      </section>

      {/* Selection bar */}
      {selectMode && selected.size > 0 ? (
        <div
          role="toolbar"
          aria-label="বাছাই করা ফাইলের কাজ"
          className="mf-bar fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-md"
        >
          <span className="font-sans text-sm text-fg">{bn(selected.size)} টি বাছা</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModal({ type: "move", target: { kind: "items", ids: [...selected] } })}
              className="pressable inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 font-sans text-xs text-accent-fg"
            >
              <FolderInput className="size-4" />
              সরান
            </button>
            <button
              type="button"
              onClick={() => setModal({ type: "delete-items", ids: [...selected] })}
              className="pressable inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 font-sans text-xs text-fg"
            >
              <Trash2 className="size-4" />
              মুছুন
            </button>
            <button
              type="button"
              onClick={exitSelect}
              aria-label="বাতিল"
              className="pressable grid size-10 place-items-center rounded-lg text-muted"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Dialogs */}
      {modal?.type === "new-folder" ? (
        <NameDialog
          title={modal.parentId != null ? "নতুন সাবফোল্ডার" : "নতুন ফোল্ডার"}
          hint={modal.parentId != null ? `“${pathOf(modal.parentId)}” এর ভেতরে` : "হোমে"}
          submitLabel="তৈরি করুন"
          initial=""
          placeholder="ফোল্ডারের নাম"
          onSubmit={(v) => void submitName(v)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.type === "rename-folder" ? (
        <NameDialog
          title="ফোল্ডারের নাম বদলান"
          submitLabel="সংরক্ষণ"
          initial={modal.folder.name}
          placeholder="ফোল্ডারের নাম"
          onSubmit={(v) => void submitName(v)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.type === "rename-item" ? (
        <NameDialog
          title="ফাইলের নাম"
          submitLabel="সংরক্ষণ"
          initial={modal.item.title}
          placeholder="নাম লিখুন"
          allowEmpty
          onSubmit={(v) => void submitName(v)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.type === "move" ? (
        <MoveDialog
          folders={vault.folders}
          movingFolderId={modal.target.kind === "folder" ? modal.target.id : null}
          currentId={
            modal.target.kind === "folder"
              ? (folderById.get(modal.target.id)?.parentId ?? null)
              : modal.target.ids.length === 1
                ? (vault.items.find((i) => i.id === (modal.target as { ids: number[] }).ids[0])?.folderId ?? null)
                : undefined
          }
          onPick={(dest) => void submitMove(dest)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {trashOpen ? <TrashDialog onClose={() => setTrashOpen(false)} onChanged={() => void refresh()} /> : null}
      {modal?.type === "delete-items" ? (
        <DeleteItemsDialog
          ids={modal.ids}
          names={new Map(vault.items.map((i) => [i.id, displayName(i)]))}
          onDelete={(force) => void confirmDeleteItems(modal.ids, force)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.type === "delete-folder" ? (
        <ConfirmDialog
          title={`“${modal.folder.name}” ফোল্ডার মুছবেন?`}
          body="শুধু ফোল্ডারটি যাবে। ভেতরের ছবি, ভিডিও আর ফোল্ডার এক ধাপ ওপরে সরে যাবে — কিছুই মুছবে না।"
          confirmLabel="ফোল্ডার মুছুন"
          onConfirm={() => void confirmDeleteFolder(modal.folder)}
          onClose={() => setModal(null)}
        />
      ) : null}

      {open != null && lightboxItems.length > 0 ? (
        <Lightbox items={lightboxItems} index={Math.min(open, lightboxItems.length - 1)} onClose={() => setOpen(null)} onIndex={setOpen} />
      ) : null}
    </main>
  );
}

/* ------------------------------------------------------------------------ */

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "pressable h-9 rounded-full px-3 font-sans text-xs",
        active ? "bg-accent text-accent-fg" : "border border-border text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-20 shrink-0 font-sans text-[11px] text-muted">{label}</span>
      {children}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="pressable grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  );
}

function TileBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="pressable grid size-9 place-items-center rounded-full bg-bg/75 text-fg backdrop-blur-sm"
    >
      {children}
    </button>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="বন্ধ"
        onClick={onClose}
        className="mf-scrim absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div className="mf-dialog relative w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl sm:p-6">
        <h2 className="font-display text-xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function NameDialog({
  title,
  hint,
  initial,
  placeholder,
  submitLabel,
  allowEmpty = false,
  onSubmit,
  onClose,
}: {
  title: string;
  hint?: string;
  initial: string;
  placeholder: string;
  submitLabel: string;
  allowEmpty?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const ok = allowEmpty || value.trim().length > 0;

  return (
    <Dialog title={title} onClose={onClose}>
      {hint ? <p className="mt-1 font-sans text-xs text-subtle">{hint}</p> : null}
      <input
        ref={ref}
        value={value}
        maxLength={allowEmpty ? 160 : 80}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && ok) onSubmit(value);
        }}
        className="mt-4 h-11 w-full rounded-lg border border-border bg-bg px-3 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-lamp"
      />
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="pressable h-11 rounded-lg border border-border px-4 font-sans text-sm text-fg"
        >
          বাতিল
        </button>
        <button
          type="button"
          disabled={!ok}
          onClick={() => onSubmit(value)}
          className="pressable h-11 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </Dialog>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="mt-3 font-sans text-sm leading-relaxed text-muted">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="pressable h-11 rounded-lg border border-border px-4 font-sans text-sm text-fg"
        >
          থাক
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="pressable h-11 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

const USAGE_NOTE: Record<MediaUsage["kind"], string> = {
  manga: "মাঙ্গার প্যানেল মুছে যাবে",
  cover: "প্রচ্ছদ খালি হয়ে যাবে",
  story: "গল্পে ছবির জায়গা ভাঙা দেখাবে",
};

function DeleteItemsDialog({
  ids,
  names,
  onDelete,
  onClose,
}: {
  ids: number[];
  names: Map<number, string>;
  onDelete: (force: boolean) => void;
  onClose: () => void;
}) {
  const [usage, setUsage] = useState<Record<number, MediaUsage[]> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getMediaUsage({ data: { ids } })
      .then((u) => live && setUsage(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [ids]);

  const usedIds = usage ? ids.filter((id) => usage[id]?.length) : [];
  const freeCount = usage ? ids.length - usedIds.length : 0;
  const kinds = new Set(usedIds.flatMap((id) => usage?.[id]?.map((u) => u.kind) ?? []));

  return (
    <Dialog title={`${bn(ids.length)} টি ফাইল মুছবেন?`} onClose={onClose}>
      {failed ? (
        <p className="mt-3 font-sans text-sm leading-relaxed text-nsfw">
          কোথায় ব্যবহৃত তা যাচাই করা যায়নি, তাই নিরাপত্তার জন্য মোছা বন্ধ রাখা হয়েছে। একটু পরে আবার চেষ্টা করুন।
        </p>
      ) : usage == null ? (
        <p className="mt-3 font-sans text-sm text-muted">কোথায় ব্যবহৃত দেখা হচ্ছে…</p>
      ) : usedIds.length === 0 ? (
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          কোনো বই, মাঙ্গা বা প্রচ্ছদে এগুলো ব্যবহার হচ্ছে না। ফাইলগুলো ট্রাশে যাবে — দরকার হলে ট্রাশ থেকে ফেরত আনা যাবে।
        </p>
      ) : (
        <>
          <p className="mt-3 flex items-start gap-2 font-sans text-sm leading-relaxed text-fg">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-lamp" />
            {bn(usedIds.length)} টি ফাইল এখনো ব্যবহৃত হচ্ছে। সাধারণ মোছায় এগুলো রেখে দেওয়া হবে।
          </p>
          <ul className="mt-3 max-h-[32dvh] space-y-3 overflow-y-auto rounded-lg border border-border bg-bg p-3">
            {usedIds.map((id) => (
              <li key={id} className="font-sans text-xs">
                <span className="block truncate text-sm text-fg">{names.get(id) ?? `#${id}`}</span>
                {usage?.[id]?.map((u) => (
                  <span key={u.label} className="block truncate text-muted">
                    {u.label}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-sans text-xs leading-relaxed text-subtle">
            জোর করে মুছলে:
            {kinds.has("manga") ? ` ${USAGE_NOTE.manga};` : ""}
            {kinds.has("cover") ? ` ${USAGE_NOTE.cover};` : ""}
            {kinds.has("story") ? ` ${USAGE_NOTE.story} (আগে স্টুডিও থেকে ছবিটি সরিয়ে নিন)` : ""}
          </p>
          <p className="mt-2 font-sans text-xs leading-relaxed text-subtle">
            ফাইল ট্রাশে যাবে — ফেরত আনলে সব আগের মতো হয়ে যাবে।
          </p>
        </>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="pressable h-11 rounded-lg border border-border px-4 font-sans text-sm text-fg"
        >
          থাক
        </button>
        {usage && usedIds.length > 0 ? (
          <button
            type="button"
            onClick={() => onDelete(true)}
            className="pressable h-11 rounded-lg border border-nsfw px-4 font-sans text-sm text-nsfw"
          >
            তবুও সব মুছুন
          </button>
        ) : null}
        {usage && (usedIds.length === 0 || freeCount > 0) ? (
          <button
            type="button"
            onClick={() => onDelete(false)}
            className="pressable h-11 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg"
          >
            {usedIds.length === 0 ? "মুছুন" : `শুধু অব্যবহৃত ${bn(freeCount)} টি মুছুন`}
          </button>
        ) : null}
      </div>
    </Dialog>
  );
}

function MoveDialog({
  folders,
  movingFolderId,
  currentId,
  onPick,
  onClose,
}: {
  folders: VaultFolder[];
  /** When moving a folder, it and everything inside it are not valid targets. */
  movingFolderId: number | null;
  /** Where the thing lives now (undefined = several items, mixed). */
  currentId: number | null | undefined;
  onPick: (dest: number | null) => void;
  onClose: () => void;
}) {
  const rows = useMemo(() => {
    const byParent = new Map<number | null, VaultFolder[]>();
    for (const f of folders) {
      const list = byParent.get(f.parentId) ?? [];
      list.push(f);
      byParent.set(f.parentId, list);
    }
    const out: { folder: VaultFolder; depth: number; blocked: boolean }[] = [];
    const walk = (parent: number | null, depth: number, blocked: boolean) => {
      const list = (byParent.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name, "bn"));
      for (const f of list) {
        const isBlocked = blocked || f.id === movingFolderId;
        out.push({ folder: f, depth, blocked: isBlocked });
        walk(f.id, depth + 1, isBlocked);
      }
    };
    walk(null, 0, false);
    return out;
  }, [folders, movingFolderId]);

  return (
    <Dialog title="কোথায় সরাবেন?" onClose={onClose}>
      <div className="mt-4 max-h-[50dvh] space-y-1 overflow-y-auto">
        <button
          type="button"
          disabled={currentId === null}
          onClick={() => onPick(null)}
          className="pressable flex h-11 w-full items-center gap-2 rounded-lg px-3 text-left font-sans text-sm text-fg hover:bg-surface-2 disabled:opacity-40"
        >
          <Home className="size-4 text-lamp" strokeWidth={1.6} />
          হোম
          {currentId === null ? <span className="ml-auto text-xs text-subtle">এখানেই আছে</span> : null}
        </button>
        {rows.map(({ folder, depth, blocked }) => (
          <button
            key={folder.id}
            type="button"
            disabled={blocked || currentId === folder.id}
            onClick={() => onPick(folder.id)}
            style={{ paddingLeft: `${0.75 + depth * 1.1}rem` }}
            className="pressable flex h-11 w-full items-center gap-2 rounded-lg pr-3 text-left font-sans text-sm text-fg hover:bg-surface-2 disabled:opacity-40"
          >
            <Folder className="size-4 shrink-0 text-lamp" strokeWidth={1.6} />
            <span className="truncate">{folder.name}</span>
            {currentId === folder.id ? <span className="ml-auto shrink-0 text-xs text-subtle">এখানেই আছে</span> : null}
          </button>
        ))}
        {rows.length === 0 ? (
          <p className="px-3 py-2 font-sans text-xs text-subtle">এখনো কোনো ফোল্ডার নেই — আগে একটি বানিয়ে নিন।</p>
        ) : null}
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="pressable h-11 rounded-lg border border-border px-4 font-sans text-sm text-fg"
        >
          বাতিল
        </button>
      </div>
    </Dialog>
  );
}
