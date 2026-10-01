import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShieldCheck, Users } from "lucide-react";
import { SiteNav } from "@/components/book/site-nav";
import { FxAurora, FxWords, fxIndex } from "@/components/media/fx";
import { listMembers } from "@/lib/members-api";
import { PresenceDot, PresenceLabel, usePresence } from "@/components/presence/presence";

export const Route = createFileRoute("/members")({
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: "/login" });
    if (context.me.role !== "admin") throw redirect({ to: "/" });
  },
  loader: () => listMembers(),
  component: MembersPage,
});

function MembersPage() {
  const members = Route.useLoaderData();
  const presence = usePresence(true);
  const onlineCount = members.filter((m: { id: number }) => presence.get(m.id)?.online).length;

  return (
    <main className="mf-page relative min-h-dvh">
      <FxAurora />
      <SiteNav active="members" />
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <p className="mf-eyebrow flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
          <Users className="size-4" strokeWidth={1.6} />
          সদস্য
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
          <FxWords text="সদস্য তালিকা" />
        </h1>
        <p className="mt-3 font-sans text-sm text-muted">মোট {members.length} জন</p>
        {presence.size > 0 ? (
          <p className="mt-1 flex items-center gap-2 font-sans text-sm text-emerald-400">
            <span className="pr-dot pr-on" aria-hidden="true" />
            {`এখন অনলাইনে ${onlineCount.toLocaleString("bn-BD")} জন`}
          </p>
        ) : null}

        {members.length === 0 ? (
          <p className="mt-8 font-sans text-sm text-muted">এখনো কেউ যোগ দেয়নি।</p>
        ) : (
          <div className="mt-8 space-y-2.5">
            {members.map((m, i) => (
              <div
                key={m.id}
                style={fxIndex(i)}
                className="mf-card mf-rise flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-display text-base">
                    <PresenceDot row={presence.get(m.id)} />
                    {m.role === "admin" ? <ShieldCheck className="size-4 text-lamp" strokeWidth={1.75} /> : null}
                    <span className="truncate">{m.displayName}</span>
                  </p>
                  <p className="mt-0.5 font-sans text-xs text-muted">
                    @{m.username} · {m.role === "admin" ? "অ্যাডমিন" : "সদস্য"} · যোগ দিয়েছেন {m.joined}
                  </p>
                  <p className="mt-0.5 font-sans text-xs">
                    <PresenceLabel row={presence.get(m.id)} />
                  </p>
                </div>
                <p className="font-sans text-xs text-muted">
                  বই {m.books} · মাঙ্গা {m.series} · ছবি/ভিডিও {m.media}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
