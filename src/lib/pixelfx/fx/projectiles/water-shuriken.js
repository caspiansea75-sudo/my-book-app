// @ts-nocheck
// Adapted from this library's Energy disc (the speed lines and flung sparks), with a four-point throwing star in place of the saw.
import { fit, TAU, WHITE } from "../../core/index.js";
import { beat, wake, spark } from "./_lib.js";

export const meta = {
  name: "Water shuriken",
  desc: "A four-point throwing star of water spinning flat out as it flies: bright leading edges on each blade, a hollow hub, droplets flung off the points, speed lines streaming behind.",
  tags: ["projectile", "shuriken", "star", "water", "directional", "loop"],
  size: [120, 56],
  origin: [92, 28],
  duration: 0.5,
  loop: true,
  fps: 30,
  bg: "sky",
  options: { palette: ["#06143a", "#0f3a8a", "#1f6fd8", "#3fa8ff", "#8fd8ff", "#d0f4ff", "#ffffff"], size: 15, speed: 220, seed: 5 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 7), R = o.size, V = o.speed, S = o.seed, D = meta.duration, left = -meta.origin[0] + 2;
  const rot = (TAU * 4 * t) / D;

  beat(t, D, 7, S + 4, (r) => r.range(0.12, 0.22), (age, life, r) => {
    const k = age / life, side = r.chance(0.5) ? -1 : 1, x0 = -2 - age * r.range(180, 260), len = r.range(8, 16) * (0.5 + k), y = side * (R * 0.6 + r.range(0.5, 4));
    if (x0 - len < left) return;
    p.line(x0, y, x0 - len, y, k < 0.35 ? C[5] : k < 0.7 ? C[4] : C[3], (u) => (u < 0.65 ? 1 : (1 - u) / 0.35));
  });
  p.glowLine(-2, 0, -24, 0, 7, C[3], 0.3);

  // droplets thrown off the points, then left behind in the air
  const SP = [WHITE, C[5], C[4], C[3]];
  beat(t, D, 16, S, (r) => r.range(0.12, 0.3), (age, life, r) => {
    const a = rot + Math.floor(r.range(0, 4)) * (TAU / 4), x0 = Math.cos(a) * R, y0 = Math.sin(a) * R, v = r.range(110, 210);
    const [x, y, vx, vy] = wake(x0, y0, -Math.sin(a) * v, Math.cos(a) * v, age, V * 0.6, 2.4, 60);
    if (x > left + 8 && Math.abs(y) < 26) spark(p, x, y, vx, vy, 1 - age / life, SP, 0.45, 0.014, 7);
  });

  // the star: a sharp four-point star with a round hole, filled with rippling water (blobs and bright light-lines that keep moving)
  const RI = R * 0.3, HOLE = Math.max(1.6, R * 0.16), Q = Math.PI / 2;
  const ax = R, bx = RI * Math.SQRT1_2, by = RI * Math.SQRT1_2, nx = by, ny = -(bx - ax), cc = nx * ax; // the straight edge from a tip to the next notch
  const T = (TAU * t) / D;
  p.shade(-R - 3, -R - 3, R + 3, R + 3, (x, y) => {
    const r = Math.hypot(x, y), th = Math.atan2(y, x);
    let ph = (((th - rot) % Q) + Q) % Q; if (ph > Q / 2) ph = Q - ph; // angle from the nearest tip
    const edge = cc / (nx * Math.cos(ph) + ny * Math.sin(ph));
    if (r > edge || r < HOLE) return;
    if (r < HOLE + 0.9) return C[5]; // the bright ring round the hole
    if (r > edge - 1.0) return WHITE; // the bright edge
    const lx = x * Math.cos(-rot) - y * Math.sin(-rot), ly = x * Math.sin(-rot) + y * Math.cos(-rot);
    const f = (Math.sin(lx * 0.62 + 1.7 * Math.sin(ly * 0.45 + T)) + Math.sin(ly * 0.58 - T + 1.6 * Math.sin(lx * 0.4)) + Math.sin((lx + ly) * 0.33 + T * 2)) / 3;
    if (Math.abs(f) < 0.16) return Math.abs(f) < 0.07 ? WHITE : C[5];
    return f > 0.35 ? C[2] : f < -0.4 ? C[2] : C[3] ;
  });
  // glints twinkling on the points
  for (let k = 0; k < 4; k++) {
    const a = rot + k * Q, gx = Math.cos(a) * R, gy = Math.sin(a) * R, s = Math.max(0, Math.sin(T * 2 + k * 1.9)) * 4;
    if (s > 0.8) { p.line(gx - s, gy, gx + s, gy, WHITE, (u) => 1 - Math.abs(u - 0.5) * 1.2); p.line(gx, gy - s, gx, gy + s, WHITE, (u) => 1 - Math.abs(u - 0.5) * 1.2); }
  }
  p.glow(0, 0, 14, C[3], 0.18);
  p.glow(0, 0, 3, C[5], 0.5);
}
