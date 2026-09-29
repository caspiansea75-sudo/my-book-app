import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSql } from "@/lib/db";
import { getCanonBook } from "@/lib/book";

/** Server-side helpers for members, sessions and "who may change this". */

export type Me = { id: number; username: string; displayName: string; role: "admin" | "member" };

const COOKIE = "bk_session";
const DAYS = 30;
const NOT_YOURS = "এটি আপনার তৈরি নয়, তাই বদলানো বা মোছা যাবে না";
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [tag, s, k] = stored.split("$");
  if (tag !== "scrypt" || !s || !k) return false;
  const want = Buffer.from(k, "base64");
  const key = await scrypt(pw, Buffer.from(s, "base64"), 64);
  return key.length === want.length && timingSafeEqual(key, want);
}

function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export async function memberFromCookieHeader(header: string | null | undefined): Promise<Me | null> {
  const token = readCookie(header, COOKIE);
  if (!token) return null;
  const sql = await getSql();
  const rows = await sql<{ id: number; username: string; display_name: string; role: string }>`
    select m.id, m.username, m.display_name, m.role
    from member_sessions s join members m on m.id = s.member_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, username: r.username, displayName: r.display_name, role: r.role === "admin" ? "admin" : "member" };
}

export async function currentMember(): Promise<Me | null> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  return memberFromCookieHeader(getRequestHeader("cookie"));
}

export async function requireMember(): Promise<Me> {
  const me = await currentMember();
  if (!me) throw new Error("আগে লগইন করুন");
  return me;
}

export async function startSession(memberId: number): Promise<void> {
  const sql = await getSql();
  const token = randomBytes(32).toString("base64url");
  await sql`delete from member_sessions where expires_at < now()`;
  await sql`
    insert into member_sessions (token_hash, member_id, expires_at)
    values (${sha256(token)}, ${memberId}, now() + interval '30 days')
  `;
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 86400,
  });
}

export async function endSession(): Promise<void> {
  const { getRequestHeader, deleteCookie } = await import("@tanstack/react-start/server");
  const token = readCookie(getRequestHeader("cookie"), COOKIE);
  if (token) {
    const sql = await getSql();
    await sql`delete from member_sessions where token_hash = ${sha256(token)}`;
  }
  deleteCookie(COOKIE, { path: "/" });
}

/* ---- "who may change this" ------------------------------------------------
   Admin: everything. Member: only rows whose owner_id is theirs.
   Rows with no owner (made before accounts) and the original JSON books are
   admin-only. A row that doesn't exist passes, so the handler reports it. */

const owns = (me: Me, owner: number | null) => me.role === "admin" || (owner != null && owner === me.id);

export async function assertBookAccess(me: Me, slug: string): Promise<void> {
  if (me.role === "admin") return;
  const sql = await getSql();
  const rows = await sql<{ owner_id: number | null }>`select owner_id from library_books where slug = ${slug} limit 1`;
  if (!rows[0]) {
    if (getCanonBook(slug)) throw new Error(NOT_YOURS);
    return;
  }
  if (!owns(me, rows[0].owner_id)) throw new Error(NOT_YOURS);
}

export async function assertSeriesAccess(me: Me, slug: string): Promise<void> {
  if (me.role === "admin") return;
  const sql = await getSql();
  const rows = await sql<{ owner_id: number | null }>`select owner_id from manga_series where slug = ${slug} limit 1`;
  if (rows[0] && !owns(me, rows[0].owner_id)) throw new Error(NOT_YOURS);
}

export async function assertMediaAccess(me: Me, ids: number[]): Promise<void> {
  if (me.role === "admin" || ids.length === 0) return;
  const sql = await getSql();
  const rows = await sql.query<{ owner_id: number | null }>(
    `select owner_id from media where id = any($1::int[])`,
    [ids],
  );
  if (rows.some((r) => !owns(me, r.owner_id))) throw new Error(NOT_YOURS);
}

export async function assertFolderAccess(me: Me, id: number): Promise<void> {
  if (me.role === "admin") return;
  const sql = await getSql();
  const rows = await sql<{ owner_id: number | null }>`select owner_id from media_folders where id = ${id} limit 1`;
  if (rows[0] && !owns(me, rows[0].owner_id)) throw new Error(NOT_YOURS);
}

export async function assertPanelAccess(me: Me, panelIds: number[]): Promise<void> {
  if (me.role === "admin" || panelIds.length === 0) return;
  const sql = await getSql();
  const rows = await sql.query<{ owner_id: number | null }>(
    `select s.owner_id from manga_panels p
     join manga_chapters c on c.id = p.chapter_id
     join manga_series s on s.id = c.series_id
     where p.id = any($1::int[])`,
    [panelIds],
  );
  if (rows.some((r) => !owns(me, r.owner_id))) throw new Error(NOT_YOURS);
}

/* ---- hidden items (admin can hide stories, manga, images/videos) ---------- */

export type HiddenKind = "book" | "manga" | "media";

export async function hiddenSet(kind: HiddenKind): Promise<Set<string>> {
  const sql = await getSql();
  const rows = await sql<{ key: string }>`select key from hidden_items where kind = ${kind}`;
  return new Set(rows.map((r) => r.key));
}

export async function isHidden(kind: HiddenKind, key: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ key: string }>`select key from hidden_items where kind = ${kind} and key = ${key} limit 1`;
  return rows.length > 0;
}
