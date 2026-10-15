import { glyphMarkup, iconColor } from "@/lib/pokemon/type-glyphs";

/**
 * A type shown as a small coloured square with a symbol (flame, drop, leaf…), like in the games.
 * `name` adds the type's name next to it.
 */
export function TypeIcon({ type, size = 22, name = false, className = "" }: { type: string; size?: number; name?: boolean; className?: string }) {
  const color = iconColor(type);
  const svg = (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={type} className="shrink-0" style={{ display: "block", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.28))" }}>
      <title>{type}</title>
      <rect width="24" height="24" rx="5.8" fill={color} />
      <rect width="24" height="12" rx="5.8" fill="#fff" opacity="0.12" />
      <g dangerouslySetInnerHTML={{ __html: glyphMarkup(type) }} />
    </svg>
  );
  if (!name) return <span className={`inline-flex ${className}`}>{svg}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {svg}
      <span className="font-sans text-xs text-fg">{type}</span>
    </span>
  );
}

/** Several types side by side (a Pokémon's one or two types). */
export function TypeIcons({ types, size = 22, name = false, className = "" }: { types: readonly string[]; size?: number; name?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {types.map((t) => (
        <TypeIcon key={t} type={t} size={size} name={name} />
      ))}
    </span>
  );
}
