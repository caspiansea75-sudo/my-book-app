import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { hiddenSet, requireMember, requireViewer } from "@/lib/members-core";
import { mediaSrc } from "@/lib/media-url";
import { ALL_REACTIONS, REPORT_REASONS } from "@/lib/chat-emoji";

/** Profiles, direct messages, the group chat and private chat pictures. Members only. */

const MAX_CHAT_BYTES = 900 * 1024;
const MAX_AVATAR_BYTES = 200 * 1024;
const TOO_FAST = "একটু ধীরে — কিছুক্ষণ পরে আবার চেষ্টা করুন";

const imageUrl = (id: number | null | undefined) => (id ? `/api/chat-image/${id}` : null);

export type Person = { id: number; username: string; displayName: string; avatarUrl: string | null };
export type Profile = Person & {
  bio: string;
  role: "admin" | "member";
  joined: string;
  isMe: boolean;
};
export type Conversation = Person & { unread: number; hasChat: boolean };
export type ReplyPreview = { id: number; senderName: string; body: string; hasImage: boolean; deleted: boolean };
export type Reaction = { emoji: string; count: number; mine: boolean };
export type MessageState = { reactions: Reaction[]; reports: number };
export type ChatMessage = {
  id: number;
  senderId: number;
  senderName: string;
  senderUsername: string;
  senderAvatarUrl: string | null;
  isGroup: boolean;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  replyTo: ReplyPreview | null;
  forwarded: boolean;
};
export type ThreadResult = {
  messages: ChatMessage[];
  latestIds: number[];
  /** Reactions (and, for the admin, report counts) for every message still on screen. */
  states: Record<number, MessageState>;
  pins: ChatMessage[];
  /** How far each other member has read here (group: any message id; private: my own message id). */
  seen: { memberId: number; lastReadId: number }[];
};

type MsgRow = {
  id: number;
  sender_id: number;
  recipient_id: number | null;
  body: string;
  image_id: number | null;
  created_at: string;
  username: string;
  display_name: string;
  avatar_id: number | null;
  reply_to_id: number | null;
  forwarded: boolean;
  reply_id: number | null;
  reply_body: string | null;
  reply_image_id: number | null;
  reply_sender: string | null;
};

const MSG_SELECT = `
  select c.id, c.sender_id, c.recipient_id, c.body, c.image_id, c.reply_to_id, c.forwarded,
    to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
    s.username, s.display_name, s.avatar_id,
    r.id as reply_id, r.body as reply_body, r.image_id as reply_image_id, rs.display_name as reply_sender
  from chat_messages c
  join members s on s.id = c.sender_id
  left join chat_messages r on r.id = c.reply_to_id
  left join members rs on rs.id = r.sender_id`;

/** $1 = me, $2 = peer id (null = group chat). */
const THREAD_WHERE = `(
  ($2::int is null and c.recipient_id is null)
  or ($2::int is not null and (
    (c.sender_id = $1 and c.recipient_id = $2) or (c.sender_id = $2 and c.recipient_id = $1)
  ))
)`;

function toMessage(r: MsgRow): ChatMessage {
  return {
    id: r.id,
    senderId: r.sender_id,
    senderName: r.display_name,
    senderUsername: r.username,
    senderAvatarUrl: imageUrl(r.avatar_id),
    isGroup: r.recipient_id == null,
    body: r.body,
    imageUrl: imageUrl(r.image_id),
    createdAt: r.created_at,
    forwarded: r.forwarded,
    replyTo:
      r.reply_to_id == null
        ? null
        : {
            id: r.reply_to_id,
            senderName: r.reply_sender ?? "",
            body: (r.reply_body ?? "").slice(0, 160),
            hasImage: r.reply_image_id != null,
            deleted: r.reply_id == null,
          },
  };
}

/* ------------------------------------------------------------------ profiles */

export const getProfile = createServerFn({ method: "GET" })
  .validator(z.object({ username: z.string().min(1).max(40).transform((s) => s.trim().toLowerCase()) }))
  .handler(async ({ data }): Promise<Profile | null> => {
    const me = await requireViewer();
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      username: string;
      display_name: string;
      bio: string;
      role: string;
      avatar_id: number | null;
      joined: string;
    }>`
      select id, username, display_name, bio, role, avatar_id,
        to_char(created_at, 'YYYY-MM-DD') as joined
      from members
      where username = ${data.username} and role <> 'guest'
      limit 1
    `;
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: imageUrl(r.avatar_id),
      bio: r.bio,
      role: r.role === "admin" ? "admin" : "member",
      joined: r.joined,
      isMe: r.id === me.id,
    };
  });

/* ------------------------------------------------------------ creator stats */

export type CreatorWork = {
  kind: "story" | "manga";
  slug: string;
  title: string;
  coverUrl: string | null;
  chapters: number;
  views: number;
  likes: number;
  comments: number;
  up: number;
  down: number;
};
export type CreatorStats = {
  works: CreatorWork[];
  totals: { works: number; views: number; likes: number; comments: number; up: number; down: number };
};

type Counts = { views: number; likes: number; comments: number; up: number; down: number };

/** Views, likes, comments and up/down votes for each story or series, added up over all of its chapters. */
async function countsFor(sql: Sql, kind: "story" | "manga", slugs: string[]): Promise<Map<string, Counts>> {
  const out = new Map<string, Counts>();
  if (slugs.length === 0) return out;
  const slot = (parent: string): Counts => {
    let c = out.get(parent);
    if (!c) {
      c = { views: 0, likes: 0, comments: 0, up: 0, down: 0 };
      out.set(parent, c);
    }
    return c;
  };
  const per = async (table: string, field: "views" | "likes" | "comments") => {
    const rows = await sql.query<{ parent: string; n: number }>(
      `select split_part(target, ':', 1) as parent, count(*)::int as n from ${table}
       where kind = $1 and split_part(target, ':', 1) = any($2::text[]) group by 1`,
      [kind, slugs],
    );
    for (const r of rows) slot(r.parent)[field] = Number(r.n);
  };
  await per("content_views", "views");
  await per("content_likes", "likes");
  await per("content_comments", "comments");
  const votes = await sql.query<{ parent: string; up: number; down: number }>(
    `select parent, (count(*) filter (where value = 1))::int as up, (count(*) filter (where value = -1))::int as down
     from content_votes where kind = $1 and parent = any($2::text[]) group by parent`,
    [kind, slugs],
  );
  for (const r of votes) {
    const c = slot(r.parent);
    c.up = Number(r.up);
    c.down = Number(r.down);
  }
  return out;
}

/**
 * The stories and manga a member made, with how each one is doing: views, likes, comments and votes.
 * These numbers are already shown on the library cards, so any signed-in visitor may see them.
 * Hidden items (for non-admins) and books that are still all drafts (for everyone but the author and admin) are left out.
 */
export const getCreatorStats = createServerFn({ method: "GET" })
  .validator(z.object({ username: z.string().min(1).max(40).transform((s) => s.trim().toLowerCase()) }))
  .handler(async ({ data }): Promise<CreatorStats> => {
    const me = await requireViewer();
    const sql = await getSql();
    const empty: CreatorStats = { works: [], totals: { works: 0, views: 0, likes: 0, comments: 0, up: 0, down: 0 } };
    const owner = await sql<{ id: number }>`
      select id from members where username = ${data.username} and role <> 'guest' limit 1
    `;
    const ownerId = owner[0]?.id;
    if (!ownerId) return empty;
    const admin = me.role === "admin";
    const mine = admin || me.id === ownerId;

    const books = await sql<{ id: number; slug: string; title: string; cover_media_id: number | null; pub: number; total: number }>`
      select b.id, b.slug, b.title, b.cover_media_id,
        (select count(*)::int from library_chapters c where c.book_id = b.id and c.deleted_at is null and c.status = 'published') as pub,
        (select count(*)::int from library_chapters c where c.book_id = b.id and c.deleted_at is null) as total
      from library_books b
      where b.owner_id = ${ownerId} and b.deleted_at is null and b.extends_slug is null
      order by b.created_at desc
    `;
    const series = await sql<{ slug: string; title: string; cover_media_id: number | null; chapters: number }>`
      select s.slug, s.title, s.cover_media_id,
        (select count(*)::int from manga_chapters c where c.series_id = s.id) as chapters
      from manga_series s
      where s.owner_id = ${ownerId}
      order by s.created_at desc
    `;

    const hiddenBooks = admin ? new Set<string>() : await hiddenSet("book");
    const hiddenManga = admin ? new Set<string>() : await hiddenSet("manga");
    const shownBooks = books.filter((b) => !hiddenBooks.has(b.slug) && (mine || b.total === 0 || b.pub > 0));
    const shownSeries = series.filter((s) => !hiddenManga.has(s.slug));

    const storyCounts = await countsFor(sql, "story", shownBooks.map((b) => b.slug));
    const mangaCounts = await countsFor(sql, "manga", shownSeries.map((s) => s.slug));
    const zero: Counts = { views: 0, likes: 0, comments: 0, up: 0, down: 0 };

    const works: CreatorWork[] = [
      ...shownBooks.map((b) => ({
        kind: "story" as const,
        slug: b.slug,
        title: b.title,
        coverUrl: b.cover_media_id ? mediaSrc(b.cover_media_id) : null,
        chapters: Number(mine ? b.total : b.pub),
        ...(storyCounts.get(b.slug) ?? zero),
      })),
      ...shownSeries.map((s) => ({
        kind: "manga" as const,
        slug: s.slug,
        title: s.title,
        coverUrl: s.cover_media_id ? mediaSrc(s.cover_media_id) : null,
        chapters: Number(s.chapters),
        ...(mangaCounts.get(s.slug) ?? zero),
      })),
    ];
    // The ones people react to most come first.
    works.sort((a, b) => b.views + b.likes + b.comments - (a.views + a.likes + a.comments));

    const totals = works.reduce(
      (t, w) => ({
        works: t.works + 1,
        views: t.views + w.views,
        likes: t.likes + w.likes,
        comments: t.comments + w.comments,
        up: t.up + w.up,
        down: t.down + w.down,
      }),
      empty.totals,
    );
    return { works, totals };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      displayName: z
        .string()
        .transform((s) => s.trim())
        .pipe(z.string().min(1, "নাম লিখুন").max(40, "নাম ৪০ অক্ষরের মধ্যে রাখুন")),
      bio: z
        .string()
        .max(300, "পরিচয় ৩০০ অক্ষরের মধ্যে রাখুন")
        .transform((s) => s.trim()),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    await sql`update members set display_name = ${data.displayName}, bio = ${data.bio} where id = ${me.id}`;
    return { ok: true };
  });

/* -------------------------------------------------------------------- images */

/** Remove files from Vercel Blob for chat_images rows that were just deleted. */
async function purgeImageFiles(rows: { url: string | null }[]) {
  if (!rows.length) return;
  const { deleteMediaFile } = await import("@/lib/blob-store.server");
  await Promise.all(rows.map((r) => deleteMediaFile(r.url)));
}

export const uploadChatImage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      base64: z.string().min(200).max(1_300_000),
      purpose: z.enum(["chat", "avatar"]),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    const bytes = Buffer.from(data.base64, "base64");
    const limit = data.purpose === "avatar" ? MAX_AVATAR_BYTES : MAX_CHAT_BYTES;
    if (bytes.length < 100 || bytes.length > limit) throw new Error("ছবিটি অনেক বড়");
    // The browser always sends a JPEG; refuse anything else.
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) throw new Error("ছবিটি সঠিক নয়");

    const sql = await getSql();
    const recent = await sql<{ n: number }>`
      select count(*)::int as n from chat_images
      where owner_id = ${me.id} and created_at > now() - interval '1 minute'
    `;
    if ((recent[0]?.n ?? 0) >= 10) throw new Error(TOO_FAST);

    // Tidy up pictures that were uploaded but never sent or used.
    const stale = await sql<{ url: string | null }>`
      delete from chat_images i
      where i.created_at < now() - interval '1 hour'
        and not exists (select 1 from chat_messages c where c.image_id = i.id)
        and not exists (select 1 from members m where m.avatar_id = i.id)
      returning i.url
    `;
    await purgeImageFiles(stale);

    // Picture -> Vercel Blob (link saved in Neon). If Blob is off or fails, keep it in Neon.
    const b64 = bytes.toString("base64");
    const { putMedia } = await import("@/lib/blob-store.server");
    const blobUrl = await putMedia(b64, "image/jpeg");
    const rows = await sql<{ id: number }>`
      insert into chat_images (owner_id, mime, data, url, bytes)
      values (${me.id}, 'image/jpeg', ${blobUrl ? null : b64}, ${blobUrl}, ${bytes.length})
      returning id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("ছবি সংরক্ষণ হয়নি");
    return { id, url: `/api/chat-image/${id}` };
  });

async function dropAvatarImage(id: number, ownerId: number) {
  const sql = await getSql();
  const gone = await sql<{ url: string | null }>`
    delete from chat_images i
    where i.id = ${id} and i.owner_id = ${ownerId}
      and not exists (select 1 from chat_messages c where c.image_id = i.id)
      and not exists (select 1 from members m where m.avatar_id = i.id)
    returning i.url
  `;
  await purgeImageFiles(gone);
}

export const setAvatar = createServerFn({ method: "POST" })
  .validator(z.object({ imageId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    const own = await sql<{ id: number }>`
      select id from chat_images where id = ${data.imageId} and owner_id = ${me.id} limit 1
    `;
    if (!own[0]) throw new Error("ছবি পাওয়া যায়নি");
    const before = await sql<{ avatar_id: number | null }>`select avatar_id from members where id = ${me.id}`;
    await sql`update members set avatar_id = ${data.imageId} where id = ${me.id}`;
    const old = before[0]?.avatar_id;
    if (old && old !== data.imageId) await dropAvatarImage(old, me.id);
    return { url: `/api/chat-image/${data.imageId}` };
  });

export const removeAvatar = createServerFn({ method: "POST" }).handler(async () => {
  const me = await requireMember();
  const sql = await getSql();
  const before = await sql<{ avatar_id: number | null }>`select avatar_id from members where id = ${me.id}`;
  await sql`update members set avatar_id = null where id = ${me.id}`;
  const old = before[0]?.avatar_id;
  if (old) await dropAvatarImage(old, me.id);
  return { ok: true };
});

/* --------------------------------------------------------------------- chat */

export type InboxItem = {
  id: number;
  senderId: number;
  senderName: string;
  senderUsername: string;
  senderAvatarUrl: string | null;
  isGroup: boolean;
  body: string;
  hasImage: boolean;
};

/**
 * Lightweight check used by the site-wide "new message" pop-up.
 * afterId 0 only returns the newest message id (so old messages never pop up).
 * Otherwise returns up to 5 messages from other people, newer than afterId, sent in the
 * group chat or straight to me in the last few minutes.
 */
export const pollInbox = createServerFn({ method: "POST" })
  .validator(z.object({ afterId: z.number().int().min(0) }))
  .handler(async ({ data }): Promise<{ latestId: number; items: InboxItem[] }> => {
    const me = await requireMember();
    const sql = await getSql();
    const top = await sql<{ id: number | null }>`select max(id) as id from chat_messages`;
    const latestId = Number(top[0]?.id ?? 0);
    if (data.afterId <= 0 || latestId <= data.afterId) return { latestId, items: [] };
    const rows = await sql.query<MsgRow>(
      `${MSG_SELECT}
       where c.id > $2 and c.sender_id <> $1 and (c.recipient_id is null or c.recipient_id = $1)
         and c.created_at > now() - interval '3 minutes'
       order by c.id desc limit 5`,
      [me.id, data.afterId],
    );
    return {
      latestId,
      items: rows.reverse().map((r) => ({
        id: r.id,
        senderId: r.sender_id,
        senderName: r.display_name,
        senderUsername: r.username,
        senderAvatarUrl: imageUrl(r.avatar_id),
        isGroup: r.recipient_id == null,
        body: r.body.slice(0, 600),
        hasImage: r.image_id != null,
      })),
    };
  });

/** Everyone else, with unread counts, most recent conversations first. */
export const listConversations = createServerFn({ method: "GET" }).handler(async (): Promise<Conversation[]> => {
  const me = await requireMember();
  const sql = await getSql();
  const rows = await sql<{
    id: number;
    username: string;
    display_name: string;
    avatar_id: number | null;
    unread: number | string;
    last_id: number | null;
  }>`
    select m.id, m.username, m.display_name, m.avatar_id,
      (select count(*) from chat_messages c
        where c.sender_id = m.id and c.recipient_id = ${me.id}
          and c.id > coalesce(r.last_read_id, 0)) as unread,
      (select max(c.id) from chat_messages c
        where (c.sender_id = m.id and c.recipient_id = ${me.id})
           or (c.sender_id = ${me.id} and c.recipient_id = m.id)) as last_id
    from members m
    left join chat_reads r on r.member_id = ${me.id} and r.peer_id = m.id
    where m.id <> ${me.id}
    order by last_id desc nulls last, lower(m.display_name), m.id
  `;
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: imageUrl(r.avatar_id),
    unread: Number(r.unread),
    hasChat: r.last_id != null,
  }));
});

/**
 * peerId null = the group chat, otherwise a direct conversation.
 * afterId 0 loads the latest 100 messages; a larger afterId loads only newer ones.
 * `latestIds` lets the browser drop messages that were deleted meanwhile.
 * (POST because opening a direct conversation also marks it as read.)
 */
export const loadThread = createServerFn({ method: "POST" })
  .validator(
    z.object({
      peerId: z.number().int().positive().nullable(),
      afterId: z.number().int().min(0),
      /** false = just looking in the background (a minimised window), so don't count it as read. */
      markSeen: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }): Promise<ThreadResult> => {
    const me = await requireMember();
    const sql = await getSql();
    const { peerId, afterId } = data;
    const counts = data.markSeen !== false;

    if (peerId != null) {
      if (peerId === me.id) throw new Error("নিজেকে বার্তা পাঠানো যায় না");
      const peer = await sql<{ id: number }>`select id from members where id = ${peerId} limit 1`;
      if (!peer[0]) throw new Error("সদস্য পাওয়া যায়নি");
    }

    const rows =
      afterId > 0
        ? await sql.query<MsgRow>(
            `${MSG_SELECT} where ${THREAD_WHERE} and c.id > $3 order by c.id asc limit 200`,
            [me.id, peerId, afterId],
          )
        : (
            await sql.query<MsgRow>(`${MSG_SELECT} where ${THREAD_WHERE} order by c.id desc limit 100`, [
              me.id,
              peerId,
            ])
          ).reverse();

    const latest = await sql.query<{ id: number }>(
      `select c.id from chat_messages c where ${THREAD_WHERE} order by c.id desc limit 100`,
      [me.id, peerId],
    );
    const oldest = latest.length ? Math.min(...latest.map((r) => r.id)) : 0;

    const pins = await sql.query<MsgRow>(
      `${MSG_SELECT} where ${THREAD_WHERE} and c.pinned_at is not null order by c.pinned_at desc limit 20`,
      [me.id, peerId],
    );

    const states: Record<number, MessageState> = {};
    const reactionRows = await sql.query<{ message_id: number; emoji: string; n: number; mine: boolean }>(
      `select x.message_id, x.emoji, count(*)::int as n, bool_or(x.member_id = $1) as mine
       from chat_reactions x
       join chat_messages c on c.id = x.message_id
       where ${THREAD_WHERE} and (c.id >= $3 or c.pinned_at is not null)
       group by x.message_id, x.emoji
       order by min(x.created_at)`,
      [me.id, peerId, oldest],
    );
    for (const r of reactionRows) {
      (states[r.message_id] ??= { reactions: [], reports: 0 }).reactions.push({
        emoji: r.emoji,
        count: r.n,
        mine: r.mine,
      });
    }
    if (me.role === "admin") {
      const reportRows = await sql.query<{ message_id: number; n: number }>(
        `select p.message_id, count(*)::int as n
         from chat_reports p
         join chat_messages c on c.id = p.message_id
         where ${THREAD_WHERE} and (c.id >= $3 or c.pinned_at is not null)
         group by p.message_id`,
        [me.id, peerId, oldest],
      );
      for (const r of reportRows) (states[r.message_id] ??= { reactions: [], reports: 0 }).reports = r.n;
    }

    if (counts) {
      if (peerId != null) {
        await sql`
          insert into chat_reads (member_id, peer_id, last_read_id)
          select ${me.id}, ${peerId}, coalesce(max(c.id), 0)
          from chat_messages c
          where c.sender_id = ${peerId} and c.recipient_id = ${me.id}
          on conflict (member_id, peer_id) do update
            set last_read_id = greatest(chat_reads.last_read_id, excluded.last_read_id)
        `;
      } else {
        // Group chat: remember the newest message I have now seen (only writes when it moved).
        await sql`
          insert into chat_group_reads (member_id, last_read_id)
          select ${me.id}, coalesce(max(c.id), 0) from chat_messages c where c.recipient_id is null
          on conflict (member_id) do update
            set last_read_id = excluded.last_read_id, updated_at = now()
            where chat_group_reads.last_read_id < excluded.last_read_id
        `;
      }
    }

    // Who has seen what. Private chat: how far the other person has read MY messages.
    const seenRows =
      peerId != null
        ? await sql<{ member_id: number; last_read_id: number }>`
            select member_id, last_read_id from chat_reads where member_id = ${peerId} and peer_id = ${me.id}
          `
        : await sql<{ member_id: number; last_read_id: number }>`
            select member_id, last_read_id from chat_group_reads where member_id <> ${me.id} and last_read_id > 0
          `;
    const seen = seenRows.map((r) => ({ memberId: Number(r.member_id), lastReadId: Number(r.last_read_id) }));

    return { messages: rows.map(toMessage), latestIds: latest.map((r) => r.id), states, pins: pins.map(toMessage), seen };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      peerId: z.number().int().positive().nullable(),
      body: z.string().max(2000, "বার্তা অনেক বড়"),
      imageId: z.number().int().positive().nullable(),
      replyToId: z.number().int().positive().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    const body = data.body.trim();
    if (!body && !data.imageId) throw new Error("কিছু লিখুন বা ছবি দিন");
    const sql = await getSql();

    const recent = await sql<{ n: number }>`
      select count(*)::int as n from chat_messages
      where sender_id = ${me.id} and created_at > now() - interval '1 minute'
    `;
    if ((recent[0]?.n ?? 0) >= 20) throw new Error(TOO_FAST);

    if (data.peerId != null) {
      if (data.peerId === me.id) throw new Error("নিজেকে বার্তা পাঠানো যায় না");
      const peer = await sql<{ id: number }>`select id from members where id = ${data.peerId} limit 1`;
      if (!peer[0]) throw new Error("সদস্য পাওয়া যায়নি");
    }
    if (data.imageId != null) {
      const own = await sql<{ id: number }>`
        select id from chat_images where id = ${data.imageId} and owner_id = ${me.id} limit 1
      `;
      if (!own[0]) throw new Error("ছবি পাওয়া যায়নি");
    }

    let replyToId: number | null = null;
    if (data.replyToId != null) {
      const target = await sql.query<{ id: number }>(
        `select c.id from chat_messages c where c.id = $3 and ${THREAD_WHERE} limit 1`,
        [me.id, data.peerId, data.replyToId],
      );
      // If the original vanished meanwhile, just send it as a normal message.
      replyToId = target[0] ? data.replyToId : null;
    }

    const rows = await sql<{ id: number }>`
      insert into chat_messages (sender_id, recipient_id, body, image_id, reply_to_id)
      values (${me.id}, ${data.peerId}, ${body}, ${data.imageId}, ${replyToId})
      returning id
    `;
    return { id: rows[0]?.id ?? 0 };
  });

/** Anyone can delete their own message; the admin can also clear the group chat. */
export const deleteMessage = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const sql = await getSql();
    const rows = await sql<{ sender_id: number; recipient_id: number | null; image_id: number | null }>`
      select sender_id, recipient_id, image_id from chat_messages where id = ${data.id} limit 1
    `;
    const msg = rows[0];
    if (!msg) return { ok: true };
    const mine = msg.sender_id === me.id;
    const adminInGroup = me.role === "admin" && msg.recipient_id == null;
    if (!mine && !adminInGroup) throw new Error("এই বার্তা মোছার অনুমতি নেই");
    await sql`delete from chat_messages where id = ${data.id}`;
    if (msg.image_id) {
      const gone = await sql<{ url: string | null }>`
        delete from chat_images i
        where i.id = ${msg.image_id}
          and not exists (select 1 from chat_messages c where c.image_id = i.id)
          and not exists (select 1 from members m where m.avatar_id = i.id)
        returning i.url
      `;
      await purgeImageFiles(gone);
    }
    return { ok: true };
  });

/* ------------------------------------------------------------ message actions */

type Visible = {
  id: number;
  sender_id: number;
  recipient_id: number | null;
  body: string;
  image_id: number | null;
  pinned_at: string | null;
};

/** The message, but only if this member is allowed to see it. */
async function visibleMessage(memberId: number, id: number): Promise<Visible> {
  const sql = await getSql();
  const rows = await sql<Visible>`
    select id, sender_id, recipient_id, body, image_id, pinned_at
    from chat_messages
    where id = ${id} and (recipient_id is null or sender_id = ${memberId} or recipient_id = ${memberId})
    limit 1
  `;
  if (!rows[0]) throw new Error("বার্তা পাওয়া যায়নি");
  return rows[0];
}

/** Tap an emoji to react; tap the same one again to take it back; a different one replaces it. */
export const toggleReaction = createServerFn({ method: "POST" })
  .validator(z.object({ messageId: z.number().int().positive(), emoji: z.string().max(16) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    if (!ALL_REACTIONS.includes(data.emoji)) throw new Error("এই ইমোজি ব্যবহার করা যায় না");
    await visibleMessage(me.id, data.messageId);
    const sql = await getSql();
    const cur = await sql<{ emoji: string }>`
      select emoji from chat_reactions where message_id = ${data.messageId} and member_id = ${me.id}
    `;
    if (cur[0]?.emoji === data.emoji) {
      await sql`delete from chat_reactions where message_id = ${data.messageId} and member_id = ${me.id}`;
      return { emoji: null as string | null };
    }
    await sql`
      insert into chat_reactions (message_id, member_id, emoji)
      values (${data.messageId}, ${me.id}, ${data.emoji})
      on conflict (message_id, member_id) do update set emoji = excluded.emoji, created_at = now()
    `;
    return { emoji: data.emoji as string | null };
  });

/** Pin or unpin. Everyone in the conversation can pin; the pin is shared. */
export const togglePin = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const msg = await visibleMessage(me.id, data.id);
    const sql = await getSql();
    if (msg.pinned_at) {
      await sql`update chat_messages set pinned_at = null, pinned_by = null where id = ${data.id}`;
      return { pinned: false };
    }
    await sql`update chat_messages set pinned_at = now(), pinned_by = ${me.id} where id = ${data.id}`;
    return { pinned: true };
  });

export const reportMessage = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), reason: z.enum(REPORT_REASONS) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const msg = await visibleMessage(me.id, data.id);
    if (msg.sender_id === me.id) throw new Error("নিজের বার্তা রিপোর্ট করা যায় না");
    const sql = await getSql();
    await sql`
      insert into chat_reports (message_id, reporter_id, reason)
      values (${data.id}, ${me.id}, ${data.reason})
      on conflict (message_id, reporter_id) do nothing
    `;
    return { ok: true };
  });

/** Copy a message (text and picture) into another conversation, marked as forwarded. */
export const forwardMessage = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), peerId: z.number().int().positive().nullable() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    const msg = await visibleMessage(me.id, data.id);
    const sql = await getSql();

    const recent = await sql<{ n: number }>`
      select count(*)::int as n from chat_messages
      where sender_id = ${me.id} and created_at > now() - interval '1 minute'
    `;
    if ((recent[0]?.n ?? 0) >= 20) throw new Error(TOO_FAST);

    if (data.peerId != null) {
      if (data.peerId === me.id) throw new Error("নিজেকে বার্তা পাঠানো যায় না");
      const peer = await sql<{ id: number }>`select id from members where id = ${data.peerId} limit 1`;
      if (!peer[0]) throw new Error("সদস্য পাওয়া যায়নি");
    }

    const rows = await sql<{ id: number }>`
      insert into chat_messages (sender_id, recipient_id, body, image_id, forwarded)
      values (${me.id}, ${data.peerId}, ${msg.body}, ${msg.image_id}, true)
      returning id
    `;
    return { id: rows[0]?.id ?? 0 };
  });
