/**
 * Chaos Flux (Fighting), built like the "Shimmering Flux of Chaos" sheet: a glassy crimson cone with a glowing mesh drives
 * forward, chaotic ribbons of red and violet energy twist behind it, blood-dark droplets splatter off, sparkles glint,
 * crimson motes linger and a distortion wave rolls ahead of the point.
 */
type G = CanvasRenderingContext2D;
type Emit = (p: Record<string, unknown>) => void;
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function drawFlux(g: G, ang: number, cx: number, cy: number, R: number, p: number, t: number, emit0: Emit) {
  const emit: Emit = (o) => emit0({ grow: 0, ...o });
  const al = sm(0, 0.12, p) * (1 - sm(0.78, 1, p));
  const reach = R * (4.2 + 1.6 * sm(0, 0.35, p));       // where the point is
  const Lc = R * 3.6, rb = R * 1.5;                       // cone length, base radius
  g.save(); g.translate(cx, cy); g.rotate(ang);
  g.lineCap = "round"; g.lineJoin = "round";
  // chaotic ribbons: red and violet strands twisting behind the cone
  g.globalCompositeOperation = "lighter";
  for (let j = 0; j < 6; j++) {
    const col = j % 3 === 0 ? "rgba(150,70,255,.55)" : j % 3 === 1 ? "rgba(255,50,90,.7)" : "rgba(255,150,170,.6)";
    g.strokeStyle = col; g.lineWidth = 3 + (j % 3) * 1.6; g.globalAlpha = al;
    g.beginPath();
    for (let i = 0; i <= 22; i++) {
      const q = i / 22, x = reach - Lc * 0.85 - q * R * 6.5;
      const y = Math.sin(q * 5.5 + t * 8 + j * 1.4) * R * 0.55 * (0.2 + q) + Math.sin(q * 2.3 - t * 5 + j) * R * 0.3 * q;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  // the cone: translucent crimson glass
  const ax = reach, bx = reach - Lc;
  g.globalCompositeOperation = "source-over";
  g.beginPath(); g.moveTo(ax, 0); g.lineTo(bx, -rb); g.ellipse(bx, 0, rb * 0.35, rb, 0, -Math.PI / 2, Math.PI / 2); g.closePath();
  const cg = g.createLinearGradient(ax, 0, bx, 0);
  cg.addColorStop(0, "rgba(255,150,170,.75)"); cg.addColorStop(0.5, "rgba(210,30,60,.6)"); cg.addColorStop(1, "rgba(90,8,30,.65)");
  g.globalAlpha = al; g.fillStyle = cg; g.fill();
  g.globalCompositeOperation = "lighter";
  g.strokeStyle = "#ff6a86"; g.lineWidth = 2; g.shadowColor = "#ff2a4a"; g.shadowBlur = 12; g.globalAlpha = al; g.stroke();
  g.shadowBlur = 0;
  // the glowing mesh: lines running to the point (turning) and rings round the body
  g.lineWidth = 1.2; g.strokeStyle = "#ffc0cc"; g.globalAlpha = al * 0.8;
  g.beginPath();
  for (let j = 0; j < 7; j++) { const th = (j / 7) * TAU + t * 5; g.moveTo(ax, 0); g.lineTo(bx + Math.cos(th) * rb * 0.35, Math.sin(th) * rb); }
  g.stroke();
  for (let i = 1; i < 5; i++) { const q = i / 5, x = ax - Lc * q, rr = rb * q; g.globalAlpha = al * 0.55; g.beginPath(); g.ellipse(x, 0, rr * 0.35, rr, 0, 0, TAU); g.stroke(); }
  // distortion wave: a pale arc rolling out ahead of the point
  g.strokeStyle = "rgba(255,225,230,.9)"; g.lineWidth = 5; g.globalAlpha = al * 0.18;
  g.beginPath(); g.ellipse(ax + R * 0.3, 0, R * (0.6 + p * 1.4), R * (1.1 + p * 1.3), 0, -1.2, 1.2); g.stroke();
  g.restore();
  // blood-dark droplets, glints and lingering crimson motes thrown off as it goes
  if (p < 0.85) {
    const wx = cx + Math.cos(ang) * (reach - Lc * 0.4), wy = cy + Math.sin(ang) * (reach - Lc * 0.4);
    for (let i = 0; i < 2; i++) emit({ kind: "dot", x: wx + rnd(-R, R), y: wy + rnd(-R, R) * 0.6, vx: rnd(-90, 90) - Math.cos(ang) * 120, vy: rnd(-140, 30), g: 520, life: rnd(0.5, 0.9), max: 0.9, size: rnd(2.5, 5), color: Math.random() < 0.6 ? "#7a0d22" : "#d3213f" });
    if (Math.random() < 0.7) emit({ kind: "star", x: wx + rnd(-R * 1.6, R), y: wy + rnd(-R, R), vx: rnd(-30, 30), vy: rnd(-40, 0), g: 0, life: rnd(0.4, 0.8), max: 0.8, size: rnd(2.5, 4.5), rot: rnd(0, 3), vr: rnd(-6, 6), color: "#ffd0d8" });
    if (Math.random() < 0.5) emit({ kind: "glow", x: wx + rnd(-R * 2, R), y: wy + rnd(-R, R), vx: rnd(-20, 20), vy: rnd(-30, -5), g: 0, life: rnd(0.8, 1.4), max: 1.4, size: rnd(4, 8), grow: -2, color: "#ff3a5a" });
  }
}

/** The splatter where it lands. */
export function fluxBurst(emit0: Emit, x: number, y: number, ang: number, s: number) {
  const emit: Emit = (o) => emit0({ grow: 0, ...o });
  for (let i = 0; i < 26; i++) { const a = ang + rnd(-1.3, 1.3), v = rnd(120, 480); emit({ kind: "dot", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, g: 620, life: rnd(0.5, 1.1), max: 1.1, size: rnd(2.5, 6.5), color: i % 3 ? "#7a0d22" : "#e0304c" }); }
  emit({ kind: "glow", x, y, vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, size: s * 0.5, grow: s * 2.2, color: "#ff2a4a" });
  emit({ kind: "ring", x, y, vx: 0, vy: 0, g: 0, life: 0.5, max: 0.5, size: 6, grow: s * 3.2, color: "#ffc0cc" });
}
