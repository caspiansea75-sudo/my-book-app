import { useEffect, useMemo, useRef, useState } from "react";
import { TypeIcon } from "@/components/pokemon/type-icons";
import { Sprite, useT } from "@/components/pokemon/ui";
import { sfx } from "@/components/pokemon/arena-sfx";
import { GMAX, LEGENDARY, MEGAS, ROSTER, type Species } from "@/lib/pokemon/arena-data";
import { TYPES } from "@/lib/pokemon/shared";

type Group = "all" | "legend" | "mega" | "gmax" | "recent";
const RECENT_KEY = "arena-recent-picks";
const loadRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const noteRecent = (id: string) => {
  try {
    const list = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
};

/**
 * The Pokémon chooser: a search box, quick filters (legendary, Mega, Gigantamax, recent, by type), a sort,
 * and a roster that scrolls inside its own box so the rest of the page stays put.
 */
export function RosterPicker({ pick, onPick, isLocked, hideLocked }: { pick: string; onPick: (id: string) => void; isLocked?: (s: Species) => boolean; hideLocked?: boolean }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [type, setType] = useState<string | null>(null);
  const [sort, setSort] = useState<"dex" | "name">("dex");
  const [recent, setRecent] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setRecent(loadRecent()), []);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let l = ROSTER.filter((s) => !(hideLocked && isLocked?.(s)));
    if (ql) l = l.filter((s) => s.name.toLowerCase().includes(ql) || s.id.includes(ql) || s.types.some((x) => x.toLowerCase().startsWith(ql)) || String(s.num) === ql);
    if (type) l = l.filter((s) => s.types.includes(type));
    if (group === "legend") l = l.filter((s) => LEGENDARY.has(s.id));
    else if (group === "mega") l = l.filter((s) => MEGAS[s.id]);
    else if (group === "gmax") l = l.filter((s) => GMAX.has(s.id));
    else if (group === "recent") l = recent.map((id) => l.find((s) => s.id === id)).filter(Boolean) as Species[];
    if (group !== "recent") l = [...l].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : a.num - b.num));
    return l;
  }, [q, group, type, sort, recent, isLocked, hideLocked]);

  // bring the chosen one into view when the list first shows
  useEffect(() => {
    box.current?.querySelector<HTMLElement>(".ab-card.on")?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (s: Species) => {
    sfx.pick();
    noteRecent(s.id);
    setRecent(loadRecent());
    onPick(s.id);
  };
  const random = () => {
    const pool = ROSTER.filter((s) => !isLocked?.(s));
    const s = pool[Math.floor(Math.random() * pool.length)]!;
    choose(s);
    setQ("");
    setGroup("all");
    setType(null);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(".ab-card.on")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  const groups: [Group, string, string][] = [
    ["all", "সব", "All"],
    ["recent", "সাম্প্রতিক", "Recent"],
    ["legend", "লিজেন্ডারি", "Legendary"],
    ["mega", "মেগা", "Mega"],
    ["gmax", "গিগান্টাম্যাক্স", "Gigantamax"],
  ];
  const cur = ROSTER.find((s) => s.id === pick);

  return (
    <div className="rp">
      <div className="rp-bar">
        <input className="rp-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("নাম বা টাইপ খুঁজুন…", "Search name, type or number…")} aria-label="Search" />
        <button type="button" className="ab-chip" onClick={random} title={t("এলোমেলো", "Random")}>🎲 {t("এলোমেলো", "Random")}</button>
        <button type="button" className="ab-chip" onClick={() => setSort(sort === "dex" ? "name" : "dex")}>{sort === "dex" ? "#" : "A–Z"}</button>
      </div>
      <div className="rp-chips">
        {groups.map(([g, bn, en]) => (
          <button key={g} type="button" className={`ab-chip ${group === g ? "on" : ""}`} onClick={() => setGroup(g)}>{t(bn, en)}</button>
        ))}
      </div>
      <div className="rp-chips rp-types">
        {TYPES.map((ty) => (
          <button key={ty} type="button" className={`ab-chip ty ${type === ty ? "on" : ""}`} onClick={() => setType(type === ty ? null : ty)} title={ty} aria-label={ty}>
            <TypeIcon type={ty} size={18} />
          </button>
        ))}
      </div>
      <div className="rp-count">
        {cur ? <span>{t("বাছাই", "Selected")}: <b>{cur.name}</b></span> : null}
        <span>{list.length} / {ROSTER.length}</span>
      </div>
      <div className="ab-roster rp-grid" ref={box}>
        {list.map((s) => {
          const locked = !!isLocked?.(s);
          return (
            <button key={s.id} type="button" disabled={locked} className={`ab-card ${pick === s.id ? "on" : ""} ${locked ? "lock" : ""}`} onClick={() => choose(s)}>
              <Sprite info={{ id: s.id, num: s.num, types: s.types }} still alt={s.name} />
              <b>{locked ? "???" : s.name}</b>
              <span style={{ display: "flex", gap: 2 }}>{s.types.map((ty) => <TypeIcon key={ty} type={ty} size={14} />)}</span>
              {locked ? <small style={{ fontSize: 10, opacity: 0.8 }}>{t("ওয়েভ", "Wave")} {s.unlock}</small> : null}
              {!locked && LEGENDARY.has(s.id) ? <i className="rp-tag" title="Legendary">★</i> : null}
              {!locked && MEGAS[s.id] ? <i className="rp-tag m" title="Mega">M</i> : null}
            </button>
          );
        })}
        {list.length === 0 ? <p className="rp-none">{t("কিছু পাওয়া যায়নি", "Nothing matches.")}</p> : null}
      </div>
    </div>
  );
}
