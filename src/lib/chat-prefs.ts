import { useCallback, useEffect, useState } from "react";

/** Colour themes for MY message bubbles. */
export const CHAT_THEMES = [
  { id: "default", label: "ডিফল্ট", from: "", to: "" },
  { id: "ember", label: "অঙ্গার", from: "#c2410c", to: "#7f1d1d" },
  { id: "ocean", label: "সাগর", from: "#0ea5e9", to: "#1d4ed8" },
  { id: "orchid", label: "অর্কিড", from: "#c026d3", to: "#6d28d9" },
  { id: "forest", label: "বন", from: "#16a34a", to: "#065f46" },
  { id: "sunset", label: "সূর্যাস্ত", from: "#f59e0b", to: "#e11d48" },
  { id: "mono", label: "কালি", from: "#525252", to: "#171717" },
] as const;

export type ChatPrefs = {
  muted: boolean;
  name: string;
  photo: string; // small JPEG data-URL, or ""
  theme: string;
  emoji: string;
  nicknames: Record<string, string>; // key = member id
};

export const DEFAULT_PREFS: ChatPrefs = {
  muted: false,
  name: "",
  photo: "",
  theme: "default",
  emoji: "👍",
  nicknames: {},
};

const key = (meId: number, peerId: number | null) => `chat-prefs:${meId}:${peerId ?? "group"}`;

function read(k: string): ChatPrefs {
  try {
    const raw = window.localStorage.getItem(k);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ChatPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Settings for one conversation. Saved in this browser only. */
export function useChatPrefs(meId: number, peerId: number | null) {
  const k = key(meId, peerId);
  const [prefs, setPrefs] = useState<ChatPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(read(k));
  }, [k]);

  const update = useCallback(
    (patch: Partial<ChatPrefs>) => {
      setPrefs((cur) => {
        const next = { ...cur, ...patch };
        try {
          window.localStorage.setItem(k, JSON.stringify(next));
        } catch {
          /* storage full or blocked: keep it for this visit only */
        }
        return next;
      });
    },
    [k],
  );

  return [prefs, update] as const;
}
