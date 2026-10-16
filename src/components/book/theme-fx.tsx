import { useEffect, useState, type CSSProperties } from "react";
import "@/components/book/theme-fx.css";
import { emitThunder } from "@/lib/thunder-bus";
import type { ThemeId } from "@/lib/reader-store";

/**
 * The full-motion atmosphere for each reading theme. Everything is CSS animation on transform and
 * opacity (cheap, no canvas), except the lightning, which is scheduled at random so no two storms match.
 * Static arrays are deterministic, so the server and browser render exactly the same markup.
 */

const r = (i: number, seed = 1) => {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const n = (v: number, d = 2) => Number(v.toFixed(d));
const range = (i: number, seed: number, lo: number, hi: number) => n(lo + r(i, seed) * (hi - lo));
const list = <T,>(count: number, f: (i: number) => T) => Array.from({ length: count }, (_, i) => f(i));
const vars = (o: Record<string, string | number>) => o as CSSProperties;

/* ------------------------------------------------------------------ monsoon */

const CLOUDS = list(3, (i) => ({
  top: `${range(i, 1, -14, 4)}vh`,
  w: `${range(i, 2, 70, 100)}vw`,
  dur: `${range(i, 3, 70, 110)}s`,
  delay: `${-range(i, 4, 0, 60)}s`,
}));
const STREAKS = list(34, (i) => ({
  x: `${range(i, 5, 0, 100)}%`,
  h: `${range(i, 6, 7, 15)}vh`,
  o: range(i, 7, 0.25, 0.55),
  dur: `${range(i, 8, 0.8, 1.5)}s`,
  delay: `${-range(i, 9, 0, 3)}s`,
}));
const WIND = list(8, (i) => ({
  y: `${range(i, 10, 6, 94)}%`,
  w: `${range(i, 11, 30, 70)}vw`,
  r: `${range(i, 12, -3, 3)}deg`,
  dur: `${range(i, 13, 5, 10)}s`,
  delay: `${-range(i, 14, 0, 12)}s`,
  o: range(i, 15, 0.25, 0.55),
}));
const MIST = list(4, (i) => ({
  y: `${range(i, 16, 20, 80)}%`,
  dur: `${range(i, 17, 16, 28)}s`,
  delay: `${-range(i, 18, 0, 24)}s`,
}));
const DRIPS = list(8, (i) => ({
  x: `${range(i, 19, 4, 96)}%`,
  s: range(i, 20, 0.8, 1.3),
  dur: `${range(i, 21, 16, 30)}s`,
  delay: `${-range(i, 22, 0, 30)}s`,
}));
const RIPPLES = list(9, (i) => ({
  x: `${range(i, 23, 4, 96)}%`,
  b: `${range(i, 24, 1, 9)}vh`,
  w: `${range(i, 25, 40, 90)}px`,
  delay: `${-range(i, 26, 0, 3)}s`,
  dur: `${range(i, 27, 2, 3.2)}s`,
}));

type Strike = { id: number; x: number; bolt: boolean; flip: boolean; main: string; branch: string };

/** A jagged bolt in a 60 x 100 box: a main trunk and one short fork. */
function boltShape() {
  let x = 30;
  let y = 0;
  const pts: [number, number][] = [[x, y]];
  const fork: [number, number][] = [];
  const forkAt = 3 + Math.floor(Math.random() * 3);
  while (y < 100) {
    y += 6 + Math.random() * 9;
    x += (Math.random() - 0.5) * 20;
    x = Math.max(8, Math.min(52, x));
    pts.push([x, Math.min(y, 100)]);
    if (pts.length === forkAt) fork.push([x, y]);
  }
  let fx = fork[0]?.[0] ?? 30;
  let fy = fork[0]?.[1] ?? 40;
  const dir = Math.random() < 0.5 ? -1 : 1;
  for (let k = 0; k < 4; k++) {
    fy += 5 + Math.random() * 7;
    fx += dir * (3 + Math.random() * 9);
    fork.push([Math.max(4, Math.min(56, fx)), fy]);
  }
  const d = (p: [number, number][]) => p.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`).join(" ");
  return { main: d(pts), branch: d(fork) };
}

function Lightning() {
  const [strike, setStrike] = useState<Strike | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    let wait = 0;
    let clear = 0;
    const next = (first: boolean) => {
      const ms = first ? 3500 + Math.random() * 4500 : 8000 + Math.random() * 17000;
      wait = window.setTimeout(() => {
        if (!alive) return;
        if (!document.hidden) {
          const bolt = Math.random() < 0.6;
          const shape = bolt ? boltShape() : { main: "", branch: "" };
          setStrike({ id: Date.now(), x: 12 + Math.random() * 76, bolt, flip: Math.random() < 0.5, ...shape });
          // Sound travels slower than light: the rumble follows a moment later.
          emitThunder({ delayMs: 500 + Math.random() * 2600, power: bolt ? 1 : 0.55 });
          clear = window.setTimeout(() => alive && setStrike(null), 1500);
        }
        next(false);
      }, ms);
    };
    next(true);
    return () => {
      alive = false;
      window.clearTimeout(wait);
      window.clearTimeout(clear);
    };
  }, []);

  if (!strike) return null;
  return (
    <div key={strike.id} className="tfx-strike" style={vars({ "--x": `${strike.x}vw` })}>
      <div className="tfx-sheet" />
      <div className="tfx-wash" />
      {strike.bolt ? (
        <svg
          className="tfx-bolt"
          viewBox="0 0 60 100"
          preserveAspectRatio="none"
          style={strike.flip ? { transform: "scaleX(-1)" } : undefined}
        >
          <path d={strike.main} />
          <path d={strike.branch} className="fork" />
        </svg>
      ) : null}
    </div>
  );
}

function Monsoon() {
  return (
    <div className="tfx tfx-monsoon" aria-hidden="true">
      <div className="tfx-clouds">
        {CLOUDS.map((c, i) => (
          <span key={i} style={{ top: c.top, width: c.w, animationDuration: c.dur, animationDelay: c.delay }} />
        ))}
      </div>
      <div className="tfx-mist">
        {MIST.map((m, i) => (
          <span key={i} style={{ top: m.y, animationDuration: m.dur, animationDelay: m.delay }} />
        ))}
      </div>
      <div className="tfx-gust">
        {STREAKS.map((s, i) => (
          <span
            key={i}
            style={{ left: s.x, height: s.h, opacity: s.o, animationDuration: s.dur, animationDelay: s.delay }}
          />
        ))}
      </div>
      <div className="tfx-wind">
        {WIND.map((w, i) => (
          <span
            key={i}
            style={vars({ top: w.y, width: w.w, "--r": w.r, "--o": w.o, animationDuration: w.dur, animationDelay: w.delay })}
          />
        ))}
      </div>
      <div className="tfx-drips">
        {DRIPS.map((d, i) => (
          <span key={i} style={vars({ left: d.x, "--s": d.s, animationDuration: d.dur, animationDelay: d.delay })} />
        ))}
      </div>
      <div className="tfx-ripples">
        {RIPPLES.map((p, i) => (
          <span
            key={i}
            style={{ left: p.x, bottom: p.b, width: p.w, animationDelay: p.delay, animationDuration: p.dur }}
          />
        ))}
      </div>
      <Lightning />
    </div>
  );
}

/* --------------------------------------------------------------------- cafe */

const BOKEH_COLORS = ["#ffb347", "#ffd28a", "#ff8a5c", "#f6c177", "#ffcf9e"];
const BOKEH = list(15, (i) => ({
  x: `${range(i, 30, 2, 96)}%`,
  y: `${range(i, 31, 4, 92)}%`,
  s: `${Math.round(range(i, 32, 36, 130))}px`,
  c: BOKEH_COLORS[i % BOKEH_COLORS.length],
  o: range(i, 33, 0.12, 0.28),
  dx: `${range(i, 34, -40, 40)}px`,
  dy: `${range(i, 35, -60, 20)}px`,
  dur: `${range(i, 36, 10, 20)}s`,
  delay: `${-range(i, 37, 0, 20)}s`,
}));
const CURLS = list(5, (i) => ({
  x: `${range(i, 38, 62, 94)}%`,
  w: `${Math.round(range(i, 39, 18, 34))}px`,
  dur: `${range(i, 40, 7, 12)}s`,
  delay: `${-range(i, 41, 0, 12)}s`,
}));
const MOTES = list(20, (i) => ({
  x: `${range(i, 42, 18, 82)}%`,
  y: `${range(i, 43, 4, 70)}%`,
  dur: `${range(i, 44, 3, 7)}s`,
  delay: `${-range(i, 45, 0, 7)}s`,
}));

function Cafe() {
  return (
    <div className="tfx tfx-cafe" aria-hidden="true">
      <div className="tfx-lamp" />
      <div className="tfx-lamp-floor" />
      <div className="tfx-bokeh">
        {BOKEH.map((b, i) => (
          <span
            key={i}
            style={vars({
              left: b.x,
              top: b.y,
              width: b.s,
              height: b.s,
              "--c": b.c,
              "--o": b.o,
              "--dx": b.dx,
              "--dy": b.dy,
              animationDuration: b.dur,
              animationDelay: b.delay,
            })}
          />
        ))}
      </div>
      <div className="tfx-curls">
        {CURLS.map((c, i) => (
          <span key={i} style={{ left: c.x, width: c.w, animationDuration: c.dur, animationDelay: c.delay }} />
        ))}
      </div>
      <div className="tfx-motes">
        {MOTES.map((m, i) => (
          <span key={i} style={{ left: m.x, top: m.y, animationDuration: m.dur, animationDelay: m.delay }} />
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- manuscript */

const LEAF_COLORS: [string, string][] = [
  ["#d2a24c", "#b07a2c"],
  ["#b9683f", "#8f4a2c"],
  ["#98a04a", "#6f7a34"],
  ["#a98258", "#80603c"],
];
const LEAVES = list(9, (i) => ({
  x: `${range(i, 50, 0, 90)}%`,
  s: `${Math.round(range(i, 51, 14, 26))}px`,
  c: LEAF_COLORS[i % LEAF_COLORS.length],
  drift: `${range(i, 52, 10, 34)}vw`,
  dur: `${range(i, 53, 16, 30)}s`,
  delay: `${-range(i, 54, 0, 30)}s`,
  sway: `${range(i, 55, 3.2, 6)}s`,
}));
const BEAMS = list(3, (i) => ({
  x: `${range(i, 56, 40, 92)}%`,
  w: `${range(i, 57, 10, 20)}vw`,
  dur: `${range(i, 58, 14, 24)}s`,
  delay: `${-range(i, 59, 0, 20)}s`,
}));
const DAPPLE = list(7, (i) => ({
  x: `${range(i, 60, 50, 100)}%`,
  y: `${range(i, 61, -4, 40)}%`,
  s: `${Math.round(range(i, 62, 12, 26))}vw`,
  dur: `${range(i, 63, 7, 12)}s`,
  delay: `${-range(i, 64, 0, 12)}s`,
}));
const SWIRLS = [
  { y: "16%", x: "6%", w: "min(46vw, 420px)", delay: "0s", d: "M0 70 C 60 18, 110 112, 170 62 S 270 14, 330 58 S 380 92, 400 48" },
  { y: "50%", x: "54%", w: "min(40vw, 360px)", delay: "-7s", d: "M0 40 C 50 96, 100 4, 160 52 S 250 100, 310 46 S 372 6, 400 60" },
  { y: "76%", x: "18%", w: "min(50vw, 460px)", delay: "-13s", d: "M0 60 C 70 10, 120 100, 190 56 S 290 8, 350 66 S 392 84, 400 40" },
];

function Manuscript() {
  return (
    <div className="tfx tfx-manuscript" aria-hidden="true">
      <div className="tfx-beams">
        {BEAMS.map((b, i) => (
          <span key={i} style={{ left: b.x, width: b.w, animationDuration: b.dur, animationDelay: b.delay }} />
        ))}
      </div>
      <div className="tfx-dapple">
        {DAPPLE.map((d, i) => (
          <span
            key={i}
            style={{ left: d.x, top: d.y, width: d.s, height: d.s, animationDuration: d.dur, animationDelay: d.delay }}
          />
        ))}
      </div>
      {SWIRLS.map((s, i) => (
        <svg key={i} className="tfx-swirl" viewBox="0 0 400 120" style={{ top: s.y, left: s.x, width: s.w, animationDelay: s.delay }}>
          <path d={s.d} pathLength={1} />
        </svg>
      ))}
      <div className="tfx-leaves">
        {LEAVES.map((l, i) => (
          <span
            key={i}
            className="tfx-leaf"
            style={vars({
              left: l.x,
              "--s": l.s,
              "--c1": l.c[0],
              "--c2": l.c[1],
              "--drift": l.drift,
              animationDuration: l.dur,
              animationDelay: l.delay,
            })}
          >
            <i style={{ animationDuration: l.sway }} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ leather */

const FIREFLIES = list(14, (i) => ({
  x: `${range(i, 70, 4, 94)}%`,
  y: `${range(i, 71, 18, 90)}%`,
  a: `${range(i, 72, -9, 9)}vw, ${range(i, 73, -9, 9)}vh`,
  b: `${range(i, 74, -12, 12)}vw, ${range(i, 75, -10, 10)}vh`,
  c: `${range(i, 76, -9, 9)}vw, ${range(i, 77, -9, 9)}vh`,
  dur: `${range(i, 78, 14, 26)}s`,
  blink: `${range(i, 79, 2.4, 5.2)}s`,
  delay: `${-range(i, 80, 0, 26)}s`,
}));
const SMOKE = list(4, (i) => ({
  x: `${range(i, 81, 0, 78)}%`,
  dur: `${range(i, 82, 20, 32)}s`,
  delay: `${-range(i, 83, 0, 30)}s`,
}));

function Leather() {
  return (
    <div className="tfx tfx-leather" aria-hidden="true">
      <div className="tfx-lantern a" />
      <div className="tfx-lantern b" />
      <div className="tfx-warmwash" />
      <div className="tfx-smoke">
        {SMOKE.map((s, i) => (
          <span key={i} style={{ left: s.x, animationDuration: s.dur, animationDelay: s.delay }} />
        ))}
      </div>
      <div className="tfx-fireflies">
        {FIREFLIES.map((f, i) => (
          <span
            key={i}
            style={vars({
              left: f.x,
              top: f.y,
              "--a": f.a,
              "--b": f.b,
              "--c": f.c,
              animationDuration: `${f.dur}, ${f.blink}`,
              animationDelay: `${f.delay}, ${f.delay}`,
            })}
          />
        ))}
      </div>
    </div>
  );
}

export function ThemeFx({ theme }: { theme: ThemeId }) {
  if (theme === "monsoon") return <Monsoon />;
  if (theme === "cafe") return <Cafe />;
  if (theme === "manuscript") return <Manuscript />;
  return <Leather />;
}
