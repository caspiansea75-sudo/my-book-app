/** Small helpers for importing many pictures at once. */

/**
 * Runs `worker` over `items` a few at a time and keeps the results in the original order.
 * A failed item gives `undefined` and is reported through `onError`, so one bad picture never stops the rest.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  hooks: { onDone?: (done: number, total: number) => void; onError?: (index: number, error: unknown) => void } = {},
): Promise<(R | undefined)[]> {
  const out: (R | undefined)[] = new Array(items.length).fill(undefined);
  let next = 0;
  let done = 0;
  async function run() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await worker(items[i], i);
      } catch (e) {
        hooks.onError?.(i, e);
      }
      done++;
      hooks.onDone?.(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

export function base64ToFile(base64: string, name: string, mime: string): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}
