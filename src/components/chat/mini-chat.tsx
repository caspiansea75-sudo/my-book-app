import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ImagePlus, Maximize2, Minus, Send, Users, X } from "lucide-react";
import { Avatar } from "@/components/members/avatar";
import { MsgText } from "@/components/chat/chat-fx";
import { resizeToJpeg } from "@/lib/image-resize";
import { mergeThread } from "@/lib/chat-merge";
import { resolveTheme, useChatPrefs } from "@/lib/chat-prefs";
import { loadThread, sendMessage, uploadChatImage, type ChatMessage } from "@/lib/social-api";
import { cn } from "@/lib/utils";
import "@/components/chat/chat-fx.css";

export type MiniTarget = {
  /** null = the group chat. */
  peerId: number | null;
  name: string;
  avatarUrl: string | null;
};

const POLL_MS = 3000;

/**
 * A small chat window that floats over whatever page you are on, so a reply doesn't
 * take you away from what you were doing.
 */
export function MiniChat({
  meId,
  target,
  minimized,
  onMinimize,
  onClose,
  onExpand,
}: {
  meId: number;
  target: MiniTarget;
  minimized: boolean;
  onMinimize: (v: boolean) => void;
  onClose: () => void;
  /** Open the full chat page for this conversation. */
  onExpand: () => void;
}) {
  const { peerId } = target;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{ id: number; url: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [prefs] = useChatPrefs(meId, peerId);
  const theme = resolveTheme(prefs);
  const themeStyle = (theme.from
    ? { ["--cx-from" as string]: theme.from, ["--cx-to" as string]: theme.to, ["--cx-fg" as string]: theme.fg }
    : {}) as React.CSSProperties;

  const lastId = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const minimizedRef = useRef(minimized);
  minimizedRef.current = minimized;

  const fetchNew = useCallback(async () => {
    try {
      const res = await loadThread({ data: { peerId, afterId: lastId.current } });
      for (const m of res.messages) if (m.id > lastId.current) lastId.current = m.id;
      setMessages((prev) => mergeThread(prev, res));
      setError((e) => (e && e.startsWith("বার্তা লোড") ? null : e));
    } catch (err) {
      setError(err instanceof Error ? `বার্তা লোড হয়নি: ${err.message}` : "বার্তা লোড হয়নি");
    }
  }, [peerId]);

  // A new conversation starts from scratch.
  useEffect(() => {
    lastId.current = 0;
    stick.current = true;
    setMessages([]);
    setLoading(true);
    setError(null);
    setText("");
    setPending(null);
    let alive = true;
    void (async () => {
      await fetchNew();
      if (alive) setLoading(false);
    })();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchNew();
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [fetchNew]);

  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, loading, minimized]);

  useEffect(() => {
    if (!minimized) areaRef.current?.focus({ preventScroll: true });
  }, [minimized, peerId]);

  function onScroll() {
    const el = box.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const img = await resizeToJpeg(file, { maxSide: 1280, maxBytes: 700 * 1024 });
      const up = await uploadChatImage({ data: { base64: img.base64, purpose: "chat" } });
      setPending({ id: up.id, url: up.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ছবি দেওয়া যায়নি");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const body = text.trim();
    if ((!body && !pending) || sending || uploading) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage({ data: { peerId, body, imageId: pending ? pending.id : null, replyToId: null } });
      setText("");
      setPending(null);
      if (areaRef.current) areaRef.current.style.height = "auto";
      stick.current = true;
      await fetchNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : "বার্তা যায়নি");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  const title = prefs.name || target.name;

  return (
    <div
      className={cn("cx-mini", minimized && "cx-mini-min")}
      role="dialog"
      aria-label={`${title} এর সাথে চ্যাট`}
      style={themeStyle}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => onMinimize(!minimized)}
          className="pressable flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-label={minimized ? "চ্যাট খুলুন" : "চ্যাট ছোট করুন"}
        >
          {peerId == null ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
              <Users className="size-4" strokeWidth={1.75} />
            </span>
          ) : (
            <Avatar name={target.name} url={target.avatarUrl} size={32} />
          )}
          <span data-no-i18n className="truncate font-display text-sm text-fg">
            {title}
          </span>
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-label="পুরো চ্যাট পেজে খুলুন"
          title="পুরো চ্যাট পেজে খুলুন"
          className="pressable grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
        >
          <Maximize2 className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => onMinimize(!minimized)}
          aria-label={minimized ? "বড় করুন" : "ছোট করুন"}
          title={minimized ? "বড় করুন" : "ছোট করুন"}
          className="pressable grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
        >
          <Minus className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="বন্ধ করুন"
          title="বন্ধ করুন"
          className="pressable grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      {!minimized ? (
        <>
          <div ref={box} onScroll={onScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {loading ? (
              <p className="py-6 text-center font-sans text-xs text-muted">লোড হচ্ছে…</p>
            ) : messages.length === 0 ? (
              <p className="py-6 text-center font-sans text-xs text-muted">এখনো কোনো বার্তা নেই।</p>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === meId;
                return (
                  <div key={m.id} className={cn("flex items-end gap-2", mine ? "cx-msg-right flex-row-reverse" : "cx-msg-left")}>
                    {!mine ? (
                      <Link to="/u/$username" params={{ username: m.senderUsername }} className="shrink-0">
                        <Avatar name={m.senderName} url={m.senderAvatarUrl} size={24} />
                      </Link>
                    ) : null}
                    <div className={cn("flex max-w-[82%] flex-col", mine ? "items-end" : "items-start")}>
                      {!mine && m.isGroup ? (
                        <span data-no-i18n className="mb-0.5 px-1 font-sans text-[10px] text-muted">
                          {prefs.nicknames[String(m.senderId)] || m.senderName}
                        </span>
                      ) : null}
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-1.5 font-sans text-[13px] leading-relaxed",
                          mine ? "cx-mine" : "cx-theirs bg-surface-2 text-fg",
                        )}
                        title={new Date(m.createdAt).toLocaleString("bn-BD")}
                      >
                        {m.replyTo ? (
                          <p className="mb-1 line-clamp-1 rounded-md border-l-2 border-lamp bg-black/20 px-2 py-0.5 text-[11px] opacity-80">
                            {m.replyTo.deleted ? "মূল বার্তাটি মুছে ফেলা হয়েছে" : m.replyTo.body || "📷 ছবি"}
                          </p>
                        ) : null}
                        {m.imageUrl ? (
                          <a href={m.imageUrl} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={m.imageUrl}
                              alt="পাঠানো ছবি"
                              loading="lazy"
                              className={cn("max-h-48 max-w-full rounded-lg object-cover", m.body ? "mb-1.5" : "")}
                            />
                          </a>
                        ) : null}
                        {m.body ? (
                          <p className="whitespace-pre-wrap break-words">
                            <MsgText body={m.body} />
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border p-2">
            {error ? <p className="mb-1.5 px-1 font-sans text-xs text-nsfw">{error}</p> : null}
            {pending ? (
              <div className="relative mb-2 inline-block">
                <img src={pending.url} alt="" className="h-16 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  aria-label="ছবি বাদ দিন"
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-bg text-fg shadow"
                >
                  <X className="size-3" strokeWidth={2} />
                </button>
              </div>
            ) : null}
            <div className="flex items-end gap-1.5">
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => void onPick(e)} className="hidden" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || sending}
                aria-label="ছবি দিন"
                className="pressable grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted hover:text-fg disabled:opacity-50"
              >
                <ImagePlus className="size-4" strokeWidth={1.75} />
              </button>
              <textarea
                ref={areaRef}
                value={text}
                rows={1}
                onChange={(e) => {
                  setText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
                }}
                onKeyDown={onKeyDown}
                placeholder={uploading ? "ছবি প্রস্তুত হচ্ছে…" : "বার্তা লিখুন…"}
                className="field-input max-h-24 min-h-10 flex-1 resize-none"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || uploading || (!text.trim() && !pending)}
                aria-label="পাঠান"
                className={cn(
                  "pressable grid size-10 shrink-0 place-items-center rounded-lg text-accent-fg disabled:opacity-50",
                  theme.from ? "cx-send-themed" : "bg-accent",
                )}
              >
                <Send className="size-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
