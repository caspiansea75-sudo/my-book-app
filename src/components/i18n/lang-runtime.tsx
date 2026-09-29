import { useEffect } from "react";
import { useLang } from "@/lib/i18n/lang";
import { translateText } from "@/lib/i18n/translate";

/**
 * English mode: swaps known interface text (and placeholders / labels) in the page.
 * Stories, chapter text and anything inside [data-no-i18n] or an editor are left alone.
 * Originals are remembered, so switching back restores Bengali exactly.
 */
const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;
const SKIP = "[data-no-i18n],[contenteditable='true'],script,style,textarea,noscript";
type Rec = { orig: string; out: string };
const texts = new Map<Text, Rec>();
const attrs = new Map<Element, Map<string, Rec>>();

function doText(node: Text) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  const rec = texts.get(node);
  let orig = node.nodeValue ?? "";
  if (rec && orig === rec.out) orig = rec.orig;
  const out = translateText(orig);
  if (out != null && out !== orig) {
    texts.set(node, { orig, out });
    if (node.nodeValue !== out) node.nodeValue = out;
  } else texts.delete(node);
}

function doAttr(el: Element, name: string) {
  if (el.closest(SKIP)) return;
  const recs = attrs.get(el) ?? new Map<string, Rec>();
  const rec = recs.get(name);
  let orig = el.getAttribute(name) ?? "";
  if (rec && orig === rec.out) orig = rec.orig;
  const out = translateText(orig);
  if (out != null && out !== orig) {
    recs.set(name, { orig, out });
    attrs.set(el, recs);
    if (el.getAttribute(name) !== out) el.setAttribute(name, out);
  } else recs.delete(name);
}

function scan(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) doText(n as Text);
  const scope = root.nodeType === Node.DOCUMENT_NODE ? (root as Document).documentElement : (root as Element);
  const sel = ATTRS.map((a) => `[${a}]`).join(",");
  if (scope.matches?.(sel)) ATTRS.forEach((a) => scope.hasAttribute(a) && doAttr(scope, a));
  scope.querySelectorAll(sel).forEach((el) => ATTRS.forEach((a) => el.hasAttribute(a) && doAttr(el, a)));
}

function restore() {
  for (const [node, rec] of texts) if (node.isConnected && node.nodeValue === rec.out) node.nodeValue = rec.orig;
  for (const [el, recs] of attrs)
    if (el.isConnected) for (const [name, rec] of recs) if (el.getAttribute(name) === rec.out) el.setAttribute(name, rec.orig);
  texts.clear();
  attrs.clear();
}

export function LangRuntime() {
  const lang = useLang();

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "bn";
    if (lang !== "en") {
      restore();
      return;
    }
    scan(document);
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") doText(r.target as Text);
        else if (r.type === "attributes") doAttr(r.target as Element, r.attributeName ?? "");
        else r.addedNodes.forEach((n) => scan(n));
      }
      if (texts.size > 4000) for (const n of texts.keys()) if (!n.isConnected) texts.delete(n);
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    });
    return () => observer.disconnect();
  }, [lang]);

  return null;
}
