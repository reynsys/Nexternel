import { useEffect, useState, type ReactNode } from "react";
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Alert, Button, CircularProgress, Stack } from "@mui/material";
import { AppLayout } from "./layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExtensionsSettingsPage } from "./pages/admin/settings/ExtensionsSettingsPage";
import { SettingsLayout } from "./pages/admin/settings/SettingsLayout";
import { SettingsIndexRedirect } from "./pages/admin/settings/SettingsIndexRedirect";
import { AppearanceSettingsPage } from "./pages/admin/settings/AppearanceSettingsPage";
import { SystemStatusPage } from "./pages/admin/settings/SystemStatusPage";
import { NotificationsSettingsPage } from "./pages/admin/settings/NotificationsSettingsPage";
import { BackupSettingsPage } from "./pages/admin/settings/BackupSettingsPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { RolesPage } from "./pages/admin/RolesPage";
import { AreasPage } from "./pages/admin/AreasPage";
import { DevicesPage } from "./pages/admin/DevicesPage";
import { api, getStoredAccessToken, lastKnownUser, type User } from "./api";
import {
  hasPermission,
  type PermissionKey,
} from "./lib/permissions";
import { PluginHostProvider } from "./plugins/PluginHostContext";
import { DisplayPage } from "./pages/DisplayPage";

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!getStoredAccessToken()) {
    // After signing in, come back here (e.g. a wall display's /display address).
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null | undefined>(() => lastKnownUser() ?? undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    const load = () => {
      void api
        .me()
        .then((r) => {
          if (cancelled) return;
          setUser(r.user);
          setFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          // Still holding a login: the server was unreachable, not a rejected login. Retry.
          if (getStoredAccessToken()) {
            retryTimer = window.setTimeout(load, 3000);
            return;
          }
          setUser(null);
          setFailed(true);
        });
    };
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
  }, []);

  if (user === undefined) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }
  if (failed || !user) {
    return <Navigate to="/login" replace />;
  }
  const ok = hasPermission(
    user.permissions,
    permission,
    Boolean(user.isAdmin ?? user.role === "admin")
  );
  if (!ok) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={2}>
        <Alert severity="warning" sx={{ maxWidth: 480 }}>
          Your account does not have permission to open this page.
        </Alert>
        <Button component={RouterLink} to="/" variant="contained">
          Open Dashboards
        </Button>
      </Stack>
    );
  }
  return children;
}

function SetupGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "needs" | "ready">("loading");

  useEffect(() => {
    void api
      .setupStatus()
      .then((status) => setState(status.needsSetup ? "needs" : "ready"))
      .catch(() => setState("ready"));
  }, []);

  if (state === "loading") {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }
  if (state === "needs") {
    return <Navigate to="/setup" replace />;
  }
  return children;
}

export function App() {
  return (
    <PluginHostProvider>
    <Routes>
      {/* Display mode: the dashboard alone, full screen (wall displays, tablets). */}
      {["display", "display/:slug"].map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <RequireAuth>
              <RequirePermission permission="viewDashboards">
                <DisplayPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
      ))}
      <Route element={<AppLayout />}>
        <Route path="setup" element={<SetupPage />} />
        <Route
          path="login"
          element={
            <SetupGate>
              <LoginPage />
            </SetupGate>
          }
        />
        {/* Retired developer pages (Troubleshoot, panel preview): the diagnostic report lives in Settings → System. */}
        <Route path="troubleshoot/*" element={<Navigate to="/admin/settings/system" replace />} />
        <Route path="panels" element={<Navigate to="/admin/settings/system" replace />} />

        <Route
          index
          element={
            <SetupGate>
              <RequireAuth>
                <RequirePermission permission="viewDashboards">
                  <DashboardPage />
                </RequirePermission>
              </RequireAuth>
            </SetupGate>
          }
        />
        <Route
          path="d/:slug"
          element={
            <RequireAuth>
              <RequirePermission permission="viewDashboards">
                <DashboardPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="dashboards/:id"
          element={
            <RequireAuth>
              <RequirePermission permission="viewDashboards">
                <DashboardPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="dashboards"
          element={
            <RequireAuth>
              <RequirePermission permission="viewDashboards">
                <DashboardPage />
              </RequirePermission>
            </RequireAuth>
          }
        />

        <Route path="views" element={<Navigate to="/admin/settings/system" replace />} />

        {/* The old dashboards page: everything it did is in Dashboard settings → All dashboards. */}
        <Route path="manage/dashboards" element={<Navigate to="/" replace />} />

        <Route path="live" element={<Navigate to="/" replace />} />

        <Route
          path="admin/settings"
          element={
            <RequireAuth>
              <SettingsLayout />
            </RequireAuth>
          }
        >
          <Route index element={<SettingsIndexRedirect />} />
          <Route
            path="appearance"
            element={
              <RequirePermission permission="viewSystem">
                <AppearanceSettingsPage />
              </RequirePermission>
            }
          />
          <Route
            path="notifications"
            element={
              <RequirePermission permission="viewSystem">
                <NotificationsSettingsPage />
              </RequirePermission>
            }
          />
          <Route
            path="system"
            element={
              <RequirePermission permission="viewSystem">
                <SystemStatusPage />
              </RequirePermission>
            }
          />
          <Route
            path="extensions"
            element={
              <RequirePermission permission="viewSystem">
                <ExtensionsSettingsPage />
              </RequirePermission>
            }
          />
          {/* Plugins and Add-ons are one page now: Extensions. */}
          <Route path="plugins" element={<Navigate to="/admin/settings/extensions" replace />} />
          <Route path="addons" element={<Navigate to="/admin/settings/extensions" replace />} />
          <Route path="configuration" element={<Navigate to="/admin/settings/backup" replace />} />
          <Route
            path="backup"
            element={
              <RequirePermission permission="manageUsers">
                <BackupSettingsPage />
              </RequirePermission>
            }
          />
          <Route
            path="users"
            element={
              <RequirePermission permission="manageUsers">
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="users/roles"
            element={
              <RequirePermission permission="manageRoles">
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route path="advanced" element={<Navigate to="/admin/settings/backup" replace />} />
          <Route path="automations" element={<Navigate to="/admin/settings/backup" replace />} />
        </Route>

        <Route path="admin/system" element={<Navigate to="/admin/settings/system" replace />} />
        <Route path="admin/profile" element={<Navigate to="/admin/settings/users" replace />} />

        {/* Users and Roles are in Settings now. */}
        <Route path="admin/users" element={<Navigate to="/admin/settings/users" replace />} />
        <Route path="admin/roles" element={<Navigate to="/admin/settings/users/roles" replace />} />
        <Route
          path="admin/areas"
          element={
            <RequireAuth>
              <RequirePermission permission="viewAreas">
                <AreasPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route path="admin/rooms" element={<Navigate to="/admin/areas" replace />} />
        <Route
          path="admin/devices"
          element={
            <RequireAuth>
              <RequirePermission permission="viewDevices">
                <DevicesPage />
              </RequirePermission>
            </RequireAuth>
          }
        />
        {/* Cameras are listed with the other devices now. */}
        <Route path="admin/cameras" element={<Navigate to="/admin/devices" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </PluginHostProvider>
  );
}
