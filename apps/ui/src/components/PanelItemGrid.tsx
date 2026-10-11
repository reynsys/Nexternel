import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { Children, isValidElement, type ReactNode } from "react";
import { panelContentContainerSx } from "./DashboardTileBody";
import type { PanelItemDirection } from "../lib/panel-appearance";
import {
  panelItemGridSx,
  type PanelAppearanceLayout,
  type PanelItemGridRowSize,
} from "../lib/panel-item-grid";

type Props = {
  layout?: PanelAppearanceLayout;
  direction?: PanelItemDirection;
  rowSize?: PanelItemGridRowSize;
  /** When omitted, counts valid React children. */
  itemCount?: number;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  rootSx?: SxProps<Theme>;
  gridSx?: SxProps<Theme>;
};

function countGridChildren(children: ReactNode): number {
  return Children.toArray(children).filter(isValidElement).length;
}

/** Shared grid for Status, Controls, Charts, Camera, and future multi-item panels. */
export function PanelItemGrid({
  layout = "card",
  direction = "across",
  rowSize = "standard",
  itemCount,
  header,
  footer,
  children,
  rootSx,
  gridSx,
}: Props) {
  const count = itemCount ?? countGridChildren(children);
  return (
    <Box sx={panelContentContainerSx(rootSx)}>
      {header}
      <Box
        sx={[
          panelItemGridSx({ layout, direction, rowSize, itemCount: count }),
          ...(Array.isArray(gridSx) ? gridSx : gridSx ? [gridSx] : []),
        ]}
      >
        {children}
      </Box>
      {footer}
    </Box>
  );
}
