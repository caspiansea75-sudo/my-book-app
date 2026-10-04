import { useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Download, PenLine, Trash2 } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { SiteNav } from "@/components/book/site-nav";
import { FxAurora, FxWords, fxIndex } from "@/components/media/fx";
import { TrashDialog } from "@/components/studio/trash-dialog";
import { createBook, listLibrary } from "@/lib/library-api";
import { canEditOwner, useMe } from "@/lib/use-me";

export const Route = createFileRoute("/studio/")({
  loader: () => listLibrary(),
  component: StudioHome,
});

function StudioHome() {
  const me = useMe();
  const books = Route.useLoaderData().filter((b) => canEditOwner(me, b.ownerId));
  const navigate = useNavigate();
  const router = useRouter();
  const [trashOpen, setTrashOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await createBook({
        data: { title, titleEn, tagline, description },
      });
      await navigate({ to: "/studio/$bookSlug", params: { bookSlug: result.slug } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "তৈরি হয়নি");
      setBusy(false);
    }
  }

  return (
    <main className="mf-page relative min-h-dvh">
      <FxAurora />
      <SiteNav active="studio" />
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <p className="mf-eyebrow flex items-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
          <PenLine className="size-4" strokeWidth={1.6} />
          সম্পাদনা কক্ষ
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl"><FxWords text="স্টুডিও" /></h1>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted">
          নতুন বই লিখুন, প্রচ্ছদ বেছে নিন, অধ্যায়ে ছবি ও ভিডিও বসান। সবকিছু সাইটেই নিরাপদে সংরক্ষিত থাকে।
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            className="pressable inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 font-sans text-sm text-fg hover:bg-surface-2"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
            ট্রাশ
          </button>
          {me?.role === "admin" ? (
            <>
              <a
                href="/api/backup"
                download
                title="সব লেখা, ছবি ও ভিডিওসহ পুরো ডাটাবেস একটি ফাইলে (বড় হতে পারে)"
                className="pressable inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 font-sans text-sm text-fg hover:bg-surface-2"
              >
                <Download className="size-4" strokeWidth={1.75} />
                ব্যাকআপ (সবকিছু)
              </a>
              <a
                href="/api/backup?media=0"
                download
                title="ছবি ও ভিডিও ছাড়া শুধু লেখা, মন্তব্য, চ্যাট — ছোট ও দ্রুত"
                className="pressable inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 font-sans text-sm text-fg hover:bg-surface-2"
              >
                <Download className="size-4" strokeWidth={1.75} />
                ব্যাকআপ (শুধু লেখা)
              </a>
            </>
          ) : null}
        </div>

        <form
          onSubmit={(e) => void onCreate(e)}
          className="mt-10 rounded-xl border border-border bg-surface p-5 sm:p-6"
        >
          <h2 className="font-display text-xl">নতুন বই</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block font-sans text-xs text-muted">শিরোনাম</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="field-input"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-sans text-xs text-muted">English title (slug-এর জন্য)</span>
              <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="field-input" />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block font-sans text-xs text-muted">ট্যাগলাইন</span>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="field-input" />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block font-sans text-xs text-muted">পরিচিতি</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="field-input"
            />
          </label>
          {error ? <p className="mt-3 font-sans text-sm text-nsfw">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="pressable mt-5 inline-flex h-12 items-center rounded-lg bg-accent px-5 font-sans text-sm text-accent-fg disabled:opacity-50"
          >
            {busy ? "তৈরি হচ্ছে…" : "বই খুলুন"}
          </button>
        </form>

        <h2 className="mt-14 font-display text-2xl">বইসমূহ</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {books.map((book, i) => (
            <Link
              key={book.slug}
              to="/studio/$bookSlug"
              params={{ bookSlug: book.slug }}
              className="mf-card mf-rise pressable flex gap-4 overflow-hidden rounded-xl border border-border bg-surface p-3 hover:bg-surface-2"
              style={fxIndex(i)}
            >
              <CoverArt
                title={book.title}
                tagline={book.tagline}
                coverUrl={book.coverUrl}
                slug={book.slug}
                className="h-28 w-24 shrink-0 rounded-lg"
              />
              <span className="min-w-0 py-1">
                <span className="block font-sans text-xs text-lamp">
                  {book.origin === "studio" ? "স্টুডিও বই" : "মূল সংগ্রহ"}
                </span>
                <span className="mt-1 block font-display text-lg">{book.title}</span>
                <span className="mt-1 block font-sans text-xs text-muted">
                  {book.origin === "studio" ? "লেখা ও মিডিয়া সম্পাদনা" : "প্রচ্ছদ ও ছবি যোগ করুন"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      {trashOpen ? <TrashDialog onClose={() => setTrashOpen(false)} onChanged={() => void router.invalidate()} /> : null}
    </main>
  );
}