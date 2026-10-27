import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Swords } from "lucide-react";
import { FxAurora } from "@/components/media/fx";
import { useLang } from "@/lib/i18n/lang";
import { STAT_KEYS, STAT_LABEL, TYPE_COLOR, localize, spriteChain, tx, type SpriteInfo } from "@/lib/pokemon/shared";
import "@/components/pokemon/pokemon.css";

/** `t("বাংলা", "English")`: the Pokémon section writes both languages right where the text is used. */
export function useT() {
  const lang = useLang();
  const t = useCallback((bn: string, en: string) => tx(lang, bn, en), [lang]);
  /** `te(error.message)`: server messages come in Bangla; show them in the reader's language. */
  const te = useCallback((msg: string) => localize(msg, lang), [lang]);
  return { t, te, lang };
}

const TABS = [
  { to: "/pokemon", bn: "লবি", en: "Lobby", exact: true },
  { to: "/pokemon/petown", bn: "পেটাউন", en: "Petown" },
  { to: "/pokemon/brawl", bn: "অ্যারেনা ব্রল", en: "Arena Brawl" },
  { to: "/pokemon/team", bn: "টিম বানান", en: "Team builder" },
  { to: "/pokemon/dex", bn: "পোকেডেক্স", en: "Pokédex" },
  { to: "/pokemon/board", bn: "বোর্ড", en: "Board" },
] as const;

/** Page heading with the section's tabs. */
export function PokeHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  const { t } = useT();
  return (
    <header className="mx-auto max-w-5xl px-5 pt-10 sm:px-8">
      <p className="flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
        <Swords className="size-4" strokeWidth={1.6} aria-hidden="true" />
        <span>{t("পোকেমন", "POKÉMON")}</span>
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
        <span className="pk-ball mr-2" aria-hidden="true" />
        <span className="pk-title">{title}</span>
      </h1>
      {sub ? <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed text-muted">{sub}</p> : null}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Pokémon">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: "exact" in tab && tab.exact }}
            className="pressable rounded-full border border-border bg-surface px-4 py-1.5 font-sans text-sm text-muted hover:text-fg"
            activeProps={{ className: "pressable rounded-full border border-lamp bg-surface-2 px-4 py-1.5 font-sans text-sm text-fg" }}
          >
            {t(tab.bn, tab.en)}
          </Link>
        ))}
      </nav>
      {children}
    </header>
  );
}

export function PokePage({ children }: { children: ReactNode }) {
  return (
    <>
      <FxAurora />
      {children}
    </>
  );
}

/** A Pokémon picture. Tries the animated sprite, then still sprites, then official art, then a Poké Ball. */
export function Sprite({
  info,
  back,
  shiny,
  still,
  className,
  alt = "",
  style,
}: {
  info: SpriteInfo | null | undefined;
  back?: boolean;
  shiny?: boolean;
  still?: boolean;
  className?: string;
  alt?: string;
  style?: CSSProperties;
}) {
  // each picture is asked for through this site first (cached, one connection), then straight from the picture server
  const chain = useMemo(
    () =>
      spriteChain(info, { back, shiny, still }).flatMap((u) => {
        const m = /sprites\/(ani|ani-back|dex|gen5)\/([a-z0-9-]+)\.(?:gif|png)$/.exec(u);
        return m ? [`/api/sprite?k=${m[1]}&id=${m[2]}`, u] : [u];
      }),
    [info?.id, info?.num, back, shiny, still], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const key = chain.join("|");
  const [i, setI] = useState(0);
  const [ok, setOk] = useState(false);
  const [seen, setSeen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const retried = useRef(false);
  useEffect(() => {
    setI(0);
    setOk(false);
    retried.current = false;
  }, [key]);
  // pictures are only asked for once their card is near the screen
  useEffect(() => {
    const el = holder.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  // an address that gives no answer for a while is given up on
  useEffect(() => {
    if (ok || !seen || i >= chain.length) return;
    const id = window.setTimeout(() => setI((n) => n + 1), 6000);
    return () => window.clearTimeout(id);
  }, [ok, seen, i, chain.length, key]);
  const fail = () => {
    // one more try at the same address (a dropped connection), then on to the next
    if (!retried.current) {
      retried.current = true;
      setRetry((r) => r + 1);
      return;
    }
    retried.current = false;
    setI((n) => n + 1);
  };
  const [retry, setRetry] = useState(0);
  if (!chain.length || i >= chain.length) {
    return (
      <span className={className} style={style} aria-hidden="true">
        <span className="pk-ball" style={{ width: "2em", height: "2em" }} />
      </span>
    );
  }
  return (
    <>
      {ok ? null : (
        <span ref={holder} className={className} style={{ ...style, display: "inline-flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
          <span className="pk-ball" style={{ width: "1.6em", height: "1.6em", opacity: 0.45 }} />
        </span>
      )}
      {seen ? (
        <img
          key={`${chain[i]}#${retry}`}
          src={chain[i]}
          alt={alt}
          decoding="async"
          draggable={false}
          onLoad={() => setOk(true)}
          onError={fail}
          className={className}
          style={ok ? style : { ...style, position: "absolute", opacity: 0, pointerEvents: "none" }}
        />
      ) : null}
    </>
  );
}

export function TypeBadge({ type, small }: { type: string; small?: boolean }) {
  return (
    <span
      className={small ? "rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white" : "rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"}
      style={{ background: TYPE_COLOR[type] ?? "#68a090", textShadow: "0 1px 1px rgba(0,0,0,.35)" }}
    >
      {type}
    </span>
  );
}

export function StatBars({ bs }: { bs: number[] }) {
  const total = bs.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-1.5">
      {STAT_KEYS.map((k, i) => {
        const v = bs[i] ?? 0;
        const hue = Math.max(0, Math.min(140, (v / 160) * 140));
        return (
          <div key={k} className="flex items-center gap-2 font-sans text-xs">
            <span className="w-8 text-muted">{STAT_LABEL[k]}</span>
            <span className="w-8 text-right tabular-nums text-fg">{v}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <i className="block h-full rounded-full" style={{ width: `${Math.min(100, (v / 180) * 100)}%`, background: `hsl(${hue} 75% 50%)`, transition: "width .6s" }} />
            </span>
          </div>
        );
      })}
      <div className="flex justify-between pt-1 font-sans text-xs text-muted">
        <span>Total</span>
        <span className="tabular-nums text-fg">{total}</span>
      </div>
    </div>
  );
}

export const GIMMICK: Record<string, { icon: string; bn: string; en: string; color: string }> = {
  mega: { icon: "🧬", bn: "মেগা", en: "Mega", color: "#f95587" },
  megaza: { icon: "⚡", bn: "নতুন মেগা (Z-A)", en: "New Mega (Z-A)", color: "#8338ec" },
  primal: { icon: "🌋", bn: "প্রাইমাল", en: "Primal", color: "#ee8130" },
  ultra: { icon: "🌟", bn: "আল্ট্রা বার্স্ট", en: "Ultra Burst", color: "#f7d02c" },
  gmax: { icon: "🦖", bn: "গিগান্টাম্যাক্স", en: "Gigantamax", color: "#e63946" },
  dyna: { icon: "🔴", bn: "ডায়ানাক্স", en: "Dynamax", color: "#b5179e" },
  z: { icon: "✨", bn: "জেড-মুভ", en: "Z-Move", color: "#ffb703" },
  zsig: { icon: "💠", bn: "সিগনেচার জেড", en: "Signature Z", color: "#2ec4b6" },
  tera: { icon: "💎", bn: "টেরা", en: "Tera", color: "#40b5a5" },
};

export function GimmickPills({ tags, only }: { tags: string[]; only?: string[] }) {
  const { t } = useT();
  const list = tags.filter((g) => GIMMICK[g] && (!only || only.includes(g)));
  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.map((g) => (
        <span key={g} title={t(GIMMICK[g].bn, GIMMICK[g].en)} className="rounded-full px-1.5 py-px font-sans text-[10px] text-white" style={{ background: GIMMICK[g].color }}>
          {GIMMICK[g].icon} {t(GIMMICK[g].bn, GIMMICK[g].en)}
        </span>
      ))}
    </span>
  );
}

/** Calls `fn` now and then every `ms` while `on` is true. */
export function useInterval(fn: () => void, ms: number, on = true) {
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, on]);
}

export const NATURES = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Bold", "Docile", "Relaxed", "Impish", "Lax", "Timid", "Hasty", "Serious",
  "Jolly", "Naive", "Modest", "Mild", "Quiet", "Bashful", "Rash", "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];
