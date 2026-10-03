import { useState, type MouseEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { setAdult } from "@/lib/adult-api";
import { formatCount } from "@/lib/book";
import { canEditOwner, useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";

/**
 * Manual 18+ switch for a story or a manga. Shown only to its owner and the admin.
 * Nothing is marked automatically — it is off until somebody turns it on here.
 */
export function AdultToggle({
  kind,
  id,
  adult,
  ownerId,
  variant = "round",
  onChanged,
  className,
}: {
  kind: "book" | "manga";
  id: string;
  adult: boolean;
  ownerId: number | null | undefined;
  variant?: "round" | "pill";
  onChanged?: () => void;
  className?: string;
}) {
  const me = useMe();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!canEditOwner(me, ownerId ?? null)) return null;

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await setAdult({ data: { kind, key: id, adult: !adult } });
    } catch {
      // the list is reloaded below, so the button shows what is really saved
    } finally {
      if (onChanged) onChanged();
      else await router.invalidate();
      setBusy(false);
    }
  }

  const label = adult ? "১৮+ চিহ্ন সরান" : "১৮+ হিসেবে চিহ্নিত করুন";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => void toggle(e)}
      title={label}
      aria-label={label}
      aria-pressed={adult}
      className={cn(
        "pressable disabled:opacity-50",
        variant === "pill"
          ? "inline-flex h-10 items-center gap-1.5 rounded-full border px-3 font-sans text-xs"
          : "grid size-8 place-items-center rounded-full border bg-bg/80 font-sans text-[10px] leading-none font-semibold backdrop-blur",
        adult
          ? "border-nsfw/60 text-nsfw"
          : variant === "pill"
            ? "border-border text-fg"
            : "border-border/70 text-fg hover:text-lamp",
        className,
      )}
    >
      {variant === "pill" ? (
        <>
          <ShieldAlert className="size-4" strokeWidth={1.75} />
          {adult ? "১৮+ চিহ্নিত" : "১৮+ নয়"}
        </>
      ) : (
        <>
          {formatCount(18)}+
        </>
      )}
    </button>
  );
}
