import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AtSign,
  Bell,
  BellOff,
  ChevronDown,
  Image as ImageIcon,
  Link2,
  Palette,
  Pencil,
  Pin,
  Search,
  Smile,
  Type,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/members/avatar";
import { MsgText } from "@/components/chat/chat-fx";
import { resizeToJpeg } from "@/lib/image-resize";
import { ALL_REACTIONS } from "@/lib/chat-emoji";
import { CHAT_THEMES, type ChatPrefs } from "@/lib/chat-prefs";
import type { ChatMessage, Conversation } from "@/lib/social-api";
import { cn } from "@/lib/utils";

type PersonLite = { id: number; name: string; avatarUrl: string | null; username: string };

function Section({ title, icon, children, defaultOpen = false, i = 0 }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean; i?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="cx-rise border-b border-border/60 py-1" style={{ ["--i" as string]: i }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pressable flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left font-sans text-sm font-medium hover:bg-surface-2"
      >
        <span className="text-lamp">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn("size-4 text-muted transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div className="cx-collapse" data-open={open}>
        <div>
          <div className="px-2 pb-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, onClick, right }: { icon: ReactNode; label: string; onClick?: () => void; right?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-sans text-sm hover:bg-surface-2"
    >
      <span className="grid size-7 place-items-center text-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {right}
    </button>
  );
}

export function ChatInfoPanel({
  onClose,
  me,
  peer,
  people,
  prefs,
  update,
  messages,
  pins,
  displayTitle,
  displayPhoto,
  onJump,
}: {
  onClose: () => void;
  me: { id: number; displayName?: string; username?: string; avatarUrl?: string | null } & Record<string, unknown>;
  peer: Conversation | null;
  people: Conversation[];
  prefs: ChatPrefs;
  update: (patch: Partial<ChatPrefs>) => void;
  messages: ChatMessage[];
  pins: ChatMessage[];
  displayTitle: string;
  displayPhoto: string | null;
  onJump: (id: number) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [nameDraft, setNameDraft] = useState(prefs.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"photos" | "links">("photos");
  const photoRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const members: PersonLite[] = useMemo(() => {
    const meName = String(me.displayName ?? me.username ?? "আমি");
    const self: PersonLite = { id: me.id, name: meName, avatarUrl: (me.avatarUrl as string | null) ?? null, username: String(me.username ?? "") };
    const others = (peer ? [peer] : people).map((p) => ({ id: p.id, name: p.displayName, avatarUrl: p.avatarUrl, username: p.username }));
    return [self, ...others];
  }, [me, peer, people]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return messages.filter((m) => m.body.toLowerCase().includes(needle)).slice(-40).reverse();
  }, [q, messages]);

  const photos = useMemo(() => messages.filter((m) => m.imageUrl).slice().reverse(), [messages]);
  const links = useMemo(() => {
    const out: { url: string; by: string; id: number }[] = [];
    for (const m of messages) {
      for (const u of m.body.match(/https?:\/\/[^\s]+/g) ?? []) out.push({ url: u, by: m.senderName, id: m.id });
    }
    return out.reverse();
  }, [messages]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const img = await resizeToJpeg(file, { maxSide: 256, maxBytes: 60 * 1024 });
      update({ photo: `data:image/jpeg;base64,${img.base64}` });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "ছবি দেওয়া যায়নি");
    } finally {
      setBusy(false);
    }
  }

  const pinName = (m: ChatMessage) => prefs.nicknames[String(m.senderId)] || m.senderName;

  return (
    <div className="absolute inset-0 z-30 flex justify-end">
      <button type="button" aria-label="বন্ধ" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <aside className="cx-panel relative flex h-full w-full max-w-sm flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-3">
          <p className="font-display text-base">চ্যাটের তথ্য</p>
          <button type="button" onClick={onClose} aria-label="বন্ধ" className="pressable grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          <div className="cx-rise flex flex-col items-center gap-1 px-4 py-4 text-center">
            {displayPhoto ? (
              <img src={displayPhoto} alt="" className="size-20 rounded-full object-cover ring-2 ring-lamp/40" />
            ) : peer ? (
              <Avatar name={peer.displayName} url={peer.avatarUrl} size={80} />
            ) : (
              <span className="grid size-20 place-items-center rounded-full bg-accent text-accent-fg">
                <Users className="size-8" strokeWidth={1.5} />
              </span>
            )}
            <p className="cx-title mt-1 font-display text-lg">{displayTitle}</p>
            <p className="font-sans text-xs text-muted">{peer ? `@${peer.username}` : "সবার চ্যাট"}</p>
            <div className="mt-3 flex gap-6">
              <button type="button" onClick={() => update({ muted: !prefs.muted })} className="pressable flex flex-col items-center gap-1 font-sans text-xs text-muted hover:text-fg">
                <span className={cn("grid size-10 place-items-center rounded-full bg-surface-2", prefs.muted && "bg-accent text-accent-fg")}>
                  {prefs.muted ? <BellOff className="size-5" strokeWidth={1.75} /> : <Bell className="size-5" strokeWidth={1.75} />}
                </span>
                {prefs.muted ? "আনমিউট" : "মিউট"}
              </button>
              <button type="button" onClick={() => setSearching((v) => !v)} className="pressable flex flex-col items-center gap-1 font-sans text-xs text-muted hover:text-fg">
                <span className={cn("grid size-10 place-items-center rounded-full bg-surface-2", searching && "bg-accent text-accent-fg")}>
                  <Search className="size-5" strokeWidth={1.75} />
                </span>
                খুঁজুন
              </button>
            </div>
          </div>

          {searching ? (
            <div className="cx-rise px-4 pb-3">
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="বার্তায় খুঁজুন…" className="field-input" />
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {q.trim() && hits.length === 0 ? <p className="px-2 py-2 font-sans text-xs text-muted">কিছু পাওয়া যায়নি।</p> : null}
                {hits.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onJump(m.id);
                      onClose();
                    }}
                    className="pressable block w-full rounded-lg px-3 py-2 text-left font-sans text-xs hover:bg-surface-2"
                  >
                    <span className="block text-lamp">{pinName(m)}</span>
                    <span className="line-clamp-2 break-words text-muted">
                      <MsgText body={m.body.replace(/^\/[a-z]+\s+/, "")} q={q.trim()} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <Section i={1} title="চ্যাটের তথ্য" icon={<Pin className="size-4" />} defaultOpen>
            {pins.length === 0 ? (
              <p className="px-3 py-2 font-sans text-xs text-muted">এখনো কোনো পিন করা বার্তা নেই।</p>
            ) : (
              pins.map((m) => (
                <Row
                  key={m.id}
                  icon={<Pin className="size-4 text-lamp" />}
                  label={`${pinName(m)}: ${m.body || "📷 ছবি"}`}
                  onClick={() => {
                    onJump(m.id);
                    onClose();
                  }}
                />
              ))
            )}
            {pins.length ? null : null}
          </Section>

          <Section i={2} title="চ্যাট কাস্টমাইজ" icon={<Palette className="size-4" />}>
            <div className="px-3 py-2">
              <label className="mb-1 flex items-center gap-2 font-sans text-xs text-muted">
                <Pencil className="size-3.5" /> চ্যাটের নাম বদলান
              </label>
              <div className="flex gap-2">
                <input value={nameDraft} maxLength={40} onChange={(e) => setNameDraft(e.target.value)} placeholder={peer ? peer.displayName : "সবার চ্যাট"} className="field-input" />
                <button type="button" onClick={() => update({ name: nameDraft.trim() })} className="pressable shrink-0 rounded-lg bg-accent px-3 font-sans text-sm text-accent-fg">
                  সেভ
                </button>
              </div>
            </div>

            <div className="px-3 py-2">
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e)} />
              <div className="flex items-center gap-3">
                <button type="button" disabled={busy} onClick={() => photoRef.current?.click()} className="pressable flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-sans text-sm hover:bg-surface-2 disabled:opacity-50">
                  <ImageIcon className="size-4" /> {busy ? "প্রস্তুত হচ্ছে…" : "ছবি বদলান"}
                </button>
                {prefs.photo ? (
                  <button type="button" onClick={() => update({ photo: "" })} className="pressable font-sans text-xs text-muted hover:text-fg">
                    সরান
                  </button>
                ) : null}
              </div>
              {err ? <p className="mt-1 font-sans text-xs text-nsfw">{err}</p> : null}
            </div>

            <div className="px-3 py-2">
              <p className="mb-2 flex items-center gap-2 font-sans text-xs text-muted">
                <Palette className="size-3.5" /> থিম বদলান
              </p>
              <div className="grid grid-cols-4 gap-2">
                {CHAT_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update({ theme: t.id })}
                    aria-label={t.label}
                    title={t.label}
                    className={cn("pressable flex flex-col items-center gap-1 rounded-lg p-1.5 font-sans text-[10px] text-muted", prefs.theme === t.id && "bg-surface-2 text-fg")}
                  >
                    <span
                      className={cn("size-8 rounded-full border border-border transition-transform", prefs.theme === t.id && "scale-110 ring-2 ring-lamp")}
                      style={{ background: t.from ? `linear-gradient(135deg, ${t.from}, ${t.to})` : "var(--color-accent)" }}
                    />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3 py-2">
              <p className="mb-2 flex items-center gap-2 font-sans text-xs text-muted">
                <Smile className="size-3.5" /> ইমোজি বদলান <span className="text-subtle">(পাঠানোর বোতামে বসবে)</span>
              </p>
              <div className="grid max-h-36 grid-cols-8 gap-0.5 overflow-y-auto">
                {ALL_REACTIONS.map((e) => (
                  <button key={e} type="button" onClick={() => update({ emoji: e })} className={cn("pressable grid size-8 place-items-center rounded-lg text-lg hover:bg-surface-2", prefs.emoji === e && "bg-surface-2 ring-1 ring-lamp")}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3 py-2">
              <p className="mb-2 flex items-center gap-2 font-sans text-xs text-muted">
                <AtSign className="size-3.5" /> ডাকনাম সম্পাদনা
              </p>
              <div className="space-y-2">
                {members.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Avatar name={p.name} url={p.avatarUrl} size={28} />
                    <input
                      defaultValue={prefs.nicknames[String(p.id)] ?? ""}
                      maxLength={30}
                      placeholder={p.name}
                      onBlur={(e) => {
                        const next = { ...prefs.nicknames };
                        const v = e.target.value.trim();
                        if (v) next[String(p.id)] = v;
                        else delete next[String(p.id)];
                        update({ nicknames: next });
                      }}
                      className="field-input !min-h-9 !py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section i={3} title="চ্যাট সদস্য" icon={<UserRound className="size-4" />}>
            {members.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 font-sans text-sm">
                <Avatar name={p.name} url={p.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{prefs.nicknames[String(p.id)] || p.name}</p>
                  {p.username ? <p className="truncate text-xs text-muted">@{p.username}</p> : null}
                </div>
                {p.id === me.id ? <span className="text-xs text-subtle">আপনি</span> : null}
              </div>
            ))}
          </Section>

          <Section i={4} title="মিডিয়া, ফাইল ও লিঙ্ক" icon={<Type className="size-4" />}>
            <div className="mb-2 flex gap-1 px-3">
              {(["photos", "links"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={cn("pressable rounded-full px-3 py-1 font-sans text-xs", tab === t ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>
                  {t === "photos" ? `ছবি (${photos.length})` : `লিঙ্ক (${links.length})`}
                </button>
              ))}
            </div>
            {tab === "photos" ? (
              photos.length === 0 ? (
                <p className="px-3 py-2 font-sans text-xs text-muted">এখনো কোনো ছবি নেই।</p>
              ) : (
                <div className="grid grid-cols-3 gap-1 px-3">
                  {photos.map((m) => (
                    <a key={m.id} href={m.imageUrl ?? "#"} target="_blank" rel="noreferrer" className="pressable block aspect-square overflow-hidden rounded-lg">
                      <img src={m.imageUrl ?? ""} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 hover:scale-110" />
                    </a>
                  ))}
                </div>
              )
            ) : links.length === 0 ? (
              <p className="px-3 py-2 font-sans text-xs text-muted">এখনো কোনো লিঙ্ক নেই।</p>
            ) : (
              links.map((l, k) => (
                <a key={k} href={l.url} target="_blank" rel="noreferrer" className="pressable flex items-center gap-3 rounded-lg px-3 py-2 font-sans text-xs hover:bg-surface-2">
                  <Link2 className="size-4 shrink-0 text-lamp" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg">{l.url}</span>
                    <span className="text-muted">{l.by}</span>
                  </span>
                </a>
              ))
            )}
            <p className="px-3 pt-2 font-sans text-[11px] text-subtle">এই চ্যাটে শুধু ছবি ও লিঙ্ক পাঠানো যায়।</p>
          </Section>
        </div>
      </aside>
    </div>
  );
}
