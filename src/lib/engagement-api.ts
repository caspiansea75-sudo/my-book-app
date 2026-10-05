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
  viewCount: number;
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
    const r = await sql<{ x: number }>`select 1 as x from library_books where slug = ${t.parent} and deleted_at is null limit 1`;
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
    const views = await sql<{ n: number }>`
      select count(*)::int as n from content_views where kind = ${data.kind} and target = ${key}
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
      viewCount: views[0]?.n ?? 0,
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

/**
 * Counts a view of one chapter. A member counts once per chapter per day, so reloading the page
 * does not push the number up.
 */
export const recordView = createServerFn({ method: "POST" })
  .validator(targetSchema)
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertTarget(me, data);
    const sql = await getSql();
    await sql`
      insert into content_views (member_id, kind, target)
      values (${me.id}, ${data.kind}, ${keyOf(data)})
      on conflict do nothing
    `;
    return { ok: true };
  });

export type ContentStats = { views: number; likes: number; comments: number; score: number };

/**
 * Views, likes and comments added up per story / per manga series (all of its chapters).
 * Pass `parents` to get only some of them.
 */
export const getContentStats = createServerFn({ method: "GET" })
  .validator(z.object({ kind: z.enum(["story", "manga"]), parents: z.array(slugPart).max(300).optional() }))
  .handler(async ({ data }): Promise<Record<string, ContentStats>> => {
    await requireMember();
    const sql = await getSql();
    const parents = data.parents ?? null;
    const out: Record<string, ContentStats> = {};
    const add = (rows: { parent: string; n: number }[], field: keyof ContentStats) => {
      for (const r of rows) (out[r.parent] ??= { views: 0, likes: 0, comments: 0, score: 0 })[field] = Number(r.n);
    };
    add(
      await sql<{ parent: string; n: number }>`
        select split_part(target, ':', 1) as parent, count(*)::int as n from content_views
        where kind = ${data.kind} and (${parents}::text[] is null or split_part(target, ':', 1) = any(${parents}::text[]))
        group by 1`,
      "views",
    );
    add(
      await sql<{ parent: string; n: number }>`
        select split_part(target, ':', 1) as parent, count(*)::int as n from content_likes
        where kind = ${data.kind} and (${parents}::text[] is null or split_part(target, ':', 1) = any(${parents}::text[]))
        group by 1`,
      "likes",
    );
    add(
      await sql<{ parent: string; n: number }>`
        select split_part(target, ':', 1) as parent, count(*)::int as n from content_comments
        where kind = ${data.kind} and (${parents}::text[] is null or split_part(target, ':', 1) = any(${parents}::text[]))
        group by 1`,
      "comments",
    );
    add(
      await sql<{ parent: string; n: number }>`
        select parent, coalesce(sum(value), 0)::int as n from content_votes
        where kind = ${data.kind} and (${parents}::text[] is null or parent = any(${parents}::text[]))
        group by parent`,
      "score",
    );
    return out;
  });

/* ------------------------------------------------------------- reputation */

export type Reputation = {
  score: number;
  up: number;
  down: number;
  /** My vote: 1 = up, -1 = down, 0 = none. */
  mine: -1 | 0 | 1;
  /** False on my own story / series (you cannot vote for your own work). */
  canVote: boolean;
};

const parentSchema = z.object({ kind: z.enum(["story", "manga"]), parent: slugPart });

/** The story or series must exist and (for non-admins) not be hidden. Returns who owns it. */
async function assertParent(me: Me, kind: "story" | "manga", parent: string): Promise<{ ownerId: number | null }> {
  const sql = await getSql();
  if (me.role !== "admin" && (await isHidden(kind === "story" ? "book" : "manga", parent))) throw new Error(NOT_FOUND);
  if (kind === "story") {
    if (getCanonBook(parent)) return { ownerId: null };
    const r = await sql<{ owner_id: number | null }>`
      select owner_id from library_books where slug = ${parent} and deleted_at is null and extends_slug is null limit 1
    `;
    if (!r[0]) throw new Error(NOT_FOUND);
    return { ownerId: r[0].owner_id ?? null };
  }
  const r = await sql<{ owner_id: number | null }>`select owner_id from manga_series where slug = ${parent} limit 1`;
  if (!r[0]) throw new Error(NOT_FOUND);
  return { ownerId: r[0].owner_id ?? null };
}

async function reputationOf(me: Me, kind: "story" | "manga", parent: string, ownerId: number | null): Promise<Reputation> {
  const sql = await getSql();
  const rows = await sql<{ up: number; down: number; mine: number | null }>`
    select (count(*) filter (where value = 1))::int as up,
           (count(*) filter (where value = -1))::int as down,
           max(case when member_id = ${me.id} then value end)::int as mine
    from content_votes where kind = ${kind} and parent = ${parent}
  `;
  const r = rows[0];
  const up = Number(r?.up ?? 0);
  const down = Number(r?.down ?? 0);
  const mine = Number(r?.mine ?? 0);
  return {
    score: up - down,
    up,
    down,
    mine: mine === 1 ? 1 : mine === -1 ? -1 : 0,
    canVote: ownerId == null || ownerId !== me.id,
  };
}

export const getReputation = createServerFn({ method: "GET" })
  .validator(parentSchema)
  .handler(async ({ data }): Promise<Reputation> => {
    const me = await requireMember();
    const { ownerId } = await assertParent(me, data.kind, data.parent);
    return reputationOf(me, data.kind, data.parent, ownerId);
  });

/** value 1 = vote up, -1 = vote down, 0 = take my vote back. */
export const castVote = createServerFn({ method: "POST" })
  .validator(parentSchema.extend({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) }))
  .handler(async ({ data }): Promise<Reputation> => {
    const me = await requireMember();
    const { ownerId } = await assertParent(me, data.kind, data.parent);
    if (ownerId != null && ownerId === me.id) throw new Error("নিজের লেখায় ভোট দেওয়া যায় না");
    const sql = await getSql();

    const recent = await sql<{ n: number }>`
      select count(*)::int as n from content_votes where member_id = ${me.id} and updated_at > now() - interval '1 minute'
    `;
    if ((recent[0]?.n ?? 0) >= 30) throw new Error(TOO_FAST);

    if (data.value === 0) {
      await sql`delete from content_votes where member_id = ${me.id} and kind = ${data.kind} and parent = ${data.parent}`;
    } else {
      await sql`
        insert into content_votes (member_id, kind, parent, value)
        values (${me.id}, ${data.kind}, ${data.parent}, ${data.value})
        on conflict (member_id, kind, parent) do update set value = excluded.value, updated_at = now()
      `;
    }
    return reputationOf(me, data.kind, data.parent, ownerId);
  });
