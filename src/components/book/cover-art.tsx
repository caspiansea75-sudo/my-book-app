import { cn } from "@/lib/utils";

function tone(slug: string): number {
  let n = 0;
  for (let i = 0; i < slug.length; i += 1) n = (n + slug.charCodeAt(i) * (i + 3)) % 360;
  return n;
}

export function CoverArt({
  title,
  tagline,
  coverUrl,
  slug,
  className,
}: {
  title: string;
  tagline?: string;
  coverUrl?: string | null;
  slug: string;
  className?: string;
}) {
  const initial = title.trim().slice(0, 1) || "গ";
  const shift = tone(slug);

  if (coverUrl) {
    return (
      <div className={cn("cover-plate relative overflow-hidden", className)}>
        <img
          src={coverUrl}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="cover-plate-veil" />
      </div>
    );
  }

  return (
    <div
      className={cn("cover-plate relative overflow-hidden", className)}
      style={{
        background: `linear-gradient(${140 + (shift % 40)}deg, var(--book-surface-2), color-mix(in oklab, var(--book-accent) 28%, var(--book-bg)))`,
      }}
    >
      <div className="cover-plate-lines" aria-hidden="true" />
      <div className="relative z-10 flex h-full flex-col justify-between p-4">
        <p className="font-sans text-[10px] tracking-[0.22em] text-lamp/90 uppercase">
          {tagline ? tagline.split("·")[0]?.trim() : "গল্প"}
        </p>
        <p className="font-display text-5xl font-semibold leading-none text-fg/90">{initial}</p>
        <p className="line-clamp-2 font-display text-sm leading-snug text-fg">{title}</p>
      </div>
    </div>
  );
}
