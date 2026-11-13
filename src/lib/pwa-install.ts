/**
 * Installing the site as an app. Browsers that can do it fire `beforeinstallprompt` once, early; it is kept here
 * so the profile page can offer a button later. (iPhone and some browsers never fire it: they get written steps.)
 */
type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let saved: Prompt | null = null;
let installed = false;
let started = false;
const subs = new Set<() => void>();
const tell = () => subs.forEach((f) => f());

export function startInstallCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    saved = e as Prompt;
    tell();
  });
  window.addEventListener("appinstalled", () => {
    saved = null;
    installed = true;
    tell();
  });
}

export function isRunningAsApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function installState() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return {
    canPrompt: !!saved,
    installed: installed || isRunningAsApp(),
    ios: /iphone|ipad|ipod/i.test(ua),
  };
}

export function subscribeInstall(fn: () => void) {
  subs.add(fn);
  return () => void subs.delete(fn);
}

/** Opens the browser's own install dialog. Returns true when the person accepted it. */
export async function promptInstall(): Promise<boolean> {
  if (!saved) return false;
  const p = saved;
  saved = null;
  await p.prompt();
  const { outcome } = await p.userChoice;
  tell();
  return outcome === "accepted";
}
