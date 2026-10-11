import { createContext, useContext, type ReactNode } from "react";
import { EMPTY_VISUALIZATION_RECT, type VisualizationRect } from "./visualization-rect";

export type VisualizationRectContextValue = VisualizationRect;

export const VisualizationRectContext =
  createContext<VisualizationRectContextValue>(EMPTY_VISUALIZATION_RECT);

export function VisualizationRectProvider({
  value,
  children,
}: {
  value: VisualizationRectContextValue;
  children: ReactNode;
}) {
  return (
    <VisualizationRectContext.Provider value={value}>{children}</VisualizationRectContext.Provider>
  );
}

/**
 * Measured visualization slot rectangle (0×0 outside VisualizationSlot or before layout).
 * Visualization renderers should prefer this over PanelSizeContext for chart geometry.
 */
export function useVisualizationRect(): VisualizationRectContextValue {
  return useContext(VisualizationRectContext);
}

export function useVisualizationRectOptional(): VisualizationRectContextValue | null {
  const rect = useContext(VisualizationRectContext);
  if (rect.width <= 0 && rect.height <= 0) return null;
  return rect;
}
