import { useRouteContext } from "@tanstack/react-router";

/** The signed-in member, or null for a guest. */
export function useMe() {
  const { me } = useRouteContext({ from: "__root__" });
  return me;
}
