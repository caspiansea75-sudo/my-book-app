import { useEffect, useState, useSyncExternalStore } from "react";
import { music, TUNES } from "@/components/pokemon/arena-music";

/** The battle music button: tap for on/off, long panel for the volume and the tune. Starts the music with the battle screen. */
export function MusicControl({ t }: { t: (bn: string, en: string) => string }) {
  const [open, setOpen] = useState(false);
  // re-read the music's settings whenever they change
  const version = useSyncExternalStore(
    (fn) => music.subscribe(fn),
    () => `${music.isOn()}|${music.volume()}|${music.tune().id}`,
    () => "",
  );
  void version;

  useEffect(() => {
    music.start();
    // browsers only allow sound after a tap or a key press: start with the first one
    const go = () => music.start();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    const vis = () => music.hidden(document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      document.removeEventListener("visibilitychange", vis);
      music.stop();
    };
  }, []);

  const on = music.isOn();
  const tune = music.tune();
  return (
    <div className="ab-music">
      <button
        type="button"
        className={`ab-ic ${on ? "" : "off"}`}
        onClick={() => setOpen(!open)}
        aria-label={t("সংগীত", "Music")}
        aria-expanded={open}
        title={t("সংগীত", "Music")}
      >
        {on && music.volume() > 0 ? "🎵" : "🔇"}
      </button>
      {open ? (
        <div className="ab-music-pop" role="group" aria-label={t("সংগীত", "Music")} onPointerDown={(e) => e.stopPropagation()}>
          <div className="ab-music-row">
            <button type="button" className="ab-music-sw" onClick={() => music.setOn(!on)} aria-pressed={on}>
              {on ? t("সংগীত চালু", "Music on") : t("সংগীত বন্ধ", "Music off")}
            </button>
            <button type="button" className="ab-music-x" onClick={() => setOpen(false)} aria-label={t("বন্ধ করুন", "Close")}>×</button>
          </div>
          <label className="ab-music-vol">
            <span>{t("ভলিউম", "Volume")}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(music.volume() * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                music.setVolume(v);
                if (v > 0 && !music.isOn()) music.setOn(true);
                else music.start();
              }}
              aria-label={t("ভলিউম", "Volume")}
            />
            <b>{Math.round(music.volume() * 100)}</b>
          </label>
          <div className="ab-music-row">
            <button type="button" className="ab-music-step" onClick={() => music.nextTune(-1)} aria-label={t("আগের সুর", "Previous tune")}>‹</button>
            <span className="ab-music-name">{t(tune.bn, tune.name)}<small>{TUNES.findIndex((x) => x.id === tune.id) + 1}/{TUNES.length}</small></span>
            <button type="button" className="ab-music-step" onClick={() => music.nextTune(1)} aria-label={t("পরের সুর", "Next tune")}>›</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
