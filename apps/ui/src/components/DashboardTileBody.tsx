import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  EMPTY_PANEL_CONTENT_SIZE,
  measurePanelContentSize,
  panelContentSizeChanged,
  type PanelContentSize,
} from "../lib/panel-size";
import { PanelSizeProvider } from "../lib/panel-size-context";

/**
 * Dashboard tile content slot — sits below the tile title row inside SectionGrid.
 *
 * Sizing chain (do not break):
 *   .react-grid-item > div  →  tile Paper (flex column, h:100%)
 *   →  SectionGrid body Box  →  DashboardTileBody  →  panel / widget root
 *
 * PanelSizeContext measures this element — the panel content box inside tile padding.
 * Visualization renderers use VisualizationSlot for the inner visualization rectangle (see docs/v5/05).
 */
export function dashboardTileBodySx(extra?: SxProps<Theme>): SxProps<Theme> {
  return {
    flex: 1,
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    boxSizing: "border-box",
    /** Size container for @container / cqi — matches PanelSizeContext measured box. */
    containerType: "size",
    ...(extra as object),
  };
}

/** Same flex contract for panel/widget roots rendered inside DashboardTileBody. */
/**
 * A scrolling area inside a panel: content that does not fit scrolls instead of being cut off,
 * and the bottom edge fades while there is more below (MORE_BELOW_CSS in SkinProvider).
 */
export const panelScrollSx = {
  overflowX: "hidden",
  overflowY: "auto",
  scrollbarWidth: "thin",
  // The scrollbar shows only while the pointer is on the panel; the fade already tells there is more.
  scrollbarColor: "transparent transparent",
  "&:hover": { scrollbarColor: "rgba(128,128,128,.55) transparent" },
  // No overscroll lock: once the panel's own content ends, the wheel scrolls the page again.
  "--nx-more": "0px",
  maskImage: "linear-gradient(to bottom, #000 calc(100% - var(--nx-more)), transparent)",
  "@supports (animation-timeline: scroll())": { animation: "nx-more-below linear both", animationTimeline: "scroll(self)" },
} as const;

export function panelContentRootSx(extra?: SxProps<Theme>): SxProps<Theme> {
  return {
    flex: 1,
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    // Content taller than the panel (small screens, large text) scrolls instead of being cut off.
    ...panelScrollSx,
    boxSizing: "border-box",
    ...(extra as object),
  };
}

/** Panel content root with CSS size container for cqi / @container rules. */
export function panelContentContainerSx(extra?: SxProps<Theme>): SxProps<Theme> {
  return {
    ...panelContentRootSx(),
    containerType: "size",
    ...(extra as object),
  };
}

type Props = {
  widgetId?: string;
  widgetType?: string;
  children: ReactNode;
  sx?: SxProps<Theme>;
};

export function DashboardTileBody({ widgetId, widgetType, children, sx }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<PanelContentSize>(EMPTY_PANEL_CONTENT_SIZE);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const apply = () => {
      const next = measurePanelContentSize(el);
      setSize((prev) => (panelContentSizeChanged(prev, next) ? next : prev));
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <PanelSizeProvider value={size}>
      <Box
        ref={hostRef}
        data-nx-widget={widgetId}
        data-nx-widget-type={widgetType}
        data-nx-panel-w={size.width > 0 ? String(size.width) : undefined}
        data-nx-panel-h={size.height > 0 ? String(size.height) : undefined}
        sx={dashboardTileBodySx(sx)}
      >
        {children}
      </Box>
    </PanelSizeProvider>
  );
}
