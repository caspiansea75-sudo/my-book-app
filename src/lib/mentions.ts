/** @mentions: plain "@Name" text inside the message, found again when the message is shown. */

export type MentionPerson = { id: number; name: string; username: string; avatarUrl: string | null };

export const EVERYONE = "everyone";

export type MentionSeg = { text: string; mention?: "user" | "everyone"; me?: boolean };

const WORD = /[\p{L}\p{N}_]/u;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Cuts a message into plain pieces and @mention pieces. */
export function splitMentions(text: string, names: string[], meName: string): MentionSeg[] {
  if (!text.includes("@")) return [{ text }];
  const all = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  const alt = [EVERYONE, ...all.map(esc)].join("|");
  const rx = new RegExp(`@(?:${alt})(?![\\p{L}\\p{N}_])`, "giu");
  const me = meName.trim().toLowerCase();
  const out: MentionSeg[] = [];
  let at = 0;
  for (const m of text.matchAll(rx)) {
    const i = m.index ?? 0;
    if (i > 0 && WORD.test(text[i - 1] ?? "")) continue; // part of an e-mail address etc.
    if (i > at) out.push({ text: text.slice(at, i) });
    const name = m[0].slice(1).toLowerCase();
    out.push({
      text: m[0],
      mention: name === EVERYONE ? "everyone" : "user",
      me: name !== EVERYONE && name === me,
    });
    at = i + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out.length ? out : [{ text }];
}

/** Does this message call out me by name, or everyone? */
export function mentionKind(body: string, meName: string, names: string[] = [meName]): "me" | "everyone" | null {
  let all = false;
  for (const s of splitMentions(body, names.length ? names : [meName], meName)) {
    if (s.me) return "me";
    if (s.mention === "everyone") all = true;
  }
  return all ? "everyone" : null;
}

/** The "@something" the cursor is in the middle of typing, if any. */
export function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && WORD.test(before[at - 1] ?? "")) return null;
  const query = before.slice(at + 1);
  if (query.includes("\n") || query.length > 30) return null;
  return { start: at, query };
}

export type MentionOption = { kind: "everyone" } | { kind: "user"; person: MentionPerson };

/** Everyone first when it fits, then members whose name or @username matches. */
export function mentionOptions(people: MentionPerson[], query: string): MentionOption[] {
  const q = query.trim().toLowerCase();
  const out: MentionOption[] = [];
  if (!q || EVERYONE.startsWith(q)) out.push({ kind: "everyone" });
  const starts: MentionOption[] = [];
  const has: MentionOption[] = [];
  for (const person of people) {
    const n = person.name.toLowerCase();
    const u = person.username.toLowerCase();
    if (!q || n.startsWith(q) || u.startsWith(q)) starts.push({ kind: "user", person });
    else if (n.includes(q) || u.includes(q)) has.push({ kind: "user", person });
  }
  return [...out, ...starts, ...has].slice(0, 8);
}
