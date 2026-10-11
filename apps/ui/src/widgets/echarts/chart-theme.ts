import { alpha, type Theme } from "@mui/material/styles";

/** Colours derived from System → Appearance (MUI theme). */
export type EchartsThemePalette = {
  accent: string;
  accentSoft: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  splitLine: string;
  background: string;
  isDark: boolean;
};

export function echartsPaletteFromTheme(theme: Theme): EchartsThemePalette {
  const mode = theme.palette.mode;
  const accent = theme.palette.primary.main;
  return {
    accent,
    accentSoft: alpha(accent, mode === "dark" ? 0.45 : 0.35),
    textPrimary: theme.palette.text.primary,
    textSecondary: theme.palette.text.secondary,
    textMuted: alpha(theme.palette.text.primary, mode === "dark" ? 0.65 : 0.55),
    splitLine: alpha(theme.palette.text.primary, mode === "dark" ? 0.22 : 0.18),
    background: theme.palette.background.paper,
    isDark: mode === "dark",
  };
}

/**
 * Theme passed to echarts.init.
 * Light cards use ECharts' default theme, which leaves the background clear.
 * The built-in "dark" theme paints its own near-black, which does not match
 * the dashboard card, so a dark card gets a clear background and the card's
 * own text colours, with dark mode turned on.
 */
export function echartsInitTheme(theme: Theme): Record<string, unknown> | undefined {
  if (theme.palette.mode !== "dark") return undefined;
  const text = theme.palette.text.primary;
  const secondary = theme.palette.text.secondary;
  const split = theme.palette.divider;
  const axis = {
    axisLine: { lineStyle: { color: split } },
    axisTick: { lineStyle: { color: split } },
    axisLabel: { color: secondary },
    splitLine: { lineStyle: { color: split } },
  };
  return {
    darkMode: true,
    backgroundColor: "transparent",
    textStyle: { color: text },
    title: {
      textStyle: { color: text },
      subtextStyle: { color: secondary },
    },
    legend: { textStyle: { color: secondary } },
    tooltip: {
      backgroundColor: theme.palette.background.paper,
      borderColor: split,
      textStyle: { color: text },
    },
    categoryAxis: axis,
    valueAxis: axis,
    timeAxis: axis,
    logAxis: axis,
    gauge: {
      title: { color: secondary },
      axisLabel: { color: secondary },
      detail: { color: text },
      axisLine: { lineStyle: { color: [[1, split]] } },
    },
  };
}
