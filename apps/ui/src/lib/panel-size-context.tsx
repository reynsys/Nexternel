import { createContext, useContext, type ReactNode } from "react";
import { EMPTY_PANEL_CONTENT_SIZE, type PanelContentSize } from "./panel-size";

export type PanelSizeContextValue = PanelContentSize;

export const PanelSizeContext = createContext<PanelSizeContextValue>(EMPTY_PANEL_CONTENT_SIZE);

export function PanelSizeProvider({
  value,
  children,
}: {
  value: PanelSizeContextValue;
  children: ReactNode;
}) {
  return <PanelSizeContext.Provider value={value}>{children}</PanelSizeContext.Provider>;
}

/** Dimensions of the current dashboard tile content area (0×0 when outside a provider). */
export function usePanelSize(): PanelSizeContextValue {
  return useContext(PanelSizeContext);
}

export function usePanelSizeOptional(): PanelSizeContextValue | null {
  const size = useContext(PanelSizeContext);
  if (size.width <= 0 && size.height <= 0) return null;
  return size;
}
