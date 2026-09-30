import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCanonBook } from "@/lib/book";
import { isHidden, requireMember, type Me } from "@/lib/members-core";

/** Likes and comments on story chapters and manga chapters. Members only. */

const MAX_COMMENT = 1000;
const MAX_LIST = 100;
const NOT_FOUND = "পাওয়া যায়নি";
const TOO_FAST = "একটু ধীরে — কিছুক্ষণ পরে আবার চেষ্টা করুন";

export type Comment = {
  id: number;
  memberId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
  canDelete: boolean;
};
export type Engagement = {
  likeCount: number;
  liked: boolean;
  commentCount: number;
  comments: Comment[];
};

const slugPart = z.string().min(1).max(120).regex(/^[^:\s]+$/);
const targetSchema = z.object({
  kind: z.enum(["story", "manga"]),
  parent: slugPart,
  item: slugPart,
});
type Target = z.infer<typeof targetSchema>;

const keyOf = (t: Target) => `${t.parent}:${t.item}`;

/** The chapter must exist and (for non-admins) not be hidden. */
async function assertTarget(me: Me, t: Target): Promise<void> {
  const sql = await getSql();
  if (t.kind === "story") {
    if (me.role !== "admin" && (await isHidden("book", t.parent))) throw new Error(NOT_FOUND);
    if (getCanonBook(t.parent)) return;
    const r = await sql<{ x: number }>`select 1 as x from library_books where slug = ${t.parent} limit 1`;
    if (!r[0]) throw new Error(NOT_FOUND);
    return;
  }
  if (me.role !== "admin" && (await isHidden("manga", t.parent))) throw new Error(NOT_FOUND);
  const r = await sql<{ x: number }>`
    select 1 as x from manga_chapters c
    join manga_series s on s.id = c.series_id
    where s.slug = ${t.parent} and c.slug = ${t.item}
    limit 1
  `;
  if (!r[0]) throw new Error(NOT_FOUND);
}

type CommentRow = {
  id: number;
  member_id: number;
  body: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_id: number | null;
};

function toComment(r: CommentRow, me: Me): Comment {
  return {
    id: r.id,
    memberId: r.member_id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_id ? `/api/chat-image/${r.avatar_id}` : null,
    body: r.body,
    createdAt: r.created_at,
    canDelete: me.role === "admin" || r.member_id === me.id,
  };
}

async function likeState(me: Me, t: Target): Promise<{ likeCount: number; liked: boolean }> {
  const sql = await getSql();
  const key = keyOf(t);
  const rows = await sql<{ n: number; mine: boolean }>`
    select count(*)::int as n, coalesce(bool_or(member_id = ${me.id}), false) as mine
    from content_likes where kind = ${t.kind} and target = ${key}
  `;
  return { likeCount: rows[0]?.n ?? 0, liked: Boolean(rows[0]?.mine) };
}

export const getEngagement = createServerFn({ method: "GET" })
  .validator(targetSchema)
  .handler(async ({ data }): Promise<Engagement> => {
    const me = await requireMember();
    await assertTarget(me, data);
    const sql = await getSql();
    const key = keyOf(data);
    const likes = await likeState(me, data);
    const total = await sql<{ n: number }>`
      select count(*)::int as n from content_comments where kind = ${data.kind} and target = ${key}
    `;
    // Newest MAX_LIST comments, shown oldest-first.
    const rows = await sql<CommentRow>`
      select * from (
        select c.id, c.member_id, c.body, c.created_at, m.username, m.display_name, m.avatar_id
        from content_comments c join members m on m.id = c.member_id
        where c.kind = ${data.kind} and c.target = ${key}
        order by c.id desc
        limit ${MAX_LIST}
      ) t order by id asc
    `;
    return {
      ...likes,
      commentCount: total[0]?.n ?? 0,
      comments: rows.map((r) => toComment(r, me)),
    };
  });

export const toggleLike = createServerFn({ method: "POST" })
  .validator(targetSchema)
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertTarget(me, data);
    const sql = await getSql();
    const key = keyOf(data);
    const removed = await sql<{ member_id: number }>`
      delete from content_likes
      where member_id = ${me.id} and kind = ${data.kind} and target = ${key}
      returning member_id
    `;
    if (removed.length === 0) {
      await sql`
        insert into content_likes (member_id, kind, target)
        values (${me.id}, ${data.kind}, ${key})
        on conflict do nothing
      `;
    }
    return likeState(me, data);
  });

export const addComment = createServerFn({ method: "POST" })
  .validator(targetSchema.extend({ body: z.string().max(MAX_COMMENT, "মন্তব্য অনেক বড়") }))
  .handler(async ({ data }): Promise<Comment> => {
    const me = await requireMember();
    const body = data.body.trim();
    if (!body) throw new Error("কিছু লিখুন");
    await assertTarget(me, data);
    const sql = await getSql();

    const recent = await sql<{ n: number }>`
      select count(*)::int as n from content_comments
      where member_id = ${me.id} and created_at > now() - interval '1 minute'
    `;
    if ((recent[0]?.n ?? 0) >= 10) throw new Error(TOO_FAST);

    const rows = await sql<{ id: number; created_at: string }>`
      insert into content_comments (member_id, kind, target, body)
      values (${me.id}, ${data.kind}, ${keyOf(data)}, ${body})
      returning id, created_at
    `;
    const row = rows[0];
    if (!row) throw new Error(NOT_FOUND);
    const who = await sql<{ username: string; display_name: string; avatar_id: number | null }>`
      select username, display_name, avatar_id from members where id = ${me.id} limit 1
    `;
    return toComment(
      {
        id: row.id,
        member_id: me.id,
        body,
        created_at: row.created_at,
        username: who[0]?.username ?? me.username,
        display_name: who[0]?.display_name ?? me.displayName,
        avatar_id: who[0]?.avatar_id ?? null,
      },
      me,
    );
  });

/** Members delete their own comments; the admin can delete any. */
export const deleteComment = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    const rows = await sql<{ member_id: number }>`
      select member_id from content_comments where id = ${data.id} limit 1
    `;
    const row = rows[0];
    if (!row) return { ok: true };
    if (me.role !== "admin" && row.member_id !== me.id) throw new Error("এই মন্তব্য মোছার অনুমতি নেই");
    await sql`delete from content_comments where id = ${data.id}`;
    return { ok: true };
  });
