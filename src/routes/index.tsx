import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/book/library-page";
import { listLibrary } from "@/lib/library-api";

export const Route = createFileRoute("/")({
  loader: () => listLibrary(),
  component: Home,
});

function Home() {
  const books = Route.useLoaderData();
  return <LibraryPage books={books} />;
}
