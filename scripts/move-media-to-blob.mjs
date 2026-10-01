// One-time: move old base64 media out of Neon into Vercel Blob (frees Neon space).
// Run:  DATABASE_URL=... BLOB_READ_WRITE_TOKEN=... node scripts/move-media-to-blob.mjs
import pg from "pg";
import { put } from "@vercel/blob";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows } = await db.query(
  "select id, mime from media where source = 'upload' and data is not null and url is null order by id",
);
console.log(`${rows.length} files to move`);
for (const r of rows) {
  const { rows: [m] } = await db.query("select data from media where id = $1", [r.id]);
  const ext = (r.mime.split("/")[1] ?? "bin").split(";")[0].replace(/[^a-z0-9]/gi, "") || "bin";
  const res = await put(`media/${r.id}.${ext}`, Buffer.from(m.data, "base64"), {
    access: "private", contentType: r.mime, addRandomSuffix: true,
  });
  await db.query("update media set url = $1, data = null where id = $2", [res.url, r.id]);
  console.log("moved", r.id);
}
await db.end();
console.log("Done. Run VACUUM FULL media; in Neon's SQL editor to reclaim the space.");
