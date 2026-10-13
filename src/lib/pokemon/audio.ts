/**
 * Battle sound: looping chiptune themes, short sound effects for hits / switches / gimmicks, a low-HP beep,
 * and win / lose jingles. Everything is synthesised live with the Web Audio API — no audio files are shipped.
 *
 * Three volume controls: master, music, sound effects (plus mute). Browsers only allow sound after the
 * person has tapped or pressed something, so `unlock()` is called from the first interaction.
 */
import type { BState, Cue, SideId } from "@/lib/pokemon/protocol";
import { getCustomBlob } from "@/lib/pokemon/custom-music";
import { JINGLES, TRACKS, type BuiltTrack, type Jingle, type Note } from "@/lib/pokemon/tracks";

export type AudioSettings = { master: number; music: number; sfx: number; muted: boolean; track: string };
export type AudioSnap = AudioSettings & { running: boolean; playing: string };

const KEY = "pk-audio";
export const DEFAULT_AUDIO: AudioSnap = { master: 0.8, music: 0.55, sfx: 0.8, muted: false, track: "auto", running: false, playing: "" };
const clamp01 = (n: unknown, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback);
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function loadSettings(): AudioSettings {
  const d = DEFAULT_AUDIO;
  if (typeof window === "undefined") return d;
  try {
    const o = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<AudioSettings> | null;
    if (!o) return d;
    return { master: clamp01(o.master, d.master), music: clamp01(o.music, d.music), sfx: clamp01(o.sfx, d.sfx), muted: !!o.muted, track: typeof o.track === "string" ? o.track : "auto" };
  } catch {
    return d;
  }
}

type Maps = { lead: Map<number, Note>; harmony: Map<number, Note>; arp: Map<number, Note>; bass: Map<number, Note>; kick: Set<number>; snare: Set<number>; hat: Set<number> };
const index = (notes: Note[]) => new Map(notes.map((n) => [n.step, n]));

type NoiseFilter = { type: BiquadFilterType; f0: number; f1?: number; q?: number };
type OscOpts = { attack?: number; release?: number; slideTo?: number; detune?: number };

class BattleAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private waves = new Map<number, PeriodicWave>();
  private seq: { id: string; tick: () => void; stop: (fade: number) => void } | null = null;
  private custom: { el: HTMLAudioElement; gain: GainNode; url: string } | null = null;
  private lowTimer: ReturnType<typeof setInterval> | null = null;
  private lowOn = false;
  private auto = "trainer";
  private finished = false;
  private token = 0;
  private listeners = new Set<() => void>();
  private snap: AudioSnap = { ...DEFAULT_AUDIO, ...loadSettings() };

  /* ------------------------------------------------------------ state for the UI */
  get = (): AudioSnap => this.snap;
  getServer = (): AudioSnap => DEFAULT_AUDIO;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private emit(patch: Partial<AudioSnap> = {}) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  set(patch: Partial<AudioSettings>) {
    const next: AudioSettings = {
      master: clamp01(patch.master ?? this.snap.master, this.snap.master),
      music: clamp01(patch.music ?? this.snap.music, this.snap.music),
      sfx: clamp01(patch.sfx ?? this.snap.sfx, this.snap.sfx),
      muted: patch.muted ?? this.snap.muted,
      track: patch.track ?? this.snap.track,
    };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: the settings just last for this visit */
    }
    const trackChanged = next.track !== this.snap.track;
    this.emit(next);
    this.applyGains();
    if (trackChanged) {
      this.finished = false;
      void this.refresh();
    }
  }

  /* ------------------------------------------------------------------ set-up */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const master = ctx.createGain();
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    music.connect(master);
    sfx.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.ctx = ctx;
    this.master = master;
    this.musicBus = music;
    this.sfxBus = sfx;
    this.noise = buf;
    this.applyGains(true);
    return ctx;
  }

  private applyGains(instant = false) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const t = ctx.currentTime;
    const set = (g: GainNode, v: number) => (instant ? (g.gain.value = v) : g.gain.setTargetAtTime(v, t, 0.02));
    set(this.master, this.snap.muted ? 0 : this.snap.master);
    set(this.musicBus, this.snap.music);
    set(this.sfxBus, this.snap.sfx);
  }

  /** Call from a tap / key press. Starts the audio system and the music. */
  async unlock(): Promise<void> {
    const ctx = this.ensure();
    if (!ctx) return;
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      /* still locked: the next tap tries again */
    }
    this.emit({ running: ctx.state === "running" });
    if (ctx.state === "running") await this.refresh();
  }

  /** The theme to use while the choice is "Auto". */
  setAuto(id: string) {
    this.auto = id;
    void this.refresh();
  }

  /** Start over (for a replay). */
  restart() {
    this.finished = false;
    this.stopCurrent(0.2);
    this.emit({ playing: "" });
    void this.refresh();
  }

  /* ------------------------------------------------------------------- music */
  private async refresh() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.finished) return;
    const want = this.snap.track === "auto" ? this.auto : this.snap.track;
    if (want === this.snap.playing && (this.seq || this.custom)) return;
    const token = ++this.token;
    this.stopCurrent(0.35);
    this.emit({ playing: want });
    if (want.startsWith("custom:")) {
      const ok = await this.startCustom(Number(want.slice(7)), token);
      if (!ok && token === this.token) {
        this.emit({ playing: this.auto });
        this.startSynth(this.auto);
      }
    } else this.startSynth(want in TRACKS ? want : "trainer");
  }

  private stopCurrent(fade: number) {
    const ctx = this.ctx;
    if (this.seq) {
      this.seq.stop(fade);
      this.seq = null;
    }
    if (this.custom && ctx) {
      const { el, gain, url } = this.custom;
      this.custom = null;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + fade);
      window.setTimeout(() => {
        el.pause();
        URL.revokeObjectURL(url);
        gain.disconnect();
      }, (fade + 0.1) * 1000);
    }
  }

  private async startCustom(id: number, token: number): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return false;
    const blob = await getCustomBlob(id);
    if (!blob || token !== this.token) return false;
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    el.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    try {
      ctx.createMediaElementSource(el).connect(gain);
      gain.connect(this.musicBus);
      await el.play();
    } catch {
      URL.revokeObjectURL(url);
      return false;
    }
    if (token !== this.token) {
      el.pause();
      URL.revokeObjectURL(url);
      return true;
    }
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
    this.custom = { el, gain, url };
    return true;
  }

  private startSynth(id: string) {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const track: BuiltTrack = TRACKS[id] ?? TRACKS.trainer;
    const maps: Maps = {
      lead: index(track.lead), harmony: index(track.harmony), arp: index(track.arp), bass: index(track.bass),
      kick: new Set(track.kick), snare: new Set(track.snare), hat: new Set(track.hat),
    };
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
    out.connect(this.musicBus);
    let step = 0;
    let next = ctx.currentTime + 0.1;
    const tick = () => {
      while (next < ctx.currentTime + 0.14) {
        this.scheduleStep(track, maps, step, next, out);
        next += track.stepSec;
        step = (step + 1) % track.steps;
      }
    };
    const timer = setInterval(tick, 25);
    tick();
    this.seq = {
      id,
      tick,
      stop: (fade) => {
        clearInterval(timer);
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0.0001, t + fade);
        window.setTimeout(() => out.disconnect(), (fade + 0.3) * 1000);
      },
    };
  }

  private scheduleStep(track: BuiltTrack, m: Maps, step: number, t: number, out: AudioNode) {
    const s = track.stepSec;
    const lead = m.lead.get(step);
    if (lead) this.voice(this.pulse(lead.midi > 84 ? 0.125 : 0.25), lead.midi, t, lead.len * s * 0.96, 0.15, out, { attack: 0.006, release: 0.05 });
    const h = m.harmony.get(step);
    if (h) this.voice(this.pulse(0.5), h.midi, t, h.len * s * 0.94, 0.06, out, { attack: 0.008, release: 0.05 });
    const a = m.arp.get(step);
    if (a) this.voice(this.pulse(0.125), a.midi, t, s * 0.85, 0.045, out, { attack: 0.002, release: 0.03 });
    const b = m.bass.get(step);
    if (b) this.voice("triangle", b.midi, t, b.len * s * 0.9, 0.3, out, { attack: 0.004, release: 0.04 });
    if (m.kick.has(step)) this.kick(t, out);
    if (m.snare.has(step)) this.snare(t, out);
    if (m.hat.has(step)) this.hat(t, out, step % 4 === 2);
  }

  /** Plays a short jingle (win / lose / draw) on the music channel. */
  finish(kind: "win" | "lose" | "draw") {
    const ctx = this.ctx;
    this.finished = true;
    this.lowHp(false);
    this.stopCurrent(0.3);
    this.emit({ playing: "" });
    if (!ctx || ctx.state !== "running" || !this.musicBus) return;
    const j: Jingle = JINGLES[kind];
    const s = 60 / j.bpm / 4;
    const t0 = ctx.currentTime + 0.35;
    const pulse = this.pulse(0.25);
    for (const n of j.lead) this.voice(pulse, n.midi, t0 + n.step * s, n.len * s * 0.95, 0.18, this.musicBus, { attack: 0.006, release: 0.08 });
    for (const n of j.lead) if (kind === "win") this.voice(this.pulse(0.5), n.midi - 12, t0 + n.step * s, n.len * s * 0.95, 0.06, this.musicBus);
    for (const n of j.bass) this.voice("triangle", n.midi, t0 + n.step * s, n.len * s * 0.95, 0.3, this.musicBus, { release: 0.08 });
    if (kind === "win") this.snare(t0 + 28 * s, this.musicBus);
  }

  /* ------------------------------------------------------------ low-HP warning */
  lowHp(on: boolean) {
    if (on === this.lowOn) return;
    this.lowOn = on;
    if (this.lowTimer) clearInterval(this.lowTimer);
    this.lowTimer = null;
    if (!on) return;
    const beep = () => {
      const ctx = this.ctx;
      if (!ctx || ctx.state !== "running" || !this.sfxBus) return;
      const t = ctx.currentTime;
      this.voice("square", 988, t, 0.06, 0.07, this.sfxBus);
      this.voice("square", 988, t + 0.11, 0.06, 0.07, this.sfxBus);
    };
    beep();
    this.lowTimer = setInterval(beep, 900);
  }

  /** Stops everything and releases the audio device (when leaving the battle). */
  stopAll() {
    this.token++;
    this.lowHp(false);
    this.stopCurrent(0.05);
    const ctx = this.ctx;
    this.ctx = null;
    this.master = this.musicBus = this.sfxBus = null;
    this.waves.clear();
    this.finished = false;
    this.emit({ running: false, playing: "" });
    if (ctx) window.setTimeout(() => void ctx.close().catch(() => undefined), 500);
  }

  /* ------------------------------------------------------------ sound building blocks */
  private pulse(duty: number): PeriodicWave {
    const key = Math.round(duty * 1000);
    let w = this.waves.get(key);
    if (!w) {
      const n = 32;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        const c = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
        real[k] = c * Math.cos(k * Math.PI * duty);
        imag[k] = c * Math.sin(k * Math.PI * duty);
      }
      w = this.ctx!.createPeriodicWave(real, imag);
      this.waves.set(key, w);
    }
    return w;
  }

  /** One note: an oscillator with a quick fade in and out. `midi` is converted; use `freq` for raw hertz. */
  private voice(type: OscillatorType | PeriodicWave, midi: number, t: number, dur: number, gain: number, dest: AudioNode, o: OscOpts = {}) {
    this.tone(type, mtof(midi), t, dur, gain, dest, o);
  }

  private tone(type: OscillatorType | PeriodicWave, freq: number, t: number, dur: number, gain: number, dest: AudioNode, o: OscOpts = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    if (typeof type === "string") osc.type = type as OscillatorType;
    else osc.setPeriodicWave(type as PeriodicWave);
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.004;
    const r = Math.min(o.release ?? 0.04, dur / 2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + a);
    g.gain.setValueAtTime(gain, t + Math.max(a, dur - r));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseHit(t: number, dur: number, gain: number, dest: AudioNode, f?: NoiseFilter) {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = src;
    if (f) {
      const bq = ctx.createBiquadFilter();
      bq.type = f.type;
      bq.frequency.setValueAtTime(f.f0, t);
      if (f.f1) bq.frequency.exponentialRampToValueAtTime(f.f1, t + dur);
      bq.Q.value = f.q ?? 1;
      src.connect(bq);
      node = bq;
    }
    node.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.9);
    src.stop(t + dur + 0.02);
  }

  private kick(t: number, d: AudioNode) {
    this.tone("sine", 150, t, 0.16, 0.55, d, { slideTo: 45, attack: 0.001, release: 0.06 });
    this.noiseHit(t, 0.02, 0.15, d, { type: "lowpass", f0: 1500 });
  }
  private snare(t: number, d: AudioNode) {
    this.noiseHit(t, 0.14, 0.2, d, { type: "highpass", f0: 1300 });
    this.tone("triangle", 190, t, 0.08, 0.1, d, { slideTo: 120 });
  }
  private hat(t: number, d: AudioNode, open: boolean) {
    this.noiseHit(t, open ? 0.16 : 0.04, open ? 0.06 : 0.05, d, { type: "highpass", f0: 7000 });
  }

  /* ---------------------------------------------------------------- sound effects */
  private thud(t: number, power: number) {
    const d = this.sfxBus!;
    this.tone("sine", 130, t, 0.2, 0.55 * power, d, { slideTo: 42, attack: 0.001 });
    this.noiseHit(t, 0.13, 0.28 * power, d, { type: "lowpass", f0: 1000, f1: 300 });
  }
  private whoosh(t: number, dur: number, f0: number, f1: number, gain = 0.2) {
    this.noiseHit(t, dur, gain, this.sfxBus!, { type: "bandpass", f0, f1, q: 2 });
  }
  private sparkle(t: number, down = false) {
    for (let i = 0; i < 5; i++) this.tone("sine", down ? 3600 - i * 350 : 2200 + i * 350, t + i * 0.05, 0.1, 0.09, this.sfxBus!);
  }
  private arpUp(t: number, notes: number[], gap = 0.06, type: OscillatorType = "square", gain = 0.1) {
    notes.forEach((m, i) => this.voice(type, m, t + i * gap, 0.12, gain, this.sfxBus!));
  }

  /** Each attacking type gets its own kind of sound. */
  private attackSound(type: string, cat: string | undefined, t: number) {
    const d = this.sfxBus!;
    switch (type) {
      case "Fire": this.whoosh(t, 0.35, 500, 2500, 0.22); for (let i = 0; i < 6; i++) this.noiseHit(t + 0.15 + i * 0.05, 0.05, 0.12, d, { type: "highpass", f0: 2500 }); break;
      case "Water": for (let i = 0; i < 3; i++) this.tone("sine", 500 + i * 250, t + i * 0.07, 0.09, 0.14, d, { slideTo: 800 + i * 250 }); this.whoosh(t + 0.15, 0.25, 700, 1800, 0.12); break;
      case "Electric": for (let i = 0; i < 8; i++) this.tone("square", 300 + Math.random() * 1500, t + i * 0.045, 0.045, 0.1, d); break;
      case "Grass": this.whoosh(t, 0.2, 2500, 6000, 0.18); this.whoosh(t + 0.12, 0.2, 3000, 7000, 0.14); break;
      case "Ice": this.sparkle(t); break;
      case "Psychic": this.tone("sine", 220, t, 0.5, 0.14, d, { slideTo: 880 }); this.tone("sine", 222, t, 0.5, 0.14, d, { slideTo: 884 }); break;
      case "Ghost": this.tone("triangle", 160, t, 0.6, 0.16, d, { slideTo: 90 }); this.tone("sine", 163, t, 0.6, 0.12, d, { slideTo: 88 }); break;
      case "Dragon": this.whoosh(t, 0.4, 300, 1200, 0.25); this.tone("sawtooth", 110, t, 0.4, 0.1, d, { slideTo: 70 }); break;
      case "Dark": this.tone("sawtooth", 90, t, 0.45, 0.1, d, { slideTo: 60 }); this.whoosh(t + 0.1, 0.18, 1500, 400, 0.18); break;
      case "Fairy": this.sparkle(t, true); this.arpUp(t + 0.1, [84, 88, 91, 96], 0.05, "sine", 0.1); break;
      case "Fighting": this.thud(t + 0.05, 0.9); this.noiseHit(t, 0.06, 0.22, d, { type: "bandpass", f0: 1800, q: 1 }); break;
      case "Poison": for (let i = 0; i < 4; i++) this.tone("sine", 260 + i * 60, t + i * 0.08, 0.1, 0.13, d, { slideTo: 420 + i * 60 }); break;
      case "Ground": this.thud(t, 1.1); this.noiseHit(t + 0.05, 0.4, 0.2, d, { type: "lowpass", f0: 600, f1: 150 }); break;
      case "Flying": this.whoosh(t, 0.3, 800, 3500, 0.2); break;
      case "Bug": for (let i = 0; i < 5; i++) this.tone("square", 1200 + (i % 2) * 500, t + i * 0.03, 0.03, 0.08, d); break;
      case "Rock": this.thud(t, 0.9); for (let i = 0; i < 4; i++) this.noiseHit(t + 0.1 + i * 0.06, 0.05, 0.16, d, { type: "bandpass", f0: 900, q: 2 }); break;
      case "Steel": for (const f of [800, 1210, 1930]) this.tone("sine", f, t, 0.3, 0.09, d); this.noiseHit(t, 0.05, 0.14, d, { type: "highpass", f0: 4000 }); break;
      default: if (cat === "Special") this.whoosh(t, 0.25, 600, 2200, 0.2); else this.noiseHit(t, 0.12, 0.2, d, { type: "bandpass", f0: 2500, f1: 5000, q: 1 });
    }
  }

  /** Reacts to the arena animations. `mine` is the side the viewer plays (or null when watching). */
  cue(c: Cue, _state: BState, _mine: SideId | null) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.sfxBus) return;
    const t = ctx.currentTime + 0.01;
    const d = this.sfxBus;
    switch (c.kind) {
      case "move": this.attackSound(c.moveType ?? "Normal", c.cat, t); break;
      case "hit": {
        const power = 0.4 + Math.min(1, (c.amount ?? 20) / 50);
        this.thud(t, power);
        if (c.effect === "se") this.arpUp(t + 0.08, [88, 95], 0.07, "square", 0.1);
        if (c.effect === "nve") this.tone("sine", 160, t + 0.05, 0.2, 0.18, d, { slideTo: 110 });
        if (c.effect === "crit") { this.noiseHit(t, 0.08, 0.3, d, { type: "highpass", f0: 3000 }); this.arpUp(t + 0.05, [96, 100], 0.05, "square", 0.12); }
        break;
      }
      case "faint": this.tone("sine", 440, t, 0.8, 0.22, d, { slideTo: 90 }); this.noiseHit(t + 0.5, 0.3, 0.1, d, { type: "lowpass", f0: 800, f1: 200 }); break;
      case "switch": this.tone("sine", 400, t, 0.1, 0.18, d, { slideTo: 900 }); this.arpUp(t + 0.43, [79, 84, 91], 0.05, "square", 0.08); break;
      case "heal": this.arpUp(t, [72, 76, 79, 84], 0.07, "sine", 0.16); break;
      case "boost":
        if (c.up) this.tone("square", 300, t, 0.28, 0.09, d, { slideTo: 900 });
        else this.tone("square", 900, t, 0.28, 0.09, d, { slideTo: 300 });
        break;
      case "status": for (let i = 0; i < 6; i++) this.tone("triangle", i % 2 ? 330 : 280, t + i * 0.06, 0.06, 0.12, d); break;
      case "mega": this.arpUp(t, [60, 64, 67, 72, 76, 79, 84, 88], 0.07, "square", 0.1); this.sparkle(t + 0.4); break;
      case "tera": for (let i = 0; i < 6; i++) this.tone("sine", 1500 + i * 420, t + i * 0.08, 0.35, 0.09, d); break;
      case "zpower": this.arpUp(t, [60, 64, 67, 72, 76], 0.09, "square", 0.1); this.whoosh(t, 0.7, 300, 5000, 0.2); break;
      case "dynamax": this.tone("sawtooth", 55, t, 0.9, 0.16, d, { slideTo: 110 }); this.thud(t + 0.6, 1.2); break;
      case "weather": this.tone("triangle", 100, t, 0.6, 0.12, d, { slideTo: 140 }); break;
      case "miss": this.whoosh(t, 0.2, 2500, 800, 0.14); break;
      case "ability": case "item": this.arpUp(t, [79, 86], 0.08, "square", 0.08); break;
      case "hazard": for (let i = 0; i < 4; i++) this.noiseHit(t + i * 0.05, 0.05, 0.14, d, { type: "bandpass", f0: 900, q: 2 }); break;
      default: break;
    }
  }

  /** A sample sound, so the effects slider can be tested. */
  testSfx() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.sfxBus) return;
    const t = ctx.currentTime + 0.01;
    this.thud(t, 0.9);
    this.arpUp(t + 0.1, [88, 95], 0.07, "square", 0.1);
  }

  /** For tests: runs the scheduler once, as the timer would. */
  _tick() {
    this.seq?.tick();
  }
}

export const battleAudio = new BattleAudio();
