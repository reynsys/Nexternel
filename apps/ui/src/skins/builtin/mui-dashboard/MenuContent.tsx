import { Link as RouterLink, useLocation } from "react-router-dom";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import {
  filterNav,
  MAIN_NAV,
  navItemActive,
  SECONDARY_NAV,
  type NavItem,
} from "../../nav";
import type { RolePermissions } from "../../../lib/permissions";

type Props = {
  signedIn: boolean;
  isAdmin: boolean;
  permissions?: RolePermissions | null;
  authLoading?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
};

function NavList({
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <List dense>
      {items.map((item) => {
        const Icon = item.icon;
        const selected = navItemActive(item, pathname);
        const button = (
          <ListItemButton
            component={RouterLink}
            to={item.to}
            selected={selected}
            onClick={onNavigate}
            sx={{
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1 : 2,
              "&.Mui-selected": {
                color: "primary.contrastText",
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? 0 : 36,
                justifyContent: "center",
                color: selected ? "primary.contrastText" : "inherit",
              }}
            >
              <Icon fontSize="small" />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: selected ? 600 : 400,
                  color: selected ? "primary.contrastText" : undefined,
                }}
              />
            )}
          </ListItemButton>
        );
        return (
          <ListItem key={item.to} disablePadding sx={{ display: "block" }}>
            {collapsed ? (
              <Tooltip title={item.label} placement="right">
                <span>{button}</span>
              </Tooltip>
            ) : (
              button
            )}
          </ListItem>
        );
      })}
    </List>
  );
}

export function MenuContent({
  signedIn,
  isAdmin,
  permissions,
  authLoading = false,
  collapsed = false,
  onNavigate,
}: Props) {
  const { pathname } = useLocation();
  const main = filterNav(MAIN_NAV, { signedIn, isAdmin, permissions, authLoading });
  const secondary = filterNav(SECONDARY_NAV, { signedIn, isAdmin, permissions, authLoading });

  return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: "space-between" }}>
      <NavList
        items={main}
        pathname={pathname}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavList
        items={secondary}
        pathname={pathname}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    </Stack>
  );
}
