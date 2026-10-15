import { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import MuiDrawer, { drawerClasses } from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Link as RouterLink } from "react-router-dom";
import { APP_VERSION } from "../../../version";
import { MenuContent } from "./MenuContent";
import { NotificationBell } from "../../../components/NotificationBell";
import { hasPermission } from "../../../lib/permissions";
import type { User } from "../../../api";
import type { RolePermissions } from "../../../lib/permissions";
import { getBrandLogo } from "../../brandLogo";
import {
  getSideMenuCollapsed,
  setSideMenuCollapsed,
  SIDE_MENU_WIDTH_COLLAPSED,
  SIDE_MENU_WIDTH_EXPANDED,
} from "../../sideMenuPrefs";
import { chromeSurfaceSx } from "../../surfaceStyles";
import { useGradientActive } from "../../useSurfaceStyles";

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

function BrandMark({ logo, size = 28 }: { logo: string | null; size?: number }) {
  if (logo) {
    return (
      <Box
        component="img"
        src={logo}
        alt="Brand"
        sx={{
          width: size,
          height: size,
          borderRadius: "999px",
          objectFit: "cover",
          border: "1px solid",
          borderColor: "divider",
          display: "block",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "999px",
        backgroundImage:
          "linear-gradient(135deg, hsl(210, 98%, 60%) 0%, hsl(210, 100%, 35%) 100%)",
        border: "1px solid",
        borderColor: "primary.main",
        flexShrink: 0,
      }}
    />
  );
}

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

  useEffect(() => {
    function refresh() {
      setLogo(getBrandLogo());
    }
    window.addEventListener("nexternel:brand-logo-updated", refresh);
    return () => window.removeEventListener("nexternel:brand-logo-updated", refresh);
  }, []);

  const collapseToggle = (
    <Tooltip
      title={collapsed ? "Expand menu" : "Collapse menu (icons only)"}
      placement={collapsed ? "right" : "top"}
    >
      <IconButton
        size="small"
        onClick={() => onCollapsedChange(!collapsed)}
        aria-label={collapsed ? "Expand menu" : "Collapse menu"}
      >
        {collapsed ? (
          <ChevronRightIcon fontSize="small" />
        ) : (
          <ChevronLeftIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );

  return (
    <MuiDrawer
      variant="permanent"
      sx={{
        display: { xs: "none", md: "block" },
        width,
        flexShrink: 0,
        [`& .${drawerClasses.paper}`]: {
          width,
          boxSizing: "border-box",
          ...chromeSurfaceSx(gradientActive),
          overflowX: "hidden",
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
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, flex: 1 }}>
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
      <Divider />
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

      <Stack
        spacing={collapsed ? 1 : 0}
        sx={{
          p: collapsed ? 1 : 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
          alignItems: collapsed ? "center" : "stretch",
        }}
      >
        {signedIn ? (
          collapsed ? (
            <>
              <Tooltip
                title={user?.displayName?.trim() || user?.username || "User"}
                placement="right"
              >
              <Avatar
                src={user?.avatarData ?? undefined}
                sx={{ width: 36, height: 36, bgcolor: "primary.dark", cursor: "pointer" }}
                component={RouterLink}
                to="/admin/users"
              >
                  {(user?.displayName || user?.username || "?")
                    .trim()
                    .slice(0, 1)
                    .toUpperCase()}
                </Avatar>
              </Tooltip>
              <Tooltip title={APP_VERSION} placement="right">
                <Typography variant="caption" color="text.secondary" noWrap>
                  {APP_VERSION.replace(/^V/, "")}
                </Typography>
              </Tooltip>
              <Tooltip title="Sign out" placement="right">
                <Button size="small" onClick={onLogout} sx={{ minWidth: 0, px: 1 }}>
                  Out
                </Button>
              </Tooltip>
              {collapseToggle}
            </>
          ) : (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Avatar
                src={user?.avatarData ?? undefined}
                sx={{ width: 36, height: 36, bgcolor: "primary.dark", flexShrink: 0 }}
              >
                {(user?.displayName || user?.username || "?")
                  .trim()
                  .slice(0, 1)
                  .toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, lineHeight: 1.25 }}
                  noWrap
                >
                  {user?.displayName?.trim() || user?.username || "User"}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {user?.roleName ||
                    (user?.role === "admin"
                      ? "Administrator"
                      : user?.role === "viewer"
                        ? "Viewer"
                        : (user?.role ?? ""))}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {APP_VERSION}
                </Typography>
              </Box>
              <Button size="small" onClick={onLogout} sx={{ flexShrink: 0 }}>
                Out
              </Button>
              {collapseToggle}
            </Stack>
          )
        ) : (
          <Stack
            direction={collapsed ? "column" : "row"}
            spacing={1}
            alignItems="center"
          >
            <Button component={RouterLink} to="/login" size="small" fullWidth={!collapsed}>
              {collapsed ? "In" : "Login"}
            </Button>
            {collapseToggle}
          </Stack>
        )}
      </Stack>
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
