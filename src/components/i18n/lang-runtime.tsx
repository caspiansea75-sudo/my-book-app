import { useEffect } from "react";
import { useLang } from "@/lib/i18n/lang";
import { ATTRS, doAttr, doText, patchDialogs, prune, restore, scan } from "@/lib/i18n/dom";

/** English mode: swaps known interface text in the page (see lib/i18n/dom.ts). */
export function LangRuntime() {
  const lang = useLang();

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "bn";
    if (lang !== "en") {
      restore();
      return;
    }
    scan(document);
    const unpatch = patchDialogs();
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") doText(r.target as Text);
        else if (r.type === "attributes") doAttr(r.target as Element, r.attributeName ?? "");
        else r.addedNodes.forEach((n) => scan(n));
      }
      prune();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    });
    return () => {
      observer.disconnect();
      unpatch();
    };
  }, [lang]);

  return null;
}
