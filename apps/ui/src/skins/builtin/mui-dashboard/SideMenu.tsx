import { useState } from "react";
import MuiDrawer, { drawerClasses } from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import type { Theme } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LogoutIcon from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import { Link as RouterLink } from "react-router-dom";
import { MenuContent } from "./MenuContent";
import { NotificationBell } from "../../../components/NotificationBell";
import { hasPermission } from "../../../lib/permissions";
import type { RolePermissions } from "../../../lib/permissions";
import { BrandMark } from "../../../components/BrandMark";
import { LookDecor, RoleDivider, useHasDecor } from "../../looks/LookDecor";
import {
  getSideMenuCollapsed,
  setSideMenuCollapsed,
  SIDE_MENU_WIDTH_COLLAPSED,
  SIDE_MENU_WIDTH_EXPANDED,
} from "../../sideMenuPrefs";
import { chromeSurfaceSx } from "../../surfaceStyles";
import { useGradientActive } from "../../useSurfaceStyles";
import { ButtonRow } from "../../../components/ButtonRow";
import { AppSettingsButton } from "../../../components/AppFrame";
import { MenuFooter } from "./MenuFooter";

type Props = {
  signedIn: boolean;
  isAdmin: boolean;
  permissions?: RolePermissions | null;
  authLoading?: boolean;
  onLogout: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

export function SideMenu({
  signedIn,
  isAdmin,
  permissions,
  authLoading = false,
  onLogout,
  collapsed,
  onCollapsedChange,
}: Props) {
  const width = collapsed ? SIDE_MENU_WIDTH_COLLAPSED : SIDE_MENU_WIDTH_EXPANDED;
  const gradientActive = useGradientActive();
  const decoratedDividers = useHasDecor("menuDivider");
  const decoratedEdge = useHasDecor("menuEdge");

  // Both footer buttons are ordinary buttons, so they take the chosen Look's button style.
  const collapseToggle = (
    <Tooltip
      title={collapsed ? "Expand menu" : "Collapse menu (icons only)"}
      placement={collapsed ? "right" : "top"}
    >
      <Button
        variant="outlined"
        size="small"
        onClick={() => onCollapsedChange(!collapsed)}
        aria-label={collapsed ? "Expand menu" : "Collapse menu"}
        sx={{ minWidth: 40, px: 1, flexShrink: 0 }}
      >
        {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
      </Button>
    </Tooltip>
  );


  return (
    <MuiDrawer
      variant="permanent"
      data-nx-sidemenu
      sx={{
        display: { xs: "none", md: "block" },
        width,
        flexShrink: 0,
        [`& .${drawerClasses.paper}`]: {
          width,
          boxSizing: "border-box",
          ...chromeSurfaceSx(gradientActive),
          overflowX: "hidden",
          // Room for the Look's menu edge drawing (core space rule).
          ...(decoratedEdge ? { paddingRight: (t: Theme) => t.nx.menuEdgeSpace } : {}),
          transition: (theme) =>
            theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 2,
          justifyContent: collapsed ? "center" : "flex-start",
          minHeight: 64,
        }}
      >
        <BrandMark size={collapsed ? 32 : 28} />
        {!collapsed && (
          <Typography
            variant="subtitle1"
            sx={(t) => ({ fontWeight: "fontWeightBold", lineHeight: 1.2, flex: 1, textTransform: t.nx.headingCase, letterSpacing: t.nx.headingSpacing })}
          >
            Nexternel
          </Typography>
        )}
        {signedIn && !collapsed ? (
          <NotificationBell place="menu" canClear={hasPermission(permissions ?? null, "manageUsers", isAdmin)} />
        ) : null}
      </Box>
      {signedIn && collapsed ? (
        <Box sx={{ display: "flex", justifyContent: "center", pb: 1 }}>
          <NotificationBell place="menu" canClear={hasPermission(permissions ?? null, "manageUsers", isAdmin)} />
        </Box>
      ) : null}
      <RoleDivider place="top" />
      <Box
        sx={{
          overflow: "auto",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <MenuContent
          signedIn={signedIn}
          isAdmin={isAdmin}
          permissions={permissions}
          authLoading={authLoading}
          collapsed={collapsed}
        />
      </Box>

      {decoratedDividers ? <RoleDivider place="bottom" /> : null}
      <Stack
        spacing={1.25}
        sx={{
          p: collapsed ? 1 : 1.5,
          // Standard's plain line; a Look with its own divider draws it just above instead.
          borderTop: decoratedDividers ? "none" : "1px solid",
          borderColor: "divider",
          alignItems: collapsed ? "center" : "stretch",
        }}
      >
        {signedIn ? (
          collapsed ? (
            <>
              <NotificationBell place="menu-bottom" canClear={hasPermission(permissions ?? null, "manageUsers", isAdmin)} />
              <AppSettingsButton iconOnly />
              <Tooltip title="Sign out" placement="right">
                <Button variant="outlined" size="small" onClick={onLogout} aria-label="Sign out" sx={{ minWidth: 40, px: 1 }}>
                  <LogoutIcon fontSize="small" />
                </Button>
              </Tooltip>
              {collapseToggle}
            </>
          ) : (
            <MenuFooter isAdmin={isAdmin} permissions={permissions} onLogout={onLogout} bell endButton={collapseToggle} />
          )
        ) : (
          <ButtonRow direction={collapsed ? "column" : "row"} alignItems="center">
            <Button component={RouterLink} to="/login" variant="outlined" size="small" fullWidth={!collapsed} aria-label="Sign in" title={collapsed ? "Sign in" : undefined}>
              {collapsed ? <LoginIcon fontSize="small" /> : "Sign in"}
            </Button>
            {collapseToggle}
          </ButtonRow>
        )}
      </Stack>
      {decoratedEdge ? (
        <Box sx={(t) => ({ position: "absolute", top: 0, bottom: 0, right: 0, width: t.nx.menuEdgeSpace })}>
          <LookDecor slot="menuEdge" />
        </Box>
      ) : null}
    </MuiDrawer>
  );
}

export function useSideMenuCollapsed() {
  const [collapsed, setCollapsed] = useState(() => getSideMenuCollapsed());
  function set(next: boolean) {
    setSideMenuCollapsed(next);
    setCollapsed(next);
  }
  return [collapsed, set] as const;
}
