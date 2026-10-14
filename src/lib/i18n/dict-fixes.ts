// English text for interface strings that were still showing Bengali in English mode.
// Only keys that are NOT in the other dictionaries live here (those win if a key is in both).
export const FIXES_EXACT: Record<string, string> = {
  // single words inside split headings ("আপনার লাইব্রেরি", "ছবি ও ভিডিও")
  "ও": "and",
  "আপনার": "Your",

  // manga chapter editor
  "নতুন ছবি আপলোড করে সরাসরি যোগ করুন": "Upload new images and add them directly",

  // gallery: delete notes
  "গল্পে ছবির জায়গা ভাঙা দেখাবে (আগে স্টুডিও থেকে ছবিটি সরিয়ে নিন)": "Story images will show as broken (first remove the image in the Studio)",

  // small unit / count fragments
  "টি অধ্যায়": " chapters",
  "টি জিনিস": " items",
  "· ট্রাশে": "· in trash",
  "জানা যায়নি": "Unknown",
  "অজানা": "Unknown",
  "/ সীমা": "/ limit",
  "এমবি": "MB",
  "ডাউনলোড": "Download",
  "সং": "Sens.",

  // storage page (admin)
  "ডেটাবেস ও ব্লব জায়গা": "Database & blob storage",
  "হিসাব হচ্ছে…": "Calculating…",
  "হিসাব আনা যায়নি": "Couldn't get the usage",
  "Neon ডেটাবেস": "Neon database",
  "সীমাটা আপনার Neon প্ল্যানের সংখ্যা দিয়ে বদলে নিন। চূড়ান্ত হিসাব সবসময় Neon কনসোলে দেখুন।": "Set the limit to your Neon plan's number. Always check the final numbers in the Neon console.",
  "ব্লব স্টোরের হিসাব আনা যায়নি।": "Couldn't get the blob store usage.",
  "ব্লব স্টোরের হিসাব আনা যায়নি": "Couldn't get the blob store usage",
  "Vercel Blob এই ডিপ্লয়মেন্টে যুক্ত নেই। Vercel → Storage থেকে স্টোরটি প্রজেক্টের সাথে Connect করলে": "Vercel Blob isn't connected to this deployment. Once you connect the store to the project from Vercel → Storage,",
  "নিজে থেকেই বসে যাবে, তারপর আবার ডিপ্লয় করুন।": "will be set automatically — then deploy again.",
  "ছবি (আপলোড)": "Images (uploaded)",
  "ভিডিও (আপলোড)": "Videos (uploaded)",
  "শুধু লিংক (YouTube ইত্যাদি)": "Links only (YouTube etc.)",
  "ট্রাশে আটকে থাকা": "Stuck in trash",
  "ট্রাশের ছবি/ভিডিও এখনো ডেটাবেসে জায়গা নিচ্ছে। ট্রাশ থেকে “স্থায়ীভাবে মুছুন” করলে তবেই জায়গা ফিরবে।": "Trashed images/videos still take up database space. Space only comes back once you “Delete permanently” from the trash.",
  "Blob: কোন ফোল্ডার কত জায়গা নিচ্ছে": "Blob: space used per folder",
  "Blob: সবচেয়ে বড় ফাইল": "Blob: largest files",
  "কোন টেবিল কত জায়গা নিচ্ছে": "Space used per table",
  "সদস্য অনুযায়ী আপলোড": "Uploads by member",
  "সবচেয়ে বড় ফাইল": "Largest files",
  "মোট (ডেটাবেস + ব্লব)": "Total (database + blob)",
  "শুধু অ্যাডমিন দেখতে পারবেন": "Only admins can see this",
  "এই তথ্য শুধু অ্যাডমিনের জন্য": "This information is for admins only",

  // story export
  "গল্প তালিকা লোড হয়নি": "Couldn't load the story list",
  "ডাউনলোড করা যায়নি": "Couldn't download",

  // error messages raised in the data layer and shown in the page
  "ফাইল পড়া যায়নি": "Couldn't read the file",
  "ছবি খোলা যায়নি": "Couldn't open the image",
  "ছবি তৈরি যায়নি": "Couldn't create the image",
  "ছবিটি পড়া যায়নি": "Couldn't read the image",
  "ছবিটি অনেক বড়": "The image is too large",
  "ভিডিওটি অনেক বড়": "The video is too large",
  "ছবি ১২ এমবি-র বেশি হতে পারবে না": "Images can't be larger than 12 MB",
  "GIF ৯০০ কেবি-র বেশি হতে পারবে না": "GIFs can't be larger than 900 KB",
  "মূল অধ্যায়ের লেখা বদলানো যায় না": "The original chapter text can't be changed",
  "এটি আপনার তৈরি নয়": "This isn't yours",
  "ফোল্ডারকে নিজের ভেতরের ফোল্ডারে রাখা যায় না": "A folder can't be moved into itself",
  "বার্তা পাওয়া যায়নি": "Message not found",
  "এই ইমোজি ব্যবহার করা যায় না": "This emoji can't be used",
  "নিজের বার্তা রিপোর্ট করা যায় না": "You can't report your own message",

  // browser pop-ups (confirm / alert)
  "মন্তব্যটি মুছে ফেলবেন?": "Delete this comment?",
  "এই সংস্করণ ফিরিয়ে আনবেন? বর্তমান লেখা আগে আলাদা সংস্করণ হিসেবে রাখা হবে।": "Restore this version? Your current text will be saved as a separate version first.",
  "এই অধ্যায় ট্রাশে পাঠাবেন? (স্টুডিও › ট্রাশ থেকে ফেরত আনা যাবে)": "Move this chapter to the trash? (You can restore it from Studio › Trash)",
  "এই বই ট্রাশে পাঠাবেন? (স্টুডিও › ট্রাশ থেকে সব অধ্যায়সহ ফেরত আনা যাবে)": "Move this book to the trash? (You can restore it with all its chapters from Studio › Trash)",
  "এই অধ্যায় ও এর সব প্যানেল মুছে ফেলবেন?": "Delete this chapter and all its panels?",
  "এই মাঙ্গা এবং এর সব অধ্যায়/প্যানেল স্থায়ীভাবে মুছে ফেলবেন?": "Permanently delete this manga and all its chapters/panels?",
};

const N = "([০-৯0-9,]+)";
const TRASH_SCOPES: [string, string][] = [
  ["ট্রাশের", "everything in the trash"],
  ["সব বইয়ের", "all books in the trash"],
  ["সব অধ্যায়ের", "all chapters in the trash"],
  ["সব ছবি ও ভিডিওর", "all images and videos in the trash"],
];
const D = "([০-৯0-9.,]+)";

export const FIXES_PATTERNS: [string, string][] = [
  [`^সব ফাইল \\(${N}\\)$`, "All files ({1})"],
  [`^অসংরক্ষিত খসড়া পাওয়া গেছে \\((.+)\\)$`, "Unsaved draft found ({1})"],
  [`^নিজের সম্পর্কে \\(${N}/300\\)$`, "About you ({1}/300)"],
  [`^\\(${D}% ভরা\\)$`, "({1}% full)"],
  [`^· ${N}টি$`, "· {1} items"],
  [`^${N}টি প্যানেল যোগ করুন$`, "Add {1} panels"],
  [`^“(.+)” স্থায়ীভাবে মুছবেন\\? এটি আর ফেরত আসবে না।$`, "Permanently delete “{1}”? This can't be undone."],
  // trash dialog: "ট্রাশের ৫টি জিনিস (এবং তালিকার বাইরের বাকি সব) বইয়ের সব অধ্যায়সহ স্থায়ীভাবে মুছবেন? এটি আর ফেরত আসবে না।"
  ...TRASH_SCOPES.flatMap(([bn, en]) =>
    [false, true].flatMap((more) =>
      [false, true].map((chapters): [string, string] => [
        `^${bn} ${N}টি জিনিস${more ? " \\(এবং তালিকার বাইরের বাকি সব\\)" : ""}${chapters ? " বইয়ের সব অধ্যায়সহ" : ""} স্থায়ীভাবে মুছবেন\\? এটি আর ফেরত আসবে না।$`,
        `Permanently delete ${en} ({1} items${more ? ", plus the rest beyond the list" : ""}${chapters ? ", including all chapters of the books" : ""})? This can't be undone.`,
      ]),
    ),
  ),
];
