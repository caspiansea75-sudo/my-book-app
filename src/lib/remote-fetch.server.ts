/**
 * Fetches a web address on behalf of a signed-in member (to read a page, or to copy a picture).
 * Because the server is the one making the request, it must never be tricked into reaching internal
 * addresses (the server's own network, cloud metadata, localhost…). So:
 *   - only http / https on the normal ports,
 *   - every address the name resolves to is checked at connection time (also after each redirect),
 *   - redirects are followed by hand (at most 4) and re-checked,
 *   - hard limits on size and time.
 */
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

export type RemoteErrorCode = "bad-url" | "blocked" | "timeout" | "too-large" | "bad-status" | "bad-type" | "network";
export class RemoteError extends Error {
  code: RemoteErrorCode;
  status?: number;
  constructor(code: RemoteErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** True for addresses that must never be reached: loopback, private, link-local, carrier-grade NAT, multicast, reserved. */
export function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return isPrivateV4(ip.split(".").map(Number));
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s) ?? /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return isPrivateV4(mapped[1].split(".").map(Number));
    const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(s);
    if (hexMapped) {
      const a = parseInt(hexMapped[1], 16);
      const b = parseInt(hexMapped[2], 16);
      return isPrivateV4([a >> 8, a & 255, b >> 8, b & 255]);
    }
    const first = parseInt(s.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if (s.startsWith("2001:db8")) return true; // documentation
    return false;
  }
  return true; // not an address at all: refuse
}
function isPrivateV4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 169 && b === 254) return true; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast and reserved
  return false;
}

export type GetOptions = {
  /** the largest response body we will read, in bytes */
  maxBytes: number;
  timeoutMs?: number;
  accept?: string;
  referer?: string;
  /** only for tests that talk to a local server; never set from a request */
  allowPrivate?: boolean;
  maxRedirects?: number;
};
export type GetResult = { status: number; contentType: string; body: Buffer; finalUrl: string };

function checkedLookup(allowPrivate: boolean) {
  return (hostname: string, options: dns.LookupOptions, cb: (...args: unknown[]) => void) => {
    dns.lookup(hostname, { ...options, all: true, verbatim: true }, (err, addrs) => {
      if (err) return cb(err);
      const ok = (addrs as dns.LookupAddress[]).filter((a) => allowPrivate || !isPrivateIp(a.address));
      if (!ok.length) return cb(new RemoteError("blocked", "address not allowed"));
      if (options.all) return cb(null, ok);
      cb(null, ok[0].address, ok[0].family);
    });
  };
}

function once(url: URL, opt: Required<Pick<GetOptions, "maxBytes" | "timeoutMs">> & GetOptions): Promise<GetResult & { redirect?: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const headers: Record<string, string> = {
      "user-agent": "Mozilla/5.0 (compatible; StoryImporter/1.0)",
      accept: opt.accept ?? "*/*",
      "accept-encoding": "gzip, deflate, br",
    };
    if (opt.referer) headers.referer = opt.referer;
    const req = lib.request(
      url,
      { method: "GET", headers, lookup: checkedLookup(!!opt.allowPrivate) as never, timeout: opt.timeoutMs },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, contentType, body: Buffer.alloc(0), finalUrl: url.toString(), redirect: String(res.headers.location) });
        }
        const declared = Number(res.headers["content-length"]);
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        if (!enc && Number.isFinite(declared) && declared > opt.maxBytes) {
          req.destroy();
          return reject(new RemoteError("too-large", "file is too large"));
        }
        let stream: NodeJS.ReadableStream = res;
        if (enc === "gzip" || enc === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
        else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
        const chunks: Buffer[] = [];
        let total = 0;
        stream.on("data", (c: Buffer) => {
          total += c.length;
          if (total > opt.maxBytes) {
            req.destroy();
            reject(new RemoteError("too-large", "file is too large"));
            return;
          }
          chunks.push(c);
        });
        stream.on("end", () => resolve({ status, contentType, body: Buffer.concat(chunks), finalUrl: url.toString() }));
        stream.on("error", () => reject(new RemoteError("network", "could not read the response")));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new RemoteError("timeout", "the site took too long"));
    });
    req.on("error", (e) => reject(e instanceof RemoteError ? e : (e as { cause?: unknown }).cause instanceof RemoteError ? (e as { cause: RemoteError }).cause : new RemoteError(/not allowed/.test(String(e.message)) ? "blocked" : "network", String(e.message))));
    req.end();
  });
}

export function parseWebUrl(raw: string, anyPort = false): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new RemoteError("bad-url", "not a web address");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new RemoteError("bad-url", "only http and https addresses work");
  if (u.username || u.password) throw new RemoteError("bad-url", "addresses with a login in them are not allowed");
  const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
  if (!anyPort && port !== 80 && port !== 443 && port !== 8080 && port !== 8443) throw new RemoteError("blocked", "that port is not allowed");
  return u;
}

export async function safeGet(rawUrl: string, options: GetOptions): Promise<GetResult> {
  const opt = { timeoutMs: 9000, ...options };
  let url = parseWebUrl(rawUrl, opt.allowPrivate);
  const maxRedirects = options.maxRedirects ?? 4;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    // An address typed as numbers never goes through name lookup, so check it here.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (!opt.allowPrivate && net.isIP(host) && isPrivateIp(host)) throw new RemoteError("blocked", "address not allowed");
    if (!opt.allowPrivate && /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) throw new RemoteError("blocked", "address not allowed");
    const r = await once(url, opt);
    if (r.redirect) {
      url = parseWebUrl(new URL(r.redirect, url).toString(), opt.allowPrivate);
      continue;
    }
    if (r.status < 200 || r.status >= 300) throw new RemoteError("bad-status", `the site answered ${r.status}`, r.status);
    return r;
  }
  throw new RemoteError("network", "too many redirects");
}

/** A page's text, decoded from its declared (or UTF-8) character set. */
export function decodeBody(body: Buffer, contentType: string): string {
  const cs = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 2048).toString("latin1"))?.[1] ?? "utf-8";
  try {
    return new TextDecoder(cs).decode(body);
  } catch {
    return body.toString("utf8");
  }
}

const SNIFF: [string, number[]][] = [
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38]],
  ["image/bmp", [0x42, 0x4d]],
];
/** What kind of picture these bytes really are (don't trust the server's label). */
export function sniffImage(b: Buffer): string | null {
  for (const [mime, sig] of SNIFF) if (sig.every((v, i) => b[i] === v)) return mime;
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (b.length > 12 && b.subarray(4, 8).toString("latin1") === "ftyp" && /avif|avis/.test(b.subarray(8, 12).toString("latin1"))) return "image/avif";
  return null;
}
