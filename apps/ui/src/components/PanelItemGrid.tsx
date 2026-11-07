import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { Children, isValidElement, useEffect, type ReactNode } from "react";
import { panelContentContainerSx } from "./DashboardTileBody";
import type { PanelItemDirection } from "../lib/panel-appearance";
import { usePanelPictures } from "../lib/panel-pictures-context";
import {
  panelItemGridColumnCount,
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
  /**
   * Items are pictures of this shape (width over height, 16/9 for cameras). On a narrow screen they go
   * under each other at this shape instead of shrinking, and the panel grows to hold them.
   */
  pictureAspect?: number;
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
  pictureAspect,
}: Props) {
  const count = itemCount ?? countGridChildren(children);
  const pictures = usePanelPictures();
  const report = pictures?.report;
  const across = panelItemGridColumnCount(layout, count, direction);
  useEffect(() => {
    if (!report || !pictureAspect) return;
    report({ count, across, aspect: pictureAspect });
    return () => report(null);
  }, [report, pictureAspect, count, across]);
  const maxAcross = pictureAspect ? pictures?.across ?? undefined : undefined;
  return (
    <Box sx={panelContentContainerSx(rootSx)}>
      {header}
      <Box
        sx={[
          panelItemGridSx({ layout, direction, rowSize, itemCount: count, maxAcross }),
          ...(Array.isArray(gridSx) ? gridSx : gridSx ? [gridSx] : []),
        ]}
      >
        {children}
      </Box>
      {footer}
    </Box>
  );
}
