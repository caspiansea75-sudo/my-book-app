/**
 * How much detail the heavy move effects draw this frame (1 = everything, down to about 0.5).
 * The renderer sets it each frame: it drops quickly when several heavy effects overlap (several fighters casting together)
 * or the device falls behind, and climbs back slowly. One effect on its own always draws in full.
 */
export let LOD = 1;
export function setLod(v: number) { LOD = v; }
/** a count scaled by the detail level (never below `min`) */
export const lodN = (n: number, min = 2) => Math.max(Math.min(n, min), Math.round(n * LOD));
/** a blur radius, or none when the detail level is down: shadowBlur is the slowest thing a canvas can do */
export const fxBlur = (v: number) => (LOD < 0.9 ? 0 : v);
