import { useEffect, useMemo, useState } from "react";
import { TypeIcon } from "@/components/pokemon/type-icons";
import { useT } from "@/components/pokemon/ui";
import { MOVES, cleanMoves, movePool, speciesOf, type MoveKind } from "@/lib/pokemon/arena-data";
import { TYPE_COLOR } from "@/lib/pokemon/shared";

const KIND: Record<MoveKind, [string, string]> = {
  proj: ["গুলি", "Shot"],
  spread: ["ছড়ানো গুলি", "Fan of shots"],
  homing: ["হোমিং", "Homing"],
  beam: ["রশ্মি", "Beam"],
  dash: ["ছুটে আঘাত", "Rush"],
  burrow: ["মাটির নিচে", "Burrow"],
  nova: ["চারদিকে বিস্ফোরণ", "Burst"],
  lob: ["নিক্ষেপ", "Lob"],
  bolt: ["লম্বা রেখা", "Bolt"],
  guard: ["ঢাল", "Guard"],
  heal: ["আরোগ্য", "Heal"],
  buff: ["শক্তি বাড়ায়", "Buff"],
  grab: ["ধরে ছুঁড়ে মারে", "Grab & throw"],
};

const KEY = "arena-moves-v1";
/** The moves chosen earlier for each Pokémon on this device. */
export const loadMoves = (species: string): string[] => {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string[]>;
    return [...cleanMoves(species, all[species])];
  } catch {
    return [...cleanMoves(species, null)];
  }
};
export const saveMoves = (species: string, moves: string[]) => {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string[]>;
    all[species] = moves;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
};

/** Four move slots; "Choose moves" opens a small window to swap them for others the Pokémon can learn. */
export function MovePicker({ species, moves, onChange }: { species: string; moves: string[]; onChange: (m: string[]) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState(0);
  const cur = cleanMoves(species, moves);
  const def = speciesOf(species).moves;
  const pool = movePool(species);
  const isDefault = cur.every((m, i) => m === def[i]);
  const own = speciesOf(species).types;
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState<"all" | "stab" | "hit" | "area" | "support">("all");
  const [order, setOrder] = useState<"default" | "power" | "cd">("default");
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let l = pool.filter((id) => {
      const mv = MOVES[id]!;
      if (ql && !mv.name.toLowerCase().includes(ql) && !mv.type.toLowerCase().startsWith(ql)) return false;
      if (flt === "stab") return own.includes(mv.type);
      if (flt === "hit") return ["proj", "spread", "homing", "beam", "bolt", "lob"].includes(mv.kind);
      if (flt === "area") return ["nova", "dash", "burrow"].includes(mv.kind);
      if (flt === "support") return ["guard", "heal", "buff"].includes(mv.kind);
      return true;
    });
    if (order === "power") l = [...l].sort((a, b) => MOVES[b]!.power - MOVES[a]!.power);
    if (order === "cd") l = [...l].sort((a, b) => MOVES[a]!.cd - MOVES[b]!.cd);
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.join(","), q, flt, order, own.join(",")]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const put = (id: string) => {
    const next = [...cur];
    const from = next.indexOf(id);
    if (from === slot) return;
    if (from >= 0) next[from] = next[slot]!; // already equipped: swap places
    next[slot] = id;
    onChange(next);
    setSlot((slot + 1) % 4);
  };

  return (
    <div className="mp">
      <div className="mp-row">
        <b>{t("চাল বাছাই", "Moves")}</b>
        <button type="button" className="ab-chip" onClick={() => setOpen(true)}>{t("চাল বদলান", "Choose moves")}</button>
        {!isDefault ? <button type="button" className="ab-chip" onClick={() => onChange([...def])}>{t("ডিফল্ট", "Reset")}</button> : null}
      </div>
      <div className="mp-slots">
        {cur.map((id, i) => {
          const mv = MOVES[id]!;
          return (
            <button key={i} type="button" className="mp-slot" style={{ ["--c" as string]: TYPE_COLOR[mv.type] ?? "#fff" }} onClick={() => { setSlot(i); setOpen(true); }}>
              <TypeIcon type={mv.type} size={16} />
              <span>{i + 1}. {mv.name}</span>
            </button>
          );
        })}
      </div>

      {open ? (
        <div className="mp-back" onClick={() => setOpen(false)}>
          <div className="mp-win" role="dialog" aria-label={t("চাল বাছাই", "Choose moves")} onClick={(e) => e.stopPropagation()}>
            <div className="mp-head">
              <b>{speciesOf(species).name}: {t("৪টি চাল", "pick 4 moves")}</b>
              <button type="button" className="ab-ic" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="mp-slots">
              {cur.map((id, i) => {
                const mv = MOVES[id]!;
                return (
                  <button key={i} type="button" className={`mp-slot ${slot === i ? "on" : ""}`} style={{ ["--c" as string]: TYPE_COLOR[mv.type] ?? "#fff" }} onClick={() => setSlot(i)}>
                    <TypeIcon type={mv.type} size={16} />
                    <span>{i + 1}. {mv.name}</span>
                  </button>
                );
              })}
            </div>
            <small className="mp-hint">{t(`স্লট ${slot + 1} বদলাচ্ছেন: নিচ থেকে একটি চাল ছুঁয়ে দিন।`, `Changing slot ${slot + 1}: tap a move below.`)}</small>
            <div className="mp-tools">
              <input className="rp-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("চাল বা টাইপ খুঁজুন…", "Search moves or types…")} aria-label="Search moves" />
              <button type="button" className="ab-chip" onClick={() => setOrder(order === "default" ? "power" : order === "power" ? "cd" : "default")}>
                {order === "default" ? t("সাজানো: ডিফল্ট", "Sort: default") : order === "power" ? t("সাজানো: ক্ষমতা", "Sort: power") : t("সাজানো: দ্রুত", "Sort: fastest")}
              </button>
            </div>
            <div className="rp-chips">
              {([["all", "সব", "All"], ["stab", "নিজের টাইপ", "Own type"], ["hit", "দূরের আঘাত", "Ranged"], ["area", "কাছের/ছুটে", "Close & rush"], ["support", "সহায়ক", "Support"]] as const).map(([k, bn, en]) => (
                <button key={k} type="button" className={`ab-chip ${flt === k ? "on" : ""}`} onClick={() => setFlt(k)}>{t(bn, en)}</button>
              ))}
              <span className="rp-count">{shown.length} / {pool.length}</span>
            </div>
            <div className="mp-pool">
              {shown.length === 0 ? <p className="rp-none">{t("কিছু পাওয়া যায়নি", "Nothing matches.")}</p> : null}
              {shown.map((id) => {
                const mv = MOVES[id]!;
                const at = cur.indexOf(id);
                return (
                  <button key={id} type="button" className={`mp-move ${at >= 0 ? "has" : ""}`} style={{ ["--c" as string]: TYPE_COLOR[mv.type] ?? "#fff" }} onClick={() => put(id)}>
                    <span className="mp-ic"><TypeIcon type={mv.type} size={20} /></span>
                    <span className="mp-info">
                      <b>{mv.name}{own.includes(mv.type) ? <i className="mp-stab">STAB</i> : null}{at >= 0 ? <em> · {at + 1}</em> : null}</b>
                      <small>{t((KIND[mv.kind] ?? [mv.kind, mv.kind])[0], (KIND[mv.kind] ?? [mv.kind, mv.kind])[1])} · {t("ক্ষমতা", "power")} {mv.power} · {mv.cd}s</small>
                      <small className="mp-desc">{mv.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mp-foot">
              <button type="button" className="ab-btn ghost" onClick={() => onChange([...def])}>{t("ডিফল্ট চাল", "Default moves")}</button>
              <button type="button" className="ab-btn" onClick={() => setOpen(false)}>{t("ঠিক আছে", "Done")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
