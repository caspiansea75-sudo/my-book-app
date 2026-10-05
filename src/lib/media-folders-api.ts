import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { assertFolderAccess, assertMediaAccess, hiddenSet, requireMember } from "@/lib/members-core";
import { getCanonBook } from "@/lib/book";
import { mediaSrc, mediaThumbSrc } from "@/lib/media-url";

export type VaultFolder = {
  id: number;
  parentId: number | null;
  name: string;
  createdAt: string;
  itemCount: number;
  ownerId: number | null;
  /** The owner switched the lock on for this folder itself. */
  locked: boolean;
  /** Locked only because a folder above it is locked. */
  lockedViaParent: boolean;
};

export type VaultItem = {
  hidden?: boolean;
  id: number;
  kind: "image" | "video";
  title: string;
  mime: string;
  source: "upload" | "url";
  url: string | null;
  src: string;
  thumbSrc: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  createdAt: string;
  folderId: number | null;
  /** In how many distinct places (manga, stories, covers) this file is used. */
  usageCount: number;
  ownerId: number | null;
  /** The owner switched the lock on for this file itself. */
  locked: boolean;
  /** Locked only because the folder it sits in (or one above it) is locked. */
  lockedViaFolder: boolean;
};

export type MediaUsage = {
  kind: "manga" | "story" | "cover";
  /** Human-readable place, e.g. "Series › Chapter". */
  label: string;
};

export type Vault = { folders: VaultFolder[]; items: VaultItem[] };

type ItemRow = {
  id: number;
  kind: "image" | "video";
  title: string;
  mime: string;
  source: "upload" | "url";
  url: string | null;
  thumb_url: string | null;
  has_thumb: boolean;
  width: number | null;
  height: number | null;
  bytes: number;
  created_at: string | Date;
  folder_id: number | null;
  owner_id: number | null;
  locked: boolean;
};

type FolderRow = {
  id: number;
  parent_id: number | null;
  name: string;
  created_at: string | Date;
  item_count: number;
  owner_id: number | null;
  locked: boolean;
};

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

function asItem(row: ItemRow, usageCount: number, lockedViaFolder: boolean): VaultItem {
  const uploaded = row.source === "upload";
  const thumbSrc = row.thumb_url
    ? row.thumb_url
    : row.has_thumb
      ? mediaThumbSrc(row.id)
      : uploaded
        ? mediaThumbSrc(row.id)
        : (row.url ?? null);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    mime: row.mime,
    source: row.source,
    url: row.url,
    src: uploaded ? mediaSrc(row.id) : (row.url ?? mediaSrc(row.id)),
    thumbSrc,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    createdAt: iso(row.created_at),
    folderId: row.folder_id,
    usageCount,
    ownerId: row.owner_id,
    locked: Boolean(row.locked),
    lockedViaFolder,
  };
}

function chapterTitle(bookSlug: string, chapterSlug: string): string {
  const chapter = getCanonBook(bookSlug)?.chapters.find((c) => c.slug === chapterSlug);
  return chapter?.title || `অধ্যায় ${chapterSlug}`;
}

/**
 * Every place an image is used, keyed by media id. Read-only.
 *
 * Deleting a media row cascades through manga panels, book covers and chapter
 * inserts automatically — but images placed in stories made in the studio are
 * stored as plain ids inside the chapter text (no database link), so those
 * would silently become broken pictures. This looks in all of them.
 */
async function collectUsage(sql: Sql): Promise<Map<number, MediaUsage[]>> {
  const out = new Map<number, Map<string, MediaUsage>>();
  const add = (mediaId: number | null, kind: MediaUsage["kind"], label: string) => {
    if (mediaId == null) return;
    const bucket = out.get(mediaId) ?? new Map<string, MediaUsage>();
    bucket.set(`${kind}:${label}`, { kind, label });
    out.set(mediaId, bucket);
  };

  const panels = await sql<{ media_id: number; series: string; chapter: string }>`
    select p.media_id, s.title as series, c.title as chapter
    from manga_panels p
    join manga_chapters c on c.id = p.chapter_id
    join manga_series s on s.id = c.series_id
  `;
  for (const r of panels) add(r.media_id, "manga", `মাঙ্গা: ${r.series} › ${r.chapter}`);

  const mangaCovers = await sql<{ cover_media_id: number; title: string }>`
    select cover_media_id, title from manga_series where cover_media_id is not null
  `;
  for (const r of mangaCovers) add(r.cover_media_id, "cover", `মাঙ্গার প্রচ্ছদ: ${r.title}`);

  const bookCoverCol = await sql<{ cover_media_id: number; title: string }>`
    select cover_media_id, title from library_books where cover_media_id is not null
  `;
  for (const r of bookCoverCol) add(r.cover_media_id, "cover", `বইয়ের প্রচ্ছদ: ${r.title}`);

  const studioBookTitles = new Map(
    (await sql<{ slug: string; title: string }>`select slug, title from library_books`).map((b) => [b.slug, b.title]),
  );
  const bookTitle = (slug: string) => getCanonBook(slug)?.title ?? studioBookTitles.get(slug) ?? slug;

  const covers = await sql<{ book_slug: string; media_id: number }>`select book_slug, media_id from book_covers`;
  for (const r of covers) add(r.media_id, "cover", `বইয়ের প্রচ্ছদ: ${bookTitle(r.book_slug)}`);

  const inserts = await sql<{ book_slug: string; chapter_slug: string; media_id: number }>`
    select book_slug, chapter_slug, media_id from chapter_inserts
  `;
  for (const r of inserts) {
    add(r.media_id, "story", `গল্প: ${bookTitle(r.book_slug)} › ${chapterTitle(r.book_slug, r.chapter_slug)}`);
  }

  const inline = await sql<{ media_id: number; book: string; chapter: string }>`
    select (m.v #>> '{}')::int as media_id, b.title as book, c.title as chapter
    from library_chapters c
    join library_books b on b.id = c.book_id
    cross join lateral jsonb_path_query(c.body, '$.sections[*].paragraphs[*].mediaId') as m(v)
    where jsonb_typeof(m.v) = 'number'
  `;
  for (const r of inline) add(r.media_id, "story", `গল্প: ${r.book} › ${r.chapter}`);

  return new Map([...out].map(([id, bucket]) => [id, [...bucket.values()]]));
}

/** Everything the media page needs in one round trip (no heavy blob columns). */
export const loadVault = createServerFn({ method: "GET" }).handler(async (): Promise<Vault> => {
  const me = await requireMember();
  const hid = await hiddenSet("media");
  const sql = await getSql();
  const folderRows = await sql<FolderRow>`
    select f.id, f.parent_id, f.name, f.created_at, f.owner_id, f.locked, 0 as item_count
    from media_folders f
    order by lower(f.name), f.id
  `;
  const itemRows = await sql<ItemRow>`
    select m.id, m.kind, m.title, m.mime, m.source, m.url,
      case when m.thumb like 'http%' then m.thumb else null end as thumb_url,
      (m.thumb is not null) as has_thumb,
      m.width, m.height, m.bytes, m.created_at, i.folder_id, m.owner_id, m.locked
    from media m
    left join media_folder_items i on i.media_id = m.id
    where m.deleted_at is null
    order by m.created_at desc, m.id desc
    limit 2000
  `;
  const usage = await collectUsage(sql);
  const admin = me.role === "admin";

  // A folder is locked if it is switched on itself or sits anywhere below a locked folder.
  const parentOf = new Map(folderRows.map((f) => [f.id, f.parent_id]));
  const selfLocked = new Set(folderRows.filter((f) => f.locked).map((f) => f.id));
  const lockedFolder = (id: number): boolean => {
    const seen = new Set<number>();
    let cur: number | null | undefined = id;
    while (cur != null && !seen.has(cur)) {
      if (selfLocked.has(cur)) return true;
      seen.add(cur);
      cur = parentOf.get(cur);
    }
    return false;
  };
  const folderLockedAbove = (id: number): boolean => {
    const above = parentOf.get(id);
    return above != null && lockedFolder(above);
  };

  // Other members never see what is locked; the owner and the admin always do.
  const shownItems = itemRows.filter((r) => {
    if (!admin && hid.has(String(r.id))) return false;
    if (admin || r.owner_id === me.id) return true;
    return !r.locked && !(r.folder_id != null && lockedFolder(r.folder_id));
  });
  const shownFolders = folderRows.filter((f) => admin || f.owner_id === me.id || !lockedFolder(f.id));

  const counts = new Map<number, number>();
  for (const r of shownItems) if (r.folder_id != null) counts.set(r.folder_id, (counts.get(r.folder_id) ?? 0) + 1);

  return {
    folders: shownFolders.map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      name: r.name,
      createdAt: iso(r.created_at),
      itemCount: counts.get(r.id) ?? 0,
      ownerId: r.owner_id,
      locked: Boolean(r.locked),
      lockedViaParent: !r.locked && folderLockedAbove(r.id),
    })),
    items: shownItems.map((r) => ({
      ...asItem(r, usage.get(r.id)?.length ?? 0, r.folder_id != null && lockedFolder(r.folder_id)),
      hidden: hid.has(String(r.id)),
    })),
  };
});

const folderName = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "নাম লিখুন").max(80, "নাম বেশি বড়"));

export const createFolder = createServerFn({ method: "POST" })
  .validator(z.object({ name: folderName, parentId: z.number().int().positive().nullable() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    if (data.parentId != null) await assertFolderAccess(me, data.parentId);
    const sql = await getSql();
    if (data.parentId != null) {
      const parent = await sql<{ id: number }>`select id from media_folders where id = ${data.parentId}`;
      if (!parent[0]) throw new Error("ফোল্ডারটি পাওয়া যায়নি");
    }
    const rows = await sql<{ id: number }>`
      insert into media_folders (name, parent_id, owner_id) values (${data.name}, ${data.parentId}, ${me.id}) returning id
    `;
    return { id: rows[0].id };
  });

export const renameFolder = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), name: folderName }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertFolderAccess(me, data.id);
    const sql = await getSql();
    await sql`update media_folders set name = ${data.name} where id = ${data.id}`;
    return { ok: true };
  });

/** Move a folder under another folder (or to home). Rejects loops. */
export const moveFolder = createServerFn({ method: "POST" })
  .validator(
    z.object({ id: z.number().int().positive(), parentId: z.number().int().positive().nullable() }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertFolderAccess(me, data.id);
    if (data.parentId != null) await assertFolderAccess(me, data.parentId);
    const sql = await getSql();
    if (data.parentId != null) {
      if (data.parentId === data.id) throw new Error("ফোল্ডারকে নিজের ভেতরে রাখা যায় না");
      // Walk up from the target; if we meet the folder being moved, it would loop.
      const loop = await sql.query<{ id: number }>(
        `with recursive up as (
           select id, parent_id from media_folders where id = $1
           union all
           select f.id, f.parent_id from media_folders f join up on f.id = up.parent_id
         )
         select id from up where id = $2`,
        [data.parentId, data.id],
      );
      if (loop.length > 0) throw new Error("ফোল্ডারকে নিজের ভেতরের ফোল্ডারে রাখা যায় না");
    }
    await sql`update media_folders set parent_id = ${data.parentId} where id = ${data.id}`;
    return { ok: true };
  });

/**
 * Delete a folder only. Its files and sub-folders move up one level, so no
 * image or video is ever removed by this call.
 */
export const deleteFolder = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertFolderAccess(me, data.id);
    const sql = await getSql();
    const found = await sql<{ parent_id: number | null }>`
      select parent_id from media_folders where id = ${data.id}
    `;
    if (!found[0]) return { ok: true };
    const parent = found[0].parent_id;
    await sql`update media_folders set parent_id = ${parent} where parent_id = ${data.id}`;
    if (parent == null) {
      await sql`delete from media_folder_items where folder_id = ${data.id}`;
    } else {
      await sql`update media_folder_items set folder_id = ${parent} where folder_id = ${data.id}`;
    }
    await sql`delete from media_folders where id = ${data.id}`;
    return { ok: true };
  });

/** Put files into a folder, or back to home with `folderId: null`. */
export const moveMedia = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ids: z.array(z.number().int().positive()).min(1).max(500),
      folderId: z.number().int().positive().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertMediaAccess(me, data.ids);
    if (data.folderId != null) await assertFolderAccess(me, data.folderId);
    const sql = await getSql();
    if (data.folderId == null) {
      await sql.query(`delete from media_folder_items where media_id = any($1::int[])`, [data.ids]);
      return { ok: true };
    }
    const folder = await sql<{ id: number }>`select id from media_folders where id = ${data.folderId}`;
    if (!folder[0]) throw new Error("ফোল্ডারটি পাওয়া যায়নি");
    await sql.query(
      `insert into media_folder_items (media_id, folder_id)
       select m.id, $2::int from media m where m.id = any($1::int[])
       on conflict (media_id) do update set folder_id = excluded.folder_id, added_at = now()`,
      [data.ids, data.folderId],
    );
    return { ok: true };
  });

export const renameMedia = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), title: z.string().max(160) }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertMediaAccess(me, [data.id]);
    const sql = await getSql();
    await sql`update media set title = ${data.title.trim()} where id = ${data.id}`;
    return { ok: true };
  });

/**
 * Lock or unlock your own pictures/videos. Locked files disappear from the gallery
 * and the pickers of every other member (the admin still sees them).
 */
export const setMediaLocked = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.number().int().positive()).min(1).max(500), locked: z.boolean() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertMediaAccess(me, data.ids);
    const sql = await getSql();
    await sql.query(`update media set locked = $2 where id = any($1::int[])`, [data.ids, data.locked]);
    return { ok: true };
  });

/** Lock or unlock a folder you own. Everything inside it (sub-folders too) is locked along with it. */
export const setFolderLocked = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), locked: z.boolean() }))
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertFolderAccess(me, data.id);
    const sql = await getSql();
    await sql`update media_folders set locked = ${data.locked} where id = ${data.id}`;
    return { ok: true };
  });

/** Where each of these files is used. Files that are used nowhere are omitted. */
export const getMediaUsage = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }))
  .handler(async ({ data }) => {
    await requireMember();
    const sql = await getSql();
    const usage = await collectUsage(sql);
    const result: Record<number, MediaUsage[]> = {};
    for (const id of data.ids) {
      const places = usage.get(id);
      if (places && places.length > 0) result[id] = places;
    }
    return result;
  });

/**
 * Delete files. Unless `force` is set, files that are still used somewhere are
 * skipped and reported back, so nothing in use disappears by accident.
 */
export const deleteMediaSafe = createServerFn({ method: "POST" })
  .validator(
    z.object({ ids: z.array(z.number().int().positive()).min(1).max(500), force: z.boolean().default(false) }),
  )
  .handler(async ({ data }) => {
    const me = await requireMember();
    await assertMediaAccess(me, data.ids);
    const sql = await getSql();
    let ids = data.ids;
    let skipped: number[] = [];
    if (!data.force) {
      const usage = await collectUsage(sql);
      skipped = ids.filter((id) => (usage.get(id)?.length ?? 0) > 0);
      ids = ids.filter((id) => !skipped.includes(id));
    }
    if (ids.length > 0) {
      // Into the trash, not gone: Studio › Trash (or the gallery's Trash button) brings them back.
      await sql.query(
        `update media set deleted_at = now(), deleted_by = $2 where id = any($1::int[]) and deleted_at is null`,
        [ids, me.id],
      );
    }
    return { deleted: ids.length, skipped };
  });
