import { create } from "zustand";
import { persist } from "zustand/middleware";

export const THEMES = [
  { id: "monsoon", label: "বর্ষা রাত", hint: "ধানমন্ডি বৃষ্টি" },
  { id: "cafe", label: "কফি হাউস", hint: "অ্যাম্বার ল্যাম্প" },
  { id: "manuscript", label: "হাতের খাতা", hint: "ক্রীম কাগজ" },
  { id: "leather", label: "পুরান ঢাকা", hint: "চামড়ার মলাট" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

type ReaderState = {
  theme: ThemeId;
  fontSize: number;
  nsfwMode: "hidden" | "shown";
  inverted: string[];
  lastByBook: Record<string, string>;
  progress: Record<string, string>;
  audioOn: boolean;
  warned: boolean;
  setTheme: (theme: ThemeId) => void;
  setFontSize: (n: number) => void;
  showAllNsfw: () => void;
  hideAllNsfw: () => void;
  togglePara: (id: string) => void;
  isParaVisible: (id: string, nsfw: boolean) => boolean;
  setLastSlug: (bookSlug: string, slug: string) => void;
  lastSlugFor: (bookSlug: string) => string | undefined;
  setProgress: (key: string, paraId: string) => void;
  setAudioOn: (on: boolean) => void;
  setWarned: () => void;
};

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      theme: "monsoon",
      fontSize: 19,
      nsfwMode: "hidden",
      inverted: [],
      lastByBook: {},
      progress: {},
      audioOn: false,
      warned: false,
      setTheme: (theme) => set({ theme }),
      setFontSize: (n) => set({ fontSize: Math.min(24, Math.max(16, n)) }),
      showAllNsfw: () => set({ nsfwMode: "shown", inverted: [] }),
      hideAllNsfw: () => set({ nsfwMode: "hidden", inverted: [] }),
      togglePara: (id) =>
        set((s) => ({
          inverted: s.inverted.includes(id)
            ? s.inverted.filter((x) => x !== id)
            : [...s.inverted, id],
        })),
      isParaVisible: (id, nsfw) => {
        if (!nsfw) return true;
        const { nsfwMode, inverted } = get();
        const flipped = inverted.includes(id);
        return nsfwMode === "shown" ? !flipped : flipped;
      },
      setLastSlug: (bookSlug, slug) =>
        set((s) => ({ lastByBook: { ...s.lastByBook, [bookSlug]: slug } })),
      lastSlugFor: (bookSlug) => get().lastByBook[bookSlug],
      setProgress: (key, paraId) =>
        set((s) => ({ progress: { ...s.progress, [key]: paraId } })),
      setAudioOn: (audioOn) => set({ audioOn }),
      setWarned: () => set({ warned: true }),
    }),
    {
      name: "golpo-reader-v2",
      partialize: (s) => ({
        theme: s.theme,
        fontSize: s.fontSize,
        nsfwMode: s.nsfwMode,
        inverted: s.inverted.slice(-400),
        lastByBook: s.lastByBook,
        progress: s.progress,
        audioOn: s.audioOn,
        warned: s.warned,
      }),
    },
  ),
);
