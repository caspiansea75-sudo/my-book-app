import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  EllipsisVertical,
  Flag,
  Forward,
  BellOff,
  ImagePlus,
  SmilePlus,
  Info,
  MessageCircle,
  Pin,
  PinOff,
  Plus,
  Reply,
  Send,
  Smile,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { SiteNav } from "@/components/book/site-nav";
import { Avatar } from "@/components/members/avatar";
import { FxAurora } from "@/components/media/fx";
import { resizeToJpeg } from "@/lib/image-resize";
import { MORE_REACTIONS, QUICK_REACTIONS, REPORT_REASONS } from "@/lib/chat-emoji";
import {
  deleteMessage,
  forwardMessage,
  listConversations,
  loadThread,
  reportMessage,
  sendMessage,
  togglePin,
  toggleReaction,
  uploadChatImage,
  type ChatMessage,
  type Conversation,
  type MessageState,
  type ThreadResult,
} from "@/lib/social-api";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale";
import { ChatInfoPanel } from "@/components/chat/chat-info";
import { PresenceDot, PresenceLabel, usePresence, type PresenceMap } from "@/components/presence/presence";
import { EFFECTS, MsgText, heartAt, reactToText } from "@/components/chat/chat-fx";
import { resolveTheme, useChatPrefs } from "@/lib/chat-prefs";
import { mergeThread } from "@/lib/chat-merge";
import { EmojiPicker } from "@/components/chat/emoji-picker";

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
  const presence = usePresence(me.role === "admin");

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
          <div className="cx-scroll min-h-0 flex-1 overflow-y-auto">
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
                <span className="relative shrink-0">
                  <Avatar name={p.displayName} url={p.avatarUrl} size={36} />
                  <PresenceDot row={presence.get(p.id)} className="pr-badge" />
                </span>
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
          <Thread key={peerId ?? "group"} me={me} peer={peer} people={people} onSeen={markSeen} presence={presence} />
        </div>
      </section>
    </main>
  );
}

type Pop = { id: number; kind: "react" | "more"; rect: DOMRect };

/** Small floating panel that stays on screen and is never clipped by the scrolling thread. */
function Popover({ rect, onClose, children }: { rect: DOMRect; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest("[data-chat-pop]")) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const above = rect.top > 280;
  const width = Math.min(340, window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
  const style: React.CSSProperties = above
    ? { left, width, bottom: window.innerHeight - rect.top + 8 }
    : { left, width, top: rect.bottom + 8 };
  return (
    <div
      data-chat-pop
      style={style}
      className="fixed z-50 flex flex-col items-center rounded-2xl border border-border bg-surface-2 p-1.5 shadow-xl"
    >
      {children}
    </div>
  );
}

const snippet = (m: { body: string; imageUrl?: string | null; hasImage?: boolean }) =>
  m.body ? m.body : m.imageUrl || m.hasImage ? "📷 ছবি" : "";

function Thread({
  me,
  peer,
  people,
  onSeen,
  presence,
}: {
  me: Member;
  peer: Conversation | null;
  people: Conversation[];
  onSeen: (id: number | null) => void;
  presence: PresenceMap;
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
  const [states, setStates] = useState<Record<number, MessageState>>({});
  const [pins, setPins] = useState<ChatMessage[]>([]);
  const [pinIdx, setPinIdx] = useState(0);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiBox = useRef<HTMLDivElement>(null);
  const [flying, setFlying] = useState(false);
  const [prefs, updatePrefs] = useChatPrefs(me.id, peerId);
  const primed = useRef(false);
  const seenMax = useRef(0);
  const nick = (id: number, name: string) => prefs.nicknames[String(id)] || name;
  const title = prefs.name || (peer ? peer.displayName : "সবার চ্যাট");
  const photo = prefs.photo || null;
  const theme = resolveTheme(prefs);
  const themeStyle = (theme.from ? { ["--cx-from" as string]: theme.from, ["--cx-to" as string]: theme.to, ["--cx-fg" as string]: theme.fg } : {}) as React.CSSProperties;
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
      setStates(res.states);
      setPins(res.pins);
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

  // Fire confetti / hearts when a NEW message arrives (not for old history)
  useEffect(() => {
    if (loading) return;
    const max = messages.reduce((a, m) => Math.max(a, m.id), 0);
    if (!primed.current) {
      primed.current = true;
      seenMax.current = max;
      return;
    }
    const fresh = messages.filter((m) => m.id > seenMax.current);
    seenMax.current = Math.max(seenMax.current, max);
    const last = fresh[fresh.length - 1];
    if (last && last.body && (last.senderId === me.id || !prefs.muted)) reactToText(last.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await sendMessage({
        data: { peerId, body, imageId: pending ? pending.id : null, replyToId: replyTo ? replyTo.id : null },
      });
      setText("");
      setPending(null);
      setReplyTo(null);
      if (areaRef.current) areaRef.current.style.height = "auto";
      stick.current = true;
      setFlying(true);
      window.setTimeout(() => setFlying(false), 700);
      await fetchNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : "বার্তা যায়নি");
    } finally {
      setSending(false);
    }
  }

  async function sendQuick() {
    if (sending) return;
    setSending(true);
    try {
      await sendMessage({ data: { peerId, body: prefs.emoji, imageId: null, replyToId: null } });
      stick.current = true;
      await fetchNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : "বার্তা যায়নি");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!emojiOpen) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!emojiBox.current?.contains(t) && !t?.closest?.("[data-emoji-toggle]")) setEmojiOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setEmojiOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [emojiOpen]);

  /** Put an emoji where the cursor is in the message box. */
  function addEmoji(emoji: string) {
    const el = areaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    if (next.length > 2000) return;
    setText(next);
    window.requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const at = start + emoji.length;
      el.setSelectionRange(at, at);
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    });
  }

  async function remove(id: number) {
    if (!window.confirm("এই বার্তাটি মুছবেন?")) return;
    try {
      await deleteMessage({ data: { id } });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setPins((prev) => prev.filter((m) => m.id !== id));
      setReplyTo((r) => (r && r.id === id ? null : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : "মোছা যায়নি");
    }
  }

  const closePop = useCallback(() => {
    setPop(null);
    setShowMore(false);
  }, []);

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 2500);
  }

  function jumpTo(id: number) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashId(id);
    window.setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1400);
  }

  function openPop(e: React.MouseEvent<HTMLButtonElement>, id: number, kind: Pop["kind"]) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setShowMore(false);
    setPop((cur) => (cur && cur.id === id && cur.kind === kind ? null : { id, kind, rect }));
  }

  async function react(m: ChatMessage, emoji: string) {
    closePop();
    setActiveId(null);
    // Show it straight away, then let the server have the last word.
    setStates((prev) => {
      const cur = prev[m.id] ?? { reactions: [], reports: 0 };
      const had = cur.reactions.find((r) => r.mine);
      let list = cur.reactions
        .map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r))
        .filter((r) => r.count > 0);
      if (had?.emoji !== emoji) {
        const hit = list.find((r) => r.emoji === emoji);
        list = hit
          ? list.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r))
          : [...list, { emoji, count: 1, mine: true }];
      }
      return { ...prev, [m.id]: { ...cur, reactions: list } };
    });
    try {
      await toggleReaction({ data: { messageId: m.id, emoji } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "প্রতিক্রিয়া দেওয়া যায়নি");
    }
    await fetchNew();
  }

  function startReply(m: ChatMessage) {
    closePop();
    setActiveId(null);
    setReplyTo(m);
    areaRef.current?.focus();
  }

  async function pin(m: ChatMessage, pinned: boolean) {
    closePop();
    setActiveId(null);
    try {
      await togglePin({ data: { id: m.id } });
      await fetchNew();
      flash(pinned ? "পিন সরানো হয়েছে" : "পিন করা হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "পিন করা যায়নি");
    }
  }

  async function forwardTo(m: ChatMessage, dest: number | null) {
    setForwarding(null);
    try {
      await forwardMessage({ data: { id: m.id, peerId: dest } });
      if (dest === peerId) {
        stick.current = true;
        await fetchNew();
      }
      flash("ফরওয়ার্ড করা হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ফরওয়ার্ড করা যায়নি");
    }
  }

  async function report(m: ChatMessage, reason: (typeof REPORT_REASONS)[number]) {
    setReporting(null);
    try {
      await reportMessage({ data: { id: m.id, reason } });
      flash("রিপোর্ট পাঠানো হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিপোর্ট পাঠানো যায়নি");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  let lastDay = "";
  const popMsg = pop ? (messages.find((m) => m.id === pop.id) ?? pins.find((m) => m.id === pop.id) ?? null) : null;
  const pinnedIds = new Set(pins.map((p) => p.id));
  const pinShown = pins.length ? pins[pinIdx % pins.length] : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        {photo ? (
          <img src={photo} alt="" className="cx-breathe size-9 shrink-0 rounded-full object-cover" />
        ) : peer ? (
          <span className="cx-breathe shrink-0">
            <Avatar name={peer.displayName} url={peer.avatarUrl} size={36} />
          </span>
        ) : (
          <span className="cx-breathe grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
            <MessageCircle className="size-4" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="cx-title flex items-center gap-1.5 truncate font-display text-base">
            <span className="truncate">{title}</span>
            {prefs.muted ? <BellOff className="size-3.5 shrink-0 text-muted" strokeWidth={1.75} /> : null}
          </p>
          <p className="truncate font-sans text-xs text-muted">
            {peer ? `@${peer.username} · ব্যক্তিগত কথোপকথন` : "সব সদস্য এখানে একসাথে কথা বলতে পারেন"}
          </p>
          {peer && presence.has(peer.id) ? (
            <p className="flex items-center gap-1.5 truncate font-sans text-xs">
              <PresenceDot row={presence.get(peer.id)} />
              <PresenceLabel row={presence.get(peer.id)} />
            </p>
          ) : null}
        </div>
        {peer ? (
          <Link
            to="/u/$username"
            params={{ username: peer.username }}
            className="pressable inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-sans text-xs text-muted hover:bg-surface-2 hover:text-fg"
          >
            <User className="size-3.5" strokeWidth={1.75} />
            প্রোফাইল
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setInfoOpen((v) => !v)}
          data-open={infoOpen}
          aria-label="চ্যাটের তথ্য"
          title="চ্যাটের তথ্য"
          className="cx-info-btn pressable grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Info className="size-5" strokeWidth={1.75} />
        </button>
      </header>

      {pinShown ? (
        <button
          type="button"
          onClick={() => {
            jumpTo(pinShown.id);
            setPinIdx((i) => i + 1);
          }}
          className="pressable flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2 text-left font-sans text-xs"
        >
          <Pin className="size-3.5 shrink-0 text-lamp" strokeWidth={1.75} />
          <span className="shrink-0 text-lamp">পিন করা বার্তা</span>
          <span className="min-w-0 flex-1 truncate text-muted">
            {pinShown.senderName}: {snippet(pinShown)}
          </span>
          {pins.length > 1 ? (
            <span className="shrink-0 text-subtle">
              {formatCount((pinIdx % pins.length) + 1)}/{formatCount(pins.length)}
            </span>
          ) : null}
        </button>
      ) : null}

      <div ref={box} onScroll={() => { onScroll(); if (pop) closePop(); }} className="cx-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4">
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
          const st = states[m.id];
          const toolsOn = activeId === m.id || pop?.id === m.id;
          return (
            <div key={m.id} id={`msg-${m.id}`}>
              {showDay ? (
                <p className="my-3 text-center font-sans text-[11px] text-subtle">
                  {when.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
                </p>
              ) : null}
              <div
                className={cn(
                  "group flex items-end gap-2 rounded-xl transition-colors duration-500",
                  mine ? "cx-msg-right flex-row-reverse" : "cx-msg-left",
                  flashId === m.id ? "bg-lamp/15" : "",
                )}
              >
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
                      {nick(m.senderId, m.senderName)}
                    </Link>
                  ) : null}
                  <div className="relative">
                    <div
                      className={cn(
                        "absolute -top-4 z-10 items-center gap-0.5 rounded-full border border-border bg-surface-2 p-0.5 shadow-lg",
                        mine ? "right-2" : "left-2",
                        toolsOn ? "flex" : "hidden sm:group-hover:flex sm:group-focus-within:flex",
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => openPop(e, m.id, "react")}
                        aria-label="প্রতিক্রিয়া"
                        title="প্রতিক্রিয়া"
                        className="pressable grid size-7 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
                      >
                        <Smile className="size-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => startReply(m)}
                        aria-label="উত্তর দিন"
                        title="উত্তর দিন"
                        className="pressable grid size-7 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
                      >
                        <Reply className="size-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openPop(e, m.id, "more")}
                        aria-label="আরও"
                        title="আরও"
                        className="pressable grid size-7 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
                      >
                        <EllipsisVertical className="size-4" strokeWidth={1.75} />
                      </button>
                    </div>
                    <div
                      onClick={() => setActiveId((cur) => (cur === m.id ? null : m.id))}
                      onDoubleClick={(e) => {
                        heartAt(e.clientX, e.clientY);
                        if (!st?.reactions.some((r) => r.emoji === "❤️" && r.mine)) void react(m, "❤️");
                      }}
                      style={mine ? themeStyle : undefined}
                      className={cn(
                        "rounded-2xl px-3 py-2 font-sans text-sm leading-relaxed",
                        mine ? "cx-mine" : "cx-theirs bg-surface-2 text-fg",
                      )}
                    >
                      {m.forwarded ? (
                        <p className="mb-1 flex items-center gap-1 text-[11px] italic opacity-70">
                          <Forward className="size-3" strokeWidth={1.75} />
                          <span>ফরওয়ার্ড করা</span>
                        </p>
                      ) : null}
                      {m.replyTo ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!m.replyTo?.deleted) jumpTo(m.replyTo!.id);
                          }}
                          className="mb-1.5 block w-full rounded-lg border-l-2 border-lamp bg-black/20 px-2 py-1 text-left text-xs"
                        >
                          {m.replyTo.deleted ? (
                            <span className="italic opacity-70">মূল বার্তাটি মুছে ফেলা হয়েছে</span>
                          ) : (
                            <>
                              <span className="block font-medium text-lamp">{m.replyTo.senderName}</span>
                              <span className="line-clamp-2 break-words opacity-80">{snippet(m.replyTo)}</span>
                            </>
                          )}
                        </button>
                      ) : null}
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
                      {m.body ? (
                        <p className="whitespace-pre-wrap break-words">
                          <MsgText body={m.body} />
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {st && st.reactions.length ? (
                    <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "")}>
                      {st.reactions.map((r) => (
                        <button
                          key={`${r.emoji}-${r.count}`}
                          type="button"
                          onClick={() => void react(m, r.emoji)}
                          className={cn(
                            "cx-chip pressable inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs",
                            r.mine ? "border-lamp bg-lamp/20 text-fg" : "border-border bg-surface-2 text-muted",
                          )}
                        >
                          <span>{r.emoji}</span>
                          <span className="font-sans">{formatCount(r.count)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-0.5 flex items-center gap-2 px-1 font-sans text-[10px] text-subtle">
                    <span>{when.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</span>
                    {pinnedIds.has(m.id) ? <Pin className="size-3 text-lamp" strokeWidth={1.75} /> : null}
                    {me.role === "admin" && st && st.reports > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-nsfw" title="রিপোর্ট">
                        <Flag className="size-3" strokeWidth={1.75} />
                        {formatCount(st.reports)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative border-t border-border p-3">
        {emojiOpen ? (
          <div ref={emojiBox} className="cx-picker absolute bottom-full left-3 z-20 mb-2 w-[min(344px,calc(100%-24px))] rounded-2xl border border-border bg-surface-2 p-2 shadow-2xl">
            <EmojiPicker onPick={addEmoji} height={200} />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mb-2 font-sans text-xs text-nsfw">
            {error}
          </p>
        ) : null}
        {notice ? <p className="mb-2 font-sans text-xs text-lamp">{notice}</p> : null}
        {replyTo ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-lamp bg-surface-2 px-3 py-1.5 font-sans text-xs">
            <Reply className="size-3.5 shrink-0 text-lamp" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-lamp">
                <span>উত্তর দিচ্ছেন</span> <span>{replyTo.senderName}</span>
              </p>
              <p className="truncate text-muted">{snippet(replyTo)}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="উত্তর বাতিল"
              className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
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
        {/^\/[a-z]*$/.test(text) ? (
          <div className="cx-slash mb-2 flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface-2 p-2 font-sans text-xs">
            {EFFECTS.filter((f) => f.cmd.startsWith(text.slice(1))).map((f) => (
              <button
                key={f.cmd}
                type="button"
                onClick={() => {
                  setText(`/${f.cmd} `);
                  areaRef.current?.focus();
                }}
                className="pressable rounded-full border border-border px-2.5 py-1 text-muted hover:text-fg"
              >
                <span className="text-lamp">/{f.cmd}</span> · {f.hint}
              </button>
            ))}
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEmojiOpen((v) => !v);
            }}
            aria-label="ইমোজি যোগ করুন"
            title="ইমোজি যোগ করুন"
            aria-expanded={emojiOpen}
            data-emoji-toggle
            className={cn("pressable grid size-11 shrink-0 place-items-center rounded-lg border border-border text-muted hover:text-fg", emojiOpen && "bg-surface-2 text-fg")}
          >
            <SmilePlus className="size-5" strokeWidth={1.75} />
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
          {!text.trim() && !pending ? (
            <button
              type="button"
              onClick={() => void sendQuick()}
              disabled={sending || uploading}
              aria-label="ইমোজি পাঠান"
              title="ইমোজি পাঠান"
              className="cx-quick pressable grid size-11 shrink-0 place-items-center rounded-lg border border-border text-2xl disabled:opacity-50"
            >
              {prefs.emoji}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || uploading}
              aria-label="পাঠান"
              title="পাঠান"
              style={themeStyle}
              className={cn(
                "pressable grid size-11 shrink-0 place-items-center rounded-lg text-accent-fg disabled:opacity-50",
                theme.from ? "cx-send-themed" : "bg-accent",
                flying && "cx-fly",
              )}
            >
              {sending ? (
                <span className="cx-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <Send className="size-5" strokeWidth={1.75} />
              )}
            </button>
          )}
        </div>
      </div>
      {pop && popMsg && pop.kind === "react" ? (
        <Popover rect={pop.rect} onClose={closePop}>
          <div className="flex items-center gap-1">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => void react(popMsg, e)}
                className="pressable grid size-10 place-items-center rounded-full text-2xl transition-transform hover:scale-125"
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-label="আরও প্রতিক্রিয়া"
              className="pressable grid size-9 place-items-center rounded-full bg-surface text-muted hover:text-fg"
            >
              <Plus className="size-5" strokeWidth={1.75} />
            </button>
          </div>
          {showMore ? (
            <div className="mt-1.5 grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto border-t border-border pt-1.5">
              {MORE_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => void react(popMsg, e)}
                  className="pressable grid size-9 place-items-center rounded-lg text-xl hover:bg-surface"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : null}
        </Popover>
      ) : null}

      {pop && popMsg && pop.kind === "more" ? (
        <Popover rect={pop.rect} onClose={closePop}>
          <div className="w-44 py-1 font-sans text-sm">
            {popMsg.senderId === me.id || (me.role === "admin" && popMsg.isGroup) ? (
              <button
                type="button"
                onClick={() => {
                  const id = popMsg.id;
                  closePop();
                  void remove(id);
                }}
                className="pressable flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface"
              >
                <Trash2 className="size-4" strokeWidth={1.75} />
                <span>মুছুন</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const m = popMsg;
                closePop();
                setForwarding(m);
              }}
              className="pressable flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface"
            >
              <Forward className="size-4" strokeWidth={1.75} />
              <span>ফরওয়ার্ড</span>
            </button>
            <button
              type="button"
              onClick={() => void pin(popMsg, pinnedIds.has(popMsg.id))}
              className="pressable flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface"
            >
              {pinnedIds.has(popMsg.id) ? (
                <PinOff className="size-4" strokeWidth={1.75} />
              ) : (
                <Pin className="size-4" strokeWidth={1.75} />
              )}
              <span>{pinnedIds.has(popMsg.id) ? "পিন সরান" : "পিন করুন"}</span>
            </button>
            {popMsg.senderId !== me.id ? (
              <button
                type="button"
                onClick={() => {
                  const m = popMsg;
                  closePop();
                  setReporting(m);
                }}
                className="pressable flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-nsfw hover:bg-surface"
              >
                <Flag className="size-4" strokeWidth={1.75} />
                <span>রিপোর্ট</span>
              </button>
            ) : null}
          </div>
        </Popover>
      ) : null}

      {infoOpen ? (
        <ChatInfoPanel
          onClose={() => setInfoOpen(false)}
          me={me as never}
          peer={peer}
          people={people}
          prefs={prefs}
          update={updatePrefs}
          messages={messages}
          pins={pins}
          displayTitle={title}
          displayPhoto={photo}
          onJump={jumpTo}
        />
      ) : null}

      {forwarding ? (
        <PickDialog title="কাকে ফরওয়ার্ড করবেন?" onClose={() => setForwarding(null)}>
          <button
            type="button"
            onClick={() => void forwardTo(forwarding, null)}
            className="pressable flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left font-sans text-sm hover:bg-surface-2"
          >
            <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-fg">
              <Users className="size-4" strokeWidth={1.75} />
            </span>
            <span>সবার চ্যাট</span>
          </button>
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void forwardTo(forwarding, p.id)}
              className="pressable flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left font-sans text-sm hover:bg-surface-2"
            >
              <Avatar name={p.displayName} url={p.avatarUrl} size={36} />
              <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
            </button>
          ))}
        </PickDialog>
      ) : null}

      {reporting ? (
        <PickDialog title="কেন রিপোর্ট করছেন?" onClose={() => setReporting(null)}>
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => void report(reporting, r)}
              className="pressable w-full rounded-lg px-3 py-2.5 text-left font-sans text-sm hover:bg-surface-2"
            >
              {r}
            </button>
          ))}
        </PickDialog>
      ) : null}
    </div>
  );
}

function PickDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="বন্ধ"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div className="relative flex max-h-[80dvh] w-full max-w-sm flex-col rounded-xl border border-border bg-surface p-4 shadow-xl">
        <h2 className="mb-2 font-display text-lg">{title}</h2>
        <div className="cx-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
        <button
          type="button"
          onClick={onClose}
          className="pressable mt-3 h-10 rounded-lg border border-border font-sans text-sm text-fg"
        >
          থাক
        </button>
      </div>
    </div>
  );
}
