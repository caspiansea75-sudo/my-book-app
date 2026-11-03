import type { PointerEvent as ReactPointerEvent } from "react";
import { moveReach } from "@/lib/pokemon/arena-data";
import { moveOf, type Fighter } from "@/lib/pokemon/arena-engine";

/** What the move buttons need to share with the game loop. */
export type AimCtl = {
  queue: boolean[];
  /** Where a finger drag says to aim, and until when it counts (a held beam keeps following it for a moment). */
  touchAim: { x: number; y: number } | null;
  touchUntil: number;
  /** Set while a drag is in progress: which move is being aimed and where (for the preview). */
  preview: { slot: number; x: number; y: number } | null;
  /** The player's own Pokémon, updated every frame. */
  me: Fighter | undefined;
  /** Which way the camera looks when the view is from behind or through the player's eyes (null in the view from above). */
  yaw: number | null;
  drag: { id: number; sx: number; sy: number; moved: boolean } | null;
};

/** Finger travel (px) before a press counts as aiming, and the travel that means "as far as it goes". */
const DRAG_MIN = 14;
const DRAG_MAX = 96;

/**
 * Pointer handlers for a move button: tap = fire at the nearest foe; press, drag and let go = aim in that direction
 * (a lob lands as far as you dragged). A line or circle shows where it will go while you drag.
 */
export function aimHandlers(ctl: AimCtl, slot: number) {
  const end = () => {
    ctl.preview = null;
    ctl.drag = null;
  };
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      ctl.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const d = ctl.drag;
      const me = ctl.me;
      if (!d || d.id !== e.pointerId || !me) return;
      const vx = e.clientX - d.sx;
      const vy = e.clientY - d.sy;
      const l = Math.hypot(vx, vy);
      if (l < DRAG_MIN) {
        if (!d.moved) return;
      } else d.moved = true;
      if (!d.moved) return;
      const mv = moveOf(me, slot);
      const reach = moveReach(mv);
      const frac = Math.max(0.2, Math.min(1, (l - DRAG_MIN) / (DRAG_MAX - DRAG_MIN)));
      const dist = mv.kind === "lob" || mv.kind === "hazard" ? frac * reach : reach;
      let ux = l > 0 ? vx / l : 1;
      let uy = l > 0 ? vy / l : 0;
      if (ctl.yaw !== null) {
        // the drag is on the screen: up means the way the camera looks, right means the camera's right
        const cs = Math.cos(ctl.yaw);
        const sn = Math.sin(ctl.yaw);
        [ux, uy] = [cs * -uy - sn * ux, sn * -uy + cs * ux];
      }
      const p = { x: me.x + ux * Math.max(40, dist), y: me.y + uy * Math.max(40, dist) };
      ctl.preview = { slot, ...p };
      ctl.touchAim = p;
      ctl.touchUntil = Number.POSITIVE_INFINITY;
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const d = ctl.drag;
      if (!d || d.id !== e.pointerId) return;
      ctl.queue[slot] = true;
      if (d.moved && ctl.touchAim) ctl.touchUntil = performance.now() + 700;
      else ctl.touchAim = null; // a plain tap aims by itself
      end();
    },
    onPointerCancel: () => {
      ctl.touchAim = null;
      end();
    },
    onLostPointerCapture: () => {
      if (ctl.drag && !ctl.drag.moved) end();
    },
  };
}

/** The aim to give the game this frame: a finger drag while it counts, otherwise the mouse (or nothing). */
export function currentAim(ctl: AimCtl, mouse: { x: number; y: number } | null): { x: number; y: number } | null {
  if (ctl.touchAim) {
    if (performance.now() < ctl.touchUntil) return ctl.touchAim;
    ctl.touchAim = null;
  }
  return mouse;
}
