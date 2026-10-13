import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/components/pokemon/ui";
import { battleAudio } from "@/lib/pokemon/audio";
import { MAX_CUSTOM_BYTES, MAX_CUSTOM_TRACKS, addCustom, listCustom, removeCustom, type CustomTrack } from "@/lib/pokemon/custom-music";
import { TRACK_SPECS } from "@/lib/pokemon/tracks";

function useAudioSnap() {
  return useSyncExternalStore(battleAudio.subscribe, battleAudio.get, battleAudio.getServer);
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The 🎵 button in the battle bar: opens volume sliders, the theme list, and "add my own music". */
export function MusicPanel() {
  const { t } = useT();
  const snap = useAudioSnap();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<CustomTrack[]>([]);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) void listCustom().then(setCustom);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (track: string) => {
    battleAudio.set({ track });
    void battleAudio.unlock();
  };

  async function onFiles(files: FileList | null) {
    setErr("");
    for (const f of Array.from(files ?? [])) {
      try {
        await addCustom(f);
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        setErr(
          code === "too-big" ? t(`ফাইল বড় (সর্বোচ্চ ${MAX_CUSTOM_BYTES / 1048576} MB)`, `File too big (max ${MAX_CUSTOM_BYTES / 1048576} MB)`)
          : code === "too-many" ? t(`সর্বোচ্চ ${MAX_CUSTOM_TRACKS}টি গান রাখা যায় — একটি মুছুন`, `You can keep ${MAX_CUSTOM_TRACKS} songs — delete one first`)
          : code === "not-audio" ? t("এটি অডিও ফাইল নয়", "That isn't an audio file")
          : t("এই ব্রাউজারে নিজের গান যোগ করা যাচ্ছে না", "This browser can't store your own songs"),
        );
      }
    }
    setCustom(await listCustom());
    if (file.current) file.current.value = "";
  }

  const slider = (label: string, key: "master" | "music" | "sfx", onEnd?: () => void) => (
    <label className="block font-sans text-xs text-muted">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-fg">{pct(snap[key])}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(snap[key] * 100)}
        onChange={(e) => battleAudio.set({ [key]: Number(e.target.value) / 100 })}
        onPointerUp={onEnd}
        onKeyUp={onEnd}
        className="mt-1 h-2 w-full cursor-pointer accent-[#ffcb05]"
        aria-label={label}
      />
    </label>
  );

  const nowName =
    snap.playing.startsWith("custom:")
      ? custom.find((c) => `custom:${c.id}` === snap.playing)?.name ?? "♪"
      : TRACK_SPECS.find((s) => s.id === snap.playing)?.[t("bn", "en") as "bn" | "en"] ?? "";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          void battleAudio.unlock();
        }}
        className={`pressable rounded-full border px-2.5 py-0.5 text-sm ${snap.running && !snap.muted ? "border-border" : "border-lamp pk-pulse-badge"}`}
        aria-label={t("সংগীত ও শব্দ", "Music & sound")}
        aria-expanded={open}
        title={t("সংগীত ও শব্দ", "Music & sound")}
      >
        {snap.muted || !snap.running ? "🔇" : "🎵"}
      </button>
      {open ? (
        <div className="pk-pop absolute right-0 top-full z-[60] mt-2 w-[min(92vw,340px)] space-y-4 rounded-2xl border border-border bg-surface p-4 text-fg shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base">🎵 {t("সংগীত ও শব্দ", "Music & sound")}</h3>
            <button type="button" onClick={() => setOpen(false)} className="pressable text-muted" aria-label={t("বন্ধ করুন", "Close")}>✕</button>
          </div>

          {!snap.running ? (
            <button type="button" onClick={() => void battleAudio.unlock()} className="pressable pk-pulse-badge w-full rounded-xl bg-accent px-3 py-2 font-sans text-sm text-accent-fg">
              🔊 {t("সংগীত চালু করুন (ট্যাপ করুন)", "Turn the music on (tap here)")}
            </button>
          ) : snap.playing ? (
            <p className="font-sans text-xs text-muted">▶ {t("এখন বাজছে:", "Now playing:")} <b className="text-fg">{nowName}</b></p>
          ) : null}

          <div className="space-y-3">
            {slider(t("মাস্টার ভলিউম", "Master volume"), "master")}
            {slider(t("গান", "Music"), "music")}
            {slider(t("শব্দ-প্রভাব (আঘাত, মেগা…)", "Sound effects (hits, Mega…)"), "sfx", () => battleAudio.testSfx())}
            <button type="button" onClick={() => battleAudio.set({ muted: !snap.muted })} className="pressable rounded-full border border-border bg-surface-2 px-3 py-1 font-sans text-xs">
              {snap.muted ? `🔇 ${t("মিউট আছে — চালু করুন", "Muted — unmute")}` : `🔊 ${t("সব মিউট করুন", "Mute everything")}`}
            </button>
          </div>

          <div>
            <p className="mb-1.5 font-sans text-xs text-muted">{t("থিম বেছে নিন", "Choose a theme")}</p>
            <ul className="space-y-1">
              <li>
                <ThemeRow active={snap.track === "auto"} onClick={() => choose("auto")} icon="🎲" title={t("অটো (লড়াই অনুযায়ী)", "Auto (suits the battle)")} sub={t("প্রতিপক্ষের ধরন দেখে বাছাই হয়", "picked from who you're fighting")} />
              </li>
              {TRACK_SPECS.map((s) => (
                <li key={s.id}>
                  <ThemeRow active={snap.track === s.id} onClick={() => choose(s.id)} icon={s.emoji} title={t(s.bn, s.en)} sub={t(s.moodBn, s.moodEn)} />
                </li>
              ))}
              {custom.map((c) => (
                <li key={c.id} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <ThemeRow active={snap.track === `custom:${c.id}`} onClick={() => choose(`custom:${c.id}`)} icon="💿" title={c.name} sub={t("আমার গান", "my song")} />
                  </div>
                  <button
                    type="button"
                    aria-label={t("মুছুন", "Delete")}
                    onClick={async () => {
                      await removeCustom(c.id);
                      if (snap.track === `custom:${c.id}`) battleAudio.set({ track: "auto" });
                      setCustom(await listCustom());
                    }}
                    className="pressable shrink-0 px-2 text-subtle hover:text-nsfw"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-dashed border-border p-3 font-sans text-xs text-muted">
            <p>
              {t(
                "নিজের গান যোগ করুন (যেমন আপনার কেনা বা আইনিভাবে পাওয়া সংগীত)। ফাইল শুধু এই ডিভাইসের ব্রাউজারে থাকবে — সাইটে আপলোড হবে না।",
                "Add your own songs (music you own or may legally use). Files stay in this device's browser only — nothing is uploaded to the site.",
              )}
            </p>
            <input ref={file} type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
            <button type="button" onClick={() => file.current?.click()} disabled={custom.length >= MAX_CUSTOM_TRACKS} className="pressable mt-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-fg disabled:opacity-40">
              ➕ {t("গান যোগ করুন", "Add songs")} ({custom.length}/{MAX_CUSTOM_TRACKS})
            </button>
            {err ? <p className="mt-2 text-nsfw">{err}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThemeRow({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: string; title: string; sub: string }) {
  return (
    <button type="button" onClick={onClick} className={`pressable flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left font-sans ${active ? "border-lamp bg-surface-2" : "border-border bg-bg hover:bg-surface-2"}`}>
      <span className="text-lg">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm">{title}</b>
        <span className="block truncate text-[11px] text-muted">{sub}</span>
      </span>
      {active ? <span className="text-lamp">●</span> : null}
    </button>
  );
}
