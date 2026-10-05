import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { redirectGuest } from "@/lib/auth/guest";

export const Route = createFileRoute("/studio")({
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: "/login" });
    redirectGuest(context.me, "create");
  },
  component: () => <Outlet />,
});