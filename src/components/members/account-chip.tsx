import { Link, useRouter, useRouteContext } from "@tanstack/react-router";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/members/avatar";
import { logout } from "@/lib/members-api";

/** Profile link + logout. Sits in the site nav. */
export function AccountChip() {
  const router = useRouter();
  const { me } = useRouteContext({ from: "__root__" });
  if (!me) {
    return (
      <Link
        to="/login"
        className="pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3 font-sans text-xs text-muted hover:bg-surface-2 hover:text-fg"
      >
        <LogIn className="size-3.5" strokeWidth={1.75} />
        <span>লগইন</span>
      </Link>
    );
  }

  async function out() {
    await logout();
    await router.invalidate();
    await router.navigate({ to: "/login" });
  }

  return (
    <div className="flex items-center gap-0.5 font-sans text-xs text-muted">
      <Link
        to="/profile"
        title="আমার প্রোফাইল"
        className="pressable inline-flex h-10 items-center gap-1.5 rounded-full px-1.5 hover:bg-surface-2 hover:text-fg sm:pr-3"
      >
        <Avatar name={me.displayName} url={me.avatarUrl} size={28} />
        <span className="hidden max-w-28 items-center gap-1 truncate sm:inline-flex">
          {me.role === "admin" ? <ShieldCheck className="size-3.5 text-lamp" /> : null}
          {me.displayName}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => void out()}
        aria-label="লগআউট"
        title="লগআউট"
        className="pressable grid size-10 place-items-center rounded-full hover:bg-surface-2 hover:text-fg"
      >
        <LogOut className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
