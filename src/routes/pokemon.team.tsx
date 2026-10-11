import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Dices, Plus, Save, Search, Sparkles, Trash2, X } from "lucide-react";
import { GimmickPills, NATURES, PokeHeader, Sprite, StatBars, TypeBadge, useT } from "@/components/pokemon/ui";
import {
  deleteTeam,
  listTeams,
  pokeDex,
  pokeItems,
  pokeMoves,
  pokeRandomTeam,
  pokeSpecies,
  saveTeam,
  type DexEntry,
  type ItemInfo,
  type PokeTeam,
  type SpeciesDetail,
} from "@/lib/pokemon-api";
import { FORMATS, STAT_KEYS, STAT_LABEL, TYPES, TYPE_COLOR, formatByGen, matchups, suggestMoves, type MoveInfo, type PokeSet, type StatKey } from "@/lib/pokemon/shared";

export const Route = createFileRoute("/pokemon/team")({
  loader: () => listTeams(),
  component: TeamPage,
});

const emptyEvs = (): Record<StatKey, number> => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
type Draft = { id?: number; name: string; gen: number; sets: (PokeSet | null)[] };
const newDraft = (gen = 9): Draft => ({ name: "", gen, sets: [null, null, null, null, null, null] });
const slots = (sets: PokeSet[]): (PokeSet | null)[] => [...sets, ...Array(6 - sets.length).fill(null)].slice(0, 6);

function blankSet(e: DexEntry, gen: number): PokeSet {
  return {
    species: e.name,
    ability: gen >= 3 ? e.ab[0] ?? e.hidden : "",
    item: "",
    moves: [],
    nature: gen >= 3 ? "Hardy" : "",
    level: 100,
    teraType: gen === 9 ? e.t[0] : undefined,
    gigantamax: false,
    evs: emptyEvs(),
  };
}

const PRESETS: { bn: string; en: string; evs: Partial<Record<StatKey, number>> }[] = [
  { bn: "ফিজিক্যাল অ্যাটাকার", en: "Physical attacker", evs: { atk: 252, spe: 252, hp: 4 } },
  { bn: "স্পেশাল অ্যাটাকার", en: "Special attacker", evs: { spa: 252, spe: 252, hp: 4 } },
  { bn: "ট্যাঙ্ক", en: "Bulky tank", evs: { hp: 252, def: 128, spd: 128 } },
  { bn: "ব্যালান্সড", en: "Balanced", evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 } },
];

function TeamPage() {
  const initial = Route.useLoaderData();
  const { t, te } = useT();
  const [teams, setTeams] = useState<PokeTeam[]>(initial);
  const [draft, setDraft] = useState<Draft>(newDraft());
  const [slot, setSlot] = useState(0);
  const [dex, setDex] = useState<DexEntry[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const itemCache = useRef(new Map<number, ItemInfo[]>());
  const [items, setItems] = useState<ItemInfo[]>([]);

  useEffect(() => {
    pokeDex().then((r) => setDex(r.list)).catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : "error" }));
  }, []);
  useEffect(() => {
    const cached = itemCache.current.get(draft.gen);
    if (cached) return setItems(cached);
    pokeItems({ data: { gen: draft.gen } })
      .then((r) => {
        itemCache.current.set(draft.gen, r);
        setItems(r);
      })
      .catch(() => setItems([]));
  }, [draft.gen]);

  const refresh = useCallback(async () => setTeams(await listTeams()), []);
  const filled = draft.sets.filter((s): s is PokeSet => !!s);
  const fmt = formatByGen(draft.gen);

  const patch = (i: number, s: PokeSet | null) => setDraft((d) => ({ ...d, sets: d.sets.map((x, j) => (j === i ? s : x)) }));
  const firstFilled = draft.sets.findIndex(Boolean);
  const moveSlot = (from: number, to: number) => {
    setDraft((d) => {
      const next = [...d.sets];
      [next[from], next[to]] = [next[to], next[from]];
      return { ...d, sets: next };
    });
    setSlot(to);
  };

  async function onSave() {
    setMsg(null);
    if (!draft.name.trim()) return setMsg({ ok: false, text: t("টিমের একটি নাম দিন", "Give the team a name") });
    if (!filled.length) return setMsg({ ok: false, text: t("অন্তত একটি পোকেমন যোগ করুন", "Add at least one Pokémon") });
    setBusy(true);
    try {
      const r = await saveTeam({ data: { id: draft.id, name: draft.name, gen: draft.gen, sets: filled } });
      setDraft((d) => ({ ...d, id: r.id, sets: slots(r.sets) }));
      await refresh();
      setMsg({ ok: true, text: t("টিম সেভ হয়েছে ✔", "Team saved ✔") });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "error" });
    } finally {
      setBusy(false);
    }
  }

  async function onRandom() {
    setBusy(true);
    setMsg(null);
    try {
      const sets = await pokeRandomTeam({ data: { gen: draft.gen, size: 6 } });
      setDraft((d) => ({ ...d, sets: slots(sets), name: d.name || t("র‍্যান্ডম টিম", "Random team") }));
      setSlot(0);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "error" });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: number) {
    if (!window.confirm(t("টিমটি মুছে ফেলবেন?", "Delete this team?"))) return;
    await deleteTeam({ data: { id } });
    if (draft.id === id) setDraft(newDraft(draft.gen));
    await refresh();
  }

  function changeGen(gen: number) {
    if (gen === draft.gen) return;
    if (filled.length && !window.confirm(t("জেনারেশন বদলালে বর্তমান পোকেমনগুলো মুছে যাবে। চালিয়ে যাবেন?", "Changing the generation clears the current Pokémon. Continue?"))) return;
    setDraft((d) => ({ ...d, gen, sets: newDraft(gen).sets, id: d.id }));
    setSlot(0);
  }

  return (
    <>
      <PokeHeader
        title={t("টিম বানান", "Team builder")}
        sub={t(
          "নিজের পোকেমন, চাল, আইটেম ও গিমিক বেছে টিম সাজান। সেভ করা টিম লবি থেকে লড়াইয়ে নেওয়া যাবে — না চাইলে র‍্যান্ডম টিমও নেওয়া যায়।",
          "Pick your Pokémon, moves, items and gimmick, then save the team to use it in battles from the lobby. Prefer luck? Random teams work too.",
        )}
      />
      <section className="mx-auto grid max-w-5xl gap-5 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[250px_1fr]">
        <aside className="space-y-2">
          <button type="button" onClick={() => { setDraft(newDraft(draft.gen)); setSlot(0); setMsg(null); }} className="pressable flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/40 py-3 font-sans text-sm hover:bg-surface">
            <Plus className="size-4" /> {t("নতুন টিম", "New team")}
          </button>
          {teams.map((tm) => (
            <div key={tm.id} className={`pk-card p-2.5 ${draft.id === tm.id ? "border-lamp" : ""}`}>
              <button type="button" onClick={() => { setDraft({ id: tm.id, name: tm.name, gen: tm.gen, sets: slots(tm.sets) }); setSlot(0); setMsg(null); }} className="block w-full text-left">
                <span className="flex items-center justify-between gap-2 font-sans text-sm">
                  <b className="truncate">{tm.name}</b>
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">G{tm.gen}</span>
                </span>
                <span className="mt-1 flex">
                  {tm.sets.map((s, i) => (
                    <SpeciesIcon key={i} name={s.species} dex={dex} />
                  ))}
                </span>
              </button>
              <button type="button" onClick={() => void onRemove(tm.id)} className="pressable mt-1 flex items-center gap-1 font-sans text-[11px] text-subtle hover:text-nsfw">
                <Trash2 className="size-3" /> {t("মুছুন", "Delete")}
              </button>
            </div>
          ))}
          {teams.length === 0 ? <p className="px-1 font-sans text-xs text-subtle">{t("এখনও কোনো টিম নেই।", "No teams yet.")}</p> : null}
        </aside>

        <div className="space-y-4">
          <div className="pk-card flex flex-wrap items-end gap-3 p-4">
            <label className="min-w-40 flex-1 font-sans text-xs text-muted">
              {t("টিমের নাম", "Team name")}
              <input value={draft.name} maxLength={40} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg" />
            </label>
            <label className="font-sans text-xs text-muted">
              {t("জেনারেশন", "Generation")}
              <select value={draft.gen} onChange={(e) => changeGen(Number(e.target.value))} className="mt-1 h-10 rounded-lg border border-border bg-bg px-3 text-sm text-fg">
                {FORMATS.map((f) => (
                  <option key={f.gen} value={f.gen}>{`${t(f.bn, f.en)} — ${t(f.gimmickBn, f.gimmickEn)}`}</option>
                ))}
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => void onRandom()} className="pressable inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 font-sans text-sm">
              <Dices className="size-4" /> {t("র‍্যান্ডম ৬", "Random 6")}
            </button>
            <button type="button" disabled={busy} onClick={() => void onSave()} className="pressable inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg">
              <Save className="size-4" /> {t("সেভ", "Save")}
            </button>
            {msg ? <p className={`w-full font-sans text-sm ${msg.ok ? "text-[#6df08a]" : "text-nsfw"}`}>{te(msg.text)}</p> : null}
            <p className="w-full font-sans text-xs text-muted">
              {t("এই জেনারেশনের গিমিক: ", "Gimmick in this generation: ")}
              <b className="text-fg">{t(fmt.gimmickBn, fmt.gimmickEn)}</b>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {draft.sets.map((s, i) => {
              const e = s ? dex.find((x) => x.name === s.species) : null;
              return (
                <div key={i} className="relative">
                  <button type="button" onClick={() => setSlot(i)} className={`pressable flex aspect-square w-full flex-col items-center justify-center rounded-xl border bg-surface p-1 text-center ${slot === i ? "border-lamp shadow-soft" : "border-border"}`}>
                    {s ? (
                      <>
                        <Sprite info={e ? { id: e.sp, num: e.n, types: e.t } : null} still className="h-14 w-14 object-contain" />
                        <span className="w-full truncate font-sans text-[11px]">{s.species}</span>
                      </>
                    ) : (
                      <span className="font-sans text-2xl text-subtle">＋</span>
                    )}
                  </button>
                  {s && i === firstFilled ? <span className="pointer-events-none absolute left-1.5 top-1 font-sans text-[10px] font-bold text-lamp">★ {t("লিড", "Lead")}</span> : null}
                  {s ? (
                    <button type="button" aria-label={t("সরান", "Remove")} onClick={() => patch(i, null)} className="pressable absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-bg/80 text-subtle hover:text-nsfw">
                      <X className="size-3" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {draft.sets[slot] ? (
            <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-muted">
              <button type="button" disabled={slot === 0} onClick={() => moveSlot(slot, slot - 1)} className="pressable inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 disabled:opacity-40"><ArrowLeft className="size-3" /> {t("আগে আনুন", "Move earlier")}</button>
              <button type="button" disabled={slot === 5} onClick={() => moveSlot(slot, slot + 1)} className="pressable inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 disabled:opacity-40">{t("পরে নিন", "Move later")} <ArrowRight className="size-3" /></button>
              {slot !== firstFilled ? <button type="button" onClick={() => moveSlot(slot, 0)} className="pressable rounded-full border border-border bg-surface px-3 py-1">★ {t("লিড করুন", "Make lead")}</button> : null}
              <span className="text-subtle">{t("প্রথম পোকেমনই লড়াই শুরু করে।", "The first Pokémon starts the battle.")}</span>
            </div>
          ) : null}

          <SlotEditor
            key={`${slot}-${draft.gen}-${draft.sets[slot]?.species ?? "x"}`}
            gen={draft.gen}
            set={draft.sets[slot]}
            taken={new Set(filled.map((x) => x.species))}
            dex={dex}
            items={items}
            onChange={(s) => patch(slot, s)}
            onRandomOne={async () => {
              const r = await pokeRandomTeam({ data: { gen: draft.gen, size: 1 } });
              if (r[0]) patch(slot, r[0]);
            }}
          />
        </div>
      </section>
    </>
  );
}

function SpeciesIcon({ name, dex }: { name: string; dex: DexEntry[] }) {
  const e = dex.find((x) => x.name === name);
  return <Sprite info={e ? { id: e.sp, num: e.n, types: e.t } : { id: name.toLowerCase().replace(/[^a-z0-9]/g, ""), num: 0, types: [] }} still className="size-8 object-contain" />;
}

/* --------------------------------------------------------------- one slot */

type Opt = { key: string; label: string; sub?: string; badge?: string; color?: string };

function Picker({ value, options, onPick, placeholder, allowClear }: { value: string; options: Opt[]; onPick: (key: string) => void; placeholder: string; allowClear?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return options.filter((o) => !n || o.label.toLowerCase().includes(n) || (o.sub ?? "").toLowerCase().includes(n)).slice(0, 40);
  }, [options, q]);
  return (
    <div className="relative">
      <input
        value={open ? q : value}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQ(""); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-bg px-3 font-sans text-sm text-fg"
      />
      {open ? (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-surface shadow-soft">
          {allowClear && value ? (
            <li><button type="button" onMouseDown={(e) => { e.preventDefault(); onPick(""); setOpen(false); }} className="w-full px-3 py-1.5 text-left font-sans text-xs text-subtle hover:bg-surface-2">— ✕ —</button></li>
          ) : null}
          {shown.map((o) => (
            <li key={o.key}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); onPick(o.key); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-sans text-sm hover:bg-surface-2">
                {o.color ? <i className="size-2.5 shrink-0 rounded-full" style={{ background: o.color }} /> : null}
                {o.badge ? <span className="rounded bg-surface-2 px-1 text-[10px] text-lamp">{o.badge}</span> : null}
                <span className="flex-1 truncate">{o.label}</span>
                {o.sub ? <span className="truncate text-[11px] text-subtle">{o.sub}</span> : null}
              </button>
            </li>
          ))}
          {shown.length === 0 ? <li className="px-3 py-2 font-sans text-xs text-subtle">—</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

/** A visual grid of every Pokémon you can bring in this generation. */
function PokemonPicker({ gen, dex, taken, current, onPick, onRandom, onCancel }: { gen: number; dex: DexEntry[]; taken: Set<string>; current?: string; onPick: (e: DexEntry) => void; onRandom: () => void; onCancel?: () => void }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [fe, setFe] = useState(true);
  const [gim, setGim] = useState(false);
  const [sort, setSort] = useState<"num" | "bst" | "name">("num");
  const [limit, setLimit] = useState(48);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const gimTags = gen === 8 ? ["gmax"] : gen === 7 ? ["mega", "zsig", "ultra"] : gen === 6 ? ["mega", "primal"] : gen === 9 ? ["mega"] : [];
  const pool = useMemo(() => dex.filter((e) => e.gen <= gen && (e.kind === "base" || e.kind === "regional" || e.kind === "other")), [dex, gen]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase().replace("#", "");
    const bst = (e: DexEntry) => e.bs.reduce((a, b) => a + b, 0);
    const out = pool.filter(
      (e) =>
        (!fe || e.fe) &&
        (!type || e.t.includes(type)) &&
        (!gim || gimTags.some((g) => e.g.includes(g))) &&
        (!needle || e.name.toLowerCase().includes(needle) || String(e.n) === needle),
    );
    if (sort === "bst") out.sort((a, b) => bst(b) - bst(a));
    else if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, q, type, fe, gim, sort, gen]);
  useEffect(() => setLimit(48), [q, type, fe, gim, sort]);

  return (
    <div className="pk-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg">{t("পোকেমন বেছে নিন", "Choose a Pokémon")}</h3>
        <div className="flex gap-2">
          <button type="button" onClick={onRandom} className="pressable inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 font-sans text-xs">
            <Dices className="size-3.5" /> {t("র‍্যান্ডম", "Surprise me")}
          </button>
          {onCancel ? (
            <button type="button" onClick={onCancel} className="pressable rounded-full border border-border px-3 py-1.5 font-sans text-xs text-muted">✕ {t("বাতিল", "Cancel")}</button>
          ) : null}
        </div>
      </div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("নাম বা নম্বর লিখুন… (যেমন: Char)", "Type a name or number… (e.g. Char)")} className="h-11 w-full rounded-lg border border-border bg-bg pl-9 pr-3 font-sans text-sm" />
      </label>
      <div className="flex flex-wrap gap-1">
        {TYPES.map((tp) => (
          <button key={tp} type="button" onClick={() => setType(type === tp ? "" : tp)} className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase text-white transition" style={{ background: TYPE_COLOR[tp], opacity: !type || type === tp ? 1 : 0.35 }}>
            {tp}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 font-sans text-xs text-muted">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={fe} onChange={(e) => setFe(e.target.checked)} /> {t("শুধু পূর্ণ বিবর্তিত", "Fully evolved only")}</label>
        {gimTags.length ? (
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={gim} onChange={(e) => setGim(e.target.checked)} /> {t("এই জেনারেশনের গিমিক আছে", "Has this generation's gimmick")}</label>
        ) : null}
        <label className="flex items-center gap-1.5">
          {t("সাজান", "Sort")}
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-md border border-border bg-bg px-2 py-1 text-fg">
            <option value="num">{t("নম্বর", "Number")}</option>
            <option value="bst">{t("মোট স্ট্যাট", "Total stats")}</option>
            <option value="name">{t("নাম", "Name")}</option>
          </select>
        </label>
        <span className="ml-auto text-subtle">{shown.length} {t("টি", "found")}</span>
      </div>
      {dex.length === 0 ? <p className="py-8 text-center font-sans text-sm text-muted">{t("লোড হচ্ছে…", "Loading…")}</p> : null}
      <ul className="grid max-h-[62vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5">
        {shown.slice(0, limit).map((e) => (
          <li key={e.id}>
            <button type="button" data-taken={taken.has(e.name) && e.name !== current ? "1" : "0"} onClick={() => onPick(e)} className="pk-dexcard w-full">
              <span className="self-start pl-1 font-sans text-[10px] text-subtle">#{e.n}</span>
              <Sprite info={{ id: e.sp, num: e.n, types: e.t }} still className="h-16 w-16 object-contain" />
              <span className="w-full truncate px-1 font-sans text-[12px] text-fg">{e.name}</span>
              <span className="flex gap-0.5">{e.t.map((x) => <TypeBadge key={x} type={x} small />)}</span>
              <span className="font-sans text-[10px] text-subtle">{e.bs.reduce((a, b) => a + b, 0)}</span>
              <GimmickPills tags={e.g} only={gimTags} />
            </button>
          </li>
        ))}
      </ul>
      {limit < shown.length ? (
        <div className="text-center">
          <button type="button" onClick={() => setLimit((n) => n + 48)} className="pressable rounded-full border border-border bg-surface px-5 py-1.5 font-sans text-sm hover:bg-surface-2">{t("আরও দেখান", "Show more")}</button>
        </div>
      ) : null}
    </div>
  );
}

function SlotEditor({ gen, set, dex, items, taken, onChange, onRandomOne }: { gen: number; set: PokeSet | null; dex: DexEntry[]; items: ItemInfo[]; taken: Set<string>; onChange: (s: PokeSet | null) => void; onRandomOne: () => Promise<void> }) {
  const { t } = useT();
  const [learn, setLearn] = useState<MoveInfo[]>([]);
  const [detail, setDetail] = useState<SpeciesDetail | null>(null);
  const [picking, setPicking] = useState(!set);
  const entry = set ? dex.find((x) => x.name === set.species) ?? null : null;

  useEffect(() => {
    if (!set) return setLearn([]);
    let live = true;
    pokeMoves({ data: { species: set.species, gen } }).then((r) => live && setLearn(r)).catch(() => live && setLearn([]));
    if (gen === 6 || gen === 7 || gen === 9) pokeSpecies({ data: { name: set.species } }).then((r) => live && setDetail(r)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [set?.species, gen]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveOptions = useMemo<Opt[]>(() => learn.map((m) => ({ key: m.name, label: m.name, sub: `${m.type} · ${m.bp || "—"}`, badge: m.cat === "Status" ? "S" : m.cat === "Physical" ? "P" : "SP", color: TYPE_COLOR[m.type] })), [learn]);
  const itemOptions = useMemo<Opt[]>(
    () => items.map((i) => ({ key: i.name, label: i.name, sub: i.desc.slice(0, 40), badge: i.kind === "mega" ? "🧬" : i.kind === "z" ? "✨" : i.kind === "orb" ? "🌋" : undefined })),
    [items],
  );

  const totalEv = set ? STAT_KEYS.reduce((a, k) => a + (set.evs[k] || 0), 0) : 0;
  const up = (p: Partial<PokeSet>) => set && onChange({ ...set, ...p });

  if (!set || picking) {
    return (
      <PokemonPicker
        gen={gen}
        dex={dex}
        taken={taken}
        current={set?.species}
        onCancel={set ? () => setPicking(false) : undefined}
        onPick={(e) => onChange(set ? { ...blankSet(e, gen), item: set.item } : blankSet(e, gen))}
        onRandom={() => void onRandomOne()}
      />
    );
  }
  const matchup = entry && gen >= 6 ? matchups(entry.t) : null;

  return (
    <div className="pk-card space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Sprite info={entry ? { id: entry.sp, num: entry.n, types: entry.t } : null} className="h-20 w-20 object-contain" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl">{set.species}</h3>
          <div className="mt-1 flex gap-1.5">{entry?.t.map((x) => <TypeBadge key={x} type={x} />)}</div>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row">
          <button type="button" onClick={() => setPicking(true)} className="pressable rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-sans text-xs">🔄 {t("পোকেমন বদলান", "Change")}</button>
          <button type="button" onClick={() => onChange(null)} className="pressable rounded-lg border border-border px-3 py-1.5 font-sans text-xs text-muted hover:text-nsfw">{t("সরান", "Remove")}</button>
        </div>
      </div>

      {entry ? (
        <div className="grid gap-4 rounded-xl border border-border bg-surface-2 p-3 sm:grid-cols-2">
          <StatBars bs={entry.bs} />
          {matchup ? (
            <div className="space-y-1.5 font-sans text-[11px] text-muted">
              <p><b className="text-fg">{t("দুর্বল:", "Weak to:")}</b> {matchup.weak.length ? matchup.weak.map(([tp, m]) => <span key={tp} className="mr-1.5 inline-flex items-center gap-0.5"><TypeBadge type={tp} small /><b className="text-nsfw">×{m}</b></span>) : "—"}</p>
              <p><b className="text-fg">{t("প্রতিরোধ:", "Resists:")}</b> {matchup.resist.length ? matchup.resist.map(([tp]) => <span key={tp} className="mr-1 inline-block"><TypeBadge type={tp} small /></span>) : "—"}</p>
              {matchup.immune.length ? <p><b className="text-fg">{t("ইমিউন:", "Immune:")}</b> {matchup.immune.map((tp) => <span key={tp} className="mr-1 inline-block"><TypeBadge type={tp} small /></span>)}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {gen >= 3 ? (
          <label className="font-sans text-xs text-muted">
            {t("অ্যাবিলিটি", "Ability")}
            <select value={set.ability} onChange={(e) => up({ ability: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg">
              {[...(entry?.ab ?? []), ...(entry?.hidden ? [entry.hidden] : [])].map((a) => <option key={a} value={a}>{a}{a === entry?.hidden ? " (H)" : ""}</option>)}
            </select>
          </label>
        ) : null}
        {gen >= 2 ? (
          <label className="font-sans text-xs text-muted">
            {t("আইটেম", "Item")}
            <Picker value={set.item} options={itemOptions} allowClear placeholder={t("আইটেম খুঁজুন…", "Search items…")} onPick={(k) => up({ item: k })} />
          </label>
        ) : null}
      </div>

      {gen === 6 || gen === 7 || gen === 9 ? (
        <div className="rounded-xl border border-border bg-surface-2 p-3 font-sans text-xs text-muted">
          {detail?.megas.length ? (
            <p className="flex flex-wrap items-center gap-2">
              🧬 {t("মেগা হতে চাইলে এই আইটেম দিন:", "To Mega Evolve, give it:")}
              {detail.megas.filter((m) => m.stone && !m.stone.startsWith("move:")).map((m) => (
                <button key={m.name} type="button" onClick={() => up({ item: m.stone })} className="pressable rounded-full border border-border bg-bg px-2.5 py-1 text-fg">{m.stone}</button>
              ))}
            </p>
          ) : null}
          {gen === 7 ? (
            <p className="mt-1">
              ✨ {t("জেড-মুভ চাইলে একটি জেড-ক্রিস্টাল দিন (আইটেম তালিকায় ✨ চিহ্নিত) এবং সেই টাইপের একটি আক্রমণ চাল রাখুন।", "For a Z-Move, give a Z-Crystal (marked ✨ in the item list) and keep an attacking move of that type.")}
              {detail?.zsig ? <button type="button" onClick={() => up({ item: detail.zsig!.crystal })} className="pressable ml-2 rounded-full border border-border bg-bg px-2.5 py-1 text-fg">💠 {detail.zsig.crystal}</button> : null}
            </p>
          ) : null}
          {!detail?.megas.length ? <p>{t("এই পোকেমনের মেগা রূপ নেই।", "This Pokémon has no Mega form.")}</p> : null}
        </div>
      ) : null}

      {gen === 8 && entry?.g.includes("gmax") ? (
        <label className="flex items-center gap-2 font-sans text-sm">
          <input type="checkbox" checked={!!set.gigantamax} onChange={(e) => up({ gigantamax: e.target.checked })} />
          🦖 {t("গিগান্টাম্যাক্স রূপ ব্যবহার করুন", "Use its Gigantamax form")}
        </label>
      ) : null}
      {gen === 9 ? (
        <label className="block font-sans text-xs text-muted">
          💎 {t("টেরা-টাইপ", "Tera Type")}
          <select value={set.teraType} onChange={(e) => up({ teraType: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg sm:w-60">
            {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </label>
      ) : null}

      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2 font-sans text-xs text-muted">
          <span>{t("চাল (১–৪টি)", "Moves (1–4)")}</span>
          <button type="button" disabled={!learn.length || !entry} onClick={() => entry && up({ moves: suggestMoves(learn, entry.t, entry.bs[1] >= entry.bs[3]) })} className="pressable inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-fg disabled:opacity-40">
            <Sparkles className="size-3" /> {t("সেরা চাল বেছে দিন", "Suggest moves")}
          </button>
          {set.moves.length ? <button type="button" onClick={() => up({ moves: [] })} className="pressable text-subtle hover:text-nsfw">{t("মুছুন", "Clear")}</button> : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Picker
              key={i}
              value={set.moves[i] ?? ""}
              options={moveOptions}
              allowClear
              placeholder={`${t("চাল", "Move")} ${i + 1}`}
              onPick={(k) => {
                const next = [...set.moves];
                if (k) next[i] = k;
                else next.splice(i, 1);
                up({ moves: next.filter(Boolean).filter((m, j, a) => a.indexOf(m) === j) });
              }}
            />
          ))}
        </div>
        {learn.length === 0 ? <p className="mt-1 font-sans text-[11px] text-subtle">{t("চালের তালিকা লোড হচ্ছে…", "Loading move list…")}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        {gen >= 3 ? (
          <label className="font-sans text-xs text-muted">
            {t("নেচার", "Nature")}
            <select value={set.nature} onChange={(e) => up({ nature: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg">
              {NATURES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        ) : <span />}
        <label className="font-sans text-xs text-muted">
          {t("লেভেল", "Level")}
          <input type="number" min={1} max={100} value={set.level} onChange={(e) => up({ level: Math.max(1, Math.min(100, Number(e.target.value) || 100)) })} className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg" />
        </label>
      </div>

      {gen >= 3 ? (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2 font-sans text-xs text-muted">
            <span>EV ({totalEv}/510)</span>
            {PRESETS.map((p) => (
              <button key={p.en} type="button" onClick={() => up({ evs: { ...emptyEvs(), ...p.evs } })} className="pressable rounded-full border border-border bg-surface-2 px-2.5 py-1 text-fg">{t(p.bn, p.en)}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STAT_KEYS.map((k) => (
              <label key={k} className="font-sans text-[11px] text-muted">
                {STAT_LABEL[k]}
                <input type="number" min={0} max={252} step={4} value={set.evs[k]} onChange={(e) => up({ evs: { ...set.evs, [k]: Math.max(0, Math.min(252, Number(e.target.value) || 0)) } })} className="mt-0.5 h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm text-fg" />
              </label>
            ))}
          </div>
          {totalEv > 510 ? <p className="mt-1 font-sans text-xs text-nsfw">{t("মোট ৫১০-এর বেশি হলে সেভের সময় কমিয়ে নেওয়া হবে।", "Over 510 total will be scaled down when saving.")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
