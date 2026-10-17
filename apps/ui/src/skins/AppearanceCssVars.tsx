import { useEffect, useMemo } from "react";
import { GlobalStyles } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { metricValueColorFromTheme } from "./metricColors";
import { resolveLook } from "./looks/registry";

/**
 * Appearance tokens as CSS variables — any widget/plugin can use these without
 * importing MUI (clock, future plugins, SVG, canvas). The Look's shape tokens are here too
 * (--nx-panel-radius and friends), and its id is on <html data-nx-look>.
 */
export function AppearanceCssVars({ lookId }: { lookId?: string }) {
  const theme = useTheme();
  const look = resolveLook(lookId);
  const vars = useMemo(() => {
    const accent = theme.palette.primary.main;
    const metricValue = metricValueColorFromTheme(theme);
    const t = look.tokens(theme);
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
    } as Record<string, string>;
  }, [theme, look]);

  useEffect(() => {
    document.documentElement.setAttribute("data-nx-look", look.id);
  }, [look.id]);

  return <GlobalStyles styles={{ ":root": vars }} />;
}
