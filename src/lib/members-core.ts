import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSql } from "@/lib/db";
import { getCanonBook } from "@/lib/book";

/** Server-side helpers for members, sessions and "who may change this". */

export type Me = {
  id: number;
  username: string;
  displayName: string;
  /** "guest" = browsing without an account: may read, like and vote, nothing else. */
  role: "admin" | "member" | "guest";
  avatarUrl: string | null;
};

const GUEST_NAME = "অতিথি";
const NEED_ACCOUNT = "এই কাজের জন্য অ্যাকাউন্ট দরকার";

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
  const rows = await sql<{
    id: number;
    username: string;
    display_name: string;
    role: string;
    avatar_id: number | null;
  }>`
    select m.id, m.username, m.display_name, m.role, m.avatar_id
    from member_sessions s join members m on m.id = s.member_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role === "admin" ? "admin" : r.role === "guest" ? "guest" : "member",
    avatarUrl: r.avatar_id ? `/api/chat-image/${r.avatar_id}` : null,
  };
}

export async function currentMember(): Promise<Me | null> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  return memberFromCookieHeader(getRequestHeader("cookie"));
}

/**
 * Anyone with a session, guests included. Use ONLY for things a guest may do:
 * reading stories and manga, liking, voting, counting a view.
 */
export async function requireViewer(): Promise<Me> {
  const me = await currentMember();
  if (!me) throw new Error("আগে লগইন করুন");
  return me;
}

/**
 * A real member (or the admin). Guests are refused, so every feature that is
 * not explicitly opened to guests (comments, creating, gallery, chat, profile…)
 * stays closed to them by default.
 */
export async function requireMember(): Promise<Me> {
  const me = await requireViewer();
  if (me.role === "guest") throw new Error(NEED_ACCOUNT);
  return me;
}

export async function startSession(memberId: number, days = DAYS): Promise<void> {
  const sql = await getSql();
  const token = randomBytes(32).toString("base64url");
  await sql`delete from member_sessions where expires_at < now()`;
  await sql`
    insert into member_sessions (token_hash, member_id, expires_at)
    values (${sha256(token)}, ${memberId}, now() + make_interval(days => ${days}))
  `;
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 86400,
  });
}

/**
 * Starts a guest visit: a throw-away member row (role "guest") with no usable
 * password, so likes, votes and views work with the normal tables. Signing up
 * later turns this same row into a real member and keeps those likes/votes.
 */
export async function startGuestSession(): Promise<void> {
  const sql = await getSql();
  // Tidy up: guests whose sessions are all gone and who left no likes or votes behind.
  await sql`
    delete from members m
    where m.role = 'guest'
      and m.created_at < now() - interval '1 day'
      and not exists (select 1 from member_sessions s where s.member_id = m.id and s.expires_at > now())
      and not exists (select 1 from content_likes l where l.member_id = m.id)
      and not exists (select 1 from content_votes v where v.member_id = m.id)
  `;
  const name = `guest_${randomBytes(6).toString("hex")}`;
  const rows = await sql<{ id: number }>`
    insert into members (username, display_name, password_hash, role)
    values (${name}, ${GUEST_NAME}, 'guest$none', 'guest')
    returning id
  `;
  await startSession(rows[0].id, 90);
}

/**
 * Guests may only fetch pictures that are actually shown in a story or a manga
 * (panels, covers, inserted pictures) — never browse the gallery by id.
 */
export async function isMediaInPublicUse(id: number): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ ok: boolean }>`
    select (
      exists (select 1 from manga_panels where media_id = ${id})
      or exists (select 1 from manga_series where cover_media_id = ${id})
      or exists (select 1 from library_books where cover_media_id = ${id} and deleted_at is null)
      or exists (select 1 from book_covers where media_id = ${id})
      or exists (select 1 from chapter_inserts where media_id = ${id})
      or exists (
        select 1 from library_chapters c
        where c.deleted_at is null
          and jsonb_path_exists(
            c.body,
            '$.sections[*].paragraphs[*] ? (@.mediaId == $id)',
            jsonb_build_object('id', ${id}::int)
          )
      )
    ) as ok
  `;
  return Boolean(rows[0]?.ok);
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

/* ---- locks (a member can lock their own images/videos and folders) --------
   A locked file, or any file inside a locked folder (at any depth), is invisible to
   every other member: not in the gallery, not in the pickers, not fetchable by id.
   The owner and the admin are never locked out. Files already shown inside a story
   or manga keep showing to its readers (see /api/media/$id). */

const MEDIA_LOCKED = "এই ছবি/ভিডিওটি মালিক লক করে রেখেছেন, তাই ব্যবহার করা যাবে না";

const LOCKED_FOLDERS_CTE = `with recursive lf(id) as (
    select id from media_folders where locked
    union
    select f.id from media_folders f join lf on f.parent_id = lf.id
  )`;

/** Ids (out of `only`, or of every file) that are locked against `me`. Empty for the admin. */
export async function lockedMediaIds(me: Me, only?: number[]): Promise<Set<number>> {
  if (me.role === "admin") return new Set();
  const sql = await getSql();
  const rows = await sql.query<{ id: number }>(
    `${LOCKED_FOLDERS_CTE}
     select m.id from media m
     left join media_folder_items i on i.media_id = m.id
     where (m.locked or i.folder_id in (select id from lf))
       and m.owner_id is distinct from $1::int
       and ($2::int[] is null or m.id = any($2::int[]))`,
    [me.id, only ?? null],
  );
  return new Set(rows.map((r) => Number(r.id)));
}

export async function isMediaLockedFor(me: Me, id: number): Promise<boolean> {
  return (await lockedMediaIds(me, [id])).has(id);
}

/**
 * Refuses to put someone else's locked file into your own story, manga or cover.
 * `alreadyUsed` = files the thing already contained before this save, so that a lock
 * set later never breaks re-saving something that was fine when it was made.
 */
export async function assertMediaUsable(me: Me, ids: number[], alreadyUsed: Set<number> = new Set()): Promise<void> {
  const check = [...new Set(ids)].filter((id) => !alreadyUsed.has(id));
  if (check.length === 0) return;
  if ((await lockedMediaIds(me, check)).size > 0) throw new Error(MEDIA_LOCKED);
}

/* ---- hidden items (admin can hide stories, manga, images/videos) ---------- */

export type HiddenKind = "book" | "manga" | "media";

export async function hiddenSet(kind: HiddenKind): Promise<Set<string>> {
  const sql = await getSql();
  const rows = await sql<{ key: string }>`select key from hidden_items where kind = ${kind}`;
  return new Set(rows.map((r) => r.key));
}

/** Manual 18+ marks: slug -> true/false. A slug with no entry has not been marked either way. */
export async function adultMap(kind: "book" | "manga"): Promise<Map<string, boolean>> {
  const sql = await getSql();
  const rows = await sql<{ key: string; adult: boolean }>`select key, adult from adult_flags where kind = ${kind}`;
  return new Map(rows.map((r) => [r.key, r.adult]));
}

export async function isHidden(kind: HiddenKind, key: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ key: string }>`select key from hidden_items where kind = ${kind} and key = ${key} limit 1`;
  return rows.length > 0;
}
