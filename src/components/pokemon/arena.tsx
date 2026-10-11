import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Sprite, TypeBadge, useT } from "@/components/pokemon/ui";
import type { BattleView } from "@/lib/pokemon-api";
import { hpPercent, type BState, type Cue, type Mon, type SideId } from "@/lib/pokemon/protocol";
import {
  FLAWLESS_LINES,
  CLOSE_LINES,
  LOSE_LINES,
  WIN_LINES,
  TYPE_COLOR,
  guessSpriteId,
  pickLine,
  typeMult,
  type BattleRequest,
  type MoveInfo,
  type SpriteInfo,
} from "@/lib/pokemon/shared";

/* ============================================================ the scene */

type FxKind = "ring" | "mega" | "flash" | "zbeam" | "zaura" | "cloud" | "shards" | "sparks" | "arrow" | "label" | "num" | "banner" | "proj" | "aura" | "burst";
type Fx = { id: number; kind: FxKind; side?: SideId; to?: SideId; color?: string; text?: string; up?: boolean; extra?: string };

const CENTER = { me: { x: 27, y: 62 }, foe: { x: 72, y: 33 } };
let fxCounter = 0;
const weatherLabel: Record<string, string> = { RainDance: "🌧️ Rain", SunnyDay: "☀️ Sun", Sandstorm: "🌪️ Sand", Snow: "❄️ Snow", Hail: "🧊 Hail", DesolateLand: "🔥 Harsh Sun", PrimordialSea: "🌊 Heavy Rain", DeltaStream: "🌀 Delta Stream" };
const STATUS_LABEL: Record<string, string> = { brn: "BRN", par: "PAR", slp: "SLP", frz: "FRZ", psn: "PSN", tox: "TOX" };
const BOOST_LABEL: Record<string, string> = { atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe", accuracy: "Acc", evasion: "Eva" };

const spriteOf = (sprites: Record<string, SpriteInfo>, species: string): SpriteInfo => sprites[species] ?? { id: guessSpriteId(species), num: 0, types: [] };

export function BattleScene({ state, you, sprites, cue, children }: { state: BState; you: SideId | null; sprites: Record<string, SpriteInfo>; cue: Cue | null; children?: React.ReactNode }) {
  const mine: SideId = you ?? "p1";
  const foe: SideId = mine === "p1" ? "p2" : "p1";
  const meRef = useRef<HTMLDivElement>(null);
  const foeRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [fx, setFx] = useState<Fx[]>([]);

  useEffect(() => {
    if (!cue) return;
    const refOf = (s: SideId | undefined) => (s === mine ? meRef : foeRef).current;
    const add = (f: Omit<Fx, "id">, ms = 1700) => {
      const id = ++fxCounter;
      setFx((l) => [...l, { id, ...f }]);
      window.setTimeout(() => setFx((l) => l.filter((x) => x.id !== id)), ms);
    };
    const color = (type?: string) => TYPE_COLOR[type ?? ""] ?? "#ffffff";
    const jolt = (el: HTMLElement | null, frames: Keyframe[], ms: number) => el?.animate(frames, { duration: ms, easing: "ease-in-out" });
    switch (cue.kind) {
      case "move": {
        const from = cue.from ?? mine;
        const c = color(cue.moveType);
        const dir = from === mine ? { x: 42, y: -26 } : { x: -42, y: 26 };
        add({ kind: "label", side: from, text: cue.moveName, color: c }, 1500);
        if (cue.cat === "Special") {
          add({ kind: "proj", side: from, to: cue.side, color: c }, 800);
          jolt(refOf(from), [{ transform: "translate(0,0)" }, { transform: `translate(${-dir.x * 0.08}%, ${-dir.y * 0.08}%) scale(1.06)`, offset: 0.4 }, { transform: "translate(0,0)" }], 500);
        } else if (cue.cat === "Status") {
          add({ kind: "aura", side: from, color: c }, 1000);
          jolt(refOf(from), [{ transform: "scale(1)" }, { transform: "scale(1.12) translateY(-4%)", offset: 0.4 }, { transform: "scale(1)" }], 600);
        } else {
          jolt(refOf(from), [{ transform: "translate(0,0)" }, { transform: `translate(${dir.x}%, ${dir.y}%) scale(1.08)`, offset: 0.42 }, { transform: "translate(0,0)" }], 560);
        }
        break;
      }
      case "hit": {
        const side = cue.side;
        const c = color(cue.moveType);
        jolt(refOf(side), [
          { transform: "translateX(0)", filter: "brightness(1)" }, { transform: "translateX(-7%)", filter: "brightness(2.4)" }, { transform: "translateX(6%)", filter: "brightness(1)" },
          { transform: "translateX(-4%)", filter: "brightness(2)" }, { transform: "translateX(2%)", filter: "brightness(1)" }, { transform: "translateX(0)" },
        ], 480);
        if (cue.amount) add({ kind: "num", side, text: `−${cue.amount}%` }, 1200);
        add({ kind: "burst", side, color: c }, 800);
        if (cue.effect === "crit") {
          add({ kind: "banner", text: "CRITICAL HIT!", extra: "crit" }, 1300);
          sceneRef.current?.classList.remove("pk-shake");
          void sceneRef.current?.offsetWidth;
          sceneRef.current?.classList.add("pk-shake");
        } else if (cue.effect === "se") add({ kind: "banner", text: "SUPER EFFECTIVE!", extra: "se" }, 1300);
        else if (cue.effect === "nve") add({ kind: "banner", text: "not very effective…", extra: "nve" }, 1300);
        break;
      }
      case "faint":
        add({ kind: "ring", side: cue.side, color: "#9aa0a6" }, 1000);
        break;
      case "switch":
        jolt(refOf(cue.side), [{ transform: "scale(0.1)", filter: "brightness(4)", opacity: 0 }, { transform: "scale(1.18)", filter: "brightness(1.8)", opacity: 1, offset: 0.55 }, { transform: "scale(1)", filter: "brightness(1)", opacity: 1 }], 700);
        add({ kind: "ring", side: cue.side, color: "#ff4d4d" }, 1000);
        break;
      case "heal":
        add({ kind: "sparks", side: cue.side, color: "#6df08a" }, 1000);
        if (cue.amount) add({ kind: "num", side: cue.side, text: `+${cue.amount}%`, extra: "heal" }, 1200);
        break;
      case "boost":
        add({ kind: "arrow", side: cue.side, up: cue.up, text: cue.up ? "▲" : "▼" }, 1200);
        break;
      case "status":
        add({ kind: "label", side: cue.side, text: (cue.text ?? "").toUpperCase(), color: "#a040a0" }, 1400);
        break;
      case "mega":
        add({ kind: "flash", side: cue.side }, 1000);
        add({ kind: "mega", side: cue.side }, 1700);
        jolt(refOf(cue.side), [{ transform: "scale(1)", filter: "brightness(1)" }, { transform: "scale(0.7)", filter: "brightness(5)", offset: 0.4 }, { transform: "scale(1.2)", filter: "brightness(2)", offset: 0.75 }, { transform: "scale(1)", filter: "brightness(1)" }], 1500);
        break;
      case "zpower":
        add({ kind: "zaura", side: cue.side }, 1400);
        add({ kind: "zbeam", side: cue.side }, 1500);
        break;
      case "dynamax":
        add({ kind: "cloud", side: cue.side }, 1700);
        add({ kind: "flash", side: cue.side }, 1000);
        sceneRef.current?.classList.remove("pk-shake");
        void sceneRef.current?.offsetWidth;
        sceneRef.current?.classList.add("pk-shake");
        break;
      case "tera":
        add({ kind: "shards", side: cue.side, color: color(cue.type) }, 1700);
        add({ kind: "ring", side: cue.side, color: color(cue.type) }, 1100);
        add({ kind: "flash", side: cue.side }, 900);
        break;
      case "form":
        add({ kind: "flash", side: cue.side }, 700);
        break;
      case "ability":
      case "item":
        add({ kind: "label", side: cue.side, text: cue.text, color: "#3a86ff" }, 1500);
        break;
      case "miss":
        add({ kind: "label", side: cue.side, text: "MISS", color: "#7d8590" }, 1000);
        break;
      case "hazard":
        add({ kind: "label", side: cue.side, text: cue.text, color: "#b6a136" }, 1200);
        break;
      case "weather":
        if (cue.text) add({ kind: "banner", text: cue.text.replace(/([a-z])([A-Z])/g, "$1 $2"), extra: "turn" }, 1300);
        break;
      case "turn":
        add({ kind: "banner", text: `Turn ${cue.text}`, extra: "turn" }, 1100);
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.id]);

  const meMon = state.sides[mine].active;
  const foeMon = state.sides[foe].active;
  const night = false;
  return (
    <div ref={sceneRef} className="pk-scene" data-weather={state.weather} data-terrain={state.terrain} data-night={night ? "1" : "0"}>
      <div className="pk-ground-glow" />
      <div className="pk-platform foe" />
      <div className="pk-platform me" />
      <div className="pk-wx rain" /> <div className="pk-wx sun" /> <div className="pk-wx sand" /> <div className="pk-wx snow" /> <div className="pk-wx wind" />

      <FieldChips state={state} mine={mine} />
      <MonView mon={foeMon} side="foe" sprites={sprites} anim={foeRef} />
      <MonView mon={meMon} side="me" sprites={sprites} anim={meRef} back />
      <HpBox mon={foeMon} side="foe" exact={false} />
      <HpBox mon={meMon} side="me" exact />

      {fx.map((f) => (
        <FxView key={f.id} fx={f} mine={mine} />
      ))}
      {children}
    </div>
  );
}

function MonView({ mon, side, sprites, anim, back }: { mon: Mon | null; side: "me" | "foe"; sprites: Record<string, SpriteInfo>; anim: React.RefObject<HTMLDivElement | null>; back?: boolean }) {
  const info = mon ? spriteOf(sprites, mon.species) : null;
  return (
    <div
      className={`pk-mon ${side}`}
      data-empty={mon ? "0" : "1"}
      data-fainted={mon?.fainted ? "1" : "0"}
      data-dyna={mon?.dynamax && !mon.gmax ? "1" : "0"}
      data-gmax={mon?.dynamax && mon.gmax ? "1" : "0"}
      data-tera={mon?.tera ? "1" : "0"}
      data-mega={mon?.mega ? "1" : "0"}
      style={{ "--tera": TYPE_COLOR[mon?.tera ?? ""] ?? "#fff" } as CSSProperties}
    >
      <div ref={anim} className="pk-anim">
        <div className="pk-mon-inner">{info ? <Sprite info={info} back={back} alt={mon?.species} /> : null}</div>
      </div>
    </div>
  );
}

function HpBox({ mon, side, exact }: { mon: Mon | null; side: "me" | "foe"; exact: boolean }) {
  if (!mon) return null;
  const pct = hpPercent(mon);
  const lvl = pct <= 20 ? "low" : pct <= 50 ? "mid" : "hi";
  const boosts = Object.entries(mon.boosts).filter(([, v]) => v !== 0);
  return (
    <div className={`pk-hp ${side}`}>
      <div className="pk-hp-row">
        <span className="pk-hp-name">{mon.species}</span>
        <span style={{ opacity: 0.7 }}>
          {mon.gender === "M" ? "♂" : mon.gender === "F" ? "♀" : ""} Lv{mon.level}
        </span>
        {mon.status ? <span className={`pk-stat ${mon.status}`}>{STATUS_LABEL[mon.status] ?? mon.status}</span> : null}
        {mon.tera ? <span title={`Tera ${mon.tera}`}>💎</span> : null}
        {mon.mega ? <span title="Mega">🧬</span> : null}
        {mon.dynamax ? <span title={mon.gmax ? "Gigantamax" : "Dynamax"}>{mon.gmax ? "🦖" : "🔴"}</span> : null}
      </div>
      <div className="pk-bar">
        <i data-lvl={lvl} style={{ ["--w" as string]: `${pct}%` }} />
      </div>
      <div className="pk-hp-row" style={{ justifyContent: "space-between", marginTop: 2, fontSize: 11, opacity: 0.85 }}>
        <span>{exact && mon.maxHp !== 100 ? `${mon.hp}/${mon.maxHp}` : `${pct}%`}</span>
      </div>
      {boosts.length ? (
        <div>
          {boosts.map(([k, v]) => (
            <span key={k} className={`pk-chip ${v > 0 ? "up" : "down"}`}>
              {BOOST_LABEL[k] ?? k} {v > 0 ? "+" : ""}
              {v}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FieldChips({ state, mine }: { state: BState; mine: SideId }) {
  const foe: SideId = mine === "p1" ? "p2" : "p1";
  const chips: string[] = [];
  if (state.weather) chips.push(weatherLabel[state.weather] ?? state.weather);
  if (state.terrain) chips.push(`🌐 ${state.terrain}`);
  for (const r of state.rooms) chips.push(`🔲 ${r}`);
  for (const c of state.sides[foe].conditions) chips.push(`⬆ ${c}`);
  for (const c of state.sides[mine].conditions) chips.push(`⬇ ${c}`);
  if (!chips.length) return null;
  return (
    <div className="pk-field">
      {chips.slice(0, 7).map((c, i) => (
        <span key={c + i}>{c}</span>
      ))}
    </div>
  );
}

function FxView({ fx, mine }: { fx: Fx; mine: SideId }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = (s: SideId | undefined) => (s === mine ? CENTER.me : CENTER.foe);
  const at = pos(fx.side);
  const c = fx.color ?? "#fff";
  const style: CSSProperties = { left: `${at.x}%`, top: `${at.y}%`, ["--c" as string]: c };

  useEffect(() => {
    if (fx.kind !== "proj" || !ref.current) return;
    const a = pos(fx.side);
    const b = pos(fx.to);
    ref.current.animate(
      [
        { left: `${a.x}%`, top: `${a.y}%`, transform: "translate(-50%,-50%) scale(0.4)", opacity: 0.9 },
        { left: `${b.x}%`, top: `${b.y}%`, transform: "translate(-50%,-50%) scale(1.4)", opacity: 1 },
      ],
      { duration: 460, easing: "cubic-bezier(.5,0,.9,.6)", fill: "forwards" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  switch (fx.kind) {
    case "ring": return <div className="pk-fx pk-ring" style={style} />;
    case "mega": return <div className="pk-fx pk-mega-ring" style={style} />;
    case "flash": return <div className="pk-fx pk-flash" style={{ ["--x" as string]: `${at.x}%`, ["--y" as string]: `${at.y}%` }} />;
    case "zbeam": return <div className="pk-fx pk-zbeam" style={{ ...style, top: `${at.y + 18}%` }} />;
    case "zaura": return <div className="pk-fx pk-zaura" style={style} />;
    case "cloud": return <div className="pk-fx pk-dyna-cloud" style={style} />;
    case "aura": return <div className="pk-fx pk-aura" style={style} />;
    case "proj": return <div ref={ref} className="pk-fx pk-orb" style={{ ...style, opacity: 0 }} />;
    case "shards":
      return (
        <>
          {Array.from({ length: 12 }).map((_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            const r = 90 + (i % 3) * 30;
            return <div key={i} className="pk-fx pk-shard" style={{ ...style, ["--dx" as string]: `${Math.cos(ang) * r}px`, ["--dy" as string]: `${Math.sin(ang) * r}px`, ["--r" as string]: `${i * 40}deg`, animationDelay: `${(i % 4) * 40}ms` }} />;
          })}
        </>
      );
    case "sparks":
    case "burst":
      return (
        <>
          {Array.from({ length: fx.kind === "burst" ? 10 : 8 }).map((_, i) => {
            const ang = (i / 10) * Math.PI * 2 + (fx.kind === "sparks" ? 0 : 0.3);
            const r = fx.kind === "sparks" ? 40 : 60;
            return <div key={i} className={`pk-fx pk-spark ${fx.kind === "burst" ? "burst" : "burst"}`} style={{ ...style, ["--dx" as string]: `${Math.cos(ang) * r}px`, ["--dy" as string]: `${(fx.kind === "sparks" ? -Math.abs(Math.sin(ang)) : Math.sin(ang)) * r}px` }} />;
          })}
        </>
      );
    case "arrow": return <div className={`pk-fx pk-arrow ${fx.up ? "" : "down"}`} style={style}>{fx.text}{fx.text}</div>;
    case "label": return <div className="pk-fx pk-pop-label" style={{ ...style, top: `${at.y - 24}%`, background: c }}>{fx.text}</div>;
    case "num": return <div className={`pk-float-num ${fx.extra ?? ""}`} style={{ left: `${at.x}%`, top: `${at.y - 6}%` }}>{fx.text}</div>;
    case "banner": return <div className={`pk-banner ${fx.extra ?? ""}`}>{fx.text}</div>;
    default: return null;
  }
}

/* =============================================================== roster */

export function Roster({ state, side, you }: { state: BState; side: SideId; you: SideId | null }) {
  const s = state.sides[side];
  const total = Math.max(s.size, s.team.length);
  const dots = Array.from({ length: total }, (_, i) => s.team[i] ?? null);
  return (
    <div className="flex items-center gap-1.5" title={s.name}>
      <span className="mr-1 max-w-28 truncate font-sans text-xs text-muted">{you === side ? "★ " : ""}{s.name}</span>
      {dots.map((m, i) => (
        <span key={i} className="pk-mini" data-s={!m || !m.revealed ? "hidden" : m.fainted ? "fnt" : s.active === m ? "out" : "alive"} title={m?.revealed ? m.species : "?"} />
      ))}
    </div>
  );
}

/* ================================================================== log */

export type LogLine = { id: number; text: string };
export function BattleLog({ lines }: { lines: LogLine[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div ref={box} className="pk-log" aria-live="polite">
      {lines.slice(-140).map((l) => (
        <p key={l.id} className={l.text.startsWith("——") ? "turn" : l.text.startsWith("🏆") ? "win" : undefined}>
          {l.text}
        </p>
      ))}
    </div>
  );
}

/* ========================================================= action panel */

type Gimmick = "mega" | "megax" | "megay" | "ultra" | "zmove" | "dynamax" | "terastallize";

export function ActionPanel({
  view,
  state,
  moves,
  sprites,
  busy,
  locked,
  onChoose,
  onForfeit,
  onClaim,
}: {
  view: BattleView;
  state: BState;
  moves: Record<string, MoveInfo>;
  sprites: Record<string, SpriteInfo>;
  busy: boolean;
  locked: boolean;
  onChoose: (choice: string) => void;
  onForfeit: () => void;
  onClaim: () => void;
}) {
  const { t } = useT();
  const [gimmick, setGimmick] = useState<Gimmick | null>(null);
  const [showSwitch, setShowSwitch] = useState(false);
  const req: BattleRequest | null = view.request;
  const you = view.you;

  useEffect(() => {
    setGimmick(null);
    setShowSwitch(false);
  }, [view.rev]);

  if (!you || view.status !== "active") return null;
  const foeSide: SideId = you === "p1" ? "p2" : "p1";
  const foeMon = state.sides[foeSide].active;
  const foeTypes = foeMon ? (foeMon.tera ? [foeMon.tera] : sprites[foeMon.species]?.types ?? []) : [];
  const disabled = busy || locked;

  const footer = (
    <div className="mt-3 flex flex-wrap items-center gap-3 font-sans text-xs text-subtle">
      <button type="button" onClick={() => window.confirm(t("সত্যিই হার মানবেন?", "Really forfeit?")) && onForfeit()} className="pressable underline-offset-4 hover:text-nsfw hover:underline">
        🏳️ {t("হার মানুন", "Forfeit")}
      </button>
      {view.canClaimTimeout ? (
        <button type="button" onClick={onClaim} className="pressable rounded-full bg-accent px-3 py-1 text-accent-fg">
          ⏱ {t("প্রতিপক্ষ সাড়া দিচ্ছে না — জয় দাবি করুন", "Opponent isn't responding — claim the win")}
        </button>
      ) : null}
    </div>
  );

  if (!req || req.wait || view.chosen) {
    return (
      <div className="pk-card p-4">
        <p className="font-sans text-sm text-muted">
          {locked ? t("লড়াইয়ের দৃশ্য চলছে…", "Battle in progress…") : view.cpu ? t("CPU ভাবছে…", "CPU is thinking…") : t("প্রতিপক্ষের চালের অপেক্ষায়… ⏳", "Waiting for your opponent… ⏳")}
        </p>
        {footer}
      </div>
    );
  }

  const bench =
    req.side?.pokemon
      .map((p, i) => ({ p, slot: i + 1 }))
      .filter(({ p }) => !p.active && !p.condition.endsWith(" fnt")) ?? [];
  const switchList = (
    <ul className="grid gap-2 sm:grid-cols-2">
      {bench.map(({ p, slot }) => {
        const species = p.details.split(",")[0];
        const [hp] = p.condition.split(" ");
        const [a, b] = hp.split("/").map(Number);
        const pct = b ? Math.round((a / b) * 100) : 100;
        const st = p.condition.split(" ")[1];
        return (
          <li key={slot}>
            <button type="button" disabled={disabled} onClick={() => onChoose(`switch ${slot}`)} className="pressable flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 p-2 text-left hover:bg-surface disabled:opacity-50">
              <Sprite info={spriteOf(sprites, species)} still className="size-12 object-contain" />
              <span className="min-w-0 flex-1 font-sans text-sm">
                <b className="block truncate">{species}</b>
                <span className="block h-1.5 overflow-hidden rounded-full bg-bg"><i className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct > 50 ? "#4cd964" : pct > 20 ? "#ffcc00" : "#ff3b30" }} /></span>
                <span className="text-[11px] text-muted">{pct}% {st ? `· ${st.toUpperCase()}` : ""}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  if (req.forceSwitch?.some(Boolean)) {
    return (
      <div className="pk-card p-4">
        <h3 className="mb-3 font-display text-lg">{t("কাকে মাঠে পাঠাবেন?", "Who comes in next?")}</h3>
        {switchList}
        {footer}
      </div>
    );
  }

  const act = req.active?.[0];
  if (!act) return <div className="pk-card p-4 font-sans text-sm text-muted">…{footer}</div>;
  const maxMoves = act.maxMoves?.maxMoves;
  const dynamaxed = !!maxMoves && !act.canDynamax;
  const toggles: { id: Gimmick; icon: string; bn: string; en: string }[] = [];
  if (act.canMegaEvo) toggles.push({ id: "mega", icon: "🧬", bn: "মেগা ইভোলিউশন", en: "Mega Evolve" });
  if (act.canMegaEvoX) toggles.push({ id: "megax", icon: "🧬", bn: "মেগা X", en: "Mega X" });
  if (act.canMegaEvoY) toggles.push({ id: "megay", icon: "🧬", bn: "মেগা Y", en: "Mega Y" });
  if (act.canUltraBurst) toggles.push({ id: "ultra", icon: "🌟", bn: "আল্ট্রা বার্স্ট", en: "Ultra Burst" });
  if (act.canZMove?.some(Boolean)) toggles.push({ id: "zmove", icon: "✨", bn: "জেড-মুভ", en: "Z-Move" });
  if (act.canDynamax) toggles.push({ id: "dynamax", icon: act.maxMoves?.gigantamax ? "🦖" : "🔴", bn: act.maxMoves?.gigantamax ? "গিগান্টাম্যাক্স" : "ডায়ানাক্স", en: act.maxMoves?.gigantamax ? "Gigantamax" : "Dynamax" });
  if (act.canTerastallize) toggles.push({ id: "terastallize", icon: "💎", bn: `টেরাস্টালাইজ (${act.canTerastallize})`, en: `Terastallize (${act.canTerastallize})` });

  return (
    <div className="pk-card p-4">
      {toggles.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs text-muted">{t("গিমিক:", "Gimmick:")}</span>
          {toggles.map((g) => (
            <button key={g.id} type="button" disabled={disabled} data-on={gimmick === g.id ? "1" : "0"} onClick={() => setGimmick(gimmick === g.id ? null : g.id)} className="pk-gbtn">
              {g.icon} {t(g.bn, g.en)}
            </button>
          ))}
        </div>
      ) : null}
      <ul className="grid grid-cols-2 gap-2">
        {act.moves.map((m, i) => {
          const base = moves[m.id];
          const useMax = dynamaxed || gimmick === "dynamax";
          const useZ = gimmick === "zmove";
          const z = act.canZMove?.[i] ?? null;
          const label = useMax && maxMoves?.[i] ? maxMoves[i].move : useZ && z ? z.move : m.move;
          const off = !!m.disabled || (useZ && !z) || (useMax && !!maxMoves?.[i]?.disabled);
          const col = TYPE_COLOR[base?.type ?? ""] ?? "#68a090";
          const mult = base && base.cat !== "Status" && foeTypes.length && view.gen >= 6 ? typeMult(base.type, foeTypes) : 1;
          const suffix = gimmick && !dynamaxed ? ` ${gimmick}` : "";
          return (
            <li key={m.id + i}>
              <button type="button" disabled={disabled || off} onClick={() => onChoose(`move ${i + 1}${suffix}`)} className={`pk-move w-full ${gimmick ? "gimmick-on" : ""}`} style={{ ["--c" as string]: col }}>
                <b>{label}</b>
                <small>
                  {base ? <TypeBadge type={base.type} small /> : null}
                  {base ? <span>{base.cat === "Status" ? "—" : base.cat === "Physical" ? "⚔️" : "✴️"} {base.bp || "—"}</span> : null}
                  {m.pp !== undefined ? <span>PP {m.pp}/{m.maxpp}</span> : null}
                  {mult >= 2 ? <span className="tag se">×{mult}</span> : mult === 0 ? <span className="tag imm">×0</span> : mult < 1 ? <span className="tag nve">×{mult}</span> : null}
                </small>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <button type="button" onClick={() => setShowSwitch((v) => !v)} disabled={disabled || act.trapped || bench.length === 0} className="pressable rounded-full border border-border bg-surface-2 px-4 py-1.5 font-sans text-sm disabled:opacity-40">
          🔁 {act.trapped ? t("আটকে গেছে — বদলানো যাবে না", "Trapped — can't switch") : t("পোকেমন বদলান", "Switch Pokémon")}
        </button>
        {showSwitch ? <div className="mt-3">{switchList}</div> : null}
      </div>
      {footer}
    </div>
  );
}

/* ================================================================ result */

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: `${Math.random() * 100}%`,
        s: `${6 + Math.random() * 8}px`,
        d: `${2.6 + Math.random() * 2.4}s`,
        delay: `${-Math.random() * 4}s`,
        dx: `${(Math.random() - 0.5) * 160}px`,
        r: `${360 + Math.random() * 720}deg`,
        c: ["#ffcb05", "#ff4d6d", "#4aa8ff", "#36d27b", "#b46bff", "#ff9f1c"][i % 6],
      })),
    [],
  );
  return (
    <div className="pk-confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ ["--x" as string]: b.x, ["--s" as string]: b.s, ["--d" as string]: b.d, ["--delay" as string]: b.delay, ["--dx" as string]: b.dx, ["--r" as string]: b.r, ["--c" as string]: b.c }} />
      ))}
    </div>
  );
}
function FallingStuff() {
  const bits = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        x: `${Math.random() * 100}%`,
        s: `${22 + Math.random() * 20}px`,
        d: `${2.4 + Math.random() * 2}s`,
        delay: `${-Math.random() * 4}s`,
        r: `${(Math.random() - 0.5) * 900}deg`,
        e: ["🍅", "💀", "🥀", "😭", "🍅", "📉"][i % 6],
      })),
    [],
  );
  return (
    <div className="pk-rain" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ ["--x" as string]: b.x, ["--s" as string]: b.s, ["--d" as string]: b.d, ["--delay" as string]: b.delay, ["--r" as string]: b.r }}>{b.e}</i>
      ))}
    </div>
  );
}

function Wave({ text }: { text: string }) {
  return (
    <span className="pk-fx-wave" aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={i} style={{ ["--i" as string]: i }}>{ch === " " ? "\u00a0" : ch}</span>
      ))}
    </span>
  );
}

export function ResultOverlay({ view, state, onReplay, onRematch }: { view: BattleView; state: BState; onReplay: () => void; onRematch?: () => void }) {
  const { t, lang } = useT();
  const winner = view.winner;
  const you = view.you;
  const outcome: "win" | "lose" | "draw" = winner === "tie" || !winner ? "draw" : !you ? "win" : winner === you ? "win" : "lose";
  const winnerName = winner === "p1" || winner === "p2" ? view.names[winner] : "";
  const winSide = winner === "p1" || winner === "p2" ? winner : null;
  const size = winSide ? Math.max(state.sides[winSide].size, state.sides[winSide].team.length) : 0;
  const left = winSide ? view.left[winSide] : null;
  const flawless = outcome !== "draw" && view.endReason === "normal" && left != null && size > 0 && left === size;
  const photoFinish = outcome !== "draw" && view.endReason === "normal" && left === 1 && size > 1;
  const list = outcome === "lose" ? LOSE_LINES : flawless ? FLAWLESS_LINES : photoFinish ? CLOSE_LINES : WIN_LINES;
  const line = pickLine(list, view.id);
  const pickText = (p: readonly [string, string]) => (lang === "en" ? p[1] : p[0]);
  const reason = view.endReason === "forfeit" ? t("(হার মেনে নেওয়ায়)", "(by forfeit)") : view.endReason === "timeout" ? t("(সময় শেষ হওয়ায়)", "(by timeout)") : "";

  return (
    <div className={`pk-result ${outcome}`}>
      {outcome === "win" ? <Confetti /> : outcome === "lose" ? <FallingStuff /> : null}
      <div className="pk-result-inner">
        <div className={outcome === "lose" ? "pk-skull" : "pk-trophy"} aria-hidden="true">{outcome === "lose" ? "💀" : outcome === "draw" ? "🤝" : "🏆"}</div>
        <h2 className={`pk-big ${outcome}`}>
          {outcome === "win" ? (you ? t("জয়!", "VICTORY!") : winnerName) : outcome === "lose" ? t("হার!", "DEFEAT") : t("ড্র!", "DRAW")}
        </h2>
        {outcome !== "draw" ? (
          <p className={`pk-troll ${outcome === "lose" ? "lose" : ""}`}>
            {you ? pickText(line) : `${winnerName} ${t("জিতেছে!", "wins!")}`}
          </p>
        ) : null}
        {flawless && you === winner ? (
          <p className="mt-2 font-display text-xl"><span className="pk-fx-rainbow"><Wave text={t("ফ্ললেস ভিক্টরি 👑", "FLAWLESS VICTORY 👑")} /></span></p>
        ) : null}
        <p className="mt-3 font-sans text-sm text-white/80">
          {winnerName ? `${winnerName} ${t("জিতেছে", "won")} · ` : ""}
          {t("টার্ন", "Turn")} {view.turn} {reason}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 font-sans text-sm">
          <Link to="/pokemon" className="pressable rounded-full bg-white/90 px-4 py-2 text-black">{t("লবিতে ফিরুন", "Back to lobby")}</Link>
          <Link to="/pokemon/board" className="pressable rounded-full border border-white/40 px-4 py-2 text-white">{t("বোর্ড দেখুন", "See the board")}</Link>
          <button type="button" onClick={onReplay} className="pressable rounded-full border border-white/40 px-4 py-2 text-white">↺ {t("রিপ্লে", "Replay")}</button>
          {onRematch ? <button type="button" onClick={onRematch} className="pressable rounded-full bg-accent px-4 py-2 text-accent-fg">⚔️ {t("আবার লড়ুন", "Rematch")}</button> : null}
        </div>
      </div>
    </div>
  );
}
