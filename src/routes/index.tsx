import { createFileRoute } from "@tanstack/react-router";
import { CoverPage } from "@/components/book/cover-page";

export const Route = createFileRoute("/")({ component: CoverPage });
