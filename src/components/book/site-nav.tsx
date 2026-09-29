import { Link } from "@tanstack/react-router";
import { BookImage, BookOpen, FolderOpen, Images, MessageCircle, PenLine, Users } from "lucide-react";
import { AccountChip } from "@/components/members/account-chip";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "লাইব্রেরি", icon: BookOpen, id: "library" },
  { to: "/gallery", label: "চিত্রশালা", icon: Images, id: "gallery" },
  { to: "/media", label: "ফোল্ডার", icon: FolderOpen, id: "folders" },
  { to: "/manga", label: "মাঙ্গা", icon: BookImage, id: "manga" },
  { to: "/studio", label: "স্টুডিও", icon: PenLine, id: "studio" },
  { to: "/chat", label: "চ্যাট", icon: MessageCircle, id: "chat" },
  { to: "/members", label: "সদস্য", icon: Users, id: "members" },
] as const;

export function SiteNav({ active }: { active: (typeof ITEMS)[number]["id"] | "profile" }) {
  const me = useMe();
  const items = ITEMS.filter((item) => {
    if (item.id === "members") return me?.role === "admin";
    if (item.id === "studio" || item.id === "folders" || item.id === "chat") return !!me;
    return true;
  });
  return (
    <header className="relative z-20 border-b border-border/80 bg-bg/80 backdrop-blur-md">
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
            return (
              <Link
                key={item.id}
                to={item.to}
                className={cn(
                  "pressable inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 font-sans text-xs sm:px-3",
                  on ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <AccountChip />
      </div>
    </header>
  );
}
