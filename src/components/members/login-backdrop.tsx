import type { CSSProperties } from "react";
import { BookImage, BookOpen, Images, MessageCircle, PenLine, Search } from "lucide-react";

const NAV = [
  { label: "লাইব্রেরি", icon: BookOpen },
  { label: "চিত্রশালা", icon: Images },
  { label: "মাঙ্গা", icon: BookImage },
  { label: "স্টুডিও", icon: PenLine },
  { label: "চ্যাট", icon: MessageCircle },
] as const;

// Muted tints for the ghost covers; each is mixed into the theme's own background.
const TINTS = ["#8f3a3e", "#3f6f78", "#b88a4a", "#4b5a9a", "#5d7a4f", "#9a4f73"];
const GLYPHS = ["অ", "ক", "গ", "র", "ম", "শ", "স", "ন", "ব", "প", "ত", "হ"];

const CARDS = GLYPHS.map((g, i) => ({
  g,
  tint: TINTS[i % TINTS.length],
  angle: 140 + ((i * 17) % 40),
  title: 62 + ((i * 13) % 30),
  sub: 34 + ((i * 7) % 24),
  progress: i % 3 === 0 ? 20 + ((i * 11) % 65) : 0,
  fresh: i === 1 || i === 6,
}));

/**
 * A look-alike of the library, blurred and dimmed behind the sign-in window.
 * It is pure decoration — no real titles, covers or members are ever sent to a signed-out visitor.
 */
export function LoginBackdrop() {
  return (
    <div className="ls-backdrop" aria-hidden="true">
      <div className="ls-glow" />
      <div className="ls-site">
        <div className="ls-nav">
          <span className="ls-brand">
            <span className="ls-brand-mark">
              <BookOpen size={16} strokeWidth={1.7} />
            </span>
            গল্প সংগ্রহ
          </span>
          <span className="ls-pills">
            {NAV.map((n, i) => {
              const Icon = n.icon;
              return (
                <span key={n.label} className={i === 0 ? "ls-pill on" : "ls-pill"}>
                  <Icon size={14} strokeWidth={1.75} />
                  <span>{n.label}</span>
                </span>
              );
            })}
          </span>
          <span className="ls-avatar" />
        </div>

        <div className="ls-drift">
          <div className="ls-page">
            <div className="ls-seg">
              <span className="on">গল্প</span>
              <span>মাঙ্গা</span>
            </div>
            <div className="ls-bar-row">
              <span className="ls-search">
                <Search size={16} />
                <span className="ls-line" style={{ width: "34%" }} />
              </span>
              <span className="ls-round" />
              <span className="ls-round" />
            </div>
            <div className="ls-grid">
              {CARDS.map((c) => (
                <div key={c.g} className="ls-card">
                  <div
                    className="ls-cover"
                    style={{ "--t": c.tint, "--a": `${c.angle}deg` } as CSSProperties}
                  >
                    {c.fresh ? <span className="ls-new">নতুন</span> : null}
                    <i />
                    <b>{c.g}</b>
                  </div>
                  <div className="ls-meta">
                    <span className="ls-line" style={{ width: `${c.title}%` }} />
                    <span className="ls-line" style={{ width: `${c.sub}%` }} />
                    {c.progress ? (
                      <span className="ls-prog">
                        <span style={{ width: `${c.progress}%` }} />
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="ls-veil" />
    </div>
  );
}
