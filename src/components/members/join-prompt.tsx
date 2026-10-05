import { useCallback, useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { UserPlus, X } from "lucide-react";
import { create } from "zustand";
import { useMe } from "@/lib/use-me";

/**
 * The small "create an account" popup for guests.
 *
 * A guest can read, like and vote. Anything else (commenting, writing stories or manga,
 * the gallery, chat, profiles) opens this popup instead. Open it from anywhere with
 * `useGuestGate()`, or by redirecting to `/?join=<feature>` (see `redirectGuest` in `@/lib/auth/guest`).
 */

export type GuestFeature = "comment" | "create" | "gallery" | "chat" | "profile";

const COPY: Record<GuestFeature, string> = {
  comment: "মন্তব্য করতে অ্যাকাউন্ট দরকার",
  create: "গল্প বা মাঙ্গা লিখতে অ্যাকাউন্ট দরকার",
  gallery: "চিত্রশালা ব্যবহার করতে অ্যাকাউন্ট দরকার",
  chat: "চ্যাট করতে অ্যাকাউন্ট দরকার",
  profile: "প্রোফাইল ব্যবহার করতে অ্যাকাউন্ট দরকার",
};

export const isGuestFeature = (v: unknown): v is GuestFeature =>
  typeof v === "string" && v in COPY;

type PromptState = {
  feature: GuestFeature | null;
  open: (feature: GuestFeature) => void;
  close: () => void;
};

export const useJoinPrompt = create<PromptState>((set) => ({
  feature: null,
  open: (feature) => set({ feature }),
  close: () => set({ feature: null }),
}));

/**
 * `const gate = useGuestGate();`  then  `if (!gate("comment")) return;`
 * Returns true when the action may go ahead. For a guest it shows the popup and returns false.
 */
export function useGuestGate(): (feature: GuestFeature) => boolean {
  const guest = useMe()?.role === "guest";
  const open = useJoinPrompt((s) => s.open);
  return useCallback(
    (feature: GuestFeature) => {
      if (!guest) return true;
      open(feature);
      return false;
    },
    [guest, open],
  );
}

/** Mounted once in the root. Renders nothing until a guest hits a members-only feature. */
export function JoinPrompt() {
  const me = useMe();
  const feature = useJoinPrompt((s) => s.feature);
  const open = useJoinPrompt((s) => s.open);
  const close = useJoinPrompt((s) => s.close);
  const primary = useRef<HTMLAnchorElement>(null);

  const isGuest = me?.role === "guest";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const joinParam = useRouterState({
    select: (s) => (s.location.search as { join?: unknown }).join,
  });
  const href = useRouterState({ select: (s) => s.location.href });

  // Moving to another page closes the popup. This effect is declared BEFORE the redirect one below,
  // so when a redirect lands on "/?join=…" the popup is closed first and then opened.
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current === path) return;
    lastPath.current = path;
    close();
  }, [path, close]);

  // Arrived through a redirect such as /?join=chat: show the popup, then tidy the address bar.
  useEffect(() => {
    if (!isGuest || !isGuestFeature(joinParam)) return;
    open(joinParam);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("join");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {
      /* the address bar stays as it is */
    }
  }, [isGuest, joinParam, href, open]);

  useEffect(() => {
    if (!feature) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feature, close]);

  if (!feature || !isGuest) return null;

  return (
    <div
      className="jp-wrap"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="jp-card" role="dialog" aria-modal="true" aria-labelledby="jp-title">
        <button type="button" className="jp-close pressable" onClick={close} aria-label="বন্ধ করুন">
          <X className="size-4" strokeWidth={1.75} />
        </button>
        <span className="jp-icon" aria-hidden="true">
          <UserPlus className="size-5" strokeWidth={1.7} />
        </span>
        <p id="jp-title" className="jp-title">
          {COPY[feature]}
        </p>
        <p className="jp-text">বিনামূল্যে একটি অ্যাকাউন্ট খুলে সদস্য হয়ে যান।</p>
        <Link ref={primary} to="/signup" className="jp-primary pressable">
          অ্যাকাউন্ট খুলুন
        </Link>
        <Link to="/login" className="jp-link">
          আগে থেকেই অ্যাকাউন্ট আছে? লগইন
        </Link>
      </div>
    </div>
  );
}
