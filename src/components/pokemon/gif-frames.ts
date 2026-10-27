/** A small animated-GIF reader: turns a GIF into ready-to-draw frames (full canvases) and their delays. */

export type GifFrames = { w: number; h: number; frames: HTMLCanvasElement[]; delays: number[]; total: number };

export function decodeGif(buf: ArrayBuffer): GifFrames {
  const d = new Uint8Array(buf);
  let p = 0;
  const u16 = () => (d[p++]! | (d[p++]! << 8));
  const head = String.fromCharCode(d[0]!, d[1]!, d[2]!);
  if (head !== "GIF") throw new Error("not a gif");
  p = 6;
  const W = u16();
  const H = u16();
  const flags = d[p++]!;
  const bgIndex = d[p++]!;
  p++; // aspect
  let gct: Uint8Array | null = null;
  if (flags & 0x80) {
    const n = 2 << (flags & 7);
    gct = d.subarray(p, p + n * 3);
    p += n * 3;
  }
  void bgIndex;
  const frames: HTMLCanvasElement[] = [];
  const delays: number[] = [];
  // the running picture, built up frame by frame as the file's disposal rules say
  const full = document.createElement("canvas");
  full.width = W;
  full.height = H;
  const fg = full.getContext("2d")!;
  let gce: { delay: number; trans: number; disposal: number } = { delay: 10, trans: -1, disposal: 0 };
  let prevSnap: ImageData | null = null;
  const skipBlocks = () => {
    while (p < d.length) {
      const n = d[p++]!;
      if (n === 0) break;
      p += n;
    }
  };
  while (p < d.length) {
    const b = d[p++]!;
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = d[p++]!;
      if (label === 0xf9) {
        p++; // block size (4)
        const pk = d[p++]!;
        const delay = u16();
        const trans = d[p++]!;
        p++; // terminator
        gce = { delay, trans: pk & 1 ? trans : -1, disposal: (pk >> 2) & 7 };
      } else skipBlocks();
      continue;
    }
    if (b !== 0x2c) continue;
    const fx = u16();
    const fy = u16();
    const fw = u16();
    const fh = u16();
    const fl = d[p++]!;
    let ct = gct;
    if (fl & 0x80) {
      const n = 2 << (fl & 7);
      ct = d.subarray(p, p + n * 3);
      p += n * 3;
    }
    const interlaced = !!(fl & 0x40);
    const minCode = d[p++]!;
    // gather the data sub-blocks
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (p < d.length) {
      const n = d[p++]!;
      if (n === 0) break;
      chunks.push(d.subarray(p, p + n));
      size += n;
      p += n;
    }
    const data = new Uint8Array(size);
    let o = 0;
    for (const c of chunks) {
      data.set(c, o);
      o += c.length;
    }
    const idx = lzw(data, minCode, fw * fh);
    if (gce.disposal === 3) prevSnap = fg.getImageData(0, 0, W, H);
    // paint this frame's pixels over the running picture
    const img = fg.getImageData(fx, fy, fw, fh);
    const px = img.data;
    const rows: number[] = [];
    if (interlaced) {
      for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]] as const) for (let r = start; r < fh; r += step) rows.push(r);
    } else for (let r = 0; r < fh; r++) rows.push(r);
    for (let i = 0; i < fh; i++) {
      const row = rows[i]!;
      for (let x = 0; x < fw; x++) {
        const ci = idx[i * fw + x]!;
        if (ci === gce.trans || !ct) continue;
        const q = (row * fw + x) * 4;
        px[q] = ct[ci * 3]!;
        px[q + 1] = ct[ci * 3 + 1]!;
        px[q + 2] = ct[ci * 3 + 2]!;
        px[q + 3] = 255;
      }
    }
    fg.putImageData(img, fx, fy);
    // keep a copy of the picture as this frame
    const snap = document.createElement("canvas");
    snap.width = W;
    snap.height = H;
    snap.getContext("2d")!.drawImage(full, 0, 0);
    frames.push(snap);
    delays.push(Math.max(0.03, (gce.delay || 10) / 100));
    // then get the canvas ready for the next frame
    if (gce.disposal === 2) fg.clearRect(fx, fy, fw, fh);
    else if (gce.disposal === 3 && prevSnap) fg.putImageData(prevSnap, 0, 0);
    gce = { delay: 10, trans: -1, disposal: 0 };
  }
  if (!frames.length) throw new Error("no frames");
  return { w: W, h: H, frames, delays, total: delays.reduce((a, b) => a + b, 0) };
}

function lzw(data: Uint8Array, minCode: number, count: number): Uint8Array {
  const out = new Uint8Array(count);
  const clear = 1 << minCode;
  const end = clear + 1;
  let size = minCode + 1;
  let next = end + 1;
  const prefix = new Int16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  for (let i = 0; i < clear; i++) suffix[i] = i;
  let bits = 0;
  let nb = 0;
  let di = 0;
  let o = 0;
  let prev = -1;
  let first = 0;
  while (o < count) {
    while (nb < size) {
      if (di >= data.length) return out;
      bits |= data[di++]! << nb;
      nb += 8;
    }
    const code = bits & ((1 << size) - 1);
    bits >>= size;
    nb -= size;
    if (code === clear) {
      size = minCode + 1;
      next = end + 1;
      prev = -1;
      continue;
    }
    if (code === end) break;
    if (prev === -1) {
      out[o++] = suffix[code]!;
      prev = code;
      first = code;
      continue;
    }
    let c = code;
    let sp = 0;
    if (code >= next) {
      stack[sp++] = first;
      c = prev;
    }
    while (c >= clear) {
      stack[sp++] = suffix[c]!;
      c = prefix[c]!;
    }
    first = suffix[c]!;
    stack[sp++] = first;
    if (next < 4096) {
      prefix[next] = prev;
      suffix[next] = first;
      next++;
      if (next === 1 << size && size < 12) size++;
    }
    prev = code;
    while (sp > 0 && o < count) out[o++] = stack[--sp]!;
  }
  return out;
}

/** The frame showing at a moment, looping. */
export function frameAt(g: GifFrames, time: number): { el: HTMLCanvasElement; i: number } {
  let t = g.total > 0 ? ((time % g.total) + g.total) % g.total : 0;
  for (let i = 0; i < g.frames.length; i++) {
    if (t < g.delays[i]!) return { el: g.frames[i]!, i };
    t -= g.delays[i]!;
  }
  return { el: g.frames[0]!, i: 0 };
}
