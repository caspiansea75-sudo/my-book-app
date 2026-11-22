export const COLOR_SWATCHES = [
  { label: "লাল", value: "#e5484d" },
  { label: "কমলা", value: "#f0883e" },
  { label: "সোনালি", value: "#e8c468" },
  { label: "সবুজ", value: "#5fbf8a" },
  { label: "নীল", value: "#6fa8ff" },
  { label: "বেগুনি", value: "#b48cff" },
  { label: "গোলাপি", value: "#ff8fc0" },
  { label: "সাদা", value: "#ffffff" },
  { label: "ধূসর", value: "#9aa0ad" },
] as const;

export const TEXT_EFFECTS = [
  { id: "bold", label: "মোটা" },
  { id: "italic", label: "বাঁকা" },
  { id: "glow", label: "আলো" },
  { id: "flicker", label: "মিটমিট" },
  { id: "shake", label: "কাঁপুনি" },
  { id: "whisper", label: "ফিসফিস" },
  { id: "shadow", label: "ছায়া" },
  { id: "center", label: "মাঝখানে" },
] as const;

/**
 * Size steps 1–9 (5 = normal). Stored as effect ids "sz-1" … "sz-9", so a size travels with the
 * text exactly like any other effect — nothing new to save on the server.
 */
export const SIZE_NORMAL = 5;
export const TEXT_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const SIZE_EM: Record<number, number> = { 1: 0.6, 2: 0.72, 3: 0.85, 4: 0.93, 5: 1, 6: 1.2, 7: 1.5, 8: 1.9, 9: 2.4 };

/** Fonts that give a story its mood. Stored as "ff-…". Only one font applies to a piece of text. */
export const TEXT_FONTS = [
  { id: "ff-elegant", label: "মার্জিত" },
  { id: "ff-script", label: "হাতের লেখা" },
  { id: "ff-playful", label: "মজার" },
  { id: "ff-type", label: "টাইপরাইটার" },
] as const;

/** Elegant and quirky touches on top of the basic effects. */
export const FANCY_EFFECTS = [
  { id: "gold", label: "সোনালি ঝিলিক" },
  { id: "rainbow", label: "রামধনু" },
  { id: "neon", label: "নিয়ন" },
  { id: "dream", label: "স্বপ্নিল" },
  { id: "ghost", label: "ভুতুড়ে" },
  { id: "wave", label: "ঢেউ খেলানো" },
  { id: "wide", label: "ছড়ানো" },
  { id: "marker", label: "মার্কার" },
  { id: "strike", label: "কাটা দাগ" },
] as const;

/** Every effect id the editor and the reader understand. */
export const ALL_FX_IDS: string[] = [
  ...TEXT_EFFECTS.map((f) => f.id),
  ...FANCY_EFFECTS.map((f) => f.id),
  ...TEXT_FONTS.map((f) => f.id),
  ...TEXT_SIZES.map((n) => `sz-${n}`),
];

/** The size step in an effect list (5 = normal when none is set). */
export function sizeOf(fx?: string[]): number {
  const hit = (fx ?? []).find((id) => /^sz-[1-9]$/.test(id));
  return hit ? Number(hit.slice(3)) : SIZE_NORMAL;
}

/** Effect list with the size set to `n` (null or 5 = back to normal). */
export function withSize(fx: string[] | undefined, n: number | null): string[] {
  const rest = (fx ?? []).filter((id) => !/^sz-[1-9]$/.test(id));
  return n == null || n === SIZE_NORMAL ? rest : [...rest, `sz-${n}`];
}

/** Turn one effect on or off. A font or a size replaces the previous font or size instead of piling up. */
export function toggleFx(fx: string[] | undefined, id: string, on: boolean): string[] {
  const cur = fx ?? [];
  if (!on) return cur.filter((x) => x !== id);
  const group = id.startsWith("ff-") ? "ff-" : id.startsWith("sz-") ? "sz-" : "";
  const rest = group ? cur.filter((x) => !x.startsWith(group)) : cur;
  return rest.includes(id) ? rest : [...rest, id];
}

export function effectClass(effects?: string[]): string {
  if (!effects || !effects.length) return "";
  return effects.map((id) => `tx-${id}`).join(" ");
}
