const IMAGE_MAX_BYTES = 900_000;
const VIDEO_MAX_BYTES = 2_400_000;
const GIF_MAX_BYTES = 900_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ফাইল পড়া যায়নি"));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("ফাইল পড়া যায়নি"));
    };
    reader.readAsDataURL(file);
  });
}

export function stripDataUrl(dataUrl: string): { mime: string; base64: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) throw new Error("অবৈধ ফাইল");
  return { mime: match[1], base64: match[2] };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("ছবি খোলা যায়নি"));
    img.src = src;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("ছবি তৈরি যায়নি"));
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("ছবি তৈরি যায়নি"));
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("ছবি তৈরি যায়নি"));
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

function drawContain(
  img: HTMLImageElement | HTMLVideoElement,
  maxEdge: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const sw = "videoWidth" in img ? img.videoWidth || img.width : img.width;
  const sh = "videoHeight" in img ? img.videoHeight || img.height : img.height;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ছবি তৈরি যায়নি");
  ctx.fillStyle = "#111318";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img as CanvasImageSource, 0, 0, width, height);
  return { canvas, width, height };
}

export type PreparedImage = {
  kind: "image";
  mime: string;
  base64: string;
  thumb: string;
  width: number;
  height: number;
  bytes: number;
  title: string;
};

export type PreparedVideo = {
  kind: "video";
  mime: string;
  base64: string;
  thumb: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  title: string;
};

export async function prepareImageUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("এটি একটি ছবি নয়");
  if (file.size > 12 * 1024 * 1024) throw new Error("ছবি ১২ এমবি-র বেশি হতে পারবে না");

  const title = file.name.replace(/\.[^.]+$/, "");

  if (file.type === "image/gif") {
    if (file.size > GIF_MAX_BYTES) throw new Error("GIF ৯০০ কেবি-র বেশি হতে পারবে না");
    const dataUrl = await readAsDataUrl(file);
    const { mime, base64 } = stripDataUrl(dataUrl);
    return {
      kind: "image",
      mime,
      base64,
      thumb: base64,
      width: 0,
      height: 0,
      bytes: file.size,
      title,
    };
  }

  const original = await readAsDataUrl(file);
  const img = await loadImage(original);

  let quality = 0.8;
  let maxEdge = 1400;
  let last: { dataUrl: string; width: number; height: number; bytes: number } | null = null;

  for (let i = 0; i < 6; i += 1) {
    const { canvas, width, height } = drawContain(img, maxEdge);
    const dataUrl = await canvasToJpeg(canvas, quality);
    const { base64 } = stripDataUrl(dataUrl);
    const bytes = Math.ceil((base64.length * 3) / 4);
    last = { dataUrl, width, height, bytes };
    if (bytes <= IMAGE_MAX_BYTES) break;
    quality = Math.max(0.52, quality - 0.08);
    maxEdge = Math.max(720, Math.round(maxEdge * 0.82));
  }

  if (!last || last.bytes > IMAGE_MAX_BYTES) {
    throw new Error("ছবি আরও ছোট করে তুলুন");
  }

  const { canvas: thumbCanvas } = drawContain(img, 480);
  const thumbUrl = await canvasToJpeg(thumbCanvas, 0.62);
  const thumb = stripDataUrl(thumbUrl).base64;
  const full = stripDataUrl(last.dataUrl).base64;

  return {
    kind: "image",
    mime: "image/jpeg",
    base64: full,
    thumb,
    width: last.width,
    height: last.height,
    bytes: last.bytes,
    title,
  };
}

export async function prepareVideoUpload(file: File): Promise<PreparedVideo> {
  if (!file.type.startsWith("video/")) throw new Error("এটি একটি ভিডিও নয়");
  if (file.size > VIDEO_MAX_BYTES) {
    throw new Error("ভিডিও আপলোড সর্বোচ্চ ২.৪ এমবি। বড় ফাইলের জন্য YouTube বা সরাসরি লিংক দিন।");
  }
  const dataUrl = await readAsDataUrl(file);
  const { mime, base64 } = stripDataUrl(dataUrl);
  const thumb = await captureVideoFrame(dataUrl);
  return {
    kind: "video",
    mime,
    base64,
    thumb,
    width: null,
    height: null,
    bytes: file.size,
    title: file.name.replace(/\.[^.]+$/, ""),
  };
}

function captureVideoFrame(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    const fail = () => resolve(null);
    video.onerror = fail;
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.4, (video.duration || 1) * 0.08);
      } catch {
        fail();
      }
    };
    video.onseeked = () => {
      try {
        const { canvas } = drawContain(video, 640);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") {
                resolve(stripDataUrl(reader.result).base64);
              } else resolve(null);
            };
            reader.onerror = fail;
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.64,
        );
      } catch {
        fail();
      }
    };
    video.src = src;
  });
}

export const MEDIA_LIMITS = {
  imageBytes: IMAGE_MAX_BYTES,
  videoBytes: VIDEO_MAX_BYTES,
};
