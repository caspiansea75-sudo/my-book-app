/** The giant Water Shuriken of Mega Greninja: four curved blades of water around a dark hub, spinning, with droplets circling it. */
type G = CanvasRenderingContext2D;

/** One shuriken centred on (x, y). `R` is the radius to the blade tips, `spin` the turn in radians. `wet` (0..1) is how much water swirls round it. */
export function drawShuriken(g: G, x: number, y: number, R: number, spin: number, t: number, wet = 1, alpha = 1) {
  if (R < 1) return;
  g.save();
  g.translate(x, y);
  g.globalAlpha *= alpha;
  // soft glow
  g.save();
  g.globalCompositeOperation = "lighter";
  const gl = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.7);
  gl.addColorStop(0, "rgba(120,200,255,.55)");
  gl.addColorStop(1, "rgba(40,120,255,0)");
  g.fillStyle = gl;
  g.beginPath();
  g.arc(0, 0, R * 1.7, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // swirl of water: a translucent disc with two turning arcs
  if (wet > 0.05) {
    g.save();
    g.globalAlpha *= 0.5 * wet;
    const wd = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.05);
    wd.addColorStop(0, "rgba(180,230,255,.8)");
    wd.addColorStop(1, "rgba(60,140,255,.15)");
    g.fillStyle = wd;
    g.beginPath();
    g.arc(0, 0, R * 1.0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,.8)";
    g.lineWidth = Math.max(1, R * 0.05);
    g.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const a = -spin * 0.7 + (i * Math.PI * 2) / 3;
      g.beginPath();
      g.arc(0, 0, R * (0.62 + 0.12 * Math.sin(t * 4 + i)), a, a + 1.2);
      g.stroke();
    }
    g.restore();
  }
  // ripples spreading out from it
  if (wet > 0.05 && R > 14) {
    g.save();
    g.strokeStyle = "rgba(200,236,255,1)";
    g.lineWidth = Math.max(1, R * 0.025);
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.9 + i / 3) % 1;
      g.globalAlpha *= 0.4 * (1 - u) * wet;
      g.beginPath();
      g.arc(0, 0, R * (0.9 + u * 0.55), 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    g.restore();
  }
  // four curved blades, each filled with moving water
  g.rotate(spin);
  for (let k = 0; k < 4; k++) {
    g.save();
    g.rotate((k * Math.PI) / 2);
    g.beginPath();
    g.moveTo(R * 0.16, -R * 0.2);
    g.quadraticCurveTo(R * 0.62, -R * 0.52, R, R * 0.02);
    g.quadraticCurveTo(R * 0.55, -R * 0.02, R * 0.2, R * 0.2);
    g.closePath();
    const bg = g.createLinearGradient(0, -R * 0.3, 0, R * 0.2);
    bg.addColorStop(0, "#a6e0ff");
    bg.addColorStop(0.5, "#4aa4ff");
    bg.addColorStop(1, "#1d58c8");
    g.fillStyle = bg;
    g.fill();
    // the texture, clipped to the blade: caustic ripples scrolling towards the tip, a lighter belly, and bubbles rising inside
    g.save();
    g.clip();
    const ph = t * 3 + k * 1.7;
    g.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const y0 = -R * 0.3 + i * R * 0.13;
      g.beginPath();
      for (let x = R * 0.12; x <= R * 1.02; x += R * 0.07) {
        const y = y0 + Math.sin(x / R * 9 - ph * 2 + i * 1.3) * R * 0.035 - (x / R) * R * 0.04;
        if (x === R * 0.12) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = i % 2 ? "rgba(255,255,255,.38)" : "rgba(10,60,160,.4)";
      g.lineWidth = Math.max(1, R * 0.028);
      g.stroke();
    }
    const bl = g.createLinearGradient(R * 0.2, 0, R, 0);
    bl.addColorStop(0, "rgba(255,255,255,0)");
    bl.addColorStop(0.7, "rgba(210,242,255,.35)");
    bl.addColorStop(1, "rgba(255,255,255,.75)");
    g.fillStyle = bl;
    g.fillRect(R * 0.1, -R * 0.6, R, R * 0.8);
    if (R > 20) {
      g.strokeStyle = "rgba(255,255,255,.7)";
      g.lineWidth = Math.max(0.8, R * 0.018);
      for (let i = 0; i < 4; i++) {
        const u = (ph * 0.25 + i * 0.27 + k * 0.13) % 1;
        const bx = R * (0.28 + u * 0.6);
        const by = Math.sin(i * 5 + k) * R * 0.06 - u * R * 0.05;
        g.beginPath();
        g.arc(bx, by, R * (0.022 + 0.018 * ((i + k) % 3)), 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.restore();
    g.lineWidth = Math.max(1.2, R * 0.045);
    g.strokeStyle = "#0a2f73";
    g.stroke();
    // foam along the edge: a broken white line that creeps towards the tip
    g.save();
    g.setLineDash([R * 0.09, R * 0.06]);
    g.lineDashOffset = -t * R * 0.5;
    g.beginPath();
    g.moveTo(R * 0.22, R * 0.2);
    g.quadraticCurveTo(R * 0.55, -R * 0.02, R * 0.98, R * 0.02);
    g.strokeStyle = "rgba(255,255,255,.75)";
    g.lineWidth = Math.max(1, R * 0.03);
    g.stroke();
    g.restore();
    // bright edge along the leading side
    g.beginPath();
    g.moveTo(R * 0.24, -R * 0.2);
    g.quadraticCurveTo(R * 0.62, -R * 0.46, R * 0.94, 0);
    g.strokeStyle = "rgba(255,255,255,.9)";
    g.lineWidth = Math.max(1, R * 0.03);
    g.stroke();
    // a sparkle at the tip
    if (R > 18) {
      g.fillStyle = "rgba(255,255,255,.95)";
      const tw = 0.6 + 0.4 * Math.sin(t * 12 + k * 2);
      g.beginPath();
      g.arc(R * 0.97, R * 0.01, R * 0.035 * tw, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  // the hub: dark centre with a white ring and a highlight
  g.beginPath();
  g.arc(0, 0, R * 0.2, 0, Math.PI * 2);
  g.fillStyle = "#0b2a66";
  g.fill();
  g.lineWidth = Math.max(1.2, R * 0.05);
  g.strokeStyle = "#e9f8ff";
  g.stroke();
  g.beginPath();
  g.arc(-R * 0.05, -R * 0.06, R * 0.06, 0, Math.PI * 2);
  g.fillStyle = "rgba(255,255,255,.9)";
  g.fill();
  g.rotate(-spin);
  // droplets circling it
  if (wet > 0.05 && R > 14) {
    g.fillStyle = "#cfeeff";
    for (let i = 0; i < 8; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 8;
      const rr = R * (1.12 + 0.08 * Math.sin(t * 7 + i * 2));
      g.beginPath();
      g.arc(Math.cos(a) * rr, Math.sin(a) * rr, Math.max(1.2, R * 0.045), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}
