import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/members/auth-form";

export const Route = createFileRoute("/login")({
  component: () => <AuthForm mode="login" />,
});
