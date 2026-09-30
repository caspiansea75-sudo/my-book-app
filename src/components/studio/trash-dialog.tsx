import { useCallback, useEffect, useState } from "react";
import { BookOpen, FileText, Image as ImageIcon, RotateCcw, Trash2, X } from "lucide-react";
import { listTrash, purgeTrash, restoreTrash, type TrashItem } from "@/lib/library-api";
import { cn } from "@/lib/utils";

type Filter = "all" | TrashItem["kind"];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "সব" },
  { id: "book", label: "বই" },
  { id: "chapter", label: "অধ্যায়" },
  { id: "media", label: "ছবি ও ভিডিও" },
];

const KIND_LABEL: Record<TrashItem["kind"], string> = { book: "বই", chapter: "অধ্যায়", media: "মিডিয়া" };

/** Everything that was deleted, with a way back. Restoring puts it exactly where it was. */
export function TrashDialog({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listTrash());
    } catch (err) {
      setError(err instanceof Error ? err.message : "ট্রাশ খোলা যায়নি");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function act(item: TrashItem, what: "restore" | "purge") {
    if (what === "purge" && !window.confirm(`“${item.title}” স্থায়ীভাবে মুছবেন? এটি আর ফেরত আসবে না।`)) return;
    const key = `${item.kind}:${item.id}`;
    setBusyKey(key);
    setError(null);
    try {
      if (what === "restore") await restoreTrash({ data: { kind: item.kind, id: item.id } });
      else await purgeTrash({ data: { kind: item.kind, id: item.id } });
      setItems((list) => (list ? list.filter((i) => !(i.kind === item.kind && i.id === item.id)) : list));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "কাজটি হয়নি");
    } finally {
      setBusyKey(null);
    }
  }

  const shown = (items ?? []).filter((i) => filter === "all" || i.kind === filter);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="ট্রাশ">
      <button
        type="button"
        aria-label="বন্ধ"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div className="relative flex max-h-[85dvh] w-full max-w-xl flex-col rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">ট্রাশ</h2>
            <p className="mt-1 font-sans text-xs leading-relaxed text-muted">
              মুছে ফেলা জিনিস এখানে জমা থাকে। ফেরত আনলে আগের মতোই ফিরে আসে।
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ"
            className="pressable grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "pressable h-8 rounded-full px-3 font-sans text-xs",
                filter === f.id ? "bg-accent text-accent-fg" : "border border-border text-muted hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 font-sans text-xs text-nsfw">{error}</p> : null}

        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {items == null ? <p className="py-8 text-center font-sans text-sm text-muted">লোড হচ্ছে…</p> : null}
          {items != null && shown.length === 0 ? (
            <p className="py-8 text-center font-sans text-sm text-muted">ট্রাশ খালি।</p>
          ) : null}
          {shown.map((item) => {
            const key = `${item.kind}:${item.id}`;
            const Icon = item.kind === "book" ? BookOpen : item.kind === "chapter" ? FileText : ImageIcon;
            return (
              <div key={key} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-2.5">
                {item.thumbSrc ? (
                  <img src={item.thumbSrc} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-md bg-surface text-lamp">
                    <Icon className="size-5" strokeWidth={1.6} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm">{item.title}</p>
                  <p className="truncate font-sans text-[11px] text-muted">
                    {KIND_LABEL[item.kind]}
                    {item.sub ? ` · ${item.sub}` : ""}
                  </p>
                  <p className="font-sans text-[11px] text-subtle">{new Date(item.deletedAt).toLocaleString("bn-BD")}</p>
                </div>
                <button
                  type="button"
                  disabled={busyKey === key}
                  onClick={() => void act(item, "restore")}
                  className="pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 font-sans text-xs text-accent-fg disabled:opacity-50"
                >
                  <RotateCcw className="size-3.5" />
                  ফেরত আনুন
                </button>
                <button
                  type="button"
                  disabled={busyKey === key}
                  onClick={() => void act(item, "purge")}
                  aria-label="স্থায়ীভাবে মুছুন"
                  title="স্থায়ীভাবে মুছুন"
                  className="pressable grid size-9 shrink-0 place-items-center rounded-lg border border-border text-nsfw disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
