/**
 * Pokémon Mystery Dungeon sprites from the PMDCollab SpriteCollab project: real walk, attack, shoot, rumble and hurt animations
 * in eight directions, for the fighter that faces any way the camera sees it.
 *
 *   sheet layout: one PNG per animation (Walk-Anim.png, Attack-Anim.png ...), 8 rows, one frame per column.
 *   rows run: down, down-right, right, up-right, up, up-left, left, down-left.
 *   AnimData.xml gives each animation's frame size and how long each frame is shown (in 1/60 s).
 *
 * Everything is optional: while a sheet loads, or if it cannot be had, `pmdFrame` returns null and the caller keeps its usual picture.
 * Switch it on or off with pmdSetEnabled() (the sprite button in the game; remembered in localStorage "arena.pmd", "0" = off).
 * The sprites are community fan art of Nintendo / Game Freak characters: keep the game non-commercial and credit the PMDCollab artists.
 */
export type PmdState = "walk" | "idle" | "hurt" | "attack" | "shoot" | "rumble";
/** `k`: draw size relative to the usual size; `oy`: how far down (as a fraction of the usual size) to move it so its feet sit where a trimmed Showdown picture's would */
export type PmdFrame = { el: HTMLCanvasElement; k: number; oy: number };

let BASES = ["https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite", "https://sprites.pmdcollab.org"];
/** where the sheets come from (the first that answers wins); for tests, or a mirror of your own */
export function pmdSetBases(b: string[]) { BASES = b; SHEETS.clear(); FRAMES.clear(); }

const NAMES = ["Walk", "Idle", "Hurt", "Attack", "Shoot", "Rumble"] as const;
const COUNT: Record<string, number> = { Walk: 4, Idle: 1, Hurt: 2, Attack: 13, Shoot: 12, Rumble: 13 }; // when the XML is out of reach
type Cell = { fw: number; fh: number; dur: number[] | null };
type Sheet = { imgs: Map<string, HTMLImageElement>; xml: Map<string, Cell> | null; xmlDone: boolean; failed: boolean; at: number; can: number; w0: number; k: number; oy: number };

const SHEETS = new Map<number, Sheet>();
const FRAMES = new Map<string, HTMLCanvasElement>();

let ENABLED: boolean | undefined;
export function pmdEnabled(): boolean {
  if (ENABLED === undefined) { try { ENABLED = localStorage.getItem("arena.pmd") !== "0"; } catch { ENABLED = true; } }
  return ENABLED && typeof Image !== "undefined";
}

/** turn the PMD pictures on or off (off = the earlier Showdown animations); remembered between visits */
export function pmdSetEnabled(on: boolean) {
  ENABLED = on;
  try { localStorage.setItem("arena.pmd", on ? "1" : "0"); } catch { /* storage unavailable */ }
}

const dex4 = (n: number) => String(n).padStart(4, "0");

function parseXml(txt: string): Map<string, Cell> | null {
  try {
    const doc = new DOMParser().parseFromString(txt, "text/xml");
    const out = new Map<string, Cell>();
    doc.querySelectorAll("Anims > Anim").forEach((a) => {
      const name = a.querySelector("Name")?.textContent?.trim();
      const fw = Number(a.querySelector("FrameWidth")?.textContent), fh = Number(a.querySelector("FrameHeight")?.textContent);
      if (!name || !(fw > 0) || !(fh > 0)) return;
      const d = Array.from(a.querySelectorAll("Durations > Duration")).map((x) => Number(x.textContent) || 4);
      out.set(name, { fw, fh, dur: d.length ? d : null });
    });
    return out.size ? out : null;
  } catch { return null; }
}

function begin(num: number): Sheet {
  const sh: Sheet = { imgs: new Map(), xml: null, xmlDone: false, failed: false, at: performance.now(), can: 0, w0: 0, k: 1, oy: 0 };
  SHEETS.set(num, sh);
  const id = dex4(num);
  if (typeof fetch === "function") {
    fetch(`${BASES[0]}/${id}/AnimData.xml`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("http"))))
      .then((t) => { sh.xml = parseXml(t); })
      .catch(() => {})
      .then(() => { sh.xmlDone = true; });
  } else sh.xmlDone = true;
  for (const name of NAMES) {
    const load = (bi: number) => {
      const im = new Image();
      // the first host (GitHub) allows cross-origin reads, which lets us measure the sprite; others are loaded plainly
      if (bi === 0) im.crossOrigin = "anonymous";
      im.onload = () => sh.imgs.set(name, im);
      im.onerror = () => { if (bi + 1 < BASES.length) load(bi + 1); else if (name === "Walk") { sh.failed = true; sh.at = performance.now(); } };
      im.src = `${BASES[bi]}/${id}/${name}-Anim.png`;
    };
    load(0);
  }
  return sh;
}

const cellOf = (sh: Sheet, name: string, im: HTMLImageElement): Cell => {
  const x = sh.xml?.get(name);
  if (x) return x;
  const n = COUNT[name] ?? 1;
  return { fw: Math.floor(im.naturalWidth / n), fh: Math.floor(im.naturalHeight / 8), dur: null };
};

/** which frame, for how far through the animation it is (`t` in 0..1) or, for the looping ones, the running clock */
function frameIndex(name: string, n: number, dur: number[] | null, clock: number): number {
  if (n <= 1) return 0;
  if (name === "Walk" || name === "Idle") {
    if (dur && dur.length >= n) {
      const total = dur.reduce((a, b) => a + b, 0) || n * 8;
      let tick = (clock * (name === "Walk" ? 28 : 12)) % total;
      for (let i = 0; i < n; i++) { if (tick < dur[i]!) return i; tick -= dur[i]!; }
      return n - 1;
    }
    return Math.floor(clock * (name === "Walk" ? 6 : 3)) % n;
  }
  return Math.max(0, Math.min(n - 1, Math.floor(clock * n)));
}

/**
 * The picture for a Pokémon right now, or null (not loaded, not available, or switched off).
 * @param num   national dex number
 * @param state what it is doing
 * @param fa    the way it faces on the screen, in radians (0 right, PI/2 towards the viewer / down, -PI/2 away / up)
 * @param t     for walk and idle the running clock in seconds; for hurt, attack, shoot and rumble how far through it is (0..1)
 */
export function pmdFrame(num: number, state: PmdState, fa: number, t: number): PmdFrame | null {
  if (!pmdEnabled() || !(num > 0 && num <= 1025)) return null;
  let sh = SHEETS.get(num);
  if (!sh) sh = begin(num);
  else if (sh.failed) { if (performance.now() - sh.at < 30000) return null; SHEETS.delete(num); return null; }
  const walk = sh.imgs.get("Walk");
  if (!walk || !sh.xmlDone) return null;
  if (!sh.can) {
    // one square canvas big enough for every animation, so frames of different sizes keep the same pixel scale
    let c = 0;
    for (const [nm, im] of sh.imgs) { const cell = cellOf(sh, nm, im); c = Math.max(c, cell.fw, cell.fh); }
    const w = cellOf(sh, "Walk", walk);
    sh.can = Math.ceil(c / 8) * 8; sh.w0 = Math.max(w.fw, w.fh);
    // measure the sprite itself (all eight views of the first walk frame): the picture is drawn so its own box, not the padded canvas, has the usual size,
    // and its lowest pixel lands where a trimmed picture's bottom edge would
    let bw = 0, bh = 0, bsum = 0, bn = 0, ok = false;
    try {
      const m = document.createElement("canvas"); m.width = w.fw; m.height = w.fh;
      const mg = m.getContext("2d", { willReadFrequently: true })!;
      const nf = Math.max(1, Math.floor(walk.naturalWidth / w.fw));
      // every frame of the walk in every direction: the size is the biggest the body gets, the feet line is the average (a stretched leg dips below it, a tucked one rises above)
      for (let r = 0; r < 8; r++) for (let fi = 0; fi < nf; fi++) {
        mg.clearRect(0, 0, w.fw, w.fh);
        mg.drawImage(walk, fi * w.fw, r * w.fh, w.fw, w.fh, 0, 0, w.fw, w.fh);
        const d = mg.getImageData(0, 0, w.fw, w.fh).data;
        let x0 = w.fw, x1 = -1, y0 = w.fh, y1 = -1;
        for (let y = 0; y < w.fh; y++) for (let x = 0; x < w.fw; x++) if (d[(y * w.fw + x) * 4 + 3]! > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 >= x0 && y1 >= y0) { ok = true; bw = Math.max(bw, x1 - x0 + 1); bh = Math.max(bh, y1 - y0 + 1); bsum += y1 + 1; bn++; }
      }
    } catch { ok = false; }
    let bb = bn ? bsum / bn : 0;
    if (!ok) { bw = w.fw * 0.7; bh = w.fh * 0.7; bb = w.fh * 0.5 + bh * 0.5; } // guess when it cannot be measured
    const m0 = Math.max(bw, bh, 1);
    sh.k = sh.can / m0;
    const bottomPx = (sh.can - w.fh) / 2 + bb; // lowest pixel, in canvas pixels from the top
    // body() puts a square picture's centre at -0.05 of its size, and a trimmed one's bottom at (h/2 - 0.05) of it
    const cur = sh.k * (bottomPx / sh.can - 0.5 - 0.05);
    const want = bh / m0 / 2 - 0.05;
    sh.oy = want - cur;
  }
  const want: Record<PmdState, string[]> = { walk: ["Walk"], idle: ["Idle", "Walk"], hurt: ["Hurt", "Idle", "Walk"], attack: ["Attack", "Walk"], shoot: ["Shoot", "Attack", "Walk"], rumble: ["Rumble", "Attack", "Walk"] };
  const name = want[state].find((nm) => sh!.imgs.has(nm))!;
  const im = sh.imgs.get(name)!;
  const cell = cellOf(sh, name, im);
  const n = Math.max(1, Math.floor(im.naturalWidth / cell.fw));
  const row = ((Math.round((Math.PI / 2 - fa) / (Math.PI / 4)) % 8) + 8) % 8;
  const fi = name === "Hurt" ? (t < 0.5 ? 0 : Math.min(1, n - 1)) : frameIndex(name, n, cell.dur, t);
  const key = `${num}|${name}|${row}|${fi}|${sh.xml ? 1 : 0}`;
  let cv = FRAMES.get(key);
  if (!cv) {
    cv = document.createElement("canvas"); cv.width = cv.height = sh.can;
    const g = cv.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(im, fi * cell.fw, row * cell.fh, cell.fw, cell.fh, Math.floor((sh.can - cell.fw) / 2), Math.floor((sh.can - cell.fh) / 2), cell.fw, cell.fh);
    FRAMES.set(key, cv);
    if (FRAMES.size > 4000) FRAMES.delete(FRAMES.keys().next().value as string);
  }
  return { el: cv, k: sh.k, oy: sh.oy };
}
