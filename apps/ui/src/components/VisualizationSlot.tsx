import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { VisualizationRectProvider } from "../lib/visualization-rect-context";
import {
  EMPTY_VISUALIZATION_RECT,
  measureVisualizationRect,
  visualizationRectChanged,
  type VisualizationRect,
} from "../lib/visualization-rect";

export const VISUALIZATION_SLOT_ATTR = "data-nx-visualization-slot";

/**
 * Shared layout boundary between panel chrome and visualization content.
 * Measures the actual DOM rectangle allocated to visualizations via ResizeObserver.
 */
export function visualizationSlotSx(extra?: SxProps<Theme>): SxProps<Theme> {
  return {
    flex: 1,
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    boxSizing: "border-box",
    ...(extra as object),
  };
}

type Props = {
  children: ReactNode;
  sx?: SxProps<Theme>;
};

export function VisualizationSlot({ children, sx }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<VisualizationRect>(EMPTY_VISUALIZATION_RECT);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;

    const apply = () => {
      const next = measureVisualizationRect(el);
      setRect((prev) => (visualizationRectChanged(prev, next) ? next : prev));
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <VisualizationRectProvider value={rect}>
      <Box
        ref={slotRef}
        data-nx-visualization-slot
        data-nx-viz-w={rect.width > 0 ? String(rect.width) : undefined}
        data-nx-viz-h={rect.height > 0 ? String(rect.height) : undefined}
        sx={visualizationSlotSx(sx)}
      >
        {children}
      </Box>
    </VisualizationRectProvider>
  );
}
