import { useRouteContext } from "@tanstack/react-router";

type Who = { id: number; role: "admin" | "member" | "guest" } | null | undefined;

/** The signed-in member (or guest visitor), or null when nobody is signed in. */
export function useMe() {
  const { me } = useRouteContext({ from: "__root__" });
  return me;
}

/** True for a visitor browsing as a guest (no account): may read, like and vote only. */
export function useIsGuest(): boolean {
  return useMe()?.role === "guest";
}

/** Admin: everything. Member: only what they created. No owner: admin only. */
export function canEditOwner(me: Who, ownerId: number | null | undefined): boolean {
  if (!me) return false;
  return me.role === "admin" || (ownerId != null && ownerId === me.id);
}

export function useCanEdit(ownerId: number | null | undefined): boolean {
  return canEditOwner(useMe(), ownerId);
}
