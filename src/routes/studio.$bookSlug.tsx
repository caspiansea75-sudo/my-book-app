import { useState, type FormEvent } from "react";
import { Link, createFileRoute, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ImagePlus, Plus } from "lucide-react";
import { CoverArt } from "@/components/book/cover-art";
import { SiteNav } from "@/components/book/site-nav";
import { MediaUploader } from "@/components/studio/media-uploader";
import { formatCount } from "@/lib/book";
import {
  deleteStudioBook,
  listMedia,
  resolveBook,
  setBookCover,
  updateBook,
} from "@/lib/library-api";

export const Route = createFileRoute("/studio/$bookSlug")({
  loader: async ({ params }) => {
    const book = await resolveBook({ data: { slug: params.bookSlug } });
    if (!book) throw notFound();
    const media = await listMedia();
    return { book, media };
  },
  component: StudioBookPage,
});

function StudioBookPage() {
  const { book, media } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const canon = book.origin !== "studio";
  const [title, setTitle] = useState(book.title);
  const [titleEn, setTitleEn] = useState(book.titleEn);
  const [author, setAuthor] = useState(book.author);
  const [tagline, setTagline] = useState(book.tagline);
  const [description, setDescription] = useState(book.description);
  const [busy, setBusy] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    if (canon) return;
    setBusy(true);
    setError(null);
    try {
      await updateBook({
        data: {
          slug: book.slug,
          title,
          titleEn,
          author,
          tagline,
          description,
        },
      });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  async function pickCover(id: number) {
    await setBookCover({ data: { slug: book.slug, mediaId: id } });
    setCoverOpen(false);
    await router.invalidate();
  }

  async function remove() {
    if (canon) return;
    if (!window.confirm("এই বই মুছে ফেলবেন?")) return;
    await deleteStudioBook({ data: { slug: book.slug } });
    await navigate({ to: "/studio" });
  }

  return (
    <main className="relative min-h-dvh">
      <SiteNav active="studio" />
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <Link to="/studio" className="pressable inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
          <ChevronLeft className="size-3.5" />
          স্টুডিও
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <CoverArt
              title={book.title}
              tagline={book.tagline}
              coverUrl={book.coverUrl}
              slug={book.slug}
              className="aspect-[3/4] w-full rounded-xl"
            />
            <button
              type="button"
              onClick={() => setCoverOpen((v) => !v)}
              className="pressable mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border font-sans text-sm text-fg"
            >
              <ImagePlus className="size-4" />
              প্রচ্ছদ
            </button>
          </div>

          <div>
            <p className="font-sans text-xs tracking-widest text-lamp">
              {canon ? "মূল সংগ্রহ" : "স্টুডিও বই"}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{book.title}</h1>
            <p className="mt-2 font-sans text-sm text-muted">
              {formatCount(book.chapterCount)} অধ্যায়
            </p>

            {canon ? (
              <p className="mt-5 rounded-lg border border-border bg-surface px-4 py-3 font-sans text-sm text-muted">
                এই বইয়ের লেখা অপরিবর্তিত। প্রচ্ছদ বদলান, আর যেকোনো অধ্যায়ে ছবি বা ভিডিও বসান।
              </p>
            ) : (
              <form onSubmit={(e) => void saveMeta(e)} className="mt-6 space-y-3">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" />
                <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="field-input" />
                <input value={author} onChange={(e) => setAuthor(e.target.value)} className="field-input" placeholder="লেখক" />
                <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="field-input" />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="field-input"
                />
                {error ? <p className="font-sans text-sm text-nsfw">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="pressable h-11 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg"
                  >
                    সংরক্ষণ
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove()}
                    className="pressable h-11 rounded-lg border border-border px-4 font-sans text-sm text-nsfw"
                  >
                    বই মুছুন
                  </button>
                </div>
              </form>
            )}

            {coverOpen ? (
              <div className="mt-6 rounded-xl border border-border bg-surface p-4">
                <p className="mb-3 font-display">প্রচ্ছদের ছবি</p>
                <MediaUploader compact onUploaded={(id) => void pickCover(id)} />
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {media
                    .filter((m) => m.kind === "image")
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void pickCover(item.id)}
                        className="pressable overflow-hidden rounded-md border border-border"
                      >
                        <img src={item.thumbSrc || item.src} alt="" className="aspect-square w-full object-cover" />
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-12 flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl">অধ্যায়</h2>
          {!canon ? (
            <Link
              to="/studio/$bookSlug/$slug"
              params={{ bookSlug: book.slug, slug: "new" }}
              className="pressable inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg"
            >
              <Plus className="size-4" />
              নতুন অধ্যায়
            </Link>
          ) : null}
        </div>

        <ol className="mt-5 grid gap-2">
          {book.chapters.map((ch) => (
            <li key={ch.slug}>
              <Link
                to="/studio/$bookSlug/$slug"
                params={{ bookSlug: book.slug, slug: ch.slug }}
                className="pressable flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 hover:bg-surface-2"
              >
                <span>
                  <span className="block font-display text-base">{ch.title}</span>
                  <span className="mt-1 block font-sans text-xs text-muted">{ch.excerpt}</span>
                </span>
                <span className="shrink-0 font-sans text-xs text-lamp">
                  {canon ? "ছবি যোগ" : "সম্পাদনা"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
