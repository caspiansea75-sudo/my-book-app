/** Fight Showdown online: a two-player room over WebRTC (the same P2PRoom the Arena rooms use). The host runs the fight. */
import { P2PRoom } from "@/lib/multiplayer";
import type { Input, World } from "./sd-engine";

export type Pulse = { a: boolean; m1: boolean; m2: boolean; m3: boolean; m4: boolean; s: boolean; u: boolean };
export type Wire =
  | { k: "hello"; id: string; name: string }
  | { k: "welcome"; id: string; name: string }
  | { k: "pick"; id: string }
  | { k: "start"; a: string; b: string; stage: string; seed: number; na: string; nb: string }
  | { k: "bye" }
  | { k: "in"; i: Input; p: Pulse }
  | { k: "w"; w: World };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newCode(): string {
  const b = new Uint8Array(5);
  crypto.getRandomValues(b);
  return Array.from(b, (v) => ALPHABET[v % ALPHABET.length]).join("");
}
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);

export class SdNet {
  private room: P2PRoom;
  private peer: string | null = null;
  handler: (d: Wire, from: string) => void = () => {};
  onPeers: (connected: boolean) => void = () => {};
  lastHeard = performance.now();

  constructor(code: string, meId: number, name: string, private host: boolean) {
    this.room = new P2PRoom({
      room: `fight-${code}`,
      selfId: `m${meId}`,
      name,
      onPeersChanged: (peers) => this.onPeers(peers.some((p) => p.connectionState === "connected")),
      onMessage: (from, data) => {
        // a room is for two: the host keeps the first one who says hello, the guest only listens to the host
        if (this.host && this.peer && from !== this.peer) return;
        const d = data as Wire;
        if (!d || typeof d !== "object" || typeof (d as { k?: unknown }).k !== "string") return;
        if (this.host && !this.peer && d.k === "hello") this.peer = from;
        if (!this.host) this.peer = from;
        this.lastHeard = performance.now();
        this.handler(d, from);
      },
    });
    void this.room.join();
  }

  /** reliable and in order: for hellos, picks and "start" */
  send(d: Wire) {
    if (this.peer) this.room.send(d, this.peer);
    else this.room.send(d);
  }
  /** fast and allowed to drop: for the 30-per-second world and input updates */
  cast(d: Wire) {
    this.room.broadcast(d);
  }
  close() {
    try { this.send({ k: "bye" }); } catch { /* closing anyway */ }
    this.room.close();
  }
}

/** Smooth the other player's view between two received worlds. */
export function blend(a: World, b: World, k: number): World {
  const lp = (x: number, y: number) => (Math.abs(y - x) > 420 ? y : x + (y - x) * k);
  return {
    ...b,
    p: [
      { ...b.p[0], x: lp(a.p[0].x, b.p[0].x), y: lp(a.p[0].y, b.p[0].y) },
      { ...b.p[1], x: lp(a.p[1].x, b.p[1].x), y: lp(a.p[1].y, b.p[1].y) },
    ],
    pr: b.pr.map((pr) => {
      const q = a.pr.find((x) => x.id === pr.id);
      return q ? { ...pr, x: lp(q.x, pr.x) } : pr;
    }),
  };
}
