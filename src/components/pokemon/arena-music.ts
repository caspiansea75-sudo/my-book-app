/**
 * Battle music for Arena Brawl: small chiptune themes played live by the browser's synthesizer (no audio files to load).
 * The tunes are original pieces in the spirit of a battle theme: they are not taken from any game.
 * On/off, volume and the chosen tune are remembered.
 */

type Bar = (number | null)[]; // 8 eighth notes: scale degrees (0 = the key note, 7 = an octave up), null = rest

type Tune = {
  id: string;
  name: string;
  bn: string;
  bpm: number;
  /** MIDI note of the key note. */
  key: number;
  /** Semitones of the scale degrees 0..6. */
  scale: number[];
  /** Chord root (a scale degree) for each of the 8 bars. */
  prog: number[];
  lead: Bar[]; // 8 bars
  /** Drum pattern over the 8 eighth notes of a bar: k kick, s snare, h hat, . nothing */
  drums: string;
  /** Sound of the lead. */
  wave: OscillatorType;
};

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

export const TUNES: Tune[] = [
  {
    id: "wild",
    name: "Wild Encounter",
    bn: "বন্য মুখোমুখি",
    bpm: 154,
    key: 57, // A
    scale: MINOR,
    prog: [0, 5, 3, 4, 0, 5, 6, 4],
    lead: [
      [7, null, 9, 7, 11, null, 9, 7],
      [8, null, 10, 8, 12, null, 10, 8],
      [5, null, 7, 5, 9, null, 7, 5],
      [6, 7, 8, null, 11, null, 9, null],
      [7, 9, 11, 12, 11, 9, 7, null],
      [8, 10, 12, 13, 12, 10, 8, null],
      [5, 7, 9, 11, 9, 7, 5, null],
      [6, 8, 11, 9, 6, null, null, null],
    ],
    drums: "k.hsk.hs",
    wave: "square",
  },
  {
    id: "rival",
    name: "Rival Clash",
    bn: "প্রতিদ্বন্দ্বীর লড়াই",
    bpm: 172,
    key: 52, // E
    scale: MINOR,
    prog: [0, 0, 5, 5, 3, 3, 4, 4],
    lead: [
      [9, 9, null, 11, 9, null, 7, null],
      [9, 9, null, 12, 11, null, 9, null],
      [8, 8, null, 10, 8, null, 7, null],
      [8, 8, null, 11, 10, null, 8, null],
      [7, 8, 9, 10, 11, 12, 11, 9],
      [9, 10, 11, 12, 13, 12, 11, null],
      [6, 7, 8, 9, 10, 9, 8, 7],
      [7, null, 9, null, 11, null, 13, null],
    ],
    drums: "kkhskkhs",
    wave: "square",
  },
  {
    id: "heroes",
    name: "Arena Heroes",
    bn: "অ্যারেনার বীর",
    bpm: 142,
    key: 60, // C
    scale: MAJOR,
    prog: [0, 4, 5, 3, 0, 4, 3, 4],
    lead: [
      [7, null, 9, 11, 12, null, 11, 9],
      [8, null, 10, 11, 8, null, 7, null],
      [9, null, 11, 12, 14, null, 12, 11],
      [10, null, 12, 10, 8, null, 10, null],
      [7, 9, 11, 14, 12, null, 11, 9],
      [8, 10, 11, 13, 11, null, 9, null],
      [9, 11, 12, 14, 16, 14, 12, 11],
      [10, 9, 8, 7, 7, null, null, null],
    ],
    drums: "k.hsk.hs",
    wave: "square",
  },
  {
    id: "final",
    name: "Final Showdown",
    bn: "চূড়ান্ত লড়াই",
    bpm: 168,
    key: 50, // D
    scale: DORIAN,
    prog: [0, 0, 6, 6, 4, 4, 5, 3],
    lead: [
      [11, null, 11, 9, 11, null, 13, null],
      [12, null, 12, 11, 9, null, 7, null],
      [10, null, 10, 9, 10, null, 12, null],
      [11, null, 11, 10, 9, null, 8, null],
      [11, 13, 14, 13, 11, 9, 11, null],
      [12, 14, 15, 14, 12, 11, 9, null],
      [10, 12, 13, 12, 10, 9, 10, null],
      [11, 13, 14, 15, 16, null, null, null],
    ],
    drums: "kkhsk.hs",
    wave: "sawtooth",
  },
];

const KEY_ON = "arena-brawl-music";
const KEY_VOL = "arena-brawl-music-vol";
const KEY_TUNE = "arena-brawl-music-tune";

const read = (k: string): string | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: the setting is just not remembered */
  }
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextT = 0;
  private playing = false;
  private noiseBuf: AudioBuffer | null = null;
  private on = read(KEY_ON) !== "0";
  private vol = (() => {
    const v = Number(read(KEY_VOL));
    return read(KEY_VOL) === null || !Number.isFinite(v) ? 0.5 : Math.min(1, Math.max(0, v));
  })();
  private tuneIdx = (() => {
    const i = TUNES.findIndex((t) => t.id === read(KEY_TUNE));
    return i >= 0 ? i : 0;
  })();
  private listeners = new Set<() => void>();

  /** Called when anything about the music changes (for the screen's button). */
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  isOn = () => this.on;
  volume = () => this.vol;
  tune = () => TUNES[this.tuneIdx]!;

  private ac(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private level() {
    return this.on ? this.vol * 0.32 : 0;
  }

  /** Start (or resume) playing, if the music is switched on. Must follow a tap or key press the first time. */
  start() {
    if (!this.on) return;
    const c = this.ac();
    if (!c || !this.master) return;
    if (c.state === "suspended") void c.resume();
    this.master.gain.cancelScheduledValues(c.currentTime);
    this.master.gain.setTargetAtTime(this.level(), c.currentTime, 0.25);
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextT = c.currentTime + 0.08;
    this.timer = setInterval(() => this.pump(), 25);
  }

  /** Fade out and stop. */
  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const c = this.ctx;
    if (c && this.master) {
      this.master.gain.cancelScheduledValues(c.currentTime);
      this.master.gain.setTargetAtTime(0, c.currentTime, 0.12);
    }
  }

  setOn(v: boolean) {
    this.on = v;
    write(KEY_ON, v ? "1" : "0");
    if (v) this.start();
    else this.stop();
    this.emit();
  }

  setVolume(v: number) {
    this.vol = Math.min(1, Math.max(0, v));
    write(KEY_VOL, String(this.vol));
    const c = this.ctx;
    if (c && this.master) this.master.gain.setTargetAtTime(this.level(), c.currentTime, 0.05);
    this.emit();
  }

  setTune(i: number) {
    this.tuneIdx = ((i % TUNES.length) + TUNES.length) % TUNES.length;
    write(KEY_TUNE, TUNES[this.tuneIdx]!.id);
    this.step = 0;
    if (this.ctx) this.nextT = this.ctx.currentTime + 0.08;
    this.emit();
  }
  nextTune(d = 1) {
    this.setTune(this.tuneIdx + d);
  }

  /** Pause when the page is hidden and carry on when it returns. */
  hidden(h: boolean) {
    const c = this.ctx;
    if (!c) return;
    if (h) void c.suspend();
    else if (this.on && this.playing) void c.resume();
  }

  // ---- the synthesizer
  private pump() {
    const c = this.ctx;
    if (!c || !this.playing) return;
    if (c.state !== "running") {
      this.nextT = c.currentTime + 0.08;
      return;
    }
    const tune = this.tune();
    const eighth = 60 / tune.bpm / 2;
    while (this.nextT < c.currentTime + 0.18) {
      this.play(tune, this.step, this.nextT, eighth);
      this.step = (this.step + 1) % 64;
      this.nextT += eighth;
    }
  }

  private freq(tune: Tune, degree: number, octave = 0) {
    const n = tune.scale.length;
    const o = Math.floor(degree / n);
    const d = ((degree % n) + n) % n;
    return midi(tune.key + tune.scale[d]! + 12 * (o + octave));
  }

  private play(tune: Tune, step: number, t: number, eighth: number) {
    const bar = Math.floor(step / 8);
    const i = step % 8;
    const root = tune.prog[bar]!;
    // bass: the chord root, jumping an octave on the off beats
    this.note("triangle", this.freq(tune, root, -1) * (i % 2 ? 2 : 1), t, eighth * 0.9, 0.55);
    // arpeggio: the chord's notes, two sixteenths per eighth
    const chord = [root, root + 2, root + 4, root + 7];
    for (let k = 0; k < 2; k++) this.note("square", this.freq(tune, chord[(i * 2 + k) % 4]!, 0), t + k * eighth * 0.5, eighth * 0.42, 0.11, 0.4);
    // lead
    const l = tune.lead[bar]![i];
    if (l !== null && l !== undefined) this.note(tune.wave, this.freq(tune, l, 0), t, eighth * 0.92, tune.wave === "sawtooth" ? 0.2 : 0.26, 0.7, 5);
    // drums
    const d = tune.drums[i];
    if (d === "k") this.kick(t);
    else if (d === "s") this.snare(t);
    if (d !== "." && (d === "h" || i % 2 === 1)) this.hat(t, d === "h" ? 0.1 : 0.06);
    if (step % 64 === 63) this.snare(t + eighth * 0.5);
  }

  private note(type: OscillatorType, f: number, t: number, dur: number, gain: number, sustain = 0.6, vib = 0) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (vib) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = vib;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.linearRampToValueAtTime(gain * sustain, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise() {
    const c = this.ctx!;
    if (!this.noiseBuf) {
      const n = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  private kick(t: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.2);
  }

  private snare(t: number) {
    this.burst(t, 0.16, 0.38, "bandpass", 1800);
  }
  private hat(t: number, gain: number) {
    this.burst(t, 0.04, gain, "highpass", 7000);
  }
  private burst(t: number, dur: number, gain: number, type: BiquadFilterType, f: number) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise();
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.master!);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }
}

export const music = new Music();
