import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Avatar } from "@/components/members/avatar";
import { PokeHeader, useT } from "@/components/pokemon/ui";
import { board, type BoardData, type BoardRow, type FeedItem } from "@/lib/pokemon-api";
import { CLOSE_LINES, FLAWLESS_LINES, LOSE_LINES, QUICK_LINES, WIN_LINES, formatByGen, pickLine, titleFor, type Pair } from "@/lib/pokemon/shared";

export const Route = createFileRoute("/pokemon/board")({
  loader: () => board({ data: { scope: "all" } }),
  component: BoardPage,
});

const MEDAL = ["#ffcb05", "#c0c6d0", "#cd7f32"];

function BoardPage() {
  const initial = Route.useLoaderData();
  const { t, lang } = useT();
  const [scope, setScope] = useState<"all" | "pvp">("all");
  const [data, setData] = useState<BoardData>(initial);
  const [first, setFirst] = useState(true);

  useEffect(() => {
    if (first) return setFirst(false);
    board({ data: { scope } }).then(setData).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const pick = (p: Pair) => (lang === "en" ? p[1] : p[0]);
  const top = data.rows.slice(0, 3);
  const podium = [top[1], top[0], top[2]].filter(Boolean) as BoardRow[];

  return (
    <>
      <PokeHeader
        title={t("হল অব ফেম ও শেম", "Hall of Fame & Shame")}
        sub={t("কে জিতছে, কে ফ্রি-তে এক্সপ বিলাচ্ছে — সব এখানে। প্রতিটি লড়াই রিপ্লে করে দেখা যায়।", "Who's winning, who's donating free XP — all here. Every battle can be replayed.")}
      />
      <section className="mx-auto max-w-5xl space-y-8 px-5 pb-20 pt-6 sm:px-8">
        <div className="flex gap-2 font-sans text-sm">
          {(["all", "pvp"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)} className={`pressable rounded-full border px-4 py-1.5 ${scope === s ? "border-lamp bg-surface-2 text-fg" : "border-border text-muted"}`}>
              {s === "all" ? t("সব লড়াই", "All battles") : t("শুধু সদস্য বনাম সদস্য", "Member vs member only")}
            </button>
          ))}
        </div>

        {data.rows.length === 0 ? (
          <div className="pk-card p-10 text-center font-sans text-sm text-muted">
            <p className="pk-ball" style={{ fontSize: 44 }} aria-hidden="true" />
            <p className="mt-3">{t("এখনও কোনো লড়াই শেষ হয়নি। প্রথম নামটা আপনারই হোক!", "No battle has finished yet. Be the first name up here!")}</p>
            <Link to="/pokemon" className="pressable mt-4 inline-block rounded-full bg-accent px-5 py-2 text-accent-fg">{t("লড়াই শুরু করুন", "Start a battle")}</Link>
          </div>
        ) : (
          <>
            <div className="pk-podium">
              {podium.map((r) => {
                const rank = top.indexOf(r);
                const cls = rank === 0 ? "first" : rank === 1 ? "second" : "third";
                const ttl = titleFor({ wins: r.wins, losses: r.losses, streak: r.streak, cpuLosses: r.cpuLosses, games: r.games });
                return (
                  <div key={r.memberId} className={`pk-step ${cls}`} style={{ ["--c" as string]: MEDAL[rank], ["--i" as string]: rank === 0 ? 2 : rank === 1 ? 0 : 1 }}>
                    {rank === 0 ? <span className="pk-crown" aria-hidden="true">👑</span> : <span className="text-2xl" aria-hidden="true">{rank === 1 ? "🥈" : "🥉"}</span>}
                    <Avatar name={r.name} url={r.avatarUrl} size={rank === 0 ? 56 : 44} />
                    <Link to="/u/$username" params={{ username: r.username }} className="mt-1 max-w-full truncate font-display text-base hover:underline">{r.name}</Link>
                    <span className="font-sans text-xs text-muted">{r.wins} {t("জয়", "W")} · {r.losses} {t("হার", "L")}</span>
                    {ttl ? <span className="mt-1 font-sans text-[11px] text-lamp">{pick(ttl)}</span> : null}
                  </div>
                );
              })}
            </div>

            <div className="pk-card overflow-x-auto">
              <table className="w-full min-w-[560px] font-sans text-sm">
                <thead className="text-left text-xs text-subtle">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">{t("সদস্য", "Member")}</th>
                    <th className="px-3 py-2 text-right">{t("জয়", "W")}</th>
                    <th className="px-3 py-2 text-right">{t("হার", "L")}</th>
                    <th className="px-3 py-2 text-right">%</th>
                    <th className="px-3 py-2">{t("ধারা", "Streak")}</th>
                    <th className="px-3 py-2">{t("তকমা", "Title")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => {
                    const ttl = titleFor({ wins: r.wins, losses: r.losses, streak: r.streak, cpuLosses: r.cpuLosses, games: r.games });
                    return (
                      <tr key={r.memberId} className="pk-shame-in border-t border-border" style={{ ["--i" as string]: i }}>
                        <td className="px-3 py-2 text-muted">{i + 1}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2"><Avatar name={r.name} url={r.avatarUrl} size={24} />{r.name}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.wins}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.losses}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.games ? Math.round((r.wins / r.games) * 100) : 0}</td>
                        <td className="px-3 py-2">
                          {r.streak >= 3 ? <span><span className="pk-flame">🔥</span> {r.streak}</span> : r.streak <= -3 ? <span>🧊 {Math.abs(r.streak)}</span> : r.streak > 0 ? `+${r.streak}` : r.streak < 0 ? `${r.streak}` : "—"}
                          {r.flawless ? <span title={t("ফ্ললেস জয়", "Flawless wins")} className="ml-2">👑×{r.flawless}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-xs text-lamp">{ttl ? pick(ttl) : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="mb-3 font-display text-xl">{t("সাম্প্রতিক লড়াই", "Latest battles")}</h2>
              <ul className="space-y-2">
                {data.feed.map((f, i) => (
                  <FeedRow key={f.id} f={f} i={i} pick={pick} t={t} />
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function FeedRow({ f, i, pick, t }: { f: FeedItem; i: number; pick: (p: Pair) => string; t: (bn: string, en: string) => string }) {
  const fmt = formatByGen(f.gen);
  const caption = f.tie ? null : f.flawless ? pickLine(FLAWLESS_LINES, f.id) : f.winnerLeft === 1 && f.reason === "normal" ? pickLine(CLOSE_LINES, f.id) : f.turns > 0 && f.turns <= 5 ? pickLine(QUICK_LINES, f.id) : pickLine(WIN_LINES, f.id);
  const insult = f.tie ? null : pickLine(LOSE_LINES, f.id + 7);
  return (
    <li className="pk-shame-in" style={{ ["--i" as string]: Math.min(i, 12) }}>
      <Link to="/pokemon/battle/$id" params={{ id: String(f.id) }} className="pressable pk-card block p-3 hover:bg-surface-2">
        <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
          {f.tie ? (
            <span>🤝 <b>{f.winner}</b> {t("ও", "&")} <b>{f.loser}</b> — {t("ড্র", "draw")}</span>
          ) : (
            <span>
              🏆 <b className={f.flawless ? "pk-fx-rainbow" : ""}>{f.winner}</b> {t("হারাল", "beat")} 💀 <b className="text-muted">{f.loser}</b>
              {f.loserCpu ? <span className="ml-1">🤖</span> : null}
            </span>
          )}
          <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{t(fmt.bn, fmt.en)} · {f.turns} {t("টার্ন", "turns")}{f.reason !== "normal" ? ` · ${f.reason === "forfeit" ? t("হার মেনেছে", "forfeit") : t("সময় শেষ", "timeout")}` : ""}</span>
        </div>
        {caption ? (
          <p className="mt-1 font-sans text-xs text-muted">
            {pick(caption)} {insult ? <span className="text-subtle">· {f.loser}: “{pick(insult)}”</span> : null}
          </p>
        ) : null}
      </Link>
    </li>
  );
}
