import { alpha, type Theme } from "@mui/material/styles";
import { gradientCss } from "./gradientPalettes";
import type { ThemePrefs } from "./themePrefs";
import { resolveLook } from "./looks/registry";

/*
 * Frosted glass blurs whatever is behind it. Over a moving background effect that blur must be
 * redone every frame (it halved the frame rate in tests), so while an effect runs
 * BackgroundEffects sets --nx-glass-blur to none and adds --nx-glass-tint, a thicker fill instead.
 */
const GLASS_BLUR = (px: number) => `var(--nx-glass-blur, blur(${px}px))`;
const GLASS_TINT = "linear-gradient(var(--nx-glass-tint, transparent), var(--nx-glass-tint, transparent))";

/**
 * True when the page has a backdrop to show through — a gradient or soft-glow background, or a
 * background effect. Chrome then turns transparent and panels frosted (unless solid is chosen).
 */
export function isGradientActive(prefs: Pick<ThemePrefs, "gradientId" | "effectId" | "lookId">): boolean {
  return (
    Boolean(gradientCss(prefs.gradientId)) ||
    (Boolean(prefs.effectId) && prefs.effectId !== "off") ||
    // A Look with its own background (3D, HUD) counts as one: menus turn clear over it.
    Boolean(resolveLook(prefs.lookId).background)
  );
}

/**
 * Chrome surfaces (side menu, dashboard section shells) — fully clear so the
 * fixed page gradient shows through.
 */
export function chromeSurfaceSx(gradientActive: boolean) {
  if (!gradientActive) {
    return { bgcolor: "background.paper" as const };
  }
  return {
    bgcolor: "transparent",
    backgroundImage: "none",
  };
}

/**
 * Bars and menus that stay in place while the page scrolls under them (phone top bar, bottom
 * menu, slide-out menu). With a background they keep a near-solid tint, so scrolled panels
 * never show through their text.
 */
export function barSurfaceSx(gradientActive: boolean) {
  if (!gradientActive) {
    return { bgcolor: "background.paper" as const };
  }
  return {
    bgcolor: (t: Theme) => alpha(t.palette.background.default, 0.9),
    backgroundImage: "none",
  };
}

/** Shared frosted / solid styles for panels. */
export function contentPanelStyles(
  theme: Theme,
  opts: { gradientActive: boolean; solidContentPanels: boolean }
) {
  if (!opts.gradientActive || opts.solidContentPanels) {
    return {
      backgroundColor: theme.palette.background.paper,
      backgroundImage: "none",
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
    };
  }
  return {
    backgroundColor: alpha(
      theme.palette.background.paper,
      theme.palette.mode === "dark" ? 0.42 : 0.55
    ),
    backgroundImage: GLASS_TINT,
    backdropFilter: GLASS_BLUR(10),
    WebkitBackdropFilter: GLASS_BLUR(10),
  };
}

/** Metric tiles inside dashboard widgets — nested on a content panel. */
export function metricTileSurfaceSx(
  theme: Theme,
  gradientActive: boolean,
  solidContentPanels = false
) {
  const accent = theme.palette.primary.main;
  const base = {
    border: "1px solid",
    borderColor: alpha(accent, theme.palette.mode === "dark" ? 0.32 : 0.24),
    borderRadius: 8,
  };
  if (gradientActive && !solidContentPanels) {
    return {
      ...base,
      backgroundColor: alpha(
        theme.palette.background.paper,
        theme.palette.mode === "dark" ? 0.58 : 0.68
      ),
      backgroundImage: GLASS_TINT,
      backdropFilter: GLASS_BLUR(8),
      WebkitBackdropFilter: GLASS_BLUR(8),
    };
  }
  return {
    ...base,
    bgcolor: alpha(accent, theme.palette.mode === "dark" ? 0.1 : 0.07),
  };
}

/** The one main-tile surface. Every panel uses this border and fill. */
export function nestedContentPanelSx(
  theme: Theme,
  gradientActive: boolean,
  solidContentPanels = false
) {
  if (gradientActive && !solidContentPanels) {
    return {
      border: "1px solid",
      borderColor: "divider",
      borderRadius: "var(--nx-tile-radius, 20px)",
      ...contentPanelStyles(theme, { gradientActive, solidContentPanels }),
    };
  }
  return {
    border: `var(--nx-tile-border, 1px solid ${theme.palette.divider})`,
    borderRadius: "var(--nx-tile-radius, 20px)",
    boxShadow: "var(--nx-tile-shadow, none)",
    bgcolor: `var(--nx-tile-fill, ${alpha(
      theme.palette.text.primary,
      theme.palette.mode === "dark" ? 0.06 : 0.04
    )})`,
  };
}

/**
 * Panel fill — frosted over the gradient, or solid light/dark
 * when Appearance → “Solid content panels” is on.
 */
export function contentSurfaceSx(
  gradientActive: boolean,
  solidContentPanels = false
) {
  if (!gradientActive || solidContentPanels) {
    return { bgcolor: "background.paper" as const };
  }
  return {
    bgcolor: (t: Theme) =>
      alpha(t.palette.background.paper, t.palette.mode === "dark" ? 0.42 : 0.55),
    backgroundImage: GLASS_TINT,
    backdropFilter: GLASS_BLUR(10),
    WebkitBackdropFilter: GLASS_BLUR(10),
  };
}
