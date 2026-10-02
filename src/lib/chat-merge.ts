import type { ChatMessage, ThreadResult } from "@/lib/social-api";

/** Folds a freshly loaded batch into the messages already on screen (drops deleted ones, appends new ones). */
export function mergeThread(prev: ChatMessage[], res: ThreadResult): ChatMessage[] {
  let next = prev;
  if (res.latestIds.length === 0) {
    next = [];
  } else {
    const keep = new Set(res.latestIds);
    const oldest = Math.min(...res.latestIds);
    next = next.filter((m) => m.id < oldest || keep.has(m.id));
  }
  const have = new Set(next.map((m) => m.id));
  const fresh = res.messages.filter((m) => !have.has(m.id));
  return fresh.length ? [...next, ...fresh] : next;
}
