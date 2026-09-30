import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ImagePlus, MessageCircle, Send, Trash2, User, Users, X } from "lucide-react";
import { SiteNav } from "@/components/book/site-nav";
import { Avatar } from "@/components/members/avatar";
import { FxAurora } from "@/components/media/fx";
import { resizeToJpeg } from "@/lib/image-resize";
import {
  deleteMessage,
  listConversations,
  loadThread,
  sendMessage,
  uploadChatImage,
  type ChatMessage,
  type Conversation,
  type ThreadResult,
} from "@/lib/social-api";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale";

type Member = NonNullable<ReturnType<typeof useMe>>;

const formatCount = (n: number) => n.toLocaleString("bn-BD");

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): { with?: number } => {
    const n = Number(search.with);
    return Number.isInteger(n) && n > 0 ? { with: n } : {};
  },
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: "/login" });
  },
  loader: () => listConversations(),
  component: ChatPage,
});

function ChatPage() {
  const me = useMe();
  if (!me) return null;
  return <ChatShell me={me} />;
}

function ChatShell({ me }: { me: Member }) {
  const initial = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Conversation[]>(initial);

  const peer = search.with != null ? (people.find((p) => p.id === search.with) ?? null) : null;
  const peerId = peer ? peer.id : null;

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await listConversations();
        if (!stop) setPeople(next);
      } catch {
        /* keep the old list */
      }
    };
    const timer = setInterval(() => void tick(), 6000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  function go(id: number | null) {
    void navigate({ to: "/chat", search: id != null ? { with: id } : {} });
  }

  const markSeen = useCallback((id: number | null) => {
    if (id == null) return;
    setPeople((list) => list.map((p) => (p.id === id && p.unread ? { ...p, unread: 0 } : p)));
  }, []);

  return (
    <main className="mf-page relative flex h-dvh flex-col overflow-hidden">
      <FxAurora />
      <SiteNav active="chat" />
      <section className="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 gap-3 px-3 py-3 sm:px-6">
        <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface md:flex">
          <button
            type="button"
            onClick={() => go(null)}
            className={cn(
              "pressable flex items-center gap-3 border-b border-border px-3 py-3 text-left font-sans text-sm",
              peerId == null ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-fg">
              <Users className="size-4" strokeWidth={1.75} />
            </span>
            <span className="font-display text-base">সবার চ্যাট</span>
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {people.length === 0 ? (
              <p className="px-3 py-4 font-sans text-xs text-muted">এখনো আর কেউ যোগ দেয়নি।</p>
            ) : null}
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => go(p.id)}
                className={cn(
                  "pressable flex w-full items-center gap-3 px-3 py-2.5 text-left font-sans text-sm",
                  peerId === p.id ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Avatar name={p.displayName} url={p.avatarUrl} size={36} />
                <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                {p.unread > 0 ? (
                  <span className="grid min-w-5 place-items-center rounded-full bg-lamp px-1.5 text-[11px] leading-5 text-bg">
                    {formatCount(p.unread)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <select
            aria-label="কার সাথে কথা বলবেন"
            className="field-input md:hidden"
            value={peerId ?? 0}
            onChange={(e) => go(Number(e.target.value) || null)}
          >
            <option value={0}>সবার চ্যাট</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
                {p.unread > 0 ? ` (${formatCount(p.unread)})` : ""}
              </option>
            ))}
          </select>
          <Thread key={peerId ?? "group"} me={me} peer={peer} onSeen={markSeen} />
        </div>
      </section>
    </main>
  );
}

function mergeThread(prev: ChatMessage[], res: ThreadResult): ChatMessage[] {
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

function Thread({
  me,
  peer,
  onSeen,
}: {
  me: Member;
  peer: Conversation | null;
  onSeen: (id: number | null) => void;
}) {
  const locale = useLocale();
  const peerId = peer ? peer.id : null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{ id: number; url: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const lastId = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const seenRef = useRef(onSeen);
  seenRef.current = onSeen;

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

  useEffect(() => {
    let alive = true;
    void (async () => {
      await fetchNew();
      if (alive) {
        setLoading(false);
        seenRef.current(peerId);
      }
    })();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void fetchNew();
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [fetchNew, peerId]);

  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

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
      await sendMessage({ data: { peerId, body, imageId: pending ? pending.id : null } });
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

  async function remove(id: number) {
    if (!window.confirm("এই বার্তাটি মুছবেন?")) return;
    try {
      await deleteMessage({ data: { id } });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "মোছা যায়নি");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  let lastDay = "";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        {peer ? (
          <>
            <Avatar name={peer.displayName} url={peer.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base">{peer.displayName}</p>
              <p className="font-sans text-xs text-muted">@{peer.username} · ব্যক্তিগত কথোপকথন</p>
            </div>
            <Link
              to="/u/$username"
              params={{ username: peer.username }}
              className="pressable inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-sans text-xs text-muted hover:bg-surface-2 hover:text-fg"
            >
              <User className="size-3.5" strokeWidth={1.75} />
              প্রোফাইল
            </Link>
          </>
        ) : (
          <>
            <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-fg">
              <MessageCircle className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base">সবার চ্যাট</p>
              <p className="font-sans text-xs text-muted">সব সদস্য এখানে একসাথে কথা বলতে পারেন</p>
            </div>
          </>
        )}
      </header>

      <div ref={box} onScroll={onScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4">
        {loading ? <p className="text-center font-sans text-sm text-muted">লোড হচ্ছে…</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="py-10 text-center font-sans text-sm text-muted">
            এখনো কোনো বার্তা নেই। প্রথম বার্তাটি আপনিই পাঠান।
          </p>
        ) : null}
        {messages.map((m) => {
          const mine = m.senderId === me.id;
          const when = new Date(m.createdAt);
          const day = when.toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          const canDelete = mine || (me.role === "admin" && m.isGroup);
          return (
            <div key={m.id}>
              {showDay ? (
                <p className="my-3 text-center font-sans text-[11px] text-subtle">
                  {when.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
                </p>
              ) : null}
              <div className={cn("group flex items-end gap-2", mine ? "flex-row-reverse" : "")}>
                {!mine ? (
                  <Link to="/u/$username" params={{ username: m.senderUsername }} className="shrink-0">
                    <Avatar name={m.senderName} url={m.senderAvatarUrl} size={30} />
                  </Link>
                ) : null}
                <div className={cn("flex max-w-[80%] flex-col", mine ? "items-end" : "items-start")}>
                  {!mine && m.isGroup ? (
                    <Link
                      to="/u/$username"
                      params={{ username: m.senderUsername }}
                      className="mb-0.5 px-1 font-sans text-[11px] text-muted hover:text-fg"
                    >
                      {m.senderName}
                    </Link>
                  ) : null}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 font-sans text-sm leading-relaxed",
                      mine ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg",
                    )}
                  >
                    {m.imageUrl ? (
                      <a href={m.imageUrl} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={m.imageUrl}
                          alt="পাঠানো ছবি"
                          loading="lazy"
                          className={cn("max-h-72 max-w-full rounded-lg object-cover", m.body ? "mb-2" : "")}
                        />
                      </a>
                    ) : null}
                    {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 px-1 font-sans text-[10px] text-subtle">
                    <span>{when.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</span>
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => void remove(m.id)}
                        aria-label="বার্তা মুছুন"
                        title="মুছুন"
                        className="opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-70"
                      >
                        <Trash2 className="size-3" strokeWidth={1.75} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-3">
        {error ? (
          <p role="alert" className="mb-2 font-sans text-xs text-nsfw">
            {error}
          </p>
        ) : null}
        {pending ? (
          <div className="relative mb-2 inline-block">
            <img src={pending.url} alt="পাঠাতে যাওয়া ছবি" className="h-20 rounded-lg border border-border object-cover" />
            <button
              type="button"
              onClick={() => setPending(null)}
              aria-label="ছবি বাদ দিন"
              className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-bg text-fg shadow"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPick(e)} />
          <button
            type="button"
            disabled={uploading || sending}
            onClick={() => fileRef.current?.click()}
            aria-label="ছবি যোগ করুন"
            title="ছবি পাঠান"
            className="pressable grid size-11 shrink-0 place-items-center rounded-lg border border-border text-muted hover:text-fg disabled:opacity-50"
          >
            <ImagePlus className="size-5" strokeWidth={1.75} />
          </button>
          <textarea
            ref={areaRef}
            rows={1}
            value={text}
            maxLength={2000}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
            onKeyDown={onKeyDown}
            placeholder={uploading ? "ছবি প্রস্তুত হচ্ছে…" : "বার্তা লিখুন…"}
            className="field-input max-h-32 min-h-11 flex-1 resize-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || uploading || (!text.trim() && !pending)}
            aria-label="পাঠান"
            title="পাঠান"
            className="pressable grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg disabled:opacity-50"
          >
            <Send className="size-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
