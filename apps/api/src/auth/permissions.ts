/** Fine-grained role permissions (stored on roles.permissions JSONB). */

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
    help: "Open dashboards and see widgets",
    group: "Dashboards",
  },
  {
    key: "editDashboards",
    label: "Edit dashboards",
    help: "Add/edit/delete dashboards, sections, and widgets",
    group: "Dashboards",
  },
  {
    key: "controlRelays",
    label: "Control switches / relays",
    help: "Toggle relays from dashboards (not configuration)",
    group: "Dashboards",
  },
  {
    key: "viewSystem",
    label: "View System / profile",
    help: "System page, own profile, appearance, and theme",
    group: "System",
  },
  {
    key: "viewAreas",
    label: "View Areas",
    help: "Browse rooms / areas",
    group: "Areas",
  },
  {
    key: "editAreas",
    label: "Edit Areas",
    help: "Add/edit/delete areas",
    group: "Areas",
  },
  {
    key: "viewDevices",
    label: "View Devices",
    help: "Browse devices and entities",
    group: "Devices",
  },
  {
    key: "editDevices",
    label: "Edit Devices",
    help: "Add/edit/delete devices and sync ESPHome",
    group: "Devices",
  },
  {
    key: "manageUsers",
    label: "Manage users",
    help: "Users page — create/edit accounts and assign roles",
    group: "Admin",
  },
  {
    key: "manageRoles",
    label: "Manage roles",
    help: "Roles page — add/edit/delete roles and permissions",
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

/** Legacy is_admin flag → full or viewer-like set. */
export function permissionsFromIsAdmin(isAdmin: boolean): RolePermissions {
  return isAdmin ? { ...ALL_PERMISSIONS_ON } : { ...VIEWER_PERMISSIONS };
}

export function isAdminFromPermissions(p: RolePermissions): boolean {
  return p.manageUsers && p.manageRoles;
}

export function parsePermissionsInput(raw: unknown): RolePermissions | null {
  if (raw === undefined) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return normalizePermissions(raw);
}
