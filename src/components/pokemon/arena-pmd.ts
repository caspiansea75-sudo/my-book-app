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
export function pmdSetBases(b: string[]) { BASES = b; SHEETS.clear(); FRAMES.clear(); TRACKER = undefined; TRACKING = false; }

const NAMES = ["Walk", "Idle", "Hurt", "Attack", "Shoot", "Rumble"] as const;
const COUNT: Record<string, number> = { Walk: 4, Idle: 1, Hurt: 2, Attack: 13, Shoot: 12, Rumble: 13 }; // when the XML is out of reach
type Cell = { fw: number; fh: number; dur: number[] | null };
type Sheet = { imgs: Map<string, HTMLImageElement>; xml: Map<string, Cell> | null; xmlDone: boolean; failed: boolean; at: number; can: number; w0: number; k: number; oy: number };

const SHEETS = new Map<string, Sheet>();
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

function begin(skey: string, num: number, sub: string): Sheet {
  const sh: Sheet = { imgs: new Map(), xml: null, xmlDone: false, failed: false, at: performance.now(), can: 0, w0: 0, k: 1, oy: 0 };
  SHEETS.set(skey, sh);
  const id = dex4(num) + (sub ? "/" + sub : "");
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
      im.onerror = () => { if (bi + 1 < BASES.length) load(bi + 1); else if (name === "Walk") { sh.failed = true; sh.at = performance.now(); say(`w${id}`, `no Walk sheet at ${id} on any host; the old sprite is used`); } };
      im.src = `${BASES[bi]}/${id}/${name}-Anim.png`;
    };
    load(0);
  }
  return sh;
}

/**
 * Forms (Mega, Gigantamax, Origin ...) live in numbered sub-folders of a Pokémon's folder; the project's tracker.json says which number is which form.
 * It is fetched once, only when a form is first needed, and only the names are kept. If it cannot be had, or no name fits, the caller keeps the old picture.
 */
let TRACKER: Map<number, [string, string][]> | undefined;
let TRACKING = false;
function loadTracker() {
  if (TRACKER || TRACKING || typeof fetch !== "function") return;
  const root = BASES[0]!.replace(/\/sprite\/?$/, "");
  if (root === BASES[0]) { TRACKER = new Map(); return; }
  TRACKING = true;
  fetch(`${root}/tracker.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
    .then((j: Record<string, any>) => {
      const m = new Map<number, [string, string][]>();
      for (const [k, v] of Object.entries(j)) {
        const num = Number(k);
        const forms = v && (v.subgroups ?? v.forms);
        if (!(num > 0) || !forms || typeof forms !== "object") continue;
        const list: [string, string][] = [];
        for (const [fk, fv] of Object.entries(forms as Record<string, any>)) if (fv && typeof fv.name === "string") list.push([fk, fv.name]);
        if (list.length) m.set(num, list);
      }
      if (!m.size) say("shape", "tracker.json loaded but no form lists were found in it; its first keys are", Object.keys(j).slice(0, 5), "and one entry looks like", JSON.stringify(Object.values(j)[1] ?? null)?.slice(0, 300));
      TRACKER = m;
    })
    .catch((e) => { say("trk", "could not load tracker.json (forms stay on the old sprites):", String(e)); TRACKER = new Map(); });
}
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const SAID = new Set<string>();
const say = (key: string, ...a: unknown[]) => { if (SAID.has(key)) return; SAID.add(key); try { console.info("[pmd]", ...a); } catch { /* no console */ } };
/** the sub-folder for a form, given the part of our form id after the species ("megax", "gmax", "black" ...): a folder name, null if there is none, undefined while the list is still loading */
function formFolder(num: number, suffix: string): string | null | undefined {
  loadTracker();
  if (!TRACKER) return undefined;
  const list = TRACKER.get(num);
  if (!list) { say(`n${num}`, `no form list for #${num} in the tracker (${TRACKER.size} species listed)`); return null; }
  const sfx = norm(suffix);
  const names = list.map(([k, n]) => [k, norm(n)] as const).filter(([k]) => k !== "0000");
  const has = (n: string, w: string) => n.includes(w);
  let hit: readonly [string, string] | undefined;
  if (sfx === "gmax") hit = names.find(([, n]) => has(n, "gigantamax") || has(n, "gmax") || has(n, "gigamax"));
  else if (/^mega[xyz]$/.test(sfx)) { const l = sfx[4]!; hit = names.find(([, n]) => n === sfx || (has(n, "mega") && n.endsWith(l))); }
  else if (sfx === "mega") {
    // a single Mega: any form called Mega that is not X / Y / Z (when it is the only one, take it whatever it ends with)
    const m = names.filter(([, n]) => has(n, "mega"));
    hit = m.length === 1 ? m[0] : m.find(([, n]) => !/[xyz]$/.test(n)) ?? (m.length ? undefined : undefined);
  } else hit = names.find(([, n]) => n === sfx) ?? names.find(([, n]) => has(n, sfx));
  if (!hit) say(`f${num}${sfx}`, `no PMD form for #${num} "${suffix}"; the tracker lists:`, list.map(([k, n]) => `${k}=${n}`).join(", "));
  return hit ? hit[0] : null;
}

/** what the loader knows, for the browser console: arenaPmd() */
export function pmdReport() {
  return {
    enabled: pmdEnabled(),
    tracker: TRACKER ? `${TRACKER.size} species` : TRACKING ? "loading" : "not asked yet",
    sheets: [...SHEETS].map(([k, v]) => `${k}: ${v.failed ? "FAILED" : v.imgs.size ? "ok (" + [...v.imgs.keys()].join(",") + ")" : "loading"}`),
  };
}
if (typeof window !== "undefined") (window as unknown as { arenaPmd?: () => unknown }).arenaPmd = pmdReport;

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
 * @param form  a Mega, Gigantamax or other form: the part of its id after the species name ("megax", "gmax", "black" ...), omitted for the base form
 * @param t     for walk and idle the running clock in seconds; for hurt, attack, shoot and rumble how far through it is (0..1)
 */
function pmdFrame0(num: number, state: PmdState, fa: number, t: number, form?: string): PmdFrame | null {
  if (!pmdEnabled() || !(num > 0 && num <= 1025)) return null;
  let sub = "";
  if (form) {
    const fo = formFolder(num, form);
    if (!fo) return null; // still loading the list, or this form has no PMD pictures
    sub = fo;
  }
  const skey = `${num}/${sub}`;
  let sh = SHEETS.get(skey);
  if (!sh) sh = begin(skey, num, sub);
  else if (sh.failed) { if (sub) NOART.add(skey); if (performance.now() - sh.at < 30000 || sub) return null; SHEETS.delete(skey); return null; }
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
  const key = `${skey}|${name}|${row}|${fi}|${sh.xml ? 1 : 0}`;
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

/** Forms whose picture folder does not exist at PMDCollab (many Megas are not drawn there), so they are not asked for again. */
const NOART = new Set<string>();
/**
 * The picture for a Pokémon right now, or null. A form that PMDCollab has not drawn (no entry in its list, or an empty folder) gets null for good,
 * so the old (SDN) sprite is used for it and its folder is not asked for again. While the list or pictures are still loading it also returns null. */
export function pmdFrame(num: number, state: PmdState, fa: number, t: number, form?: string): PmdFrame | null {
  if (!form) return pmdFrame0(num, state, fa, t);
  if (!pmdEnabled() || !(num > 0 && num <= 1025)) return null;
  const fo = formFolder(num, form);
  if (fo === undefined) return null; // still loading the list
  const skey = `${num}/${fo ?? ""}`;
  if (fo !== null && !NOART.has(skey)) {
    const r = pmdFrame0(num, state, fa, t, form);
    if (r) return r;
    if (!NOART.has(skey)) return null; // its pictures are still arriving
  }
  return null; // PMD has not drawn this form: the caller keeps the old (SDN) sprite
}
