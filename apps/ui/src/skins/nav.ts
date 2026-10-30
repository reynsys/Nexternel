import type { ComponentType } from "react";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import type { PermissionKey, RolePermissions } from "../lib/permissions";
import { hasPermission } from "../lib/permissions";
import { SETTINGS_TABS, settingsTabPath } from "../pages/admin/settings/settings-nav";

export type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ fontSize?: "inherit" | "large" | "medium" | "small" }>;
  /** If true, only show when signed in */
  auth?: boolean;
  /** Required permission to see this item */
  permission?: PermissionKey;
  /** Other page paths that belong to this item (e.g. Cameras under Devices). */
  alsoActiveFor?: string[];
  /** Pages inside this item, listed under it in the side menu (e.g. Settings → System). */
  children?: NavItem[];
};

/** True when `pathname` is this item's page (or one of its sub-pages). */
export function navItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") {
    return pathname === "/" || pathname.startsWith("/d/") || pathname.startsWith("/dashboards");
  }
  return [item.to, ...(item.alsoActiveFor ?? [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export const MAIN_NAV: NavItem[] = [
  {
    label: "Dashboards",
    to: "/",
    icon: DashboardRoundedIcon,
    auth: true,
    permission: "viewDashboards",
  },
  {
    label: "Areas",
    to: "/admin/areas",
    icon: PlaceRoundedIcon,
    auth: true,
    permission: "viewAreas",
  },
  {
    label: "Devices",
    to: "/admin/devices",
    icon: DevicesRoundedIcon,
    auth: true,
    permission: "viewDevices",
  },

  {
    label: "Settings",
    to: "/admin/settings",
    icon: SettingsRoundedIcon,
    auth: true,
    children: SETTINGS_TABS.map((t) => ({
      label: t.label,
      to: settingsTabPath(t.segment),
      icon: t.icon,
      auth: true,
      permission: t.permission,
    })),
  },
];

/** Items pinned to the bottom of the side menu (none at present). */
export const SECONDARY_NAV: NavItem[] = [];

export function filterNav(
  items: NavItem[],
  opts: {
    signedIn: boolean;
    isAdmin: boolean;
    permissions?: RolePermissions | null;
    authLoading?: boolean;
  }
): NavItem[] {
  const allowed = (item: NavItem) => {
    if (item.auth && !opts.signedIn) return false;
    if (item.permission) {
      if (opts.authLoading) return true;
      return hasPermission(opts.permissions, item.permission, opts.isAdmin);
    }
    return true;
  };
  // A group shows when the person may open at least one of its pages.
  return items.flatMap((item) => {
    if (!item.children) return allowed(item) ? [item] : [];
    const children = item.children.filter(allowed);
    return children.length && (!item.auth || opts.signedIn) ? [{ ...item, children }] : [];
  });
}
