import { useEffect, useState } from "react";
import { useReaderStore } from "@/lib/reader-store";

export function WarningGate() {
  const warned = useReaderStore((s) => s.warned);
  const setWarned = useReaderStore((s) => s.setWarned);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useReaderStore.persist.onFinishHydration(() => setHydrated(true));
    if (useReaderStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  if (!hydrated || warned) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-bg/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-soft">
        <p className="font-sans text-xs tracking-widest text-lamp">সতর্কবার্তা</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">প্রাপ্তবয়স্ক পাঠ</h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          এই বইয়ে প্রাপ্তবয়স্কদের জন্য সংবেদনশীল দৃশ্য আছে। সেগুলো ডিফল্টে লুকানো থাকে। চাইলে
          এক ক্লিকে সব দেখান — তখন লেখা লাল রঙে আসবে। কোনো অংশ কাটা হয়নি।
        </p>
        <button
          type="button"
          onClick={setWarned}
          className="pressable mt-6 h-12 w-full rounded-lg bg-accent font-sans text-sm font-medium text-accent-fg"
        >
          বুঝেছি, পড়ব
        </button>
      </div>
    </div>
  );
}
