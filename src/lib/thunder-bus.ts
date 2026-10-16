/**
 * A tiny message line between the lightning on screen and the thunder in the ambient sound:
 * when a bolt flashes, the sound layer hears about it and rumbles a moment later.
 */
export type Thunder = { delayMs: number; power: number };

const listeners = new Set<(t: Thunder) => void>();

export function emitThunder(t: Thunder) {
  for (const l of listeners) l(t);
}

export function onThunder(l: (t: Thunder) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
