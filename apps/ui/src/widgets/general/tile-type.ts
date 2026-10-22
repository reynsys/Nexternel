/**
 * Type in the main tile of a generic panel.
 * Both sizes follow that tile's width. The title tile keeps the normal title size.
 *
 * The reading is the one large figure, such as the weather temperature. It follows the tile width.
 * Lines are a list of names and figures (genericTileFitLinesSize). They follow the tile height, so a
 * wide card does not turn each line into a headline and the list stays inside the tile.
 * The label is a short word, such as a weekday, a day number, a place, or a forecast.
 * A clock face is one drawing and does not use this list.
 */
export const genericTileReadingSize = "clamp(1rem, 8cqi, 4.5rem)";

/**
 * Text for a block of `lines` lines that must fit its tile (a list, a month): it follows the tile's
 * height (and, when given, its width), so a short tile shrinks the text instead of scrolling.
 * The box with the lines must be a size container (genericTileLinesQuerySx). `reservedPx` is the room
 * inside that box that is not text: its padding and the gaps between the lines.
 */
export function genericTileFitLinesSize(
  lines: number,
  opts: { reservedPx?: number; widthCqi?: number; max?: string } = {}
): string {
  const byHeight = `calc((100cqb - ${opts.reservedPx ?? 0}px) / ${(Math.max(1, lines) * 1.25).toFixed(2)})`;
  const size = opts.widthCqi ? `min(${opts.widthCqi}cqi, ${byHeight})` : byHeight;
  return `clamp(0.7rem, ${size}, ${opts.max ?? "1.15rem"})`;
}
export const genericTileLabelSize = "clamp(0.85rem, 3.6cqi, 2.25rem)";

/** Width query for a single figure or a short label. */
export const genericTileQuerySx = {
  containerType: "inline-size",
  width: "100%",
} as const;

/** Height query for a list of lines. The box already has a definite height from the tile. */
export const genericTileLinesQuerySx = {
  containerType: "size",
  width: "100%",
  height: "100%",
  minHeight: 0,
} as const;
