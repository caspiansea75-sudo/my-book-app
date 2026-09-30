import { useLang } from "@/lib/i18n/lang";

/** Date / time locale that follows the language switch (English digits and month names in English mode). */
export function useLocale(): "en-US" | "bn-BD" {
  return useLang() === "en" ? "en-US" : "bn-BD";
}
