import { Link } from "@tanstack/react-router";
import { BookOpen, Images, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "লাইব্রেরি", icon: BookOpen, id: "library" },
  { to: "/gallery", label: "চিত্রশালা", icon: Images, id: "gallery" },
  { to: "/studio", label: "স্টুডিও", icon: PenLine, id: "studio" },
] as const;

export function SiteNav({ active }: { active: (typeof ITEMS)[number]["id"] }) {
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
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const on = item.id === active;
            return (
              <Link
                key={item.id}
                to={item.to}
                className={cn(
                  "pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3 font-sans text-xs",
                  on ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
