/**
 * Photo mode for Arena Brawl: time can be frozen or slowed, the camera is moved by hand (drag to slide, right-drag or
 * the arrows to turn, wheel or pinch to zoom), the screen shows only the picture, and a "film look" (colour grade,
 * letterbox bars, vignette, grain) is applied to what you see and to the picture you save.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Eye, EyeOff, RotateCcw, RotateCw, StepForward, X } from "lucide-react";
import type { ArenaRenderer, View } from "@/components/pokemon/arena-render";

type Look = { id: string; bn: string; en: string; filter: string; /** a colour wash laid over the picture: [top, bottom] */ wash?: [string, string]; vig: number; grain: number };

const LOOKS: Look[] = [
  { id: "none", bn: "সাধারণ", en: "Natural", filter: "none", vig: 0, grain: 0 },
  { id: "cine", bn: "সিনেমা", en: "Cinematic", filter: "contrast(1.14) saturate(1.2) brightness(0.96)", wash: ["rgba(20,110,140,.55)", "rgba(255,150,60,.5)"], vig: 0.5, grain: 0.07 },
  { id: "drama", bn: "নাটকীয়", en: "Dramatic", filter: "contrast(1.35) saturate(1.3) brightness(0.88)", wash: ["rgba(40,30,90,.5)", "rgba(255,110,40,.45)"], vig: 0.72, grain: 0.08 },
  { id: "dream", bn: "স্বপ্নিল", en: "Dreamy", filter: "contrast(0.95) saturate(1.35) brightness(1.08) blur(0.4px)", wash: ["rgba(255,170,230,.4)", "rgba(120,200,255,.35)"], vig: 0.3, grain: 0.04 },
  { id: "vintage", bn: "পুরনো", en: "Vintage", filter: "sepia(0.45) contrast(1.06) saturate(0.9)", vig: 0.6, grain: 0.12 },
  { id: "noir", bn: "নোয়ার", en: "Noir", filter: "grayscale(1) contrast(1.35) brightness(0.95)", vig: 0.7, grain: 0.1 },
  { id: "vivid", bn: "উজ্জ্বল", en: "Vivid", filter: "saturate(1.55) contrast(1.1)", vig: 0.2, grain: 0 },
];

const SPEEDS: [number, string][] = [[0, "❚❚"], [0.08, "0.1×"], [0.3, "0.3×"], [1, "1×"]];

/** A tile of film grain (made once). */
let grainTile: HTMLCanvasElement | null = null;
function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  grainTile = c;
  return c;
}

const ASPECT = 2.39;

export function PhotoMode({ R, canvas, t, onClose, onSpeed, onStep }: { R: ArenaRenderer; canvas: HTMLCanvasElement; t: (bn: string, en: string) => string; onClose: () => void; onSpeed: (v: number) => void; onStep: () => void }) {
  const [look, setLook] = useState("cine");
  const [bars, setBars] = useState(true);
  const [vig, setVig] = useState(true);
  const [film, setFilm] = useState(true);
  const [grid, setGrid] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [ui, setUi] = useState(true);
  const [view, setView] = useState<View>(R.getView());
  const [zoom, setZoom] = useState(R.getZoom());
  const [shots, setShots] = useState<{ url: string; name: string }[]>([]);
  const [flash, setFlash] = useState(0);
  const [note, setNote] = useState("");
  const L = useMemo(() => LOOKS.find((x) => x.id === look) ?? LOOKS[0]!, [look]);
  const ptr = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const grainUrl = useMemo(() => grain().toDataURL(), []);

  // the picture itself carries the colour grade while the mode is open
  useEffect(() => {
    canvas.style.filter = L.filter === "none" ? "" : L.filter;
    return () => {
      canvas.style.filter = "";
    };
  }, [canvas, L]);
  useEffect(() => {
    onSpeed(speed);
  }, [speed, onSpeed]);
  useEffect(() => () => onSpeed(0), [onSpeed]);
  // keyboard: arrows turn, + / - zoom, space takes the picture, Escape leaves
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        shoot();
      } else if (e.key === "ArrowLeft") R.turn(-0.12);
      else if (e.key === "ArrowRight") R.turn(0.12);
      else if (e.key === "+" || e.key === "=") zoomTo(R.getZoom() + 0.15);
      else if (e.key === "-") zoomTo(R.getZoom() - 0.15);
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  });

  const zoomTo = (z: number) => {
    R.setZoom(z);
    setZoom(R.getZoom());
  };
  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    ptr.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.current.size === 2) {
      const [a, b] = [...ptr.current.values()];
      pinch.current = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
  };
  const move = (e: React.PointerEvent) => {
    const p = ptr.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (ptr.current.size >= 2) {
      const [a, b] = [...ptr.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinch.current > 0) zoomTo(R.getZoom() * (d / pinch.current));
      pinch.current = d;
    } else if (e.buttons & 2 || e.shiftKey) {
      if (R.getView() !== "top") R.turn(dx * 0.008);
    } else R.panBy(dx, dy);
  };
  const up = (e: React.PointerEvent) => {
    ptr.current.delete(e.pointerId);
    pinch.current = 0;
  };

  /** Take the picture: the canvas, with the same look as on screen, saved as a PNG. */
  const shoot = () => {
    const c = canvas;
    const w = c.width;
    const h = c.height;
    const o = document.createElement("canvas");
    o.width = w;
    o.height = h;
    const g = o.getContext("2d");
    if (!g) return;
    const gf = g as CanvasRenderingContext2D & { filter?: string };
    if ("filter" in g && L.filter !== "none") gf.filter = L.filter;
    g.drawImage(c, 0, 0, w, h);
    if ("filter" in g) gf.filter = "none";
    if (film && L.wash) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, L.wash[0]);
      gr.addColorStop(1, L.wash[1]);
      g.globalCompositeOperation = "soft-light";
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "source-over";
    }
    if (vig && L.vig > 0) {
      const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(1, `rgba(0,0,0,${L.vig})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    if (film && L.grain > 0) {
      g.globalAlpha = L.grain;
      g.globalCompositeOperation = "overlay";
      const pat = g.createPattern(grain(), "repeat");
      if (pat) {
        g.fillStyle = pat;
        g.fillRect(0, 0, w, h);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    if (bars) {
      const bh = Math.max(0, (h - w / ASPECT) / 2);
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, bh);
      g.fillRect(0, h - bh, w, bh);
    }
    const name = `arena-brawl-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.png`;
    const fail = () => setNote(t("ছবি সেভ করা গেল না", "Couldn't save the picture here"));
    try {
      o.toBlob((b) => {
        if (!b) return fail();
        save(b);
      }, "image/png");
    } catch {
      fail();
    }
    setFlash((n) => n + 1);
    function save(b: Blob) {
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setShots((s) => [{ url, name }, ...s].slice(0, 4));
      setNote("");
    }
  };
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(0), 160);
    return () => clearTimeout(id);
  }, [flash]);

  const cycleView = () => {
    const next: View = view === "top" ? "third" : view === "third" ? "first" : "top";
    R.setView(next);
    setView(next);
  };
  const viewName = view === "top" ? t("উপর থেকে", "Top") : view === "third" ? t("তৃতীয়", "3rd person") : t("প্রথম", "1st person");

  return (
    <div className="ab-ph" onContextMenu={(e) => e.preventDefault()}>
      {/* the film look drawn over the picture */}
      <div className="ab-ph-fx">
        {film && L.wash ? <div className="fx wash" style={{ background: `linear-gradient(${L.wash[0]}, ${L.wash[1]})` }} /> : null}
        {film && L.grain > 0 ? <div className="fx grain" style={{ backgroundImage: `url(${grainUrl})`, opacity: L.grain * 1.6 }} /> : null}
        {vig && L.vig > 0 ? <div className="fx vig" style={{ background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${L.vig}) 100%)` }} /> : null}
        {grid ? <div className="fx grid" /> : null}
        {bars ? <><div className="fx bar top" /><div className="fx bar bot" /></> : null}
        {flash ? <div className="fx shutter" /> : null}
      </div>
      {/* the surface that is dragged */}
      <div className="ab-ph-drag" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => zoomTo(R.getZoom() - e.deltaY * 0.0015)} />

      {ui ? (
        <div className="ab-ph-bar" onPointerDown={(e) => e.stopPropagation()}>
          <div className="ab-ph-row">
            {LOOKS.map((x) => (
              <button key={x.id} type="button" className={`ab-chip ${look === x.id ? "on" : ""}`} onClick={() => setLook(x.id)}>{t(x.bn, x.en)}</button>
            ))}
          </div>
          <div className="ab-ph-row">
            <button type="button" className={`ab-chip ${bars ? "on" : ""}`} onClick={() => setBars((v) => !v)}>{t("সিনেমা বার", "Letterbox")}</button>
            <button type="button" className={`ab-chip ${vig ? "on" : ""}`} onClick={() => setVig((v) => !v)}>{t("ভিনিয়েট", "Vignette")}</button>
            <button type="button" className={`ab-chip ${film ? "on" : ""}`} onClick={() => setFilm((v) => !v)}>{t("ফিল্ম", "Grade + grain")}</button>
            <button type="button" className={`ab-chip ${grid ? "on" : ""}`} onClick={() => setGrid((v) => !v)}>{t("গ্রিড", "Thirds")}</button>
            <button type="button" className="ab-chip" onClick={cycleView}>{viewName}</button>
          </div>
          <div className="ab-ph-row">
            <span className="lbl">{t("সময়", "Time")}</span>
            {SPEEDS.map(([v, n]) => (
              <button key={v} type="button" className={`ab-chip ${speed === v ? "on" : ""}`} onClick={() => setSpeed(v)}>{n}</button>
            ))}
            <button type="button" className="ab-chip" onClick={() => { setSpeed(0); onStep(); }} title={t("এক ফ্রেম", "One frame")}><StepForward size={12} /></button>
            <span className="lbl">{t("জুম", "Zoom")}</span>
            <input type="range" min={0.8} max={3.4} step={0.05} value={zoom} onChange={(e) => zoomTo(Number(e.target.value))} />
            {view !== "top" ? (
              <>
                <button type="button" className="ab-chip" onClick={() => R.turn(-0.25)} aria-label="Turn left"><RotateCcw size={12} /></button>
                <button type="button" className="ab-chip" onClick={() => R.turn(0.25)} aria-label="Turn right"><RotateCw size={12} /></button>
              </>
            ) : null}
          </div>
          <div className="ab-ph-row end">
            {note ? <small className="err">{note}</small> : null}
            <small>{t("টানুন = সরান · ডান-টান = ঘোরান · স্ক্রল = জুম", "Drag = move · right-drag = turn · wheel / pinch = zoom")}</small>
            {shots.map((s) => (
              <a key={s.url} className="ab-ph-th" href={s.url} download={s.name} title={s.name}><img src={s.url} alt="" /></a>
            ))}
            <button type="button" className="ab-ph-shutter" onClick={shoot} aria-label={t("ছবি তুলুন", "Take picture")}><Camera size={18} /> {t("ছবি তুলুন", "Take picture")}</button>
          </div>
        </div>
      ) : null}
      <div className="ab-ph-top" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="ab-ic" onClick={() => setUi((v) => !v)} aria-label="Hide panel">{ui ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        <button type="button" className="ab-ic" onClick={onClose} aria-label={t("বন্ধ", "Close")}><X size={16} /></button>
      </div>
    </div>
  );
}
