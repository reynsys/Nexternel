import type { ComponentType } from "react";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
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
  { label: "Appearance", segment: "appearance", icon: PaletteRoundedIcon, permission: "viewSystem" },
  { label: "System", segment: "system", icon: MemoryRoundedIcon, permission: "viewSystem" },
  { label: "Users", segment: "users", icon: PeopleRoundedIcon, permission: "manageUsers" },
  { label: "Notifications", segment: "notifications", icon: NotificationsRoundedIcon, permission: "viewSystem" },
  { label: "Backup & Restore", segment: "backup", icon: SettingsBackupRestoreRoundedIcon, permission: "manageUsers" },
];

export function settingsTabPath(segment: string): string {
  return `/admin/settings/${segment}`;
}
