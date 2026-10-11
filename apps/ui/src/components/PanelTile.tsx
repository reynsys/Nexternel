import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useNestedContentPanelSx } from "../skins/useSurfaceStyles";

type Props = {
  children: ReactNode;
  sx?: SxProps<Theme>;
};

/**
 * The only box drawn inside a dashboard panel. A single-item panel shows one tile;
 * a panel with several readings or cameras shows one tile per item. Panel bodies never
 * paint their own surface — they render into this.
 */
export function PanelTile({ children, sx }: Props) {
  const surfaceSx = useNestedContentPanelSx();
  return (
    <Box
      data-nx-panel-tile
      sx={[
        {
          ...surfaceSx,
          position: "relative",
          flex: 1,
          width: "100%",
          height: "100%",
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}
