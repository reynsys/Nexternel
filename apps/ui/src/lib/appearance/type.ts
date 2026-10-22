/**
 * Nexternel's type scale: every text kind has one size and weight, used everywhere (MUI's text
 * variants are set from it in skins/look-theme.ts). Parts of the screen pick a kind, never a size.
 *
 *   page title     h4         1.5rem   bold        Settings, Dashboards
 *   (title)        h5         1.25rem  bold
 *   section title  h6         1.125rem bold        dashboard sections, side panels, cards
 *   group heading  subtitle1  1rem     bold        groups of settings
 *   sub-heading    subtitle2  0.875rem bold        a setting's name
 *   normal text    body1/2    0.9375 / 0.875rem
 *   small label    caption    0.75rem              notes, hints, times
 *   tiny label     overline   0.6875rem bold, capitals
 *   panel title / area line: PANEL_TITLE / PANEL_AREA (lib/panel-heading.ts)
 *   big value: sized by its tile (shared sizes in widgets/general/tile-type.ts), weight VALUE_WEIGHT
 */
export const TYPE_SCALE = {
  h4: { fontSize: "1.5rem", fontWeight: 650, lineHeight: 1.25 },
  h5: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 },
  h6: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.35 },
  subtitle1: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.45 },
  subtitle2: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.45 },
  body1: { fontSize: "0.9375rem", fontWeight: 400, lineHeight: 1.5 },
  body2: { fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.5 },
  caption: { fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.45 },
  overline: { fontSize: "0.6875rem", fontWeight: 600, lineHeight: 1.6, letterSpacing: "0.06em" },
  button: { fontSize: "0.875rem", fontWeight: 500 },
} as const;

/** The two emphasis weights a part may ask for (as theme keys, e.g. fontWeight: "fontWeightBold"). */
export const WEIGHTS = { regular: 400, medium: 500, bold: 600 } as const;

/** Inside a panel with several readings: each reading's name and area line, and a reading in a list. */
export const ITEM_TITLE_SIZE = "0.75rem";
export const ITEM_AREA_SIZE = "0.6875rem";
export const LIST_VALUE_SIZE = "0.95rem";

/** Weight of big values (temperatures, clock, energy). */
export const VALUE_WEIGHT = 650;

/** Text in a fixed-width font (codes, logs). */
export const CODE_TEXT = { fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace', fontSize: "0.8125rem" } as const;

/** Icon sizes by job (px): inline with text, in a title row, in a picker, a large empty-state picture. */
export const ICON_SIZE = { inline: 16, title: 18, picker: 26, feature: 36, empty: 48 } as const;

/**
 * Text inside panels, sized by its tile's width and height (CSS container units: the tile is a size
 * container), so it fills a big tile and shrinks in a small or short one. Every panel uses these.
 */
export const PANEL_TEXT = {
  /** A big value that has its tile to itself (one reading, the clock). */
  value: "clamp(1rem, min(18cqi, 42cqb), 3.75rem)",
  /** A value in a small tile among several (multi-reading panels). */
  valueCompact: "clamp(0.75rem, min(18cqi, 42cqb), 1.65rem)",
  /** A value that shares its tile with other things (the weather temperature). */
  valueShared: "clamp(1.1rem, min(9cqi, 24cqb), 3.6rem)",
  /** The unit next to a value. */
  unit: "clamp(0.65rem, min(10cqi, 22cqb), 1.35rem)",
  /** Small labels inside a tile (weekdays, forecast lines). */
  label: "clamp(0.72rem, min(3.4cqi, 7.5cqb), 1.3rem)",
  /** A picture that goes with a value (the weather icon). */
  picture: "clamp(1.4rem, min(8cqi, 22cqb), 3rem)",
} as const;
