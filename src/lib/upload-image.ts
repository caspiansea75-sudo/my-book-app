import { prepareImageUpload } from "@/lib/compress";
import { createMedia } from "@/lib/library-api";

/** Stores one picture the same way a normal upload does (shrunk, with a thumbnail) and returns its id. */
export async function uploadImageFile(file: File): Promise<number> {
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

/** Adds a picture that stays on another site (only its address is kept) and returns its id. */
export async function addImageLink(url: string): Promise<number> {
  const result = await createMedia({ data: { kind: "image", title: "", mime: "image/url", source: "url", url } });
  return result.id;
}
