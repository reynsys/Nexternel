import { alpha, type Theme } from "@mui/material/styles";
import { gradientCss } from "./gradientPalettes";
import type { ThemePrefs } from "./themePrefs";
import { resolveLook } from "./looks/registry";
import type { LookTokens } from "./looks/types";

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

/** The one main-tile surface. Every panel uses this border and fill. */
export function nestedContentPanelSx(
  theme: Theme,
  gradientActive: boolean,
  solidContentPanels = false
) {
  if (gradientActive && !solidContentPanels) {
    return {
      border: `var(--nx-tile-border, 1px solid ${theme.palette.divider})`,
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

/*
 * Shared pieces for hand-built parts: they take their look from the chosen Look's roles
 * (theme.nx, see skins/look-theme.ts), so a Look restyles them like every building block.
 */

/** An option tile in a picker (Looks, backgrounds, effects, icons, switch styles). */
export function choiceSx(selected: boolean, opts: { hover?: boolean; quiet?: boolean; radius?: "inset" | "field" } = {}) {
  return (t: Theme) => {
    const n = t.nx;
    return {
      borderRadius: opts.radius === "field" ? 1 : 1.5,
      border: selected ? n.choiceSelectedBorder : opts.quiet ? "1px solid transparent" : n.choiceBorder,
      backgroundColor: selected ? n.choiceSelectedFill : n.choiceFill,
      boxShadow: selected ? n.choiceSelectedShadow : opts.quiet ? "none" : n.choiceShadow,
      ...(opts.hover ? { "&:hover": { backgroundColor: selected ? n.choiceSelectedFill : t.palette.action.hover } } : {}),
    };
  };
}

/** A box inside a card: <Paper variant="inset"> and insetSx share this. */
export function insetStyle(t: LookTokens) {
  return {
    border: t.insetBorder,
    borderRadius: `${t.radiusUnit * 1.5}px`,
    backgroundColor: t.insetFill,
    boxShadow: t.insetShadow,
  };
}

/** A box inside a card, for parts that cannot be a <Paper variant="inset"> (list rows, tables). */
export function insetSx() {
  return (t: Theme) => insetStyle(t.nx);
}

/** A dashboard section (the box around a group of panels). Clear over a page background. */
export function sectionSx(gradientActive: boolean) {
  return (t: Theme) => ({
    border: t.nx.sectionBorder,
    borderRadius: t.nx.sectionRadius,
    boxShadow: gradientActive ? "none" : t.nx.sectionShadow,
    ...(gradientActive ? { backgroundColor: "transparent", backgroundImage: "none" } : { backgroundColor: t.nx.sectionFill }),
  });
}
