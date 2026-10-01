// English text for the manga collection in the library.
// Only keys that are NOT already in dict.ts live here (a key here would win over dict.ts everywhere).
export const LIBRARY_EXACT: Record<string, string> = {
  "ফিল্টার": "Filters",
  "মাঙ্গা বা লেখক খুঁজুন…": "Search manga or author…",
  "মাঙ্গা খুঁজুন": "Search manga",
  "যেকোনো একটি মাঙ্গা": "Any manga",
  "এখনো অধ্যায় নেই": "No chapters yet",
  "কোনো মাঙ্গা মেলেনি": "No manga found",
  "চিত্রশালার ছবি দিয়ে প্যানেল সাজান।": "Arrange gallery images into panels.",
  "শেষ পড়া অধ্যায় ·": "Last read chapter ·",
};

/** Counts rendered as one piece of text, e.g. "৩ অধ্যায়" or "২টি মাঙ্গা". */
export const LIBRARY_PATTERNS: [string, string][] = [
  ["^(১|1)\\ অধ্যায়$", "1 chapter"],
  ["^([০-৯0-9,]+)\\ অধ্যায়$", "{1} chapters"],
  ["^([০-৯0-9,]+)টি\\ মাঙ্গা$", "{1} manga"],
];
