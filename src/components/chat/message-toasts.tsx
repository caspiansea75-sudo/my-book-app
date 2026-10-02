import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, X } from "lucide-react";
import { Avatar } from "@/components/members/avatar";
import { parseEffect } from "@/components/chat/chat-fx";
import { MiniChat, type MiniTarget } from "@/components/chat/mini-chat";
import { pollInbox, type InboxItem } from "@/lib/social-api";
import { useMe } from "@/lib/use-me";
import "@/components/chat/chat-fx.css";

const POLL_MS = 7000;
const SHOW_MS = 6500;
const MAX_ON_SCREEN = 3;

type Toast = InboxItem & { key: number; nick: string | null };

/** Reads the chat settings saved by the info panel (mute + nicknames) for one conversation. */
function readPrefs(meId: number, peerId: number | null): { muted: boolean; nicknames: Record<string, string> } {
  try {
    const raw = window.localStorage.getItem(`chat-prefs:${meId}:${peerId ?? "group"}`);
    if (!raw) return { muted: false, nicknames: {} };
    const p = JSON.parse(raw) as { muted?: boolean; nicknames?: Record<string, string> };
    return { muted: !!p.muted, nicknames: p.nicknames ?? {} };
  } catch {
    return { muted: false, nicknames: {} };
  }
}

let audio: AudioContext | null = null;
/** A soft two-note "ding". Browsers may block it until the page has been clicked once. */
function ping() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") void audio.resume();
    const t = audio.currentTime;
    [[880, 0], [1318, 0.12]].forEach(([f, d]) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.08, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.4);
      o.connect(g).connect(audio!.destination);
      o.start(t + d);
      o.stop(t + d + 0.45);
    });
  } catch {
    /* no sound is fine */
  }
}

function preview(m: InboxItem) {
  const text = parseEffect(m.body).text.trim();
  return text;
}

export function MessageToasts() {
  const me = useMe();
  const navigate = useNavigate();
  const loc = useRouterState({ select: (s) => ({ path: s.location.pathname, search: s.location.search as { with?: number } }) });
  const locRef = useRef(loc);
  locRef.current = loc;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mini, setMini] = useState<{ target: MiniTarget; minimized: boolean } | null>(null);
  const miniRef = useRef(mini);
  miniRef.current = mini;
  const lastId = useRef(0);
  const keySeq = useRef(0);
  const unseen = useRef(0);
  const baseTitle = useRef("");

  const dismiss = useCallback((key: number) => setToasts((t) => t.filter((x) => x.key !== key)), []);
  const meId = me?.id ?? null;
  const onChatPage = loc.path === "/chat";

  // The full chat page takes over, so the little window goes away.
  useEffect(() => {
    if (onChatPage) setMini(null);
  }, [onChatPage]);

  useEffect(() => {
    if (meId == null) return;
    const storeKey = `inbox-last:${meId}`;
    try {
      lastId.current = Number(window.sessionStorage.getItem(storeKey)) || 0;
    } catch {
      lastId.current = 0;
    }
    baseTitle.current = document.title;
    let stop = false;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        unseen.current = 0;
        if (baseTitle.current) document.title = baseTitle.current;
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const tick = async () => {
      try {
        const res = await pollInbox({ data: { afterId: lastId.current } });
        if (stop) return;
        lastId.current = Math.max(lastId.current, res.latestId);
        try {
          window.sessionStorage.setItem(storeKey, String(lastId.current));
        } catch {
          /* ignore */
        }
        const here = locRef.current;
        const visible = document.visibilityState === "visible";
        const show: Toast[] = [];
        for (const it of res.items) {
          const peerId = it.isGroup ? null : it.senderId;
          const prefs = readPrefs(meId, peerId);
          if (prefs.muted) continue;
          const viewing = visible && here.path === "/chat" && (here.search.with ?? null) === peerId;
          if (viewing) continue;
          // The little chat window for this very conversation is open: it shows the message itself.
          const m = miniRef.current;
          if (visible && m && !m.minimized && m.target.peerId === peerId) continue;
          show.push({ ...it, key: ++keySeq.current, nick: prefs.nicknames[String(it.senderId)] || null });
        }
        if (!show.length) return;
        if (!visible) {
          unseen.current += show.length;
          document.title = `(${unseen.current}) ${baseTitle.current || document.title.replace(/^\(\d+\)\s*/, "")}`;
        }
        setToasts((cur) => [...cur, ...show].slice(-MAX_ON_SCREEN));
        ping();
      } catch {
        /* offline or signed out: try again next time */
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      stop = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [meId]);

  if (meId == null) return null;

  function openFull(target: MiniTarget) {
    setMini(null);
    void navigate({ to: "/chat", search: target.peerId == null ? {} : { with: target.peerId } });
  }

  return (
    <>
      {toasts.length > 0 ? (
        <div className="cx-toasts" role="region" aria-live="polite" aria-label="নতুন বার্তা">
          {toasts.map((t) => (
            <ToastCard
              key={t.key}
              t={t}
              onClose={() => dismiss(t.key)}
              onOpen={() => {
                const target: MiniTarget = t.isGroup
                  ? { peerId: null, name: "সবার চ্যাট", avatarUrl: null }
                  : { peerId: t.senderId, name: t.nick ?? t.senderName, avatarUrl: t.senderAvatarUrl };
                // Clear every pop-up from this conversation, not just the one that was clicked.
                setToasts((cur) => cur.filter((x) => (x.isGroup ? null : x.senderId) !== target.peerId));
                // Already on the chat page: just switch conversation there. Anywhere else: a small window.
                if (locRef.current.path === "/chat") openFull(target);
                else setMini({ target, minimized: false });
              }}
            />
          ))}
        </div>
      ) : null}
      {mini && !onChatPage ? (
        <MiniChat
          meId={meId}
          target={mini.target}
          minimized={mini.minimized}
          onMinimize={(v) => setMini((cur) => (cur ? { ...cur, minimized: v } : cur))}
          onClose={() => setMini(null)}
          onExpand={() => openFull(mini.target)}
        />
      ) : null}
    </>
  );
}

function ToastCard({ t, onClose, onOpen }: { t: Toast; onClose: () => void; onOpen: () => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(SHOW_MS);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const id = window.setTimeout(onClose, left.current);
    return () => {
      window.clearTimeout(id);
      left.current = Math.max(600, left.current - (Date.now() - started));
    };
  }, [paused, onClose]);

  const text = preview(t);
  const name = t.nick ?? t.senderName;
  return (
    <div className="cx-toast" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <button type="button" onClick={onOpen} className="cx-toast-body pressable">
        <span className="cx-toast-avatar">
          <Avatar name={t.senderName} url={t.senderAvatarUrl} size={40} />
          <span className="cx-toast-bell" aria-hidden="true">
            <Bell className="size-3" strokeWidth={2} />
          </span>
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block font-sans text-[11px] text-lamp">{t.isGroup ? "সবার চ্যাটে নতুন বার্তা" : "নতুন বার্তা"}</span>
          <span data-no-i18n className="block truncate font-display text-sm text-fg">
            {name}
          </span>
          {text ? (
            <span data-no-i18n className="line-clamp-2 break-words font-sans text-xs text-muted">
              {text}
            </span>
          ) : (
            <span className="block font-sans text-xs text-muted">📷 ছবি</span>
          )}
        </span>
      </button>
      <button type="button" onClick={onClose} aria-label="বন্ধ" className="cx-toast-x pressable">
        <X className="size-3.5" />
      </button>
      <span className="cx-toast-bar" style={{ animationDuration: `${SHOW_MS}ms`, animationPlayState: paused ? "paused" : "running" }} aria-hidden="true" />
    </div>
  );
}
