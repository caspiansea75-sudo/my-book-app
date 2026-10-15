/**
 * The type icons: a coloured rounded square with a white symbol, like the badges in the Pokémon games.
 * Pure data (SVG markup in a 24×24 box) so it can be drawn by React and tested without a browser.
 * `{C}` in a glyph is replaced by the icon's own colour (for cut-outs).
 */
export const TYPE_ICON_COLOR: Record<string, string> = {
  Normal: "#9b9b9b", Fire: "#f2662d", Water: "#2f9cf0", Electric: "#f6cc1c", Grass: "#38b83c", Ice: "#45cbef",
  Fighting: "#d6433f", Poison: "#a64fca", Ground: "#b07a3c", Flying: "#8dc3ff", Psychic: "#f6578a", Bug: "#a3a52a",
  Rock: "#b3a05a", Ghost: "#6a58a6", Dragon: "#5360d8", Dark: "#5a4a4f", Steel: "#6d9fc7", Fairy: "#f59be8",
  Stellar: "#40b5a5", "???": "#68a090",
};

const W = "#fff";
const stroke = (extra = "") => `fill="none" stroke="${W}" stroke-linecap="round" stroke-linejoin="round" ${extra}`;
const iceArm = (deg: number) => `<path transform="rotate(${deg} 12 12)" d="M12 12V4.2M9.9 6.3L12 4.2L14.1 6.3" ${stroke('stroke-width="1.7"')}/>`;

export const GLYPHS: Record<string, string> = {
  Normal: `<circle cx="12" cy="12" r="5.6" fill="none" stroke="${W}" stroke-width="3.2"/>`,
  Fire:
    `<path fill="${W}" d="M12 2.8C12.6 6.4 17.6 8.6 17.6 14.2A5.6 5.6 0 0 1 6.4 14.2C6.4 11.6 7.9 10 9 8.4C9.6 10 10.4 10.8 11.4 10.9C11 8 11 5.2 12 2.8Z"/>` +
    `<path fill="{C}" d="M12 20.2A3.1 3.1 0 0 1 8.9 17.1C8.9 15.5 10.3 14.6 10.9 13C11.9 14.2 15.1 15.1 15.1 17.1A3.1 3.1 0 0 1 12 20.2Z"/>`,
  Water:
    `<path fill="${W}" d="M12 3.2C12 3.2 5.6 10.4 5.6 14.6A6.4 6.4 0 0 0 18.4 14.6C18.4 10.4 12 3.2 12 3.2Z"/>` +
    `<path d="M8.9 15.2A3.2 3.2 0 0 0 11.4 18" fill="none" stroke="{C}" stroke-width="1.7" stroke-linecap="round"/>`,
  Electric: `<path fill="${W}" d="M13.6 2.6L5.8 13.4H11L9.6 21.4L18.2 10.2H12.8Z"/>`,
  Grass:
    `<path fill="${W}" d="M4.6 20C4.4 11.6 8.8 5.6 14.2 4.4C14.6 10.2 11.4 16.4 4.6 20Z"/>` +
    `<path fill="${W}" d="M10.2 21C10 13.4 13.8 8.4 19.8 8C20.2 14 16.2 19.4 10.2 21Z"/>` +
    `<path d="M5.8 18.4C8.4 14.2 10.8 10.4 13 6.6" fill="none" stroke="{C}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M11.4 19.4C13.4 15.6 15.8 12.4 18.4 9.8" fill="none" stroke="{C}" stroke-width="1.3" stroke-linecap="round"/>`,
  Ice: [0, 60, 120, 180, 240, 300].map(iceArm).join("") + `<circle cx="12" cy="12" r="1.6" fill="${W}"/>`,
  Fighting:
    `<rect x="6.4" y="9.4" width="12.8" height="10" rx="3.2" fill="${W}"/>` +
    `<circle cx="9.2" cy="8.7" r="2.1" fill="${W}"/><circle cx="12.2" cy="8.1" r="2.1" fill="${W}"/><circle cx="15.2" cy="8.1" r="2.1" fill="${W}"/><circle cx="18" cy="8.9" r="2" fill="${W}"/>` +
    `<rect x="4.2" y="12.2" width="4.2" height="6.6" rx="2.1" fill="${W}"/>` +
    `<path d="M10.8 10.6V14.4M13.7 10.2V14.4M16.5 10.6V14.2" fill="none" stroke="{C}" stroke-width="1.1" stroke-linecap="round"/>`,
  Poison:
    `<path fill="${W}" d="M12 4.6C12 4.6 6.8 10 6.8 13.6A5.2 5.2 0 0 0 17.2 13.6C17.2 10 12 4.6 12 4.6Z"/>` +
    `<circle cx="18.4" cy="6.4" r="1.9" fill="${W}"/><circle cx="6" cy="6.6" r="1.4" fill="${W}"/><circle cx="19.4" cy="12.4" r="1.2" fill="${W}"/>` +
    `<circle cx="10.2" cy="14" r="1.2" fill="{C}"/><circle cx="13.4" cy="12" r="0.8" fill="{C}"/>`,
  Ground:
    `<rect x="3.8" y="15.2" width="16.4" height="3.4" rx="1.7" fill="${W}"/><rect x="6" y="10.8" width="12" height="3.4" rx="1.7" fill="${W}"/><rect x="8.4" y="6.4" width="7.2" height="3.4" rx="1.7" fill="${W}"/>`,
  Flying:
    `<path fill="${W}" d="M3.6 17.4C5.2 9.6 11.2 5 20.4 4.8C17.8 6.8 16 8.8 15 10.8C16.8 10 18.4 9.6 20 9.6C18 12.4 14.8 14.2 11.4 14.6C13.2 14.8 14.6 14.6 16 14.2C13.8 17.8 9.2 19.4 3.6 17.4Z"/>` +
    `<path d="M19.4 9.8C16.6 10.6 14.4 12.2 13 14.2M14.4 6.9C12.2 8.5 10.2 10.8 9 13.6" fill="none" stroke="{C}" stroke-width="1" stroke-linecap="round"/>`,
  Psychic:
    `<rect x="6.8" y="6.8" width="10.4" height="10.4" fill="${W}"/><rect x="6.8" y="6.8" width="10.4" height="10.4" fill="${W}" transform="rotate(45 12 12)"/>` +
    `<circle cx="12" cy="12" r="3.2" fill="{C}"/><circle cx="12" cy="12" r="1.5" fill="${W}"/>`,
  Bug:
    `<ellipse cx="12" cy="14" rx="4.2" ry="5.6" fill="${W}"/><circle cx="12" cy="7" r="2.6" fill="${W}"/>` +
    `<path d="M11 5.2L8.8 3M13 5.2L15.2 3M8 11.2L4.6 9.6M8 14.4L3.8 14.4M8.4 17.6L5.2 19.8M16 11.2L19.4 9.6M16 14.4L20.2 14.4M15.6 17.6L18.8 19.8" ${stroke('stroke-width="1.5"')}/>` +
    `<path d="M12 9.8V19" fill="none" stroke="{C}" stroke-width="1.1"/>`,
  Rock:
    `<path fill="${W}" d="M4.6 17.4L5.6 10.4L10.2 6.2L16.4 7.6L19.6 13.2L18.2 18.4Z"/>` +
    `<path d="M10.2 6.2L11.8 12.4L18.2 18.4M5.6 10.4L11.8 12.4L8.6 18.2M16.4 7.6L11.8 12.4" fill="none" stroke="{C}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"/>`,
  Ghost:
    `<path fill="${W}" d="M12 3.6C8.2 3.6 5.6 6.4 5.6 10.4V19.6L8.1 17.6L10.1 19.6L12 17.6L13.9 19.6L15.9 17.6L18.4 19.6V10.4C18.4 6.4 15.8 3.6 12 3.6Z"/>` +
    `<circle cx="9.6" cy="10.4" r="1.7" fill="{C}"/><circle cx="14.4" cy="10.4" r="1.7" fill="{C}"/><ellipse cx="12" cy="14.2" rx="1.3" ry="1.6" fill="{C}"/>`,
  Dragon:
    `<path fill="${W}" d="M6.4 9.4L12 7.2L17.6 9.4L16.4 15.2L12 19.6L7.6 15.2Z"/>` +
    `<path fill="${W}" d="M7 8.6C5 6.8 4.8 4.4 5.4 2.8C7.6 3.8 9.2 5.4 9.8 7.2Z"/><path fill="${W}" d="M17 8.6C19 6.8 19.2 4.4 18.6 2.8C16.4 3.8 14.8 5.4 14.2 7.2Z"/>` +
    `<path fill="{C}" d="M8.6 11L11 12L8.8 13.2ZM15.4 11L13 12L15.2 13.2Z"/><circle cx="11" cy="16.2" r="0.8" fill="{C}"/><circle cx="13" cy="16.2" r="0.8" fill="{C}"/>`,
  Dark: `<path fill="${W}" d="M15.6 3.6A8.6 8.6 0 1 0 20.4 15.4A7.1 7.1 0 0 1 15.6 3.6Z"/>`,
  Steel:
    `<polygon points="12,3 19.8,7.5 19.8,16.5 12,21 4.2,16.5 4.2,7.5" fill="${W}"/><circle cx="12" cy="12" r="3.4" fill="{C}"/><circle cx="12" cy="12" r="1.6" fill="${W}"/>`,
  Fairy:
    `<path fill="${W}" d="M12 12L3.8 6.6V17.4Z"/><path fill="${W}" d="M12 12L20.2 6.6V17.4Z"/>` +
    `<path fill="${W}" d="M10.6 14.2L8.4 20.4L11.6 18.2Z"/><path fill="${W}" d="M13.4 14.2L15.6 20.4L12.4 18.2Z"/>` +
    `<circle cx="12" cy="12" r="2.6" fill="${W}" stroke="{C}" stroke-width="1"/>`,
  Stellar: `<polygon points="12,3 14.6,9.2 21.3,9.7 16.2,14.1 17.8,20.7 12,17.2 6.2,20.7 7.8,14.1 2.7,9.7 9.4,9.2" fill="${W}"/>`,
  "???":
    `<path d="M9 9.4A3 3 0 1 1 13.5 12C12.5 12.7 12 13.3 12 14.6" ${stroke('stroke-width="2.4"')}/><circle cx="12" cy="18.6" r="1.4" fill="${W}"/>`,
};

/** The inner SVG markup of a type's icon (symbol only, no background). */
export function glyphMarkup(type: string): string {
  const color = TYPE_ICON_COLOR[type] ?? TYPE_ICON_COLOR["???"];
  return (GLYPHS[type] ?? GLYPHS["???"]).replaceAll("{C}", color);
}
export const iconColor = (type: string) => TYPE_ICON_COLOR[type] ?? TYPE_ICON_COLOR["???"];
