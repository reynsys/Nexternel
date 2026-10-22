import type { Theme } from "@mui/material/styles";
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
    prefs.gradientId === "mine-glow" ||
    prefs.gradientId === "mine-gradient" ||
    (Boolean(prefs.effectId) && prefs.effectId !== "off") ||
    // A Look with its own background (3D, HUD) counts as one: menus turn clear over it.
    Boolean(resolveLook(prefs.lookId).background)
  );
}

/** See-through surfaces (the Glass style) blur what is behind them; solid ones do not. */
const blurOf = (t: Theme, px: number) => (t.nxScheme?.surfaces === "glass" ? GLASS_BLUR(px) : "none");

/*
 * Surfaces take their fill from the Appearance engine's roles (theme.nxScheme): the chosen style
 * decides whether they are solid or see-through, the same for every part. The old "is there a
 * background picture" switch is no longer used (kept in the signatures for older callers).
 */

/** Frames: side menu, dashboard sections. */
export function chromeSurfaceSx(_gradientActive?: boolean) {
  return {
    bgcolor: (t: Theme) => t.nxScheme.surface.frame,
    backgroundImage: "none",
    backdropFilter: (t: Theme) => blurOf(t, 14),
  };
}

/** Bars that stay while the page scrolls under them (top bar, bottom menu, page bar): frames too. */
export function barSurfaceSx(_gradientActive?: boolean) {
  return chromeSurfaceSx();
}

/** Panel fill as plain style values (for theme overrides). */
export function contentPanelStyles(theme: Theme, _opts?: { gradientActive: boolean; solidContentPanels: boolean }) {
  const glass = theme.nxScheme?.surfaces === "glass";
  return {
    backgroundColor: theme.nxScheme?.surface.panel ?? theme.palette.background.paper,
    backgroundImage: glass ? GLASS_TINT : "none",
    backdropFilter: glass ? GLASS_BLUR(10) : "none",
    WebkitBackdropFilter: glass ? GLASS_BLUR(10) : "none",
  };
}

/** The one main-tile surface inside a panel. Every panel uses this border and fill. */
export function nestedContentPanelSx(theme: Theme, _gradientActive?: boolean, _solidContentPanels = false) {
  return {
    border: `var(--nx-tile-border, 1px solid ${theme.nxScheme?.line.divider ?? theme.palette.divider})`,
    borderRadius: "var(--nx-tile-radius, 20px)",
    boxShadow: "var(--nx-tile-shadow, none)",
    bgcolor: `var(--nx-tile-fill, ${theme.nxScheme?.surface.control ?? theme.palette.background.paper})`,
  };
}

/** Panel fill. */
export function contentSurfaceSx(_gradientActive?: boolean, _solidContentPanels = false) {
  return {
    bgcolor: (t: Theme) => t.nxScheme.surface.panel,
    backgroundImage: (t: Theme) => (t.nxScheme.surfaces === "glass" ? GLASS_TINT : "none"),
    backdropFilter: (t: Theme) => blurOf(t, 10),
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

/** A dashboard section (the box around a group of panels): a frame. */
export function sectionSx(_gradientActive?: boolean) {
  return (t: Theme) => ({
    border: t.nx.sectionBorder,
    borderRadius: t.nx.sectionRadius,
    padding: t.nx.sectionInset,
    boxShadow: t.nx.sectionShadow,
    backgroundColor: t.nx.sectionFill,
    backgroundImage: "none",
    backdropFilter: blurOf(t, 14),
  });
}
