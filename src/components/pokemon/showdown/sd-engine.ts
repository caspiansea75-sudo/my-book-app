/**
 * Fight Showdown: the rules of the fight. No DOM, no drawing: a plain, serialisable world that is stepped forward at a
 * fixed rate, so the same code runs the computer match, a friend on the same device, and the host side of an online room
 * (the guest just receives the world and draws it).
 */
import { typeMult } from "@/lib/pokemon/shared";
import { fighterOf, type Level } from "./sd-data";

export const STAGE_W = 1600;
export const MAX_SPAN = 980;
export const ROUND_TIME = 60;
const GRAV = 2600;
const JUMP_V = 930;
const WINS_NEEDED = 2;

export type Input = { l: boolean; r: boolean; u: boolean; d: boolean; a: boolean; b: boolean; c: boolean; s: boolean };
export const NO_INPUT: Input = { l: false, r: false, u: false, d: false, a: false, b: false, c: false, s: false };

export type PState = "idle" | "walk" | "jump" | "atk" | "block" | "hurt" | "down" | "getup" | "ko" | "win";
export type AtkKind = "jab" | "kick" | "spec" | "super";
export type Atk = { kind: AtkKind; t: number; hit: boolean; n: number; fired: boolean; rush: number };

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
  specCd: number;
  stun: number;
  inv: number;
  flash: number;
  rounds: number;
  hitstop: number;
  buf: AtkKind | "";
  bufT: number;
  prev: Input;
  maxCombo: number;
  dealt: number;
};

export type Proj = {
  id: number;
  owner: 0 | 1;
  kind: "ball" | "beam" | "bomb";
  x: number;
  y: number;
  vx: number;
  r: number;
  dmg: number;
  life: number;
  delay: number;
  color: string;
  type: string;
  hits: number[];
  pierce: boolean;
  big: boolean;
};

export type Phase = "intro" | "fight" | "ko" | "roundEnd" | "matchEnd";
export type EvKind = "hit" | "block" | "spec" | "super" | "ko" | "jump" | "land" | "text" | "round" | "fight" | "win" | "ready" | "clash" | "boom" | "time";
export type Ev = { n: number; k: EvKind; x: number; y: number; heavy?: boolean; text?: string; color?: string; slot?: number };

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
    combo: 0, comboT: 0, specCd: 0, stun: 0, inv: 0, flash: 0, rounds: 0, hitstop: 0, buf: "", bufT: 0,
    prev: { ...NO_INPUT }, maxCombo: 0, dealt: 0,
  };
}

function resetRound(w: World) {
  for (const p of w.p) {
    p.hp = p.maxHp;
    p.x = STAGE_W / 2 + (p.slot === 0 ? -210 : 210);
    p.y = 0; p.vx = 0; p.vy = 0;
    p.face = p.slot === 0 ? 1 : -1;
    p.st = "idle"; p.t = 0; p.atk = null; p.chain = 0; p.chainT = 0;
    p.combo = 0; p.comboT = 0; p.specCd = 0.4; p.stun = 0; p.inv = 0; p.flash = 0;
    p.hitstop = 0; p.buf = ""; p.bufT = 0; p.prev = { ...NO_INPUT };
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
const ATK: Record<AtkKind, AtkDef> = {
  jab: { start: 0.06, act: 0.07, rec: 0.12, dmg: 5, reach: 78, h0: 0.25, h1: 0.8, kb: 130, stun: 0.27, meter: 5, lunge: 90, launch: false },
  kick: { start: 0.14, act: 0.09, rec: 0.26, dmg: 10, reach: 98, h0: 0.05, h1: 0.7, kb: 360, stun: 0.4, meter: 8, lunge: 140, launch: false },
  spec: { start: 0.16, act: 0.02, rec: 0.28, dmg: 0, reach: 0, h0: 0, h1: 0, kb: 0, stun: 0, meter: 0, lunge: 0, launch: false },
  super: { start: 0.06, act: 0.5, rec: 0.55, dmg: 26, reach: 150, h0: 0, h1: 1, kb: 620, stun: 0.9, meter: 0, lunge: 0, launch: true },
};

function busy(p: Pl) {
  return p.st === "hurt" || p.st === "down" || p.st === "getup" || p.st === "ko" || p.st === "win";
}

function startAtk(w: World, p: Pl, kind: AtkKind, n = 0) {
  const f = fighterOf(p.id);
  p.st = "atk";
  p.t = 0;
  p.atk = { kind, t: 0, hit: false, n, fired: false, rush: 0 };
  p.buf = "";
  if (kind === "spec") p.specCd = 0.95;
  if (kind === "super") {
    p.meter = 0;
    w.freeze = 0.62;
    w.superBy = p.slot;
    w.superName = f.sup.name;
    p.inv = 0.7;
    emit(w, { k: "super", x: p.x, y: p.y, slot: p.slot, text: f.sup.name, color: f.color });
    say(w, `${f.name} unleashes ${f.sup.name}!`);
  }
}

/* ------------------------------------------------------------------- damage */

function applyHit(w: World, att: Pl, def: Pl, o: { dmg: number; kb: number; stun: number; launch: boolean; type?: string; unblockable?: boolean; meter: number; heavy: boolean; big?: boolean }) {
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
    def.hitstop = 0.05;
    att.hitstop = 0.05;
    att.meter = Math.min(100, att.meter + o.meter * 0.4);
    def.meter = Math.min(100, def.meter + 3);
    w.shake = Math.max(w.shake, 0.12);
    emit(w, { k: "block", x: hx, y: hy, slot: def.slot });
    return true;
  }
  const mult = o.type ? typeMult(o.type, df.types) : 1;
  const scale = Math.max(0.4, 1 - 0.12 * Math.max(0, att.combo));
  const dmg = o.dmg * af.power * df.guard * mult * scale;
  const finalDmg = Math.min(def.hp, Math.max(mult === 0 ? 0 : 1, dmg));
  def.hp -= finalDmg;
  att.dealt += finalDmg;
  w.perfect = w.perfect && def.slot === 0 ? false : w.perfect;
  def.hitstop = 0.07;
  att.hitstop = 0.07;
  def.flash = 0.14;
  att.combo++;
  att.comboT = 1.2;
  if (att.combo > att.maxCombo) att.maxCombo = att.combo;
  att.meter = Math.min(100, att.meter + o.meter);
  def.meter = Math.min(100, def.meter + 4 + finalDmg * 0.5);
  if (att.meter >= 100 && att.prev && o.meter > 0) emit(w, { k: "ready", x: att.x, y: att.y, slot: att.slot });
  w.shake = Math.max(w.shake, o.heavy ? 0.4 : 0.18);
  emit(w, { k: "hit", x: hx, y: hy, heavy: o.heavy, slot: def.slot, color: o.type ? af.color : "#ffffff" });
  if (o.type && mult >= 2) emit(w, { k: "text", x: def.x, y: def.y + df.h + 18, text: "Super effective!", color: "#ffd54a" });
  else if (o.type && mult === 0) emit(w, { k: "text", x: def.x, y: def.y + df.h + 18, text: "No effect…", color: "#b0b0b0" });
  else if (o.type && mult < 1) emit(w, { k: "text", x: def.x, y: def.y + df.h + 18, text: "Not very effective…", color: "#9fb3c8" });
  if (att.combo >= 3) {
    emit(w, { k: "text", x: att.x, y: att.y + af.h + 30, text: `${att.combo} HITS`, color: "#ffffff", slot: att.slot });
    if (att.combo === 3) say(w, `${af.name} chains a ${att.combo}-hit combo!`);
  }
  if (!w.firstBlood) {
    w.firstBlood = true;
    say(w, `${af.name} draws first blood!`);
  }
  // knock-back and what the hit does to the one hit
  def.atk = null;
  def.buf = "";
  def.chain = 0;
  def.combo = 0;
  def.vx = dir * o.kb;
  if (def.hp <= 0 || o.launch || def.y > 0) {
    def.st = "down";
    def.t = 0;
    def.vy = def.hp <= 0 ? 520 : o.launch ? 420 : 260;
    def.vx = dir * (o.launch || def.hp <= 0 ? Math.max(o.kb, 380) : o.kb);
  } else {
    def.st = "hurt";
    def.t = 0;
    def.stun = o.stun;
  }
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

function stepPl(w: World, me: Pl, foe: Pl, inp: Input, dt: number) {
  const f = fighterOf(me.id);
  const press = { a: inp.a && !me.prev.a, b: inp.b && !me.prev.b, c: inp.c && !me.prev.c, s: inp.s && !me.prev.s, u: inp.u && !me.prev.u };
  me.prev = { ...inp };
  me.specCd = Math.max(0, me.specCd - dt);
  me.inv = Math.max(0, me.inv - dt);
  me.flash = Math.max(0, me.flash - dt);
  if (me.chainT > 0) { me.chainT -= dt; if (me.chainT <= 0) me.chain = 0; }
  if (me.comboT > 0) { me.comboT -= dt; if (me.comboT <= 0) me.combo = 0; }
  if (me.bufT > 0) { me.bufT -= dt; if (me.bufT <= 0) me.buf = ""; }
  me.t += dt;

  const fighting = w.phase === "fight";
  const canAct = fighting && !busy(me);

  // what was pressed is remembered for a moment, so a button pressed a little early still counts
  if (fighting && !busy(me)) {
    const want: AtkKind | "" = press.s && me.meter >= 100 ? "super" : press.c && me.specCd <= 0 ? "spec" : press.b ? "kick" : press.a ? "jab" : "";
    if (want) {
      if (me.st === "atk") { me.buf = want; me.bufT = 0.22; }
      else {
        if (want === "jab") startAtk(w, me, "jab", me.chainT > 0 ? me.chain : 0);
        else startAtk(w, me, want);
      }
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
    const d = ATK[a.kind];
    a.t += dt;
    if (a.kind === "jab" || a.kind === "kick") {
      if (a.t < d.start + d.act) me.x += me.face * d.lunge * dt;
      if (!a.hit && a.t >= d.start && a.t <= d.start + d.act) {
        const reach = d.reach + f.bw * 0.6;
        const xa = me.x + me.face * f.bw * 0.2;
        const xb = me.x + me.face * reach;
        const hb = hurtbox(foe);
        const yLo = me.y + f.h * d.h0;
        const yHi = me.y + f.h * d.h1;
        if (Math.max(xa, xb) > hb.x0 && Math.min(xa, xb) < hb.x1 && yHi > hb.y0 && yLo < hb.y1) {
          const third = a.kind === "jab" && a.n >= 2;
          if (applyHit(w, me, foe, { dmg: third ? d.dmg * 1.5 : d.dmg, kb: third ? 420 : d.kb, stun: d.stun, launch: third, meter: d.meter, heavy: a.kind === "kick" || third })) a.hit = true;
        }
      }
      if (a.kind === "jab" && a.t > d.start) { me.chain = Math.min(2, a.n + 1); me.chainT = 0.5; }
      if (a.t >= d.start + d.act + d.rec) {
        const next = me.buf;
        me.atk = null; me.st = me.y > 0 ? "jump" : "idle"; me.t = 0;
        if (next && fighting) {
          if (next === "jab") startAtk(w, me, "jab", a.kind === "jab" && a.n < 2 ? a.n + 1 : 0);
          else if (next === "spec" ? me.specCd <= 0 : next === "super" ? me.meter >= 100 : true) startAtk(w, me, next);
        }
      }
    } else if (a.kind === "spec") {
      if (!a.fired && a.t >= d.start) {
        a.fired = true;
        const sp = f.special;
        w.pr.push({ id: ++w.pid, owner: me.slot, kind: "ball", x: me.x + me.face * (f.bw + 20), y: me.y + f.h * 0.45, vx: me.face * sp.speed, r: 20, dmg: 9, life: 1.6, delay: 0, color: sp.color, type: sp.type, hits: [], pierce: false, big: false });
        emit(w, { k: "spec", x: me.x + me.face * f.bw, y: me.y + f.h * 0.45, slot: me.slot, color: sp.color });
      }
      if (a.t >= d.start + d.act + d.rec) {
        const next = me.buf;
        me.atk = null; me.st = me.y > 0 ? "jump" : "idle"; me.t = 0;
        if (next === "jab" || next === "kick") startAtk(w, me, next);
      }
    } else {
      // super: starts after the freeze; what it does depends on the Pokémon's role
      if (!a.fired && a.t >= d.start) {
        a.fired = true;
        if (f.sup.kind === "rush") a.rush = 0.5;
        else if (f.sup.kind === "beam") {
          w.pr.push({ id: ++w.pid, owner: me.slot, kind: "beam", x: me.x + me.face * (f.bw + 30), y: me.y + f.h * 0.5, vx: me.face * 1250, r: 54, dmg: 26, life: 1.0, delay: 0, color: f.color, type: f.sup.type, hits: [], pierce: false, big: true });
        } else {
          w.pr.push({ id: ++w.pid, owner: me.slot, kind: "bomb", x: clamp(foe.x, 80, STAGE_W - 80), y: 0, vx: 0, r: 170, dmg: 26, life: 0.45, delay: 0.6, color: f.color, type: f.sup.type, hits: [], pierce: true, big: true });
        }
      }
      if (a.rush > 0) {
        a.rush -= dt;
        me.x += me.face * 1050 * dt;
        if (!a.hit) {
          const hb = hurtbox(foe);
          const xa = me.x - f.bw * 0.4, xb = me.x + me.face * (f.bw + 70);
          if (Math.max(xa, xb) > hb.x0 && Math.min(xa, xb) < hb.x1 && me.y + f.h > hb.y0 && me.y < hb.y1) {
            if (applyHit(w, me, foe, { dmg: d.dmg, kb: d.kb, stun: d.stun, launch: true, type: f.sup.type, meter: 0, heavy: true, big: true })) { a.hit = true; a.rush = 0; w.shake = 0.7; emit(w, { k: "boom", x: foe.x, y: foe.y + 70 }); }
          }
        }
      }
      if (a.t >= d.start + (f.sup.kind === "rush" ? 0.5 : 0.25) + d.rec) { me.atk = null; me.st = me.y > 0 ? "jump" : "idle"; me.t = 0; }
    }
  } else if (canAct) {
    // free movement: walk, jump, block
    me.face = foe.x >= me.x ? 1 : -1;
    const grounded = me.y <= 0;
    if (grounded && inp.d) {
      me.st = "block"; me.vx = 0;
    } else {
      if (me.st === "block") { me.st = "idle"; me.t = 0; }
      const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      if (grounded) {
        const back = dir !== 0 && dir !== me.face;
        me.vx = dir * f.walk * (back ? 0.8 : 1);
        const next: PState = dir !== 0 ? "walk" : "idle";
        if (me.st !== next) { me.st = next; me.t = 0; }
        if (press.u) { me.vy = JUMP_V; me.y = 0.01; me.st = "jump"; me.t = 0; me.vx = dir * f.walk * 0.9; emit(w, { k: "jump", x: me.x, y: 0 }); }
      } else {
        me.st = "jump";
        if (dir !== 0) me.vx += (dir * f.walk * 0.85 - me.vx) * Math.min(1, dt * 6);
      }
    }
  } else if (!fighting && !busy(me)) {
    me.face = foe.x >= me.x ? 1 : -1;
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
    if (pr.delay > 0) {
      pr.delay -= dt;
      if (pr.delay <= 0 && pr.kind === "bomb") {
        const hb = hurtbox(def);
        if (hb.x1 > pr.x - pr.r && hb.x0 < pr.x + pr.r && hb.y0 < 190) {
          applyHit(w, att, def, { dmg: pr.dmg, kb: 520, stun: 0.8, launch: true, type: pr.type, meter: 0, heavy: true, big: true });
        }
        emit(w, { k: "boom", x: pr.x, y: 20, color: pr.color });
        w.shake = Math.max(w.shake, 0.6);
      }
      keep.push(pr);
      continue;
    }
    pr.life -= dt;
    if (pr.kind !== "bomb") pr.x += pr.vx * dt;
    if (pr.life <= 0 || pr.x < -80 || pr.x > STAGE_W + 80) continue;
    if (pr.kind !== "bomb" && !pr.hits.includes(def.slot)) {
      const hb = hurtbox(def);
      if (pr.x + pr.r > hb.x0 && pr.x - pr.r < hb.x1 && pr.y + pr.r > hb.y0 && pr.y - pr.r < hb.y1) {
        const big = pr.big;
        if (applyHit(w, att, def, { dmg: pr.dmg, kb: big ? 560 : 260, stun: big ? 0.8 : 0.36, launch: big, type: pr.type, meter: big ? 0 : 5, heavy: big, big })) {
          pr.hits.push(def.slot);
          if (!pr.pierce) continue;
        }
      }
    }
    keep.push(pr);
  }
  // two shots meeting in the air cancel out; a big blast beats a small shot
  for (let i = 0; i < keep.length; i++) {
    for (let j = i + 1; j < keep.length; j++) {
      const a = keep[i]!, b = keep[j]!;
      if (a.owner === b.owner || a.kind === "bomb" || b.kind === "bomb" || a.delay > 0 || b.delay > 0) continue;
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
  normal: { react: 0.2, block: 0.5, aggr: 0.75, spec: 0.5, dodge: 0.5 },
  hard: { react: 0.1, block: 0.82, aggr: 1, spec: 0.75, dodge: 0.85 },
};

/** The computer's buttons for this tick. */
export function think(w: World, slot: 0 | 1, br: Brain, dt: number): Input {
  const out: Input = { ...br.cur };
  // buttons last one tick only; movement is held until the next decision
  br.cur.a = br.cur.b = br.cur.c = br.cur.s = br.cur.u = false;
  if (w.phase !== "fight") { br.cur = { ...NO_INPUT }; return { ...NO_INPUT }; }
  br.cool -= dt;
  br.blockT -= dt;
  if (br.blockT <= 0 && br.cur.d) br.cur.d = false;
  if (br.cool > 0) return out;
  const sk = SKILL[br.lvl];
  br.cool = sk.react * (0.7 + rnd(w) * 0.7);
  const me = w.p[slot], foe = w.p[slot === 0 ? 1 : 0];
  const dx = foe.x - me.x, dist = Math.abs(dx), dir = sign(dx);
  const cur: Input = { ...NO_INPUT };
  const r = rnd(w);
  const incoming = w.pr.find((p) => p.owner !== slot && p.delay <= 0 && p.kind !== "bomb" && Math.sign(me.x - p.x) === Math.sign(p.vx) && Math.abs(me.x - p.x) < 340);
  const bomb = w.pr.find((p) => p.owner !== slot && p.kind === "bomb" && Math.abs(me.x - p.x) < p.r + 40);
  const foeAttacking = foe.st === "atk" && !!foe.atk && foe.atk.kind !== "spec" && dist < 190;

  if (me.st === "hurt" || me.st === "down" || me.st === "getup") { br.cur = cur; return out; }
  if (bomb) {
    // run out of the blast, or jump it
    if (me.x > STAGE_W - 220) cur.l = true; else if (me.x < 220) cur.r = true; else if (bomb.x > me.x) cur.l = true; else cur.r = true;
    if (rnd(w) < sk.dodge) cur.u = true;
    br.cur = cur; br.cool = 0.12; return out;
  }
  if (incoming && r < sk.dodge) {
    if (rnd(w) < 0.5) { cur.d = true; br.blockT = 0.5; } else { cur.u = true; cur.l = dir < 0 ? false : true; cur.r = dir < 0 ? true : false; }
    br.cur = cur; return out;
  }
  if (foeAttacking && rnd(w) < sk.block) { cur.d = true; br.blockT = 0.32 + rnd(w) * 0.2; br.cur = cur; return out; }
  if (me.meter >= 100 && dist < 520 && rnd(w) < 0.7 * sk.aggr + 0.2) { cur.s = true; br.cur = cur; return out; }

  if (dist > 420) {
    if (me.specCd <= 0 && rnd(w) < sk.spec) cur.c = true;
    else if (rnd(w) < sk.aggr + 0.2) { if (dir > 0) cur.r = true; else cur.l = true; }
  } else if (dist > 190) {
    const k = rnd(w);
    if (me.specCd <= 0 && k < sk.spec * 0.55) cur.c = true;
    else if (k < 0.8 * sk.aggr + 0.15) { if (dir > 0) cur.r = true; else cur.l = true; if (rnd(w) < 0.12 * sk.aggr) cur.u = true; }
    else if (k > 0.93) cur.u = true;
  } else {
    const k = rnd(w);
    if (k < 0.5 * sk.aggr + 0.1) { cur.a = true; br.cool = 0.09; }
    else if (k < 0.72 * sk.aggr + 0.2) cur.b = true;
    else if (k < 0.82) { cur.d = true; br.blockT = 0.3; }
    else if (k < 0.92) { if (dir > 0) cur.l = true; else cur.r = true; }
    else cur.u = true;
  }
  br.cur = cur;
  return out;
}

/** A copy that is safe to send and to keep (plain data only). */
export const snapshot = (w: World): World => JSON.parse(JSON.stringify(w)) as World;
