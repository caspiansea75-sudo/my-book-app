import { useRouteContext } from "@tanstack/react-router";

type Who = { id: number; role: "admin" | "member" } | null | undefined;

/** The signed-in member, or null for a guest. */
export function useMe() {
  const { me } = useRouteContext({ from: "__root__" });
  return me;
}

/** Admin: everything. Member: only what they created. No owner: admin only. */
export function canEditOwner(me: Who, ownerId: number | null | undefined): boolean {
  if (!me) return false;
  return me.role === "admin" || (ownerId != null && ownerId === me.id);
}

export function useCanEdit(ownerId: number | null | undefined): boolean {
  return canEditOwner(useMe(), ownerId);
}
