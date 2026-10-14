import { translateText } from "@/lib/i18n/translate";

/**
 * English mode, DOM side: swaps known interface text (and placeholders / labels) in the page.
 * Stories, chapter text and anything inside [data-no-i18n] or an editor are left alone.
 * Originals are remembered, so switching back restores Bengali exactly.
 *
 * React renders `সব ফাইল ({count})` as three neighbouring text nodes ("সব ফাইল (", "74", ")"). Translating them one by
 * one can never match a phrase or pattern, so neighbouring text nodes (hydration comments in between are ignored) are
 * translated together first: the English goes into the first node and the others are emptied. If there is no phrase
 * match for the group, each node is translated on its own, as before.
 */
export const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;
const SKIP = "[data-no-i18n],[contenteditable='true'],script,style,textarea,noscript";
// Attributes (placeholder, aria-label…) are safe to translate on a <textarea>; only its content is not.
const SKIP_ATTR = "[data-no-i18n],[contenteditable='true'],script,style,noscript";
type Rec = { orig: string; out: string };
const texts = new Map<Text, Rec>();
const attrs = new Map<Element, Map<string, Rec>>();

/** The text a node had before we touched it (or what React has put there since). */
function origOf(n: Text): string {
  const rec = texts.get(n);
  const v = n.nodeValue ?? "";
  return rec && v === rec.out ? rec.orig : v;
}

/** The text node plus every text node right next to it (comments in between don't break the run). */
function runOf(node: Text): Text[] {
  const isPart = (n: Node | null) => !!n && (n.nodeType === Node.TEXT_NODE || n.nodeType === Node.COMMENT_NODE);
  const run: Text[] = [node];
  for (let p = node.previousSibling; isPart(p); p = p!.previousSibling) if (p!.nodeType === Node.TEXT_NODE) run.unshift(p as Text);
  for (let n = node.nextSibling; isPart(n); n = n!.nextSibling) if (n!.nodeType === Node.TEXT_NODE) run.push(n as Text);
  return run;
}

/**
 * Translates one text node together with the text nodes right next to it, and returns that group.
 *
 * Rule that keeps this from ever looping: work out what every node SHOULD say first, then write only the
 * nodes whose text is actually different. A second pass over the same group therefore changes nothing, so
 * the MutationObserver in lang-runtime never sees a change it has to answer.
 */
export function doText(node: Text): Text[] {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return [node];
  const run = runOf(node);
  const origs = run.map(origOf);

  // 1) The whole group is one phrase ("সব ছবি (" + "74" + ")"): English goes in the first node, the rest are emptied.
  if (run.length > 1) {
    const joined = origs.join("");
    const out = translateText(joined);
    if (out != null && out !== joined) {
      run.forEach((n, i) => {
        const val = i === 0 ? out : "";
        texts.set(n, { orig: origs[i], out: val });
        if (n.nodeValue !== val) n.nodeValue = val;
      });
      return run;
    }
  }

  // 2) No phrase for the group: every node on its own (this also undoes an earlier merge).
  run.forEach((n, i) => {
    const orig = origs[i];
    const t = translateText(orig);
    const target = t != null && t !== orig ? t : orig;
    if (target !== orig) texts.set(n, { orig, out: target });
    else texts.delete(n);
    if (n.nodeValue !== target) n.nodeValue = target;
  });
  return run;
}

export function doAttr(el: Element, name: string) {
  if (el.closest(SKIP_ATTR)) return;
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

export function scan(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    doText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const done = new Set<Text>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (done.has(n as Text)) continue;
    for (const m of doText(n as Text)) done.add(m);
  }
  const scope = root.nodeType === Node.DOCUMENT_NODE ? (root as Document).documentElement : (root as Element);
  const sel = ATTRS.map((a) => `[${a}]`).join(",");
  if (scope.matches?.(sel)) ATTRS.forEach((a) => scope.hasAttribute(a) && doAttr(scope, a));
  scope.querySelectorAll(sel).forEach((el) => ATTRS.forEach((a) => el.hasAttribute(a) && doAttr(el, a)));
}

export function restore() {
  for (const [node, rec] of texts) if (node.isConnected && node.nodeValue === rec.out) node.nodeValue = rec.orig;
  for (const [el, recs] of attrs)
    if (el.isConnected) for (const [name, rec] of recs) if (el.getAttribute(name) === rec.out) el.setAttribute(name, rec.orig);
  texts.clear();
  attrs.clear();
}

/** Forget nodes that left the page. */
export function prune() {
  if (texts.size > 4000) for (const n of texts.keys()) if (!n.isConnected) texts.delete(n);
}

/** Browser pop-ups (confirm / alert) are not part of the page, so their text is translated before they open. */
export function patchDialogs(): () => void {
  const w = window as Window;
  const { confirm, alert } = w;
  w.confirm = (msg?: string) => confirm.call(w, msg == null ? msg : (translateText(String(msg)) ?? String(msg)));
  w.alert = (msg?: unknown) => alert.call(w, msg == null ? msg : (translateText(String(msg)) ?? String(msg)));
  return () => {
    w.confirm = confirm;
    w.alert = alert;
  };
}
