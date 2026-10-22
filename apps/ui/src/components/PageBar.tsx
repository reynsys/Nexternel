import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box } from "@mui/material";
import { barSurfaceSx } from "../skins/surfaceStyles";
import { useGradientActive } from "../skins/useSurfaceStyles";
import { RoleDivider } from "../skins/looks/LookDecor";

/** Where a page's bar goes: the top of the page area, beside the side menu (the skin's Layout). */
export const PAGE_BAR_SLOT_ID = "nx-page-bar";

/**
 * A page's own bar across the top of the page area (e.g. the dashboard's edit bar): the same height
 * and line as the side menu's title row, the Look's top-bar surface, flush with the top of the screen
 * and staying there while the page scrolls. Room is kept on the right for an open side panel.
 */
export function PageBar({ children }: { children: ReactNode }) {
  const gradientActive = useGradientActive();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById(PAGE_BAR_SLOT_ID)), []);
  const bar = (
    <Box data-nx-role="chrome" sx={{ ...barSurfaceSx(gradientActive), backdropFilter: "blur(10px)" }}>
      <Box
        sx={{
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          px: { xs: 2, md: 3 },
          py: 1,
          // An open side panel covers the right of the screen; the bar's buttons stay clear of it.
          pr: { xs: 2, md: "calc(24px + var(--nx-side-panel-width, 0px))" },
          boxSizing: "border-box",
        }}
      >
        {children}
      </Box>
      <RoleDivider place="top" />
    </Box>
  );
  // A skin without a page bar place shows the bar at the top of the page instead.
  return slot ? createPortal(bar, slot) : bar;
}
