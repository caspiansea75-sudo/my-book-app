import { Avatar } from "@/components/members/avatar";
import type { SeenWho } from "@/lib/seen";
import "@/components/chat/chat-fx.css";

const SHOW = 5;

/** Little avatars of the people who have seen up to this message. */
export function SeenRow({ people, label }: { people: SeenWho[]; label: (p: SeenWho) => string }) {
  if (!people.length) return null;
  const shown = people.slice(0, SHOW);
  const more = people.length - shown.length;
  const names = people.map(label).join(", ");
  return (
    <div className="cx-seen" title={names} aria-label={names}>
      <span className="cx-seen-label">দেখেছেন</span>
      <span className="cx-seen-stack">
        {shown.map((p) => (
          <span key={p.id} className="cx-seen-av">
            <Avatar name={p.name} url={p.avatarUrl} size={16} />
          </span>
        ))}
      </span>
      {more > 0 ? <span className="cx-seen-more">+{more.toLocaleString("bn-BD")}</span> : null}
    </div>
  );
}
