import type { ReactNode } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import LogoutIcon from "@mui/icons-material/Logout";
import { NotificationBell } from "../../../components/NotificationBell";
import { hasPermission, type RolePermissions } from "../../../lib/permissions";
import { ButtonRow } from "../../../components/ButtonRow";
import { AnywhereStatus } from "../../../components/AnywhereStatus";
import { AppSettingsButton } from "../../../components/AppFrame";

/**
 * The bottom of the menu, the same on a computer, a tablet and a phone (only the size differs): who is
 * signed in, Nexternel Anywhere, App settings (only inside the App) and Sign out. Everything above it
 * in the menu is Nexternel; App settings holds what the app on this phone or tablet controls.
 */
export function MenuFooter({
  isAdmin,
  permissions,
  onLogout,
  bell = false,
  onNavigate,
  endButton,
}: {
  isAdmin: boolean;
  permissions?: RolePermissions | null;
  onLogout: () => void;
  /** The bell's "bottom of the menu" place (side menu only; phones have the bell in the top bar). */
  bell?: boolean;
  onNavigate?: () => void;
  /** Beside Sign out (the side menu's fold button). */
  endButton?: ReactNode;
}) {
  return (
    <Stack spacing={1.25}>
      <AnywhereStatus permissions={permissions} isAdmin={isAdmin} />
      <AppSettingsButton onNavigate={onNavigate} />
      <ButtonRow direction="row">
        <Button variant="outlined" size="small" startIcon={<LogoutIcon fontSize="small" />} onClick={onLogout} sx={{ flex: 1 }}>
          Sign out
        </Button>
        {bell ? <NotificationBell place="menu-bottom" canClear={hasPermission(permissions ?? null, "manageUsers", isAdmin)} /> : null}
        {endButton}
      </ButtonRow>
    </Stack>
  );
}
