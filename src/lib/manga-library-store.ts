import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LibSort, LibView, Shelf, StatusFilter } from "@/lib/library-store";

/**
 * Browser-only manga library settings: view, sort, filters, favourites, shelves, reading times, manual order,
 * and which chapters have been read. Kept apart from the story library so a manga and a book can never clash.
 */
export type MangaLibData = {
  view: LibView;
  sort: LibSort;
  author: string | null;
  status: StatusFilter;
  favs: string[];
  shelves: Record<string, Shelf>;
  lastReadAt: Record<string, number>;
  order: string[];
  /** Chapters opened, per series. */
  read: Record<string, string[]>;
  /** The chapter opened last, per series (for "continue reading"). */
  lastChapter: Record<string, string>;
};

export const MANGA_LIB_DEFAULTS: MangaLibData = {
  view: "compact",
  sort: "default",
  author: null,
  status: "all",
  favs: [],
  shelves: {},
  lastReadAt: {},
  order: [],
  read: {},
  lastChapter: {},
};

type MangaLibState = MangaLibData & {
  setPrefs: (patch: Partial<MangaLibData>) => void;
  toggleFav: (slug: string) => void;
  setShelf: (slug: string, shelf: Shelf | null) => void;
  markRead: (series: string, chapter: string) => void;
};

export const useMangaLibraryStore = create<MangaLibState>()(
  persist(
    (set) => ({
      ...MANGA_LIB_DEFAULTS,
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
      markRead: (series, chapter) =>
        set((s) => {
          const done = s.read[series] ?? [];
          return {
            read: done.includes(chapter) ? s.read : { ...s.read, [series]: [...done, chapter] },
            lastChapter: { ...s.lastChapter, [series]: chapter },
            lastReadAt: { ...s.lastReadAt, [series]: Date.now() },
          };
        }),
    }),
    {
      name: "golpo-manga-library-v1",
      partialize: (s) => ({
        view: s.view,
        sort: s.sort,
        author: s.author,
        status: s.status,
        favs: s.favs,
        shelves: s.shelves,
        lastReadAt: s.lastReadAt,
        order: s.order,
        read: s.read,
        lastChapter: s.lastChapter,
      }),
    },
  ),
);
