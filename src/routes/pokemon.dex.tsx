import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { GimmickPills, GIMMICK, PokeHeader, Sprite, StatBars, TypeBadge, useT } from "@/components/pokemon/ui";
import { pokeDex, pokeSpecies, type DexEntry, type SpeciesDetail } from "@/lib/pokemon-api";
import { TYPES, TYPE_COLOR } from "@/lib/pokemon/shared";

export const Route = createFileRoute("/pokemon/dex")({
  loader: async () => {
    try {
      return { list: (await pokeDex()).list, error: "" };
    } catch (e) {
      return { list: [] as DexEntry[], error: e instanceof Error ? e.message : "error" };
    }
  },
  component: DexPage,
});

const PAGE = 72;
const FORM_KINDS = ["mega", "primal", "ultra", "gmax"];
const GIMMICK_FILTERS = ["mega", "primal", "ultra", "gmax", "z", "zsig", "dyna", "tera"] as const;

/** The timeline of battle gimmicks. `sim` = can be used in this site's battles. */
const GUIDE: { icon: string; gen: string; bn: string; en: string; descBn: string; descEn: string; sim: boolean; note?: [string, string] }[] = [
  { icon: "🧬", gen: "Gen 6 · 2013", bn: "মেগা ইভোলিউশন", en: "Mega Evolution", sim: true,
    descBn: "মেগা স্টোন ধরে থাকা পোকেমন যুদ্ধের মাঝে মেগা রূপে বদলে যায় — নতুন স্ট্যাট, কখনও নতুন টাইপ বা অ্যাবিলিটি। প্রতি লড়াইয়ে একবার।",
    descEn: "A Pokémon holding its Mega Stone transforms mid-battle with new stats and sometimes a new type or ability. Once per battle." },
  { icon: "🌋", gen: "Gen 6–7", bn: "প্রাইমাল রিভার্শন ও আল্ট্রা বার্স্ট", en: "Primal Reversion & Ultra Burst", sim: true,
    descBn: "Kyogre ও Groudon অর্ব ধরে মাঠে নামলেই প্রাইমাল হয়; Necrozma আল্ট্রা বার্স্টে আলোর রূপ পায়।",
    descEn: "Kyogre and Groudon turn Primal the moment they enter holding their orb; Necrozma bursts into its Ultra form." },
  { icon: "✨", gen: "Gen 7 · 2016", bn: "জেড-মুভ", en: "Z-Moves", sim: true,
    descBn: "জেড-ক্রিস্টাল ধরে থাকলে একটি চাল মহা-শক্তিশালী জেড-মুভে বদলে যায়। কিছু পোকেমনের নিজস্ব সিগনেচার জেড-মুভ আছে। প্রতি লড়াইয়ে একবার।",
    descEn: "With a Z-Crystal, one move becomes a mighty Z-Move. Some Pokémon have signature Z-Moves. Once per battle." },
  { icon: "🔴", gen: "Gen 8 · 2019", bn: "ডায়ানাক্স ও গিগান্টাম্যাক্স", en: "Dynamax & Gigantamax", sim: true,
    descBn: "৩ টার্নের জন্য পোকেমন দানব হয়ে যায় — HP বেড়ে যায়, সব চাল ম্যাক্স-মুভ হয়ে যায়। কিছু পোকেমনের আছে বিশেষ গিগান্টাম্যাক্স রূপ ও জি-ম্যাক্স মুভ।",
    descEn: "For 3 turns your Pokémon becomes a giant: more HP and every move turns into a Max Move. Some have special Gigantamax forms and G-Max moves." },
  { icon: "💎", gen: "Gen 9 · 2022", bn: "টেরাস্টালাইজেশন", en: "Terastallization", sim: true,
    descBn: "যেকোনো পোকেমন ক্রিস্টালে ঢেকে নিজের টেরা-টাইপে বদলে যায়। টেরা-টাইপের চালের শক্তি বাড়ে। প্রতি লড়াইয়ে একবার।",
    descEn: "Any Pokémon can crystallize and change into its Tera Type, boosting moves of that type. Once per battle." },
  { icon: "⚡", gen: "Legends Z-A · 2025", bn: "মেগা-র প্রত্যাবর্তন ও জেড-মেগা", en: "Mega returns & Z-Mega forms", sim: false,
    descBn: "Legends Z-A-তে মেগা ইভোলিউশন ফিরে এসেছে, নতুন মেগা রূপসহ। Pokémon Champions-এ ২০২৬ সালের সেপ্টেম্বরে জেড-মেগা (যেমন Mega Lucario Z) আসে।",
    descEn: "Mega Evolution came back in Legends Z-A with brand-new Megas. Z-Mega forms (like Mega Lucario Z) reached Pokémon Champions in September 2026.",
    note: ["এই সাইটের লড়াইয়ে এখনও নেই — ইঞ্জিন সমর্থন দিলে যোগ হবে।", "Not in this site's battles yet — it depends on the battle engine adding support."] },
  { icon: "🌊", gen: "Gen 10 · 2027", bn: "জেন ১০ (Winds / Waves)", en: "Gen 10 (Winds / Waves)", sim: false,
    descBn: "২০২৬ সালের ফেব্রুয়ারিতে ঘোষিত, ২০২৭-এ আসছে। নতুন গিমিক নিয়ে এখনও শুধু গুজব ('Netsu' নাম শোনা যাচ্ছে) — অফিশিয়াল কিছু নেই।",
    descEn: "Announced in February 2026 for a 2027 release. The new gimmick is only rumour so far (the name 'Netsu' is floating around) — nothing official yet.",
    note: ["খেলা আসেনি, তাই লড়াইয়ে নেই।", "The game isn't out, so it can't be in battles."] },
];

function DexPage() {
  const { list, error } = Route.useLoaderData() as { list: DexEntry[]; error: string };
  const { t, te } = useT();
  const [q, setQ] = useState("");
  const [gen, setGen] = useState(0);
  const [type, setType] = useState("");
  const [gimmick, setGimmick] = useState("");
  const [forms, setForms] = useState(false);
  const [sort, setSort] = useState<"num" | "bst" | "name">("num");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = list.filter((e) => {
      const formKind = FORM_KINDS.includes(gimmick);
      if (!forms && !formKind && e.kind !== "base") return false;
      if (formKind) {
        if (e.kind !== gimmick) return false;
      } else if (gimmick && !e.g.includes(gimmick)) return false;
      if (gen && e.gen !== gen) return false;
      if (type && !e.t.includes(type)) return false;
      if (needle && !e.name.toLowerCase().includes(needle) && String(e.n) !== needle.replace("#", "")) return false;
      return true;
    });
    const bst = (e: DexEntry) => e.bs.reduce((a, b) => a + b, 0);
    if (sort === "bst") out.sort((a, b) => bst(b) - bst(a));
    else if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [list, q, gen, type, gimmick, forms, sort]);

  useEffect(() => setLimit(PAGE), [q, gen, type, gimmick, forms, sort]);

  const counts = useMemo(() => {
    const base = list.filter((e) => e.kind === "base");
    return { species: base.length, forms: list.length - base.length };
  }, [list]);

  return (
    <>
      <PokeHeader
        title={t("পোকেডেক্স", "Pokédex")}
        sub={t(
          "জেনারেশন ১ থেকে ৯-এর সব পোকেমন, তাদের মেগা, জেড-মুভ, গিগান্টাম্যাক্স/ডায়ানাক্স ও টেরা তথ্যসহ।",
          "Every Pokémon from Gen 1 to 9, with their Mega, Z-Move, Gigantamax/Dynamax and Tera info.",
        )}
      />
      <section className="mx-auto max-w-5xl px-5 pb-20 pt-6 sm:px-8">
        {error ? <p className="pk-card p-4 font-sans text-sm text-nsfw">{te(error)}</p> : null}

        <details open className="pk-card p-4 sm:p-5">
          <summary className="cursor-pointer font-display text-lg">{t("লড়াইয়ের গিমিক গাইড", "Battle gimmick guide")}</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {GUIDE.map((g, i) => (
              <article key={g.en} className="pk-rise rounded-xl border border-border bg-surface-2 p-3.5" style={{ ["--i" as string]: i }}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base">
                    <span className="mr-1.5">{g.icon}</span>
                    {t(g.bn, g.en)}
                  </h3>
                  <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 font-sans text-[11px] text-muted">{g.gen}</span>
                </div>
                <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted">{t(g.descBn, g.descEn)}</p>
                <p className="mt-2 font-sans text-xs">
                  {g.sim ? (
                    <span className="text-[#6df08a]">✔ {t("এই সাইটের লড়াইয়ে আছে", "Playable in this site's battles")}</span>
                  ) : (
                    <span className="text-lamp">⏳ {g.note ? t(g.note[0], g.note[1]) : ""}</span>
                  )}
                </p>
              </article>
            ))}
          </div>
        </details>

        <div className="pk-card mt-5 space-y-3 p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("নাম বা নম্বর খুঁজুন…", "Search by name or number…")}
              className="h-11 w-full rounded-lg border border-border bg-bg pl-9 pr-3 font-sans text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={gen === 0} onClick={() => setGen(0)}>{t("সব জেন", "All gens")}</Chip>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
              <Chip key={g} on={gen === g} onClick={() => setGen(gen === g ? 0 : g)}>{`G${g}`}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GIMMICK_FILTERS.map((g) => (
              <Chip key={g} on={gimmick === g} onClick={() => setGimmick(gimmick === g ? "" : g)}>
                {GIMMICK[g].icon} {t(GIMMICK[g].bn, GIMMICK[g].en)}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {TYPES.map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setType(type === tp ? "" : tp)}
                className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase text-white transition"
                style={{ background: TYPE_COLOR[tp], opacity: !type || type === tp ? 1 : 0.35 }}
              >
                {tp}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 font-sans text-sm text-muted">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={forms} onChange={(e) => setForms(e.target.checked)} />
              {t("সব ফর্ম দেখান (মেগা, আঞ্চলিক…)", "Show all forms (Mega, regional…)")}
            </label>
            <label className="flex items-center gap-2">
              {t("সাজান", "Sort")}
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-md border border-border bg-bg px-2 py-1">
                <option value="num">{t("নম্বর", "Number")}</option>
                <option value="bst">{t("মোট স্ট্যাট", "Total stats")}</option>
                <option value="name">{t("নাম", "Name")}</option>
              </select>
            </label>
            <span className="ml-auto text-xs text-subtle">
              {filtered.length} / {counts.species} {t("পোকেমন", "species")} · {counts.forms} {t("ফর্ম", "forms")}
            </span>
          </div>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtered.slice(0, limit).map((e, i) => (
            <li key={e.id} className="pk-rise" style={{ ["--i" as string]: i % 12 }}>
              <button
                type="button"
                onClick={() => setOpen(e.name)}
                className="pressable group flex h-full w-full flex-col items-center gap-1 rounded-xl border border-border bg-surface p-3 text-center hover:bg-surface-2"
              >
                <span className="self-start font-sans text-[11px] text-subtle">#{String(e.n).padStart(4, "0")}</span>
                <Sprite info={{ id: e.sp, num: e.n, types: e.t }} still className="h-20 w-20 object-contain transition group-hover:scale-110" />
                <span className="font-sans text-sm text-fg">{e.name}</span>
                <span className="flex gap-1">{e.t.map((x) => <TypeBadge key={x} type={x} small />)}</span>
                <GimmickPills tags={e.g} only={e.kind === "base" ? ["mega", "primal", "ultra", "gmax", "zsig"] : [e.kind]} />
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && !error ? <p className="py-12 text-center font-sans text-sm text-muted">{t("কিছু পাওয়া যায়নি", "Nothing found")}</p> : null}
        {limit < filtered.length ? (
          <div className="mt-6 text-center">
            <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="pressable rounded-full border border-border bg-surface px-6 py-2 font-sans text-sm hover:bg-surface-2">
              {t("আরও দেখান", "Show more")}
            </button>
          </div>
        ) : null}
      </section>
      {open ? <DetailModal name={open} onClose={() => setOpen(null)} onPick={setOpen} /> : null}
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable rounded-full border px-3 py-1 font-sans text-xs ${on ? "border-lamp bg-surface-2 text-fg" : "border-border bg-bg text-muted hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

function DetailModal({ name, onClose, onPick }: { name: string; onClose: () => void; onPick: (n: string) => void }) {
  const { t, te } = useT();
  const [d, setD] = useState<SpeciesDetail | null>(null);
  const [err, setErr] = useState("");
  const [shiny, setShiny] = useState(false);
  const [back, setBack] = useState(false);
  const [mq, setMq] = useState("");
  const [showMoves, setShowMoves] = useState(false);

  useEffect(() => {
    let live = true;
    setD(null);
    setErr("");
    pokeSpecies({ data: { name } })
      .then((r) => {
        if (!live) return;
        if (r) setD(r);
        else setErr(t("তথ্য পাওয়া যায়নি", "No data found"));
      })
      .catch((e) => live && setErr(e instanceof Error ? e.message : "error"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const e = d?.entry;
  const moves = useMemo(() => {
    const n = mq.trim().toLowerCase();
    return (d?.moves ?? []).filter((m) => !n || m.name.toLowerCase().includes(n) || m.type.toLowerCase().includes(n));
  }, [d, mq]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pk-pop relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-bg p-5 shadow-soft" onClick={(ev) => ev.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label={t("বন্ধ করুন", "Close")} className="pressable absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-surface-2">
          <X className="size-4" />
        </button>
        {err ? <p className="font-sans text-sm text-nsfw">{te(err)}</p> : null}
        {!d && !err ? <p className="py-16 text-center font-sans text-sm text-muted">{t("লোড হচ্ছে…", "Loading…")}</p> : null}
        {d && e ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid size-36 shrink-0 place-items-center rounded-2xl bg-surface-2">
                <Sprite info={{ id: e.sp, num: e.n, types: e.t }} back={back} shiny={shiny} className="max-h-32 max-w-32 object-contain" />
              </div>
              <div className="min-w-0">
                <p className="font-sans text-xs text-subtle">#{String(e.n).padStart(4, "0")} · Gen {e.gen}</p>
                <h2 className="font-display text-2xl">{e.name}</h2>
                <div className="mt-1 flex gap-1.5">{e.t.map((x) => <TypeBadge key={x} type={x} />)}</div>
                <p className="mt-2 font-sans text-xs text-muted">
                  {d.heightm} m · {d.weightkg} kg{d.eggGroups.length ? ` · ${d.eggGroups.join(", ")}` : ""}
                </p>
                <div className="mt-2 flex gap-2 font-sans text-xs">
                  <button type="button" onClick={() => setShiny((v) => !v)} className={`pressable rounded-full border px-3 py-1 ${shiny ? "border-lamp bg-surface-2" : "border-border"}`}>✨ Shiny</button>
                  <button type="button" onClick={() => setBack((v) => !v)} className={`pressable rounded-full border px-3 py-1 ${back ? "border-lamp bg-surface-2" : "border-border"}`}>↺ {t("পিছন", "Back")}</button>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 font-display text-base">{t("বেস স্ট্যাট", "Base stats")}</h3>
                <StatBars bs={e.bs} />
              </div>
              <div>
                <h3 className="mb-2 font-display text-base">{t("অ্যাবিলিটি", "Abilities")}</h3>
                <ul className="space-y-1.5 font-sans text-xs">
                  {d.abilities.map((a) => (
                    <li key={a.slot + a.name}>
                      <b className="text-fg">{a.name}</b>
                      {a.slot === "H" ? <span className="ml-1 rounded bg-surface-2 px-1 text-[10px] text-lamp">{t("গোপন", "Hidden")}</span> : null}
                      {a.desc ? <span className="block text-muted">{a.desc}</span> : null}
                    </li>
                  ))}
                </ul>
                {d.evoLine.length > 1 ? (
                  <>
                    <h3 className="mb-1 mt-4 font-display text-base">{t("বিবর্তন", "Evolution")}</h3>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-muted">{d.evoLine.join("\n")}</pre>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 font-display text-base">{t("গিমিক", "Gimmicks")}</h3>
              <ul className="space-y-2 font-sans text-[13px] text-muted">
                {d.megas.map((m) => (
                  <li key={m.name}>
                    {m.name.includes("Primal") ? "🌋" : m.name.includes("Ultra") ? "🌟" : "🧬"} <b className="text-fg">{m.name}</b>
                    {m.stone ? <span> — {m.stone.startsWith("move:") ? t("এই চাল লাগবে: ", "needs ") + m.stone.slice(6) : t("আইটেম: ", "item: ") + m.stone}</span> : null}
                  </li>
                ))}
                {d.gmax ? (
                  <li>
                    🦖 <b className="text-fg">{d.gmax.name}</b>
                    {d.gmax.move ? <span> — G-Max {d.gmax.move.replace("G-Max ", "")}</span> : null}
                  </li>
                ) : null}
                {d.zsig ? (
                  <li>
                    💠 <b className="text-fg">{d.zsig.move}</b> — {d.zsig.crystal}
                  </li>
                ) : null}
                {e.gen <= 7 ? <li>✨ {t("যেকোনো টাইপ-জেড ক্রিস্টাল ব্যবহার করতে পারে (জেন ৭ লড়াই)।", "Can use any type Z-Crystal (Gen 7 battles).")}</li> : null}
                {e.gen <= 8 ? <li>🔴 {t("জেন ৮ লড়াইয়ে ডায়ানাক্স করতে পারে।", "Can Dynamax in Gen 8 battles.")}</li> : null}
                <li>💎 {t("জেন ৯ লড়াইয়ে যেকোনো টেরা-টাইপে টেরাস্টালাইজ করতে পারে।", "Can Terastallize into any Tera Type in Gen 9 battles.")}</li>
              </ul>
            </div>

            {d.forms.length ? (
              <div className="mt-5">
                <h3 className="mb-2 font-display text-base">{t("অন্যান্য ফর্ম", "Other forms")}</h3>
                <div className="flex flex-wrap gap-2">
                  {d.forms.map((f) => (
                    <button key={f.id} type="button" onClick={() => onPick(f.name)} className="pressable flex w-24 flex-col items-center rounded-xl border border-border bg-surface p-2 text-center hover:bg-surface-2">
                      <Sprite info={{ id: f.sp, num: f.n, types: f.t }} still className="h-14 w-14 object-contain" />
                      <span className="font-sans text-[11px] leading-tight">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <button type="button" onClick={() => setShowMoves((v) => !v)} className="pressable font-display text-base underline-offset-4 hover:underline">
                {showMoves ? "▾" : "▸"} {t("শেখা যায় এমন চাল", "Learnable moves")} ({d.moves.length})
              </button>
              {showMoves ? (
                <div className="mt-2">
                  <input value={mq} onChange={(ev) => setMq(ev.target.value)} placeholder={t("চাল বা টাইপ খুঁজুন…", "Filter moves or types…")} className="mb-2 h-9 w-full rounded-lg border border-border bg-bg px-3 font-sans text-sm" />
                  <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border font-sans text-xs">
                    {moves.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 px-3 py-1.5">
                        <TypeBadge type={m.type} small />
                        <span className="flex-1 text-fg">{m.name}</span>
                        <span className="text-muted">{m.cat === "Status" ? "—" : m.cat === "Physical" ? "⚔️" : "✴️"}</span>
                        <span className="w-9 text-right tabular-nums text-muted">{m.bp || "—"}</span>
                        <span className="w-9 text-right tabular-nums text-muted">{m.acc ?? "∞"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
