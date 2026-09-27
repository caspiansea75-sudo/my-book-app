import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ImageIcon, MessageCircle, Send, Sparkles, Volume2 } from "lucide-react";
import { SiteNav } from "@/components/book/site-nav";
import { aiChat, aiNarrate, aiStatus, buildImageUrl } from "@/lib/ai-api";

export const Route = createFileRoute("/ai")({
  loader: () => aiStatus(),
  component: AiPage,
});

type Tab = "chat" | "image" | "audio";

function AiPage() {
  const status = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <main className="relative min-h-dvh">
      <SiteNav active="ai" />
      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <p className="flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
          <Sparkles className="size-4" strokeWidth={1.6} />
          এআই
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">এআই টুলস</h1>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted">
          চ্যাট করুন, ছবি বানান, বা লেখা থেকে অডিও তৈরি করুন — গল্পের বাইরে, একদম আলাদা একটি জায়গা।
        </p>

        <div className="mt-8 flex flex-wrap gap-1.5">
          {(
            [
              ["chat", "চ্যাট", MessageCircle],
              ["image", "ছবি", ImageIcon],
              ["audio", "অডিও", Volume2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "pressable inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-3.5 font-sans text-xs text-accent-fg"
                  : "pressable inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3.5 font-sans text-xs text-muted"
              }
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "chat" ? <ChatTab configured={status.chatConfigured} /> : null}
          {tab === "image" ? <ImageTab /> : null}
          {tab === "audio" ? <AudioTab configured={status.audioConfigured} /> : null}
        </div>
      </section>
    </main>
  );
}

function NotConfigured({ envVar }: { envVar: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 font-sans text-sm text-muted">
      এই ফিচারটি এখনো চালু করা হয়নি। Vercel-এ{" "}
      <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-fg">{envVar}</code> যোগ করলে এটি
      কাজ করবে।
    </div>
  );
}

function ChatTab({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  if (!configured) return <NotConfigured envVar="GEMINI_API_KEY" />;

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    const nextHistory = [...messages, { role: "user" as const, text }];
    setMessages(nextHistory);
    setBusy(true);
    try {
      const { reply } = await aiChat({ data: { message: text, history: messages } });
      setMessages([...nextHistory, { role: "model", text: reply }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "উত্তর আসেনি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="max-h-[50vh] min-h-[200px] overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="py-8 text-center font-sans text-sm text-muted">কিছু জিজ্ঞাসা করুন…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-accent px-3.5 py-2.5 font-sans text-sm text-accent-fg"
                    : "mr-auto max-w-[85%] rounded-xl rounded-bl-sm bg-surface-2 px-3.5 py-2.5 font-sans text-sm text-fg"
                }
              >
                {m.text}
              </div>
            ))}
            {busy ? <div className="mr-auto font-sans text-xs text-muted">লিখছে…</div> : null}
            <div ref={endRef} />
          </div>
        )}
      </div>
      {error ? <p className="mt-2 font-sans text-xs text-nsfw">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSend();
          }}
          placeholder="লিখুন…"
          className="field-input flex-1"
        />
        <button
          type="button"
          onClick={() => void onSend()}
          disabled={busy || !input.trim()}
          className="pressable grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg disabled:opacity-50"
          aria-label="পাঠান"
        >
          <Send className="size-4" strokeWidth={1.9} />
        </button>
      </div>
    </div>
  );
}

function ImageTab() {
  const [prompt, setPrompt] = useState("");
  const [seed, setSeed] = useState(0);
  const [shown, setShown] = useState<{ url: string; prompt: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function onGenerate() {
    const text = prompt.trim();
    if (!text) return;
    const nextSeed = Math.floor(Math.random() * 100000);
    setSeed(nextSeed);
    setLoading(true);
    setShown({ url: buildImageUrl(text, nextSeed), prompt: text });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onGenerate();
          }}
          placeholder="কী আঁকতে চান লিখুন…"
          className="field-input flex-1"
        />
        <button
          type="button"
          onClick={onGenerate}
          disabled={!prompt.trim()}
          className="pressable inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg disabled:opacity-50"
        >
          <ImageIcon className="size-4" strokeWidth={1.8} />
          বানান
        </button>
      </div>

      <div className="mt-4 aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-2">
        {shown ? (
          <img
            key={shown.url}
            src={shown.url}
            alt={shown.prompt}
            className="h-full w-full object-cover"
            onLoad={() => setLoading(false)}
          />
        ) : (
          <div className="grid h-full place-items-center font-sans text-sm text-muted">
            এখানে ছবি দেখা যাবে
          </div>
        )}
        {loading ? (
          <div className="grid h-full place-items-center font-sans text-xs text-muted">তৈরি হচ্ছে…</div>
        ) : null}
      </div>
      {shown ? (
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            const nextSeed = seed + 1;
            setSeed(nextSeed);
            setShown({ url: buildImageUrl(shown.prompt, nextSeed), prompt: shown.prompt });
          }}
          className="pressable mt-3 h-9 rounded-lg border border-border px-3 font-sans text-xs text-muted"
        >
          আবার চেষ্টা করুন
        </button>
      ) : null}
    </div>
  );
}

const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel (নারী)" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh (পুরুষ)" },
];

function AudioTab({ configured }: { configured: boolean }) {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return <NotConfigured envVar="ELEVENLABS_API_KEY" />;

  async function onGenerate() {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    setAudioSrc(null);
    try {
      const { audioBase64 } = await aiNarrate({ data: { text: t, voiceId } });
      setAudioSrc(`data:audio/mpeg;base64,${audioBase64}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "অডিও তৈরি হয়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="যে লেখাটা কণ্ঠে শুনতে চান…"
        className="field-input w-full"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          className="field-input h-10 w-auto"
        >
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={busy || !text.trim()}
          className="pressable inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg disabled:opacity-50"
        >
          <Volume2 className="size-4" strokeWidth={1.8} />
          {busy ? "তৈরি হচ্ছে…" : "শুনুন তৈরি করুন"}
        </button>
      </div>
      {error ? <p className="mt-2 font-sans text-xs text-nsfw">{error}</p> : null}
      {audioSrc ? (
        <audio controls src={audioSrc} className="mt-4 w-full">
          <track kind="captions" />
        </audio>
      ) : null}
    </div>
  );
}
