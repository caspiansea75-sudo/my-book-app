import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { mediaSrc, mediaThumbSrc } from "@/lib/media-url";

export type VaultFolder = {
  id: number;
  parentId: number | null;
  name: string;
  createdAt: string;
  itemCount: number;
};

export type VaultItem = {
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
};

type FolderRow = {
  id: number;
  parent_id: number | null;
  name: string;
  created_at: string | Date;
  item_count: number;
};

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

function asItem(row: ItemRow): VaultItem {
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
  };
}

/** Everything the media page needs in one round trip (no heavy blob columns). */
export const loadVault = createServerFn({ method: "GET" }).handler(async (): Promise<Vault> => {
  const sql = await getSql();
  const folderRows = await sql<FolderRow>`
    select f.id, f.parent_id, f.name, f.created_at,
      (select count(*) from media_folder_items i where i.folder_id = f.id) as item_count
    from media_folders f
    order by lower(f.name), f.id
  `;
  const itemRows = await sql<ItemRow>`
    select m.id, m.kind, m.title, m.mime, m.source, m.url,
      case when m.thumb like 'http%' then m.thumb else null end as thumb_url,
      (m.thumb is not null) as has_thumb,
      m.width, m.height, m.bytes, m.created_at, i.folder_id
    from media m
    left join media_folder_items i on i.media_id = m.id
    order by m.created_at desc, m.id desc
    limit 2000
  `;
  return {
    folders: folderRows.map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      name: r.name,
      createdAt: iso(r.created_at),
      itemCount: Number(r.item_count),
    })),
    items: itemRows.map(asItem),
  };
});

const folderName = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "নাম লিখুন").max(80, "নাম বেশি বড়"));

export const createFolder = createServerFn({ method: "POST" })
  .validator(z.object({ name: folderName, parentId: z.number().int().positive().nullable() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (data.parentId != null) {
      const parent = await sql<{ id: number }>`select id from media_folders where id = ${data.parentId}`;
      if (!parent[0]) throw new Error("ফোল্ডারটি পাওয়া যায়নি");
    }
    const rows = await sql<{ id: number }>`
      insert into media_folders (name, parent_id) values (${data.name}, ${data.parentId}) returning id
    `;
    return { id: rows[0].id };
  });

export const renameFolder = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), name: folderName }))
  .handler(async ({ data }) => {
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
    const sql = await getSql();
    await sql`update media set title = ${data.title.trim()} where id = ${data.id}`;
    return { ok: true };
  });
