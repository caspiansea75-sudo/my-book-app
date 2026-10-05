import type { CSSProperties, FormEvent, ReactNode, RefObject } from "react";
import { ArrowRight, BookOpen, Eye, EyeOff, Loader2, Lock, LogIn, ShieldCheck, Smile, User, UserPlus, UserRound } from "lucide-react";
import { FxWords } from "@/components/media/fx";
import { LoginBackdrop } from "@/components/members/login-backdrop";
import "@/components/members/login-stage.css";

export type LoginWindowProps = {
  mode: "login" | "signup";
  username: string;
  password: string;
  displayName: string;
  showPassword: boolean;
  error: string | null;
  busy: boolean;
  shake: boolean;
  leaving: boolean;
  stageRef?: RefObject<HTMLElement | null>;
  /** The "লগইন | নতুন সদস্য" links (router links in the app). */
  switcher: ReactNode;
  /** The language button. */
  langSlot: ReactNode;
  onUsername: (v: string) => void;
  onPassword: (v: string) => void;
  onDisplayName: (v: string) => void;
  onTogglePassword: () => void;
  onSubmit: (e: FormEvent) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave?: () => void;
  /** "Continue as guest" — read, like and vote without an account. Hidden when not given. */
  onGuest?: () => void;
  guestBusy?: boolean;
};

/**
 * Sign-in as a floating glass window over a ghost of the main site.
 * Pure presentation: the form logic lives in AuthForm.
 */
export function LoginWindow(p: LoginWindowProps) {
  const isLogin = p.mode === "login";
  const stageClass = ["ls-stage", p.shake ? "is-shake" : "", p.leaving ? "is-leaving" : ""].filter(Boolean).join(" ");

  return (
    <main
      ref={p.stageRef as RefObject<HTMLElement>}
      className={stageClass}
      style={{ "--ls-rx": "0deg", "--ls-ry": "0deg", "--ls-px": 0, "--ls-py": 0 } as CSSProperties}
      onPointerMove={p.onPointerMove}
      onPointerLeave={p.onPointerLeave}
    >
      <LoginBackdrop />
      <div className="ls-lang">{p.langSlot}</div>

      <div className="ls-front">
        <div className="ls-float">
          <div className="ls-tilt">
            <div className="ls-halo" aria-hidden="true" />
            <section className="ls-window" aria-labelledby="ls-heading">
              <div className="ls-titlebar" aria-hidden="true">
                <span className="ls-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="ls-tab">
                  <BookOpen size={12} strokeWidth={1.8} />
                  গল্প সংগ্রহ
                </span>
                <span className="ls-spacer" />
              </div>

              <div className="ls-body">
                <div className="ls-mark">
                  {isLogin ? <LogIn size={22} strokeWidth={1.6} /> : <UserPlus size={22} strokeWidth={1.6} />}
                </div>
                <h1 id="ls-heading" className="ls-title">
                  <FxWords text={isLogin ? "লগইন" : "নতুন সদস্য"} />
                </h1>
                <p className="ls-sub">
                  {isLogin ? "ভেতরে ঢুকে আপনার লাইব্রেরি খুলুন" : "একটি অ্যাকাউন্ট খুলে গল্পের জগতে যোগ দিন"}
                </p>

                <nav className="ls-switch">{p.switcher}</nav>

                <form onSubmit={p.onSubmit} className="ls-form">
                  <label className="ls-field">
                    <span className="sr-only">ইউজারনেম</span>
                    <User />
                    <input
                      className="ls-input"
                      value={p.username}
                      onChange={(e) => p.onUsername(e.target.value)}
                      placeholder="ইউজারনেম (ইংরেজি)"
                      autoComplete="username"
                      autoCapitalize="none"
                      required
                    />
                  </label>
                  {!isLogin ? (
                    <label className="ls-field">
                      <span className="sr-only">নাম</span>
                      <Smile />
                      <input
                        className="ls-input"
                        value={p.displayName}
                        onChange={(e) => p.onDisplayName(e.target.value)}
                        placeholder="আপনার নাম (ঐচ্ছিক)"
                        maxLength={40}
                      />
                    </label>
                  ) : null}
                  <label className="ls-field">
                    <span className="sr-only">পাসওয়ার্ড</span>
                    <Lock />
                    <input
                      className="ls-input has-eye"
                      type={p.showPassword ? "text" : "password"}
                      value={p.password}
                      onChange={(e) => p.onPassword(e.target.value)}
                      placeholder={isLogin ? "পাসওয়ার্ড" : "পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)"}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      required
                    />
                    <button
                      type="button"
                      className="ls-eye pressable"
                      onClick={p.onTogglePassword}
                      aria-label={p.showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                    >
                      {p.showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </label>
                  {p.error ? (
                    <p role="alert" className="ls-error">
                      {p.error}
                    </p>
                  ) : null}
                  <button type="submit" disabled={p.busy} className="ls-submit pressable">
                    {p.busy ? <Loader2 size={16} className="ls-spin" /> : null}
                    {p.busy ? "একটু অপেক্ষা…" : isLogin ? "লগইন" : "অ্যাকাউন্ট খুলুন"}
                    {!p.busy ? <ArrowRight size={16} /> : null}
                  </button>
                </form>

                {p.onGuest ? (
                  <div className="ls-guest">
                    <button
                      type="button"
                      className="ls-guest-btn pressable"
                      onClick={p.onGuest}
                      disabled={p.busy || p.guestBusy}
                    >
                      {p.guestBusy ? <Loader2 size={16} className="ls-spin" /> : <UserRound size={16} strokeWidth={1.7} />}
                      অতিথি হিসেবে ঢুকুন
                    </button>
                    <p className="ls-guest-hint">গল্প ও মাঙ্গা পড়া, লাইক ও ভোট দেওয়া যাবে। বাকি সবকিছুর জন্য অ্যাকাউন্ট লাগবে।</p>
                  </div>
                ) : null}

                <p className="ls-note">
                  <ShieldCheck size={13} strokeWidth={1.7} />
                  সদস্যদের জন্য একটি নিভৃত লাইব্রেরি
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
