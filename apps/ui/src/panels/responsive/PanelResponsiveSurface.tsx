import { Box, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";
import { usePanelResponsiveSemanticState } from "./hooks";
import { semanticPanelRootSx } from "./semantic-styles";

type Props = {
  children: ReactNode;
  panelType?: string;
  sx?: SxProps<Theme>;
};

/**
 * Platform responsive surface for Panel content (core + specialised).
 * Applies semantic state attributes; renderers degrade inside the tile.
 */
export function PanelResponsiveSurface({ children, sx }: Props) {
  const { state } = usePanelResponsiveSemanticState();

  return (
    <Box
      data-responsive-state={state}
      sx={[semanticPanelRootSx(state), ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    >
      {children}
    </Box>
  );
}
