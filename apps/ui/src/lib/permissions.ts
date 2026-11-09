/** Mirror of API role permissions for the UI. Keep in sync with apps/api/src/auth/permissions.ts */

export const PERMISSION_KEYS = [
  "viewDashboards",
  "editDashboards",
  "viewLive",
  "viewSystem",
  "viewAreas",
  "editAreas",
  "viewDevices",
  "editDevices",
  "controlRelays",
  "manageUsers",
  "manageRoles",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type RolePermissions = Record<PermissionKey, boolean>;

export const PERMISSION_META: {
  key: PermissionKey;
  label: string;
  help: string;
  group: string;
}[] = [
  {
    key: "viewDashboards",
    label: "View dashboards",
    help: "Open dashboards and see panels",
    group: "Dashboards",
  },
  {
    key: "editDashboards",
    label: "Edit dashboards",
    help: "Add, change and delete dashboards, sections and panels",
    group: "Dashboards",
  },
  {
    key: "controlRelays",
    label: "Use switches",
    help: "Turn switches on and off from dashboards (not their settings)",
    group: "Dashboards",
  },
  {
    key: "viewSystem",
    label: "View settings",
    help: "Open Settings: Appearance, System, Activity, Backup & Restore, Notifications",
    group: "System",
  },
  {
    key: "viewAreas",
    label: "View areas",
    help: "See the Areas page",
    group: "Areas",
  },
  {
    key: "editAreas",
    label: "Edit areas",
    help: "Add, change and delete areas",
    group: "Areas",
  },
  {
    key: "viewDevices",
    label: "View devices",
    help: "See the Devices page and each device's readings and switches",
    group: "Devices",
  },
  {
    key: "editDevices",
    label: "Edit devices",
    help: "Add, change and delete devices, and update boards",
    group: "Devices",
  },
  {
    key: "manageUsers",
    label: "Manage users",
    help: "Add people and wall screens, and choose their role",
    group: "Admin",
  },
  {
    key: "manageRoles",
    label: "Manage roles",
    help: "Add, change and delete roles and what each may do",
    group: "Admin",
  },
];

export const ALL_PERMISSIONS_ON: RolePermissions = Object.fromEntries(
  PERMISSION_KEYS.map((k) => [k, true])
) as RolePermissions;

export const VIEWER_PERMISSIONS: RolePermissions = {
  viewDashboards: true,
  editDashboards: false,
  viewLive: true,
  viewSystem: true,
  viewAreas: true,
  editAreas: false,
  viewDevices: true,
  editDevices: false,
  controlRelays: true,
  manageUsers: false,
  manageRoles: false,
};

export function emptyPermissions(all = false): RolePermissions {
  return Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, all])
  ) as RolePermissions;
}

export function normalizePermissions(raw: unknown): RolePermissions {
  const base = emptyPermissions(false);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...base };
  }
  const o = raw as Record<string, unknown>;
  for (const key of PERMISSION_KEYS) {
    if (typeof o[key] === "boolean") base[key] = o[key];
  }
  return base;
}

export function permissionsFromIsAdmin(isAdmin: boolean): RolePermissions {
  return isAdmin ? { ...ALL_PERMISSIONS_ON } : { ...VIEWER_PERMISSIONS };
}

export function isAdminFromPermissions(p: RolePermissions): boolean {
  return p.manageUsers && p.manageRoles;
}

export function hasPermission(
  perms: RolePermissions | null | undefined,
  key: PermissionKey,
  fallbackIsAdmin = false
): boolean {
  if (fallbackIsAdmin) return true;
  if (perms && typeof perms[key] === "boolean") return perms[key];
  return false;
}
