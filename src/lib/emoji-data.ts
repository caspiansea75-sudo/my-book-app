/** Emoji grouped for the picker. Kept to older Unicode so they show on most phones and PCs. */
const EMOJI_RX = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;
const split = (s: string) => s.match(EMOJI_RX) ?? [];

export type EmojiGroup = { id: string; icon: string; label: string; emojis: string[] };

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: "smileys", icon: "😀", label: "হাসিমুখ",
    emojis: split(`😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗☺️😚😙😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁☹️😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠️💩🤡👹👺👻👽👾🤖😺😸😹😻😼😽🙀😿😾🙈🙉🙊`),
  },
  {
    id: "people", icon: "👋", label: "হাত ও মানুষ",
    emojis: split(`👋🤚🖐️✋🖖👌🤏✌️🤞🤟🤘🤙👈👉👆👇☝️👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏✍️💅🤳💪🦾🦵🦶👂👃🧠🦷👀👁️👅👄👶🧒👦👧🧑👨👩🧓👴👵🙍🙎🙅🙆💁🙋🙇🤦🤷💃🕺👯🧖🏃🚶👑👒🎩🎓👓🕶️👔👕👖👗👘👙👜👛🎒👟👠👡👢💍💄`),
  },
  {
    id: "hearts", icon: "❤️", label: "হৃদয় ও চিহ্ন",
    emojis: split(`❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟✨⭐🌟💫⚡🔥💥💢💯💤💦💨🎶🎵✔️✅❌❎❓❔❕❗‼️⁉️⚠️🚫🔞🆗🆒🆕🆓🔴🟠🟡🟢🔵🟣⚫⚪🟤🔶🔷🔺🔻♻️➕➖➗♾️☮️☯️🔔🔕📢📣🔱⚜️🔰✳️❇️`),
  },
  {
    id: "nature", icon: "🐶", label: "প্রাণী ও প্রকৃতি",
    emojis: split(`🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🕷️🦂🐢🐍🦎🐙🦑🦐🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🐘🦒🐪🐫🦘🐃🐂🐄🐎🐖🐏🐑🐐🦌🐕🐩🐈🐓🦃🕊️🐇🐿️🌵🎄🌲🌳🌴🌱🌿☘️🍀🎍🍃🍂🍁🍄🌾💐🌷🌹🥀🌺🌸🌼🌻🌞🌝🌚🌙🌈☀️⛅☁️🌧️⛈️🌩️❄️☃️⛄🌊💧🌪️🌫️`),
  },
  {
    id: "food", icon: "🍔", label: "খাবার ও পানীয়",
    emojis: split(`🍏🍎🍐🍊🍋🍌🍉🍇🍓🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶️🌽🥕🧄🧅🥔🍠🥐🍞🥖🥨🧀🥚🍳🥞🧇🥓🥩🍗🍖🌭🍔🍟🍕🥪🌮🌯🥗🍝🍜🍲🍛🍣🍱🥟🍤🍙🍚🍘🍥🥠🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🌰🥜🍯🥛☕🍵🧃🥤🍶🍺🍻🥂🍷🥃🍸🍹🍾🧊🥄🍴🍽️`),
  },
  {
    id: "activity", icon: "⚽", label: "খেলাধুলা ও উৎসব",
    emojis: split(`⚽🏀🏈⚾🥎🎾🏐🏉🎱🏓🏸🥅🏒🏏⛳🏹🎣🥊🥋🛹⛸️🎿🏂🏋️🤸⛹️🤺🏇🧘🏄🏊🚣🚴🏆🥇🥈🥉🏅🎖️🎫🎟️🎪🎭🎨🎬🎤🎧🎼🎹🥁🎷🎺🎸🎻🎲🎯🎳🎮🎰🧩🎁🎈🎀🎊🎉🎎🏮🎐🧧🪔`),
  },
  {
    id: "travel", icon: "🚗", label: "ভ্রমণ ও স্থান",
    emojis: split(`🚗🚕🚙🚌🚎🏎️🚓🚑🚒🚐🚚🚛🚜🏍️🛵🚲🛴🚨🚔🚍🚘🚖🚡🚠🚟🚃🚋🚞🚝🚄🚅🚈🚂🚆🚇🚊🚉✈️🛫🛬🚀🛸🚁🛶⛵🚤🛳️⛴️🚢⚓⛽🚧🚦🚥🗺️🗿🗽🗼🏰🏯🏟️🎡🎢🎠⛲⛱️🏖️🏝️🏜️🌋⛰️🏔️🗻🏕️⛺🏠🏡🏢🏥🏦🏨🏪🏫🏭🕌🛕⛪🕍🌅🌄🌆🌇🌃🌉`),
  },
  {
    id: "objects", icon: "💡", label: "জিনিসপত্র",
    emojis: split(`⌚📱💻⌨️🖥️🖨️🖱️💽💾💿📷📸📹🎥📞☎️📺📻🎙️⏰⏳⌛📡🔋🔌💡🔦🕯️💸💵💴💶💷💰💳💎⚖️🔧🔨🛠️⛏️🔩⚙️🧱🧲🔫💣🧨🔪🗡️⚔️🛡️🚬🏺🔮📿🧿💈🔭🔬💊💉🧬🧪🌡️🧹🧺🧻🚽🚿🛁🧼🧽🧴🔑🗝️🚪🛋️🛏️🧸🖼️🛍️✉️📩📨📧💌📦📮📜📃📄📑📊📈📉🗒️🗓️📅📋📁📂📰📓📔📒📕📗📘📙📚📖🔖🏷️📎📏📐✂️🖊️🖋️✒️🖌️🖍️📝✏️🔍🔎🔏🔐🔒🔓`),
  },
];

const RECENT_KEY = "chat-emoji-recent";
export function loadRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 24) : [];
  } catch {
    return [];
  }
}
export function saveRecent(emoji: string): string[] {
  const next = [emoji, ...loadRecent().filter((e) => e !== emoji)].slice(0, 24);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
