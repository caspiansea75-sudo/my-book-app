import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Link2, Upload, Video } from "lucide-react";
import { prepareImageUpload, prepareVideoUpload } from "@/lib/compress";
import { createMedia } from "@/lib/library-api";
import { detectMediaKind, isHttpUrl, normalizeMediaUrl, parseVideoUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

/**
 * Upload many images/videos at once (or add a link). Reports every new id back
 * so the page can drop them straight into the folder the person is viewing.
 */
export function MultiUploader({
  onUploaded,
  targetLabel,
}: {
  onUploaded: (ids: number[]) => void | Promise<void>;
  targetLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);

  async function uploadOne(file: File): Promise<number> {
    if (file.type.startsWith("image/")) {
      const prepared = await prepareImageUpload(file);
      const result = await createMedia({
        data: {
          kind: "image",
          title: prepared.title,
          mime: prepared.mime,
          source: "upload",
          data: prepared.base64,
          thumb: prepared.thumb,
          width: prepared.width,
          height: prepared.height,
          bytes: prepared.bytes,
        },
      });
      return result.id;
    }
    if (file.type.startsWith("video/")) {
      const prepared = await prepareVideoUpload(file);
      const result = await createMedia({
        data: {
          kind: "video",
          title: prepared.title,
          mime: prepared.mime,
          source: "upload",
          data: prepared.base64,
          thumb: prepared.thumb ?? undefined,
          bytes: prepared.bytes,
        },
      });
      return result.id;
    }
    throw new Error("শুধু ছবি বা ভিডিও");
  }

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    setBusy(true);
    setErrors([]);
    setProgress({ done: 0, total: files.length });
    const ids: number[] = [];
    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      try {
        ids.push(await uploadOne(file));
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : "আপলোড ব্যর্থ"}`);
      }
      setProgress({ done: i + 1, total: files.length });
    }
    try {
      if (ids.length > 0) await onUploaded(ids);
    } finally {
      setErrors(failed);
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleLink() {
    const raw = link.trim();
    if (!isHttpUrl(raw)) {
      setErrors(["সঠিক https লিংক দিন"]);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const url = normalizeMediaUrl(raw);
      const parsed = parseVideoUrl(url);
      let kind: "image" | "video";
      if (parsed?.provider === "youtube" || parsed?.provider === "vimeo") kind = "video";
      else if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)) kind = "image";
      else if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) kind = "video";
      else kind = await detectMediaKind(url);
      const result = await createMedia({
        data: {
          kind,
          title: "",
          mime: kind === "image" ? "image/url" : "video/url",
          source: "url",
          url,
        },
      });
      setLink("");
      await onUploaded([result.id]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "লিংক যোগ হয়নি"]);
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border border-dashed px-4 py-6 text-center",
          dragging ? "border-lamp bg-surface-2" : "border-border bg-surface",
        )}
      >
        <p className="flex items-center justify-center gap-2 font-sans text-sm text-muted">
          <Upload className="size-4" strokeWidth={1.7} />
          একসাথে অনেক ছবি বা ছোট ভিডিও ছাড়ুন — <span className="text-fg">{targetLabel}</span> এ যাবে
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="pressable inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg disabled:opacity-60"
          >
            <ImagePlus className="size-4" strokeWidth={1.75} />
            {progress ? `যাচ্ছে… ${progress.done}/${progress.total}` : busy ? "যাচ্ছে…" : "ফাইল বাছুন"}
          </button>
        </div>
        <p className="mt-3 font-sans text-xs text-subtle">
          ছবি স্বয়ংক্রিয়ভাবে ছোট হয়। ভিডিও আপলোড সর্বোচ্চ ২.৪ এমবি — বড় ফাইলের জন্য লিংক দিন।
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
          }}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">ভিডিও বা ছবির লিংক</span>
          <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="YouTube, Vimeo বা সরাসরি ছবি/ভিডিও লিংক"
            className="h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-9 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-lamp"
          />
        </label>
        <button
          type="button"
          disabled={busy || !link.trim()}
          onClick={() => void handleLink()}
          className="pressable inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 font-sans text-sm text-fg disabled:opacity-50"
        >
          <Video className="size-4" strokeWidth={1.75} />
          লিংক যোগ
        </button>
      </div>
      {errors.length > 0 ? (
        <ul className="space-y-1 font-sans text-sm text-nsfw">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
