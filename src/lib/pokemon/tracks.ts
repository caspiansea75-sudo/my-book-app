/**
 * Original chiptune battle themes, written as compact scores and turned into note lists.
 * Nothing here copies an existing song — the melodies are new, in the energetic 8-bit style
 * that suits a Pokémon battle. The notes are played by the synth in audio.ts.
 *
 * Score notation, 16 steps (sixteenth notes) per bar, tokens separated by spaces:
 *   "3"  start a note on scale degree 3      "3^" one octave up      "3v" one octave down
 *   "-"  keep the previous note going        "."  rest
 */

export type Mode = "minor" | "major" | "dorian" | "phrygian";
const SCALES: Record<Mode, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

export type TrackSpec = {
  id: string;
  bn: string;
  en: string;
  emoji: string;
  moodBn: string;
  moodEn: string;
  bpm: number;
  /** MIDI note of the key's tonic (57 = A3) */
  root: number;
  mode: Mode;
  /** scale degree of the chord in each of the 8 bars */
  prog: number[];
  /** the melody, one 16-token string per bar */
  lead: string[];
  /** 16-character drum patterns: x = hit */
  kick: string;
  snare: string;
  hat: string;
  /** which chord tones the arpeggio plays (0 = root, 1 = third, 2 = fifth, 3 = octave) */
  arp?: number[];
  bass?: "pulse" | "sync";
};

export type Note = { step: number; midi: number; len: number };
export type BuiltTrack = {
  spec: TrackSpec;
  steps: number;
  stepSec: number;
  lead: Note[];
  harmony: Note[];
  arp: Note[];
  bass: Note[];
  kick: number[];
  snare: number[];
  hat: number[];
};

/** MIDI note of scale degree `deg` (1 = tonic; 8 = tonic an octave up; 0 / negatives go below). */
export function degreeToMidi(root: number, mode: Mode, deg: number): number {
  const scale = SCALES[mode];
  const i = deg - 1;
  const oct = Math.floor(i / 7);
  const idx = ((i % 7) + 7) % 7;
  return root + oct * 12 + scale[idx];
}

function parseLead(bar: string, barIndex: number, root: number, mode: Mode): { notes: Note[]; harmony: Note[] } {
  const tokens = bar.trim().split(/\s+/);
  if (tokens.length !== 16) throw new Error(`bar ${barIndex + 1} has ${tokens.length} steps, expected 16: "${bar}"`);
  const notes: Note[] = [];
  const harmony: Note[] = [];
  let cur: Note | null = null;
  let curDeg = 0;
  const close = () => {
    cur = null;
  };
  tokens.forEach((tok, i) => {
    const step = barIndex * 16 + i;
    if (tok === "-") {
      if (cur) {
        cur.len++;
        const h = harmony[harmony.length - 1];
        if (h && barIndex >= 4) h.len++;
      }
      return;
    }
    if (tok === ".") {
      close();
      return;
    }
    const m = /^([1-7])([\^v]*)$/.exec(tok);
    if (!m) throw new Error(`bad token "${tok}" in bar ${barIndex + 1}`);
    const shift = (m[2].match(/\^/g)?.length ?? 0) - (m[2].match(/v/g)?.length ?? 0);
    curDeg = Number(m[1]) + 7 * shift;
    cur = { step, midi: degreeToMidi(root + 12, mode, curDeg), len: 1 };
    notes.push(cur);
    if (barIndex >= 4) harmony.push({ step, midi: degreeToMidi(root + 12, mode, curDeg + 2), len: 1 });
  });
  return { notes, harmony };
}

const idxs = (pat: string) => Array.from(pat).flatMap((c, i) => (c === "x" ? [i] : []));

export function buildTrack(spec: TrackSpec): BuiltTrack {
  if (spec.prog.length !== 8 || spec.lead.length !== 8) throw new Error(`${spec.id}: needs 8 bars`);
  const lead: Note[] = [];
  const harmony: Note[] = [];
  const arp: Note[] = [];
  const bass: Note[] = [];
  const pattern = spec.arp ?? [0, 1, 2, 1];
  spec.lead.forEach((bar, b) => {
    const p = parseLead(bar, b, spec.root, spec.mode);
    lead.push(...p.notes);
    harmony.push(...p.harmony);
    const r = spec.prog[b];
    const chord = [r, r + 2, r + 4, r + 7].map((d) => degreeToMidi(spec.root, spec.mode, d));
    for (let i = 0; i < 16; i++) arp.push({ step: b * 16 + i, midi: chord[pattern[i % pattern.length]], len: 1 });
    const low = degreeToMidi(spec.root - 12, spec.mode, r);
    if ((spec.bass ?? "pulse") === "pulse") {
      for (let i = 0; i < 16; i += 2) bass.push({ step: b * 16 + i, midi: i % 4 === 0 ? low : low + 12, len: 2 });
    } else {
      for (const i of [0, 3, 6, 8, 11, 14]) bass.push({ step: b * 16 + i, midi: i === 6 || i === 14 ? low + 12 : low, len: i === 14 ? 2 : 3 });
    }
  });
  const rep = (pat: number[]) => Array.from({ length: 8 }, (_, b) => pat.map((s) => b * 16 + s)).flat();
  return {
    spec,
    steps: 128,
    stepSec: 60 / spec.bpm / 4,
    lead,
    harmony,
    arp,
    bass,
    kick: rep(idxs(spec.kick)),
    snare: rep(idxs(spec.snare)),
    hat: rep(idxs(spec.hat)),
  };
}

export const TRACK_SPECS: TrackSpec[] = [
  {
    id: "wild", bn: "বুনো মুখোমুখি", en: "Wild Encounter", emoji: "🌿", moodBn: "দ্রুত, রোমাঞ্চকর", moodEn: "fast and thrilling",
    bpm: 152, root: 57, mode: "minor", prog: [1, 6, 7, 1, 1, 4, 5, 5],
    lead: [
      "5 - 3 5 6 - 5 - 3 - 1 - 3 - 5 -",
      "6 - 1^ 6 5 - 3 - 5 - 6 - 5 - 3 -",
      "7 - 5 7 2^ - 7 - 5 - 7 - 5 - 4 -",
      "3 - 1 - 3 5 6 - 5 - 3 - 1 . . .",
      "1^ - 7 1^ 3^ - 1^ - 7 - 5 - 7 - 1^ -",
      "6 - 4 6 1^ - 6 - 4 - 6 - 4 - 3 -",
      "7 - 2^ 7 5 - 7 - 2^ - 3^ 2^ 7 - 5 -",
      "5 - 7 - 5 - 3 - 2 - 3 5 7 - . .",
    ],
    kick: "x...x...x..xx...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.",
  },
  {
    id: "trainer", bn: "ট্রেনার চ্যালেঞ্জ", en: "Trainer Challenge", emoji: "🧢", moodBn: "বীরত্বপূর্ণ, উজ্জ্বল", moodEn: "heroic and bright",
    bpm: 144, root: 55, mode: "major", prog: [1, 5, 6, 4, 1, 5, 4, 5], arp: [0, 1, 2, 3],
    lead: [
      "1^ - 5 - 1^ - 3^ - 2^ - 1^ - 7 - 5 -",
      "2^ - 7 - 2^ - 4^ - 3^ - 2^ - 1^ - 7 -",
      "3^ - 1^ - 3^ - 5^ - 4^ - 3^ - 2^ - 1^ -",
      "4 - 6 - 1^ - 6 - 4 - 6 - 1^ - 2^ 1^",
      "5 5 1^ 5 3^ - 1^ - 5 5 1^ 5 3^ - 1^ -",
      "7 7 2^ 7 4^ - 2^ - 7 7 2^ 7 4^ - 2^ -",
      "6 6 1^ 6 4^ - 1^ - 6 6 1^ 6 4^ - 1^ -",
      "2^ - 7 - 5 - 7 - 2^ 2^ 7 - 5 - . .",
    ],
    kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.",
  },
  {
    id: "gym", bn: "জিম লিডার", en: "Gym Leader", emoji: "🏟️", moodBn: "তীব্র, ভারী", moodEn: "intense and heavy",
    bpm: 164, root: 50, mode: "minor", prog: [1, 7, 6, 5, 1, 7, 6, 5], bass: "sync",
    lead: [
      "1 . 1 3 5 . 5 3 1 . 1 3 5 - 6 -",
      "7 . 7 2^ 5 . 5 4 7 . 7 2^ 4^ - 3^ -",
      "6 . 6 1^ 3^ . 3^ 1^ 6 . 6 1^ 5^ - 4^ -",
      "5 . 5 7 2^ . 2^ 7 5 . 5 7 2^ - 5 -",
      "1^ - - 1^ 3^ - - 1^ 5^ - - 3^ 1^ - 7 -",
      "7 - - 7 2^ - - 7 4^ - - 2^ 7 - 5 -",
      "6 - - 6 1^ - - 6 3^ - - 1^ 6 - 5 -",
      "5 - 7 - 2^ - 4^ - 5^ - 4^ - 2^ - 7 -",
    ],
    kick: "x..xx..xx..xx.x.", snare: "....x..x....x...", hat: "xxxxxxxxxxxxxxxx",
  },
  {
    id: "rival", bn: "প্রতিদ্বন্দ্বী", en: "Rival Showdown", emoji: "⚡", moodBn: "টানটান, প্রতিযোগিতার", moodEn: "tense and competitive",
    bpm: 156, root: 57, mode: "dorian", prog: [1, 4, 1, 7, 1, 4, 7, 7], bass: "sync",
    lead: [
      "1 - 3 - 5 3 - 5 1^ - 5 - 3 - 1 -",
      "4 - 6 - 1^ 6 - 1^ 3^ - 1^ - 6 - 4 -",
      "3 - 5 - 1^ 5 - 1^ 3^ - 2^ - 1^ - 5 -",
      "7 - 2^ - 4^ 2^ - 7 5 - 7 - 2^ - 4^ -",
      "5^ - 3^ - 1^ 3^ - 5^ 6^ - 5^ - 3^ - 1^ -",
      "4^ - 6 - 1^ 4^ - 6 1^ - 6 - 4 - 6 -",
      "7 - 5 - 7 2^ - 5 7 - 2^ - 4^ - 2^ -",
      "2^ - 4^ - 5^ - 4^ - 2^ - 7 - 5 - . .",
    ],
    kick: "x..x..x.x..x..x.", snare: "....x.......x..x", hat: "x.x.x.x.x.x.x.xx",
  },
  {
    id: "champion", bn: "চ্যাম্পিয়ন", en: "Champion's Stand", emoji: "👑", moodBn: "মহাকাব্যিক, বিশাল", moodEn: "epic and grand",
    bpm: 172, root: 52, mode: "minor", prog: [1, 6, 3, 7, 1, 6, 4, 5], arp: [0, 2, 1, 3],
    lead: [
      "5 - 1^ - 5 - 3^ - 2^ - 1^ - 7 - 5 -",
      "6 - 1^ - 6 - 3^ - 4^ - 3^ - 1^ - 6 -",
      "3 - 5 - 7 - 3^ - 5^ - 3^ - 7 - 5 -",
      "7 - 2^ - 4^ - 2^ - 7 - 5 - 7 - 2^ -",
      "1^ - - - 5 - - - 3^ - - - 2^ - 1^ -",
      "6 - - - 1^ - - - 3^ - - - 1^ - 6 -",
      "4 - - - 6 - - - 1^ - - - 6 - 4 -",
      "5 - 7 - 2^ - 7 - 5 - 7 - 2^ - 4^ 5^",
    ],
    kick: "x.x.x.x.x.x.x.x.", snare: "....x.......x.xx", hat: "x.x.x.x.x.x.x.x.",
  },
];

export const TRACKS: Record<string, BuiltTrack> = Object.fromEntries(TRACK_SPECS.map((s) => [s.id, buildTrack(s)]));

/** Which theme a battle gets when the player leaves the choice on "Auto". */
export function pickAutoTrack(battle: { id: number; cpu: boolean; cpuLevel: string | null }): string {
  if (!battle.cpu) return battle.id % 2 ? "rival" : "champion";
  if (battle.cpuLevel === "easy") return "wild";
  if (battle.cpuLevel === "hard") return battle.id % 2 ? "gym" : "champion";
  return "trainer";
}

/* ----------------------------------------------------------- short jingles */

export type Jingle = { bpm: number; lead: Note[]; bass: Note[]; steps: number };
export const JINGLES: Record<"win" | "lose" | "draw", Jingle> = {
  win: {
    bpm: 150,
    steps: 44,
    lead: [
      { step: 0, midi: 67, len: 2 }, { step: 2, midi: 72, len: 2 }, { step: 4, midi: 76, len: 2 }, { step: 6, midi: 79, len: 6 },
      { step: 12, midi: 76, len: 2 }, { step: 14, midi: 79, len: 2 }, { step: 16, midi: 84, len: 10 },
      { step: 28, midi: 83, len: 2 }, { step: 30, midi: 84, len: 14 },
    ],
    bass: [
      { step: 0, midi: 48, len: 6 }, { step: 6, midi: 55, len: 6 }, { step: 12, midi: 53, len: 4 }, { step: 16, midi: 48, len: 8 },
      { step: 24, midi: 53, len: 4 }, { step: 28, midi: 55, len: 2 }, { step: 30, midi: 48, len: 14 },
    ],
  },
  lose: {
    bpm: 96,
    steps: 28,
    lead: [{ step: 0, midi: 67, len: 4 }, { step: 4, midi: 63, len: 4 }, { step: 8, midi: 60, len: 4 }, { step: 12, midi: 58, len: 4 }, { step: 16, midi: 55, len: 12 }],
    bass: [{ step: 0, midi: 43, len: 8 }, { step: 8, midi: 41, len: 8 }, { step: 16, midi: 36, len: 12 }],
  },
  draw: {
    bpm: 110,
    steps: 24,
    lead: [{ step: 0, midi: 67, len: 4 }, { step: 4, midi: 64, len: 4 }, { step: 8, midi: 67, len: 4 }, { step: 12, midi: 72, len: 12 }],
    bass: [{ step: 0, midi: 48, len: 12 }, { step: 12, midi: 43, len: 12 }],
  },
};
