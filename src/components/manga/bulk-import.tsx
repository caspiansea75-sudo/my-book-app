import { useRef, useState } from "react";
import { FileArchive, Link2, Loader2 } from "lucide-react";
import { base64ToFile, mapPool } from "@/lib/pool";
import { addImageLink, uploadImageFile } from "@/lib/upload-image";
import { fetchRemoteImage, scanPageImages } from "@/lib/remote-import-api";
import type { PageImage } from "@/lib/page-images";
import { mimeFromName, pageEntries, readZip, ZipError, type ZipEntry } from "@/lib/zip-lite";
import { cn } from "@/lib/utils";

type Mode = "zip" | "link";
type Scan = { title: string; pageUrl: string; images: PageImage[] };
type Progress = { done: number; total: number };

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/**
 * Bring in a whole chapter at once: from a ZIP / CBZ file, or from a web page that shows the pages.
 * Every imported picture is stored just like a normal upload, then reported back (in reading order) so the
 * chapter can take them all in one go.
 */
export function BulkImport({ seriesSlug, onImported }: { seriesSlug: string; onImported: (ids: number[]) => void | Promise<void> }) {
  const [mode, setMode] = useState<Mode>("zip");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [problems, setProblems] = useState<{ label: string; message: string }[]>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  // ZIP
  const fileRef = useRef<HTMLInputElement>(null);
  const [zipName, setZipName] = useState("");
  const [zipPages, setZipPages] = useState<ZipEntry[]>([]);

  // page link
  const [url, setUrl] = useState("");
  const [scan, setScan] = useState<Scan | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const [store, setStore] = useState<"copy" | "link">("copy");
  const [rights, setRights] = useState(false);

  const reset = () => {
    setProblems([]);
    setSummary("");
    setError("");
  };

  /* --------------------------------------------------------------- ZIP */
  async function onZip(file: File | undefined) {
    reset();
    setZipPages([]);
    setZipName("");
    if (!file) return;
    try {
      const pages = pageEntries(await readZip(file));
      if (!pages.length) return setError("এই ফাইলে কোনো ছবি পাওয়া যায়নি");
      setZipName(file.name);
      setZipPages(pages);
    } catch (e) {
      setError(e instanceof ZipError && e.code === "zip64" ? "ফাইলটি অনেক বড় ZIP — ছোট ভাগে ভাগ করে আনুন" : "এটি ZIP / CBZ ফাইল নয়, বা ফাইলটি নষ্ট");
    }
  }

  async function importZip() {
    reset();
    setBusy(true);
    setProgress({ done: 0, total: zipPages.length });
    const bad: { label: string; message: string }[] = [];
    const ids = await mapPool(
      zipPages,
      3,
      async (entry) => {
        const name = entry.path.split("/").pop() ?? "page";
        const bytes = await entry.read();
        return uploadImageFile(new File([bytes as BlobPart], name, { type: mimeFromName(name) }));
      },
      { onDone: (done, total) => setProgress({ done, total }), onError: (i, e) => bad.push({ label: zipPages[i].path.split("/").pop() ?? String(i + 1), message: errText(e, "যোগ হয়নি") }) },
    );
    await finish(ids.filter((v): v is number => typeof v === "number"), bad, 0);
    setZipPages([]);
    setZipName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  /* ----------------------------------------------------------- page link */
  async function findImages() {
    reset();
    setScan(null);
    setBusy(true);
    try {
      const r = await scanPageImages({ data: { seriesSlug, url: url.trim() } });
      if (!r.images.length) {
        setError("এই পেজে কোনো ছবি পাওয়া যায়নি (পেজটি জাভাস্ক্রিপ্ট চালিয়ে ছবি আনলে এখানে ধরা পড়ে না)");
      } else {
        setScan({ title: r.title, pageUrl: r.pageUrl, images: r.images });
        setPicked(new Set(r.images.flatMap((im, i) => (im.junk ? [] : [i]))));
        setBroken(new Set());
      }
    } catch (e) {
      setError(errText(e, "পেজটি খোলা গেল না"));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (i: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  async function importLink() {
    if (!scan) return;
    reset();
    const chosen = [...picked].sort((a, b) => a - b).map((i) => scan.images[i]);
    if (!chosen.length) return;
    setBusy(true);
    setProgress({ done: 0, total: chosen.length });
    const bad: { label: string; message: string }[] = [];
    let linked = 0;
    const hooks = {
      onDone: (done: number, total: number) => setProgress({ done, total }),
      onError: (i: number, e: unknown) => bad.push({ label: String(i + 1), message: errText(e, "যোগ হয়নি") }),
    };
    const ids =
      store === "link"
        ? await mapPool(chosen, 6, (im) => addImageLink(im.url), hooks)
        : await mapPool(
            chosen,
            3,
            async (im) => {
              try {
                const got = await fetchRemoteImage({ data: { seriesSlug, url: im.url, referer: scan.pageUrl } });
                return await uploadImageFile(base64ToFile(got.base64, got.name, got.mime));
              } catch (e) {
                // a picture too big to copy is kept as a link instead of being lost
                if (errText(e, "") === "ফাইলটি অনেক বড়") {
                  linked++;
                  return addImageLink(im.url);
                }
                throw e;
              }
            },
            hooks,
          );
    await finish(ids.filter((v): v is number => typeof v === "number"), bad, linked);
  }

  async function finish(ids: number[], bad: { label: string; message: string }[], linked: number) {
    try {
      if (ids.length) await onImported(ids);
      const parts = [`${ids.length} টি পেজ যোগ হয়েছে`];
      if (linked) parts.push(`${linked} টি বড় ছবি লিংক হিসেবে রাখা হয়েছে`);
      setSummary(parts.join(" · "));
    } catch (e) {
      setError(errText(e, "অধ্যায়ে যোগ করা যায়নি"));
    }
    setProblems(bad);
    setBusy(false);
    setProgress(null);
  }

  const canLink = !!scan && picked.size > 0 && rights && !busy;

  return (
    <div className="space-y-4 font-sans text-sm">
      <div className="flex flex-wrap gap-2">
        <ModeButton on={mode === "zip"} onClick={() => setMode("zip")} icon={<FileArchive className="size-4" />}>ZIP / CBZ ফাইল</ModeButton>
        <ModeButton on={mode === "link"} onClick={() => setMode("link")} icon={<Link2 className="size-4" />}>পেজের লিংক</ModeButton>
      </div>

      {mode === "zip" ? (
        <div className="space-y-3">
          <p className="text-muted">পেজগুলো একটা ZIP বা CBZ ফাইলে রেখে দিন — ফাইলের নামের ক্রমে (page2 এর পর page10) সবগুলো একসাথে যোগ হবে।</p>
          <input ref={fileRef} type="file" accept=".zip,.cbz,application/zip" className="hidden" onChange={(e) => void onZip(e.target.files?.[0])} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="pressable rounded-full border border-border bg-surface-2 px-4 py-2 text-fg disabled:opacity-50">
            ZIP / CBZ ফাইল বাছুন
          </button>
          {zipPages.length ? (
            <div className="rounded-lg border border-border bg-bg p-3">
              <p className="text-fg">{`${zipName} — ${zipPages.length} টি পেজ পাওয়া গেছে`}</p>
              <p className="mt-1 text-xs text-muted">{`প্রথম: ${zipPages[0].path.split("/").pop()} · শেষ: ${zipPages[zipPages.length - 1].path.split("/").pop()}`}</p>
              <button type="button" disabled={busy} onClick={() => void importZip()} className="pressable mt-3 rounded-full bg-accent px-5 py-2 text-accent-fg disabled:opacity-50">
                {`${zipPages.length} টি পেজ যোগ করুন`}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted">যে ওয়েব পেজে অধ্যায়ের ছবিগুলো আছে তার লিংক দিন। পেজের সব ছবি ক্রমানুসারে খুঁজে দেখাবে — আপনি বেছে নিয়ে একসাথে আনতে পারবেন।</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && url.trim() && !busy && void findImages()}
              placeholder="https://…"
              inputMode="url"
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-fg"
            />
            <button type="button" disabled={busy || url.trim().length < 8} onClick={() => void findImages()} className="pressable inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-accent-fg disabled:opacity-50">
              {busy && !progress ? <Loader2 className="size-4 animate-spin" /> : null} ছবি খুঁজুন
            </button>
          </div>

          {scan ? (
            <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-fg">{scan.title || scan.pageUrl}</p>
                <span className="text-xs text-muted">{`${scan.images.length} টি ছবি পাওয়া গেছে · ${picked.size} টি বাছা`}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <SmallButton onClick={() => setPicked(new Set(scan.images.map((_, i) => i)))}>সব বাছুন</SmallButton>
                <SmallButton onClick={() => setPicked(new Set())}>কোনোটাই না</SmallButton>
                <SmallButton onClick={() => setPicked(new Set(scan.images.flatMap((im, i) => (im.junk ? [] : [i]))))}>শুধু পেজের মতো ছবি</SmallButton>
                <SmallButton
                  onClick={() => {
                    const n = scan.images.length;
                    setScan({ ...scan, images: [...scan.images].reverse() });
                    setPicked(new Set([...picked].map((i) => n - 1 - i)));
                    setBroken(new Set([...broken].map((i) => n - 1 - i)));
                  }}
                >
                  ক্রম উল্টে দিন
                </SmallButton>
              </div>
              <ul className="grid max-h-[26rem] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5">
                {scan.images.map((im, i) => (
                  <li key={im.url}>
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-pressed={picked.has(i)}
                      className={cn("relative block aspect-[3/4] w-full overflow-hidden rounded-lg border bg-surface-2", picked.has(i) ? "border-lamp ring-2 ring-lamp/60" : "border-border opacity-60")}
                    >
                      {broken.has(i) ? (
                        <span className="grid h-full place-items-center px-1 text-center text-[11px] text-muted">প্রিভিউ দেখা যাচ্ছে না — তবু আনা যেতে পারে</span>
                      ) : (
                        <img src={im.preview ?? im.url} alt={im.alt ?? ""} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setBroken((s) => new Set(s).add(i))} />
                      )}
                      <span className="absolute left-1 top-1 rounded bg-bg/85 px-1.5 text-[11px] tabular-nums text-fg">{i + 1}</span>
                      {im.junk ? <span className="absolute bottom-1 left-1 rounded bg-bg/85 px-1.5 text-[10px] text-muted">লোগো/আইকন?</span> : null}
                      <span className={cn("absolute right-1 top-1 grid size-5 place-items-center rounded-full text-[12px]", picked.has(i) ? "bg-lamp text-bg" : "bg-bg/85 text-transparent")}>✓</span>
                    </button>
                  </li>
                ))}
              </ul>

              <fieldset className="space-y-1.5 text-fg">
                <label className="flex items-start gap-2">
                  <input type="radio" name="bulk-store" checked={store === "copy"} onChange={() => setStore("copy")} className="mt-1" />
                  <span>আমার সাইটে কপি করে রাখুন <span className="text-muted">(প্রস্তাবিত — মূল সাইট বন্ধ হলেও ছবি থাকবে; একটু সময় লাগে)</span></span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" name="bulk-store" checked={store === "link"} onChange={() => setStore("link")} className="mt-1" />
                  <span>শুধু লিংক রাখুন <span className="text-muted">(খুব দ্রুত; কিন্তু মূল সাইট ছবি সরালে বা আটকে দিলে এখানেও দেখা যাবে না)</span></span>
                </label>
              </fieldset>

              <label className="flex items-start gap-2 rounded-lg bg-surface-2 p-2.5 text-fg">
                <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1" />
                <span>আমি নিশ্চিত করছি, এই ছবিগুলো আমার নিজের তৈরি, অথবা এগুলো এখানে প্রকাশ করার অনুমতি আমার আছে।</span>
              </label>
              <button type="button" disabled={!canLink} onClick={() => void importLink()} className="pressable rounded-full bg-accent px-5 py-2 text-accent-fg disabled:opacity-50">
                {`${picked.size} টি পেজ আনুন`}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {progress ? (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <i className="block h-full rounded-full bg-lamp transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{progress.done} / {progress.total}</p>
        </div>
      ) : null}
      {summary ? <p className="text-[#6df08a]">✔ {summary}</p> : null}
      {error ? <p className="text-nsfw">{error}</p> : null}
      {problems.length ? (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer text-nsfw">{`${problems.length} টি ছবি যোগ হয়নি`}</summary>
          <ul className="mt-1 space-y-0.5">
            {problems.slice(0, 8).map((p, i) => (
              <li key={i}>
                <span>{p.label}</span>: <span>{p.message}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ModeButton({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("pressable inline-flex items-center gap-2 rounded-full border px-4 py-1.5", on ? "border-lamp bg-surface-2 text-fg" : "border-border text-muted hover:text-fg")}>
      {icon}
      {children}
    </button>
  );
}
function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="pressable rounded-full border border-border bg-surface px-3 py-1 text-fg">
      {children}
    </button>
  );
}
