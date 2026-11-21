/**
 * Stylised effects built from the VFX reference reels (all smooth canvas drawing, no pixel art):
 *   pillar   a column of light from the sky: dark base, speed lines, diamond sparkles, spiral ribbons, ground spikes, sparks
 *   slash    a sharp tapered crescent slash with a dark underlay, a bright edge and two thin trailing arcs
 *   tornado  a ribbon funnel: stacked, rotating bands, white wind ribbons and flying debris
 *   smoke    a cartoon smoke explosion: lumpy brown puffs that rise, lit from inside by orange glow
 *   circle   a magic circle on the floor with runes that spin, a star in the middle and rising embers
 * Everything draws around (0,0) = the effect's spot on the floor (up is negative y). No shadowBlur.
 */
type G = CanvasRenderingContext2D;
type Emit = (p: Record<string, unknown>) => void;
export type StyKind = "pillar" | "slash" | "tornado" | "smoke" | "circle";
export type Sty = { k: StyKind; x: number; y: number; r: number; t: number; life: number; seed: number; ang: number; type: string; acc: number };
const TAU = Math.PI * 2;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hs = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** dark / mid / light colours per type (rgb strings) */
const PAL: Record<string, [string, string, string]> = {
  Fire: ["70,10,10", "255,90,40", "255,225,150"],
  Water: ["10,30,80", "60,150,255", "210,240,255"],
  Electric: ["50,40,0", "255,210,40", "255,250,200"],
  Grass: ["15,50,15", "90,200,80", "220,255,200"],
  Ice: ["20,50,90", "120,210,255", "240,252,255"],
  Fighting: ["60,15,10", "230,90,60", "255,220,200"],
  Poison: ["40,10,60", "170,80,220", "245,210,255"],
  Ground: ["60,40,15", "205,160,90", "250,235,190"],
  Flying: ["40,60,100", "140,190,255", "245,250,255"],
  Psychic: ["70,10,60", "255,100,200", "255,225,245"],
  Bug: ["40,50,10", "170,210,60", "245,255,200"],
  Rock: ["60,45,25", "200,170,110", "250,240,200"],
  Ghost: ["25,10,50", "140,100,230", "225,210,255"],
  Dragon: ["30,20,90", "110,100,255", "220,215,255"],
  Dark: ["15,10,30", "120,80,200", "225,205,255"],
  Steel: ["40,50,60", "170,190,215", "245,250,255"],
  Fairy: ["80,20,70", "255,150,220", "255,235,250"],
  Normal: ["60,50,40", "220,200,170", "255,250,235"],
};
const pal = (t: string) => PAL[t] ?? PAL.Normal!;
const rgba = (c: string, a: number) => `rgba(${c},${Math.max(0, Math.min(1, a))})`;

const LIFE: Record<StyKind, number> = { pillar: 2.4, slash: 0.42, tornado: 2.6, smoke: 1.3, circle: 1.0 };
export const newSty = (k: StyKind, x: number, y: number, r: number, type: string, ang = 0): Sty =>
  ({ k, x, y, r: Math.max(30, r), t: 0, life: LIFE[k], seed: Math.random() * 90, ang, type, acc: 0 });

const diamond = (g: G, x: number, y: number, s: number) => {
  g.beginPath(); g.moveTo(x, y - s * 1.6); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s * 1.6); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s * 1.6); g.fill();
};

/** Is this effect drawn lying on the floor? */
export const flatSty = (s: Sty) => s.k === "circle";

export function drawSty(g: G, s: Sty) {
  const u = Math.min(1, s.t / s.life), [dk, md, lt] = pal(s.type), R = s.r, t = s.t, sd = s.seed;
  g.save();
  g.lineCap = "round"; g.lineJoin = "round";
  switch (s.k) {
    case "pillar": {
      const grow = sm(0, 0.12, u), fade = 1 - sm(0.68, 1, u), W = R * 0.42 * (1 - 0.25 * sm(0.5, 1, u)), H = 460 * grow;
      // dark base on the floor
      g.save(); g.scale(1, 0.34);
      const bg = g.createRadialGradient(0, 0, 0, 0, 0, W * 2.1);
      bg.addColorStop(0, rgba(dk, 0.85 * fade)); bg.addColorStop(0.7, rgba(dk, 0.55 * fade)); bg.addColorStop(1, rgba(dk, 0));
      g.fillStyle = bg; g.beginPath(); g.arc(0, 0, W * 2.1, 0, TAU); g.fill(); g.restore();
      // ground spikes: dark shards with a bright edge
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + hs(i + sd) * 0.4, d = W * (1.1 + 0.9 * hs(i + 7)), h = (28 + 52 * hs(i + 3)) * sm(0.02, 0.2, u) * (1 - sm(0.55, 0.95, u));
        const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.34, w = 7 + 7 * hs(i + 9);
        g.fillStyle = rgba(dk, 0.95 * fade); g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + (hs(i) - 0.5) * 8, y - h); g.lineTo(x + w, y); g.closePath(); g.fill();
        g.strokeStyle = rgba(md, 0.9 * fade); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + (hs(i) - 0.5) * 8, y - h); g.stroke();
      }
      // back ribbons (behind the column)
      const ribbon = (i: number, front: boolean) => {
        const pts: [number, number][] = [];
        for (let k = 0; k <= 22; k++) {
          const q = k / 22, th = q * 7 + t * 5 + i * 2.1, yy = -H * q * 0.92;
          const front0 = Math.cos(th) > 0;
          if (front0 !== front) { pts.push([NaN, NaN]); continue; }
          pts.push([Math.sin(th) * W * (0.85 + 0.35 * q), yy]);
        }
        const wid = 9 * (1 - 0.3 * i / 3);
        for (const [c, lw, a] of [[dk, wid, 0.9], [md, wid * 0.55, 0.95], [lt, wid * 0.18, 1]] as [string, number, number][]) {
          g.strokeStyle = rgba(c, a * fade); g.lineWidth = lw; g.beginPath(); let pen = false;
          for (const [x, y] of pts) { if (Number.isNaN(x)) { pen = false; continue; } if (!pen) { g.moveTo(x, y); pen = true; } else g.lineTo(x, y); }
          g.stroke();
        }
      };
      for (let i = 0; i < 4; i++) ribbon(i, false);
      // the column itself
      g.beginPath(); g.moveTo(-W * 0.5, 0); g.lineTo(-W * 0.62, -H); g.lineTo(W * 0.62, -H); g.lineTo(W * 0.5, 0); g.closePath();
      const cg = g.createLinearGradient(-W * 0.6, 0, W * 0.6, 0);
      cg.addColorStop(0, rgba(md, 0.9 * fade)); cg.addColorStop(0.35, rgba(lt, 0.98 * fade)); cg.addColorStop(0.65, rgba(lt, 0.98 * fade)); cg.addColorStop(1, rgba(md, 0.9 * fade));
      g.fillStyle = cg; g.fill();
      // dark root where it meets the floor
      const rg = g.createLinearGradient(0, 0, 0, -H * 0.3);
      rg.addColorStop(0, rgba(dk, 0.95 * fade)); rg.addColorStop(1, rgba(dk, 0));
      g.fillStyle = rg; g.fillRect(-W * 0.62, -H * 0.3, W * 1.24, H * 0.3);
      // speed lines
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 16; i++) {
        const x = (hs(i + sd) - 0.5) * W * 1.0, ph = (t * (1.5 + hs(i + 2)) + hs(i * 3)) % 1, len = 40 + 90 * hs(i + 5), y = -H * ph;
        const lg = g.createLinearGradient(x, y + len, x, y); lg.addColorStop(0, rgba(lt, 0)); lg.addColorStop(1, rgba(lt, 0.85 * fade));
        g.strokeStyle = lg; g.lineWidth = 1.4 + hs(i + 1) * 1.4; g.beginPath(); g.moveTo(x, y + len); g.lineTo(x, y); g.stroke();
      }
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 4; i++) ribbon(i, true);
      // diamond sparkles
      g.globalCompositeOperation = "lighter"; g.fillStyle = rgba(lt, 0.95 * fade);
      for (let i = 0; i < 9; i++) {
        const ph = (t * (0.6 + hs(i)) + hs(i * 5)) % 1; diamond(g, (hs(i + sd + 4) - 0.5) * W * 1.8, -H * ph * 0.9, 3 + 4 * hs(i + 6) * (1 - ph));
      }
      // the glow at the very top
      const tg = g.createRadialGradient(0, -H, 0, 0, -H, W * 1.5);
      tg.addColorStop(0, rgba(lt, 0.7 * fade)); tg.addColorStop(1, rgba(lt, 0)); g.fillStyle = tg; g.beginPath(); g.arc(0, -H, W * 1.5, 0, TAU); g.fill();
      break;
    }
    case "slash": {
      g.rotate(s.ang);
      const L = R * 1.5, p = sm(0, 0.3, u), fade = 1 - sm(0.45, 1, u);
      const arc = (len: number, bow: number, th: number, off: number, c: string, a: number, tail: number) => {
        // a tapered crescent: both ends sharp, thickest at the middle, drawn from the tail up to the head
        const x0 = -len * (0.5 + tail * 0.5) + len * 0.0, x1 = x0 + len * p;
        g.beginPath(); g.moveTo(x0, off);
        g.quadraticCurveTo((x0 + x1) / 2, off - bow - th * p, x1, off + bow * 0.1);
        g.quadraticCurveTo((x0 + x1) / 2, off - bow + th * p * 0.2, x0, off);
        g.closePath(); g.fillStyle = rgba(c, a * fade); g.fill();
      };
      arc(L * 1.05, 22, 15, 3, dk, 0.95, 0.0);
      arc(L, 20, 10, 0, md, 0.95, 0.0);
      g.globalCompositeOperation = "lighter";
      arc(L * 0.95, 19, 4.5, -1, lt, 1, 0.0);
      arc(L * 0.7, 28, 3, -9, md, 0.8, -0.25);
      arc(L * 0.55, 34, 2.2, 10, lt, 0.8, -0.1);
      // flash at the head
      const hx = -L * 0.5 + L * p, hg = g.createRadialGradient(hx, 0, 0, hx, 0, 20);
      hg.addColorStop(0, rgba(lt, 0.95 * fade)); hg.addColorStop(1, rgba(lt, 0)); g.fillStyle = hg; g.beginPath(); g.arc(hx, 0, 20, 0, TAU); g.fill();
      break;
    }
    case "tornado": {
      const grow = sm(0, 0.15, u), fade = 1 - sm(0.75, 1, u), H = 230 * grow, spin = t * 7;
      const radius = (q: number) => R * (0.14 + 0.5 * Math.pow(q, 1.35)) * (0.9 + 0.1 * Math.sin(t * 3 + q * 6));
      // the funnel: many thin bands, each a little offset by the spin so it looks twisted
      for (let i = 0; i < 26; i++) {
        const q = i / 25, y = -H * q, rr = radius(q), sx = Math.sin(spin + q * 5) * rr * 0.12;
        const shade = (i % 2 ? 0.55 : 0.8);
        g.fillStyle = rgba(i % 2 ? dk : md, 0.62 * shade * fade);
        g.beginPath(); g.ellipse(sx, y, rr, rr * 0.2, 0, 0, TAU); g.fill();
      }
      // white wind ribbons wrapped round it (back half, then front half)
      for (const front of [false, true]) {
        for (let i = 0; i < 6; i++) {
          const q = (i + 0.5) / 6, y = -H * q, rr = radius(q) * 1.28, ph = spin * (1.1 + hs(i) * 0.5) + i * 1.7, span = 2.2 + hs(i + 4);
          g.strokeStyle = rgba(lt, 0.88 * fade); g.lineWidth = 3 + 3.5 * (1 - q) + hs(i + 8) * 2;
          g.beginPath(); let pen = false;
          for (let k = 0; k <= 16; k++) {
            const a = ph + (k / 16) * span, isF = Math.sin(a) > 0;
            if (isF !== front) { pen = false; continue; }
            const x = Math.cos(a) * rr, yy = y + Math.sin(a) * rr * 0.2 - (k / 16) * 6;
            if (!pen) { g.moveTo(x, yy); pen = true; } else g.lineTo(x, yy);
          }
          g.stroke();
        }
      }
      // debris
      g.fillStyle = rgba(dk, 0.95 * fade);
      for (let i = 0; i < 12; i++) {
        const q = hs(i + sd), a = spin * (1.2 + hs(i)) + i * 2.4, rr = radius(q) * (1.15 + hs(i + 3) * 0.4);
        g.save(); g.translate(Math.cos(a) * rr, -H * q + Math.sin(a) * rr * 0.2); g.rotate(a * 2); g.fillRect(-3, -2, 6 + hs(i + 6) * 4, 4); g.restore();
      }
      break;
    }
    case "smoke": {
      const fade = 1 - sm(0.55, 1, u), pop = 1 - Math.pow(1 - sm(0, 0.35, u), 3), rise = sm(0, 1, u) * 26;
      // dark "stem" puffs first, the lumpy cap on top
      const puffs: [number, number, number][] = [];
      for (let i = 0; i < 11; i++) {
        const cap = i >= 3, a = hs(i + sd) * TAU, d = cap ? R * 0.42 * Math.sqrt(hs(i + 2)) : R * 0.12 * hs(i + 4);
        puffs.push([Math.cos(a) * d, cap ? -R * 0.55 - Math.abs(Math.sin(a)) * d * 0.75 : -R * 0.1 - i * R * 0.12, R * (cap ? 0.2 + 0.16 * hs(i + 8) : 0.1 + 0.06 * hs(i))]);
      }
      const base = lt === pal("Fire")[2] ? "150,110,70" : "175,160,140";
      puffs.forEach(([x, y, r], i) => {
        const rr = r * (0.4 + 0.6 * pop), px = x * pop, py = y * pop - rise * (0.3 + 0.7 * hs(i));
        g.fillStyle = rgba("58,38,24", 0.95 * fade); g.beginPath(); g.arc(px, py + rr * 0.18, rr, 0, TAU); g.fill();
        g.fillStyle = rgba(base, 0.98 * fade); g.beginPath(); g.arc(px - rr * 0.06, py - rr * 0.06, rr * 0.9, 0, TAU); g.fill();
        g.fillStyle = rgba("205,175,130", 0.55 * fade); g.beginPath(); g.arc(px - rr * 0.25, py - rr * 0.3, rr * 0.45, 0, TAU); g.fill();
      });
      // orange fire glowing through the gaps, strongest early
      g.globalCompositeOperation = "lighter";
      const ga = (1 - sm(0.05, 0.7, u)) * fade;
      puffs.forEach(([x, y, r], i) => {
        if (i % 2) return;
        const rr = r * 0.9 * pop, px = x * pop, py = y * pop - rise * 0.5, gg = g.createRadialGradient(px, py, 0, px, py, rr);
        gg.addColorStop(0, rgba(pal("Fire")[2], 0.95 * ga)); gg.addColorStop(0.5, rgba(pal("Fire")[1], 0.7 * ga)); gg.addColorStop(1, rgba(pal("Fire")[1], 0));
        g.fillStyle = gg; g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill();
      });
      break;
    }
    case "circle": {
      const open = sm(0, 0.25, u), fade = 1 - sm(0.6, 1, u), rr = R * open, spin = t * 2.2;
      g.globalCompositeOperation = "lighter";
      const cg = g.createRadialGradient(0, 0, 0, 0, 0, rr); cg.addColorStop(0, rgba(md, 0.35 * fade)); cg.addColorStop(1, rgba(md, 0));
      g.fillStyle = cg; g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill();
      for (const [f, lw, c] of [[1, 3, lt], [0.86, 1.6, md], [0.52, 2, md]] as [number, number, string][]) {
        g.strokeStyle = rgba(c, 0.95 * fade); g.lineWidth = lw; g.beginPath(); g.arc(0, 0, rr * f, 0, TAU); g.stroke();
      }
      // rune ticks between the two outer rings, turning one way
      g.strokeStyle = rgba(lt, 0.9 * fade); g.lineWidth = 2;
      for (let i = 0; i < 28; i++) {
        const a = spin + (i / 28) * TAU, l = (hs(i + sd) > 0.5 ? 0.1 : 0.05) * rr;
        g.beginPath(); g.moveTo(Math.cos(a) * rr * 0.88, Math.sin(a) * rr * 0.88); g.lineTo(Math.cos(a) * (rr * 0.88 + l), Math.sin(a) * (rr * 0.88 + l)); g.stroke();
      }
      // a star inside, turning the other way
      g.strokeStyle = rgba(md, 0.95 * fade); g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 5; i++) { const a = -spin * 1.4 + ((i * 2) % 5) * (TAU / 5); const x = Math.cos(a) * rr * 0.5, y = Math.sin(a) * rr * 0.5; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      break;
    }
  }
  g.restore();
}

/** Sparks and embers around an effect while it plays. */
export function tickSty(s: Sty, dt: number, emit0: Emit) {
  const emit: Emit = (o) => emit0({ grow: 0, ...o });
  s.acc += dt; const step = 0.05; if (s.acc < step) return; s.acc -= step;
  const u = s.t / s.life, [, md, lt] = pal(s.type), col = (c: string) => `rgb(${c})`, R = s.r;
  switch (s.k) {
    case "pillar": if (u < 0.7) emit({ kind: "spark", x: s.x + rnd(-R, R) * 0.5, y: s.y + rnd(-6, 6), vx: rnd(-60, 60), vy: rnd(-260, -80), g: 160, life: rnd(0.5, 1), max: 1, size: rnd(1.6, 3), color: Math.random() < 0.5 ? col(lt) : col(md) }); break;
    case "slash": if (u < 0.35) { const a = s.ang + rnd(-0.5, 0.5); emit({ kind: "spark", x: s.x, y: s.y, vx: Math.cos(a) * rnd(120, 360), vy: Math.sin(a) * rnd(120, 360) - 40, g: 300, life: rnd(0.2, 0.45), max: 0.45, size: rnd(1.4, 2.6), color: col(lt) }); } break;
    case "tornado": emit({ kind: "dot", x: s.x + rnd(-R, R) * 0.4, y: s.y + rnd(-8, 8), vx: rnd(-80, 80), vy: rnd(-160, -30), g: 40, life: rnd(0.5, 1), max: 1, size: rnd(1.6, 3), color: Math.random() < 0.5 ? "#e8f2ff" : col(md) }); break;
    case "smoke": if (u < 0.4) emit({ kind: "spark", x: s.x + rnd(-R, R) * 0.4, y: s.y - R * 0.4, vx: rnd(-160, 160), vy: rnd(-260, -60), g: 520, life: rnd(0.4, 0.8), max: 0.8, size: rnd(1.6, 3), color: Math.random() < 0.5 ? "#ffb84a" : "#ff7a2a" }); break;
    case "circle": if (u < 0.8) { const a = rnd(0, TAU), d = R * rnd(0.2, 0.9); emit({ kind: "spark", x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d * 0.5, vx: rnd(-20, 20), vy: rnd(-140, -50), g: -30, life: rnd(0.5, 0.9), max: 0.9, size: rnd(1.6, 3), color: Math.random() < 0.5 ? col(lt) : col(md) }); } break;
  }
}
