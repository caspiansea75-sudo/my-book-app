import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  currentMember,
  endSession,
  hashPassword,
  safeEqual,
  startSession,
  verifyPassword,
  type Me,
} from "@/lib/members-core";

const BAD_LOGIN = "ইউজারনেম বা পাসওয়ার্ড ভুল";
const norm = (u: string) => u.trim().toLowerCase();
const adminName = () => norm(process.env.ADMIN_USERNAME ?? "");

export const getMe = createServerFn({ method: "GET" }).handler(async (): Promise<Me | null> => {
  return currentMember();
});

export const signup = createServerFn({ method: "POST" })
  .validator(
    z.object({
      username: z
        .string()
        .transform(norm)
        .pipe(z.string().regex(/^[a-z0-9_]{3,24}$/, "ইউজারনেম ৩–২৪ অক্ষর: ইংরেজি ছোট অক্ষর, সংখ্যা বা _")),
      password: z.string().min(8, "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর").max(100),
      displayName: z.string().trim().max(40).optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.username === adminName()) throw new Error("এই ইউজারনেম নেওয়া যাবে না");
    const sql = await getSql();
    const taken = await sql<{ id: number }>`select id from members where username = ${data.username}`;
    if (taken[0]) throw new Error("এই ইউজারনেম আগে থেকেই আছে");
    const hash = await hashPassword(data.password);
    const rows = await sql<{ id: number }>`
      insert into members (username, display_name, password_hash, role)
      values (${data.username}, ${data.displayName || data.username}, ${hash}, 'member')
      returning id
    `;
    await startSession(rows[0].id);
    return { ok: true };
  });

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string().transform(norm), password: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const adminPw = process.env.ADMIN_PASSWORD ?? "";

    // The built-in admin lives in environment variables, never in signup.
    if (adminName() && data.username === adminName()) {
      if (!adminPw || !safeEqual(data.password, adminPw)) throw new Error(BAD_LOGIN);
      const hash = await hashPassword(adminPw);
      const rows = await sql<{ id: number }>`
        insert into members (username, display_name, password_hash, role)
        values (${data.username}, 'অ্যাডমিন', ${hash}, 'admin')
        on conflict (username) do update set role = 'admin', password_hash = excluded.password_hash
        returning id
      `;
      await startSession(rows[0].id);
      return { ok: true };
    }

    const rows = await sql<{ id: number; password_hash: string }>`
      select id, password_hash from members where username = ${data.username} limit 1
    `;
    const row = rows[0];
    const ok = row ? await verifyPassword(data.password, row.password_hash) : false;
    if (!row || !ok) throw new Error(BAD_LOGIN);
    await startSession(row.id);
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await endSession();
  return { ok: true };
});

export type MemberRow = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "member";
  joined: string;
  books: number;
  series: number;
  media: number;
};

/** Read-only list of members. Admin only. */
export const listMembers = createServerFn({ method: "GET" }).handler(async (): Promise<MemberRow[]> => {
  const me = await currentMember();
  if (!me || me.role !== "admin") throw new Error("এই পাতা শুধু অ্যাডমিনের জন্য");
  const sql = await getSql();
  const rows = await sql<{
    id: number;
    username: string;
    display_name: string;
    role: string;
    joined: string;
    books: number;
    series: number;
    media: number;
  }>`
    select
      m.id,
      m.username,
      m.display_name,
      m.role,
      to_char(m.created_at, 'YYYY-MM-DD') as joined,
      (select count(*) from library_books b where b.owner_id = m.id) as books,
      (select count(*) from manga_series s where s.owner_id = m.id) as series,
      (select count(*) from media x where x.owner_id = m.id) as media
    from members m
    order by m.created_at desc, m.id desc
  `;
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role === "admin" ? "admin" : "member",
    joined: r.joined,
    books: Number(r.books),
    series: Number(r.series),
    media: Number(r.media),
  }));
});
