import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireMember } from "@/lib/members-core";

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
};
export type ThreadResult = { messages: ChatMessage[]; latestIds: number[] };

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
};

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
  };
}

/* ------------------------------------------------------------------ profiles */

export const getProfile = createServerFn({ method: "GET" })
  .validator(z.object({ username: z.string().min(1).max(40).transform((s) => s.trim().toLowerCase()) }))
  .handler(async ({ data }): Promise<Profile | null> => {
    const me = await requireMember();
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
      where username = ${data.username}
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
    await sql`
      delete from chat_images i
      where i.created_at < now() - interval '1 hour'
        and not exists (select 1 from chat_messages c where c.image_id = i.id)
        and not exists (select 1 from members m where m.avatar_id = i.id)
    `;

    const rows = await sql<{ id: number }>`
      insert into chat_images (owner_id, mime, data, bytes)
      values (${me.id}, 'image/jpeg', ${bytes.toString("base64")}, ${bytes.length})
      returning id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("ছবি সংরক্ষণ হয়নি");
    return { id, url: `/api/chat-image/${id}` };
  });

async function dropAvatarImage(id: number, ownerId: number) {
  const sql = await getSql();
  await sql`
    delete from chat_images i
    where i.id = ${id} and i.owner_id = ${ownerId}
      and not exists (select 1 from chat_messages c where c.image_id = i.id)
      and not exists (select 1 from members m where m.avatar_id = i.id)
  `;
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
    }),
  )
  .handler(async ({ data }): Promise<ThreadResult> => {
    const me = await requireMember();
    const sql = await getSql();
    const { peerId, afterId } = data;

    if (peerId != null) {
      if (peerId === me.id) throw new Error("নিজেকে বার্তা পাঠানো যায় না");
      const peer = await sql<{ id: number }>`select id from members where id = ${peerId} limit 1`;
      if (!peer[0]) throw new Error("সদস্য পাওয়া যায়নি");
    }

    const rows =
      afterId > 0
        ? await sql<MsgRow>`
            select c.id, c.sender_id, c.recipient_id, c.body, c.image_id,
              to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
              s.username, s.display_name, s.avatar_id
            from chat_messages c
            join members s on s.id = c.sender_id
            where (
              (${peerId}::int is null and c.recipient_id is null)
              or (${peerId}::int is not null and (
                (c.sender_id = ${me.id} and c.recipient_id = ${peerId})
                or (c.sender_id = ${peerId} and c.recipient_id = ${me.id})
              ))
            ) and c.id > ${afterId}
            order by c.id asc
            limit 200
          `
        : (
            await sql<MsgRow>`
              select c.id, c.sender_id, c.recipient_id, c.body, c.image_id,
                to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                s.username, s.display_name, s.avatar_id
              from chat_messages c
              join members s on s.id = c.sender_id
              where (
                (${peerId}::int is null and c.recipient_id is null)
                or (${peerId}::int is not null and (
                  (c.sender_id = ${me.id} and c.recipient_id = ${peerId})
                  or (c.sender_id = ${peerId} and c.recipient_id = ${me.id})
                ))
              )
              order by c.id desc
              limit 100
            `
          ).reverse();

    const latest = await sql<{ id: number }>`
      select c.id from chat_messages c
      where (
        (${peerId}::int is null and c.recipient_id is null)
        or (${peerId}::int is not null and (
          (c.sender_id = ${me.id} and c.recipient_id = ${peerId})
          or (c.sender_id = ${peerId} and c.recipient_id = ${me.id})
        ))
      )
      order by c.id desc
      limit 100
    `;

    if (peerId != null) {
      await sql`
        insert into chat_reads (member_id, peer_id, last_read_id)
        select ${me.id}, ${peerId}, coalesce(max(c.id), 0)
        from chat_messages c
        where c.sender_id = ${peerId} and c.recipient_id = ${me.id}
        on conflict (member_id, peer_id) do update
          set last_read_id = greatest(chat_reads.last_read_id, excluded.last_read_id)
      `;
    }

    return { messages: rows.map(toMessage), latestIds: latest.map((r) => r.id) };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      peerId: z.number().int().positive().nullable(),
      body: z.string().max(2000, "বার্তা অনেক বড়"),
      imageId: z.number().int().positive().nullable(),
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

    const rows = await sql<{ id: number }>`
      insert into chat_messages (sender_id, recipient_id, body, image_id)
      values (${me.id}, ${data.peerId}, ${body}, ${data.imageId})
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
      await sql`
        delete from chat_images i
        where i.id = ${msg.image_id}
          and not exists (select 1 from chat_messages c where c.image_id = i.id)
          and not exists (select 1 from members m where m.avatar_id = i.id)
      `;
    }
    return { ok: true };
  });
