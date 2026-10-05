import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { LangSwitch } from "@/components/i18n/lang-switch";
import { LoginWindow } from "@/components/members/login-window";
import { continueAsGuest, login, signup } from "@/lib/members-api";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const stage = useRef<HTMLElement | null>(null);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The window leans a little towards the pointer and the site behind it drifts the other way.
  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse" || reducedMotion()) return;
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = stage.current;
      if (!el) return;
      el.style.setProperty("--ls-ry", `${(x * 3.5).toFixed(2)}deg`);
      el.style.setProperty("--ls-rx", `${(-y * 3).toFixed(2)}deg`);
      el.style.setProperty("--ls-px", x.toFixed(3));
      el.style.setProperty("--ls-py", y.toFixed(3));
    });
  }
  function onPointerLeave() {
    const el = stage.current;
    if (!el) return;
    for (const [k, v] of [["--ls-rx", "0deg"], ["--ls-ry", "0deg"], ["--ls-px", "0"], ["--ls-py", "0"]]) el.style.setProperty(k, v);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isLogin) await login({ data: { username, password } });
      else await signup({ data: { username, password, displayName: displayName || undefined } });
      // Let the glass lift away and the site come into focus before we go there.
      setLeaving(true);
      if (!reducedMotion()) await new Promise((r) => setTimeout(r, 520));
      await router.invalidate();
      await router.navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "কাজটি হয়নি");
      setLeaving(false);
      setBusy(false);
      setShake(true);
      setTimeout(() => setShake(false), 460);
    }
  }

  async function enterAsGuest() {
    setGuestBusy(true);
    setError(null);
    try {
      await continueAsGuest();
      setLeaving(true);
      if (!reducedMotion()) await new Promise((r) => setTimeout(r, 520));
      await router.invalidate();
      await router.navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "কাজটি হয়নি");
      setLeaving(false);
      setGuestBusy(false);
    }
  }

  return (
    <LoginWindow
      mode={mode}
      username={username}
      password={password}
      displayName={displayName}
      showPassword={showPassword}
      error={error}
      busy={busy}
      shake={shake}
      leaving={leaving}
      stageRef={stage}
      langSlot={<LangSwitch />}
      switcher={
        <>
          <Link to="/login" aria-current={isLogin ? "page" : undefined}>
            লগইন
          </Link>
          <Link to="/signup" aria-current={!isLogin ? "page" : undefined}>
            নতুন সদস্য
          </Link>
        </>
      }
      onUsername={setUsername}
      onPassword={setPassword}
      onDisplayName={setDisplayName}
      onTogglePassword={() => setShowPassword((v) => !v)}
      onSubmit={(e) => void submit(e)}
      onGuest={() => void enterAsGuest()}
      guestBusy={guestBusy}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    />
  );
}
