/**
 * The Training Ground panel: change your own moves and gimmick (any move your Pokémon may have), set up to five
 * practice dummies (each with its own Pokémon, behaviour, gimmick and four moves), and read the damage numbers.
 */
import { useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { MEGAS, MOVES, ROSTER, TERA_TYPES, gimInfo, gimmicksFor, isOriginSpecies, type GimmickKind } from "@/lib/pokemon/arena-data";
import {
  MAX_DUMMIES,
  trainAdd,
  trainCast,
  trainDummy,
  trainGimmickNow,
  trainMovePool,
  trainPlayerGimmick,
  trainPlayerMove,
  trainRemove,
  trainReset,
  trainSet,
  type State,
} from "@/lib/pokemon/arena-engine";
import { TYPE_COLOR } from "@/lib/pokemon/shared";

export type TrainHud = {
  immortal: boolean;
  nocd: boolean;
  last: number;
  total: number;
  hits: number;
  dps: number;
  best: number;
  me: { species: string; gimmick: GimmickKind; mega: string; tera: string; moves: string[]; busy: boolean };
  dums: { key: number; species: string; mode: "idle" | "walk" | "fight"; gimmick: GimmickKind | "none"; mega: string; tera: string; moves: string[]; busy: boolean; alive: boolean }[];
};

type T2 = (bn: string, en: string) => string;

/** Every move a Pokémon can take, as chips to tap: the move goes into the chosen slot. */
function MoveGrid({ pool, current, slot, onSlot, onPick, t }: { pool: string[]; current: string[]; slot: number; onSlot: (i: number) => void; onPick: (id: string) => void; t: T2 }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return [...pool].filter((id) => !k || MOVES[id]!.name.toLowerCase().includes(k) || MOVES[id]!.type.toLowerCase().includes(k)).sort((a, b) => MOVES[a]!.type.localeCompare(MOVES[b]!.type) || MOVES[a]!.name.localeCompare(MOVES[b]!.name));
  }, [pool, q]);
  return (
    <div className="ab-mg">
      <div className="ab-mg-slots">
        {current.map((id, i) => (
          <button key={i} type="button" className={`ab-chip ${slot === i ? "on" : ""}`} style={{ borderColor: TYPE_COLOR[MOVES[id]?.type ?? ""] }} onClick={() => onSlot(i)}>
            {i + 1} · {MOVES[id]?.name ?? "?"}
          </button>
        ))}
      </div>
      <input className="ab-mg-q" placeholder={t("খুঁজুন…", "Search moves or types…")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="ab-mg-list">
        {list.map((id) => (
          <button key={id} type="button" className={`ab-mv ${current.includes(id) ? "has" : ""}`} onClick={() => onPick(id)} title={MOVES[id]!.desc}>
            <i style={{ background: TYPE_COLOR[MOVES[id]!.type] }} />
            {MOVES[id]!.name}
          </button>
        ))}
      </div>
      <small className="ab-mg-n">{list.length} {t("টি মুভ", "moves")} · {t("স্লট বেছে একটি মুভে চাপুন", "pick a slot, then tap a move")}</small>
    </div>
  );
}

const MODES: ["idle" | "walk" | "fight", string, string][] = [
  ["idle", "স্থির", "Still"],
  ["walk", "হাঁটে", "Walks"],
  ["fight", "লড়ে", "Fights"],
];

function GimmickPick({ species, kind, mega, tera, allowNone, onKind, onMega, onTera, t }: { species: string; kind: GimmickKind | "none"; mega: string; tera: string; allowNone: boolean; onKind: (k: GimmickKind | "none") => void; onMega: (m: string) => void; onTera: (c: string) => void; t: T2 }) {
  const kinds = gimmicksFor(species);
  const forms = MEGAS[species] ?? [];
  return (
    <>
      <div className="ab-train-row">
        {allowNone ? (
          <button type="button" className={`ab-chip ${kind === "none" ? "on" : ""}`} onClick={() => onKind("none")}>{t("নেই", "None")}</button>
        ) : null}
        {kinds.map((k) => {
          const info = gimInfo(k, isOriginSpecies(species));
          return (
            <button key={k} type="button" className={`ab-chip ${kind === k ? "on" : ""}`} onClick={() => onKind(k)} title={info.label}>
              {info.icon} {t(info.bn, info.short)}
            </button>
          );
        })}
      </div>
      {kind === "mega" && forms.length > 1 ? (
        <label className="ab-train-row">
          <span>{t("মেগা", "Mega")}</span>
          <select value={mega} onChange={(e) => onMega(e.target.value)}>
            {forms.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      ) : null}
      {kind === "tera" ? (
        <label className="ab-train-row">
          <span>{t("টেরা", "Tera")}</span>
          <select value={tera} onChange={(e) => onTera(e.target.value)}>
            {TERA_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      ) : null}
    </>
  );
}

export function TrainPanel({ hud, getS, t, onPhoto }: { hud: TrainHud; getS: () => State | null; t: T2; onPhoto: () => void }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"me" | "dums" | "stats">("me");
  const [slot, setSlot] = useState(0);
  const [all, setAll] = useState(false);
  const [sel, setSel] = useState(0);
  const run = (fn: (S: State) => void) => {
    const S = getS();
    if (S) fn(S);
  };
  const dsel = hud.dums[Math.min(sel, hud.dums.length - 1)];
  const mePool = useMemo(() => trainMovePool(hud.me.species, all), [hud.me.species, all]);
  const dPool = useMemo(() => (dsel ? trainMovePool(dsel.species, all) : []), [dsel?.species, all]); // eslint-disable-line react-hooks/exhaustive-deps
  const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onPointerMove: (e: React.PointerEvent) => e.stopPropagation(), onPointerUp: (e: React.PointerEvent) => e.stopPropagation(), onWheel: (e: React.WheelEvent) => e.stopPropagation() };
  return (
    <div className="ab-train" {...stop}>
      <div className="ab-train-top">
        <button type="button" className="ab-train-h" onClick={() => setOpen((o) => !o)}>{open ? "▾" : "▸"} {t("ট্রেনিং", "Training")}</button>
        <button type="button" className="ab-chip photo" onClick={onPhoto} title={t("ফটো মোড", "Photo mode")}><Camera size={12} /> {t("ফটো", "Photo")}</button>
      </div>
      {open ? (
        <>
          <div className="ab-train-tabs">
            {([["me", "আপনি", "You"], ["dums", "ডামি", "Dummies"], ["stats", "ফলাফল", "Stats"]] as const).map(([k, bn, en]) => (
              <button key={k} type="button" className={`ab-chip ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{t(bn, en)}</button>
            ))}
          </div>

          {tab === "me" ? (
            <>
              <div className="ab-train-sub">{t("আপনার জিমিক", "Your gimmick")}</div>
              <GimmickPick
                species={hud.me.species}
                kind={hud.me.gimmick}
                mega={hud.me.mega}
                tera={hud.me.tera}
                allowNone={false}
                onKind={(k) => k !== "none" && run((S) => trainPlayerGimmick(S, k, hud.me.mega, hud.me.tera))}
                onMega={(m) => run((S) => trainPlayerGimmick(S, "mega", m))}
                onTera={(c) => run((S) => trainPlayerGimmick(S, "tera", undefined, c))}
                t={t}
              />
              {hud.me.busy ? <small className="ab-mg-n">{t("জিমিক চলছে — শেষ হলে বদলান", "A gimmick is running: change it when it ends")}</small> : null}
              <div className="ab-train-sub">{t("আপনার মুভ", "Your moves")}</div>
              <MoveGrid pool={mePool} current={hud.me.moves} slot={slot} onSlot={setSlot} onPick={(id) => run((S) => trainPlayerMove(S, slot, id, all))} t={t} />
              <button type="button" className={`ab-chip ${all ? "on" : ""}`} onClick={() => setAll((v) => !v)}>{t("গেমের সব মুভ", "Every move in the game")}</button>
            </>
          ) : null}

          {tab === "dums" ? (
            <>
              <div className="ab-train-row ab-dumtabs">
                {hud.dums.map((d, i) => (
                  <button key={d.key} type="button" className={`ab-chip ${i === Math.min(sel, hud.dums.length - 1) ? "on" : ""} ${d.alive ? "" : "dead"}`} onClick={() => { setSel(i); setSlot(0); }}>
                    {i + 1}. {ROSTER.find((x) => x.id === d.species)?.name ?? d.species}
                  </button>
                ))}
                {hud.dums.length < MAX_DUMMIES ? <button type="button" className="ab-chip" onClick={() => run((S) => { trainAdd(S); setSel(hud.dums.length); })}>＋ {t("যোগ", "Add")}</button> : null}
              </div>
              {dsel ? (
                <>
                  <label className="ab-train-row">
                    <span>{t("পোকেমন", "Pokémon")}</span>
                    <select value={dsel.species} onChange={(e) => { run((S) => trainDummy(S, dsel.key, { species: e.target.value })); e.currentTarget.blur(); }}>
                      {ROSTER.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </label>
                  <div className="ab-train-row">
                    {MODES.map(([m, bn, en]) => (
                      <button key={m} type="button" className={`ab-chip ${dsel.mode === m ? "on" : ""}`} onClick={() => run((S) => trainDummy(S, dsel.key, { mode: m }))}>{t(bn, en)}</button>
                    ))}
                  </div>
                  <div className="ab-train-sub">{t("ডামির জিমিক", "Dummy gimmick")}</div>
                  <GimmickPick
                    species={dsel.species}
                    kind={dsel.gimmick}
                    mega={dsel.mega}
                    tera={dsel.tera}
                    allowNone
                    onKind={(k) => run((S) => trainDummy(S, dsel.key, { gimmick: k }))}
                    onMega={(m) => run((S) => trainDummy(S, dsel.key, { mega: m }))}
                    onTera={(c) => run((S) => trainDummy(S, dsel.key, { tera: c }))}
                    t={t}
                  />
                  <div className="ab-train-row">
                    {dsel.gimmick !== "none" ? (
                      <button type="button" className="ab-chip" disabled={dsel.busy} onClick={() => run((S) => trainGimmickNow(S, dsel.key))}>{t("জিমিক চালান", "Use gimmick now")}</button>
                    ) : null}
                    {hud.dums.length > 1 ? <button type="button" className="ab-chip" onClick={() => { run((S) => trainRemove(S, dsel.key)); setSel(0); }}>✕ {t("সরান", "Remove")}</button> : null}
                  </div>
                  <div className="ab-train-sub">{t("ডামির মুভ — চাপলে ছুড়ে", "Dummy moves — tap ▶ to fire one at you")}</div>
                  <div className="ab-train-row">
                    {dsel.moves.map((id, i) => (
                      <button key={i} type="button" className="ab-chip" onClick={() => run((S) => trainCast(S, dsel.key, i))} title={MOVES[id]?.desc}>▶ {MOVES[id]?.name}</button>
                    ))}
                  </div>
                  <MoveGrid pool={dPool} current={dsel.moves} slot={slot} onSlot={setSlot} onPick={(id) => run((S) => trainDummy(S, dsel.key, { slot, move: id }))} t={t} />
                </>
              ) : null}
            </>
          ) : null}

          {tab === "stats" ? (
            <>
              <div className="ab-train-row">
                <button type="button" className={`ab-chip ${hud.immortal ? "on" : ""}`} onClick={() => run((S) => trainSet(S, { immortal: !hud.immortal }))}>{t("ডামি মরে না", "Dummies can't faint")}</button>
                <button type="button" className={`ab-chip ${hud.nocd ? "on" : ""}`} onClick={() => run((S) => trainSet(S, { nocd: !hud.nocd }))}>{t("কুলডাউন নেই", "No cooldowns")}</button>
              </div>
              <div className="ab-train-row">
                <span>{t("সবার আচরণ", "All dummies")}</span>
                {MODES.map(([m, bn, en]) => (
                  <button key={m} type="button" className="ab-chip" onClick={() => run((S) => trainSet(S, { dummy: m }))}>{t(bn, en)}</button>
                ))}
              </div>
              <div className="ab-train-stats">
                <span>{t("শেষ আঘাত", "Last hit")}<b>{Math.round(hud.last)}</b></span>
                <span>{t("মোট", "Total")}<b>{Math.round(hud.total)}</b></span>
                <span>{t("আঘাত", "Hits")}<b>{hud.hits}</b></span>
                <span>DPS<b>{hud.dps.toFixed(1)}</b></span>
                <span>{t("সেরা DPS", "Best DPS")}<b>{hud.best.toFixed(1)}</b></span>
              </div>
              <button type="button" className="ab-chip" onClick={() => run((S) => trainReset(S))}>{t("রিসেট", "Reset")}</button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}


