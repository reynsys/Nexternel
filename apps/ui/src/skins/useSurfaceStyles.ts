import { useTheme } from "@mui/material/styles";
import { useSkin } from "./SkinProvider";
import {
  contentSurfaceSx,
  isGradientActive,
  nestedContentPanelSx,
} from "./surfaceStyles";

export { useMetricAppearance } from "./useMetricAppearance";
export { metricValueColorFromTheme, readableOnBackground } from "./metricColors";
export {
  chromeSurfaceSx,
  contentSurfaceSx,
  isGradientActive,
  contentPanelStyles,
  nestedContentPanelSx,
} from "./surfaceStyles";

/** True when Appearance has a backdrop: a gradient / soft-glow background or a background effect. */
export function useGradientActive(): boolean {
  const { themePrefs } = useSkin();
  return isGradientActive(themePrefs);
}

/** Prefer solid light/dark panels over frosted glass when a gradient is on. */
export function useSolidContentPanels(): boolean {
  const { themePrefs } = useSkin();
  return Boolean(themePrefs.solidContentPanels);
}

/** Hook for pages that need content panel sx directly. */
export function useContentSurfaceSx() {
  const gradientActive = useGradientActive();
  const solidContentPanels = useSolidContentPanels();
  return contentSurfaceSx(gradientActive, solidContentPanels);
}

export function useNestedContentPanelSx() {
  const theme = useTheme();
  const gradientActive = useGradientActive();
  const solidContentPanels = useSolidContentPanels();
  return nestedContentPanelSx(theme, gradientActive, solidContentPanels);
}
