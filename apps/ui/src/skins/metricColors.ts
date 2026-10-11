import { getContrastRatio, type Theme } from "@mui/material/styles";

/** Minimum contrast for metric values on panel backgrounds (WCAG-ish for large text). */
const MIN_METRIC_CONTRAST = 3;

export type MetricColorPalette = {
  accent: string;
  textPrimary: string;
  background: string;
};

/**
 * Pick a foreground that stays readable on the given background.
 * Used by gauges (ECharts) and React metric tiles.
 */
export function readableOnBackground(fg: string, bg: string, fallback: string): string {
  try {
    if (getContrastRatio(fg, bg) >= MIN_METRIC_CONTRAST) return fg;
  } catch {
    /* invalid color strings */
  }
  try {
    if (getContrastRatio(fallback, bg) >= MIN_METRIC_CONTRAST) return fallback;
  } catch {
    /* */
  }
  return fallback;
}

/** Accent metric colour for React tiles — falls back when accent matches the panel. */
export function metricValueColorFromTheme(theme: Theme): string {
  const bg = theme.palette.background.paper;
  const accent = theme.palette.primary.main;
  const fallback = theme.palette.text.primary;
  return readableOnBackground(accent, bg, fallback);
}

/** Accent metric colour for ECharts gauge detail text. */
export function metricValueColorFromPalette(palette: MetricColorPalette): string {
  return readableOnBackground(palette.accent, palette.background, palette.textPrimary);
}
