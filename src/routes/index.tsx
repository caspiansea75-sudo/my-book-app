import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/book/library-page";

export const Route = createFileRoute("/")({ component: LibraryPage });
