import type { ComponentType } from "react";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import type { PermissionKey, RolePermissions } from "../lib/permissions";
import { hasPermission } from "../lib/permissions";

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
};

/** True when `pathname` is this item's page (or one of its sub-pages). */
export function navItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") {
    return pathname === "/" || pathname.startsWith("/d/") || pathname.startsWith("/dashboards") || pathname.startsWith("/manage/dashboards");
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
    alsoActiveFor: ["/admin/cameras"],
  },
  {
    label: "Users",
    to: "/admin/users",
    icon: PeopleRoundedIcon,
    auth: true,
    permission: "manageUsers",
  },
  {
    label: "Settings",
    to: "/admin/settings",
    icon: SettingsRoundedIcon,
    auth: true,
    permission: "viewSystem",
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
  return items.filter((item) => {
    if (item.auth && !opts.signedIn) return false;
    if (item.permission) {
      if (opts.authLoading) return true;
      return hasPermission(opts.permissions, item.permission, opts.isAdmin);
    }
    return true;
  });
}
