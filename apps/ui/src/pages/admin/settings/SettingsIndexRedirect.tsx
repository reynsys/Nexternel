import { Navigate } from "react-router-dom";
import { CircularProgress, Stack } from "@mui/material";
import { hasPermission } from "../../../lib/permissions";
import { useShellAuth } from "../../../skins/useShellAuth";
import { SETTINGS_TABS, settingsTabPath } from "./settings-nav";

export function SettingsIndexRedirect() {
  const { signedIn, user, isAdmin, permissions } = useShellAuth();

  if (signedIn && user === null) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }

  const tabs = SETTINGS_TABS.filter((tab) =>
    hasPermission(permissions, tab.permission, Boolean(isAdmin))
  );
  const first = tabs[0]?.segment ?? "appearance";
  return <Navigate to={settingsTabPath(first)} replace />;
}
