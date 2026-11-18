import type { ReactNode } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/Logout";
import { APP_VERSION } from "../../../version";
import { roleLabel, userInitial } from "../../../lib/user-display";
import { NotificationBell } from "../../../components/NotificationBell";
import { hasPermission, type RolePermissions } from "../../../lib/permissions";
import type { User } from "../../../api";
import { ButtonRow } from "../../../components/ButtonRow";
import { AnywhereStatus } from "../../../components/AnywhereStatus";
import { AppSettingsButton } from "../../../components/AppFrame";

/**
 * The bottom of the menu, the same on a computer, a tablet and a phone (only the size differs): who is
 * signed in, Nexternel Anywhere, App settings (only inside the App) and Sign out. Everything above it
 * in the menu is Nexternel; App settings holds what the app on this phone or tablet controls.
 */
export function MenuFooter({
  user,
  isAdmin,
  permissions,
  onLogout,
  bell = false,
  onNavigate,
  endButton,
}: {
  user: User | null;
  isAdmin: boolean;
  permissions?: RolePermissions | null;
  onLogout: () => void;
  /** The bell's "bottom of the menu" place (side menu only; phones have the bell in the top bar). */
  bell?: boolean;
  onNavigate?: () => void;
  /** Beside Sign out (the side menu's fold button). */
  endButton?: ReactNode;
}) {
  const userName = user?.displayName?.trim() || user?.username || "User";
  const roleName = roleLabel(user?.role, user?.roleName);
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
        <Avatar src={user?.avatarData ?? undefined} sx={{ width: 40, height: 40, flexShrink: 0 }}>
          {userInitial(user)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "fontWeightBold", lineHeight: 1.3 }} noWrap title={userName}>
            {userName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block" title={roleName}>
            {roleName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {APP_VERSION}
          </Typography>
        </Box>
        {bell ? <NotificationBell place="menu-bottom" canClear={hasPermission(permissions ?? null, "manageUsers", isAdmin)} /> : null}
      </Stack>
      <AnywhereStatus permissions={permissions} isAdmin={isAdmin} />
      <AppSettingsButton onNavigate={onNavigate} />
      <ButtonRow direction="row">
        <Button variant="outlined" size="small" startIcon={<LogoutIcon fontSize="small" />} onClick={onLogout} sx={{ flex: 1 }}>
          Sign out
        </Button>
        {endButton}
      </ButtonRow>
    </Stack>
  );
}
