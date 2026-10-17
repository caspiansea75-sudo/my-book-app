// Frame lists for how Pokémon move when they attack and when they are hit (moved here from arena.tsx).
import type { Motion } from "@/lib/pokemon/motion";

/** One animation frame; every frame uses the same list of transform functions so the browser blends them smoothly. */
export const fk = (offset: number, x: number, y: number, rot = 0, sx = 1, sy = 1, b = 1, glow = "transparent", r = 0, opacity = 1): Keyframe => ({
  offset,
  transform: `translate(${x}%, ${y}%) rotate(${rot}deg) scale(${sx}, ${sy})`,
  filter: `brightness(${b}) drop-shadow(0 0 ${r}px ${glow})`,
  opacity,
});

export function attackAnim(m: Motion, d: { x: number; y: number }, g: string): { frames: Keyframe[]; ms: number } {
  const sg = d.x > 0 ? 1 : -1;
  switch (m) {
    case "jump":
      return { ms: 800, frames: [fk(0, 0, 0), fk(0.12, 0, 5, 0, 1.06, 0.88), fk(0.42, d.x * 0.45, d.y * 0.45 - 40, -12 * sg, 1, 1.05), fk(0.62, d.x, d.y, 8 * sg, 1.12, 1.12, 1.3, g, 12), fk(0.72, d.x, d.y, 0, 1.14, 0.88), fk(1, 0, 0)] };
    case "spin":
      return { ms: 720, frames: [fk(0, 0, 0), fk(0.5, d.x * 0.9, d.y * 0.9, 360 * sg, 1.1, 1.1, 1.3, g, 10), fk(1, 0, 0, 720 * sg)] };
    case "dig":
      return { ms: 950, frames: [fk(0, 0, 0), fk(0.25, 0, 60, 0, 0.8, 0.4, 0.7, "transparent", 0, 0.3), fk(0.55, d.x, d.y + 50, 0, 0.8, 0.4, 0.7, "transparent", 0, 0.3), fk(0.7, d.x, d.y - 12, 0, 1.1, 1.25, 1.2), fk(1, 0, 0)] };
    case "bite":
      return { ms: 720, frames: [fk(0, 0, 0), fk(0.3, d.x, d.y, 0, 1.1, 1.1), fk(0.38, d.x + 3, d.y, -4 * sg, 1.1, 1.1), fk(0.46, d.x - 3, d.y, 4 * sg, 1.1, 1.1), fk(0.54, d.x + 3, d.y, -4 * sg, 1.1, 1.1), fk(0.62, d.x - 2, d.y, 3 * sg, 1.1, 1.1), fk(1, 0, 0)] };
    case "uppercut":
      return { ms: 720, frames: [fk(0, 0, 0), fk(0.18, 0, 6, 0, 1.05, 0.82), fk(0.5, d.x * 0.8, d.y * 0.8 - 30, -18 * sg, 1.05, 1.15, 1.3, g, 12), fk(0.65, d.x * 0.9, d.y * 0.9 - 12, -10 * sg, 1.08, 1.08), fk(1, 0, 0)] };
    case "slam":
      return { ms: 740, frames: [fk(0, 0, 0), fk(0.3, d.x * 0.3, d.y * 0.3 - 22, -6 * sg, 1.05, 1.1), fk(0.5, d.x, d.y, 10 * sg, 1.15, 0.95, 1.3, g, 12), fk(0.62, d.x, d.y, 0, 1.18, 0.85), fk(1, 0, 0)] };
    case "charge":
      return { ms: 820, frames: [fk(0, 0, 0), fk(0.35, -d.x * 0.1, -d.y * 0.1, -6 * sg, 0.96, 1.05, 1.4, g, 22), fk(0.55, -d.x * 0.12, -d.y * 0.12, -6 * sg, 0.96, 1.05, 1.6, g, 28), fk(0.7, d.x * 0.18, d.y * 0.18, 4 * sg, 1.1, 1, 1.8, g, 30), fk(1, 0, 0)] };
    case "dance":
      return { ms: 1000, frames: [fk(0, 0, 0), fk(0.15, -4, -2, -8, 1, 1, 1.2, g, 10), fk(0.3, 4, -2, 8, 1, 1, 1.2, g, 10), fk(0.45, -4, -2, -8, 1, 1, 1.2, g, 10), fk(0.6, 4, -2, 8, 1, 1, 1.2, g, 10), fk(0.8, 0, -6, 0, 1.06, 1.06, 1.4, g, 14), fk(1, 0, 0)] };
    case "curl":
      return { ms: 900, frames: [fk(0, 0, 0), fk(0.3, 0, 6, 0, 0.82, 0.8, 1.5, g, 16), fk(0.75, 0, 6, 0, 0.82, 0.8, 1.5, g, 16), fk(1, 0, 0)] };
    case "heal":
      return { ms: 900, frames: [fk(0, 0, 0), fk(0.3, 0, -6, 0, 1.05, 1.08, 1.3, "#6df08a", 12), fk(0.55, 0, 0), fk(0.75, 0, -5, 0, 1.04, 1.06, 1.3, "#6df08a", 12), fk(1, 0, 0)] };
    case "roar":
      return { ms: 800, frames: [fk(0, 0, 0), fk(0.12, 0, 0, 0, 1.14, 1.14, 1.2, g, 12), fk(0.2, -2, 0, -2, 1.14, 1.14), fk(0.3, 2, 0, 2, 1.14, 1.14), fk(0.4, -2, 0, -2, 1.14, 1.14), fk(0.5, 2, 0, 2, 1.14, 1.14), fk(0.6, -1, 0, -1, 1.12, 1.12), fk(0.8, 0, 0, 0, 1.1, 1.1), fk(1, 0, 0)] };
    case "quake":
      return { ms: 650, frames: [fk(0, 0, 0), fk(0.25, 0, -16, 0, 0.96, 1.1), fk(0.45, 0, 3, 0, 1.12, 0.86), fk(0.55, 0, 0), fk(1, 0, 0)] };
    default:
      return { ms: 560, frames: [fk(0, 0, 0), fk(0.42, d.x, d.y, 0, 1.08, 1.08, 1.15, g, 8), fk(1, 0, 0)] };
  }
}

export const fil = (b = 1, h = 0, sat = 1, blur = 0) => `brightness(${b}) hue-rotate(${h}deg) saturate(${sat}) blur(${blur}px)`;
export const rk = (offset: number, x = 0, rot = 0, sx = 1, sy = 1, filter = fil(), opacity = 1): Keyframe => ({
  offset,
  transform: `translate(${x}%, 0%) rotate(${rot}deg) scale(${sx}, ${sy})`,
  filter,
  opacity,
});
/** How a Pokémon reacts to being hit by an attack of this type. `k` is -1 / 1: which way it is knocked back. */
export function reactAnim(type: string, k: number): { frames: Keyframe[]; ms: number } {
  switch (type) {
    case "Electric": {
      const f = [rk(0)];
      for (let i = 1; i <= 9; i++) f.push(rk(i / 10, i % 2 ? 5 : -5, 0, 1, 1, i % 2 ? fil(2.4, 0, 1.6) : fil(1.1)));
      f.push(rk(1));
      return { ms: 520, frames: f };
    }
    case "Fire": return { ms: 640, frames: [rk(0), rk(0.15, 2, 0, 1, 1, fil(1.6, -25, 3)), rk(0.3, -2), rk(0.45, 2, 0, 1, 1, fil(1.6, -25, 3)), rk(0.6), rk(0.75, 0, 0, 1, 1, fil(1.5, -25, 3)), rk(1)] };
    case "Ice": return { ms: 900, frames: [rk(0), rk(0.12, 0, 0, 0.96, 0.96, fil(1.8, 170, 2.2)), rk(0.7, 0, 0, 0.96, 0.96, fil(1.6, 170, 2)), rk(1)] };
    case "Water": return { ms: 600, frames: [rk(0), rk(0.2, k * 8, 0, 1.14, 0.86, fil(1.2, 190, 1.4)), rk(0.5, k * 3, 0, 0.94, 1.06), rk(1)] };
    case "Grass": return { ms: 640, frames: [rk(0), rk(0.2, -2, -9), rk(0.4, 2, 9), rk(0.6, -1, -6), rk(0.8, 0, 3), rk(1)] };
    case "Poison": return { ms: 640, frames: [rk(0), rk(0.2, 2, -4, 1, 1, fil(1.1, 250, 2)), rk(0.4, -2, 4, 1, 1, fil(1.1, 250, 2)), rk(0.7, 1, -2, 1, 1, fil(1.1, 250, 2)), rk(1)] };
    case "Psychic": return { ms: 700, frames: [rk(0), rk(0.2, 0, -9, 1, 1, fil(1.3, 300, 1.5)), rk(0.45, 0, 9, 1, 1, fil(1.3, 300, 1.5)), rk(0.7, 0, -5, 1, 1, fil(1.2, 300, 1.4)), rk(1)] };
    case "Ghost": return { ms: 800, frames: [rk(0), rk(0.2, 0, 0, 1, 1, fil(1, 0, 1, 1.5), 0.2), rk(0.4), rk(0.6, 0, 0, 1, 1, fil(1, 0, 1, 1.5), 0.2), rk(0.8), rk(1)] };
    case "Dark": return { ms: 640, frames: [rk(0), rk(0.15, 0, 0, 1, 1, fil(0.35)), rk(0.3, 3, 0, 1, 1, fil(0.35)), rk(0.45, -3, 0, 1, 1, fil(0.4)), rk(0.7, 0, 0, 1, 1, fil(0.55)), rk(1)] };
    case "Fairy": return { ms: 640, frames: [rk(0), rk(0.2, 0, 0, 1.12, 1.12, fil(1.7, 0, 1.6)), rk(0.4, 0, 0, 0.94, 0.94), rk(0.6, 0, 0, 1.08, 1.08, fil(1.4, 0, 1.4)), rk(1)] };
    case "Flying": return { ms: 640, frames: [rk(0), rk(0.5, k * 14, k * 180, 1, 1, fil(1.4)), rk(1, 0, k * 360)] };
    case "Bug": return { ms: 520, frames: [rk(0), rk(0.1, 2.5, 0, 1, 1, fil(1.5)), rk(0.2, -2.5), rk(0.3, 2.5, 0, 1, 1, fil(1.5)), rk(0.4, -2.5), rk(0.5, 2, 0, 1, 1, fil(1.5)), rk(0.6, -2), rk(1)] };
    case "Steel": return { ms: 560, frames: [rk(0), rk(0.1, 0, 0, 1, 1, fil(3, 0, 0.2)), rk(0.2, k * -3), rk(0.35, k * 3, 0, 1, 1, fil(1.6)), rk(1)] };
    default: return { ms: 620, frames: [rk(0), rk(0.18, k * 13, k * 7, 1, 1, fil(2.4)), rk(0.4, k * 9, k * 4, 1, 1, fil(1.2)), rk(0.7, k * 3), rk(1)] };
  }
}

/** The wiggle a flying attack takes on its way across, in percent of the scene height. */
export function pathY(type: string, t: number): number {
  const arc = Math.sin(Math.PI * t);
  switch (type) {
    case "Fire": return -13 * arc;
    case "Water": return -4 * arc;
    case "Electric": return (Math.floor(t * 8) % 2 ? 7 : -7) * arc;
    case "Psychic": case "Ghost": case "Fairy": return 7 * Math.sin(t * Math.PI * 4);
    case "Grass": case "Bug": return 5 * Math.sin(t * Math.PI * 6);
    case "Ice": case "Steel": case "Rock": return 0;
    default: return -8 * arc;
  }
}

