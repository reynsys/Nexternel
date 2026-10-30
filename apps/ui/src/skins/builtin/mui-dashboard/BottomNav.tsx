import { TYPE_SCALE } from "../../../lib/appearance/type";
import { useState, type MouseEvent } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { guardLinkClick } from "../../../lib/leave-guard";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Drawer from "@mui/material/Drawer";
import Paper from "@mui/material/Paper";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import type { User } from "../../../api";
import type { RolePermissions } from "../../../lib/permissions";
import { barSurfaceSx } from "../../surfaceStyles";
import { useGradientActive } from "../../useSurfaceStyles";
import { filterNav, MAIN_NAV, navItemActive } from "../../nav";
import { MenuContent } from "./MenuContent";

/** Phone bottom bar: the first four main pages within thumb reach; everything else under More. */
export const BOTTOM_NAV_HEIGHT_PX = 64;
const BOTTOM_NAV_SLOTS = 4;

type Props = {
  signedIn: boolean;
  isAdmin: boolean;
  permissions?: RolePermissions | null;
  authLoading?: boolean;
  user: User | null;
};

export function BottomNav({ signedIn, isAdmin, permissions, authLoading = false }: Props) {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const gradientActive = useGradientActive();
  if (!signedIn) return null;

  const items = filterNav(MAIN_NAV, { signedIn, isAdmin, permissions, authLoading });
  const shown = items.slice(0, BOTTOM_NAV_SLOTS);
  const activeIndex = shown.findIndex((item) => navItemActive(item, pathname));

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          display: { xs: "block", md: "none" },
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderTop: "1px solid",
          borderColor: "divider",
          pb: "env(safe-area-inset-bottom)",
          ...barSurfaceSx(gradientActive),
        }}
      >
        <BottomNavigation
          showLabels
          value={moreOpen ? BOTTOM_NAV_SLOTS : activeIndex}
          sx={{
            height: BOTTOM_NAV_HEIGHT_PX,
            bgcolor: "transparent",
            "& .MuiBottomNavigationAction-root": { minWidth: 0, px: 0.5 },
            "& .MuiBottomNavigationAction-label, & .MuiBottomNavigationAction-label.Mui-selected": {
              fontSize: TYPE_SCALE.overline.fontSize,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            },
          }}
        >
          {shown.map((item) => {
            const Icon = item.icon;
            return (
              <BottomNavigationAction
                key={item.to}
                label={item.label}
                icon={<Icon />}
                component={RouterLink}
                to={item.to}
                onClick={(e: MouseEvent) => void guardLinkClick(e, () => navigate(item.to))}
              />
            );
          })}
          <BottomNavigationAction
            label="More"
            icon={<MoreHorizRoundedIcon />}
            onClick={() => setMoreOpen(true)}
          />
        </BottomNavigation>
      </Paper>
      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: "env(safe-area-inset-bottom)" } }}
      >
        <MenuContent
          signedIn={signedIn}
          isAdmin={isAdmin}
          permissions={permissions}
          authLoading={authLoading}
          onNavigate={() => setMoreOpen(false)}
        />
      </Drawer>
    </>
  );
}
