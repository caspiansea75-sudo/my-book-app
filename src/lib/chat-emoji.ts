/** Quick reactions shown first, then the "+" grid. */
export const QUICK_REACTIONS = ["❤️", "😆", "😮", "😢", "😡", "👍"] as const;

export const MORE_REACTIONS = [
  "👎", "🙏", "👏", "🔥", "🎉", "💯", "😂", "🥰", "😍", "😘",
  "😊", "😎", "🤔", "😅", "😭", "😱", "🤯", "😴", "🤝", "💔",
  "✨", "🌹", "👀", "💪", "🙌", "😇", "🥺", "😏", "🤗", "😬",
] as const;

export const ALL_REACTIONS: readonly string[] = [...QUICK_REACTIONS, ...MORE_REACTIONS];

export const REPORT_REASONS = ["স্প্যাম", "হয়রানি বা অপমান", "অনুপযুক্ত বিষয়", "অন্য কিছু"] as const;
