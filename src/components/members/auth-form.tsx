import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { LogIn, UserPlus } from "lucide-react";
import { FxAurora, FxWords } from "@/components/media/fx";
import { login, signup } from "@/lib/members-api";

const input =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 font-sans text-sm text-fg outline-none placeholder:text-subtle focus:border-lamp";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isLogin) await login({ data: { username, password } });
      else await signup({ data: { username, password, displayName: displayName || undefined } });
      await router.invalidate();
      await router.navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "কাজটি হয়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mf-page relative grid min-h-dvh place-items-center px-5 py-12">
      <FxAurora />
      <div className="w-full max-w-sm">
        <p className="mf-eyebrow mx-auto flex items-center justify-center gap-2 font-sans text-xs tracking-[0.22em] text-lamp">
          {isLogin ? <LogIn className="size-4" strokeWidth={1.6} /> : <UserPlus className="size-4" strokeWidth={1.6} />}
          গল্প সংগ্রহ
        </p>
        <h1 className="mt-5 text-center font-display text-4xl font-semibold [&>.mf-word:last-child]:mr-0">
          <FxWords text={isLogin ? "লগইন" : "নতুন সদস্য"} />
        </h1>
        <form onSubmit={submit} className="mt-8 space-y-3">
          <label className="block">
            <span className="sr-only">ইউজারনেম</span>
            <input
              className={input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ইউজারনেম (ইংরেজি)"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </label>
          {!isLogin ? (
            <label className="block">
              <span className="sr-only">নাম</span>
              <input
                className={input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="আপনার নাম (ঐচ্ছিক)"
                maxLength={40}
              />
            </label>
          ) : null}
          <label className="block">
            <span className="sr-only">পাসওয়ার্ড</span>
            <input
              className={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? "পাসওয়ার্ড" : "পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
            />
          </label>
          {error ? (
            <p role="alert" className="font-sans text-sm text-nsfw">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="pressable h-11 w-full rounded-lg bg-accent font-sans text-sm text-accent-fg disabled:opacity-60"
          >
            {busy ? "একটু অপেক্ষা…" : isLogin ? "লগইন" : "অ্যাকাউন্ট খুলুন"}
          </button>
        </form>
        <p className="mt-5 text-center font-sans text-sm text-muted">
          {isLogin ? (
            <>
              নতুন?{" "}
              <Link to="/signup" className="text-lamp underline-offset-4 hover:underline">
                সদস্য হোন
              </Link>
            </>
          ) : (
            <>
              আগে থেকেই সদস্য?{" "}
              <Link to="/login" className="text-lamp underline-offset-4 hover:underline">
                লগইন করুন
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
