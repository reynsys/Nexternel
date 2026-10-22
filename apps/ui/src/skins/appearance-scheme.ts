import { buildScheme, type Scheme } from "../lib/appearance/scheme";
import { mix, withAlpha } from "../lib/appearance/color";
import { getGradientPalette, gradientBaseColour, GRADIENT_NONE_ID } from "./gradientPalettes";
import type { ThemePrefs } from "./themePrefs";

/** Backgrounds made from the person's own colours (Settings → Appearance → Background). */
export const MINE_GLOW_ID = "mine-glow";
export const MINE_GRADIENT_ID = "mine-gradient";
export const isMineBackground = (id: string | null | undefined) => id === MINE_GLOW_ID || id === MINE_GRADIENT_ID;

/** The light or dark mode in use: the device's when Automatic, else the chosen one. */
export function shownMode(prefs: Pick<ThemePrefs, "mode" | "autoMode">, deviceDark: boolean): "light" | "dark" {
  return prefs.autoMode ? (deviceDark ? "dark" : "light") : prefs.mode;
}

const hexOf = (rgb: [number, number, number]) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** The colours a ready-made background shows, so see-through surfaces can be checked over each. */
function paletteColours(gradientId: string | undefined, mode: "light" | "dark"): string[] {
  const p = getGradientPalette(gradientId);
  if (!p) return [];
  const base = gradientBaseColour(gradientId, mode) ?? (mode === "dark" ? "#0b0e14" : "#f2f4f8");
  if (p.glow) return [base, ...p.glow.pools.map((c) => mix(hexOf(c), base, 0.55))];
  return [p.from, p.to, mix(p.from, p.to, 0.5)];
}

/**
 * A background made from the scheme's own colours (glow pools or a soft gradient): a CSS
 * background-image (layers only — the page colour under it is the scheme's page colour).
 */
export function mineBackground(scheme: Scheme, kind: string): { css: string; colours: string[] } {
  const r = scheme.roles;
  const bg = r.surfaceSolid.background;
  const dark = r.mode === "dark";
  if (kind === MINE_GLOW_ID) {
    const a = dark ? 0.35 : 0.22;
    const pools = [scheme.scales.main[8], scheme.scales.second[8], scheme.scales.third[8]];
    return {
      css: `radial-gradient(60% 55% at 12% 15%, ${withAlpha(pools[0], a)}, transparent 70%), radial-gradient(55% 50% at 90% 85%, ${withAlpha(pools[1], a)}, transparent 70%), radial-gradient(45% 45% at 70% 10%, ${withAlpha(pools[2], a * 0.8)}, transparent 70%)`,
      colours: [bg, ...pools.map((p) => mix(p, bg, a))],
    };
  }
  const from = mix(scheme.scales.main[8], bg, dark ? 0.45 : 0.3);
  const to = mix(scheme.scales.second[8], bg, dark ? 0.4 : 0.25);
  return { css: `linear-gradient(135deg, ${from}, ${bg} 50%, ${to})`, colours: [from, bg, to] };
}

/**
 * The person's scheme: their mode, colours and harmony, with surfaces solid or see-through as the
 * chosen style is, checked for readability over the background they chose.
 */
export function schemeForPrefs(prefs: ThemePrefs, mode: "light" | "dark", frosted: boolean): Scheme {
  const input = {
    mode,
    surfaces: frosted ? ("glass" as const) : ("solid" as const),
    main: prefs.primary,
    harmony: prefs.harmony ?? "split",
    second: prefs.second,
    third: prefs.third,
    status: prefs.statusLight?.colours,
  };
  if (!frosted || !prefs.gradientId || prefs.gradientId === GRADIENT_NONE_ID) return buildScheme(input);
  // See-through surfaces are checked over the background's own colours.
  const colours = isMineBackground(prefs.gradientId)
    ? mineBackground(buildScheme(input), prefs.gradientId).colours
    : paletteColours(prefs.gradientId, mode);
  return buildScheme({ ...input, backgroundColours: colours });
}
