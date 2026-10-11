import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_RESPONSIVE_CONTEXT, type PanelResponsiveContextValue } from "./types";

const PanelResponsiveContext = createContext<PanelResponsiveContextValue>(
  DEFAULT_RESPONSIVE_CONTEXT
);

export function PanelResponsiveProvider({
  value,
  children,
}: {
  value: PanelResponsiveContextValue;
  children: ReactNode;
}) {
  return (
    <PanelResponsiveContext.Provider value={value}>
      {children}
    </PanelResponsiveContext.Provider>
  );
}

export function usePanelResponsiveState(): PanelResponsiveContextValue {
  return useContext(PanelResponsiveContext);
}
