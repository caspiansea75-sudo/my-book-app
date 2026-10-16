import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";
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
  // Keyed by the page, so the "page opens" effects (see .pk-enter in pokemon.css) play on every tab and every battle.
  const path = useRouterState({ select: (st) => st.location.pathname });
  return (
    <main className="mf-page relative min-h-dvh">
      <PokePage>
        <SiteNav active="pokemon" />
        <div key={path} className="pk-enter">
          <Outlet />
        </div>
      </PokePage>
    </main>
  );
}
