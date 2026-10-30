import { Outlet, useLocation } from "react-router-dom";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { hasPermission } from "../../../lib/permissions";
import { useShellAuth } from "../../../skins/useShellAuth";
import { SegmentButtonNav } from "../../../components/SegmentButtonNav";
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

  const navItems = tabs.map((tab) => ({
    id: tab.segment,
    label: tab.label,
    to: settingsTabPath(tab.segment),
  }));

  const current = tabs.find((t) => t.segment === active);
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {current?.label ?? "Settings"}
      </Typography>
      {current?.hint ? (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {current.hint}
        </Typography>
      ) : null}
      {/* Wide screens list these pages under Settings in the side menu; phones get the buttons here. */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <SegmentButtonNav items={navItems} activeId={active} />
      </Box>
      <Outlet />
    </Box>
  );
}
