import { useEffect, useState } from "react";
import { listPresence, sendHeartbeat, type PresenceRow } from "@/lib/presence-api";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";
import "@/components/chat/chat-fx.css";

const BEAT_MS = 30_000;
const WATCH_MS = 15_000;

/** Invisible. While a member has the site open and visible, it tells the server "I'm here". */
export function PresenceHeartbeat() {
  const me = useMe();
  const meId = me && me.role !== "guest" ? me.id : null;
  useEffect(() => {
    if (meId == null) return;
    const beat = () => {
      if (document.visibilityState === "visible") void sendHeartbeat().catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [meId]);
  return null;
}

export type PresenceMap = Map<number, PresenceRow>;

/** Admin only: who is online, refreshed every 15 seconds. Returns an empty map for everyone else. */
export function usePresence(enabled: boolean): PresenceMap {
  const [map, setMap] = useState<PresenceMap>(new Map());
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const rows = await listPresence();
        if (!stop) setMap(new Map(rows.map((r) => [r.id, r])));
      } catch {
        /* keep what we had */
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), WATCH_MS);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [enabled]);
  return map;
}

const num = (n: number) => n.toLocaleString("bn-BD");

/** "এইমাত্র", "৫ মিনিট আগে", "২ ঘণ্টা আগে", "৩ দিন আগে" — or null if never seen. */
export function agoText(secondsAgo: number | null): string | null {
  if (secondsAgo == null) return null;
  if (secondsAgo < 60) return "এইমাত্র";
  const m = Math.floor(secondsAgo / 60);
  if (m < 60) return `${num(m)} মিনিট আগে`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${num(h)} ঘণ্টা আগে`;
  return `${num(Math.floor(h / 24))} দিন আগে`;
}

/** A small green (online) or grey (offline) dot. */
export function PresenceDot({ row, className }: { row: PresenceRow | undefined; className?: string }) {
  if (!row) return null;
  return (
    <span
      className={cn("pr-dot", row.online ? "pr-on" : "pr-off", className)}
      role="img"
      aria-label={row.online ? "অনলাইন" : "অফলাইন"}
    />
  );
}

/** "অনলাইন", or "অফলাইন · শেষ দেখা ৫ মিনিট আগে". */
export function PresenceLabel({ row, className }: { row: PresenceRow | undefined; className?: string }) {
  if (!row) return null;
  const ago = agoText(row.secondsAgo);
  return (
    <span className={cn(row.online ? "text-emerald-400" : "text-muted", className)}>
      {row.online ? (
        <span>অনলাইন</span>
      ) : (
        <>
          <span>অফলাইন</span>
          {ago ? (
            <>
              {" · "}
              <span>শেষ দেখা</span> <span>{ago}</span>
            </>
          ) : (
            <>
              {" · "}
              <span>কখনো আসেননি</span>
            </>
          )}
        </>
      )}
    </span>
  );
}
