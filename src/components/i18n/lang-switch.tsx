import { Languages } from "lucide-react";
import { setLang, useLang } from "@/lib/i18n/lang";
import { cn } from "@/lib/utils";

/** বাংলা / English for the site's buttons and labels. Stories are never translated. */
export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang();
  return (
    <button
      type="button"
      data-no-i18n
      onClick={() => setLang(lang === "en" ? "bn" : "en")}
      aria-label={lang === "en" ? "বাংলায় দেখুন" : "View in English"}
      title={lang === "en" ? "বাংলা" : "English"}
      className={cn(
        "pressable inline-flex h-10 items-center gap-1.5 rounded-full px-3 font-sans text-xs text-muted hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      <Languages className="size-4" strokeWidth={1.75} />
      {lang === "en" ? "বাংলা" : "EN"}
    </button>
  );
}
