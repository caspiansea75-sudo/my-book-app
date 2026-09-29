import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Check, Pencil, PenLine, X } from "lucide-react";
import { setAuthor } from "@/lib/author-api";
import { cn } from "@/lib/utils";

/** "লেখক: name" with an inline edit for whoever may change it. */
export function AuthorLine({
  kind,
  slug,
  author,
  canEdit,
  className,
}: {
  kind: "book" | "manga";
  slug: string;
  author: string;
  canEdit: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(author);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!author && !canEdit) return null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await setAuthor({ data: { kind, slug, author: value } });
      setEditing(false);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সংরক্ষণ হয়নি");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className={cn("mt-3", className)}>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={value}
            maxLength={80}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="লেখকের নাম"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-lamp sm:max-w-64"
          />
          <button type="button" disabled={busy} onClick={() => void save()} aria-label="সংরক্ষণ" className="pressable grid size-10 place-items-center rounded-full bg-accent text-accent-fg disabled:opacity-60">
            <Check className="size-4" />
          </button>
          <button type="button" onClick={() => setEditing(false)} aria-label="বাতিল" className="pressable grid size-10 place-items-center rounded-full border border-border text-muted">
            <X className="size-4" />
          </button>
        </div>
        {error ? <p role="alert" className="mt-2 font-sans text-xs text-nsfw">{error}</p> : null}
      </div>
    );
  }

  return (
    <p className={cn("mt-3 flex items-center gap-2 font-sans text-sm text-muted", className)}>
      <PenLine className="size-4 shrink-0 text-lamp" strokeWidth={1.6} />
      {author ? <span>লেখক: <span className="text-fg">{author}</span></span> : <span className="text-subtle">লেখকের নাম যোগ করুন</span>}
      {canEdit ? (
        <button type="button" onClick={() => { setValue(author); setEditing(true); }} aria-label="লেখকের নাম বদলান" title="লেখকের নাম বদলান" className="pressable grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
          <Pencil className="size-3.5" />
        </button>
      ) : null}
    </p>
  );
}
