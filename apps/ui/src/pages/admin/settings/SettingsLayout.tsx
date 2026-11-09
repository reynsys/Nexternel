import { Outlet, useLocation } from "react-router-dom";
import { PageHeaderWithSlot } from "../../../components/PageHeader";
import { Alert, Box, CircularProgress, Stack } from "@mui/material";
import { hasPermission } from "../../../lib/permissions";
import { useShellAuth } from "../../../skins/useShellAuth";
import { SETTINGS_TABS, settingsTabPath } from "./settings-nav";

export function SettingsLayout() {
  const { pathname } = useLocation();
  const { signedIn, user, isAdmin, permissions } = useShellAuth();

  // Until the account has loaded, show a spinner — never "no permission" (it flashed for admins).
  if (signedIn && !user) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }

  const tabs = SETTINGS_TABS.filter((tab) =>
    hasPermission(permissions, tab.permission, Boolean(isAdmin))
  );

  if (tabs.length === 0) {
    return (
      <Alert severity="warning">
        Your account does not have permission to open Settings.
      </Alert>
    );
  }

  const active =
    // A page inside a tab (Users → Roles) keeps its tab.
    tabs.find((tab) => pathname === settingsTabPath(tab.segment) || pathname.startsWith(`${settingsTabPath(tab.segment)}/`))?.segment ??
    tabs[0]?.segment ??
    "appearance";

  const current = tabs.find((t) => t.segment === active);
  return (
    <Box>
      {/* Every Settings page is in the menu (the side menu, or the menu button at the top right on phones
          and tablets), so there is no row of page buttons here. A page puts its own main buttons on
          the right of this header with <PageActions>. */}
      <PageHeaderWithSlot title={current?.label ?? "Settings"} hint={current?.hint}>
        <Outlet />
      </PageHeaderWithSlot>
    </Box>
  );
}
