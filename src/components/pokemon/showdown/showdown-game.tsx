import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Maximize2, Volume2, VolumeX } from "lucide-react";
import { sfx } from "@/components/pokemon/arena-sfx";
import { useT } from "@/components/pokemon/ui";
import { ROSTER } from "@/lib/pokemon/arena-data";
import { TYPE_COLOR } from "@/lib/pokemon/shared";
import { useMe } from "@/lib/use-me";
import { FIGHTER_IDS, LEVELS, STAGES, fighterOf, type Level, type StageId } from "./sd-data";
import { NO_INPUT, newBrain, newWorld, snapshot, step, think, type Input, type World } from "./sd-engine";
import { SdNet, blend, cleanCode, newCode, type Pulse, type Wire } from "./sd-net";
import { SdRenderer } from "./sd-render";
import "./showdown.css";

type Mode = "cpu" | "local" | "online";
type Role = "cpu" | "local" | "host" | "guest";
type Cfg = { role: Role; a: string; b: string; stage: StageId; level: Level; seed: number; na: string; nb: string; net: SdNet | null; key: number };
type Friend = { name: string; pick: string };

const RANDOM = "random";
const pickOf = (v: string) => (v === RANDOM ? FIGHTER_IDS[Math.floor(Math.random() * FIGHTER_IDS.length)]! : v);
const TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];
const shot = (id: string, k: "dex" | "ani") => `/api/sprite?k=${k}&id=${encodeURIComponent(id)}`;

/* ------------------------------------------------------------------ controls */

const MAP_SOLO: Record<string, keyof Input> = { KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r", KeyW: "u", ArrowUp: "u", KeyS: "d", ArrowDown: "d", KeyJ: "a", KeyZ: "a", KeyK: "b", KeyX: "b", KeyL: "c", KeyC: "c", Space: "s", KeyV: "s", KeyI: "s" };
const MAP_P1: Record<string, keyof Input> = { KeyA: "l", KeyD: "r", KeyW: "u", KeyS: "d", KeyF: "a", KeyG: "b", KeyH: "c", KeyT: "s" };
const MAP_P2: Record<string, keyof Input> = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", KeyJ: "a", KeyK: "b", KeyL: "c", KeyI: "s" };
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

function TBtn({ id, label, cls, touch, latch }: { id: keyof Input; label: string; cls?: string; touch: Input; latch: (k: keyof Input) => void }) {
  const [on, setOn] = useState(false);
  const off = () => { touch[id] = false; setOn(false); };
  return (
    <button
      type="button"
      className={`sd-btn ${cls ?? ""} ${on ? "on" : ""}`}
      onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ } touch[id] = true; latch(id); setOn(true); }}
      onPointerUp={off}
      onPointerCancel={off}
      onLostPointerCapture={off}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

/* --------------------------------------------------------------------- match */

type Summary = { match: 0 | 1; rounds: [number, number]; ids: [string, string]; combo: [number, number]; dealt: [number, number]; local: number };

function Match({ cfg, onExit, onAgain }: { cfg: Cfg; onExit: () => void; onAgain: () => void }) {
  const { t, lang } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const touch = useRef<Input>({ ...NO_INPUT }).current;
  const pulse = useRef<Pulse>({ a: false, b: false, c: false, s: false, u: false }).current;
  const [over, setOver] = useState<Summary | null>(null);
  const [lost, setLost] = useState(false);
  const [muted, setMuted] = useState(sfx.isMuted());
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const latch = useCallback((k: keyof Input) => { if (k === "a" || k === "b" || k === "c" || k === "s" || k === "u") pulse[k] = true; }, [pulse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const role = cfg.role;
    const you = t("তুমি", "YOU");
    const rend = new SdRenderer(canvas);
    rend.stage = cfg.stage;
    rend.lang = lang === "bn" ? "bn" : "en";
    rend.local = role === "guest" ? 1 : role === "local" ? -1 : 0;
    rend.tags = role === "cpu" ? [you, "CPU"] : role === "local" ? ["P1", "P2"] : role === "host" ? [you, cfg.nb] : [cfg.na, you];
    rend.preload([cfg.a, cfg.b]);
    sfx.unlock();

    const world: World = newWorld(cfg.a, cfg.b, cfg.seed);
    const brain = role === "cpu" ? newBrain(cfg.level) : null;
    const down = new Set<string>();
    const snaps: { t: number; w: World }[] = [];
    let remote: Input = { ...NO_INPUT };
    const rPulse: Pulse = { a: false, b: false, c: false, s: false, u: false };
    let remoteAt = performance.now();
    let shown = false, stopped = false, acc = 0, ticks = 0, last = performance.now(), lastSend = 0, raf = 0;
    const net = cfg.net;
    const prev = net?.handler;
    if (net) {
      net.lastHeard = performance.now();
      net.handler = (d: Wire, from: string) => {
        if (d.k === "w" && role === "guest") { snaps.push({ t: performance.now(), w: d.w }); if (snaps.length > 6) snaps.shift(); }
        else if (d.k === "in" && role === "host") { remote = d.i; for (const k of ["a", "b", "c", "s", "u"] as const) if (d.p[k]) rPulse[k] = true; remoteAt = performance.now(); }
        else if (d.k === "bye") { stopped = true; setLost(true); }
        else prev?.(d, from);
      };
    }

    const map = role === "local" ? MAP_P1 : MAP_SOLO;
    const readKeys = (m: Record<string, keyof Input>, extra?: Input): Input => {
      const i: Input = extra ? { ...extra } : { ...NO_INPUT };
      for (const c of down) { const a = m[c]; if (a) i[a] = true; }
      return i;
    };
    const kd = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (MAP_SOLO[e.code] || MAP_P1[e.code] || MAP_P2[e.code]) e.preventDefault();
      if (!down.has(e.code)) { down.add(e.code); const a = map[e.code]; if (a) latch(a); }
    };
    const ku = (e: KeyboardEvent) => { down.delete(e.code); };
    const blur = () => down.clear();
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);

    const view = (now: number): World => {
      if (role !== "guest") return world;
      if (snaps.length === 0) return world;
      const rt = now - 100;
      for (let i = snaps.length - 2; i >= 0; i--) {
        const a = snaps[i]!, b = snaps[i + 1]!;
        if (rt >= a.t) return rt >= b.t ? b.w : blend(a.w, b.w, (rt - a.t) / Math.max(1, b.t - a.t));
      }
      return snaps[0]!.w;
    };

    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (role === "guest") {
        if (net && now - lastSend > 30) {
          lastSend = now;
          net.cast({ k: "in", i: readKeys(MAP_SOLO, touch), p: { ...pulse } });
          pulse.a = pulse.b = pulse.c = pulse.s = pulse.u = false;
        }
      } else {
        acc += dt;
        let n = 0;
        while (acc >= 1 / 60 && n < 6) {
          acc -= 1 / 60; n++; ticks++;
          let ia: Input, ib: Input;
          if (role === "cpu") { ia = readKeys(MAP_SOLO, touch); ib = think(world, 1, brain!, 1 / 60); }
          else if (role === "local") { ia = readKeys(MAP_P1); ib = readKeys(MAP_P2); }
          else {
            ia = readKeys(MAP_SOLO, touch);
            ib = now - remoteAt > 700 ? { ...NO_INPUT } : { ...remote };
            for (const k of ["a", "b", "c", "s", "u"] as const) if (rPulse[k]) { ib[k] = true; rPulse[k] = false; }
          }
          if (role === "cpu" || role === "host") {
            // a pulse from the touch pad: make sure a quick tap still lands as one press
            for (const k of ["a", "b", "c", "s", "u"] as const) if (pulse[k]) { ia[k] = true; pulse[k] = false; }
          }
          step(world, ia, ib, 1 / 60);
          if (role === "host" && ticks % 2 === 0 && net) net.cast({ k: "w", w: snapshot(world) });
        }
        if (n >= 6) acc = 0;
      }
      if (net && now - net.lastHeard > 9000 && (role === "host" || role === "guest")) { stopped = true; setLost(true); return; }
      const w = view(now);
      rend.draw(w, now);
      if (!shown && w.phase === "matchEnd" && w.pt > 2.8) {
        shown = true;
        setOver({ match: w.match === 1 ? 1 : 0, rounds: [w.p[0].rounds, w.p[1].rounds], ids: [w.p[0].id, w.p[1].id], combo: [w.p[0].maxCombo, w.p[1].maxCombo], dealt: [Math.round(w.p[0].dealt), Math.round(w.p[1].dealt)], local: rend.local });
        if (role === "host" && net) net.cast({ k: "w", w: snapshot(world) });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
      if (net && prev) net.handler = prev;
    };
    // the match is set up once per mount; the parent re-mounts it (new key) for a rematch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => { sfx.setMuted(!muted); setMuted(!muted); };
  const full = () => { const el = wrapRef.current; if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {}); };
  const win = over ? (over.match === 1 ? 1 : 0) : 0;
  const winName = over ? fighterOf(over.ids[win]!).name : "";
  const youWon = over && over.local >= 0 ? over.match === over.local : null;
  const phrases = [t("মাঠ কাঁপিয়ে জিতল!", "WALKS TO VICTORY!"), t("মুকুট ছিনিয়ে নিল!", "TAKES THE CROWN!"), t("ঝড় তুলল অ্যারেনায়!", "STORMS THE ARENA!")];

  return (
    <div className="sd-play" ref={wrapRef}>
      <canvas ref={canvasRef} />
      <div className="sd-bar">
        <button type="button" className="sd-ico" onClick={toggleMute} aria-label={t("শব্দ", "Sound")}>{muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button>
        <button type="button" className="sd-ico" onClick={full} aria-label={t("ফুলস্ক্রিন", "Fullscreen")}><Maximize2 className="size-4" /></button>
      </div>
      {coarse && cfg.role !== "local" && !over ? (
        <div className="sd-pad">
          <div className="sd-dpad">
            <span />
            <TBtn id="u" label="▲" touch={touch} latch={latch} />
            <span />
            <TBtn id="l" label="◀" touch={touch} latch={latch} />
            <TBtn id="d" label="▼" touch={touch} latch={latch} />
            <TBtn id="r" label="▶" touch={touch} latch={latch} />
          </div>
          <div className="sd-acts">
            <TBtn id="a" label={t("ঘুষি", "Jab")} touch={touch} latch={latch} />
            <TBtn id="b" label={t("লাথি", "Kick")} touch={touch} latch={latch} />
            <TBtn id="c" label={t("স্পেশাল", "Special")} touch={touch} latch={latch} />
            <TBtn id="s" label={t("সুপার", "Super")} cls="sup" touch={touch} latch={latch} />
          </div>
        </div>
      ) : null}
      {over ? (
        <div className="sd-over">
          <div className="sd-paper">
            <h3>{t("পোকেমন টাইমস", "THE POKÉMON TIMES")}</h3>
            <h4>{winName.toUpperCase()} {phrases[(over.dealt[0] + over.dealt[1]) % 3]}</h4>
            <p>{t("ফলাফল", "Final score")}: {over.rounds[0]} – {over.rounds[1]}</p>
            <p>{t("সেরা কম্বো", "Best combo")}: {over.combo[0]} / {over.combo[1]} · {t("মোট ড্যামেজ", "Damage")}: {over.dealt[0]} / {over.dealt[1]}</p>
            {youWon !== null ? <div style={{ textAlign: "center" }}><span className="sd-stamp">{youWon ? t("তুমি জিতেছ!", "YOU WIN") : t("হার মানলে", "YOU LOSE")}</span></div> : null}
            <div className="sd-actions">
              <button type="button" onClick={onAgain} disabled={cfg.role === "guest"}>{cfg.role === "guest" ? t("হোস্টের অপেক্ষায়…", "Waiting for host…") : t("আবার", "Rematch")}</button>
              <button type="button" className="alt" onClick={onExit}>{t("পোকেমন বাছাই", "Character select")}</button>
            </div>
          </div>
        </div>
      ) : null}
      {lost ? (
        <div className="sd-over">
          <div className="sd-paper">
            <h3>{t("সংযোগ নেই", "CONNECTION LOST")}</h3>
            <p>{t("বন্ধুর সাথে সংযোগ বিচ্ছিন্ন হয়েছে।", "Your friend's connection dropped.")}</p>
            <div className="sd-actions"><button type="button" className="alt" onClick={onExit}>{t("ফিরে যান", "Back")}</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ the page */

export function ShowdownGame() {
  const { t, lang } = useT();
  const me = useMe();
  const isGuest = !me || me.role === "guest";
  const myName = me?.displayName ?? t("তুমি", "You");
  const [mode, setMode] = useState<Mode>("cpu");
  const [mine, setMine] = useState<string>(() => FIGHTER_IDS[Math.floor(Math.random() * FIGHTER_IDS.length)]!);
  const [foe, setFoe] = useState<string>(RANDOM);
  const [aim, setAim] = useState<"me" | "foe">("me");
  const [level, setLevel] = useState<Level>("normal");
  const [stage, setStage] = useState<StageId>("stadium");
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("");
  const [cfg, setCfg] = useState<Cfg | null>(null);
  // online room
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [friend, setFriend] = useState<Friend | null>(null);
  const [linked, setLinked] = useState(false);
  const [note, setNote] = useState("");
  const netRef = useRef<SdNet | null>(null);
  const helloRef = useRef<number>(0);
  const live = useRef({ mine, stage, myName });
  live.current = { mine, stage, myName };
  const lobbyRef = useRef<(d: Wire) => void>(() => {});

  const stopRoom = useCallback(() => {
    window.clearInterval(helloRef.current);
    netRef.current?.close();
    netRef.current = null;
    setRole(null); setCode(""); setFriend(null); setLinked(false); setNote("");
  }, []);
  useEffect(() => () => { window.clearInterval(helloRef.current); netRef.current?.close(); }, []);

  const attach = useCallback((net: SdNet, as: "host" | "guest") => {
    lobbyRef.current = (d: Wire) => {
      if (as === "host") {
        if (d.k === "hello") { setFriend({ name: d.name, pick: d.id }); setLinked(true); net.send({ k: "welcome", id: live.current.mine, name: live.current.myName }); }
        else if (d.k === "pick") setFriend((f) => (f ? { ...f, pick: d.id } : f));
        else if (d.k === "bye") { setFriend(null); setLinked(false); setNote(t("বন্ধু বেরিয়ে গেছে।", "Your friend left.")); }
      } else if (d.k === "welcome") {
        window.clearInterval(helloRef.current);
        setFriend({ name: d.name, pick: d.id }); setLinked(true); setNote("");
      } else if (d.k === "pick") setFriend((f) => (f ? { ...f, pick: d.id } : f));
      else if (d.k === "bye") { setFriend(null); setLinked(false); setNote(t("হোস্ট বেরিয়ে গেছে।", "The host left.")); }
      else if (d.k === "start") {
        setStage(d.stage as StageId);
        setCfg({ role: "guest", a: d.a, b: d.b, stage: d.stage as StageId, level: "normal", seed: d.seed, na: d.na, nb: d.nb, net, key: Date.now() });
      }
    };
    net.handler = (d) => lobbyRef.current(d);
  }, [t]);

  const host = () => {
    if (!me || isGuest) return;
    stopRoom();
    const c = newCode();
    const net = new SdNet(c, me.id, myName, true);
    netRef.current = net;
    attach(net, "host");
    setRole("host"); setCode(c); setNote("");
  };
  const join = () => {
    const c = cleanCode(joinCode);
    if (!me || isGuest || c.length !== 5) { setNote(t("৫ অক্ষরের কোড লিখুন।", "Enter the 5-character code.")); return; }
    stopRoom();
    const net = new SdNet(c, me.id, myName, false);
    netRef.current = net;
    attach(net, "guest");
    setRole("guest"); setCode(c); setNote(t("সংযোগ হচ্ছে…", "Connecting…"));
    helloRef.current = window.setInterval(() => net.send({ k: "hello", id: live.current.mine, name: live.current.myName }), 1000);
    window.setTimeout(() => { if (netRef.current === net && !linkedRef.current) setNote(t("সাড়া নেই — কোডটি ঠিক আছে তো? হোস্ট কি রুম খুলেছে?", "No answer. Is the code right, and is the host in the room?")); }, 15000);
  };
  const linkedRef = useRef(false);
  linkedRef.current = linked;

  // tell the other side when my pick changes
  useEffect(() => { if (linked) netRef.current?.send({ k: "pick", id: mine }); }, [mine, linked]);

  const seed = () => 1 + Math.floor(Math.random() * 2_000_000_000);
  const startSolo = () => {
    sfx.unlock();
    setCfg({ role: mode === "cpu" ? "cpu" : "local", a: pickOf(mine), b: pickOf(foe), stage, level, seed: seed(), na: myName, nb: mode === "cpu" ? "CPU" : "P2", net: null, key: Date.now() });
  };
  const startHost = useCallback((a?: string, b?: string) => {
    const net = netRef.current;
    if (!net || !friend) return;
    sfx.unlock();
    const A = a ?? pickOf(mine), B = b ?? pickOf(friend.pick), s = seed();
    net.send({ k: "start", a: A, b: B, stage, seed: s, na: myName, nb: friend.name });
    setCfg({ role: "host", a: A, b: B, stage, level: "normal", seed: s, na: myName, nb: friend.name, net, key: Date.now() });
  }, [friend, mine, stage, myName]);

  const again = () => {
    if (!cfg) return;
    if (cfg.role === "host") startHost(cfg.a, cfg.b);
    else if (cfg.role === "cpu" || cfg.role === "local") setCfg({ ...cfg, seed: seed(), key: Date.now() });
  };
  const exitMatch = () => setCfg(null);

  if (cfg) return <div className="sd-wrap"><Match key={cfg.key} cfg={cfg} onExit={exitMatch} onAgain={again} /></div>;

  const pickId = aim === "me" || mode === "online" ? mine : foe;
  const setPick = (id: string) => { if (aim === "me" || mode === "online") setMine(id); else setFoe(id); };
  const query = q.trim().toLowerCase();
  const list = ROSTER.filter((s) => (!typeF || s.types.includes(typeF)) && (!query || s.name.toLowerCase().includes(query) || s.id.includes(query)));
  const foeShown = mode === "online" ? (friend?.pick ?? RANDOM) : foe;
  const card = (id: string, label: string) => {
    if (id === RANDOM) return <div className="sd-card"><b>?</b><small>{label}</small><small>{t("র‍্যান্ডম পোকেমন", "A random Pokémon")}</small></div>;
    const f = fighterOf(id);
    return (
      <div className="sd-card">
        <small>{label}</small>
        <b>{f.name}</b>
        <div className="sd-types">{f.types.map((ty) => <span key={ty} className="sd-type" style={{ background: TYPE_COLOR[ty] ?? "#777" }}>{ty}</span>)}</div>
        <small>{t("স্পেশাল", "Special")}: {f.special.name} · {t("সুপার", "Super")}: {lang === "bn" ? f.sup.bn : f.sup.name}</small>
      </div>
    );
  };
  const big = (id: string) => (id === RANDOM ? <div className="sd-big" style={{ display: "grid", placeItems: "center", fontSize: "5rem", color: "var(--color-lamp)" }}>?</div> : <img className="sd-big" src={shot(id, "ani")} alt="" onError={(e) => { e.currentTarget.src = shot(id, "dex"); }} />);
  const canFight = mode !== "online" || (role === "host" && linked);

  return (
    <div className="sd-wrap">
      <div className="sd-stagebox">
        <div className="sd-side sd-left">{big(mine)}{card(mine, mode === "local" ? "P1" : t("তুমি", "YOU"))}</div>
        <div className="sd-vs">VS</div>
        <div className="sd-side sd-right">{big(foeShown)}{card(foeShown, mode === "local" ? "P2" : mode === "online" ? (friend?.name ?? t("বন্ধুর অপেক্ষায়…", "Waiting for a friend…")) : t("প্রতিপক্ষ", "OPPONENT"))}</div>
      </div>

      <div className="sd-chips">
        <span className="sd-lab">{t("ধরন", "Mode")}</span>
        {([["cpu", t("কম্পিউটারের বিরুদ্ধে", "vs Computer")], ["local", t("২ জন (একই ডিভাইস)", "2 Players (one device)")], ["online", t("বন্ধুর সাথে (অনলাইন)", "Play with a friend")]] as [Mode, string][]).map(([m, label]) => (
          <button key={m} type="button" className={`sd-chip ${mode === m ? "on" : ""}`} onClick={() => { setMode(m); setAim("me"); if (m !== "online") stopRoom(); }}>{label}</button>
        ))}
      </div>

      {mode === "online" ? (
        <div className="sd-room">
          {isGuest ? <span className="sd-note">{t("অনলাইন খেলতে অ্যাকাউন্ট দিয়ে লগইন করুন।", "Sign in with an account to play online.")}</span> : role === null ? (
            <>
              <button type="button" className="sd-chip on" onClick={host}>{t("রুম খুলুন", "Host a room")}</button>
              <span className="sd-lab">{t("অথবা বন্ধুর কোড দিন", "or enter your friend's code")}</span>
              <input className="sd-codein" value={joinCode} maxLength={5} onChange={(e) => setJoinCode(cleanCode(e.target.value))} placeholder="CODE" onKeyDown={(e) => { if (e.key === "Enter") join(); }} />
              <button type="button" className="sd-chip" onClick={join}>{t("যোগ দিন", "Join")}</button>
            </>
          ) : (
            <>
              {role === "host" ? <><span className="sd-lab">{t("বন্ধুকে এই কোড দিন", "Give your friend this code")}</span><span className="sd-code">{code}</span>
                <button type="button" className="sd-ico" aria-label="copy" onClick={() => void navigator.clipboard?.writeText(code)}><Copy className="size-4" /></button></> : <span className="sd-lab">{t("রুম", "Room")} <b>{code}</b></span>}
              <span className="sd-note" style={{ margin: 0 }}>{linked ? (role === "host" ? t(`${friend?.name} যোগ দিয়েছে — লড়াই শুরু করুন!`, `${friend?.name} joined — start the fight!`) : t("সংযুক্ত — হোস্টের শুরুর অপেক্ষা…", "Connected — waiting for the host to start…")) : (note || (role === "host" ? t("বন্ধুর অপেক্ষায়…", "Waiting for your friend…") : ""))}</span>
              <button type="button" className="sd-chip" onClick={stopRoom}>{t("বেরিয়ে যান", "Leave room")}</button>
            </>
          )}
          {role === null && note ? <span className="sd-note" style={{ margin: 0 }}>{note}</span> : null}
        </div>
      ) : null}

      <div className="sd-chips">
        {mode !== "online" ? (
          <>
            <span className="sd-lab">{t("বাছছেন", "Picking for")}</span>
            <button type="button" className={`sd-chip ${aim === "me" ? "on" : ""}`} onClick={() => setAim("me")}>{mode === "local" ? "P1" : t("আমি", "You")}</button>
            <button type="button" className={`sd-chip ${aim === "foe" ? "on" : ""}`} onClick={() => setAim("foe")}>{mode === "local" ? "P2" : t("প্রতিপক্ষ", "Opponent")}</button>
          </>
        ) : null}
        <input className="sd-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("নাম খুঁজুন…", "Search…")} />
        <select className="sd-search" value={typeF} onChange={(e) => setTypeF(e.target.value)} aria-label="type">
          <option value="">{t("সব টাইপ", "All types")}</option>
          {TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
        </select>
      </div>

      <div className="sd-grid">
        <button type="button" className={`sd-tile ${pickId === RANDOM ? (aim === "foe" && mode !== "online" ? "foe" : "me") : ""}`} onClick={() => setPick(RANDOM)}>
          <span className="sd-q">?</span><span>{t("র‍্যান্ডম", "Random")}</span>
        </button>
        {list.map((s) => (
          <button key={s.id} type="button" className={`sd-tile ${mine === s.id ? "me" : ""} ${mode !== "online" && foe === s.id ? "foe" : ""}`} onClick={() => setPick(s.id)} title={s.name}>
            <img src={shot(s.id, "dex")} alt="" loading="lazy" />
            <span>{s.name}</span>
          </button>
        ))}
      </div>

      <div className="sd-chips">
        <span className="sd-lab">{t("মঞ্চ", "Stage")}</span>
        {STAGES.map((s) => <button key={s.id} type="button" className={`sd-chip ${stage === s.id ? "on" : ""}`} onClick={() => setStage(s.id)} disabled={mode === "online" && role === "guest"}>{lang === "bn" ? s.bn : s.name}</button>)}
      </div>
      {mode === "cpu" ? (
        <div className="sd-chips">
          <span className="sd-lab">{t("কম্পিউটার", "CPU")}</span>
          {LEVELS.map((l) => <button key={l.id} type="button" className={`sd-chip ${level === l.id ? "on" : ""}`} onClick={() => setLevel(l.id)}>{lang === "bn" ? l.bn : l.name}</button>)}
        </div>
      ) : null}

      <button type="button" className="sd-fight" disabled={!canFight} onClick={() => (mode === "online" ? startHost() : startSolo())}>
        {mode === "online" && role === "guest" ? t("হোস্ট শুরু করবে", "HOST STARTS THE FIGHT") : t("লড়াই!", "FIGHT!")}
      </button>
      <p className="sd-note">
        {mode === "local"
          ? t("P1: A D W S চলা/লাফ/ব্লক · F ঘুষি · G লাথি · H স্পেশাল · T সুপার.   P2: ← → ↑ ↓ · J K L · I সুপার।", "P1: A D move, W jump, S block · F jab · G kick · H special · T super.   P2: arrows · J K L · I super.")
          : t("A/D বা ← → চলা · W/↑ লাফ · S/↓ ব্লক · J ঘুষি · K লাথি · L স্পেশাল · স্পেস সুপার (পাওয়ার ভরলে)। ফোনে স্ক্রিনের বোতাম।", "A/D or ← → move · W/↑ jump · S/↓ block · J jab · K kick · L special · Space super (when POWER is full). Touch buttons on phones.")}
      </p>
    </div>
  );
}
