import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/book/library-page";
import { listLibrary } from "@/lib/library-api";
import { listMangaSeries } from "@/lib/manga-api";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [books, manga] = await Promise.all([listLibrary(), listMangaSeries()]);
    return { books, manga };
  },
  component: Home,
});

function Home() {
  const { books, manga } = Route.useLoaderData();
  return <LibraryPage books={books} manga={manga} />;
}
