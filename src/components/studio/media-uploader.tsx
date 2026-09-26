import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Link2, Upload, Video } from "lucide-react";
import { prepareImageUpload, prepareVideoUpload } from "@/lib/compress";
import { createMedia } from "@/lib/library-api";
import { detectMediaKind, isHttpUrl, normalizeMediaUrl, parseVideoUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export function MediaUploader({
  onUploaded,
  compact = false,
}: {
  onUploaded: (id: number, kind: "image" | "video") => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
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
        onUploaded(result.id, "image");
      } else if (file.type.startsWith("video/")) {
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
        onUploaded(result.id, "video");
      } else {
        setError("শুধু ছবি বা ভিডিও");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "আপলোড ব্যর্থ");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleLink() {
    const raw = link.trim();
    if (!isHttpUrl(raw)) {
      setError("সঠিক https লিংক দিন");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = normalizeMediaUrl(raw);
      const parsed = parseVideoUrl(url);
      let kind: "image" | "video";
      if (parsed?.provider === "youtube" || parsed?.provider === "vimeo") {
        kind = "video";
      } else if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)) {
        kind = "image";
      } else if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
        kind = "video";
      } else {
        // No usable extension (common for Drive/Dropbox/etc links) —
        // actually try loading it to tell image from video.
        kind = await detectMediaKind(url);
      }
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
      onUploaded(result.id, kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "লিংক যোগ হয়নি");
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
    <div className={cn("space-y-3", compact && "space-y-2")}>
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
          ছবি বা ছোট ভিডিও এখানে ছাড়ুন
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="pressable inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg disabled:opacity-60"
          >
            <ImagePlus className="size-4" strokeWidth={1.75} />
            {busy ? "যাচ্ছে…" : "ফাইল বাছুন"}
          </button>
        </div>
        <p className="mt-3 font-sans text-xs text-subtle">
          ছবি স্বয়ংক্রিয়ভাবে ছোট হয়। ভিডিও আপলোড সর্বোচ্চ ২.৪ এমবি — বড় ফাইলের জন্য লিংক দিন।
        </p>
        <input
          ref={inputRef}
          type="file"
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
      {error ? <p className="font-sans text-sm text-nsfw">{error}</p> : null}
    </div>
  );
}
