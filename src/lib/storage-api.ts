import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { requireMember } from "@/lib/members-core";
import { mediaThumbSrc } from "@/lib/media-url";

export type StorageBucket = { count: number; bytes: number };

export type StorageReport = {
  /** Whole database size as Postgres reports it (null if the backend can't say). */
  dbBytes: number | null;
  tables: { name: string; bytes: number; rows: number }[];
  media: {
    images: StorageBucket;
    videos: StorageBucket;
    /** Link-only items (YouTube, remote images): they cost almost nothing. */
    links: StorageBucket;
    /** Uploaded files that are in the trash but not yet erased — they still take space. */
    trash: StorageBucket;
  };
  owners: { name: string; count: number; bytes: number }[];
  biggest: { id: number; title: string; kind: "image" | "video"; bytes: number; trashed: boolean; owner: string; thumbSrc: string | null }[];
  checkedAt: string;
};

/** Size of one media row as it sits in the database (base64 text, TOAST-compressed). */
const STORED = "(coalesce(pg_column_size(m.data), 0) + coalesce(pg_column_size(m.thumb), 0))";

/** Admin only: how full the database is, and what is filling it. */
export const getStorageReport = createServerFn({ method: "GET" }).handler(async (): Promise<StorageReport> => {
  const me = await requireMember();
  if (me.role !== "admin") throw new Error("শুধু অ্যাডমিন দেখতে পারবেন");
  const sql = await getSql();

  let dbBytes: number | null = null;
  try {
    const rows = await sql<{ total: number }>`select pg_database_size(current_database()) as total`;
    dbBytes = Number(rows[0]?.total ?? 0) || null;
  } catch {
    dbBytes = null;
  }

  const tables = await sql<{ name: string; bytes: number; rows: number }>`
    select c.relname as name, pg_total_relation_size(c.oid) as bytes, greatest(c.reltuples, 0)::bigint as rows
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by bytes desc
    limit 12
  `;

  const groups = await sql.query<{ kind: "image" | "video"; source: "upload" | "url"; trashed: boolean; n: number; stored: number }>(
    `select m.kind, m.source, (m.deleted_at is not null) as trashed, count(*) as n,
       coalesce(sum(${STORED}), 0)::bigint as stored
     from media m group by 1, 2, 3`,
  );

  const media: StorageReport["media"] = {
    images: { count: 0, bytes: 0 },
    videos: { count: 0, bytes: 0 },
    links: { count: 0, bytes: 0 },
    trash: { count: 0, bytes: 0 },
  };
  for (const g of groups) {
    const bucket =
      g.trashed && g.source === "upload" ? media.trash : g.source === "url" ? media.links : g.kind === "image" ? media.images : media.videos;
    bucket.count += Number(g.n);
    bucket.bytes += Number(g.stored);
  }

  const owners = await sql.query<{ name: string; count: number; bytes: number }>(
    `select coalesce(mem.display_name, 'অজানা') as name, count(*) as count,
       coalesce(sum(${STORED}), 0)::bigint as bytes
     from media m left join members mem on mem.id = m.owner_id
     where m.source = 'upload'
     group by 1 order by bytes desc limit 10`,
  );

  const big = await sql.query<{ id: number; title: string; kind: "image" | "video"; bytes: number; trashed: boolean; owner: string }>(
    `select m.id, m.title, m.kind, ${STORED}::bigint as bytes, (m.deleted_at is not null) as trashed,
       coalesce(mem.display_name, 'অজানা') as owner
     from media m left join members mem on mem.id = m.owner_id
     where m.source = 'upload'
     order by bytes desc limit 12`,
  );

  return {
    dbBytes,
    tables: tables.map((t) => ({ name: t.name, bytes: Number(t.bytes), rows: Number(t.rows) })),
    media,
    owners: owners.map((o) => ({ name: o.name, count: Number(o.count), bytes: Number(o.bytes) })),
    biggest: big.map((b) => ({
      id: b.id,
      title: b.title,
      kind: b.kind,
      bytes: Number(b.bytes),
      trashed: b.trashed,
      owner: b.owner,
      thumbSrc: b.kind === "image" ? mediaThumbSrc(b.id) : null,
    })),
    checkedAt: new Date().toISOString(),
  };
});

export type BlobReport = {
  /** False when no Blob store is attached to this deployment (neither BLOB_READ_WRITE_TOKEN nor BLOB_STORE_ID). */
  connected: boolean;
  count: number;
  bytes: number;
  /** True if the store has more files than we were willing to count (the numbers are a floor). */
  truncated: boolean;
  /** Top-level folders, biggest first ("(root)" holds files with no folder). */
  folders: { name: string; count: number; bytes: number }[];
  biggest: { pathname: string; url: string; bytes: number; uploadedAt: string }[];
  error: string | null;
  checkedAt: string;
};

const BLOB_PAGE = 1000;
const BLOB_MAX_PAGES = 30; // up to 30,000 files; far beyond a 1 GB hobby store

/** Admin only: how much of the Vercel Blob store is used. Separate from the DB report so a slow or missing store never blocks it. */
export const getBlobReport = createServerFn({ method: "GET" }).handler(async (): Promise<BlobReport> => {
  const me = await requireMember();
  if (me.role !== "admin") throw new Error("শুধু অ্যাডমিন দেখতে পারবেন");

  const empty: BlobReport = {
    connected: false,
    count: 0,
    bytes: 0,
    truncated: false,
    folders: [],
    biggest: [],
    error: null,
    checkedAt: new Date().toISOString(),
  };
  const { blobEnabled } = await import("@/lib/blob-store.server");
  if (!blobEnabled()) return empty;

  try {
    const { list } = await import("@vercel/blob");
    const folders = new Map<string, { count: number; bytes: number }>();
    const top: BlobReport["biggest"] = [];
    let count = 0;
    let bytes = 0;
    let cursor: string | undefined;
    let truncated = false;

    for (let page = 0; ; page += 1) {
      if (page >= BLOB_MAX_PAGES) {
        truncated = true;
        break;
      }
      const res = await list({ limit: BLOB_PAGE, cursor });
      for (const b of res.blobs) {
        count += 1;
        bytes += b.size;
        const slash = b.pathname.indexOf("/");
        const folder = slash === -1 ? "(root)" : b.pathname.slice(0, slash);
        const f = folders.get(folder) ?? { count: 0, bytes: 0 };
        f.count += 1;
        f.bytes += b.size;
        folders.set(folder, f);
        top.push({ pathname: b.pathname, url: b.url, bytes: b.size, uploadedAt: new Date(b.uploadedAt).toISOString() });
      }
      // keep only the 12 biggest so memory stays small
      top.sort((a, b) => b.bytes - a.bytes);
      top.length = Math.min(top.length, 12);
      if (!res.hasMore || !res.cursor) break;
      cursor = res.cursor;
    }

    return {
      ...empty,
      connected: true,
      count,
      bytes,
      truncated,
      folders: [...folders.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 10),
      biggest: top,
    };
  } catch (e) {
    return { ...empty, connected: true, error: e instanceof Error ? e.message : "ব্লব স্টোরের হিসাব আনা যায়নি" };
  }
});
