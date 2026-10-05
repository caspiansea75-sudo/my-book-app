import { Link } from "@tanstack/react-router";
import { BookImage, BookOpen, Images, Lock, MessageCircle, PenLine, Users } from "lucide-react";
import { LangSwitch } from "@/components/i18n/lang-switch";
import { AccountChip } from "@/components/members/account-chip";
import { useGuestGate, type GuestFeature } from "@/components/members/join-prompt";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "লাইব্রেরি", icon: BookOpen, id: "library" },
  { to: "/gallery", label: "চিত্রশালা", icon: Images, id: "gallery" },
  { to: "/manga", label: "মাঙ্গা", icon: BookImage, id: "manga" },
  { to: "/studio", label: "স্টুডিও", icon: PenLine, id: "studio" },
  { to: "/chat", label: "চ্যাট", icon: MessageCircle, id: "chat" },
  { to: "/members", label: "সদস্য", icon: Users, id: "members" },
] as const;

/** What a guest is told when they tap a members-only item. */
const GUEST_LOCKED: Partial<Record<(typeof ITEMS)[number]["id"], GuestFeature>> = {
  gallery: "gallery",
  studio: "create",
  chat: "chat",
};

export function SiteNav({ active }: { active: (typeof ITEMS)[number]["id"] | "profile" }) {
  const me = useMe();
  const gate = useGuestGate();
  const isGuest = me?.role === "guest";
  const items = ITEMS.filter((item) => {
    if (item.id === "members") return me?.role === "admin";
    if (item.id === "studio" || item.id === "chat") return !!me;
    return true;
  });
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="pressable flex min-w-0 items-center gap-2 text-fg">
          <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-lamp">
            <BookOpen className="size-4" strokeWidth={1.7} />
          </span>
          <span className="truncate font-display text-sm tracking-wide">গল্প সংগ্রহ</span>
        </Link>
        <nav className="flex items-center gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const on = item.id === active;
            const locked = isGuest ? GUEST_LOCKED[item.id] : undefined;
            return (
              <Link
                key={item.id}
                to={item.to}
                onClick={
                  locked
                    ? (e) => {
                        // Guests stay where they are and get the "create an account" popup.
                        e.preventDefault();
                        gate(locked);
                      }
                    : undefined
                }
                className={cn(
                  "pressable inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 font-sans text-xs sm:px-3",
                  on ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">{item.label}</span>
                {locked ? <Lock className="size-3 opacity-60" strokeWidth={1.75} aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1">
          <LangSwitch />
          <AccountChip />
        </div>
      </div>
    </header>
  );
}
