import { useCallback, useEffect, useState } from "react";
import { Database, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { getBlobReport, getStorageReport, type BlobReport, type StorageReport } from "@/lib/storage-api";
import { cn } from "@/lib/utils";

const DB_LIMIT_KEY = "storage-limit-mb";
const BLOB_LIMIT_KEY = "storage-blob-limit-mb";
const DEFAULT_DB_LIMIT_MB = 512;
const DEFAULT_BLOB_LIMIT_MB = 1024;

const num = (n: number, digits = 0) => n.toLocaleString("bn-BD", { maximumFractionDigits: digits, minimumFractionDigits: digits });

function size(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${num(bytes / 1024 ** 3, 2)} জিবি`;
  if (bytes >= 1024 ** 2) return `${num(bytes / 1024 ** 2, 1)} এমবি`;
  if (bytes >= 1024) return `${num(bytes / 1024)} কেবি`;
  return `${num(bytes)} বাইট`;
}

function readLimit(key: string, fallback: number): number {
  try {
    const v = Number(window.localStorage.getItem(key));
    return v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

function saveLimit(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage blocked: the limit just won't be remembered */
  }
}

const toneFor = (pct: number) => (pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400");

/** Admin only: how full the database is and what is filling it. */
export function StorageUsage() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<BlobReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [limitMb, setLimitMb] = useState(DEFAULT_DB_LIMIT_MB);
  const [blobLimitMb, setBlobLimitMb] = useState(DEFAULT_BLOB_LIMIT_MB);

  useEffect(() => {
    setLimitMb(readLimit(DB_LIMIT_KEY, DEFAULT_DB_LIMIT_MB));
    setBlobLimitMb(readLimit(BLOB_LIMIT_KEY, DEFAULT_BLOB_LIMIT_MB));
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    // Fetched side by side; a failing Blob store never hides the database numbers.
    const [db, bl] = await Promise.allSettled([getStorageReport(), getBlobReport()]);
    if (db.status === "fulfilled") setReport(db.value);
    else setError(db.reason instanceof Error ? db.reason.message : "হিসাব আনা যায়নি");
    if (bl.status === "fulfilled") setBlob(bl.value);
    else setBlob(null);
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function changeLimit(value: string) {
    const v = Number(value);
    if (!(v > 0)) return;
    setLimitMb(v);
    saveLimit(DB_LIMIT_KEY, v);
  }

  function changeBlobLimit(value: string) {
    const v = Number(value);
    if (!(v > 0)) return;
    setBlobLimitMb(v);
    saveLimit(BLOB_LIMIT_KEY, v);
  }

  const maxTable = Math.max(1, ...(report?.tables.map((t) => t.bytes) ?? [1]));
  const maxOwner = Math.max(1, ...(report?.owners.map((o) => o.bytes) ?? [1]));

  return (
    <div className="mt-12 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Database className="size-5 text-lamp" strokeWidth={1.6} />
          ডেটাবেস ও ব্লব জায়গা
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="pressable ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 font-sans text-xs text-muted hover:text-fg disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" strokeWidth={1.75} />}
          নতুন করে দেখুন
        </button>
      </div>

      {error ? <p className="mt-4 font-sans text-sm text-nsfw">{error}</p> : null}
      {!report && !error ? <p className="mt-4 font-sans text-sm text-muted">হিসাব হচ্ছে…</p> : null}

      {report ? (
        <>
          <div className="mt-5 space-y-5">
            {blob?.connected && !blob.error && report.dbBytes ? (
              <CombinedMeter used={report.dbBytes + blob.bytes} limit={(limitMb + blobLimitMb) * 1024 ** 2} />
            ) : null}
            <Meter
              title="Neon ডেটাবেস"
              used={report.dbBytes}
              limitMb={limitMb}
              onLimit={changeLimit}
              hint="সীমাটা আপনার Neon প্ল্যানের সংখ্যা দিয়ে বদলে নিন। চূড়ান্ত হিসাব সবসময় Neon কনসোলে দেখুন।"
            />
            {blob === null ? (
              <p className="font-sans text-sm text-muted">ব্লব স্টোরের হিসাব আনা যায়নি।</p>
            ) : !blob.connected ? (
              <p className="font-sans text-sm text-muted">
                Vercel Blob এই ডিপ্লয়মেন্টে যুক্ত নেই। Vercel → Storage থেকে স্টোরটি প্রজেক্টের সাথে Connect করলে{" "}
                <code className="text-fg">BLOB_READ_WRITE_TOKEN</code> নিজে থেকেই বসে যাবে, তারপর আবার ডিপ্লয় করুন।
              </p>
            ) : blob.error ? (
              <p className="font-sans text-sm text-nsfw">Vercel Blob: {blob.error}</p>
            ) : (
              <Meter
                title="Vercel Blob"
                used={blob.bytes}
                limitMb={blobLimitMb}
                onLimit={changeBlobLimit}
                hint={`${num(blob.count)}টি ফাইল${blob.truncated ? " (অন্তত)" : ""}। অপারেশন ও ডেটা ট্রান্সফারের ব্যবহার Vercel ড্যাশবোর্ডে দেখুন।`}
              />
            )}
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Stat label="ছবি (আপলোড)" value={report.media.images} />
            <Stat label="ভিডিও (আপলোড)" value={report.media.videos} />
            <Stat label="শুধু লিংক (YouTube ইত্যাদি)" value={report.media.links} />
            <Stat label="ট্রাশে আটকে থাকা" value={report.media.trash} warn />
          </div>
          {report.media.trash.bytes > 0 ? (
            <p className="mt-2 flex items-start gap-1.5 font-sans text-xs text-muted">
              <Trash2 className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
              ট্রাশের ছবি/ভিডিও এখনো ডেটাবেসে জায়গা নিচ্ছে। ট্রাশ থেকে “স্থায়ীভাবে মুছুন” করলে তবেই জায়গা ফিরবে।
            </p>
          ) : null}

          {blob?.connected && !blob.error && blob.count > 0 ? (
            <>
              <h3 className="mt-8 font-display text-base">Blob: কোন ফোল্ডার কত জায়গা নিচ্ছে</h3>
              <ul className="mt-3 space-y-2">
                {blob.folders.map((f) => (
                  <Bar key={f.name} label={f.name} sub={`${num(f.count)}টি ফাইল`} bytes={f.bytes} max={Math.max(1, blob.folders[0]?.bytes ?? 1)} />
                ))}
              </ul>
              <h3 className="mt-8 font-display text-base">Blob: সবচেয়ে বড় ফাইল</h3>
              <ul className="mt-3 space-y-2">
                {blob.biggest.map((b) => (
                  <li key={b.pathname} className="flex items-center gap-3 rounded-lg border border-border p-2 font-sans">
                    <p className="min-w-0 flex-1 truncate text-sm text-fg">{b.pathname}</p>
                    <span className="shrink-0 text-sm text-fg">{size(b.bytes)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h3 className="mt-8 font-display text-base">কোন টেবিল কত জায়গা নিচ্ছে</h3>
          <ul className="mt-3 space-y-2">
            {report.tables.map((t) => (
              <Bar key={t.name} label={t.name} sub={`${num(t.rows)} সারি`} bytes={t.bytes} max={maxTable} />
            ))}
          </ul>

          {report.owners.length > 0 ? (
            <>
              <h3 className="mt-8 font-display text-base">সদস্য অনুযায়ী আপলোড</h3>
              <ul className="mt-3 space-y-2">
                {report.owners.map((o) => (
                  <Bar key={o.name} label={o.name} sub={`${num(o.count)}টি ফাইল`} bytes={o.bytes} max={maxOwner} />
                ))}
              </ul>
            </>
          ) : null}

          {report.biggest.length > 0 ? (
            <>
              <h3 className="mt-8 font-display text-base">সবচেয়ে বড় ফাইল</h3>
              <ul className="mt-3 space-y-2">
                {report.biggest.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                    {b.thumbSrc ? (
                      <img src={b.thumbSrc} alt="" loading="lazy" className="size-12 shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-surface-2 font-sans text-[10px] text-muted">
                        ভিডিও
                      </span>
                    )}
                    <div className="min-w-0 flex-1 font-sans">
                      <p className="truncate text-sm text-fg">{b.title || (b.kind === "image" ? "ছবি" : "ভিডিও")}</p>
                      <p className="text-xs text-muted">
                        {b.owner}
                        {b.trashed ? " · ট্রাশে" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-sans text-sm text-fg">{size(b.bytes)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: { count: number; bytes: number }; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-bg/40 px-3 py-2.5 font-sans", warn && value.bytes > 0 ? "border-amber-400/50" : "border-border")}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-fg">
        {size(value.bytes)} <span className="text-xs text-muted">· {num(value.count)}টি</span>
      </p>
    </div>
  );
}

function Bar({ label, sub, bytes, max }: { label: string; sub: string; bytes: number; max: number }) {
  return (
    <li className="font-sans">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-fg">
          {label} <span className="text-xs text-muted">· {sub}</span>
        </span>
        <span className="shrink-0 text-fg">{size(bytes)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-lamp/70" style={{ width: `${Math.max(2, (bytes / max) * 100)}%` }} />
      </div>
    </li>
  );
}

function Meter({
  title,
  used,
  limitMb,
  onLimit,
  hint,
}: {
  title: string;
  used: number | null;
  limitMb: number;
  onLimit: (v: string) => void;
  hint: string;
}) {
  const pct = used ? Math.min(100, (used / (limitMb * 1024 ** 2)) * 100) : 0;
  return (
    <div>
      <p className="font-sans text-xs tracking-wide text-muted">{title}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-sans">
        <span className="text-2xl text-fg">{used != null ? size(used) : "জানা যায়নি"}</span>
        <span className="text-sm text-muted">
          / সীমা
          <input
            type="number"
            min={1}
            value={limitMb}
            onChange={(e) => onLimit(e.target.value)}
            className="mx-1.5 h-8 w-20 rounded-md border border-border bg-bg px-2 text-center text-fg outline-none focus:border-lamp"
            aria-label={`${title} সীমা (এমবি)`}
          />
          এমবি
        </span>
        {used ? <span className="text-sm text-muted">({num(pct, 1)}% ভরা)</span> : null}
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-all", toneFor(pct))} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 font-sans text-xs text-subtle">{hint}</p>
    </div>
  );
}

function CombinedMeter({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div className="rounded-lg border border-border bg-bg/40 p-3 font-sans">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs tracking-wide text-muted">মোট (ডেটাবেস + ব্লব)</span>
        <span className="text-sm text-fg">
          {size(used)} <span className="text-muted">/ {size(limit)} · {num(pct, 1)}%</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-all", toneFor(pct))} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
