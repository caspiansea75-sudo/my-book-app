import type { ChatMessage } from "@/lib/social-api";

export type SeenWho = { id: number; name: string; avatarUrl: string | null };

/**
 * For each member, the message their "seen" avatar sits under: the newest message they have read
 * that someone else wrote. Returns messageId -> the members to show there.
 */
export function placeSeen(
  messages: ChatMessage[],
  seen: { memberId: number; lastReadId: number }[],
  who: Map<number, SeenWho>,
  meId: number,
): Map<number, SeenWho[]> {
  const out = new Map<number, SeenWho[]>();
  if (!messages.length) return out;
  for (const s of seen) {
    const person = who.get(s.memberId);
    if (!person || s.memberId === meId) continue;
    let target: number | null = null;
    for (let k = messages.length - 1; k >= 0; k--) {
      const m = messages[k]!;
      if (m.id <= s.lastReadId && m.senderId !== s.memberId) {
        target = m.id;
        break;
      }
    }
    if (target == null) continue;
    const list = out.get(target) ?? [];
    list.push(person);
    out.set(target, list);
  }
  return out;
}
