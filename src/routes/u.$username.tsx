import { Link, createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { MessageCircle, Pencil, ShieldCheck } from "lucide-react";
import { SiteNav } from "@/components/book/site-nav";
import { Avatar } from "@/components/members/avatar";
import { FxAurora } from "@/components/media/fx";
import { useGuestGate } from "@/components/members/join-prompt";
import { useMe } from "@/lib/use-me";
import { CreatorStatsSection } from "@/components/members/creator-stats";
import { getCreatorStats, getProfile } from "@/lib/social-api";

export const Route = createFileRoute("/u/$username")({
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: "/login" });
  },
  loader: async ({ params }) => {
    const profile = await getProfile({ data: { username: params.username } });
    if (!profile) throw notFound();
    const creator = await getCreatorStats({ data: { username: profile.username } });
    return { ...profile, creator };
  },
  component: ProfileView,
});

function ProfileView() {
  const p = Route.useLoaderData();
  const isGuest = useMe()?.role === "guest";
  const gate = useGuestGate();
  return (
    <main className="mf-page relative min-h-dvh">
      <FxAurora />
      <SiteNav active="profile" />
      <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <Avatar name={p.displayName} url={p.avatarUrl} size={112} />
          <h1 className="mt-5 flex items-center gap-2 font-display text-3xl font-semibold">
            {p.role === "admin" ? <ShieldCheck className="size-5 text-lamp" strokeWidth={1.75} /> : null}
            {p.displayName}
          </h1>
          <p className="mt-1 font-sans text-sm text-muted">
            @{p.username} · {p.role === "admin" ? "অ্যাডমিন" : "সদস্য"} · যোগ দিয়েছেন {p.joined}
          </p>
          {p.bio ? (
            <p className="mt-6 max-w-md whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-fg">
              {p.bio}
            </p>
          ) : (
            <p className="mt-6 font-sans text-sm text-subtle">এখনো নিজের সম্পর্কে কিছু লেখেননি।</p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {p.isMe ? (
              <Link
                to="/profile"
                className="pressable inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg"
              >
                <Pencil className="size-4" strokeWidth={1.75} />
                প্রোফাইল বদলান
              </Link>
            ) : (
              <Link
                to="/chat"
                search={{ with: p.id }}
                onClick={
                  isGuest
                    ? (e) => {
                        e.preventDefault();
                        gate("chat");
                      }
                    : undefined
                }
                className="pressable inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg"
              >
                <MessageCircle className="size-4" strokeWidth={1.75} />
                বার্তা পাঠান
              </Link>
            )}
          </div>
        </div>
        <CreatorStatsSection stats={p.creator} />
      </section>
    </main>
  );
}
