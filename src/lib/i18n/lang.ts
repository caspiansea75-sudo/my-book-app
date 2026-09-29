import { useSyncExternalStore } from "react";

export type Lang = "bn" | "en";
const KEY = "bk-lang";
const listeners = new Set<() => void>();
let current: Lang | null = null;

function read(): Lang {
  if (current) return current;
  try {
    current = window.localStorage.getItem(KEY) === "en" ? "en" : "bn";
  } catch {
    current = "bn";
  }
  return current;
}

export function setLang(next: Lang) {
  current = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // storage unavailable — choice lasts for this visit only
  }
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "bn",
  );
}
