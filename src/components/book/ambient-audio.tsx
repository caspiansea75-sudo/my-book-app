import { useEffect, useRef } from "react";
import { useReaderStore, type ThemeId } from "@/lib/reader-store";

/**
 * Ambient sound bed, generated entirely in the Web Audio graph — no audio
 * files are ever shipped or downloaded. Each reading theme gets its own
 * small soundscape (noise colour/filter + an optional soft periodic
 * "texture" sound), all driven by one shared master volume.
 */

type Graph = {
  ctx: AudioContext;
  master: GainNode;
  stopTexture?: () => void;
};

export function AmbientAudio() {
  const on = useReaderStore((s) => s.audioOn);
  const volume = useReaderStore((s) => s.audioVolume);
  const theme = useReaderStore((s) => s.theme);
  const graphRef = useRef<Graph | null>(null);
  const themeRef = useRef<ThemeId>(theme);

  // Keep master volume in sync live, without rebuilding the graph.
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    g.master.gain.cancelScheduledValues(g.ctx.currentTime);
    g.master.gain.setTargetAtTime(on ? volume * 0.09 : 0, g.ctx.currentTime, 0.2);
  }, [on, volume]);

  // Rebuild the whole soundscape when audio is turned on, or when the
  // theme changes while audio is already on.
  useEffect(() => {
    themeRef.current = theme;
    if (!on) return;

    let cancelled = false;
    const boot = async () => {
      const Ctx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;

      // Tear down any previous soundscape (e.g. theme just changed).
      teardown(graphRef.current);
      graphRef.current = null;

      const ctx = new Ctx();
      if (ctx.state === "suspended") await ctx.resume();
      if (cancelled) {
        void ctx.close();
        return;
      }

      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      const stopTexture = buildTheme(ctx, master, theme);
      master.gain.setTargetAtTime(volume * 0.09, ctx.currentTime, 0.3);

      graphRef.current = { ctx, master, stopTexture };
    };
    void boot();

    return () => {
      cancelled = true;
    };
    // volume is intentionally excluded — handled by the effect above so
    // dragging the slider never rebuilds the noise graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, theme]);

  // Full cleanup on unmount (e.g. navigating away from the reader).
  useEffect(() => {
    return () => {
      teardown(graphRef.current);
      graphRef.current = null;
    };
  }, []);

  return null;
}

function teardown(graph: Graph | null) {
  if (!graph) return;
  graph.stopTexture?.();
  graph.master.disconnect();
  void graph.ctx.close();
}

/** Builds one theme's soundscape into `master`. Returns a cleanup function. */
function buildTheme(ctx: AudioContext, master: GainNode, theme: ThemeId): () => void {
  switch (theme) {
    case "monsoon":
      return buildBed(ctx, master, { color: "brown", cutoff: 780, level: 1 }, {
        every: [1.6, 3.2],
        build: (t) => softTick(ctx, master, t, { freq: 1800, dur: 0.05, gain: 0.35, type: "white" }),
      });
    case "cafe":
      return buildBed(ctx, master, { color: "pink", cutoff: 1400, level: 0.6 }, {
        every: [4, 9],
        build: (t) => softTick(ctx, master, t, { freq: 2600, dur: 0.22, gain: 0.5, type: "sine" }),
      });
    case "manuscript":
      return buildBed(ctx, master, { color: "white", cutoff: 3200, level: 0.22 }, {
        every: [3, 7],
        build: (t) => softTick(ctx, master, t, { freq: 5200, dur: 0.16, gain: 0.6, type: "noise-burst" }),
      });
    case "leather":
      return buildBed(ctx, master, { color: "brown", cutoff: 320, level: 0.9 }, {
        every: [2, 4],
        build: (t) => softTick(ctx, master, t, { freq: 640, dur: 0.09, gain: 0.3, type: "triangle" }),
      });
    default:
      return buildBed(ctx, master, { color: "brown", cutoff: 780, level: 1 });
  }
}

/** The continuous noise bed, optionally paired with a repeating soft texture sound. */
function buildBed(
  ctx: AudioContext,
  master: GainNode,
  noise: { color: "white" | "pink" | "brown"; cutoff: number; level: number },
  texture?: { every: [number, number]; build: (startAt: number) => void },
): () => void {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (noise.color === "white") {
      data[i] = white * 0.6;
    } else if (noise.color === "pink") {
      b0 = 0.985 * b0 + 0.02 * white;
      b1 = 0.5 * b1 + 0.08 * white;
      data[i] = (b0 + b1) * 1.2;
    } else {
      b0 = (b0 + 0.02 * white) / 1.02;
      data[i] = b0 * 3.2;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = noise.cutoff;
  const level = ctx.createGain();
  level.gain.value = noise.level;
  src.connect(filter);
  filter.connect(level);
  level.connect(master);
  src.start();

  let timer: ReturnType<typeof setTimeout> | null = null;
  if (texture) {
    const [min, max] = texture.every;
    const schedule = () => {
      const wait = (min + Math.random() * (max - min)) * 1000;
      timer = setTimeout(() => {
        texture.build(ctx.currentTime);
        schedule();
      }, wait);
    };
    schedule();
  }

  return () => {
    if (timer) clearTimeout(timer);
    try {
      src.stop();
    } catch {
      // already stopped
    }
    src.disconnect();
    filter.disconnect();
    level.disconnect();
  };
}

/** One soft, short, non-intrusive texture sound layered on top of the bed. */
function softTick(
  ctx: AudioContext,
  master: GainNode,
  at: number,
  opts: { freq: number; dur: number; gain: number; type: "sine" | "triangle" | "white" | "noise-burst" },
) {
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(opts.gain * 0.05, at + opts.dur * 0.3);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);
  envelope.connect(master);

  if (opts.type === "white" || opts.type === "noise-burst") {
    const len = Math.ceil(ctx.sampleRate * opts.dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type === "noise-burst" ? "bandpass" : "highpass";
    filter.frequency.value = opts.freq;
    src.connect(filter);
    filter.connect(envelope);
    src.start(at);
    src.stop(at + opts.dur);
    return;
  }

  const osc = ctx.createOscillator();
  osc.type = opts.type;
  osc.frequency.value = opts.freq;
  osc.connect(envelope);
  osc.start(at);
  osc.stop(at + opts.dur);
}
