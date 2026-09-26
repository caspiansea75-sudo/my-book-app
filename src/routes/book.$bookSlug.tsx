import { createFileRoute, notFound } from "@tanstack/react-router";
import { BookCoverPage } from "@/components/book/book-cover";
import { resolveBook } from "@/lib/library-api";

export const Route = createFileRoute("/book/$bookSlug")({
  loader: async ({ params }) => {
    const book = await resolveBook({ data: { slug: params.bookSlug } });
    if (!book) throw notFound();
    return book;
  },
  component: BookPage,
});

function BookPage() {
  const book = Route.useLoaderData();
  return <BookCoverPage book={book} />;
}
