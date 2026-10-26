/**
 * Arena Brawl multiplayer wire format. Pure functions (no browser APIs), so it is the same in the app and in tests.
 *
 * One member (the host) runs the real fight. Everybody else sends the host their controls, and the host sends back what
 * the arena looks like now. To keep that small, only what CHANGED since the last message goes out; a full copy is sent
 * now and then (and to anybody who just arrived), so a lost message heals itself within a second or two.
 */
import { speciesOf } from "@/lib/pokemon/arena-data";
import type { Ev, Fighter, Input, State } from "@/lib/pokemon/arena-engine";

/* ------------------------------------------------------------------ diff */

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const NONE = Symbol("same");
const isObj = (v: unknown): v is Record<string, J> => !!v && typeof v === "object" && !Array.isArray(v);

/** What has to change to turn `a` into `b` (NONE when they are the same). Arrays are replaced whole. */
export function diff(a: J, b: J): J {
  if (a === b) return NONE;
  if (isObj(a) && isObj(b)) {
    const out: Record<string, J> = {};
    let any = false;
    for (const k of Object.keys(b)) {
      const d = diff(a[k], b[k]);
      if (d !== NONE) {
        out[k] = d;
        any = true;
      }
    }
    for (const k of Object.keys(a)) {
      if (!(k in b)) {
        out[k] = null;
        any = true;
      }
    }
    return any ? out : NONE;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i] || JSON.stringify(x) === JSON.stringify(b[i]))) return NONE;
  return b;
}

/** Apply a patch made by `diff` and return the result (`target` is changed in place when it is an object). */
export function patch(target: J, p: J): J {
  if (isObj(p)) {
    const t = isObj(target) ? target : {};
    for (const k of Object.keys(p)) t[k] = patch(t[k], p[k]);
    return t;
  }
  return p;
}

/** A copy that is safe to send: no Sets, no long descriptions, numbers rounded to two decimals. */
export function plain<T>(v: T): J {
  return JSON.parse(
    JSON.stringify(v, (k, x) => {
      if (x instanceof Set) return undefined;
      if (k === "desc" || k === "blurb") return undefined;
      return typeof x === "number" ? Math.round(x * 100) / 100 : x;
    }),
  );
}

/* -------------------------------------------------------------- snapshots */

export type Collection = { u: Record<string, J>; r: number[] };
export type Snap = {
  k: "s";
  /** Counts up: an old message arriving late is ignored. */
  q: number;
  full: boolean;
  h: J;
  f: Collection;
  p: Collection;
  z: Collection;
  i: Collection;
  o: Collection;
  e: Ev[];
};

type Keyed = { id: number };
const HEADER_KEYS = ["time", "phase", "introT", "wave", "score", "slow", "zPending", "storm", "field", "stage", "winnerId", "place"] as const;

function fighterWire(f: Fighter): J {
  const { sp, ...rest } = f;
  return plain({ ...rest, spId: sp.id });
}

function collect(prev: Map<number, J>, list: Keyed[], make: (x: J) => J, full: boolean): Collection {
  const out: Collection = { u: {}, r: [] };
  const seen = new Set<number>();
  for (const item of list) {
    const cur = make(item);
    seen.add(item.id);
    const before = full ? undefined : prev.get(item.id);
    if (before === undefined) out.u[item.id] = cur;
    else {
      const d = diff(before, cur);
      if (d !== NONE) out.u[item.id] = d;
    }
    prev.set(item.id, cur);
  }
  for (const id of [...prev.keys()]) {
    if (!seen.has(id)) {
      prev.delete(id);
      out.r.push(id);
    }
  }
  return out;
}

/** Host side: turns the state of the fight into small messages. */
export class SnapshotEncoder {
  private q = 0;
  private prev = { f: new Map<number, J>(), p: new Map<number, J>(), z: new Map<number, J>(), i: new Map<number, J>(), o: new Map<number, J>() };
  private prevHeader: J = {};

  /**
   * A complete copy of the fight right now, for somebody who just arrived or as a safety net. It does not disturb the
   * chain of small messages the others are following.
   */
  keyframe(S: State): Snap {
    const tmp = new SnapshotEncoder();
    tmp.q = this.q - 1;
    return tmp.encode(S, [], true);
  }

  encode(S: State, events: Ev[], full: boolean): Snap {
    if (full) {
      for (const m of Object.values(this.prev)) m.clear();
      this.prevHeader = {};
    }
    const header: J = {};
    const whole = plain(Object.fromEntries(HEADER_KEYS.map((k) => [k, S[k]])));
    const dh = diff(this.prevHeader, whole);
    if (dh !== NONE) Object.assign(header, dh);
    this.prevHeader = whole;
    if (full) {
      header.holes = plain(S.holes);
      header.pools = plain(S.pools);
      header.mode = S.mode;
      header.mp = !!S.mp;
    }
    return {
      k: "s",
      q: ++this.q,
      full,
      h: header,
      f: collect(this.prev.f, S.fighters, fighterWire, full),
      p: collect(this.prev.p, S.projs, (x) => plain(x), full),
      z: collect(this.prev.z, S.zones, (x) => plain(x), full),
      i: collect(this.prev.i, S.items, (x) => plain(x), full),
      o: collect(this.prev.o, S.obs, (x) => plain(x), full),
      e: events,
    };
  }
}

const emptyState = (): State =>
  ({
    mode: "royale", time: 0, nextId: 1, fighters: [], projs: [], zones: [], events: [], phase: "intro", introT: 0, wave: 1, score: 0,
    freeze: 0, slow: 0, zPending: null, stage: "stone", obs: [], holes: [], pools: [], items: [], itemT: 0, hazardT: 0, field: "none",
    perks: [], taken: [], storm: { r: 520, on: false }, winner: false, place: 0, perfects: 0, easy: 1, mp: true,
  }) as State;

type Smooth = { tx: number; ty: number };

/** Client side: rebuilds the fight from the host's messages and glides things to their newest positions. */
export class SnapshotDecoder {
  readonly S: State = emptyState();
  private lastQ = 0;
  private got = false;
  private maps = { f: new Map<number, J>(), p: new Map<number, J>(), z: new Map<number, J>(), i: new Map<number, J>(), o: new Map<number, J>() };
  private goal = new Map<object, Smooth>();
  /** Events that arrived since the last call to `takeEvents`. */
  private events: Ev[] = [];

  /** True once the first full copy has arrived. */
  get ready() {
    return this.got;
  }

  private merge(key: keyof SnapshotDecoder["maps"], c: Collection, list: J[], glide: boolean) {
    const m = this.maps[key];
    for (const id of c.r) {
      const o = m.get(id);
      if (o) this.goal.delete(o);
      m.delete(id);
    }
    for (const [idStr, p] of Object.entries(c.u)) {
      const id = Number(idStr);
      let o = m.get(id);
      const px = o?.x;
      const py = o?.y;
      o = patch(o ?? {}, p);
      if (key === "f" && o.spId && !o.sp) o.sp = speciesOf(o.spId);
      if (key === "p" && !o.hits) o.hits = new Set();
      if (key === "f" && o.dash && !o.dash.hit) o.dash.hit = new Set();
      m.set(id, o);
      if (glide && typeof o.x === "number") {
        if (px === undefined || Math.hypot(o.x - px, o.y - py) > 160) this.goal.set(o, { tx: o.x, ty: o.y });
        else {
          this.goal.set(o, { tx: o.x, ty: o.y });
          o.x = px;
          o.y = py;
        }
      }
    }
    list.length = 0;
    for (const o of m.values()) list.push(o);
  }

  /** Feed one message from the host. Returns false when it was stale and ignored. */
  apply(s: Snap): boolean {
    if (!s.full && !this.got) return false; // wait for a full copy first
    if (s.full && this.got && s.q < this.lastQ) return false; // an old full copy that arrived late
    if (s.full) {
      for (const m of Object.values(this.maps)) m.clear();
      this.goal.clear();
      this.lastQ = 0;
    } else if (s.q <= this.lastQ) return false;
    this.lastQ = s.q;
    this.got = true;
    const S = this.S;
    const h = s.h;
    for (const k of Object.keys(h)) {
      if (k === "storm") S.storm = patch({ ...S.storm }, h.storm);
      else (S as J)[k] = patch((S as J)[k], h[k]);
    }
    this.merge("f", s.f, S.fighters, true);
    this.merge("p", s.p, S.projs, true);
    this.merge("z", s.z, S.zones, false);
    this.merge("i", s.i, S.items, false);
    this.merge("o", s.o, S.obs, false);
    if (s.e.length) this.events.push(...s.e);
    return true;
  }

  takeEvents(): Ev[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Move what is drawn a step closer to where the host says it is. */
  glide(dt: number) {
    const k = 1 - Math.exp(-Math.max(0, dt) * 28);
    for (const [o, g] of this.goal) {
      const x = o as { x: number; y: number };
      x.x += (g.tx - x.x) * k;
      x.y += (g.ty - x.y) * k;
    }
  }
}

/* ----------------------------------------------------------------- inputs */

export type InputMsg = {
  k: "in";
  q: number;
  mx: number;
  my: number;
  aim: { x: number; y: number } | null;
  /** Held buttons as bits: 1-8 are the four moves. */
  held: number;
  /** How many times each move / roll / gimmick button was pressed so far: a press is never lost when a message is. */
  c: [number, number, number, number];
  d: number;
  u: number;
};

/** Client side: remembers presses and builds the next message. */
export class InputSender {
  private q = 0;
  private c: [number, number, number, number] = [0, 0, 0, 0];
  private d = 0;
  private u = 0;
  /**
   * Call once per frame with the controls as built for a single-player game and which move buttons are being held.
   * (`inp.cast` mixes "pressed this frame" with "held", so a press is whatever is not a hold.)
   */
  next(inp: Input, held: [boolean, boolean, boolean, boolean]): InputMsg {
    for (let i = 0; i < 4; i++) if (inp.cast[i] && !held[i]) this.c[i]!++;
    if (inp.dodge) this.d++;
    if (inp.ult) this.u++;
    return {
      k: "in",
      q: ++this.q,
      mx: Math.round(inp.mx * 100) / 100,
      my: Math.round(inp.my * 100) / 100,
      aim: inp.aim ? { x: Math.round(inp.aim.x), y: Math.round(inp.aim.y) } : null,
      held: held.reduce((n, h, i) => n | (h ? 1 << i : 0), 0),
      c: [...this.c] as InputMsg["c"],
      d: this.d,
      u: this.u,
    };
  }
}

/** Host side: turns the newest message of a member into the controls for the next step. */
export class InputReceiver {
  private last = new Map<number, { q: number; c: number[]; d: number; u: number }>();
  private latest = new Map<number, InputMsg>();
  put(fid: number, m: InputMsg) {
    const cur = this.latest.get(fid);
    if (!cur || m.q > cur.q) this.latest.set(fid, m);
  }
  forget(fid: number) {
    this.latest.delete(fid);
    this.last.delete(fid);
  }
  /** Controls for one step. A press that happened since last time fires once; holds keep firing. */
  take(fid: number): Input {
    const m = this.latest.get(fid);
    if (!m) return { mx: 0, my: 0, aim: null, cast: [false, false, false, false], dodge: false, ult: false };
    const prev = this.last.get(fid) ?? { q: 0, c: [...m.c], d: m.d, u: m.u }; // first message: no phantom presses
    const cast = [0, 1, 2, 3].map((i) => m.c[i]! > prev.c[i]! || !!(m.held & (1 << i))) as [boolean, boolean, boolean, boolean];
    const inp: Input = { mx: m.mx, my: m.my, aim: m.aim, cast, dodge: m.d > prev.d, ult: m.u > prev.u };
    this.last.set(fid, { q: m.q, c: [...m.c], d: m.d, u: m.u });
    return inp;
  }
}
