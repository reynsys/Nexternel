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
import { lookIdFromPrefs } from "../lib/look-choice";
import { resolveLook } from "./looks/registry";

export const THEME_PREFS_KEY = "nexternel.themePrefs";

export type ThemeMode = "light" | "dark";

export type ThemePrefs = {
  mode: ThemeMode;
  /** Primary accent hex */
  primary: string;
  /** Layout skin id (also kept in localStorage for offline boot) */
  skinId?: string;
  /** The dashboard's Look (Standard, Glass, or an installed Look pack). See skins/looks. */
  lookId?: string;
  /** The Look's moving decorations on (default) or off. Each panel can override it. */
  motion?: boolean;
  /**
   * Page gradient background id (`none` = solid theme background).
   * See gradientPalettes.ts
   */
  gradientId?: string;
  /**
   * Solid light/dark panels (true) or frosted glass over the background (false).
   * Follows the Look (withLook / normalizeThemePrefs); kept for older servers and backups.
   */
  solidContentPanels?: boolean;
  /** Animated background effect (`off` = none). See effects/catalog.ts */
  effectId?: BackgroundEffectId;
  effectAmount?: number;
  effectSpeed?: number;
  effectColour?: EffectColour;
  /** How status lights look by default (each panel can choose its own). */
  statusLight?: StatusLightPrefs;
  /** The notification bell: when it shows and where. */
  bell?: BellPrefs;
};

export type BellPrefs = { show: "always" | "new" | "never"; position: "menu" | "top" };

export const DEFAULT_BELL_PREFS: BellPrefs = { show: "always", position: "menu" };

export function normalizeBellPrefs(raw: unknown): BellPrefs {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return {
    show: o.show === "new" || o.show === "never" ? o.show : "always",
    position: o.position === "top" ? "top" : "menu",
  };
}

export type StatusLightPrefs = {
  style: "pill" | "bar" | "dots" | "glow" | "off";
  position: "title" | "reading";
  blink: boolean;
  colours: { ok: string; watch: string; alert: string };
};

export const DEFAULT_STATUS_LIGHT_PREFS: StatusLightPrefs = {
  style: "pill",
  position: "title",
  blink: true,
  colours: { ok: "#2FBF71", watch: "#F0A12F", alert: "#EF4D4D" },
};

export function normalizeStatusLightPrefs(raw: unknown): StatusLightPrefs {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const c = (o.colours && typeof o.colours === "object" ? o.colours : {}) as Record<string, unknown>;
  const d = DEFAULT_STATUS_LIGHT_PREFS;
  const hex = (v: unknown, fallback: string) => (typeof v === "string" ? normalizeAccentHex(v) : null) ?? fallback;
  return {
    style: ["pill", "bar", "dots", "glow", "off"].includes(o.style as string)
      ? (o.style as StatusLightPrefs["style"])
      : d.style,
    position: o.position === "reading" ? "reading" : "title",
    blink: typeof o.blink === "boolean" ? o.blink : d.blink,
    colours: { ok: hex(c.ok, d.colours.ok), watch: hex(c.watch, d.colours.watch), alert: hex(c.alert, d.colours.alert) },
  };
}

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
  lookId: "standard",
  motion: true,
  gradientId: GRADIENT_NONE_ID,
  solidContentPanels: true,
  effectId: "off",
  effectAmount: 1,
  effectSpeed: 1,
  effectColour: "white",
  statusLight: DEFAULT_STATUS_LIGHT_PREFS,
  bell: DEFAULT_BELL_PREFS,
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

  const effectId = normalizeEffectId(parsed.effectId);
  const lookId = lookIdFromPrefs({
    lookId: parsed.lookId,
    solidContentPanels: parsed.solidContentPanels,
    backdrop: gradientId !== GRADIENT_NONE_ID || effectId !== "off",
  });

  return {
    mode: parsed.mode === "light" ? "light" : "dark",
    primary: primaryRaw ?? DEFAULT_THEME_PREFS.primary,
    skinId:
      typeof parsed.skinId === "string" && parsed.skinId.trim()
        ? parsed.skinId.trim()
        : DEFAULT_THEME_PREFS.skinId,
    lookId,
    motion: parsed.motion !== false,
    gradientId,
    solidContentPanels: !resolveLook(lookId).frosted,
    effectId,
    effectAmount: normalizeEffectAmount(parsed.effectAmount),
    effectSpeed: normalizeEffectSpeed(parsed.effectSpeed),
    effectColour: normalizeEffectColour(parsed.effectColour),
    statusLight: normalizeStatusLightPrefs(parsed.statusLight),
    bell: normalizeBellPrefs(parsed.bell),
  };
}

/**
 * Choose a Look. A Look with a background of its own brings it along when the page has none,
 * and panels turn frosted or solid with it.
 */
export function withLook(prefs: ThemePrefs, lookId: string): ThemePrefs {
  const look = resolveLook(lookId);
  const plain =
    (!prefs.gradientId || prefs.gradientId === GRADIENT_NONE_ID) && (!prefs.effectId || prefs.effectId === "off");
  return {
    ...prefs,
    lookId,
    solidContentPanels: !look.frosted,
    ...(plain && look.defaultBackground ? { gradientId: look.defaultBackground } : {}),
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
    lookId: prefs.lookId ?? "standard",
    motion: prefs.motion !== false,
    gradientId: prefs.gradientId ?? GRADIENT_NONE_ID,
    solidContentPanels: Boolean(prefs.solidContentPanels),
    effectId: normalizeEffectId(prefs.effectId),
    effectAmount: normalizeEffectAmount(prefs.effectAmount),
    effectSpeed: normalizeEffectSpeed(prefs.effectSpeed),
    effectColour: normalizeEffectColour(prefs.effectColour),
    statusLight: normalizeStatusLightPrefs(prefs.statusLight),
    bell: normalizeBellPrefs(prefs.bell),
  };
}
