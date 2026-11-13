import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
import { installState, promptInstall, startInstallCapture, subscribeInstall } from "@/lib/pwa-install";

/** Profile section: put the site on the phone / computer as an app called BookofCaspi. */
export function InstallAppSection() {
  const [st, setSt] = useState({ canPrompt: false, installed: false, ios: false });
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    startInstallCapture();
    const read = () => setSt(installState());
    read();
    return subscribeInstall(read);
  }, []);

  async function go() {
    setBusy(true);
    try {
      await promptInstall();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-5 pb-10 sm:px-8">
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <img src="/api/pwa/icon-192.png" alt="" width={56} height={56} className="size-14 rounded-xl" />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold">BookofCaspi অ্যাপ</h2>
            <p className="font-sans text-sm text-muted">ফোন বা কম্পিউটারে অ্যাপের মতো ইনস্টল করুন — হোম স্ক্রিন থেকে এক ট্যাপে খুলুন।</p>
          </div>
        </div>
        <div className="mt-4">
          {st.installed ? (
            <p className="flex items-center gap-2 font-sans text-sm text-lamp">
              <Check className="size-4" strokeWidth={2} />
              অ্যাপটি ইনস্টল করা আছে
            </p>
          ) : st.canPrompt ? (
            <button type="button" onClick={() => void go()} disabled={busy} className="pressable inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg disabled:opacity-50">
              <Download className="size-4" strokeWidth={1.75} />
              {busy ? "অপেক্ষা করুন…" : "অ্যাপ ইনস্টল করুন"}
            </button>
          ) : (
            <div>
              <button type="button" onClick={() => setAsked(true)} className="pressable inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg">
                <Download className="size-4" strokeWidth={1.75} />
                অ্যাপ ইনস্টল করুন
              </button>
              {asked ? (
                <p className="mt-3 font-sans text-sm text-muted">
                  {st.ios
                    ? "আইফোনে: Safari-তে নিচের শেয়ার বোতাম (⬆︎) চেপে “Add to Home Screen” বা “হোম স্ক্রিনে যোগ করুন” বেছে নিন।"
                    : "ব্রাউজারের মেনু (⋮) খুলে “Install app” বা “অ্যাপ ইনস্টল করুন” (কখনো “Add to Home screen”) বেছে নিন। বিকল্পটি না দেখালে সাইটটি Chrome বা Edge-এ খুলুন।"}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
