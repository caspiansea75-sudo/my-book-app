/**
 * Music files a player adds themselves (for example songs they own). They are kept inside the browser
 * (IndexedDB) on that device only — nothing is uploaded to the site.
 */
export type CustomTrack = { id: number; name: string; size: number };
export type CustomMusicError = "too-big" | "too-many" | "not-audio" | "unsupported";

const DB_NAME = "pk-music";
const STORE = "tracks";
export const MAX_CUSTOM_TRACKS = 6;
export const MAX_CUSTOM_BYTES = 40 * 1024 * 1024;

const req = <T,>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("unsupported"));
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

type Row = { id?: number; name: string; size: number; type: string; blob: Blob; added: number };

export async function listCustom(): Promise<CustomTrack[]> {
  try {
    const db = await openDb();
    const rows = (await req(db.transaction(STORE).objectStore(STORE).getAll())) as Row[];
    db.close();
    return rows.map((r) => ({ id: r.id!, name: r.name, size: r.size }));
  } catch {
    return [];
  }
}

export async function addCustom(file: File): Promise<CustomTrack> {
  const looksAudio = file.type.startsWith("audio/") || /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|webm)$/i.test(file.name);
  if (!looksAudio) throw new Error("not-audio" satisfies CustomMusicError);
  if (file.size > MAX_CUSTOM_BYTES) throw new Error("too-big" satisfies CustomMusicError);
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    throw new Error("unsupported" satisfies CustomMusicError);
  }
  const store = () => db.transaction(STORE, "readwrite").objectStore(STORE);
  const count = await req(db.transaction(STORE).objectStore(STORE).count());
  if (count >= MAX_CUSTOM_TRACKS) {
    db.close();
    throw new Error("too-many" satisfies CustomMusicError);
  }
  const row: Row = { name: file.name.replace(/\.[^.]+$/, "").slice(0, 60), size: file.size, type: file.type, blob: file, added: Date.now() };
  const id = (await req(store().add(row))) as number;
  db.close();
  return { id, name: row.name, size: row.size };
}

export async function removeCustom(id: number): Promise<void> {
  const db = await openDb();
  await req(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
  db.close();
}

export async function getCustomBlob(id: number): Promise<Blob | null> {
  try {
    const db = await openDb();
    const row = (await req(db.transaction(STORE).objectStore(STORE).get(id))) as Row | undefined;
    db.close();
    return row?.blob ?? null;
  } catch {
    return null;
  }
}
