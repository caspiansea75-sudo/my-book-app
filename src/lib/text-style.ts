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

export function effectClass(effects?: string[]): string {
  if (!effects || !effects.length) return "";
  return effects.map((id) => `tx-${id}`).join(" ");
}
