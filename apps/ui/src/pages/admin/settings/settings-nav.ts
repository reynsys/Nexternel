import type { PermissionKey } from "../../../lib/permissions";

export const SETTINGS_TABS: {
  label: string;
  segment: string;
  permission: PermissionKey;
}[] = [
  { label: "Appearance", segment: "appearance", permission: "viewSystem" },
  { label: "System", segment: "system", permission: "viewSystem" },
  // Plugins is hidden until there is something to install (only a stale example entry exists).
  { label: "Backup & Restore", segment: "backup", permission: "manageUsers" },
];

export function settingsTabPath(segment: string): string {
  return `/admin/settings/${segment}`;
}
