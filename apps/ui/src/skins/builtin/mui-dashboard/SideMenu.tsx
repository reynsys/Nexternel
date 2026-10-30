import { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
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
import { Link as RouterLink } from "react-router-dom";
import { APP_VERSION } from "../../../version";
import { MenuContent } from "./MenuContent";
import { NotificationBell } from "../../../components/NotificationBell";
import { hasPermission } from "../../../lib/permissions";
import type { User } from "../../../api";
import type { RolePermissions } from "../../../lib/permissions";
import { getBrandLogo } from "../../brandLogo";
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

type Props = {
  signedIn: boolean;
  isAdmin: boolean;
  permissions?: RolePermissions | null;
  authLoading?: boolean;
  user: User | null;
  onLogout: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

export function SideMenu({
  signedIn,
  isAdmin,
  permissions,
  authLoading = false,
  user,
  onLogout,
  collapsed,
  onCollapsedChange,
}: Props) {
  const [logo, setLogo] = useState<string | null>(() => getBrandLogo());
  const width = collapsed ? SIDE_MENU_WIDTH_COLLAPSED : SIDE_MENU_WIDTH_EXPANDED;
  const gradientActive = useGradientActive();
  const decoratedDividers = useHasDecor("menuDivider");
  const decoratedEdge = useHasDecor("menuEdge");

  useEffect(() => {
    function refresh() {
      setLogo(getBrandLogo());
    }
    window.addEventListener("nexternel:brand-logo-updated", refresh);
    return () => window.removeEventListener("nexternel:brand-logo-updated", refresh);
  }, []);

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

  const userName = user?.displayName?.trim() || user?.username || "User";
  const initial = (user?.displayName || user?.username || "?").trim().slice(0, 1).toUpperCase();
  const roleName =
    user?.roleName ||
    (user?.role === "admin" ? "Administrator" : user?.role === "viewer" ? "Viewer" : (user?.role ?? ""));

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
        <BrandMark logo={logo} size={collapsed ? 32 : 28} />
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
              <Tooltip title={`${userName} · ${roleName}`} placement="right">
                <Avatar
                  src={user?.avatarData ?? undefined}
                  sx={{ width: 36, height: 36, cursor: "pointer" }}
                  component={RouterLink}
                  to="/admin/settings/users"
                >
                  {initial}
                </Avatar>
              </Tooltip>
              <Tooltip title={APP_VERSION} placement="right">
                <Typography variant="caption" color="text.secondary" noWrap>
                  {APP_VERSION.replace(/^V/, "")}
                </Typography>
              </Tooltip>
              <Tooltip title="Sign out" placement="right">
                <Button variant="outlined" size="small" onClick={onLogout} aria-label="Sign out" sx={{ minWidth: 40, px: 1 }}>
                  <LogoutIcon fontSize="small" />
                </Button>
              </Tooltip>
              {collapseToggle}
            </>
          ) : (
            <>
              {/* Who is signed in: picture, name, role and version, each on its own line. */}
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <Avatar src={user?.avatarData ?? undefined} sx={{ width: 40, height: 40, flexShrink: 0 }}>
                  {initial}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: "fontWeightBold", lineHeight: 1.3 }} noWrap title={userName}>
                    {userName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block" title={roleName}>
                    {roleName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {APP_VERSION}
                  </Typography>
                </Box>
              </Stack>
              <ButtonRow direction="row">
                <Button variant="outlined" size="small" startIcon={<LogoutIcon fontSize="small" />} onClick={onLogout} sx={{ flex: 1 }}>
                  Sign out
                </Button>
                {collapseToggle}
              </ButtonRow>
            </>
          )
        ) : (
          <ButtonRow direction={collapsed ? "column" : "row"} alignItems="center">
            <Button component={RouterLink} to="/login" variant="outlined" size="small" fullWidth={!collapsed}>
              {collapsed ? "In" : "Sign in"}
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
