import { useMemo } from "react";
import { useTheme } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";
import { metricValueColorFromTheme } from "./metricColors";
import { useNestedContentPanelSx } from "./useSurfaceStyles";

export type MetricAppearance = {
  /** Theme accent, contrast-checked against the content panel background. */
  valueColor: string;
  nestedItemSx: SxProps<Theme>;
  valueSx: SxProps<Theme>;
  labelSx: SxProps<Theme>;
};

/**
 * Shared metric / nested-tile appearance for panels and general widgets.
 * Keeps values, borders, and fills aligned with System → Appearance.
 */
export function useMetricAppearance(): MetricAppearance {
  const theme = useTheme();
  const nestedItemSx = useNestedContentPanelSx();
  const valueColor = useMemo(() => metricValueColorFromTheme(theme), [theme]);

  return useMemo(
    () => ({
      valueColor,
      nestedItemSx,
      valueSx: {
        color: valueColor,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
      },
      labelSx: {
        color: theme.palette.text.secondary,
      },
    }),
    [valueColor, nestedItemSx, theme.palette.text.secondary]
  );
}
