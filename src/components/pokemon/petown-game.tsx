import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Bot, Flag, Search, Shuffle, Swords, X } from "lucide-react";
import { MusicPanel } from "@/components/pokemon/music-panel";
import { Sprite, StatBars, TypeBadge, useT } from "@/components/pokemon/ui";
import { battleAudio } from "@/lib/pokemon/audio";
import { initialState, type Cue } from "@/lib/pokemon/protocol";
import { pickAutoTrack } from "@/lib/pokemon/tracks";
import "@/components/pokemon/petown.css";
import { TYPES, TYPE_COLOR, type SpriteInfo } from "@/lib/pokemon/shared";
import {
  DIFFICULTY,
  FORM_LABEL,
  TEAM_SIZE,
  activeOf,
  activeWeather,
  bst,
  cpuTeam,
  damageRange,
  itemsFor,
  makeMon,
  autoChoice,
  bestReplacement,
  canSwitch,
  newBattle,
  playRound,
  playerReplace,
  rating,
  startBattle,
  type Battle,
  type Choice,
  type Difficulty,
  type Ev,
  type ItemRow,
  type Mon,
  type PetownData,
  type SpeciesRow,
  type Stat,
  type Status,
  type Weather,
} from "@/lib/petown/engine";
import { abilitySummary, isInert } from "@/lib/petown/abilities";

type Pick = { id: number; item: string };

const FORM_FILTERS = [
  { v: -1, bn: "সব", en: "All" },
  { v: 0, bn: "সাধারণ", en: "Base" },
  { v: 1, bn: "মেগা", en: "Mega" },
  { v: 2, bn: "R2", en: "R2" },
  { v: 3, bn: "আল্টিমেট", en: "Ultimate" },
] as const;

type Look = { sprite: string; num: number; types: string[]; hue: number };
const monLook = (m: Mon): Look => ({ sprite: m.sprite, num: m.num, types: m.types, hue: m.hue });
const rowLook = (s: SpeciesRow): Look => ({ sprite: s[7], num: s[8], types: s[2], hue: s[9] ?? 0 });

/** A Pokémon picture. Custom Petown forms that reuse another species' sprite get a colour tint so they read as their own form. */
function Pic({ look, back, still, className, alt = "" }: { look: Look; back?: boolean; still?: boolean; className?: string; alt?: string }) {
  const info: SpriteInfo | null = look.sprite ? { id: look.sprite, num: look.num, types: look.types } : null;
  return <Sprite info={info} back={back} still={still} className={className} alt={alt} style={look.hue ? { filter: `hue-rotate(${look.hue}deg) saturate(1.2)` } : undefined} />;
}

const WEATHER_ATTR: Record<Weather, string> = { sun: "SunnyDay", rain: "RainDance", sand: "Sandstorm", hail: "Hail", harshsun: "DesolateLand", heavyrain: "PrimordialSea", wind: "DeltaStream" };
const WEATHER_LABEL: Record<Weather, { bn: string; en: string }> = {
  sun: { bn: "☀️ রোদ", en: "☀️ Sun" }, rain: { bn: "🌧️ বৃষ্টি", en: "🌧️ Rain" }, sand: { bn: "🌪️ বালিঝড়", en: "🌪️ Sand" }, hail: { bn: "🧊 শিলাবৃষ্টি", en: "🧊 Hail" },
  harshsun: { bn: "🔥 প্রচণ্ড রোদ", en: "🔥 Harsh sun" }, heavyrain: { bn: "🌊 প্রবল বৃষ্টি", en: "🌊 Heavy rain" }, wind: { bn: "🌀 ডেল্টা স্ট্রিম", en: "🌀 Delta Stream" },
};
const STATUS_LABEL: Record<Status, { bn: string; en: string; color: string }> = {
  brn: { bn: "পোড়া", en: "BRN", color: "#ff7a3d" }, psn: { bn: "বিষ", en: "PSN", color: "#a050d0" }, par: { bn: "প্যারা", en: "PAR", color: "#e6c200" },
  slp: { bn: "ঘুম", en: "SLP", color: "#7b8aa8" }, cnf: { bn: "বিভ্রান্ত", en: "CNF", color: "#d86bb0" }, inf: { bn: "মোহ", en: "LOVE", color: "#ff5c8a" },
};
const STAT_SHORT: Record<Stat, string> = { atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe", acc: "Acc", eva: "Eva" };

function loadRecord(): { w: number; l: number } {
  try {
    const r = JSON.parse(localStorage.getItem("petown:record") ?? "null");
    if (r && typeof r.w === "number" && typeof r.l === "number") return r;
  } catch {
    /* no storage */
  }
  return { w: 0, l: 0 };
}
function saveRecord(r: { w: number; l: number }) {
  try {
    localStorage.setItem("petown:record", JSON.stringify(r));
  } catch {
    /* no storage */
  }
}

/* ======================================================================== top level */

export function PetownGame() {
  const { t } = useT();
  const [data, setData] = useState<PetownData | null>(null);
  const [failed, setFailed] = useState(false);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [run, setRun] = useState<{ player: Mon[]; foe: Mon[]; key: number } | null>(null);

  useEffect(() => {
    let live = true;
    import("@/data/petown.json")
      .then((m) => live && setData((m.default ?? m) as unknown as PetownData))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const byId = useMemo(() => new Map((data?.species ?? []).map((s) => [s[0], s])), [data]);

  const buildPlayer = useCallback(
    (d: PetownData) =>
      picks.flatMap((p) => {
        const sp = byId.get(p.id);
        if (!sp) return [];
        const item = d.items.find((i) => i[0] === p.item) ?? null;
        return [makeMon(d, sp, item)];
      }),
    [picks, byId],
  );

  const start = useCallback(() => {
    if (!data || !picks.length) return;
    const player = buildPlayer(data);
    const avg = player.reduce((a, m) => a + m.base.reduce((x, y) => x + y, 0), 0) / player.length;
    const foe = cpuTeam(data, avg, difficulty, player.length, picks.map((p) => p.id));
    setRun({ player, foe, key: Date.now() });
  }, [data, picks, difficulty, buildPlayer]);

  if (failed) return <p className="pk-card mx-auto max-w-5xl p-4 font-sans text-sm text-nsfw">{t("পেটাউন ডেটা লোড হয়নি — পেজ রিফ্রেশ করুন।", "Couldn't load the Petown data — refresh the page.")}</p>;
  if (!data) return <p className="mx-auto max-w-5xl px-5 py-10 font-sans text-sm text-muted sm:px-8">{t("পেটাউন ডেটা লোড হচ্ছে…", "Loading Petown data…")}</p>;

  if (run) {
    return <BattleScreen key={run.key} player={run.player} foe={run.foe} difficulty={difficulty} onRematch={start} onExit={() => setRun(null)} />;
  }
  return <Picker data={data} byId={byId} picks={picks} setPicks={setPicks} difficulty={difficulty} setDifficulty={setDifficulty} onStart={start} />;
}

/* ======================================================================== team picker */

function Picker({
  data,
  byId,
  picks,
  setPicks,
  difficulty,
  setDifficulty,
  onStart,
}: {
  data: PetownData;
  byId: Map<number, SpeciesRow>;
  picks: Pick[];
  setPicks: (f: (p: Pick[]) => Pick[]) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onStart: () => void;
}) {
  const { t, lang } = useT();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<number>(-1);
  const [type, setType] = useState("");
  const [sort, setSort] = useState<"bst" | "spe" | "name">("bst");
  const [limit, setLimit] = useState(60);
  const [record, setRecord] = useState({ w: 0, l: 0 });
  useEffect(() => setRecord(loadRecord()), []);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = data.species.filter((s) => (form < 0 || s[6] === form) && (!type || s[2].includes(type)) && (!needle || s[1].toLowerCase().includes(needle)));
    out.sort((a, b) => (sort === "name" ? a[1].localeCompare(b[1]) : sort === "spe" ? b[3][5] - a[3][5] : bst(b) - bst(a)));
    return out;
  }, [data, q, form, type, sort]);
  useEffect(() => setLimit(60), [q, form, type, sort]);

  const taken = new Set(picks.map((p) => p.id));
  const add = (s: SpeciesRow) => {
    if (taken.has(s[0])) return setPicks((p) => p.filter((x) => x.id !== s[0]));
    setPicks((p) => (p.length >= TEAM_SIZE ? p : [...p, { id: s[0], item: "" }]));
  };
  const random = () => {
    const pool = data.species;
    const chosen = new Set<number>();
    while (chosen.size < TEAM_SIZE) chosen.add(pool[Math.floor(Math.random() * pool.length)][0]);
    setPicks(() => [...chosen].map((id) => ({ id, item: "" })));
  };

  const avgBst = picks.length ? Math.round(picks.reduce((a, p) => a + bst(byId.get(p.id)!), 0) / picks.length) : 0;

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-5 pb-24 pt-6 sm:px-8">
      <div className="pk-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl">⚔️ {t("আপনার টিম", "Your team")}</h2>
          <p className="font-sans text-xs text-muted">
            {t("রেকর্ড", "Record")}: <b className="text-fg">{record.w}</b> {t("জয়", "W")} · <b className="text-fg">{record.l}</b> {t("হার", "L")}
          </p>
        </div>
        <p className="mt-1 max-w-2xl font-sans text-sm leading-relaxed text-muted">
          {t(
            "পেটাউনের আসল স্ট্যাট, চাল, অ্যাবিলিটি ও হোল্ড আইটেম নিয়ে টার্ন-ভিত্তিক লড়াই। প্রতি রাউন্ডে একটি চাল বা পোকেমন বদল বাছুন — স্পিডে এগিয়ে থাকা পোকেমন আগে চলে। ৩ জন বেছে নিন।",
            "A turn-based battle using Petown's own stats, moves, abilities and hold items. Each round you pick a move or a switch — the faster Pokémon acts first. Pick up to 3.",
          )}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {Array.from({ length: TEAM_SIZE }, (_, i) => {
            const p = picks[i];
            const sp = p ? byId.get(p.id) : undefined;
            return sp && p ? (
              <SlotCard key={p.id} data={data} sp={sp} item={p.item} onItem={(item) => setPicks((all) => all.map((x) => (x.id === p.id ? { ...x, item } : x)))} onRemove={() => setPicks((all) => all.filter((x) => x.id !== p.id))} />
            ) : (
              <div key={i} className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border p-4 text-center font-sans text-sm text-muted">
                {t(`নিচ থেকে পোকেমন ${i + 1} বেছে নিন`, `Pick Pokémon ${i + 1} below`)}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 font-sans text-xs text-muted">
          <Bot className="size-4" aria-hidden="true" />
          {t("CPU কঠিনতা:", "CPU difficulty:")}
          {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(d)} className={`pressable rounded-full border px-3 py-1 text-sm ${difficulty === d ? "border-lamp bg-surface-2 text-fg" : "border-border bg-bg text-muted"}`}>
              {t(DIFFICULTY[d].bn, DIFFICULTY[d].en)}
            </button>
          ))}
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {avgBst ? <span>{t("গড় শক্তি", "Avg strength")} <b className="text-fg">{avgBst}</b></span> : null}
            <button type="button" onClick={random} className="pressable inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm text-fg">
              <Shuffle className="size-4" aria-hidden="true" /> {t("র‍্যান্ডম টিম", "Random team")}
            </button>
            <button type="button" disabled={!picks.length} onClick={onStart} className="pressable inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-fg disabled:opacity-40">
              <Swords className="size-4" aria-hidden="true" /> {t("লড়াই শুরু", "Start battle")}
            </button>
          </span>
        </div>
      </div>

      <div className="pk-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("নাম খুঁজুন…", "Search by name…")} aria-label={t("নাম খুঁজুন", "Search by name")} className="h-10 w-full rounded-lg border border-border bg-bg pl-9 pr-3 font-sans text-sm text-fg" />
          </label>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label={t("টাইপ", "Type")} className="h-10 rounded-lg border border-border bg-bg px-3 font-sans text-sm text-fg">
            <option value="">{t("সব টাইপ", "All types")}</option>
            {TYPES.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={t("সাজান", "Sort")} className="h-10 rounded-lg border border-border bg-bg px-3 font-sans text-sm text-fg">
            <option value="bst">{t("শক্তি (বেশি আগে)", "Strongest first")}</option>
            <option value="spe">{t("গতি (বেশি আগে)", "Fastest first")}</option>
            <option value="name">{t("নাম (A–Z)", "Name (A–Z)")}</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FORM_FILTERS.map((f) => (
            <button key={f.v} type="button" onClick={() => setForm(f.v)} className={`pressable rounded-full border px-3 py-1 font-sans text-sm ${form === f.v ? "border-lamp bg-surface-2 text-fg" : "border-border bg-bg text-muted"}`}>
              {t(f.bn, f.en)}
            </button>
          ))}
          <span className="ml-auto self-center font-sans text-xs text-muted">{list.length} {t("টি পোকেমন", "Pokémon")}</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {list.slice(0, limit).map((s) => (
            <button key={s[0]} type="button" onClick={() => add(s)} data-taken={taken.has(s[0]) ? "1" : "0"} className="pk-dexcard font-sans" title={`${s[1]} — ${s[3].join("/")}`}>
              <Pic look={rowLook(s)} still className="size-16 object-contain" />
              <span className="line-clamp-2 min-h-8 text-[12px] font-semibold leading-tight text-fg">{s[1]}</span>
              <span className="flex flex-wrap justify-center gap-0.5">{s[2].map((x) => <TypeBadge key={x} type={x} small />)}</span>
              <span className="text-[11px] text-muted">{FORM_LABEL[s[6]][lang === "en" ? "en" : "bn"]} · {bst(s)}</span>
            </button>
          ))}
        </div>
        {list.length === 0 ? <p className="mt-6 text-center font-sans text-sm text-muted">{t("কিছু পাওয়া যায়নি — অন্য ফিল্টার চেষ্টা করুন।", "Nothing matches — try another filter.")}</p> : null}
        {limit < list.length ? (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setLimit((n) => n + 60)} className="pressable rounded-full border border-border bg-surface px-5 py-2 font-sans text-sm text-fg">
              {t("আরও দেখান", "Show more")} ({list.length - limit})
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SlotCard({ data, sp, item, onItem, onRemove }: { data: PetownData; sp: SpeciesRow; item: string; onItem: (v: string) => void; onRemove: () => void }) {
  const { t, lang } = useT();
  const lg = lang === "en" ? "en" : "bn";
  const summary = abilitySummary(sp[4], lg);
  const opts = useMemo(() => itemsFor(data, sp).sort((a, b) => a[0].localeCompare(b[0])), [data, sp]);
  const chosen = opts.find((o) => o[0] === item);
  return (
    <div className="pk-card relative flex flex-col gap-2 p-3 pk-pop">
      <button type="button" onClick={onRemove} aria-label={t("সরান", "Remove")} className="pressable absolute right-2 top-2 grid size-7 place-items-center rounded-full border border-border bg-bg text-muted hover:text-fg">
        <X className="size-4" aria-hidden="true" />
      </button>
      <div className="flex items-center gap-3">
        <Pic look={rowLook(sp)} still className="size-20 object-contain" />
        <div className="min-w-0 pr-6">
          <b className="block truncate font-display text-lg">{sp[1]}</b>
          <span className="flex flex-wrap gap-1">{sp[2].map((x) => <TypeBadge key={x} type={x} small />)}</span>
          <span className="font-sans text-[11px] text-muted">{FORM_LABEL[sp[6]][lang === "en" ? "en" : "bn"]} · {bst(sp)}</span>
        </div>
      </div>
      <StatBars bs={sp[3]} />
      <div className="font-sans text-xs leading-snug text-muted" title={data.abilities[sp[4]] ?? ""}>
        <b className="text-fg">{sp[4] || "—"}</b>
        {summary ? <span className={isInert(sp[4]) ? "" : "text-lamp"}> {isInert(sp[4]) ? "⚠" : "✓"} {summary}</span> : null}
      </div>
      <ul className="grid grid-cols-2 gap-1 font-sans text-[11px]">
        {sp[5].map((i) => {
          const m = data.moves[i];
          return (
            <li key={i} className="flex items-center gap-1 rounded-md border border-border bg-bg px-1.5 py-1">
              <i className="size-2 shrink-0 rounded-full" style={{ background: TYPE_COLOR[m[1]] ?? "#999" }} />
              <span className="truncate text-fg">{m[0]}</span>
              <span className="ml-auto text-muted">{m[3]}</span>
            </li>
          );
        })}
      </ul>
      <label className="font-sans text-xs text-muted">
        {t("হোল্ড আইটেম", "Hold item")}
        <select value={item} onChange={(e) => onItem(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm text-fg">
          <option value="">{t("কিছু নয়", "None")}</option>
          {opts.map((o: ItemRow) => (
            <option key={o[0]} value={o[0]}>{o[0]}</option>
          ))}
        </select>
      </label>
      {chosen ? <p className="font-sans text-[11px] leading-snug text-muted">{chosen[5]}</p> : null}
    </div>
  );
}

/* ======================================================================== battle screen */

type Fx = { id: number; side: 0 | 1; text: string; cls: string };
type Banner = { id: number; text: string; cls: string };

function BattleScreen({ player, foe, difficulty, onRematch, onExit }: { player: Mon[]; foe: Mon[]; difficulty: Difficulty; onRematch: () => void; onExit: () => void }) {
  const { t, lang } = useT();
  const lg = lang === "en" ? "en" : "bn";
  const bref = useRef<Battle | null>(null);
  if (!bref.current) bref.current = newBattle(player, foe, difficulty);
  const b = bref.current;
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [log, setLog] = useState<{ id: number; text: string; cls?: string }[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [auto, setAuto] = useState(false);
  const [fast, setFast] = useState(false);
  const [intro, setIntro] = useState(true);
  const [done, setDone] = useState(false);
  /** choose: your turn · play: a round is being shown · forced: pick the next Pokémon */
  const [phase, setPhase] = useState<"choose" | "play" | "forced">("choose");
  const phaseRef = useRef<"choose" | "play" | "forced">("choose");
  const genRef = useRef<Generator<Ev[], void, void> | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const fastRef = useRef(false);
  const meRef = useRef<HTMLDivElement | null>(null);
  const foeRef = useRef<HTMLDivElement | null>(null);
  const recorded = useRef(false);
  const theme = useMemo(() => Math.floor(Math.random() * 4), []);
  const seed = useMemo(() => 1 + Math.floor(Math.random() * 1000), []);
  const audioState = useRef(initialState());
  /** Sound effect for a battle event (the synth maps these onto its own cue kinds). */
  const cue = useCallback((c: Omit<Cue, "id"> & { id: number }) => battleAudio.cue(c as Cue, audioState.current, "p1"), []);

  // Music: pick a theme by difficulty, start on the first tap or key press, and release the sound device when leaving.
  useEffect(() => {
    battleAudio.setAuto(pickAutoTrack({ id: seed, cpu: true, cpuLevel: difficulty }));
    const go = () => void battleAudio.unlock();
    go();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      battleAudio.stopAll();
    };
  }, [seed, difficulty]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { fastRef.current = fast; }, [fast]);

  const say = useCallback(
    (text: string, cls?: string, id?: number) => setLog((l) => [...l.slice(-60), { id: id ?? Math.random(), text, cls }]),
    [],
  );

  const handle = useCallback(
    (evs: Ev[]) => {
      const el = (s: 0 | 1) => (s === 0 ? meRef.current : foeRef.current);
      const nameOf = (s: 0 | 1) => activeOf(b, s).name;
      const float = (id: number, side: 0 | 1, text: string, cls: string) => {
        setFx((f) => [...f, { id, side, text, cls }]);
        window.setTimeout(() => setFx((f) => f.filter((x) => x.id !== id)), 1200);
      };
      const flash = (id: number, text: string, cls: string) => {
        setBanner({ id, text, cls });
        window.setTimeout(() => setBanner((x) => (x && x.id === id ? null : x)), 1000);
      };
      for (const e of evs) {
        switch (e.k) {
          case "send":
            cue({ id: e.id, kind: "switch", side: e.side === 0 ? "p1" : "p2" });
            say(`${e.side === 0 ? t("আপনি পাঠালেন", "You sent out") : t("CPU পাঠাল", "CPU sent out")} ${e.mon}!`, undefined, e.id);
            break;
          case "use":
            cue({ id: e.id, kind: "move", side: e.side === 0 ? "p2" : "p1", from: e.side === 0 ? "p1" : "p2", moveName: e.move, moveType: e.type, cat: e.cat });
            say(`${e.mon} → ${e.move}`, undefined, e.id);
            el(e.side)?.animate(
              [{ transform: "translate(0,0)" }, { transform: e.side === 0 ? "translate(22%,-14%) scale(1.06)" : "translate(-22%,12%) scale(1.06)", offset: 0.35 }, { transform: "translate(0,0)" }],
              { duration: 380, easing: "ease-out" },
            );
            break;
          case "dmg": {
            el(e.side)?.animate([{ transform: "translateX(0)", filter: "brightness(1)" }, { transform: "translateX(-5%)", filter: "brightness(2.2)", offset: 0.25 }, { transform: "translateX(4%)", offset: 0.5 }, { transform: "translateX(0)", filter: "brightness(1)" }], { duration: 340 });
            float(e.id, e.side, `-${e.amount}`, "");
            const cls = e.crit ? "crit" : e.mult > 1 ? "se" : e.mult < 1 ? "nve" : "";
            cue({ id: e.id, kind: "hit", side: e.side === 0 ? "p1" : "p2", amount: e.amount, effect: cls ? (cls as "crit" | "se" | "nve") : null });
            if (cls) {
              const text = e.crit ? t("ক্রিটিক্যাল!", "CRITICAL!") : e.mult > 1 ? t("খুব কার্যকর!", "SUPER EFFECTIVE!") : t("কম কার্যকর", "Not very effective");
              flash(e.id, text, cls);
              say(text, undefined, e.id + 0.1);
            }
            break;
          }
          case "miss": cue({ id: e.id, kind: "miss" }); say(`${e.move} ${t("লক্ষ্যভ্রষ্ট হল!", "missed!")}`, undefined, e.id); break;
          case "dodge": cue({ id: e.id, kind: "miss" }); say(`${e.mon} ${t("আঘাত এড়িয়ে গেল!", "avoided the attack!")}`, undefined, e.id); break;
          case "immune": say(`${e.mon} ${t("অক্ষত!", "is unaffected!")}`, undefined, e.id); break;
          case "heal": cue({ id: e.id, kind: "heal", side: e.side === 0 ? "p1" : "p2" }); float(e.id, e.side, `+${e.amount}`, "heal"); break;
          case "ability": {
            cue({ id: e.id, kind: "ability" });
            const msg: Record<string, [string, string]> = {
              trigger: ["অ্যাবিলিটি সক্রিয়!", "activated!"],
              trace: ["অ্যাবিলিটি কপি করল!", "traced it!"],
              survive: ["টিকে গেল!", "hung on!"],
              absorb: ["শুষে নিল!", "absorbed it!"],
              boost: ["শক্তি বাড়ল!", "powered up!"],
              negate: ["আঘাত ঠেকিয়ে দিল!", "shrugged it off!"],
            };
            const m = msg[e.what];
            say(`${e.mon}'s ${e.ability}: ${t(m[0], m[1])}`, undefined, e.id);
            break;
          }
          case "status": {
            cue({ id: e.id, kind: "status" });
            const msg: Record<Status, [string, string]> = {
              brn: ["পুড়ে গেল!", "was burned!"], psn: ["বিষে আক্রান্ত!", "was poisoned!"], par: ["প্যারালাইসড — ধীর হল!", "is paralysed — slowed!"],
              slp: ["ঘুমিয়ে পড়ল!", "fell asleep!"], cnf: ["বিভ্রান্ত হল!", "became confused!"], inf: ["মোহে পড়ল!", "fell in love!"],
            };
            say(`${e.mon} ${t(msg[e.status][0], msg[e.status][1])}`, undefined, e.id);
            float(e.id, e.side, STATUS_LABEL[e.status][lg === "en" ? "en" : "bn"], "nve");
            break;
          }
          case "cure": say(`${e.mon} ${e.why === "wake" ? t("জেগে উঠল!", "woke up!") : t("সুস্থ হল!", "recovered!")}`, undefined, e.id); break;
          case "stage": {
            const up = e.n > 0;
            cue({ id: e.id, kind: "boost", up });
            say(`${e.mon}'s ${STAT_SHORT[e.stat]} ${up ? t("বাড়ল", "rose") : t("কমল", "fell")}${Math.abs(e.n) > 1 ? t(" অনেক", " sharply") : ""}!`, undefined, e.id);
            float(e.id, e.side, `${STAT_SHORT[e.stat]} ${up ? "+" : ""}${e.n}`, up ? "heal" : "nve");
            break;
          }
          case "weather":
            if (e.w) cue({ id: e.id, kind: "weather" });
            say(e.w ? `${t(WEATHER_LABEL[e.w].bn, WEATHER_LABEL[e.w].en)} ${t("শুরু হল", "began")}` : t("আবহাওয়া শান্ত হল।", "The weather cleared."), undefined, e.id);
            break;
          case "chip": {
            const why: Record<string, [string, string]> = {
              brn: ["পোড়ার ক্ষতি পেল", "is hurt by its burn"], psn: ["বিষের ক্ষতি পেল", "is hurt by poison"], sand: ["বালিঝড়ে আহত", "is buffeted by the sandstorm"],
              hail: ["শিলায় আহত", "is pelted by hail"], recoil: ["রিকয়েল ক্ষতি পেল", "is hit by recoil"], ability: ["HP হারাল", "lost HP"],
              sudden: ["সাডেন ডেথে ক্ষয় হল", "is worn down (sudden death)"],
              reflect: ["ফেরত আসা ক্ষতি পেল", "was hurt by the reflected damage"], confusion: ["বিভ্রান্ত হয়ে নিজেকেই আঘাত করল", "hurt itself in its confusion"], aftermath: ["আফটারম্যাথে আহত", "was hurt by Aftermath"],
            };
            say(`${nameOf(e.side)} ${t(why[e.why][0], why[e.why][1])} (-${e.amount})`, undefined, e.id);
            cue({ id: e.id, kind: "hit", amount: Math.min(e.amount, 12), effect: null });
            float(e.id, e.side, `-${e.amount}`, "nve");
            break;
          }
          case "skip": {
            const why: Record<string, [string, string]> = {
              inf: ["মোহে চাল দিতে পারল না!", "is too in love to move!"],
              cnf: ["বিভ্রান্তিতে চাল ব্যর্থ!", "is confused — the move failed!"],
              par: ["প্যারালাইসিসে নড়তে পারল না!", "is paralysed — it can't move!"],
              slp: ["গভীর ঘুমে আছে…", "is fast asleep…"],
            };
            say(`${e.mon} ${t(why[e.why][0], why[e.why][1])}`, undefined, e.id);
            break;
          }
          case "flinch": say(`${e.mon} ${t("থমকে গেল!", "flinched!")}`, undefined, e.id); break;
          case "reveal": {
            const msg = e.what === "item"
              ? e.value ? t(`${e.mon} দেখল: প্রতিপক্ষের আইটেম ${e.value}`, `${e.mon} frisked the foe: it holds ${e.value}`) : t(`${e.mon} দেখল: প্রতিপক্ষের কোনো আইটেম নেই`, `${e.mon} frisked the foe: no item`)
              : e.what === "move" ? t(`${e.mon} টের পেল: প্রতিপক্ষের সেরা চাল ${e.value}`, `${e.mon} senses the foe's best move: ${e.value}`)
              : e.value === "yes" ? t(`${e.mon} বিপদের আভাস পেল!`, `${e.mon} shudders — danger ahead!`) : t(`${e.mon} নিশ্চিন্ত`, `${e.mon} feels safe`);
            say(msg, undefined, e.id);
            break;
          }
          case "trapped":
            say(`${e.by} ${t("পথ আটকে রেখেছে — বদলানো যাবে না!", "blocks the way — you can't switch!")}`, "faint", e.id);
            flash(e.id, t("আটকা পড়েছেন!", "TRAPPED!"), "nve");
            break;
          case "faint": cue({ id: e.id, kind: "faint", side: e.side === 0 ? "p1" : "p2" }); say(`${e.mon} ${t("জ্ঞান হারাল!", "fainted!")}`, "faint", e.id); break;
          case "end":
            battleAudio.finish(e.winner === 0 ? "win" : "lose");
            say(e.winner === 0 ? t("🏆 আপনি জিতেছেন!", "🏆 You win!") : t("💀 CPU জিতেছে।", "💀 The CPU wins."), "win", e.id);
            window.setTimeout(() => setDone(true), 1300);
            break;
        }
      }
    },
    [say, t, lg, b, cue],
  );

  // first send-out
  useEffect(() => {
    handle(startBattle(b));
    bump();
    const id = window.setTimeout(() => setIntro(false), 1800);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show a round (or a replacement) one step at a time, with a pause after each so it can be followed.
  const run = useCallback(
    (gen: Generator<Ev[], void, void>) => {
      window.clearTimeout(timerRef.current);
      genRef.current = gen;
      setPhase("play");
      const step = () => {
        const g = genRef.current;
        if (!g) return;
        const r = g.next();
        if (r.done) {
          genRef.current = null;
          bump();
          if (b.winner === -1) setPhase(b.sides[0].needSwitch ? "forced" : "choose");
          return;
        }
        handle(r.value);
        bump();
        const hits = r.value.filter((e) => e.k === "dmg" || e.k === "status" || e.k === "stage" || e.k === "heal" || e.k === "chip").length;
        const faint = r.value.some((e) => e.k === "faint");
        const ms = (700 + hits * 250 + (faint ? 600 : 0)) * (fastRef.current ? 0.45 : 1);
        timerRef.current = window.setTimeout(step, ms);
      };
      step();
    },
    [b, handle],
  );
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // record the result once
  useEffect(() => {
    if (!done || recorded.current) return;
    recorded.current = true;
    const r = loadRecord();
    if (b.winner === 0) r.w += 1;
    else r.l += 1;
    saveRecord(r);
  }, [done, b]);

  const choose = useCallback(
    (c: Choice) => {
      if (phaseRef.current !== "choose" || b.winner !== -1) return;
      say(`— ${t("রাউন্ড", "Round")} ${b.round + 1} —`, "round", Math.random());
      run(playRound(b, c));
    },
    [b, run, say, t],
  );
  const doMove = useCallback(
    (i: number) => {
      const m = activeOf(b, 0);
      if (m.fainted || (m.moves[i] && m.moves[i].pp <= 0 && m.moves.some((x) => x.pp > 0))) return;
      choose({ kind: "move", i });
    },
    [b, choose],
  );
  const swap = useCallback(
    (i: number) => {
      if (b.winner !== -1) return;
      if (phaseRef.current === "forced") {
        if (canSwitch(b, 0, i) === "ok") run(playerReplace(b, i));
        return;
      }
      if (phaseRef.current !== "choose") return;
      const verdict = canSwitch(b, 0, i);
      if (verdict === "trapped") {
        const by = activeOf(b, 1).name;
        say(`${by} ${t("পথ আটকে রেখেছে — বদলানো যাবে না!", "blocks the way — you can't switch!")}`, "faint", Math.random());
        setBanner({ id: Math.random(), text: t("আটকা পড়েছেন!", "TRAPPED!"), cls: "nve" });
        window.setTimeout(() => setBanner(null), 1000);
      } else if (verdict === "ok") choose({ kind: "switch", idx: i });
    },
    [b, choose, run, say, t],
  );

  // auto-pilot: picks moves and replacements for you
  useEffect(() => {
    if (!auto || intro || done || b.winner !== -1) return;
    if (phase === "choose") {
      const id = window.setTimeout(() => choose(autoChoice(b)), fast ? 350 : 900);
      return () => window.clearTimeout(id);
    }
    if (phase === "forced") {
      const id = window.setTimeout(() => {
        const r = bestReplacement(b, 0);
        if (r >= 0) swap(r);
      }, fast ? 300 : 700);
      return () => window.clearTimeout(id);
    }
  }, [auto, intro, done, phase, fast, b, choose, swap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key >= "1" && e.key <= "4") doMove(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  const me = activeOf(b, 0);
  const op = activeOf(b, 1);
  const weather = activeWeather(b);
  const mySide = b.sides[0];
  const myTurn = phase === "choose" && !intro && !me.fainted && b.winner === -1;
  const forced = phase === "forced" && b.winner === -1;
  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [log.length]);
  const rate = b.winner === 0 ? rating(b) : null;
  const lowHp = !me.fainted && b.winner === -1 && me.hp / me.maxHp <= 0.2;
  useEffect(() => {
    battleAudio.lowHp(lowHp);
    return () => battleAudio.lowHp(false);
  }, [lowHp]);

  return (
    <section className="mx-auto max-w-5xl space-y-4 px-5 pb-24 pt-6 sm:px-8">
      <div className="pk-scene" data-weather={weather ? WEATHER_ATTR[weather] : ""} data-theme={theme} data-night={theme === 2 ? "1" : "0"}>
        <div className="pk-camera">
          <div className="pk-sky"><div className="pk-rays" /></div>
          <div className="pk-hills" />
          <div className="pk-floor" />
          <div className="pk-platform foe" />
          <div className="pk-platform me" />
          <div className="pk-tint" />
          <div className="pk-wx rain" /> <div className="pk-wx sun" /> <div className="pk-wx sand" /> <div className="pk-wx snow" /> <div className="pk-wx wind" />
          <MonView mon={op} side="foe" anim={foeRef} />
          <MonView mon={me} side="me" anim={meRef} back />
          {fx.map((f) => (
            <div key={f.id} className={`pk-float-num ${f.cls}`} style={{ left: f.side === 0 ? "27%" : "72%", top: f.side === 0 ? "56%" : "28%" }}>{f.text}</div>
          ))}
          {banner ? <div key={banner.id} className={`pk-banner ${banner.cls}`}>{banner.text}</div> : null}
        </div>
        <HpBox mon={op} side="foe" />
        <HpBox mon={me} side="me" />
        <div className="pk-field">
          <span>{t("রাউন্ড", "Round")} {phase === "play" ? Math.max(1, b.round) : b.round + 1}</span>
          <span>{t("CPU", "CPU")}: {t(DIFFICULTY[difficulty].bn, DIFFICULTY[difficulty].en)}</span>
          {b.weather.w ? <span>{t(WEATHER_LABEL[b.weather.w].bn, WEATHER_LABEL[b.weather.w].en)}{Number.isFinite(b.weather.t) ? ` · ${b.weather.t} ${t("রাউন্ড", "rounds")}` : ""}{weather ? "" : ` (${t("বাতিল", "negated")})`}</span> : null}
        </div>

        {intro ? (
          <div className="pk-vs" onClick={() => setIntro(false)} role="presentation">
            <div className="pk-vs-row">
              <div className="pk-vs-card">
                <Pic look={monLook(me)} back className="size-24 object-contain sm:size-36" />
                <span>{t("আপনি", "You")}</span>
              </div>
              <div className="pk-vs-mid">VS</div>
              <div className="pk-vs-card r">
                <Pic look={monLook(op)} className="size-24 object-contain sm:size-36" />
                <span>CPU</span>
              </div>
            </div>
          </div>
        ) : null}

        {done ? (
          <div className={`pk-result ${b.winner === 0 ? "win" : "lose"}`}>
            <div className="pk-result-inner">
              <div className={b.winner === 0 ? "pk-trophy" : "pk-skull"} aria-hidden="true">{b.winner === 0 ? "🏆" : "💀"}</div>
              <h2 className={`pk-big ${b.winner === 0 ? "win" : "lose"}`}>{b.winner === 0 ? t("জয়!", "VICTORY!") : t("হার!", "DEFEAT")}</h2>
              <p className="mt-3 font-sans text-sm text-white/85">
                {t("রাউন্ড", "Rounds")} {b.round} · {t("হিট", "Hits")} {b.stats.hits} · {t("ক্রিট", "Crits")} {b.stats.crits} · {t("সর্বোচ্চ আঘাত", "Biggest hit")} {b.stats.maxHit}
              </p>
              {rate?.flawless ? <p className="mt-2 font-display text-xl text-[#ffcb05]">👑 {t("ফ্ললেস ভিক্টরি — একজনও হারেনি!", "Flawless — nobody fainted!")}</p> : rate ? <p className="mt-2 font-sans text-sm text-white/85">{rate.survivors} {t("জন টিকে আছে", "survived")}</p> : null}
              <div className="mt-5 flex flex-wrap justify-center gap-2 font-sans text-sm">
                <button type="button" onClick={onRematch} className="pressable rounded-full bg-accent px-4 py-2 text-accent-fg">⚔️ {t("আবার লড়ুন", "Rematch")}</button>
                <button type="button" onClick={onExit} className="pressable rounded-full border border-white/40 px-4 py-2 text-white">{t("টিম বদলান", "Change team")}</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="pk-dock">
        <div className="flex flex-wrap items-center gap-2 font-sans text-xs">
          <span className={`pk-ribbon ${myTurn || forced ? "" : "opacity-60"}`} style={myTurn || forced ? undefined : { animation: "none" }}>
            {forced ? t("পরের পোকেমন বাছুন", "Choose your next Pokémon") : myTurn ? t(`${me.name} কী করবে?`, `What will ${me.name} do?`) : b.winner !== -1 ? t("লড়াই শেষ", "Battle over") : t("লড়াই চলছে…", "Battle in progress…")}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <MusicPanel />
            <button type="button" className="pk-gbtn" data-on={auto ? "1" : "0"} onClick={() => setAuto((a) => !a)}>
              <Bot className="mr-1 inline size-3.5" aria-hidden="true" />{t("অটো", "Auto")}
            </button>
            <button type="button" className="pk-gbtn" data-on={fast ? "1" : "0"} onClick={() => setFast((f) => !f)} title={t("দ্রুত চালান", "Play faster")}>⏩ {t("দ্রুত", "Fast")}</button>
            <button type="button" className="pk-gbtn" onClick={onExit}><Flag className="mr-1 inline size-3.5" aria-hidden="true" />{t("হার মানুন", "Forfeit")}</button>
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {me.moves.map((m, i) => {
            const r = damageRange(me, op, m, weather);
            const dead = me.fainted || m.pp <= 0;
            const pctLo = Math.min(100, Math.round((r.min / op.maxHp) * 100));
            const pctHi = Math.min(100, Math.round((r.max / op.maxHp) * 100));
            return (
              <button key={m.name} type="button" disabled={!myTurn || dead} onClick={() => doMove(i)} className="pk-move w-full" style={{ ["--c" as string]: TYPE_COLOR[m.type] ?? "#68a090" }}>
                <b className="flex items-center justify-between gap-2"><span className="truncate">{m.name}</span><span className="pk-kbd">{i + 1}</span></b>
                <small>
                  <TypeBadge type={m.type} small />
                  <span>{m.cat === 0 ? "⚔️" : "✴️"} {m.power}</span>
                  <span>PP {m.pp}/{m.max}</span>
                  {r.immune ? <span className="tag imm">×0</span> : r.mult > 1 ? <span className="tag se">×{r.mult}</span> : r.mult < 1 ? <span className="tag nve">×{r.mult}</span> : null}
                </small>
                <small>{r.immune ? (r.absorbs ? t("শুষে নেবে", "absorbed") : t("কাজ করবে না", "no effect")) : `≈ ${pctLo}–${pctHi}% ${t("HP", "HP")}`}</small>
              </button>
            );
          })}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {mySide.mons.map((m, i) => {
            const pct = Math.round((m.hp / m.maxHp) * 100);
            const active = i === mySide.active && !m.fainted;
            return (
              <button key={m.uid} type="button" disabled={m.fainted || active || b.winner !== -1 || (phase === "play") || (phase === "choose" && !myTurn)} onClick={() => swap(i)} className={`pressable flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left font-sans text-xs ${active ? "border-lamp bg-surface-2" : "border-border bg-bg"} disabled:opacity-60`}>
                <Pic look={monLook(m)} still className="size-9 shrink-0 object-contain" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-fg">{m.name}</b>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct > 50 ? "#4cd964" : pct > 20 ? "#ffcc00" : "#ff3b30" }} />
                  </span>
                </span>
                <span className="text-[11px] text-muted">{m.fainted ? "✕" : active ? t("মাঠে", "In") : forced ? t("পাঠান", "Send") : t("বদলান", "Swap")}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[11px] text-muted">
          <span>⌨ 1–4 {t("চাল", "moves")} · {t("পোকেমন বদলালে সেই রাউন্ডের চাল যায়", "Switching uses your turn")}</span>
          {me.item ? <span>🎒 {me.item[0]}</span> : null}
          {me.curAbility ? <span title={abilitySummary(me.curAbility, lg)}>✦ {me.curAbility}</span> : null}
          {op.curAbility ? <span title={abilitySummary(op.curAbility, lg)}>🤖 {op.name}: ✦ {op.curAbility}</span> : null}
        </div>
      </div>

      <div ref={logRef} className="pk-log" aria-live="polite">
        {log.map((l) => (
          <p key={l.id} className={l.cls}>{l.text}</p>
        ))}
      </div>
    </section>
  );
}

function MonView({ mon, side, anim, back }: { mon: Mon; side: "me" | "foe"; anim: React.RefObject<HTMLDivElement | null>; back?: boolean }) {
  return (
    <div className={`pk-mon ${side}`} data-fainted={mon.fainted ? "1" : "0"} data-mega={mon.form === 1 || mon.form === 3 ? "1" : "0"}>
      <i className="pk-shadow" />
      <div ref={anim} className="pk-anim">
        <div className="pk-mon-inner"><Pic key={mon.uid} look={monLook(mon)} back={back} alt={mon.name} /></div>
      </div>
    </div>
  );
}

function HpBox({ mon, side }: { mon: Mon; side: "me" | "foe" }) {
  const { lang } = useT();
  const pct = Math.max(0, Math.round((mon.hp / mon.maxHp) * 100));
  const lvl = pct <= 20 ? "low" : pct <= 50 ? "mid" : "hi";
  return (
    <div className={`pk-hp ${side}`}>
      <div className="pk-hp-row">
        <span className="pk-hp-name">{mon.name}</span>
        <span style={{ opacity: 0.7 }}>Lv50</span>
        {mon.form > 0 ? <span className="pk-stat par" style={{ background: "#8338ec" }}>{FORM_LABEL[mon.form][lang === "en" ? "en" : "bn"]}</span> : null}
      </div>
      <div className="pk-hp-row" style={{ flexWrap: "wrap", gap: 3, marginTop: 3 }}>
        {mon.status ? <span className="pk-stat" style={{ background: STATUS_LABEL[mon.status].color }}>{STATUS_LABEL[mon.status][lang === "en" ? "en" : "bn"]}</span> : null}
        {mon.vol.cnf > 0 ? <span className="pk-stat" style={{ background: STATUS_LABEL.cnf.color }}>{STATUS_LABEL.cnf[lang === "en" ? "en" : "bn"]}</span> : null}
        {mon.vol.inf > 0 ? <span className="pk-stat" style={{ background: STATUS_LABEL.inf.color }}>{STATUS_LABEL.inf[lang === "en" ? "en" : "bn"]}</span> : null}
        {(Object.keys(mon.stages) as Stat[]).filter((k) => mon.stages[k] !== 0).map((k) => (
          <span key={k} className={`pk-chip ${mon.stages[k] > 0 ? "up" : "down"}`}>{STAT_SHORT[k]} {mon.stages[k] > 0 ? "+" : ""}{mon.stages[k]}</span>
        ))}
      </div>
      <div className="pk-bar"><i data-lvl={lvl} style={{ ["--w" as string]: `${pct}%` }} /></div>
      <div className="pk-hp-row" style={{ justifyContent: "space-between", marginTop: 2, fontSize: 11, opacity: 0.9 }}>
        <span>{mon.hp}/{mon.maxHp}</span>
      </div>
    </div>
  );
}
