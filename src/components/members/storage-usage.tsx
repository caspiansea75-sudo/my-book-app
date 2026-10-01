import { useCallback, useEffect, useState } from "react";
import { Database, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { getStorageReport, type StorageReport } from "@/lib/storage-api";
import { cn } from "@/lib/utils";

const LIMIT_KEY = "storage-limit-mb";
const DEFAULT_LIMIT_MB = 512;

const num = (n: number, digits = 0) => n.toLocaleString("bn-BD", { maximumFractionDigits: digits, minimumFractionDigits: digits });

function size(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${num(bytes / 1024 ** 3, 2)} জিবি`;
  if (bytes >= 1024 ** 2) return `${num(bytes / 1024 ** 2, 1)} এমবি`;
  if (bytes >= 1024) return `${num(bytes / 1024)} কেবি`;
  return `${num(bytes)} বাইট`;
}

function readLimit(): number {
  try {
    const v = Number(window.localStorage.getItem(LIMIT_KEY));
    return v > 0 ? v : DEFAULT_LIMIT_MB;
  } catch {
    return DEFAULT_LIMIT_MB;
  }
}

/** Admin only: how full the database is and what is filling it. */
export function StorageUsage() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [limitMb, setLimitMb] = useState(DEFAULT_LIMIT_MB);

  useEffect(() => setLimitMb(readLimit()), []);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await getStorageReport());
    } catch (e) {
      setError(e instanceof Error ? e.message : "হিসাব আনা যায়নি");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function changeLimit(value: string) {
    const v = Number(value);
    if (!(v > 0)) return;
    setLimitMb(v);
    try {
      window.localStorage.setItem(LIMIT_KEY, String(v));
    } catch {
      /* storage blocked: the limit just won't be remembered */
    }
  }

  const limitBytes = limitMb * 1024 ** 2;
  const pct = report?.dbBytes ? Math.min(100, (report.dbBytes / limitBytes) * 100) : 0;
  const tone = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400";
  const maxTable = Math.max(1, ...(report?.tables.map((t) => t.bytes) ?? [1]));
  const maxOwner = Math.max(1, ...(report?.owners.map((o) => o.bytes) ?? [1]));

  return (
    <div className="mt-12 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Database className="size-5 text-lamp" strokeWidth={1.6} />
          ডেটাবেস জায়গা
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
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-sans">
              <span className="text-2xl text-fg">{report.dbBytes ? size(report.dbBytes) : "জানা যায়নি"}</span>
              <span className="text-sm text-muted">
                / সীমা
                <input
                  type="number"
                  min={1}
                  value={limitMb}
                  onChange={(e) => changeLimit(e.target.value)}
                  className="mx-1.5 h-8 w-20 rounded-md border border-border bg-bg px-2 text-center text-fg outline-none focus:border-lamp"
                  aria-label="সীমা (এমবি)"
                />
                এমবি
              </span>
              {report.dbBytes ? <span className="text-sm text-muted">({num(pct, 1)}% ভরা)</span> : null}
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 font-sans text-xs text-subtle">
              সীমাটা আপনার Neon প্ল্যানের সংখ্যা দিয়ে বদলে নিন। চূড়ান্ত হিসাব সবসময় Neon কনসোলে দেখুন।
            </p>
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
