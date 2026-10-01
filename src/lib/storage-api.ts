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
