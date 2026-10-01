// One-time: move old base64 chat pictures + avatars out of Neon into Vercel Blob.
// Needs DATABASE_URL and Blob access (run `vercel env pull .env.local` first, then:
//   node --env-file=.env.local scripts/move-chat-images-to-blob.mjs )
import pg from "pg";
import { put } from "@vercel/blob";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows } = await db.query("select id, mime from chat_images where data is not null and url is null order by id");
console.log(`${rows.length} chat pictures to move`);
for (const r of rows) {
  const { rows: [m] } = await db.query("select data from chat_images where id = $1", [r.id]);
  const ext = (r.mime.split("/")[1] ?? "jpeg").split(";")[0].replace(/[^a-z0-9]/gi, "") || "jpeg";
  const res = await put(`chat/${r.id}.${ext}`, Buffer.from(m.data, "base64"), {
    access: "private", contentType: r.mime, addRandomSuffix: true,
  });
  await db.query("update chat_images set url = $1, data = null where id = $2", [res.url, r.id]);
  console.log("moved", r.id);
}
await db.end();
console.log("Done. Run VACUUM FULL chat_images; in Neon's SQL editor to reclaim the space.");
