/** Browser-only: shrink a picked photo to a small JPEG before uploading it. */

export type ResizedImage = { base64: string; bytes: number };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("ছবিটি পড়া যায়নি"));
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("ছবিটি পড়া যায়নি"));
    reader.readAsDataURL(blob);
  });
}

export async function resizeToJpeg(
  file: File,
  opts: { maxSide: number; maxBytes: number },
): Promise<ResizedImage> {
  if (!file.type.startsWith("image/")) throw new Error("শুধু ছবি বেছে নিন");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error("ছবিটি পড়া যায়নি");
    let side = opts.maxSide;
    for (const quality of [0.85, 0.72, 0.6, 0.48, 0.36]) {
      const scale = Math.min(1, side / Math.max(w0, h0));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w0 * scale));
      canvas.height = Math.max(1, Math.round(h0 * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("ছবিটি প্রস্তুত করা যায়নি");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await toBlob(canvas, quality);
      if (blob && blob.size <= opts.maxBytes) {
        return { base64: await blobToBase64(blob), bytes: blob.size };
      }
      side = Math.round(side * 0.85);
    }
    throw new Error("ছবিটি অনেক বড় — একটু ছোট ছবি বেছে নিন");
  } finally {
    URL.revokeObjectURL(url);
  }
}
