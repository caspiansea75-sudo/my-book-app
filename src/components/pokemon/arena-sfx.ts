/** Small synthesized sound effects for Arena Brawl (no files to load). Muted state is remembered. */
let ctx: AudioContext | null = null;
let muted = typeof localStorage !== "undefined" && localStorage.getItem("arena-brawl-muted") === "1";

const ac = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

function tone(type: OscillatorType, f0: number, dur: number, gain: number, f1?: number, delay = 0) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, f0: number, f1: number, kind: BiquadFilterType = "lowpass", delay = 0) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const n = Math.ceil(c.sampleRate * dur);
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  const fl = c.createBiquadFilter();
  fl.type = kind;
  fl.frequency.setValueAtTime(f0, t);
  fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(c.destination);
  s.start(t);
}

export const sfx = {
  isMuted: () => muted,
  setMuted(v: boolean) {
    muted = v;
    try {
      localStorage.setItem("arena-brawl-muted", v ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  },
  unlock() {
    ac();
  },
  cast(kind: string) {
    if (kind === "dash") noise(0.18, 0.18, 800, 3000, "bandpass");
    else if (kind === "nova") tone("sine", 160, 0.3, 0.2, 60);
    else if (kind === "guard" || kind === "buff") tone("triangle", 500, 0.25, 0.12, 1000);
    else if (kind === "heal") [60, 64, 67, 72].forEach((m, i) => tone("sine", 440 * 2 ** ((m - 69) / 12), 0.18, 0.1, undefined, i * 0.06));
    else if (kind === "beam") noise(0.5, 0.14, 1200, 3200, "bandpass");
    else if (kind === "lob" || kind === "bolt") tone("sawtooth", 200, 0.3, 0.07, 700);
    else tone("square", 520, 0.1, 0.06, 280);
  },
  hit(heavy: boolean, crit: boolean) {
    noise(0.07, heavy ? 0.4 : 0.26, 2600, 900, "bandpass");
    tone("triangle", heavy ? 190 : 240, 0.1, heavy ? 0.34 : 0.22, 60);
    if (crit) tone("square", 900, 0.12, 0.1, 1800);
  },
  hurt() {
    tone("sawtooth", 150, 0.18, 0.14, 70);
  },
  boom() {
    noise(0.4, 0.3, 1500, 120);
    tone("sine", 110, 0.4, 0.3, 36);
  },
  dodge() {
    noise(0.16, 0.16, 500, 2400, "bandpass");
  },
  perfect() {
    [76, 83, 88].forEach((m, i) => tone("triangle", 440 * 2 ** ((m - 69) / 12), 0.2, 0.14, undefined, i * 0.07));
  },
  ko(boss: boolean) {
    tone("square", 700, 0.3, 0.12, 900);
    noise(boss ? 1.0 : 0.5, boss ? 0.4 : 0.28, 2600, 150);
    tone("sine", 130, 0.5, 0.3, 36);
  },
  combo(n: number, finish: boolean) {
    if (finish) [72, 76, 79, 84].forEach((m, i) => tone("square", 440 * 2 ** ((m - 69) / 12), 0.13, 0.1, undefined, i * 0.05));
    else tone("triangle", 330 + n * 80, 0.1, 0.1);
  },
  wave(boss: boolean) {
    if (boss) {
      tone("sawtooth", 90, 0.9, 0.2, 45);
      noise(0.9, 0.18, 400, 90);
    } else [64, 67, 72].forEach((m, i) => tone("triangle", 440 * 2 ** ((m - 69) / 12), 0.16, 0.12, undefined, i * 0.09));
  },
  win() {
    [72, 76, 79, 84, 88].forEach((m, i) => tone("triangle", 440 * 2 ** ((m - 69) / 12), 0.25, 0.14, undefined, i * 0.1));
  },
  lose() {
    [67, 64, 60, 55].forEach((m, i) => tone("sawtooth", 440 * 2 ** ((m - 69) / 12), 0.3, 0.1, undefined, i * 0.14));
  },
  mega() {
    [64, 68, 71, 76, 80, 83].forEach((m, i) => tone("triangle", 440 * 2 ** ((m - 69) / 12), 0.22, 0.12, undefined, i * 0.06));
    noise(0.7, 0.2, 800, 4000, "bandpass");
    tone("sine", 90, 0.6, 0.3, 40);
  },
  zstart() {
    tone("sawtooth", 80, 1.1, 0.14, 420);
    noise(1.1, 0.16, 300, 3800, "bandpass");
  },
  zhit() {
    noise(0.7, 0.4, 3000, 100);
    tone("sine", 100, 0.8, 0.4, 28);
    tone("square", 900, 0.2, 0.1, 1800);
  },
  dynamax() {
    tone("sawtooth", 70, 0.9, 0.22, 36);
    noise(0.9, 0.3, 700, 70);
    tone("sine", 50, 1.1, 0.3, 28);
  },
  tera() {
    [84, 88, 91, 96].forEach((m, i) => tone("sine", 440 * 2 ** ((m - 69) / 12), 0.3, 0.1, undefined, i * 0.05));
    noise(0.4, 0.18, 6000, 2000, "highpass");
  },
  pick() {
    tone("triangle", 660, 0.08, 0.1, 990);
  },
};
