import { useEffect, useMemo } from "react";
import { GlobalStyles } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { metricValueColorFromTheme } from "./metricColors";
import { resolveLook } from "./looks/registry";
import { chosenLookButtons } from "../lib/look-font";

/**
 * Appearance tokens as CSS variables — any widget/plugin can use these without
 * importing MUI (clock, future plugins, SVG, canvas). The Look's shape tokens are here too
 * (--nx-panel-radius and friends), and its id is on <html data-nx-look>.
 */
export function AppearanceCssVars({
  lookId,
  buttonsId,
  looksVersion = 0,
}: {
  lookId?: string;
  /** The person's button style choice (used when the Look offers button styles). */
  buttonsId?: string;
  looksVersion?: number;
}) {
  const theme = useTheme();
  // looksVersion: a Look from an add-on may arrive after the first draw.
  const look = useMemo(() => resolveLook(lookId), [lookId, looksVersion]);
  const vars = useMemo(() => {
    const accent = theme.palette.primary.main;
    const metricValue = metricValueColorFromTheme(theme);
    const t = theme.nx;
    return {
      "--nx-accent": accent,
      "--nx-accent-soft": alpha(accent, theme.palette.mode === "dark" ? 0.72 : 0.55),
      "--nx-metric-value": metricValue,
      "--nx-text-primary": theme.palette.text.primary,
      "--nx-text-secondary": theme.palette.text.secondary,
      "--nx-surface-paper": theme.palette.background.paper,
      "--nx-divider": alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.22 : 0.18),
      "--nx-panel-radius": t.panelRadius,
      "--nx-panel-border": t.panelBorder,
      "--nx-panel-shadow": t.panelShadow,
      "--nx-main-tile-radius": t.mainTileRadius,
      "--nx-tile-radius": t.tileRadius,
      "--nx-mini-panel-radius": t.miniPanelRadius,
      "--nx-mini-panel-border": t.miniPanelBorder,
      "--nx-panel-inset": t.panelInset,
      // Space between neighbouring buttons / menu entries, with room for the Look's button decoration.
      "--nx-decor-reach": t.decorReach,
      "--nx-control-gap": `calc(${t.controlGap} + 2 * ${t.decorReach})`,
      "--nx-list-gap": `calc(8px + 2 * ${t.decorReach})`,
      "--nx-title-inset": t.titleInset,
      "--nx-heading-case": t.headingCase,
      "--nx-heading-spacing": t.headingSpacing,
      "--nx-control-radius": t.controlRadius,
      "--nx-pill-radius": t.pillRadius,
      "--nx-control-surface": t.controlSurface,
      "--nx-control-raise": t.controlRaise,
      "--nx-control-press": t.controlPress,
      "--nx-knob": t.knob,
      "--nx-knob-shadow": t.knobShadow,
      "--nx-track-on": t.trackOn,
      "--nx-accent-ink": t.accentInk,
      "--nx-accent-pale": t.accentSoft,
      "--nx-chip": t.chip,
      "--nx-glow": t.glow,
      "--nx-text-glow": t.textGlow,
      ...(t.gearFill ? { "--nx-gear-fill": t.gearFill } : {}),
      ...(t.gearStroke ? { "--nx-gear-stroke": t.gearStroke } : {}),
      ...(t.gearStrokeWidth ? { "--nx-gear-stroke-width": t.gearStrokeWidth } : {}),
      ...(t.gearShadow ? { "--nx-gear-shadow": t.gearShadow } : {}),
      ...(t.panelFill ? { "--nx-panel-fill": t.panelFill } : {}),
      ...(t.tileFill ? { "--nx-tile-fill": t.tileFill } : {}),
      ...(t.tileBorder ? { "--nx-tile-border": t.tileBorder } : {}),
      ...(t.tileShadow ? { "--nx-tile-shadow": t.tileShadow } : {}),
    } as Record<string, string>;
  }, [theme, look]);

  useEffect(() => {
    document.documentElement.setAttribute("data-nx-look", look.id);
  }, [look.id]);

  // The chosen button style, for the Look's css: <html data-nx-buttons="id">.
  const buttons = chosenLookButtons(look, buttonsId)?.id;
  useEffect(() => {
    if (buttons) document.documentElement.setAttribute("data-nx-buttons", buttons);
    else document.documentElement.removeAttribute("data-nx-buttons");
  }, [buttons]);

  // The Look's own CSS (fonts, frames, per-Look switch details) in one <style>, replaced on change.
  useEffect(() => {
    const id = "nx-look-css";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!look.css) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = look.css;
  }, [look.css]);

  return <GlobalStyles styles={{ ":root": vars }} />;
}
