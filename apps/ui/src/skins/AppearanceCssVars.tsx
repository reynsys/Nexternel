import { useMemo } from "react";
import { GlobalStyles } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { metricValueColorFromTheme } from "./metricColors";

/**
 * Appearance tokens as CSS variables — any widget/plugin can use these without
 * importing MUI (clock, future plugins, SVG, canvas).
 */
export function AppearanceCssVars() {
  const theme = useTheme();
  const vars = useMemo(() => {
    const accent = theme.palette.primary.main;
    const metricValue = metricValueColorFromTheme(theme);
    return {
      "--nx-accent": accent,
      "--nx-accent-soft": alpha(accent, theme.palette.mode === "dark" ? 0.72 : 0.55),
      "--nx-metric-value": metricValue,
      "--nx-text-primary": theme.palette.text.primary,
      "--nx-text-secondary": theme.palette.text.secondary,
      "--nx-surface-paper": theme.palette.background.paper,
      "--nx-divider": alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.22 : 0.18),
    } as Record<string, string>;
  }, [theme]);

  return <GlobalStyles styles={{ ":root": vars }} />;
}
