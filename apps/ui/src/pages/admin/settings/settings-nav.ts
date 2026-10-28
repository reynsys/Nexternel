import type { PermissionKey } from "../../../lib/permissions";

export const SETTINGS_TABS: {
  label: string;
  segment: string;
  permission: PermissionKey;
  /** One line under the page title. */
  hint?: string;
}[] = [
  { label: "My appearance", segment: "appearance", permission: "viewSystem", hint: "How Nexternel looks for you. Each person chooses their own." },
  { label: "System", segment: "system", permission: "viewSystem", hint: "This Nexternel server: version and updates, addresses, and whether everything is running." },
  { label: "Extensions", segment: "extensions", permission: "viewSystem", hint: "Extra features and styles. Free ones install with one click; paid ones unlock with the licence key from your email." },
  { label: "Backup & Restore", segment: "backup", permission: "manageUsers", hint: "Save everything to a file, bring it back, or let Nexternel do it by itself." },
];

export function settingsTabPath(segment: string): string {
  return `/admin/settings/${segment}`;
}
