import { RainLayer } from "@/components/book/rain-layer";
import type { ThemeId } from "@/lib/reader-store";

const STEAM = Array.from({ length: 10 }, (_, i) => ({
  left: `${8 + ((i * 23) % 84)}%`,
  delay: `${(i * 1.3) % 9}s`,
  duration: `${8 + (i % 4) * 2}s`,
}));

const DUST = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 13 + 4) % 100}%`,
  top: `${(i * 29 + 6) % 100}%`,
  delay: `${(i * 0.6) % 6}s`,
  duration: `${5 + (i % 5)}s`,
}));

const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 19 + 6) % 100}%`,
  delay: `${(i * 0.9) % 8}s`,
  duration: `${7 + (i % 5) * 1.6}s`,
}));

/** Ambient visual layer matching the current reading theme. Pure CSS — no canvas/JS animation loop. */
export function ThemeParticles({ theme }: { theme: ThemeId }) {
  if (theme === "monsoon") return <RainLayer />;

  if (theme === "cafe") {
    return (
      <div className="steam-layer" aria-hidden="true">
        {STEAM.map((s, i) => (
          <span key={i} style={{ left: s.left, animationDelay: s.delay, animationDuration: s.duration }} />
        ))}
      </div>
    );
  }

  if (theme === "manuscript") {
    return (
      <div className="dust-layer" aria-hidden="true">
        {DUST.map((d, i) => (
          <span
            key={i}
            style={{ left: d.left, top: d.top, animationDelay: d.delay, animationDuration: d.duration }}
          />
        ))}
      </div>
    );
  }

  // leather
  return (
    <div className="ember-layer" aria-hidden="true">
      {EMBERS.map((e, i) => (
        <span key={i} style={{ left: e.left, animationDelay: e.delay, animationDuration: e.duration }} />
      ))}
    </div>
  );
}
