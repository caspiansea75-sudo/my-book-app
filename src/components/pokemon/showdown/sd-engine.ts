/**
 * Fight Showdown: the rules of the fight. No DOM, no drawing: a plain, serialisable world that is stepped forward at a
 * fixed rate, so the same code runs the computer match, a friend on the same device, and the host side of an online room
 * (the guest just receives the world and draws it).
 *
 * Every Pokémon fights with its own four moves from the Arena data (shot, fan of shots, homing shot, beam, dash, burrow,
 * burst, lobbed blast, lightning line, shield, heal, power-up, floor trap, grab), plus a basic attack chain and a super move.
 */
import type { MoveDef, MoveKind, StatusKind } from "@/lib/pokemon/arena-data";
import { typeMult } from "@/lib/pokemon/shared";
import { TYPE_COLOR } from "@/lib/pokemon/shared";
import { fighterOf, type Level } from "./sd-data";

export const STAGE_W = 1600;
export const MAX_SPAN = 980;
export const ROUND_TIME = 60;
const GRAV = 2600;
const JUMP_V = 930;
const WINS_NEEDED = 2;
/** damage of a move with power 1.0 */
const BASE = 8;

export type Input = { l: boolean; r: boolean; u: boolean; d: boolean; a: boolean; m1: boolean; m2: boolean; m3: boolean; m4: boolean; s: boolean };
export const NO_INPUT: Input = { l: false, r: false, u: false, d: false, a: false, m1: false, m2: false, m3: false, m4: false, s: false };
export const BUTTONS = ["a", "m1", "m2", "m3", "m4", "s", "u"] as const;

export type PState = "idle" | "walk" | "jump" | "atk" | "block" | "hurt" | "down" | "getup" | "ko" | "win";
export type AtkKind = "jab" | "kick" | "move" | "super";
/** what a button press asks for: the two basic attacks, the super, or one of the four moves */
export type Act = "jab" | "kick" | "super" | "m0" | "m1" | "m2" | "m3";
export type Atk = { kind: AtkKind; t: number; hit: boolean; n: number; fired: boolean; rush: number; mi: number; tick: number };

export type Pl = {
  slot: 0 | 1;
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: 1 | -1;
  hp: number;
  maxHp: number;
  meter: number;
  st: PState;
  t: number;
  atk: Atk | null;
  chain: number;
  chainT: number;
  combo: number;
  comboT: number;
  /** seconds until each of the four moves can be used again */
  mcd: number[];
  stun: number;
  inv: number;
  flash: number;
  rounds: number;
  hitstop: number;
  buf: Act | "";
  bufT: number;
  prev: Input;
  maxCombo: number;
  dealt: number;
  /** a burn, poison, paralysis, freeze, sleep or confusion, and how long it lasts */
  sk: StatusKind | "";
  skT: number;
  buff: { atk: number; def: number; spe: number; t: number };
  guardT: number;
  regen: number;
  regenT: number;
};

export type Proj = {
  id: number;
  owner: 0 | 1;
  /** ball: a flying shot · beam: the big super beam · bomb: a blast that lands after a moment · bolt: a line that strikes after a moment · trap: a patch on the floor */
  kind: "ball" | "beam" | "bomb" | "bolt" | "trap";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  delay: number;
  color: string;
  type: string;
  hits: number[];
  pierce: boolean;
  big: boolean;
  homing: boolean;
  status: { kind: StatusKind; chance: number } | null;
  /** which Arena move it came from, and how it looks */
  mv: string;
  art: MoveKind | "super";
  dir: 1 | -1;
  len: number;
  hz: "" | "spikes" | "toxic" | "rocks";
};

export type Phase = "intro" | "fight" | "ko" | "roundEnd" | "matchEnd";
export type EvKind = "hit" | "block" | "spec" | "super" | "ko" | "jump" | "land" | "text" | "round" | "fight" | "win" | "ready" | "clash" | "boom" | "time" | "nova" | "zap" | "dig";
export type Ev = { n: number; k: EvKind; x: number; y: number; heavy?: boolean; text?: string; color?: string; slot?: number; r?: number; ty?: string };

export type World = {
  seed: number;
  rs: number;
  tick: number;
  time: number;
  phase: Phase;
  pt: number;
  round: number;
  timer: number;
  p: [Pl, Pl];
  pr: Proj[];
  pid: number;
  evs: Ev[];
  en: number;
  shake: number;
  freeze: number;
  superBy: -1 | 0 | 1;
  superName: string;
  roundWinner: -1 | 0 | 1;
  match: -1 | 0 | 1;
  line: string;
  lineN: number;
  perfect: boolean;
  firstBlood: boolean;
};

/* ------------------------------------------------------------------ helpers */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sign = (v: number) => (v < 0 ? -1 : 1);

function rnd(w: World): number {
  // mulberry32
  let t = (w.rs = (w.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function emit(w: World, e: Omit<Ev, "n">) {
  w.evs.push({ ...e, n: ++w.en });
  if (w.evs.length > 28) w.evs.splice(0, w.evs.length - 28);
}
function say(w: World, text: string) {
  w.line = text;
  w.lineN++;
}

function newPl(slot: 0 | 1, id: string): Pl {
  const f = fighterOf(id);
  return {
    slot, id, x: 0, y: 0, vx: 0, vy: 0, face: slot === 0 ? 1 : -1,
    hp: f.maxHp, maxHp: f.maxHp, meter: 0, st: "idle", t: 0, atk: null, chain: 0, chainT: 0,
    combo: 0, comboT: 0, mcd: f.moves.map((m) => (m.cd > 6 ? 3 : 0)), stun: 0, inv: 0, flash: 0, rounds: 0, hitstop: 0, buf: "", bufT: 0,
    prev: { ...NO_INPUT }, maxCombo: 0, dealt: 0,
    sk: "", skT: 0, buff: { atk: 1, def: 1, spe: 1, t: 0 }, guardT: 0, regen: 0, regenT: 0,
  };
}

function resetRound(w: World) {
  for (const p of w.p) {
    const f = fighterOf(p.id);
    p.hp = p.maxHp;
    p.x = STAGE_W / 2 + (p.slot === 0 ? -210 : 210);
    p.y = 0; p.vx = 0; p.vy = 0;
    p.face = p.slot === 0 ? 1 : -1;
    p.st = "idle"; p.t = 0; p.atk = null; p.chain = 0; p.chainT = 0;
    p.combo = 0; p.comboT = 0; p.mcd = f.moves.map((m) => (m.cd > 6 ? 3 : 0.4)); p.stun = 0; p.inv = 0; p.flash = 0;
    p.hitstop = 0; p.buf = ""; p.bufT = 0; p.prev = { ...NO_INPUT };
    p.sk = ""; p.skT = 0; p.buff = { atk: 1, def: 1, spe: 1, t: 0 }; p.guardT = 0; p.regen = 0; p.regenT = 0;
  }
  w.pr = [];
  w.timer = ROUND_TIME;
  w.phase = "intro";
  w.pt = 0;
  w.roundWinner = -1;
  w.freeze = 0;
  w.superBy = -1;
  w.perfect = true;
  w.firstBlood = false;
  emit(w, { k: "round", x: STAGE_W / 2, y: 0, text: `ROUND ${w.round}` });
}

export function newWorld(a: string, b: string, seed = 1): World {
  const w: World = {
    seed, rs: seed >>> 0, tick: 0, time: 0, phase: "intro", pt: 0, round: 1, timer: ROUND_TIME,
    p: [newPl(0, a), newPl(1, b)], pr: [], pid: 0, evs: [], en: 0, shake: 0, freeze: 0, superBy: -1, superName: "",
    roundWinner: -1, match: -1, line: "", lineN: 0, perfect: true, firstBlood: false,
  };
  resetRound(w);
  say(w, `${fighterOf(a).name} vs ${fighterOf(b).name}: the fight is on!`);
  return w;
}

/* ------------------------------------------------------------- attack table */

type AtkDef = { start: number; act: number; rec: number; dmg: number; reach: number; h0: number; h1: number; kb: number; stun: number; meter: number; lunge: number; launch: boolean };
const ATK: Record<"jab" | "kick" | "super", AtkDef> = {
  jab: { start: 0.06, act: 0.07, rec: 0.12, dmg: 5, reach: 78, h0: 0.25, h1: 0.8, kb: 130, stun: 0.27, meter: 5, lunge: 90, launch: false },
  kick: { start: 0.14, act: 0.09, rec: 0.26, dmg: 10, reach: 98, h0: 0.05, h1: 0.7, kb: 360, stun: 0.4, meter: 8, lunge: 140, launch: false },
  super: { start: 0.06, act: 0.5, rec: 0.55, dmg: 26, reach: 150, h0: 0, h1: 1, kb: 620, stun: 0.9, meter: 0, lunge: 0, launch: true },
};

/** seconds of wind-up before each kind of move does its thing (a move may set its own) */
const WINDUP: Record<MoveKind, number> = { proj: 0.16, spread: 0.2, homing: 0.2, beam: 0.24, dash: 0.12, burrow: 0.12, nova: 0.26, lob: 0.3, bolt: 0.4, guard: 0.1, heal: 0.22, buff: 0.26, hazard: 0.2, grab: 0.16 };
const BEAM_STEP = 0.11;
const DIG_TIME = 0.5;

export const windupOf = (m: MoveDef) => m.windup ?? WINDUP[m.kind];
/** total time a move takes to play out */
export function moveLength(m: MoveDef): number {
  const wu = windupOf(m);
  switch (m.kind) {
    case "beam": return wu + (m.n ?? 6) * BEAM_STEP + 0.22;
    case "dash": return wu + clamp((m.range ?? 200) / 1100, 0.14, 0.36) + 0.28;
    case "burrow": return wu + DIG_TIME + 0.32;
    case "bolt": return wu + 0.32;
    case "grab": return wu + 0.46;
    case "nova": return wu + 0.34;
    case "lob": return wu + 0.28;
    case "heal": case "buff": case "guard": case "hazard": return wu + 0.26;
    default: return wu + 0.26;
  }
}

function busy(p: Pl) {
  return p.st === "hurt" || p.st === "down" || p.st === "getup" || p.st === "ko" || p.st === "win";
}

function startAct(w: World, p: Pl, act: Act, n = 0): boolean {
  const f = fighterOf(p.id);
  if (act === "m0" || act === "m1" || act === "m2" || act === "m3") {
    const i = Number(act[1]);
    const m = f.moves[i];
    if (!m || (p.mcd[i] ?? 0) > 0) return false;
    p.mcd[i] = m.cd;
    p.st = "atk"; p.t = 0; p.buf = "";
    p.atk = { kind: "move", t: 0, hit: false, n: 0, fired: false, rush: 0, mi: i, tick: 0 };
    return true;
  }
  const kind: "jab" | "kick" | "super" = act;
  p.st = "atk"; p.t = 0; p.buf = "";
  p.atk = { kind, t: 0, hit: false, n, fired: false, rush: 0, mi: 0, tick: 0 };
  if (kind === "super") {
    p.meter = 0;
    w.freeze = 0.62;
    w.superBy = p.slot;
    w.superName = f.sup.name;
    p.inv = 0.7;
    emit(w, { k: "super", x: p.x, y: p.y, slot: p.slot, text: f.sup.name, color: f.color });
    say(w, `${f.name} unleashes ${f.sup.name}!`);
  }
  return true;
}

/* ------------------------------------------------------------------- damage */

type HitOpts = {
  dmg: number; kb: number; stun: number; launch: boolean; type?: string; unblockable?: boolean; meter: number; heavy: boolean;
  status?: { kind: StatusKind; chance: number } | null; light?: boolean;
};

function applyStatus(w: World, def: Pl, st: { kind: StatusKind; chance: number }) {
  if (def.sk || def.st === "ko" || rnd(w) >= st.chance) return;
  def.sk = st.kind;
  const names: Record<StatusKind, [string, number, string]> = {
    brn: ["Burned!", 4.5, "#ff7a3a"], psn: ["Poisoned!", 5, "#b36be0"], par: ["Paralyzed!", 5, "#ffd54a"],
    frz: ["Frozen!", 1.1, "#8fdcff"], slp: ["Asleep!", 1.5, "#a8b3ff"], cnf: ["Confused!", 3.2, "#f0a0ff"],
  };
  const [text, dur, color] = names[st.kind];
  def.skT = dur;
  if (st.kind === "frz" || st.kind === "slp") { def.st = "hurt"; def.t = 0; def.stun = dur; def.atk = null; def.buf = ""; }
  emit(w, { k: "text", x: def.x, y: def.y + fighterOf(def.id).h + 42, text: text, color });
}

function applyHit(w: World, att: Pl, def: Pl, o: HitOpts) {
  if (def.st === "ko" || def.st === "down" || def.inv > 0 || w.phase === "ko" || w.phase === "roundEnd" || w.phase === "matchEnd") return false;
  const af = fighterOf(att.id);
  const df = fighterOf(def.id);
  const dir = sign(def.x - att.x);
  const hx = def.x - dir * df.bw * 0.5;
  const hy = def.y + df.h * 0.5;
  const facingAtt = sign(att.x - def.x) === def.face;
  if (def.st === "block" && facingAtt && !o.unblockable && def.y === 0) {
    const chip = Math.min(o.dmg * 0.1 * df.guard, Math.max(0, def.hp - 1));
    def.hp -= chip;
    def.vx = dir * o.kb * 0.45;
    if (!o.light) { def.hitstop = 0.05; att.hitstop = 0.05; w.shake = Math.max(w.shake, 0.12); }
    att.meter = Math.min(100, att.meter + o.meter * 0.4);
    def.meter = Math.min(100, def.meter + 3);
    emit(w, { k: "block", x: hx, y: hy, slot: def.slot });
    return true;
  }
  const mult = o.type ? typeMult(o.type, df.types) : 1;
  const scale = Math.max(0.4, 1 - 0.12 * Math.max(0, att.combo));
  const buffUp = att.buff.t > 0 ? att.buff.atk : 1;
  const buffDef = def.buff.t > 0 ? def.buff.def : 1;
  const shield = def.guardT > 0 ? 0.25 : 1;
  const dmg = (o.dmg * af.power * df.guard * mult * scale * buffUp * shield) / buffDef;
  const finalDmg = Math.min(def.hp, Math.max(mult === 0 ? 0 : 0.5, dmg));
  def.hp -= finalDmg;
  att.dealt += finalDmg;
  if (def.slot === 0) w.perfect = false;
  if (!o.light) { def.hitstop = 0.07; att.hitstop = 0.07; w.shake = Math.max(w.shake, o.heavy ? 0.4 : 0.18); }
  def.flash = 0.14;
  att.combo++;
  att.comboT = 1.2;
  if (att.combo > att.maxCombo) att.maxCombo = att.combo;
  att.meter = Math.min(100, att.meter + o.meter);
  def.meter = Math.min(100, def.meter + 4 + finalDmg * 0.5);
  if (att.meter >= 100 && o.meter > 0 && att.meter - o.meter < 100) emit(w, { k: "ready", x: att.x, y: att.y, slot: att.slot });
  if (!o.light || att.combo % 3 === 0) emit(w, { k: "hit", x: hx, y: hy, heavy: o.heavy, slot: def.slot, color: o.type ? (TYPE_COLOR[o.type] ?? af.color) : "#ffffff", ty: o.type });
  if (o.type && mult >= 2) emit(w, { k: "text", x: def.x, y: def.y + df.h + 18, text: "Super effective!", color: "#ffd54a" });
  else if (o.type && mult === 0) emit(w, { k: "text", x: def.x, y: def.y + df.h + 18, text: "No effect…", color: "#b0b0b0" });
  else if (o.type && mult < 1 && !o.light) emit(w, { k: "text", x: def.x, y: def.y + df.h + 18, text: "Not very effective…", color: "#9fb3c8" });
  if (att.combo >= 3 && !o.light) {
    emit(w, { k: "text", x: att.x, y: att.y + af.h + 30, text: `${att.combo} HITS`, color: "#ffffff", slot: att.slot });
    if (att.combo === 3) say(w, `${af.name} chains a ${att.combo}-hit combo!`);
  }
  if (!w.firstBlood) {
    w.firstBlood = true;
    say(w, `${af.name} draws first blood!`);
  }
  // knock-back and what the hit does to the one hit (a shield takes the flinch away)
  def.vx = dir * (def.guardT > 0 ? o.kb * 0.3 : o.kb);
  if (def.hp <= 0 || ((o.launch || def.y > 0) && def.guardT <= 0)) {
    def.atk = null; def.buf = ""; def.chain = 0; def.combo = 0;
    def.st = "down";
    def.t = 0;
    def.vy = def.hp <= 0 ? 520 : o.launch ? 420 : 260;
    def.vx = dir * (o.launch || def.hp <= 0 ? Math.max(o.kb, 380) : o.kb);
  } else if (def.guardT <= 0 && !o.light) {
    def.atk = null; def.buf = ""; def.chain = 0; def.combo = 0;
    def.st = "hurt";
    def.t = 0;
    def.stun = o.stun;
  } else if (o.light && def.guardT <= 0 && def.st !== "hurt") {
    // a stream of light hits keeps the foe in place without cancelling every move it starts
    def.st = "hurt"; def.t = 0; def.stun = Math.max(def.stun, 0.16); def.atk = null; def.buf = "";
  }
  if (def.hp > 0 && o.status && def.guardT <= 0) applyStatus(w, def, o.status);
  if (def.hp <= 0) knockOut(w, att, def);
  return true;
}

function knockOut(w: World, att: Pl, def: Pl) {
  def.hp = 0;
  def.st = "ko";
  def.t = 0;
  w.phase = "ko";
  w.pt = 0;
  w.roundWinner = att.slot;
  w.pr = [];
  w.freeze = 0;
  w.superBy = -1;
  const af = fighterOf(att.id);
  const perfect = att.hp >= att.maxHp - 0.01;
  emit(w, { k: "ko", x: def.x, y: def.y + 80, text: perfect ? "PERFECT!" : "K.O.", slot: def.slot });
  say(w, `${af.name} wins round ${w.round}${perfect ? " — flawless!" : "!"}`);
}

/* ----------------------------------------------------------------- one tick */

function hurtbox(p: Pl) {
  const f = fighterOf(p.id);
  const down = p.st === "down" || p.st === "ko";
  return { x0: p.x - f.bw * 0.8, x1: p.x + f.bw * 0.8, y0: p.y, y1: p.y + f.h * (down ? 0.25 : 0.85) };
}

function speedOf(p: Pl, f: { walk: number }) {
  return f.walk * (p.buff.t > 0 ? p.buff.spe : 1) * (p.sk === "par" ? 0.55 : 1);
}

function spawn(w: World, me: Pl, def: MoveDef, o: Partial<Proj> & { x: number; y: number }): Proj {
  const f = fighterOf(me.id);
  const pr: Proj = {
    id: ++w.pid, owner: me.slot, kind: "ball", vx: 0, vy: 0, r: 18, dmg: def.power * BASE, life: 1.6, delay: 0,
    color: TYPE_COLOR[def.type] ?? f.color, type: def.type, hits: [], pierce: !!def.pierce, big: false, homing: false,
    status: def.status ?? null, mv: def.id, art: def.kind, dir: me.face, len: 0, hz: "", ...o,
  };
  w.pr.push(pr);
  return pr;
}

/** One tick of one of the Pokémon's own moves. Returns true when it is over. */
function stepMove(w: World, me: Pl, foe: Pl, a: Atk, dt: number): boolean {
  const f = fighterOf(me.id);
  const def = f.moves[a.mi];
  if (!def) return true;
  const wu = windupOf(def);
  const color = TYPE_COLOR[def.type] ?? f.color;
  const chest = me.y + f.h * 0.5;
  const hb = hurtbox(foe);
  const fire = () => { a.fired = true; emit(w, { k: "spec", x: me.x + me.face * f.bw, y: chest, slot: me.slot, color, ty: def.type }); };
  switch (def.kind) {
    case "proj": {
      if (!a.fired && a.t >= wu) { fire(); spawn(w, me, def, { x: me.x + me.face * (f.bw + 20), y: chest, vx: me.face * (def.speed ?? 560), r: 20, life: 1.7 }); }
      break;
    }
    case "spread": {
      if (!a.fired && a.t >= wu) {
        fire();
        const n = clamp(def.n ?? 3, 2, 7);
        for (let i = 0; i < n; i++) {
          const ang = (i - (n - 1) / 2) * 0.17;
          const sp = def.speed ?? 520;
          spawn(w, me, def, { x: me.x + me.face * (f.bw + 14), y: chest, vx: me.face * Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 13, life: 1.2 });
        }
      }
      break;
    }
    case "homing": {
      if (!a.fired && a.t >= wu) { fire(); spawn(w, me, def, { x: me.x + me.face * (f.bw + 16), y: chest + 30, vx: me.face * (def.speed ?? 440), vy: 160, r: 17, life: 2.2, homing: true }); }
      break;
    }
    case "beam": {
      // a stream held in front of it: a little damage at every step while the foe stands in it
      const n = def.n ?? 6;
      const len = (def.range ?? 260) + f.bw;
      while (a.tick < n && a.t >= wu + a.tick * BEAM_STEP) {
        if (a.tick === 0) fire();
        a.tick++;
        const x0 = me.x + me.face * f.bw * 0.4, x1 = me.x + me.face * len;
        if (Math.max(x0, x1) > hb.x0 && Math.min(x0, x1) < hb.x1 && chest + 60 > hb.y0 && chest - 70 < hb.y1) {
          applyHit(w, me, foe, { dmg: def.power * BASE * 0.85, kb: 70, stun: 0.16, launch: false, type: def.type, meter: 1.5, heavy: false, status: def.status ?? null, light: true });
        }
      }
      break;
    }
    case "dash": {
      const dur = clamp((def.range ?? 200) / 1100, 0.14, 0.36);
      if (!a.fired && a.t >= wu) { fire(); a.rush = dur; }
      if (a.rush > 0) {
        a.rush -= dt;
        me.x += me.face * ((def.range ?? 200) / dur) * dt;
        if (!a.hit && Math.max(me.x - f.bw * 0.4, me.x + me.face * (f.bw + 60)) > hb.x0 && Math.min(me.x - f.bw * 0.4, me.x + me.face * (f.bw + 60)) < hb.x1 && me.y + f.h > hb.y0 && me.y < hb.y1) {
          if (applyHit(w, me, foe, { dmg: def.power * BASE, kb: 320 + def.power * 90, stun: 0.4, launch: def.power >= 1.6, type: def.type, meter: 6, heavy: def.power >= 1.2, status: def.status ?? null })) { a.hit = true; a.rush = 0; }
        }
      }
      break;
    }
    case "burrow": {
      if (!a.fired && a.t >= wu) { a.fired = true; emit(w, { k: "dig", x: me.x, y: 0, color, slot: me.slot, ty: def.type }); }
      if (a.t >= wu && a.t < wu + DIG_TIME) {
        me.inv = Math.max(me.inv, 0.08);
        const go = clamp(foe.x - me.x, -950 * dt, 950 * dt);
        me.x += go;
      } else if (a.t >= wu + DIG_TIME && !a.hit) {
        a.hit = true;
        emit(w, { k: "dig", x: me.x, y: 0, color, slot: me.slot, heavy: true, ty: def.type });
        if (Math.abs(foe.x - me.x) < f.bw + 90 && foe.y < 150) {
          applyHit(w, me, foe, { dmg: def.power * BASE, kb: 380, stun: 0.5, launch: true, type: def.type, meter: 6, heavy: true, status: def.status ?? null });
        }
      }
      break;
    }
    case "nova": {
      if (!a.fired && a.t >= wu) {
        fire();
        const rad = (def.range ?? 150) + f.bw;
        emit(w, { k: "nova", x: me.x, y: me.y + 30, color, r: rad, slot: me.slot, ty: def.type });
        w.shake = Math.max(w.shake, 0.3);
        if (Math.abs(foe.x - me.x) < rad + f.bw * 0.6 && foe.y < rad * 0.85) {
          applyHit(w, me, foe, { dmg: def.power * BASE, kb: 440, stun: 0.5, launch: def.power >= 1.8, type: def.type, meter: 6, heavy: true, status: def.status ?? null });
        }
      }
      break;
    }
    case "lob": {
      if (!a.fired && a.t >= wu) {
        fire();
        spawn(w, me, def, { kind: "bomb", x: clamp(foe.x, 80, STAGE_W - 80), y: 0, r: clamp((def.range ?? 300) * 0.4, 90, 150), life: 0.45, delay: 0.62, pierce: true, big: def.power >= 1.8 });
      }
      break;
    }
    case "bolt": {
      if (!a.fired && a.t >= 0.04) {
        fire();
        spawn(w, me, def, { kind: "bolt", x: me.x + me.face * f.bw * 0.5, y: 0, len: def.range ?? 480, life: 0.16, delay: Math.max(0.1, wu - 0.04), pierce: true, big: def.power >= 2.4 });
      }
      break;
    }
    case "grab": {
      if (!a.fired && a.t >= wu) {
        fire();
        const gx = me.x + me.face * (f.bw + 70);
        if (Math.abs(foe.x - gx) < 85 + f.bw * 0.5 && Math.abs(foe.y - me.y) < 90 && foe.st !== "down" && foe.st !== "ko") {
          applyHit(w, me, foe, { dmg: def.power * BASE * 1.1, kb: 500, stun: 0.9, launch: true, type: def.type, unblockable: true, meter: 8, heavy: true, status: def.status ?? null });
          emit(w, { k: "boom", x: foe.x, y: 20, color, ty: def.type });
        } else emit(w, { k: "text", x: me.x + me.face * 60, y: me.y + f.h + 20, text: "Missed!", color: "#c9d2e8" });
      }
      break;
    }
    case "guard": {
      if (!a.fired && a.t >= wu) { fire(); me.guardT = Math.min(3, def.dur ?? 2.2); emit(w, { k: "text", x: me.x, y: me.y + f.h + 30, text: "Shield!", color: "#9fd2ff" }); }
      break;
    }
    case "heal": {
      if (!a.fired && a.t >= wu) {
        fire();
        const total = f.maxHp * clamp(def.power * 0.34, 0.1, 0.28);
        me.regenT = 1.6; me.regen = total / 1.6;
        emit(w, { k: "text", x: me.x, y: me.y + f.h + 30, text: "Recovering…", color: "#7be08a" });
      }
      break;
    }
    case "buff": {
      if (!a.fired && a.t >= wu) {
        fire();
        const b = def.boost ?? {};
        me.buff = { atk: Math.max(b.atk ?? 1, b.spa ?? 1, 1.25), def: Math.max(b.def ?? 1, b.spd ?? 1), spe: b.spe ?? 1, t: Math.min(9, def.dur ?? 7) };
        emit(w, { k: "text", x: me.x, y: me.y + f.h + 30, text: "Power up!", color: "#ffb347" });
      }
      break;
    }
    case "hazard": {
      if (!a.fired && a.t >= wu) {
        fire();
        spawn(w, me, def, { kind: "trap", x: clamp(me.x + me.face * 190, 80, STAGE_W - 80), y: 0, r: 50, life: 7, hz: def.hazard ?? "spikes", dmg: def.power * BASE * 0.9 });
      }
      break;
    }
    default: break;
  }
  return a.t >= moveLength(def);
}

function stepPl(w: World, me: Pl, foe: Pl, inpIn: Input, dt: number) {
  const f = fighterOf(me.id);
  // confusion turns the walking keys round
  const inp: Input = me.sk === "cnf" ? { ...inpIn, l: inpIn.r, r: inpIn.l } : inpIn;
  const kick = (inp.r && me.face === 1) || (inp.l && me.face === -1);
  const press = { a: inp.a && !me.prev.a, m1: inp.m1 && !me.prev.m1, m2: inp.m2 && !me.prev.m2, m3: inp.m3 && !me.prev.m3, m4: inp.m4 && !me.prev.m4, s: inp.s && !me.prev.s, u: inp.u && !me.prev.u };
  me.prev = { ...inpIn };
  for (let i = 0; i < me.mcd.length; i++) me.mcd[i] = Math.max(0, (me.mcd[i] ?? 0) - dt);
  me.inv = Math.max(0, me.inv - dt);
  me.flash = Math.max(0, me.flash - dt);
  me.guardT = Math.max(0, me.guardT - dt);
  if (me.buff.t > 0) me.buff.t -= dt;
  if (me.regenT > 0) { me.regenT -= dt; me.hp = Math.min(me.maxHp, me.hp + me.regen * dt); }
  if (me.chainT > 0) { me.chainT -= dt; if (me.chainT <= 0) me.chain = 0; }
  if (me.comboT > 0) { me.comboT -= dt; if (me.comboT <= 0) me.combo = 0; }
  if (me.bufT > 0) { me.bufT -= dt; if (me.bufT <= 0) me.buf = ""; }
  me.t += dt;

  // burn and poison wear it down; the other conditions just run out
  if (me.sk) {
    me.skT -= dt;
    if ((me.sk === "brn" || me.sk === "psn") && w.phase === "fight") {
      me.hp -= f.maxHp * (me.sk === "brn" ? 0.012 : 0.01) * dt;
      if (me.hp <= 1) me.hp = 1;
    }
    if (me.skT <= 0) { me.sk = ""; me.skT = 0; }
  }

  const fighting = w.phase === "fight";
  const canAct = fighting && !busy(me);

  // what was pressed is remembered for a moment, so a button pressed a little early still counts
  if (fighting && !busy(me)) {
    let want: Act | "" = "";
    if (press.s && me.meter >= 100) want = "super";
    else if (press.m1 && (me.mcd[0] ?? 0) <= 0 && f.moves[0]) want = "m0";
    else if (press.m2 && (me.mcd[1] ?? 0) <= 0 && f.moves[1]) want = "m1";
    else if (press.m3 && (me.mcd[2] ?? 0) <= 0 && f.moves[2]) want = "m2";
    else if (press.m4 && (me.mcd[3] ?? 0) <= 0 && f.moves[3]) want = "m3";
    else if (press.a) want = kick ? "kick" : "jab";
    if (want) {
      if (me.st === "atk") { me.buf = want; me.bufT = 0.22; }
      else startAct(w, me, want, want === "jab" ? (me.chainT > 0 ? me.chain : 0) : 0);
    }
  }

  // state machine
  if (me.st === "hurt") {
    me.stun -= dt;
    me.vx *= Math.pow(0.0005, dt);
    if (me.stun <= 0) { me.st = me.y > 0 ? "jump" : "idle"; me.t = 0; }
  } else if (me.st === "down") {
    me.vx *= me.y > 0 ? 1 : Math.pow(0.002, dt);
    if (me.y <= 0 && me.t > 0.75) { me.st = "getup"; me.t = 0; me.inv = 0.35; }
  } else if (me.st === "getup") {
    me.vx *= 0.9;
    if (me.t > 0.28) { me.st = "idle"; me.t = 0; }
  } else if (me.st === "ko") {
    me.vx *= me.y > 0 ? 1 : Math.pow(0.003, dt);
  } else if (me.st === "win") {
    me.vx *= 0.8;
  } else if (me.st === "atk" && me.atk) {
    const a = me.atk;
    a.t += dt;
    let done = false;
    if (a.kind === "jab" || a.kind === "kick") {
      const d = ATK[a.kind];
      if (a.t < d.start + d.act) me.x += me.face * d.lunge * dt;
      if (!a.hit && a.t >= d.start && a.t <= d.start + d.act) {
        const hb = hurtbox(foe);
        const reach = d.reach + f.bw * 0.6;
        const xa = me.x + me.face * f.bw * 0.2;
        const xb = me.x + me.face * reach;
        const yLo = me.y + f.h * d.h0;
        const yHi = me.y + f.h * d.h1;
        if (Math.max(xa, xb) > hb.x0 && Math.min(xa, xb) < hb.x1 && yHi > hb.y0 && yLo < hb.y1) {
          const third = a.kind === "jab" && a.n >= 2;
          if (applyHit(w, me, foe, { dmg: third ? d.dmg * 1.5 : d.dmg, kb: third ? 420 : d.kb, stun: d.stun, launch: third, meter: d.meter, heavy: a.kind === "kick" || third })) a.hit = true;
        }
      }
      if (a.kind === "jab" && a.t > d.start) { me.chain = Math.min(2, a.n + 1); me.chainT = 0.5; }
      done = a.t >= d.start + d.act + d.rec;
    } else if (a.kind === "move") {
      done = stepMove(w, me, foe, a, dt);
    } else {
      // super: starts after the freeze; what it does depends on the Pokémon's role
      const d = ATK.super;
      if (!a.fired && a.t >= d.start) {
        a.fired = true;
        if (f.sup.kind === "rush") a.rush = 0.5;
        else if (f.sup.kind === "beam") {
          w.pr.push({ id: ++w.pid, owner: me.slot, kind: "beam", x: me.x + me.face * (f.bw + 30), y: me.y + f.h * 0.5, vx: me.face * 1250, vy: 0, r: 54, dmg: 26, life: 1.0, delay: 0, color: f.color, type: f.sup.type, hits: [], pierce: false, big: true, homing: false, status: null, mv: "super", art: "super", dir: me.face, len: 0, hz: "" });
        } else {
          w.pr.push({ id: ++w.pid, owner: me.slot, kind: "bomb", x: clamp(foe.x, 80, STAGE_W - 80), y: 0, vx: 0, vy: 0, r: 170, dmg: 26, life: 0.45, delay: 0.6, color: f.color, type: f.sup.type, hits: [], pierce: true, big: true, homing: false, status: null, mv: "super", art: "super", dir: me.face, len: 0, hz: "" });
        }
      }
      if (a.rush > 0) {
        a.rush -= dt;
        me.x += me.face * 1050 * dt;
        if (!a.hit) {
          const hb = hurtbox(foe);
          const xa = me.x - f.bw * 0.4, xb = me.x + me.face * (f.bw + 70);
          if (Math.max(xa, xb) > hb.x0 && Math.min(xa, xb) < hb.x1 && me.y + f.h > hb.y0 && me.y < hb.y1) {
            if (applyHit(w, me, foe, { dmg: d.dmg, kb: d.kb, stun: d.stun, launch: true, type: f.sup.type, meter: 0, heavy: true })) { a.hit = true; a.rush = 0; w.shake = 0.7; emit(w, { k: "boom", x: foe.x, y: foe.y + 70 }); }
          }
        }
      }
      done = a.t >= d.start + (f.sup.kind === "rush" ? 0.5 : 0.25) + d.rec;
    }
    if (done && me.atk === a) {
      const next = me.buf;
      me.atk = null; me.st = me.y > 0 ? "jump" : "idle"; me.t = 0;
      if (next && fighting) {
        if (next === "jab") startAct(w, me, "jab", a.kind === "jab" && a.n < 2 ? a.n + 1 : 0);
        else if (next === "super" ? me.meter >= 100 : true) startAct(w, me, next);
      }
    }
  } else if (canAct) {
    // free movement: walk, jump, block (it only turns round once the other is clearly on the other side)
    if (Math.abs(foe.x - me.x) > 16) me.face = foe.x >= me.x ? 1 : -1;
    const grounded = me.y <= 0;
    if (grounded && inp.d) {
      me.st = "block"; me.vx *= Math.pow(0.0004, dt);
    } else {
      if (me.st === "block") { me.st = "idle"; me.t = 0; }
      const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      const sp = speedOf(me, f);
      if (grounded) {
        const back = dir !== 0 && dir !== me.face;
        const target = dir * sp * (back ? 0.8 : 1);
        me.vx += (target - me.vx) * Math.min(1, dt * 15);
        const next: PState = dir !== 0 ? "walk" : "idle";
        if (me.st !== next) { me.st = next; me.t = 0; }
        if (press.u) { me.vy = JUMP_V; me.y = 0.01; me.st = "jump"; me.t = 0; me.vx = dir * sp * 0.9; emit(w, { k: "jump", x: me.x, y: 0 }); }
      } else {
        me.st = "jump";
        if (dir !== 0) me.vx += (dir * sp * 0.85 - me.vx) * Math.min(1, dt * 6);
      }
    }
  } else if (!fighting && !busy(me)) {
    if (Math.abs(foe.x - me.x) > 16) me.face = foe.x >= me.x ? 1 : -1;
    me.vx = 0;
    me.st = me.y > 0 ? "jump" : "idle";
  }

  // physics
  const wasAir = me.y > 0;
  if (me.y > 0 || me.vy > 0) {
    me.vy -= GRAV * dt;
    me.y += me.vy * dt;
    if (me.y <= 0) {
      me.y = 0; me.vy = 0;
      if (wasAir) emit(w, { k: "land", x: me.x, y: 0 });
      if (me.st === "jump") { me.st = "idle"; me.t = 0; me.vx = 0; }
      if (me.st === "down" || me.st === "ko") me.vx *= 0.5;
    }
  }
  me.x += me.vx * dt;
  me.x = clamp(me.x, 60, STAGE_W - 60);
  // not further from the other one than the camera can show
  const span = me.x - foe.x;
  if (Math.abs(span) > MAX_SPAN) me.x = foe.x + sign(span) * MAX_SPAN;
}

function separate(a: Pl, b: Pl) {
  if (a.st === "ko" || b.st === "ko" || a.y > 90 || b.y > 90) return;
  // a Pokémon underground passes beneath
  const dug = (p: Pl) => { const m = p.atk && p.atk.kind === "move" ? fighterOf(p.id).moves[p.atk.mi] : null; return !!m && m.kind === "burrow" && !!p.atk && p.atk.t >= windupOf(m) && p.atk.t < windupOf(m) + DIG_TIME; };
  if (dug(a) || dug(b)) return;
  const fa = fighterOf(a.id), fb = fighterOf(b.id);
  const min = (fa.bw + fb.bw) * 0.75;
  const dx = b.x - a.x;
  if (Math.abs(dx) < min) {
    const push = (min - Math.abs(dx)) / 2;
    const s = dx === 0 ? (a.slot === 0 ? 1 : -1) : sign(dx);
    a.x = clamp(a.x - s * push, 60, STAGE_W - 60);
    b.x = clamp(b.x + s * push, 60, STAGE_W - 60);
  }
}

function stepProj(w: World, dt: number) {
  const keep: Proj[] = [];
  for (const pr of w.pr) {
    const att = w.p[pr.owner];
    const def = w.p[pr.owner === 0 ? 1 : 0];
    const af = fighterOf(att.id);
    const mv = af.moves.find((m) => m.id === pr.mv);
    if (pr.delay > 0) {
      pr.delay -= dt;
      if (pr.delay <= 0) {
        if (pr.kind === "bomb") {
          const hb = hurtbox(def);
          if (hb.x1 > pr.x - pr.r && hb.x0 < pr.x + pr.r && hb.y0 < 190) {
            applyHit(w, att, def, { dmg: pr.dmg, kb: 520, stun: 0.8, launch: pr.big, type: pr.type, meter: 0, heavy: true, status: pr.status });
          }
          emit(w, { k: "boom", x: pr.x, y: 20, color: pr.color, ty: pr.mv === "super" ? undefined : pr.type });
          w.shake = Math.max(w.shake, 0.6);
        } else if (pr.kind === "bolt") {
          const hb = hurtbox(def);
          const x0 = pr.x, x1 = pr.x + pr.dir * pr.len;
          if (Math.max(x0, x1) > hb.x0 && Math.min(x0, x1) < hb.x1 && hb.y0 < 170) {
            applyHit(w, att, def, { dmg: pr.dmg, kb: 340, stun: 0.55, launch: pr.big, type: pr.type, meter: 4, heavy: true, status: pr.status });
          }
          emit(w, { k: "zap", x: pr.x, y: 0, color: pr.color, r: pr.len * pr.dir, ty: pr.type });
          w.shake = Math.max(w.shake, 0.35);
        }
      }
      keep.push(pr);
      continue;
    }
    pr.life -= dt;
    if (pr.kind === "ball" || pr.kind === "beam") {
      if (pr.homing) {
        // bends towards the foe, turning at a limited rate
        const tx = def.x - pr.x, ty = def.y + fighterOf(def.id).h * 0.45 - pr.y;
        const sp = Math.hypot(pr.vx, pr.vy) || 1;
        const cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(ty, tx);
        let da = want - cur;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const turn = clamp(da, -3.2 * dt, 3.2 * dt);
        pr.vx = Math.cos(cur + turn) * sp;
        pr.vy = Math.sin(cur + turn) * sp;
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
    }
    if (pr.life <= 0 || pr.x < -80 || pr.x > STAGE_W + 80 || pr.y < -30 || pr.y > 700) continue;
    if (pr.kind === "trap") {
      const hb = hurtbox(def);
      if (pr.x + pr.r > hb.x0 && pr.x - pr.r < hb.x1 && hb.y0 < 50) {
        const st = pr.status ?? (pr.hz === "toxic" ? { kind: "psn" as StatusKind, chance: 0.9 } : null);
        if (applyHit(w, att, def, { dmg: pr.dmg, kb: 160, stun: 0.3, launch: false, type: pr.type, meter: 3, heavy: false, status: st })) { emit(w, { k: "boom", x: pr.x, y: 10, color: pr.color, ty: pr.type }); continue; }
      }
    } else if (pr.kind === "ball" || pr.kind === "beam") {
      if (!pr.hits.includes(def.slot)) {
        const hb = hurtbox(def);
        if (pr.x + pr.r > hb.x0 && pr.x - pr.r < hb.x1 && pr.y + pr.r > hb.y0 && pr.y - pr.r < hb.y1) {
          const big = pr.big;
          if (applyHit(w, att, def, { dmg: pr.dmg, kb: big ? 560 : 260, stun: big ? 0.8 : 0.36, launch: big, type: pr.type, meter: big ? 0 : 5, heavy: big, status: pr.status })) {
            pr.hits.push(def.slot);
            if (!pr.pierce) continue;
          }
        }
      }
    }
    void mv;
    keep.push(pr);
  }
  // two shots meeting in the air cancel out; a big blast beats a small shot
  for (let i = 0; i < keep.length; i++) {
    for (let j = i + 1; j < keep.length; j++) {
      const a = keep[i]!, b = keep[j]!;
      const flying = (p: Proj) => (p.kind === "ball" || p.kind === "beam") && p.delay <= 0;
      if (a.owner === b.owner || !flying(a) || !flying(b)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) {
        emit(w, { k: "clash", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, color: a.color });
        if (!a.big) a.life = 0;
        if (!b.big) b.life = 0;
      }
    }
  }
  w.pr = keep.filter((p) => p.life > 0 || p.delay > 0);
}

/** Advance the world by dt seconds (call at a fixed rate). */
export function step(w: World, ia: Input, ib: Input, dtIn: number) {
  let dt = dtIn;
  w.tick++;
  w.shake = Math.max(0, w.shake - dtIn * 1.6);
  w.pt += dtIn;

  // the super move's freeze: only the clock for the picture runs
  if (w.freeze > 0) {
    w.freeze -= dtIn;
    w.time += dtIn;
    if (w.freeze <= 0) w.superBy = -1;
    return;
  }
  if (w.phase === "ko") dt = dtIn * 0.35;
  w.time += dt;
  const [A, B] = w.p;

  if (w.phase === "intro") {
    if (w.pt >= 2.2) { w.phase = "fight"; w.pt = 0; emit(w, { k: "fight", x: STAGE_W / 2, y: 0, text: "FIGHT!" }); }
  } else if (w.phase === "fight") {
    w.timer -= dtIn;
    if (w.timer <= 10 && w.timer + dtIn > 10) say(w, "Ten seconds left on the clock!");
    if (w.timer <= 0) {
      w.timer = 0;
      const ra = A.hp / A.maxHp, rb = B.hp / B.maxHp;
      const win: 0 | 1 = ra === rb ? (rnd(w) < 0.5 ? 0 : 1) : ra > rb ? 0 : 1;
      w.roundWinner = win;
      w.phase = "roundEnd";
      w.pt = 0;
      w.pr = [];
      w.p[win].rounds++;
      w.p[win].st = "win";
      emit(w, { k: "time", x: STAGE_W / 2, y: 0, text: "TIME!" });
      say(w, `Time! ${fighterOf(w.p[win].id).name} takes round ${w.round} on health.`);
      if (w.p[win].rounds >= WINS_NEEDED) { w.match = win; }
    }
  } else if (w.phase === "ko") {
    if (w.pt >= 1.9) {
      const win = w.roundWinner as 0 | 1;
      w.phase = "roundEnd";
      w.pt = 0;
      w.p[win].rounds++;
      if (w.p[win].st !== "down" && w.p[win].st !== "ko") { w.p[win].st = "win"; w.p[win].t = 0; w.p[win].atk = null; }
      if (w.p[win].rounds >= WINS_NEEDED) w.match = win;
    }
  } else if (w.phase === "roundEnd") {
    for (const p of w.p) if (p.slot === w.roundWinner && p.st !== "win" && p.st !== "down" && p.st !== "hurt") { p.st = "win"; p.t = 0; p.atk = null; }
    if (w.pt >= 2.6) {
      if (w.match >= 0) { w.phase = "matchEnd"; w.pt = 0; emit(w, { k: "win", x: STAGE_W / 2, y: 0, slot: w.match }); }
      else { w.round++; resetRound(w); }
    }
  }

  const freezeFx = w.phase === "matchEnd";
  if (freezeFx) { for (const p of w.p) p.vx *= 0.9; }

  const doStep = (me: Pl, foe: Pl, inp: Input) => {
    if (me.hitstop > 0) { me.hitstop -= dt; me.prev = { ...inp }; return; }
    stepPl(w, me, foe, inp, dt);
  };
  doStep(A, B, ia);
  doStep(B, A, ib);
  for (const [me, foe] of [[A, B], [B, A]] as const) {
    if (me.combo > 0 && foe.st !== "hurt" && foe.st !== "down") me.comboT = Math.min(me.comboT, 0.1);
  }
  separate(A, B);
  if (w.phase === "fight" || w.phase === "ko") stepProj(w, dt);
}

/* ---------------------------------------------------------------------- AI */

export type Brain = { lvl: Level; cool: number; cur: Input; blockT: number; plan: string };
export const newBrain = (lvl: Level): Brain => ({ lvl, cool: 0.5, cur: { ...NO_INPUT }, blockT: 0, plan: "" });

const SKILL: Record<Level, { react: number; block: number; aggr: number; spec: number; dodge: number }> = {
  easy: { react: 0.36, block: 0.18, aggr: 0.45, spec: 0.3, dodge: 0.15 },
  normal: { react: 0.2, block: 0.5, aggr: 0.75, spec: 0.55, dodge: 0.5 },
  hard: { react: 0.1, block: 0.82, aggr: 1, spec: 0.8, dodge: 0.85 },
};

const MKEY = ["m1", "m2", "m3", "m4"] as const;

/** Does this move make sense from this far away? */
function fits(m: MoveDef, dist: number, me: Pl, foe: Pl): boolean {
  const r = m.range ?? 200;
  switch (m.kind) {
    case "proj": case "spread": case "homing": return dist > 140;
    case "beam": return dist > 50 && dist < r + 90;
    case "bolt": return dist > 110 && dist < r + 40;
    case "lob": return dist > 90 && dist < 520;
    case "dash": return dist > 90 && dist < r + 130;
    case "burrow": return dist > 170 && dist < 480;
    case "nova": return dist < r + 70;
    case "grab": return dist < 150 && foe.st !== "down";
    case "guard": return foe.st === "atk" && dist < 220 && me.guardT <= 0;
    case "heal": return me.hp < me.maxHp * 0.55 && dist > 260 && me.regenT <= 0;
    case "buff": return me.buff.t <= 0 && dist > 240;
    case "hazard": return dist > 200 && dist < 560;
    default: return false;
  }
}

/** The computer's buttons for this tick. */
export function think(w: World, slot: 0 | 1, br: Brain, dt: number): Input {
  const out: Input = { ...br.cur };
  // buttons last one tick only; movement is held until the next decision
  br.cur.a = br.cur.m1 = br.cur.m2 = br.cur.m3 = br.cur.m4 = br.cur.s = br.cur.u = false;
  if (w.phase !== "fight") { br.cur = { ...NO_INPUT }; return { ...NO_INPUT }; }
  br.cool -= dt;
  br.blockT -= dt;
  if (br.blockT <= 0 && br.cur.d) br.cur.d = false;
  if (br.cool > 0) return out;
  const sk = SKILL[br.lvl];
  br.cool = sk.react * (0.7 + rnd(w) * 0.7);
  const me = w.p[slot], foe = w.p[slot === 0 ? 1 : 0];
  const f = fighterOf(me.id);
  const dx = foe.x - me.x, dist = Math.abs(dx), dir = sign(dx);
  const cur: Input = { ...NO_INPUT };
  const r = rnd(w);
  const incoming = w.pr.find((p) => p.owner !== slot && p.delay <= 0 && (p.kind === "ball" || p.kind === "beam") && Math.sign(me.x - p.x) === Math.sign(p.vx) && Math.abs(me.x - p.x) < 340);
  const bomb = w.pr.find((p) => p.owner !== slot && p.kind === "bomb" && Math.abs(me.x - p.x) < p.r + 40);
  const zap = w.pr.find((p) => p.owner !== slot && p.kind === "bolt" && p.delay > 0 && Math.sign(me.x - p.x) === p.dir && Math.abs(me.x - p.x) < p.len);
  const trap = w.pr.find((p) => p.owner !== slot && p.kind === "trap" && Math.abs(me.x - p.x) < p.r + 60);
  const foeAttacking = foe.st === "atk" && !!foe.atk && dist < 190;

  if (me.st === "hurt" || me.st === "down" || me.st === "getup") { br.cur = cur; return out; }
  if (bomb) {
    // run out of the blast, or jump it
    if (me.x > STAGE_W - 220) cur.l = true; else if (me.x < 220) cur.r = true; else if (bomb.x > me.x) cur.l = true; else cur.r = true;
    if (rnd(w) < sk.dodge) cur.u = true;
    br.cur = cur; br.cool = 0.12; return out;
  }
  if (zap && rnd(w) < sk.dodge) { cur.u = true; if (dir > 0) cur.r = true; else cur.l = true; br.cur = cur; br.cool = 0.15; return out; }
  if (trap && rnd(w) < sk.dodge + 0.2) { cur.u = true; if (trap.x > me.x) cur.r = true; else cur.l = true; br.cur = cur; br.cool = 0.2; return out; }
  if (incoming && r < sk.dodge) {
    if (rnd(w) < 0.5) { cur.d = true; br.blockT = 0.5; } else { cur.u = true; cur.l = dir < 0 ? false : true; cur.r = dir < 0 ? true : false; }
    br.cur = cur; return out;
  }
  // the moves it knows: pick one that suits the distance and is ready
  const useMove = (): boolean => {
    const ok: number[] = [];
    f.moves.forEach((m, i) => { if ((me.mcd[i] ?? 0) <= 0 && fits(m, dist, me, foe)) ok.push(i); });
    if (!ok.length) return false;
    const i = ok[Math.floor(rnd(w) * ok.length)]!;
    const m = f.moves[i]!;
    const eager = m.kind === "heal" || m.kind === "guard" || m.kind === "buff" ? 0.8 : sk.spec;
    if (rnd(w) > eager) return false;
    cur[MKEY[i]!] = true;
    br.cool = Math.max(br.cool, 0.2);
    return true;
  };
  if (foeAttacking && rnd(w) < sk.block) {
    if (!useMove()) { cur.d = true; br.blockT = 0.32 + rnd(w) * 0.2; }
    br.cur = cur; return out;
  }
  if (me.meter >= 100 && dist < 520 && rnd(w) < 0.7 * sk.aggr + 0.2) { cur.s = true; br.cur = cur; return out; }
  if (useMove()) { br.cur = cur; return out; }

  if (dist > 420) {
    if (rnd(w) < sk.aggr + 0.2) { if (dir > 0) cur.r = true; else cur.l = true; }
  } else if (dist > 190) {
    const k = rnd(w);
    if (k < 0.8 * sk.aggr + 0.15) { if (dir > 0) cur.r = true; else cur.l = true; if (rnd(w) < 0.12 * sk.aggr) cur.u = true; }
    else if (k > 0.93) cur.u = true;
  } else {
    const k = rnd(w);
    if (k < 0.5 * sk.aggr + 0.1) { cur.a = true; br.cool = 0.09; }
    else if (k < 0.72 * sk.aggr + 0.2) { cur.a = true; if (dir > 0) cur.r = true; else cur.l = true; }
    else if (k < 0.82) { cur.d = true; br.blockT = 0.3; }
    else if (k < 0.92) { if (dir > 0) cur.l = true; else cur.r = true; }
    else cur.u = true;
  }
  br.cur = cur;
  return out;
}

/** A copy that is safe to send and to keep (plain data only). */
export const snapshot = (w: World): World => JSON.parse(JSON.stringify(w)) as World;
