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
  options: { palette: ["#06143a", "#0f3a8a", "#1f6fd8", "#3fa8ff", "#8fd8ff", "#d0f4ff", "#ffffff"], size: 12, speed: 220, seed: 5 },
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

  // the star: four tapering blades, bright on the leading side of each, a hollow hub in a dark collar
  p.shade(-R - 3, -R - 3, R + 3, R + 3, (x, y) => {
    const r = Math.hypot(x, y), th = Math.atan2(y, x);
    if (r < 1.6) return;
    const q = Math.cos(2 * (th - rot)), pt = Math.pow(Math.abs(q), 2.4), edge = 3.1 + (R - 3.1) * pt;
    if (r > edge) return;
    if (r < 2.7) return C[1];
    const lead = Math.sin(2 * (th - rot)) > 0; // which side of the blade is turning into the water
    const u = r / edge;
    if (r > edge - 1.0) return lead ? WHITE : C[5];
    if (u > 0.8) return lead ? C[5] : C[4];
    return u > 0.5 ? (lead ? C[4] : C[3]) : lead ? C[3] : C[2];
  });
  p.glow(0, 0, 24, C[3], 0.35);
  p.glow(0, 0, 5, C[5], 0.3);
}
