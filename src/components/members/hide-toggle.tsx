import { useState, type MouseEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { setHidden } from "@/lib/hidden-api";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";

/** Admin-only eye button: hide from members / show again. Renders nothing for anyone else. */
export function HideToggle({
  kind,
  id,
  hidden,
  variant = "round",
  onChanged,
  className,
}: {
  kind: "book" | "manga" | "media";
  id: string | number;
  hidden: boolean;
  variant?: "round" | "tile" | "pill";
  onChanged?: () => void;
  className?: string;
}) {
  const me = useMe();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (me?.role !== "admin") return null;

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await setHidden({ data: { kind, key: String(id), hidden: !hidden } });
      if (onChanged) onChanged();
      else await router.invalidate();
    } finally {
      setBusy(false);
    }
  }

  const Icon = hidden ? EyeOff : Eye;
  const label = hidden ? "সদস্যদের দেখান" : "সদস্যদের থেকে লুকান";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => void toggle(e)}
      title={label}
      aria-label={label}
      aria-pressed={hidden}
      className={cn(
        "pressable disabled:opacity-50",
        variant === "pill"
          ? "inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-fg"
          : variant === "tile"
            ? "grid size-9 place-items-center rounded-full bg-bg/75 text-fg backdrop-blur-sm"
            : "grid size-8 place-items-center rounded-full border border-border/70 bg-bg/80 text-fg backdrop-blur hover:text-lamp",
        hidden && "text-lamp",
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
      {variant === "pill" ? (hidden ? "লুকানো — দেখান" : "লুকান") : null}
    </button>
  );
}
