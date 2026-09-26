import { useState } from "react";
import { parseVideoUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export function MediaFigure({
  kind,
  src,
  url,
  caption,
  className,
  onOpen,
}: {
  kind: "image" | "video";
  src?: string;
  url?: string;
  caption?: string;
  className?: string;
  onOpen?: () => void;
}) {
  if (kind === "video") {
    return (
      <VideoFigure src={src} url={url} caption={caption} className={className} />
    );
  }

  const imageSrc = src || url;
  if (!imageSrc) return null;

  return (
    <figure className={cn("media-block", className)}>
      <button
        type="button"
        className="media-frame pressable"
        onClick={onOpen}
        aria-label={caption || "ছবি বড় করে দেখুন"}
      >
        <img src={imageSrc} alt={caption || ""} />
      </button>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function VideoFigure({
  src,
  url,
  caption,
  className,
}: {
  src?: string;
  url?: string;
  caption?: string;
  className?: string;
}) {
  const parsed = parseVideoUrl(url || src || "");
  const [failed, setFailed] = useState(false);

  if (parsed?.provider === "youtube" || parsed?.provider === "vimeo") {
    return (
      <figure className={cn("media-block", className)}>
        <div className="media-frame media-frame-video">
          <iframe
            src={parsed.embedUrl}
            title={caption || "ভিডিও"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {caption ? <figcaption>{caption}</figcaption> : null}
      </figure>
    );
  }

  const videoSrc = src || url;
  if (!videoSrc) return null;

  return (
    <figure className={cn("media-block", className)}>
      <div className="media-frame media-frame-video">
        {failed ? (
          <p className="grid h-full place-items-center px-4 text-center font-sans text-sm text-muted">
            ভিডিও চালানো যায়নি
          </p>
        ) : (
          <video src={videoSrc} controls playsInline preload="metadata" onError={() => setFailed(true)} />
        )}
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
