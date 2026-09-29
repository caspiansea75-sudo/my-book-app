/** Small localStorage helpers for drafts, version history and private notes (this browser only). */

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function moveKey(from: string, to: string) {
  try {
    const v = window.localStorage.getItem(from);
    if (v != null) {
      window.localStorage.setItem(to, v);
      window.localStorage.removeItem(from);
    }
  } catch {
    /* ignore */
  }
}

export const draftKey = (book: string, slug?: string) => `bookapp:draft:${book}:${slug ?? "new"}`;
export const versionsKey = (book: string, slug?: string) => `bookapp:versions:${book}:${slug ?? "new"}`;
export const noteKey = (book: string, slug?: string) => `bookapp:note:${book}:${slug ?? "new"}`;
