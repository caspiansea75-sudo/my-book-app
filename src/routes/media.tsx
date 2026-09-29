import { createFileRoute, redirect } from "@tanstack/react-router";

// The folder page and the gallery are one page now. Old /media links go to /gallery.
export const Route = createFileRoute("/media")({
  beforeLoad: () => {
    throw redirect({ to: "/gallery" });
  },
});
