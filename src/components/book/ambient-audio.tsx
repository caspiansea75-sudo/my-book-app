import { useEffect, useRef } from "react";
import { useReaderStore } from "@/lib/reader-store";

/**
 * Soft brown-noise rain bed. Generated in-graph so we never ship audio files.
 */
export function AmbientAudio() {
  const on = useReaderStore((s) => s.audioOn);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!on) {
      const g = gainRef.current;
      const ctx = ctxRef.current;
      if (g && ctx) {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      }
      return;
    }

    let cancelled = false;
    const boot = async () => {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = ctxRef.current ?? new Ctx();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      if (cancelled) return;

      if (!gainRef.current) {
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.2;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 780;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start();
        gainRef.current = gain;
      }
      const g = gainRef.current;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setTargetAtTime(0.045, ctx.currentTime, 0.25);
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [on]);

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
      gainRef.current = null;
    };
  }, []);

  return null;
}
