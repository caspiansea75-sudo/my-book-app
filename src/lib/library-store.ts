import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LibView = "large" | "compact" | "list" | "covers";
export type LibSort =
  | "default"
  | "newest"
  | "oldest"
  | "az"
  | "za"
  | "most"
  | "least"
  | "recent"
  | "manual";
export type Shelf = "reading" | "later" | "done";
export type StatusFilter = "all" | "fav" | Shelf | "unread";
export type SourceFilter = "all" | "studio" | "canon";

export const SORTS: { id: LibSort; label: string }[] = [
  { id: "default", label: "সাম্প্রতিক আপডেট" },
  { id: "newest", label: "নতুন আগে" },
  { id: "oldest", label: "পুরনো আগে" },
  { id: "az", label: "নাম (অ → হ)" },
  { id: "za", label: "নাম (হ → অ)" },
  { id: "most", label: "বেশি অধ্যায়" },
  { id: "least", label: "কম অধ্যায়" },
  { id: "recent", label: "সাম্প্রতিক পড়া" },
  { id: "manual", label: "আমার ক্রম" },
];

export const SHELF_LABEL: Record<Shelf, string> = {
  reading: "পড়ছি",
  later: "পরে পড়ব",
  done: "শেষ",
};

export type LibraryData = {
  view: LibView;
  sort: LibSort;
  source: SourceFilter;
  tag: string | null;
  author: string | null;
  status: StatusFilter;
  hideSensitive: boolean;
  blurCovers: boolean;
  favs: string[];
  shelves: Record<string, Shelf>;
  lastReadAt: Record<string, number>;
  order: string[];
};

export const LIB_DEFAULTS: LibraryData = {
  view: "large",
  sort: "default",
  source: "all",
  tag: null,
  author: null,
  status: "all",
  hideSensitive: false,
  blurCovers: true,
  favs: [],
  shelves: {},
  lastReadAt: {},
  order: [],
};

type LibraryState = LibraryData & {
  setPrefs: (patch: Partial<LibraryData>) => void;
  toggleFav: (slug: string) => void;
  setShelf: (slug: string, shelf: Shelf | null) => void;
  touch: (slug: string) => void;
};

/** Browser-only library preferences: view, sort, filters, favourites, shelves, reading times, manual order. */
export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      ...LIB_DEFAULTS,
      setPrefs: (patch) => set(patch),
      toggleFav: (slug) =>
        set((s) => ({
          favs: s.favs.includes(slug) ? s.favs.filter((x) => x !== slug) : [...s.favs, slug],
        })),
      setShelf: (slug, shelf) =>
        set((s) => {
          const next = { ...s.shelves };
          if (shelf) next[slug] = shelf;
          else delete next[slug];
          return { shelves: next };
        }),
      touch: (slug) => set((s) => ({ lastReadAt: { ...s.lastReadAt, [slug]: Date.now() } })),
    }),
    {
      name: "golpo-library-v1",
      partialize: (s) => ({
        view: s.view,
        sort: s.sort,
        source: s.source,
        tag: s.tag,
        author: s.author,
        status: s.status,
        hideSensitive: s.hideSensitive,
        blurCovers: s.blurCovers,
        favs: s.favs,
        shelves: s.shelves,
        lastReadAt: s.lastReadAt,
        order: s.order,
      }),
    },
  ),
);
