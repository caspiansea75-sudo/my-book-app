import { createFileRoute } from "@tanstack/react-router";
import { BookCoverPage } from "@/components/book/book-cover";

export const Route = createFileRoute("/book/$bookSlug")({
  component: () => {
    const { bookSlug } = Route.useParams();
    return <BookCoverPage bookSlug={bookSlug} />;
  },
});
