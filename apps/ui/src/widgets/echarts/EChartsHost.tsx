import { Box } from "@mui/material";
import type { ECharts } from "echarts";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  isVisualizationRectReady,
  type VisualizationRect,
} from "../../lib/visualization-rect";
import { useVisualizationRect } from "../../lib/visualization-rect-context";

type EChartsHostContextValue = {
  rect: VisualizationRect;
  chartRef: MutableRefObject<ECharts | null>;
};

const defaultRect: VisualizationRect = { width: 0, height: 0 };

const EChartsHostContext = createContext<EChartsHostContextValue>({
  rect: defaultRect,
  chartRef: { current: null },
});

export function useEChartsHost(): EChartsHostContextValue {
  return useContext(EChartsHostContext);
}

type Props = {
  children: ReactNode;
};

/**
 * Stage 2 visualization host — consumes authoritative VisualizationRect from
 * VisualizationSlot and resizes the mounted ECharts instance when it changes.
 * Does not measure dimensions independently.
 */
export function EChartsHost({ children }: Props) {
  const rect = useVisualizationRect();
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!isVisualizationRectReady(rect)) return;
    chartRef.current?.resize({ width: rect.width, height: rect.height });
  }, [rect.width, rect.height]);

  return (
    <EChartsHostContext.Provider value={{ rect, chartRef }}>
      <Box
        data-nx-chart-host
        data-nx-visualization-host
        data-nx-chart-w={rect.width > 0 ? String(rect.width) : undefined}
        data-nx-chart-h={rect.height > 0 ? String(rect.height) : undefined}
        sx={{
          position: "relative",
          flex: 1,
          alignSelf: "stretch",
          width: "100%",
          height: "100%",
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </Box>
    </EChartsHostContext.Provider>
  );
}
