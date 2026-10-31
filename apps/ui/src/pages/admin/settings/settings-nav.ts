import type { ComponentType } from "react";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import ExtensionRoundedIcon from "@mui/icons-material/ExtensionRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import SettingsBackupRestoreRoundedIcon from "@mui/icons-material/SettingsBackupRestoreRounded";
import type { PermissionKey } from "../../../lib/permissions";

export const SETTINGS_TABS: {
  label: string;
  segment: string;
  permission: PermissionKey;
  /** Its icon in the side menu. */
  icon: ComponentType<{ fontSize?: "inherit" | "large" | "medium" | "small" }>;
  /** One line under the page title. */
  hint?: string;
}[] = [
  { label: "Appearance", segment: "appearance", icon: PaletteRoundedIcon, permission: "viewSystem", hint: "How Nexternel looks for you. Each person chooses their own." },
  { label: "System", segment: "system", icon: MemoryRoundedIcon, permission: "viewSystem", hint: "This Nexternel server: version and updates, addresses, and whether everything is running." },
  { label: "Activity", segment: "activity", icon: HistoryRoundedIcon, permission: "viewDevices", hint: "What happened in Nexternel, newest first: devices going offline and back, switches, updates, dashboards and Nexternel itself. Kept 30 days." },
  { label: "Extensions", segment: "extensions", icon: ExtensionRoundedIcon, permission: "viewSystem", hint: "Extra features and styles. Free ones install with one click; paid ones unlock with the licence key from your email." },
  { label: "Users", segment: "users", icon: PeopleRoundedIcon, permission: "manageUsers", hint: "The people who can sign in, their role, and what each role may see and change." },
  { label: "Backup & Restore", segment: "backup", icon: SettingsBackupRestoreRoundedIcon, permission: "manageUsers", hint: "Save everything to a file, bring it back, or let Nexternel do it by itself." },
  { label: "Notifications", segment: "notifications", icon: NotificationsRoundedIcon, permission: "viewSystem", hint: "Your notification bell, and which messages reach it." },
];

export function settingsTabPath(segment: string): string {
  return `/admin/settings/${segment}`;
}
