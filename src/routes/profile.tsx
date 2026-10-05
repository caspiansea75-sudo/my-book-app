import { useRef, useState, type FormEvent } from "react";
import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Camera, Eye, Trash2 } from "lucide-react";
import { SiteNav } from "@/components/book/site-nav";
import { Avatar } from "@/components/members/avatar";
import { FxAurora, FxWords } from "@/components/media/fx";
import { resizeToJpeg } from "@/lib/image-resize";
import { redirectGuest } from "@/lib/auth/guest";
import { getProfile, removeAvatar, setAvatar, updateProfile, uploadChatImage } from "@/lib/social-api";

export const Route = createFileRoute("/profile")({
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: "/login" });
    redirectGuest(context.me, "profile");
  },
  loader: async ({ context }) => {
    const profile = await getProfile({ data: { username: context.me!.username } });
    if (!profile) throw redirect({ to: "/login" });
    return profile;
  },
  component: ProfilePage,
});

function ProfilePage() {
  const profile = Route.useLoaderData();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ data: { displayName, bio } });
      await router.invalidate();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "সংরক্ষণ হয়নি");
    } finally {
      setBusy(false);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const img = await resizeToJpeg(file, { maxSide: 384, maxBytes: 150 * 1024 });
      const up = await uploadChatImage({ data: { base64: img.base64, purpose: "avatar" } });
      const res = await setAvatar({ data: { imageId: up.id } });
      setAvatarUrl(res.url);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ছবি বদলানো যায়নি");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onRemove() {
    setPhotoBusy(true);
    setError(null);
    try {
      await removeAvatar();
      setAvatarUrl(null);
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ছবি সরানো যায়নি");
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <main className="mf-page relative min-h-dvh">
      <FxAurora />
      <SiteNav active="profile" />
      <section className="mx-auto max-w-xl px-5 py-12 sm:px-8">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          <FxWords text="আমার প্রোফাইল" />
        </h1>
        <p className="mt-2 font-sans text-sm text-muted">@{profile.username}</p>

        <div className="mt-8 flex items-center gap-5">
          <Avatar name={displayName || profile.displayName} url={avatarUrl} size={96} />
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPick(e)} />
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => fileRef.current?.click()}
              className="pressable inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 font-sans text-sm text-fg disabled:opacity-50"
            >
              <Camera className="size-4" strokeWidth={1.75} />
              {photoBusy ? "অপেক্ষা করুন…" : avatarUrl ? "ছবি বদলান" : "ছবি দিন"}
            </button>
            {avatarUrl ? (
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => void onRemove()}
                className="pressable inline-flex h-9 items-center gap-2 rounded-lg px-3 font-sans text-xs text-muted hover:text-fg disabled:opacity-50"
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} />
                ছবি সরান
              </button>
            ) : null}
          </div>
        </div>

        <form onSubmit={(e) => void save(e)} className="mt-8 space-y-4">
          <label className="block">
            <span className="font-sans text-xs text-muted">নাম</span>
            <input
              className="field-input mt-1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              required
            />
          </label>
          <label className="block">
            <span className="font-sans text-xs text-muted">নিজের সম্পর্কে ({bio.length}/300)</span>
            <textarea
              className="field-input mt-1 min-h-28 resize-y"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              placeholder="দু-এক লাইনে নিজের কথা লিখুন"
            />
          </label>
          {error ? (
            <p role="alert" className="font-sans text-sm text-nsfw">
              {error}
            </p>
          ) : null}
          {saved ? <p className="font-sans text-sm text-lamp">সংরক্ষিত হয়েছে</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || !displayName.trim()}
              className="pressable h-11 rounded-lg bg-accent px-6 font-sans text-sm text-accent-fg disabled:opacity-50"
            >
              {busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
            </button>
            <Link
              to="/u/$username"
              params={{ username: profile.username }}
              className="pressable inline-flex h-11 items-center gap-2 rounded-lg px-3 font-sans text-sm text-muted hover:text-fg"
            >
              <Eye className="size-4" strokeWidth={1.75} />
              অন্যরা যেভাবে দেখে
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
