/** Browser prefs for theme / appearance. */

import {
  GRADIENT_NONE_ID,
  getGradientPalette,
  mixHexColors,
} from "./gradientPalettes";
import {
  normalizeEffectAmount,
  normalizeEffectColour,
  normalizeEffectId,
  normalizeEffectSpeed,
  type BackgroundEffectId,
  type EffectColour,
} from "./effects/catalog";

export const THEME_PREFS_KEY = "nexternel.themePrefs";

export type ThemeMode = "light" | "dark";

export type ThemePrefs = {
  mode: ThemeMode;
  /** Primary accent hex */
  primary: string;
  /** Layout skin id (also kept in localStorage for offline boot) */
  skinId?: string;
  /**
   * Page gradient background id (`none` = solid theme background).
   * See gradientPalettes.ts
   */
  gradientId?: string;
  /**
   * When a gradient is on: keep Cards / widgets / tables as solid light/dark
   * paper (true), or frosted glass over the gradient (false).
   */
  solidContentPanels?: boolean;
  /** Animated background effect (`off` = none). See effects/catalog.ts */
  effectId?: BackgroundEffectId;
  effectAmount?: number;
  effectSpeed?: number;
  effectColour?: EffectColour;
};

/** Solid accent swatches — kept as flat colours (MUI primary needs one hex). */
export const PRIMARY_SWATCHES: { id: string; label: string; color: string }[] = [
  // Blues
  { id: "blue", label: "Blue", color: "#1A73E8" },
  { id: "info", label: "Sky", color: "#49a3f1" },
  { id: "azure", label: "Azure", color: "#0288D1" },
  { id: "navy", label: "Navy", color: "#1B3A4B" },
  { id: "indigo", label: "Indigo", color: "#3F51B5" },
  // Teals / greens
  { id: "teal", label: "Teal", color: "#00897B" },
  { id: "cyan", label: "Cyan", color: "#00ACC1" },
  { id: "success", label: "Green", color: "#66BB6A" },
  { id: "forest", label: "Forest", color: "#2E7D32" },
  { id: "lime", label: "Lime", color: "#9CCC65" },
  // Warm
  { id: "warning", label: "Amber", color: "#FFA726" },
  { id: "orange", label: "Orange", color: "#FB8C00" },
  { id: "deep-orange", label: "Deep orange", color: "#F4511E" },
  { id: "coral", label: "Coral", color: "#FF6F61" },
  { id: "error", label: "Red", color: "#EF5350" },
  { id: "crimson", label: "Crimson", color: "#C62828" },
  // Purples / pinks
  { id: "purple", label: "Purple", color: "#8E24AA" },
  { id: "violet", label: "Violet", color: "#7E57C2" },
  { id: "pink", label: "Pink", color: "#EC407A" },
  { id: "magenta", label: "Magenta", color: "#D81B60" },
  // Neutrals
  { id: "dark", label: "Slate", color: "#344767" },
  { id: "charcoal", label: "Charcoal", color: "#37474F" },
  { id: "brown", label: "Brown", color: "#8D6E63" },
  { id: "gold", label: "Gold", color: "#C9A227" },
];

export const DEFAULT_THEME_PREFS: ThemePrefs = {
  mode: "dark",
  primary: PRIMARY_SWATCHES[0]!.color,
  skinId: "mui-dashboard",
  gradientId: GRADIENT_NONE_ID,
  solidContentPanels: false,
  effectId: "off",
  effectAmount: 1,
  effectSpeed: 1,
  effectColour: "white",
};

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export function isValidAccentHex(value: string): boolean {
  return HEX6.test(value.trim());
}

export function normalizeAccentHex(value: string): string | null {
  let v = value.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const r = v[1]!;
    const g = v[2]!;
    const b = v[3]!;
    v = `#${r}${r}${g}${g}${b}${b}`;
  }
  return isValidAccentHex(v) ? v.toUpperCase() : null;
}

/** Solid accent taken from the active page gradient (start / mid / end). */
export function accentFromGradient(
  gradientId: string | null | undefined,
  which: "from" | "to" | "mid" = "from"
): string | null {
  const p = getGradientPalette(gradientId);
  if (!p) return null;
  if (which === "from") return p.from.toUpperCase();
  if (which === "to") return p.to.toUpperCase();
  return mixHexColors(p.from, p.to).toUpperCase();
}

export function normalizeThemePrefs(raw: unknown): ThemePrefs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_THEME_PREFS };
  }
  const parsed = raw as Partial<ThemePrefs>;
  const gradientRaw =
    typeof parsed.gradientId === "string" ? parsed.gradientId.trim() : GRADIENT_NONE_ID;
  const gradientId =
    !gradientRaw || gradientRaw === GRADIENT_NONE_ID
      ? GRADIENT_NONE_ID
      : getGradientPalette(gradientRaw)
        ? gradientRaw
        : GRADIENT_NONE_ID;

  const primaryRaw =
    typeof parsed.primary === "string" ? normalizeAccentHex(parsed.primary) : null;

  return {
    mode: parsed.mode === "light" ? "light" : "dark",
    primary: primaryRaw ?? DEFAULT_THEME_PREFS.primary,
    skinId:
      typeof parsed.skinId === "string" && parsed.skinId.trim()
        ? parsed.skinId.trim()
        : DEFAULT_THEME_PREFS.skinId,
    gradientId,
    solidContentPanels: Boolean(parsed.solidContentPanels),
    effectId: normalizeEffectId(parsed.effectId),
    effectAmount: normalizeEffectAmount(parsed.effectAmount),
    effectSpeed: normalizeEffectSpeed(parsed.effectSpeed),
    effectColour: normalizeEffectColour(parsed.effectColour),
  };
}

export function getThemePrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(THEME_PREFS_KEY);
    if (!raw) return { ...DEFAULT_THEME_PREFS };
    return normalizeThemePrefs(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_THEME_PREFS };
  }
}

export function setThemePrefs(prefs: ThemePrefs): void {
  localStorage.setItem(THEME_PREFS_KEY, JSON.stringify(prefs));
}

/** Shape stored on the user account / sent to API. */
export function toAccountThemePrefs(prefs: ThemePrefs, skinId: string) {
  return {
    mode: prefs.mode,
    primary: prefs.primary,
    skinId: prefs.skinId ?? skinId,
    gradientId: prefs.gradientId ?? GRADIENT_NONE_ID,
    solidContentPanels: Boolean(prefs.solidContentPanels),
    effectId: normalizeEffectId(prefs.effectId),
    effectAmount: normalizeEffectAmount(prefs.effectAmount),
    effectSpeed: normalizeEffectSpeed(prefs.effectSpeed),
    effectColour: normalizeEffectColour(prefs.effectColour),
  };
}
