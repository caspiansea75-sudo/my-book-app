import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/members/avatar";
import { ArenaRenderer } from "@/components/pokemon/arena-render";
import { sfx } from "@/components/pokemon/arena-sfx";
import { aimHandlers, currentAim } from "@/components/pokemon/aim-pad";
import { RosterPicker } from "@/components/pokemon/roster-picker";
import { MovePicker, loadMoves, saveMoves } from "@/components/pokemon/move-picker";
import { TypeIcon } from "@/components/pokemon/type-icons";
import { Sprite, useT } from "@/components/pokemon/ui";
import { arenaCreate, arenaJoin, arenaLeave, arenaLobby, arenaNextRound, arenaPickSet, arenaRematch, arenaReport, arenaRoomGet, arenaStart, type ArenaLobby, type ArenaMode, type ArenaPick, type ArenaRoomView, type ArenaSeat } from "@/lib/arena-room-api";
import { PERK_BN } from "@/components/pokemon/arena-brawl";
import { GIMMICKS, MEGAS, MOVES, PERKS, ROSTER, TERA_TYPES, gimmicksFor, speciesOf, type GimmickKind } from "@/lib/pokemon/arena-data";
import { ARENA, applyPerk, begin, moveOf, newMpGame, nextWave, noInput, step, type Ev, type Fighter, type Input, type State } from "@/lib/pokemon/arena-engine";
import { InputReceiver, InputSender, SnapshotDecoder, SnapshotEncoder, type InputMsg, type Snap } from "@/lib/pokemon/arena-net";
import { P2PRoom } from "@/lib/multiplayer";
import { useMe } from "@/lib/use-me";
import { TYPE_COLOR } from "@/lib/pokemon/shared";
import "@/components/pokemon/arena-brawl.css";

const TILTS = [90, 60, 45, 30];
function readTilt() {
  try {
    const v = Number(localStorage.getItem("arena-brawl-tilt"));
    return TILTS.includes(v) ? v : 60;
  } catch {
    return 60;
  }
}
const PICK_KEY = "arena-multi-pick";
const DEFAULT_PICK: ArenaPick = { species: "charizard", gimmick: "awaken", mega: "", tera: "Fire", moves: [] };
const loadPick = (): ArenaPick => {
  try {
    const raw = JSON.parse(localStorage.getItem(PICK_KEY) ?? "null") as Partial<ArenaPick> | null;
    if (raw?.species && ROSTER.some((s) => s.id === raw.species && !s.unlock)) return { ...DEFAULT_PICK, ...raw, moves: loadMoves(raw.species) } as ArenaPick;
  } catch {
    /* no saved pick */
  }
  return DEFAULT_PICK;
};
const savePick = (p: ArenaPick) => {
  try {
    localStorage.setItem(PICK_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
};
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const coarse = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/* ======================================================================== */
/* choosing a Pokémon                                                        */
/* ======================================================================== */

function PickPanel({ pick, onChange }: { pick: ArenaPick; onChange: (p: ArenaPick) => void }) {
  const { t } = useT();
  const avail = gimmicksFor(pick.species);
  const forms = MEGAS[pick.species] ?? [];
  const set = (patch: Partial<ArenaPick>) => onChange({ ...pick, ...patch });
  const choose = (id: string) => {
    const sp = speciesOf(id);
    const ok = gimmicksFor(id) as string[];
    onChange({ species: id, gimmick: ok.includes(pick.gimmick) ? pick.gimmick : "awaken", mega: (MEGAS[id] ?? [])[0]?.id ?? "", tera: sp.types[0] ?? "Normal", moves: loadMoves(id) });
  };
  return (
    <div className="am-pick">
      <RosterPicker pick={pick.species} onPick={choose} isLocked={(s) => !!s.unlock} hideLocked />
      <MovePicker species={pick.species} moves={pick.moves.length === 4 ? pick.moves : loadMoves(pick.species)} onChange={(m) => { saveMoves(pick.species, m); set({ moves: m }); }} />
      <div className="ab-gim">
        <b>{t("ব্যাটল জিমিক", "Battle gimmick")}</b>
        <div className="ab-gim-row">
          {(["awaken", "mega", "zmove", "dynamax", "tera"] as GimmickKind[]).map((g) => (
            <button key={g} type="button" disabled={!avail.includes(g)} className={`ab-gbtn ${pick.gimmick === g ? "on" : ""}`} onClick={() => set({ gimmick: g })}>
              <span>{GIMMICKS[g].icon}</span>
              <em>{t(GIMMICKS[g].bn, GIMMICKS[g].label)}</em>
            </button>
          ))}
        </div>
        {pick.gimmick === "mega" && forms.length ? (
          <div className="ab-chips">
            {forms.map((m) => (
              <button key={m.id} type="button" className={`ab-chip ${(pick.mega || forms[0]!.id) === m.id ? "on" : ""}`} onClick={() => set({ mega: m.id })}>
                {m.name}
              </button>
            ))}
          </div>
        ) : null}
        {pick.gimmick === "tera" ? (
          <div className="ab-chips">
            {TERA_TYPES.map((ty) => (
              <button key={ty} type="button" className={`ab-chip ty ${pick.tera === ty ? "on" : ""}`} onClick={() => set({ tera: ty })} title={ty}>
                <TypeIcon type={ty} size={16} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ======================================================================== */
/* the lobby                                                                 */
/* ======================================================================== */

export function ArenaMulti() {
  const { t } = useT();
  const [lobby, setLobby] = useState<ArenaLobby | null>(null);
  const [room, setRoom] = useState<ArenaRoomView | null>(null);
  const [pick, setPickState] = useState<ArenaPick>(DEFAULT_PICK);
  const [max, setMax] = useState(4);
  const [mode, setMode] = useState<ArenaMode>("royale");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const roomId = room?.id ?? null;

  useEffect(() => setPickState(loadPick()), []);

  const setPick = (p: ArenaPick) => {
    setPickState(p);
    savePick(p);
    if (roomId && room?.status === "open") void arenaPickSet({ data: { id: roomId, pick: p } }).catch(() => undefined);
  };

  // the room list, until we sit in a room
  useEffect(() => {
    if (roomId) return;
    let dead = false;
    const load = async () => {
      try {
        const l = await arenaLobby();
        if (dead) return;
        setLobby(l);
        if (l.mine) {
          const v = await arenaRoomGet({ data: { id: l.mine } });
          if (!dead && v) setRoom(v);
        }
      } catch (e) {
        if (!dead) setErr(msg(e));
      }
    };
    void load();
    const id = setInterval(load, 3000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [roomId]);

  // the room itself: everybody polls it, which is also how the others know we are still here
  useEffect(() => {
    if (!roomId) return;
    let dead = false;
    const poll = async () => {
      try {
        const v = await arenaRoomGet({ data: { id: roomId } });
        if (dead) return;
        if (!v) {
          setRoom(null);
          setErr(t("রুমটি বন্ধ হয়ে গেছে", "That room has closed"));
        } else setRoom(v);
      } catch {
        /* a missed poll is fine */
      }
    };
    const id = setInterval(poll, 1200);
    return () => {
      dead = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = useCallback(async () => {
    if (roomId) await arenaLeave({ data: { id: roomId } }).catch(() => undefined);
    setRoom(null);
    setLobby(null);
  }, [roomId]);

  // leaving the page leaves the room
  useEffect(() => {
    if (!roomId) return;
    return () => {
      void arenaLeave({ data: { id: roomId } }).catch(() => undefined);
    };
  }, [roomId]);

  if (room?.status === "playing") {
    return (
      <MpGame
        key={room.rtcRoom}
        init={room}
        live={room}
        onLeave={leave}
        onRematch={() => run(async () => setRoom(await arenaRematch({ data: { id: room.id } })))}
        onReport={(results) => void arenaReport({ data: { id: room.id, round: room.round, results } }).then(setRoom).catch(() => undefined)}
        onNext={() => void arenaNextRound({ data: { id: room.id } }).then(setRoom).catch(() => undefined)}
      />
    );
  }

  if (room) {
    const isHost = room.hostId === room.you;
    const empty = Array.from({ length: Math.max(0, room.max - room.seats.length) });
    return (
      <div className="ab-menu am">
        <div className="am-head">
          <h3>{t("অপেক্ষার ঘর", "Waiting room")} · {room.seats.length}/{room.max} · {room.mode === "coop" ? t("টিম সারভাইভাল", "Co-op Survival") : t("ব্যাটল রয়্যাল · ৩ রাউন্ড", "Battle Royale · 3 rounds")}</h3>
          <p>{isHost ? t("কমপক্ষে ২ জন হলে শুরু করুন। বন্ধুরা এই পাতার “অনলাইন” ট্যাব থেকে রুমটি দেখে ঢুকতে পারবে।", "Start when at least 2 are in. Friends find this room under the Online tab of this page.") : t("হোস্ট শুরু করলে লড়াই শুরু হবে।", "The fight starts when the host starts it.")}</p>
        </div>
        <div className="am-seats">
          {room.seats.map((s) => <Seat key={s.memberId} seat={s} you={s.memberId === room.you} />)}
          {empty.map((_, i) => <div key={`e${i}`} className="am-seat empty">{t("ফাঁকা আসন", "Empty seat")}</div>)}
        </div>
        <PickPanel pick={pick} onChange={setPick} />
        {err ? <div className="am-err">{err}</div> : null}
        <div className="ab-row">
          {isHost ? (
            <button type="button" className="ab-btn" disabled={busy || room.seats.length < 2} onClick={() => run(async () => setRoom(await arenaStart({ data: { id: room.id } })))}>
              {t("লড়াই শুরু", "Start the fight")}
            </button>
          ) : null}
          <button type="button" className="ab-btn ghost" onClick={leave}>{t("বেরিয়ে যান", "Leave")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ab-menu am">
      <div className="am-head">
        <h3>{t("অনলাইন খেলা", "Play online")}</h3>
        <p>{t("২ থেকে ৫ জন সদস্য। প্রতিটি পোকেমনের মাথার উপর সদস্যের নাম দেখা যায়।", "2 to 5 members. Each Pokémon wears its member's name above its head.")}</p>
      </div>
      <PickPanel pick={pick} onChange={setPick} />
      <div className="am-create">
        <b>{t("নতুন রুম", "New room")}</b>
        <div className="ab-modes">
          <button type="button" className={`ab-mode ${mode === "royale" ? "on" : ""}`} onClick={() => setMode("royale")}>
            <b>{t("ব্যাটল রয়্যাল", "Battle Royale")}</b>
            <span>{t("৩ রাউন্ড, সবাই সবার শত্রু। স্থান অনুযায়ী পয়েন্ট; সবচেয়ে বেশি পয়েন্ট জেতে।", "3 rounds, everyone against everyone. Places earn points; most points wins the match.")}</span>
          </button>
          <button type="button" className={`ab-mode ${mode === "coop" ? "on" : ""}`} onClick={() => setMode("coop")}>
            <b>{t("টিম সারভাইভাল", "Co-op Survival")}</b>
            <span>{t("সবাই মিলে ওয়েভের বিরুদ্ধে। পড়ে গেলে পরের ওয়েভে সঙ্গীরা উঠে দাঁড়ায়। প্রতি ওয়েভের পর সবাই একটি পার্ক নেয়।", "Team up against the waves. Fallen teammates get back up next wave. Everyone picks a perk after each wave.")}</span>
          </button>
        </div>
        <div className="ab-chips">
          {[2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={`ab-chip ${max === n ? "on" : ""}`} onClick={() => setMax(n)}>{n} {t("জন", "players")}</button>
          ))}
        </div>
        <button type="button" className="ab-btn" disabled={busy} onClick={() => run(async () => setRoom(await arenaCreate({ data: { max, mode, pick } })))}>{t("রুম খুলুন", "Create room")}</button>
      </div>
      {err ? <div className="am-err">{err}</div> : null}
      <div className="am-rooms">
        <b>{t("খোলা রুম", "Open rooms")}</b>
        {lobby?.rooms.length ? (
          lobby.rooms.map((r) => (
            <div key={r.id} className="am-room">
              <div>
                <b>{r.host}</b>
                <small> · {r.count}/{r.max} · {r.mode === "coop" ? t("টিম সারভাইভাল", "Co-op") : t("রয়্যাল ×৩", "Royale ×3")}</small>
                <div className="am-names">{r.names.join(", ")}</div>
              </div>
              <button type="button" className="ab-btn" disabled={busy || r.count >= r.max} onClick={() => run(async () => setRoom(await arenaJoin({ data: { id: r.id, pick } })))}>{t("ঢুকুন", "Join")}</button>
            </div>
          ))
        ) : (
          <div className="am-none">{lobby ? t("এখন কোনো খোলা রুম নেই। একটি খুলুন!", "No open rooms right now. Open one!") : t("লোড হচ্ছে…", "Loading…")}</div>
        )}
      </div>
    </div>
  );
}

function Seat({ seat, you }: { seat: ArenaSeat; you: boolean }) {
  const { t } = useT();
  const sp = speciesOf(seat.species);
  return (
    <div className={`am-seat ${you ? "you" : ""}`}>
      <Avatar name={seat.name} url={seat.avatarUrl} size={28} />
      <div className="am-seat-who">
        <b>{seat.name}{seat.host ? " 👑" : ""}</b>
        <small>{you ? t("আপনি", "You") : ""}</small>
      </div>
      <Sprite info={{ id: sp.id, num: sp.num, types: sp.types }} still alt={sp.name} />
      <span>{sp.name}</span>
    </div>
  );
}

/* ======================================================================== */
/* the fight                                                                 */
/* ======================================================================== */

/** Match standings of a multi-round royale: points first, then round wins, then KOs. */
function Standings({ live, done, final }: { live: ArenaRoomView; done: boolean; final: boolean }) {
  const { t } = useT();
  const order = [...live.seats].sort((a, b) => b.points - a.points || b.wins - a.wins || b.kos - a.kos);
  return (
    <div className="am-stand">
      <b>{final && done ? `🏆 ${t("ম্যাচ চ্যাম্পিয়ন", "Match champion")}: ${order[0]?.name ?? "?"}` : t("পয়েন্ট", "Match points")}</b>
      {done ? (
        order.map((s, i) => (
          <div key={s.memberId} className={`am-rank-row ${s.memberId === live.you ? "you" : ""}`}>
            <b>{i + 1}</b>
            <span>{s.name}</span>
            <small>{s.points} {t("পয়েন্ট", "pts")} · {s.wins} {t("জয়", "wins")}</small>
          </div>
        ))
      ) : (
        <small>{t("পয়েন্ট গোনা হচ্ছে…", "Counting points…")}</small>
      )}
    </div>
  );
}

type Hud = { pill: "prep" | "ult" | "finish" | "recharge" | null; phase: State["phase"]; perks: string[]; wave: number; score: number; foes: number; name: string; hp: number; ghost: number; max: number; moves: { id: string; name: string; type: string }[]; cds: number[]; cdLeft: number[]; dodge: number; dodgeLeft: number; ult: number; gimmick: GimmickKind; gimmickT: number; alive: number; total: number; storm: boolean };
type Row = { id: number; member: number; name: string; species: string; place: number; kos: number; you: boolean };

type Wire = { k: string };

export function MpGame({ init, live, onLeave, onRematch, onReport, onNext }: { init: ArenaRoomView; live: ArenaRoomView; onLeave: () => void; onRematch: () => void; onReport: (r: { memberId: number; place: number; kos: number }[]) => void; onNext: () => void }) {
  const { t } = useT();
  const me = useMe();
  const isHost = init.hostId === init.you;
  const coop = init.mode === "coop";
  const finalRound = coop || init.curRound >= init.rounds;
  const [picked, setPicked] = useState(false);
  const cb = useRef({ onReport, onNext });
  cb.current = { onReport, onNext };
  const reported = useRef(false);
  const [status, setStatus] = useState<"connecting" | "play" | "lost" | "empty">("connecting");
  const [hud, setHud] = useState<Hud | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [team, setTeam] = useState({ wave: 0, score: 0 });
  const [out, setOut] = useState<number | null>(null);
  const [fs, setFs] = useState(true);
  const shell = useRef<HTMLDivElement>(null);
  const nativeFs = useRef(false);
  /** Real full screen needs a tap; the screen-filling layout is on from the start and the first touch upgrades it. */
  const goNative = useCallback(async () => {
    const el = shell.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    try {
      if (el && !document.fullscreenElement && (el.requestFullscreen || el.webkitRequestFullscreen)) {
        await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen!());
        nativeFs.current = true;
      }
    } catch {
      /* not allowed without a tap */
    }
    try {
      await (window.screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape");
    } catch {
      /* not allowed here */
    }
  }, []);
  const leaveFs = useCallback(() => {
    setFs(false);
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      window.screen.orientation?.unlock?.();
    } catch {
      /* already out */
    }
    nativeFs.current = false;
  }, []);
  useEffect(() => {
    void goNative();
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      void goNative();
    };
    window.addEventListener("pointerdown", once, { once: true });
    window.addEventListener("keydown", once, { once: true });
    const onChange = () => {
      if (!document.fullscreenElement && nativeFs.current) {
        nativeFs.current = false;
        setFs(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
      document.removeEventListener("fullscreenchange", onChange);
      try {
        if (document.fullscreenElement) void document.exitFullscreen();
        window.screen.orientation?.unlock?.();
      } catch {
        /* already out */
      }
    };
  }, [goNative]);
  const [zoom, setZoomState] = useState(1);
  const [tilt, setTiltState] = useState(60);
  useEffect(() => setTiltState(readTilt()), []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const joyEl = useRef<HTMLDivElement>(null);
  const ctl = useRef({ keys: new Set<string>(), joy: { x: 0, y: 0 }, aim: null as { x: number; y: number } | null, queue: [false, false, false, false] as [boolean, boolean, boolean, boolean], held: [false, false, false, false] as [boolean, boolean, boolean, boolean], dodge: false, ult: false, mouse: false, zoom: 1, R: null as ArenaRenderer | null, pickPerk: null as ((id: string) => void) | null, touchAim: null as { x: number; y: number } | null, touchUntil: 0, preview: null as { slot: number; x: number; y: number } | null, me: undefined as Fighter | undefined, drag: null as { id: number; sx: number; sy: number; moved: boolean } | null });
  const seats = useRef(init.seats);
  const myName = me?.displayName ?? "Player";

  const cycleTilt = useCallback((to?: number) => {
    const cur = ctl.current.R?.getTilt() ?? readTilt();
    const next = to ?? TILTS[(TILTS.indexOf(cur) + 1) % TILTS.length]!;
    ctl.current.R?.setTilt(next);
    setTiltState(next);
    try { localStorage.setItem("arena-brawl-tilt", String(next)); } catch { /* storage unavailable */ }
  }, []);

  const setZoom = useCallback((z: number) => {
    const v = Math.max(0.8, Math.min(2.2, Math.round(z * 100) / 100));
    ctl.current.zoom = v;
    ctl.current.R?.setZoom(v);
    setZoomState(v);
  }, []);

  // keys
  useEffect(() => {
    const c = ctl.current;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === " " || k === "shift") c.dodge = true;
      else if (k === "q") c.ult = true;
      else if (k === "+" || k === "=") setZoom(c.zoom + 0.15);
      else if (k === "-" || k === "_") setZoom(c.zoom - 0.15);
      else if (k === "t") cycleTilt();
      else if (k === "0") setZoom(1);
      else if (k === "1" || k === "j") c.queue[0] = true;
      else if (k === "2" || k === "k") c.queue[1] = true;
      else if (k === "3" || k === "l") c.queue[2] = true;
      else if (k === "4" || k === ";") c.queue[3] = true;
      else c.keys.add(k);
    };
    const up = (e: KeyboardEvent) => c.keys.delete(e.key.toLowerCase());
    const blur = () => {
      c.keys.clear();
      c.held = [false, false, false, false];
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [setZoom, cycleTilt]);

  useEffect(() => {
    document.documentElement.style.overflow = fs ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [fs]);

  // a new perk screen needs a new pick
  useEffect(() => {
    setPicked(false);
  }, [hud?.phase, hud?.wave]);

  // royale match: after the results, the host starts the next round
  useEffect(() => {
    if (!rows || !isHost || coop || finalRound) return;
    const id = setTimeout(() => cb.current.onNext(), 8000);
    return () => clearTimeout(id);
  }, [rows, isHost, coop, finalRound]);

  // ---- the fight itself
  useEffect(() => {
    const c = ctl.current;
    const cv = canvas.current;
    if (!cv) return;
    sfx.unlock();
    let dead = false;
    let raf = 0;
    const R = new ArenaRenderer(cv);
    c.R = R;
    R.setZoom(c.zoom);
    R.resize();
    const meId = init.you;
    const hostPeer = `m${init.hostId}`;
    const dec = new SnapshotDecoder();
    const enc = new SnapshotEncoder();
    const recv = new InputReceiver();
    const sender = new InputSender();
    const hellos = new Set<number>();
    const lastSeen = new Map<number, number>();
    let S: State | null = null; // the host's real fight
    let started = false;
    let outEvents: Ev[] = [];
    let lastSnap = 0;
    let lastKey = 0;
    let lastHello = 0;
    let lastFrame = 0;
    let lastSend = 0;
    let lastHeard = performance.now();
    let overT = 0;
    let hudAt = 0;
    let frameN = 0;
    const t0 = performance.now();
    const fidOfMember = new Map<number, number>();
    const picks = new Set<number>();
    let perkAt = 0;
    let lastPW = "";
    let perksSince = 0;
    let livePeers = new Set<string>();
    const hostPick = (fid: number, id: string) => {
      if (!S || S.phase !== "perks" || !S.perks.includes(id) || picks.has(fid)) return;
      const f = S.fighters.find((x) => x.id === fid);
      if (!f) return;
      applyPerk(S, f, id);
      picks.add(fid);
    };
    c.pickPerk = (id) => {
      if (isHost) {
        const fid = fidOfMember.get(meId);
        if (fid !== undefined) hostPick(fid, id);
      } else {
        // sent a few times: the host ignores repeats, and a dropped message must not leave everyone waiting.
        // Tagged with the wave and dropped once that perk screen is over, so an old pick can never land on the next one.
        const w = dec.S.wave;
        for (const d of [0, 600, 1500, 3000, 5000, 8000]) setTimeout(() => { if (d === 0 || (dec.S.phase === "perks" && dec.S.wave === w)) p2p.send({ k: "perk", id, w }, hostPeer); }, d);
      }
    };

    const p2p = new P2PRoom({
      room: init.rtcRoom,
      selfId: `m${meId}`,
      name: myName,
      onMessage: (from, data) => {
        const d = data as Wire;
        const member = Number(from.slice(1));
        if (isHost) {
          if (d.k === "hello") {
            hellos.add(member);
            if (S && started) p2p.send(enc.keyframe(S), from);
          } else if (d.k === "perk") {
            const fid = fidOfMember.get(member);
            const pw = (d as unknown as { w?: number }).w;
            if (fid !== undefined && (pw === undefined || !S || pw === S.wave)) hostPick(fid, (d as unknown as { id: string }).id);
          } else if (d.k === "in") {
            const fid = fidOfMember.get(member);
            if (fid !== undefined) recv.put(fid, d as InputMsg);
          }
        } else if (d.k === "s" && from === hostPeer) {
          lastHeard = performance.now();
          if (dec.apply(d as Snap)) setStatus((s) => (s === "connecting" ? "play" : s));
        }
      },
    });
    void p2p.join();

    const build = (): Input => {
      const k = c.keys;
      let mx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
      let my = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
      if (mx === 0 && my === 0) {
        mx = c.joy.x;
        my = c.joy.y;
      }
      const cast: [boolean, boolean, boolean, boolean] = [c.queue[0] || c.held[0] || c.mouse, c.queue[1] || c.held[1], c.queue[2] || c.held[2], c.queue[3] || c.held[3]];
      const inp: Input = { mx, my, aim: currentAim(c, c.aim), cast, dodge: c.dodge, ult: c.ult };
      c.queue = [false, false, false, false];
      c.dodge = false;
      c.ult = false;
      return inp;
    };

    const startFight = () => {
      const present = seats.current.filter((s) => s.memberId === meId || hellos.has(s.memberId));
      if (present.length < 2) {
        setStatus("empty");
        return false;
      }
      const G = newMpGame(present.map((s) => ({ member: s.memberId, name: s.name, species: s.species, gimmick: s.gimmick as GimmickKind, mega: s.mega, tera: s.tera, moves: s.moves })), coop ? "survival" : "royale");
      begin(G);
      // the host is always the first fighter
      G.fighters.sort((a, b) => (a.member === meId ? -1 : b.member === meId ? 1 : 0));
      for (const f of G.fighters) fidOfMember.set(f.member!, f.id);
      S = G;
      started = true;
      setStatus("play");
      p2p.send(enc.keyframe(G));
      return true;
    };

    const localEvents = (evs: Ev[], mine: Fighter | undefined) => {
      const mapped = evs.map((e) => {
        if (e.t === "hit") return { ...e, toPlayer: !!mine && Math.hypot(e.x - mine.x, e.y - mine.y) < mine.r + 16, byPlayer: false };
        if (e.t === "ko") return { ...e, player: !!mine && e.id === mine.id };
        return e;
      });
      R.feed(mapped, mine);
      for (const e of mapped) {
        switch (e.t) {
          case "cast": sfx.cast(e.kind); break;
          case "hit": if (e.toPlayer) sfx.hurt(); else sfx.hit(e.heavy, e.crit); break;
          case "explode": if (e.r >= 100) sfx.boom(); break;
          case "dodge": sfx.dodge(); break;
          case "perfect": sfx.perfect(); break;
          case "ko": sfx.ko(e.boss); break;
          case "awaken": sfx.boom(); break;
          case "mega": sfx.mega(); break;
          case "zstart": sfx.zstart(); break;
          case "zhit": sfx.zhit(); break;
          case "dynamax": sfx.dynamax(); break;
          case "tera": sfx.tera(); break;
          case "wave": sfx.wave(false); R.say(t("শুরু!", "FIGHT!"), "#ffffff"); break;
          case "storm": R.say(t("ঝড় আসছে!", "THE STORM CLOSES IN!"), "#d28bff"); break;
          default: break;
        }
      }
    };

    const tick = (now: number) => {
      if (dead) return;
      frameN++;
      const dt = Math.max(0, Math.min(0.05, (now - (lastFrame || now)) / 1000));
      lastFrame = now;
      const inp = build();
      let V: State | null = null;

      if (isHost) {
        if (!started) {
          const waited = now - t0;
          if (hellos.size >= seats.current.length - 1 || waited > 12000) {
            if (!startFight()) return;
          }
        }
        if (S) {
          // somebody whose connection is gone for good is knocked out
          if (frameN % 30 === 0) {
            const live = new Set(p2p.peerList().filter((p) => p.connectionState === "connected").map((p) => p.id));
            livePeers = live;
            for (const f of S.fighters) {
              if (!f.isPlayer || f.member === undefined || f.member === null || f.member === meId || !f.alive) continue;
              if (live.has(`m${f.member}`)) lastSeen.set(f.member!, now);
              else if (now - (lastSeen.get(f.member!) ?? t0 + 12000) > 6000) {
                f.alive = false;
                f.hp = 0;
                f.ghost = 0;
              }
            }
          }
          // co-op: everybody picks a perk between waves; whoever is slow gets a random one
          if (S.phase === "perks") {
            if (!perkAt) {
              perkAt = now;
              picks.clear();
            }
            const here = S.fighters.filter((f) => f.member === meId || livePeers.has(`m${f.member}`));
            if (here.every((f) => picks.has(f.id)) || now - perkAt > 12000) {
              for (const f of S.fighters) if (!picks.has(f.id)) applyPerk(S, f, S.perks[Math.floor(Math.random() * S.perks.length)]!);
              picks.clear();
              perkAt = 0;
              nextWave(S);
            }
          }
          const others = new Map<number, Input>();
          for (const f of S.fighters) if (f.member !== meId && f.alive) others.set(f.id, recv.take(f.id));
          step(S, inp, dt, others);
          const evs = S.events.slice();
          S.events.length = 0;
          outEvents.push(...evs);
          const mine = S.fighters.find((f) => f.member === meId);
          localEvents(evs, mine);
          if (now - lastSnap >= 50) {
            lastSnap = now;
            p2p.broadcast(enc.encode(S, outEvents, false));
            outEvents = [];
          }
          if (now - lastKey >= 1500) {
            lastKey = now;
            p2p.send(enc.keyframe(S));
          }
          // every change of phase or wave (perk screen opens, next wave starts) goes out as a complete copy a few times,
          // so nobody can stay on an old screen because a small update was lost
          const pw = `${S.phase}:${S.wave}`;
          if (pw !== lastPW) {
            lastPW = pw;
            for (const d of [0, 300, 900, 2000]) setTimeout(() => { if (S) p2p.send(enc.keyframe(S)); }, d);
          }
          V = S;
        }
      } else {
        if (!dec.ready && now - lastHello > 600) {
          lastHello = now;
          p2p.send({ k: "hello", member: meId }, hostPeer);
        }
        // our controls go to the host about 30 times a second
        const m = sender.next(inp, [c.held[0] || c.mouse, c.held[1], c.held[2], c.held[3]]);
        if (now - lastSend >= 33) {
          lastSend = now;
          p2p.broadcast(m);
        }
        if (dec.ready) {
          dec.glide(dt);
          V = dec.S;
          localEvents(dec.takeEvents(), V.fighters.find((f) => f.member === meId));
          if (now - lastHeard > 8000) setStatus("lost");
          // sitting on the perk screen for long: ask the host for a fresh complete copy in case the next wave's news got lost
          if (dec.S.phase === "perks") {
            if (!perksSince) perksSince = now;
            else if (now - perksSince > 5000 && now - lastHello > 2500) {
              lastHello = now;
              p2p.send({ k: "hello", member: meId }, hostPeer);
            }
          } else perksSince = 0;
        }
      }

      if (V) {
        const mine = V.fighters.find((f) => f.member === meId);
        for (const z of V.zones) z.player = !!mine && z.owner === mine.id;
        c.me = mine;
        R.setAim(mine && c.preview ? { from: mine, mv: moveOf(mine, c.preview.slot), x: c.preview.x, y: c.preview.y } : null, c.aim);
        try {
          R.render(V, dt, mine?.alive ? mine : undefined);
        } catch (err) {
          console.error("Arena Brawl: a frame failed to draw", err);
        }
        if (now - hudAt > 90 && mine) {
          hudAt = now;
          const ids = mine.sp.moves;
          const alive = V.fighters.filter((f) => f.alive).length;
          setOut(mine.alive ? null : coop ? 0 : mine.place ?? alive + 1);
          const finishing = V.fighters.some((f) => f.alive && f.team !== mine.team && f.hp / f.maxHp < 0.2 && Math.hypot(f.x - mine.x, f.y - mine.y) < 420);
          const gl = Math.max(mine.awaken, mine.mega, mine.dyna, mine.tera?.t ?? 0);
          setHud({
            pill: !mine.alive ? null : mine.cast || mine.channel ? "prep" : mine.ult >= 100 && gl <= 0 ? "ult" : finishing ? "finish" : mine.cd.every((cd) => cd > 0.05) ? "recharge" : null,
            phase: V.phase,
            perks: V.perks,
            wave: V.wave,
            score: V.score,
            foes: V.fighters.filter((f) => f.alive && f.team !== 0).length,
            name: mine.form?.name ?? mine.sp.name,
            hp: mine.hp,
            ghost: mine.ghost,
            max: mine.maxHp,
            moves: ids.map((_, i) => {
              const mv = moveOf(mine, i);
              return { id: mv.id, name: mv.name, type: mv.type };
            }),
            cds: ids.map((_, i) => Math.max(0, mine.cd[i]! / (moveOf(mine, i).cd * mine.cdMul))),
            cdLeft: ids.map((_, i) => mine.cd[i]!),
            dodge: Math.max(0, mine.dodge.cd / (1.15 * mine.dodgeMul)),
            dodgeLeft: mine.dodge.cd,
            ult: mine.ult,
            gimmick: mine.gimmick,
            gimmickT: Math.max(mine.awaken, mine.mega, mine.dyna, mine.tera?.t ?? 0),
            alive,
            total: V.fighters.length,
            storm: V.storm.on,
          });
        }
        if (V.phase === "over") {
          overT += dt;
          if (overT > 2) {
            const list = coop ? [...V.fighters].sort((a, b) => b.kos - a.kos) : [...V.fighters].sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
            if (!rowsShown.current) {
              rowsShown.current = true;
              setRows(list.map((f, i) => ({ id: f.id, member: f.member ?? 0, name: f.name ?? "?", species: f.sp.name, place: coop ? i + 1 : f.place ?? i + 1, kos: f.kos, you: f.member === meId })));
              setTeam({ wave: V.wave, score: V.score });
              if (!coop && V.winnerId && mine?.id === V.winnerId) sfx.win();
              else sfx.lose();
              // the host writes the round into the match standings
              if (isHost && !coop && !reported.current) {
                reported.current = true;
                cb.current.onReport(list.map((f, i) => ({ memberId: f.member ?? 0, place: Math.min(5, f.place ?? i + 1), kos: Math.min(99, f.kos) })));
              }
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const rowsShown = { current: false };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => R.resize());
    if (stage.current) ro.observe(stage.current);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      p2p.close();
      c.R = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aimFrom(e: React.PointerEvent) {
    const cv = canvas.current;
    const R = ctl.current.R;
    if (!cv || !R || e.pointerType !== "mouse") return;
    const b = cv.getBoundingClientRect();
    ctl.current.aim = R.toWorld(((e.clientX - b.left) / b.width) * ARENA.W, ((e.clientY - b.top) / b.height) * ARENA.H);
  }
  /** The stick is floating: it appears under the thumb anywhere in the wide area, and steers by how far the thumb moves from there. */
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const joyMove = (e: React.PointerEvent, start = false) => {
    const el = joyEl.current;
    if (!el) return;
    if (start) {
      el.style.transform = "";
      const b0 = el.getBoundingClientRect();
      const zone = (e.currentTarget as HTMLElement).getBoundingClientRect();
      // keep the whole stick inside the area
      const cx = Math.min(zone.right - b0.width / 2, Math.max(zone.left + b0.width / 2, e.clientX));
      const cy = Math.min(zone.bottom - b0.height / 2, Math.max(zone.top + b0.height / 2, e.clientY));
      joyOrigin.current = { x: cx, y: cy };
      el.style.transform = `translate(${cx - (b0.left + b0.width / 2)}px, ${cy - (b0.top + b0.height / 2)}px)`;
      el.classList.add("on");
    }
    const o = joyOrigin.current;
    if (!o) return;
    const r = el.offsetWidth / 2;
    let x = (e.clientX - o.x) / r;
    let y = (e.clientY - o.y) / r;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    ctl.current.joy = { x: Math.abs(x) < 0.15 ? 0 : x, y: Math.abs(y) < 0.15 ? 0 : y };
    const knob = el.firstElementChild as HTMLElement | null;
    if (knob) knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
  };
  const joyEnd = () => {
    ctl.current.joy = { x: 0, y: 0 };
    joyOrigin.current = null;
    const el = joyEl.current;
    if (!el) return;
    el.style.transform = "";
    el.classList.remove("on");
    const knob = el.firstElementChild as HTMLElement | null;
    if (knob) knob.style.transform = "";
  };

  const hpColor = (v: number) => (v > 0.5 ? "#4cd964" : v > 0.25 ? "#ffb020" : "#ff453a");
  const pct = hud ? hud.hp / hud.max : 1;
  const padBtn = (i: number, cls: string) => {
    const cur = hud?.moves[i];
    const mine = speciesOf(seats.current.find((s) => s.memberId === init.you)?.species ?? "charizard");
    const mv = cur ? { name: cur.name, type: cur.type } : MOVES[(seats.current.find((s) => s.memberId === init.you)?.moves ?? mine.moves)[i]!]!;
    const f = hud?.cds[i] ?? 0;
    return (
      <button
        key={i}
        type="button"
        className={`ab-pb ${cls} ${f <= 0 ? "ready" : ""}`}
        style={{ ["--c" as string]: TYPE_COLOR[mv.type] ?? "#fff", ["--f" as string]: Math.min(1, f) }}
        aria-label={mv.name}
        {...aimHandlers(ctl.current, i)}
      >
        <span className="pb-ic"><TypeIcon type={mv.type} size={26} /></span>
        <span className="pb-nm">{mv.name}</span>
        <span className="pb-ky">{i + 1}</span>
        {f > 0 ? <span className="pb-cd">{(hud?.cdLeft[i] ?? 0).toFixed(hud && hud.cdLeft[i]! < 10 ? 1 : 0)}</span> : null}
      </button>
    );
  };

  return (
    <div className="ab">
      <div ref={shell} className={`ab-shell ${fs ? "fs" : ""}`} onContextMenu={(e) => e.preventDefault()}>
        <div
          ref={stage}
          className="ab-stage"
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") {
              aimFrom(e);
              ctl.current.mouse = e.button === 0;
              if (e.button === 2) ctl.current.queue[1] = true;
            }
          }}
          onPointerMove={(e) => aimFrom(e)}
          onPointerUp={(e) => { if (e.pointerType === "mouse") ctl.current.mouse = false; }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") { ctl.current.mouse = false; ctl.current.aim = null; } }}
        >
          <canvas ref={canvas} />
        </div>

        {hud ? (
          <div className="ab-hud">
            <div className="ab-me">
              <b>{myName}</b>
              <small>{hud.name} · {Math.ceil(hud.hp)} / {hud.max}</small>
              <div className="ab-bar">
                <i className="ghost" style={{ width: `${Math.max(0, (hud.ghost / hud.max) * 100)}%` }} />
                <i className="fill" style={{ width: `${Math.max(0, pct * 100)}%`, background: hpColor(pct) }} />
              </div>
              {hud.gimmickT > 0 ? <div className="ab-awk">{GIMMICKS[hud.gimmick].icon} {t(GIMMICKS[hud.gimmick].bn, GIMMICKS[hud.gimmick].short)} {hud.gimmickT.toFixed(1)}s</div> : null}
            </div>
            {hud.pill ? <div className={`ab-pill ${hud.pill}`}>{hud.pill === "prep" ? t("আক্রমণ তৈরি হচ্ছে", "Preparing attack") : hud.pill === "ult" ? t("ক্রোধ পূর্ণ! আলটিমেট ছাড়ুন (Q)", "Fury is full! Unleash your ultimate") : hud.pill === "finish" ? t("শেষ আঘাত!", "Finishing blow!") : t("রিচার্জ হচ্ছে", "Recharging")}</div> : null}
            <div className="ab-top">
              {coop ? <>{t("ওয়েভ", "Wave")} {hud.wave}</> : <>{t("রাউন্ড", "Round")} {init.curRound}/{init.rounds}</>}
              {coop ? <span>{t("শত্রু", "Foes")} {hud.foes}</span> : <span>{t("বেঁচে আছে", "Alive")} {hud.alive}/{hud.total}</span>}
              {coop ? <span className="sc">★ {hud.score}</span> : null}
              {hud.storm ? <span>🌀</span> : null}
            </div>
            <div className="ab-tools">
              <button type="button" className="ab-ic wide" onClick={() => cycleTilt()} aria-label="Camera angle" title="T">{tilt}°</button>
              <button type="button" className="ab-ic" onClick={() => setZoom(zoom - 0.15)} aria-label="Zoom out">−</button>
              <button type="button" className="ab-ic" onClick={() => setZoom(zoom + 0.15)} aria-label="Zoom in">+</button>
              <button type="button" className="ab-ic" onClick={() => { if (fs) leaveFs(); else { setFs(true); void goNative(); } }} aria-label="Full screen">⛶</button>
              <button type="button" className="ab-ic" onClick={() => { const v = !sfx.isMuted(); sfx.setMuted(v); }} aria-label="Sound">🔊</button>
            </div>
            <div className="ab-ctl">
              <div className="ab-joyzone" onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); joyMove(e, true); }} onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture?.(e.pointerId)) joyMove(e); }} onPointerUp={joyEnd} onPointerCancel={joyEnd} />
            <div ref={joyEl} className="ab-joy">
              <i />
            </div>
              <div className="ab-pad">
                {padBtn(0, "m1")}
                {padBtn(1, "m2")}
                {padBtn(2, "m3")}
                {padBtn(3, "m4")}
                <button type="button" className={`ab-pb dodge ${hud.dodge <= 0 ? "ready" : ""}`} style={{ ["--c" as string]: "#7fe3ff", ["--f" as string]: Math.min(1, hud.dodge) }} aria-label="Roll" onPointerDown={(e) => { e.preventDefault(); ctl.current.dodge = true; }}>
                  <span className="pb-ic">🌀</span>
                  <span className="pb-nm">{t("গড়ান", "Roll")}</span>
                  <span className="pb-ky">Space</span>
                  {hud.dodge > 0 ? <span className="pb-cd">{hud.dodgeLeft.toFixed(1)}</span> : null}
                </button>
                <button type="button" className={`ab-pb ult ${hud.ult >= 100 && hud.gimmickT <= 0 ? "ready full" : ""}`} style={{ ["--c" as string]: "#ffd54a", ["--f" as string]: hud.gimmickT > 0 ? 0 : 1 - Math.min(1, hud.ult / 100) }} aria-label="Gimmick" onPointerDown={(e) => { e.preventDefault(); ctl.current.ult = true; }}>
                  <span className="pb-ic">{GIMMICKS[hud.gimmick].icon}</span>
                  <span className="pb-nm">{hud.gimmickT > 0 ? `${hud.gimmickT.toFixed(0)}s` : hud.ult >= 100 ? GIMMICKS[hud.gimmick].short : `${Math.floor(hud.ult)}%`}</span>
                  <span className="pb-ky">Q</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {status === "connecting" ? (
          <div className="ab-ov"><div><h2>{t("সংযোগ হচ্ছে…", "Connecting…")}</h2><p>{isHost ? t("সবাই ঢুকলে লড়াই শুরু হবে।", "The fight starts as soon as everyone is in.") : t("হোস্টের সাথে যুক্ত হচ্ছে।", "Reaching the host.")}</p><button type="button" className="ab-btn ghost" onClick={onLeave}>{t("বেরিয়ে যান", "Leave")}</button></div></div>
        ) : null}
        {status === "empty" ? (
          <div className="ab-ov"><div><h2>{t("কেউ যুক্ত হতে পারেনি", "Nobody could connect")}</h2><p>{t("ব্রাউজার সরাসরি সংযোগ দিতে পারেনি (কড়া ফায়ারওয়াল বা নেটওয়ার্ক হতে পারে)। আবার চেষ্টা করুন।", "The browsers could not reach each other directly (a strict firewall or network can cause that). Try again.")}</p><button type="button" className="ab-btn" onClick={onLeave}>{t("ফিরে যান", "Back")}</button></div></div>
        ) : null}
        {status === "lost" ? (
          <div className="ab-ov"><div><h2>{t("হোস্টের সংযোগ কেটে গেছে", "Lost the host")}</h2><button type="button" className="ab-btn" onClick={onLeave}>{t("ফিরে যান", "Back")}</button></div></div>
        ) : null}

        {out !== null && !rows && hud?.phase !== "perks" ? (
          <div className="am-out">
            {coop
              ? t("আপনি পড়ে গেছেন: পরের ওয়েভে সঙ্গীরা আপনাকে তুলবে", "You are down: you get back up next wave")
              : t(`আপনি আউট! স্থান #${out}: দেখতে থাকুন`, `You are out! Place #${out}: keep watching`)}
          </div>
        ) : null}

        {hud?.phase === "perks" && !rows ? (
          <div className="ab-ov">
            <div>
              <h2>{t("ওয়েভ সাফ!", "Wave cleared!")}</h2>
              {picked ? (
                <p>{t("অন্যদের জন্য অপেক্ষা…", "Waiting for the others…")}</p>
              ) : (
                <>
                  <p>{t("আপনার পার্ক বেছে নিন", "Pick your perk")}</p>
                  <div className="ab-perks">
                    {hud.perks.map((id) => {
                      const pk = PERKS.find((x) => x.id === id);
                      if (!pk) return null;
                      return (
                        <button key={id} type="button" className="ab-perk" onClick={() => { sfx.pick(); setPicked(true); ctl.current.pickPerk?.(id); }}>
                          <div className="em">{pk.icon}</div>
                          <b>{t(PERK_BN[id]?.[0] ?? pk.name, pk.name)}</b>
                          <span>{t(PERK_BN[id]?.[1] ?? pk.desc, pk.desc)}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {rows ? (
          <div className="ab-ov">
            <div>
              {coop ? (
                <>
                  <h2 style={{ color: "#ffb4a8" }}>{t("টিম হেরে গেছে", "The team has fallen")}</h2>
                  <p>{t("পৌঁছেছেন", "Reached")} {t("ওয়েভ", "wave")} <b>{team.wave}</b> · ★ <b>{team.score}</b></p>
                </>
              ) : (
                <h2 style={{ color: rows[0]?.you ? "#ffd54a" : "#fff" }}>
                  {init.rounds > 1 ? `${t("রাউন্ড", "Round")} ${init.curRound}/${init.rounds}: ` : ""}
                  {rows[0]?.you ? t("আপনি জিতেছেন!", "You won!") : `${rows[0]?.name ?? "?"} ${t("জিতেছে", "wins")}`}
                </h2>
              )}
              <div className="am-rank">
                {rows.map((r) => (
                  <div key={r.id} className={`am-rank-row ${r.you ? "you" : ""}`}>
                    <b>{coop ? "" : `#${r.place}`}</b>
                    <span>{r.name}{r.you ? ` (${t("আপনি", "you")})` : ""}</span>
                    <small>{r.species} · {r.kos} KO</small>
                  </div>
                ))}
              </div>
              {!coop && init.rounds > 1 ? <Standings live={live} done={live.reportedRound >= init.round} final={finalRound} /> : null}
              <div className="ab-row">
                {finalRound ? (
                  isHost ? <button type="button" className="ab-btn" onClick={onRematch}>{t("আবার খেলুন", "Rematch")}</button> : <small>{t("হোস্ট আবার শুরু করলে ঘরে ফিরবেন", "You go back to the room when the host starts a rematch")}</small>
                ) : (
                  <small>{t("পরের রাউন্ড শুরু হচ্ছে…", "Next round starting…")}</small>
                )}
                <button type="button" className="ab-btn ghost" onClick={onLeave}>{t("বেরিয়ে যান", "Leave")}</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="ab-help">
        {t("চলুন WASD · চাল ১–৪ · গড়ান Space · জিমিক Q · লক্ষ্য মাউস। এই ট্যাব খোলা রাখুন: হোস্টের ট্যাব বন্ধ বা লুকানো থাকলে সবার খেলা থেমে যায়।", "Move WASD · moves 1–4 · roll Space · gimmick Q · aim with the mouse. Keep this tab open and visible: if the host's tab is hidden the fight stalls for everybody.")}
      </div>
    </div>
  );
}

void noInput;
void coarse;
