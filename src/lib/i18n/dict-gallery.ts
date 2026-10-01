// English text for the gallery's search / sort / view / filter bar and sub-folders.
// Only keys that are NOT already in dict.ts live here (a key here would win over dict.ts everywhere).
export const GALLERY_EXACT: Record<string, string> = {
  "ফোল্ডার ও সাবফোল্ডার বানিয়ে ছবি ও ভিডিও গুছিয়ে রাখুন। সাজান, খুঁজুন, ফিল্টার করুন, একসাথে অনেকগুলো বেছে সরান — ফাইল টেনে ফোল্ডারে ছেড়েও দেওয়া যায়।":
    "Organise photos and videos into folders and subfolders. Sort, search, filter, select many at once and move them together — you can also drag files onto a folder.",
  "ফাইল বা ফোল্ডার খুঁজুন": "Search files or folders",
  "ফাইল বা ফোল্ডারের নাম খুঁজুন…": "Search files or folders by name…",
  "এই ফোল্ডারে খুঁজুন…": "Search this folder…",
  "দেখার ধরন": "View",
  "শুধু ছবি": "Pictures only",
  "ধরন": "Type",
  "ব্যবহার": "Usage",
  "ব্যবহৃত": "Used",
  "অব্যবহৃত": "Unused",
  "শুধু লুকানো ফাইল": "Hidden files only",
  "সাবফোল্ডার": "Subfolders",
  "ভেতরের সাবফোল্ডারের ফাইলও দেখান": "Include files from subfolders",
  "খোঁজা শুধু এই ফোল্ডারে": "Search only in this folder",
  "সাবফোল্ডারসহ": "including subfolders",
  "নতুন সাবফোল্ডার": "New subfolder",
  "সাবফোল্ডার বানান": "Create subfolder",
  "মেলে এমন ফোল্ডার": "Matching folders",
};

/** Counts rendered as one piece of text, e.g. "৩টি ফাইল", "২ সাবফোল্ডার", "মোট ১২", "(৩)". */
export const GALLERY_PATTERNS: [string, string][] = [
  ["^(১|1)টি ফাইল$", "1 file"],
  ["^([০-৯0-9,]+)টি ফাইল$", "{1} files"],
  ["^(১|1)টি ফোল্ডার$", "1 folder"],
  ["^([০-৯0-9,]+)টি ফোল্ডার$", "{1} folders"],
  ["^(১|1) সাবফোল্ডার$", "1 subfolder"],
  ["^([০-৯0-9,]+) সাবফোল্ডার$", "{1} subfolders"],
  ["^মোট ([০-৯0-9,]+)$", "{1} total"],
  ["^\\(([০-৯0-9,]+)\\)$", "({1})"],
];
