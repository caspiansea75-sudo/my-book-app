import { redirect } from "@tanstack/react-router";
import type { GuestFeature } from "@/components/members/join-prompt";

/**
 * For a route's `beforeLoad`: a guest is sent home and the "create an account" popup opens there.
 * Everyone else (members, admin, signed-out visitors) passes straight through.
 *
 *   beforeLoad: ({ context }) => redirectGuest(context.me, "chat"),
 */
export function redirectGuest(me: { role: string } | null | undefined, feature: GuestFeature): void {
  if (me?.role === "guest") throw redirect({ to: "/", search: { join: feature } });
}
