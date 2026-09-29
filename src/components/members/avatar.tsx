import { cn } from "@/lib/utils";

/** A member's picture, or their first letter when they have none. */
export function Avatar({
  name,
  url,
  size = 32,
  className,
}: {
  name: string;
  url: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const initial = Array.from(name.trim())[0] ?? "?";
  const box = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={box}
        className={cn("shrink-0 rounded-full bg-surface-2 object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: Math.round(size * 0.42) }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-surface-2 font-display text-muted",
        className,
      )}
    >
      {initial}
    </span>
  );
}
