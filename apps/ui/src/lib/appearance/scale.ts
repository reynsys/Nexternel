import { contrast, hexToOklch, lightnessForContrast, oklchToHex, type Oklch } from "./color";

export type Mode = "light" | "dark";

/**
 * Twelve shades of one colour, each with a fixed job (the Radix Colors model):
 *  1–2  page and frame backgrounds        3–5  control backgrounds: normal, pointed at, pressed
 *  6    quiet lines (dividers)           7–8  edges: of boxes, of controls (8 is the stronger)
 *  9    solid colour (buttons, chosen)    10   solid colour pointed at
 *  11   readable coloured text            12   strongest text
 * Index 0 is shade 1.
 */
export type Scale = string[];

/** Lightness of each shade (OKLCH L) — even steps to the eye, in either mode. Shades 9–10 come from the colour itself. */
const LIGHTNESS: Record<Mode, number[]> = {
  light: [0.99, 0.975, 0.95, 0.925, 0.9, 0.865, 0.815, 0.745, NaN, NaN, 0.47, 0.27],
  dark: [0.16, 0.19, 0.235, 0.275, 0.315, 0.36, 0.42, 0.5, NaN, NaN, 0.8, 0.94],
};

/** How colourful each shade is, as a share of the colour's own colourfulness. */
const CHROMA_SHARE = [0.06, 0.12, 0.25, 0.33, 0.42, 0.5, 0.6, 0.75, 1, 1, 0.85, 0.35];

/** Where a solid colour may sit so it reads as a colour (not near black or white) in each mode. */
const SOLID_BAND: Record<Mode, [number, number]> = { light: [0.45, 0.72], dark: [0.55, 0.8] };

/** Readable text on a solid colour: white or near black, whichever reads better. */
export const INK_LIGHT = "#FFFFFF";
export const INK_DARK = "#0B0D12";

export function inkOn(solid: string): string {
  return contrast(INK_LIGHT, solid) >= contrast(INK_DARK, solid) ? INK_LIGHT : INK_DARK;
}

/**
 * The twelve shades of `seed` for a mode. The solid shade keeps the chosen colour as closely as
 * possible; text shades are moved just far enough to stay readable on the background shades, and
 * the control edge shade just far enough to be seen (WCAG: text 4.5:1, strongest text 7:1, edges 3:1).
 */
export function buildScale(seed: string, mode: Mode, opts: { chroma?: number } = {}): Scale {
  const s = hexToOklch(seed);
  const chroma = Math.min(opts.chroma ?? s.c, 0.2);
  const [lo, hi] = SOLID_BAND[mode];
  const solidL = Math.min(hi, Math.max(lo, s.l));
  const at = (i: number, l: number): Oklch => ({ l, c: chroma * CHROMA_SHARE[i], h: s.h });
  const out: string[] = LIGHTNESS[mode].map((l, i) => (Number.isNaN(l) ? "" : oklchToHex(at(i, l))));

  // Solid colour, and the same pointed at (a little darker on light pages, lighter on dark ones).
  let solid: Oklch = { l: solidL, c: Math.min(s.c, 0.25), h: s.h };
  // Text on the solid colour must be readable: nudge the solid colour if neither ink reaches 4.5:1.
  const solidHex = oklchToHex(solid);
  if (contrast(inkOn(solidHex), solidHex) < 4.5) {
    const white = contrast(INK_LIGHT, solidHex) >= contrast(INK_DARK, solidHex);
    solid = { ...solid, l: lightnessForContrast(solid, white ? INK_LIGHT : INK_DARK, 4.5, white ? "darker" : "lighter") };
  }
  out[8] = oklchToHex(solid);
  out[9] = oklchToHex({ ...solid, l: solid.l + (mode === "light" ? -0.045 : 0.045) });

  const away = mode === "light" ? "darker" : "lighter";
  // Readable coloured text (11) on every background shade 1–4; strongest text (12) at 7:1.
  let text: Oklch = at(10, LIGHTNESS[mode][10]);
  for (const bg of out.slice(0, 4)) text = { ...text, l: lightnessForContrast(text, bg, 4.5, away) };
  out[10] = oklchToHex(text);
  let strong: Oklch = at(11, LIGHTNESS[mode][11]);
  for (const bg of out.slice(0, 4)) strong = { ...strong, l: lightnessForContrast(strong, bg, 7, away) };
  out[11] = oklchToHex(strong);
  // Edges of controls are seen against the backgrounds (3:1).
  let edge: Oklch = at(7, LIGHTNESS[mode][7]);
  for (const bg of out.slice(0, 2)) edge = { ...edge, l: lightnessForContrast(edge, bg, 3, away) };
  out[7] = oklchToHex(edge);
  return out;
}

/** The greys of a scheme: tinted very slightly with the main colour, so the page feels like one family. */
export function buildNeutralScale(main: string, mode: Mode, tint = 0.014): Scale {
  const { h } = hexToOklch(main);
  // Greys keep the same small colourfulness on every shade (no stronger middle).
  const grey = oklchToHex({ l: 0.6, c: tint, h });
  return buildScale(grey, mode, { chroma: tint * 2 });
}

/** How the second and third colours are found from the main one, on the colour wheel. */
export type Harmony = "split" | "analogous" | "triadic" | "complementary" | "custom";

export const HARMONIES: { id: Harmony; label: string; description: string }[] = [
  { id: "split", label: "Balanced", description: "The two neighbours of the main colour's opposite: lively but calm." },
  { id: "analogous", label: "Calm", description: "Neighbours of the main colour: soft and quiet." },
  { id: "triadic", label: "Vivid", description: "Three colours evenly spaced round the wheel: bold and playful." },
  { id: "complementary", label: "Contrast", description: "The main colour's opposite, with a neighbour of it: strong contrast." },
  { id: "custom", label: "My own", description: "Pick the second and third colours yourself." },
];

const OFFSETS: Record<Exclude<Harmony, "custom">, [number, number]> = {
  split: [150, 210],
  analogous: [35, -35],
  triadic: [120, 240],
  complementary: [180, 150],
};

/** The second and third colours suggested for a main colour (same colourfulness and lightness). */
export function harmonyColours(main: string, harmony: Exclude<Harmony, "custom">): [string, string] {
  const m = hexToOklch(main);
  const [a, b] = OFFSETS[harmony];
  const turn = (d: number) => oklchToHex({ l: m.l, c: Math.max(m.c, 0.08), h: (m.h + d + 360) % 360 });
  return [turn(a), turn(b)];
}
