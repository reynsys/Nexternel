import { CONTROL_TEXT, CONTROL_VALUE_WEIGHT } from "../../lib/appearance/type";

/** Shared by every device control, so panels side by side match under every Look. */
/** The size every control is laid out at. It is then shrunk or grown whole, so a panel of any size has all its content. */
export const CONTROL_DESIGN = { width: 260, height: 290 };

/** Below this there is no room for the picture: the one-line panel. */
export function controlFitsOneLine(width: number, height: number): boolean {
  return height < 130 || width < 140;
}

/** The one-line panel is laid out at this size, and shrunk or grown whole the same way. */
export const CONTROL_LINE_DESIGN = { width: 300, height: 82 };

/** How much to shrink or grow the control to fit the panel. */
export function controlScale(width: number, height: number, design: { width: number; height: number } = CONTROL_DESIGN): number {
  return Math.min(width / design.width, height / design.height);
}

export const CTRL = {
  track: "color-mix(in srgb, currentColor 20%, transparent)",
  raised: "color-mix(in srgb, currentColor 7%, transparent)",
  caption: { fontSize: CONTROL_TEXT.caption, fontWeight: "fontWeightBold", lineHeight: 1.2, color: "text.secondary" },
  big: { fontSize: CONTROL_TEXT.picture, fontWeight: CONTROL_VALUE_WEIGHT, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" },
  /** The two rows under the main picture. */
  rowTall: 52,
  rowLow: 38,
  gap: 1,
} as const;

/** Pictures of real things, the same under every Look. */
export const BLIND_VIEW = "linear-gradient(180deg, #4d84b5, #a9c8dc 70%, #d9c8a0)";
export const BLIND_SLATS = "repeating-linear-gradient(180deg, #d8d9dc 0 9px, #a5a6ab 9px 11px)";
