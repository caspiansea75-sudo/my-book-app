import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { SiteNav } from "@/components/book/site-nav";
import { PokePage } from "@/components/pokemon/ui";
import { redirectGuest } from "@/lib/auth/guest";

/** Everything under /pokemon is for signed-in members; guests are sent home with the "create an account" popup. */
export const Route = createFileRoute("/pokemon")({
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: "/login" });
    redirectGuest(context.me, "pokemon");
  },
  component: PokemonLayout,
});

function PokemonLayout() {
  return (
    <main className="mf-page relative min-h-dvh">
      <PokePage>
        <SiteNav active="pokemon" />
        <Outlet />
      </PokePage>
    </main>
  );
}
