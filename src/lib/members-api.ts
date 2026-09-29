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
