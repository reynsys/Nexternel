import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { Outlet } from "react-router-dom";
import { useShellAuth } from "../../useShellAuth";
import { MaintenanceBanner } from "../../../components/MaintenanceBanner";
import { useSkin } from "../../SkinProvider";
import { isGradientActive } from "../../surfaceStyles";
import { SideMenu, useSideMenuCollapsed } from "./SideMenu";
import { AppNavbar } from "./AppNavbar";
import { BottomNav, BOTTOM_NAV_HEIGHT_PX } from "./BottomNav";

/** Free MUI dashboard-style shell: permanent side menu + mobile app bar. */
export function MuiDashboardLayout() {
  const { signedIn, user, isAdmin, permissions, authLoading, logout } = useShellAuth();
  const [collapsed, setCollapsed] = useSideMenuCollapsed();
  const { themePrefs } = useSkin();
  const hasGradient = isGradientActive(themePrefs);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <SideMenu
        signedIn={signedIn}
        isAdmin={isAdmin}
        permissions={permissions}
        authLoading={authLoading}
        user={user ?? null}
        onLogout={() => void logout()}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
      <AppNavbar
        signedIn={signedIn}
        isAdmin={isAdmin}
        permissions={permissions}
        authLoading={authLoading}
        user={user ?? null}
        onLogout={() => void logout()}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: hasGradient ? "transparent" : "background.default",
          overflow: "auto",
          minWidth: 0,
        }}
      >
        <Stack
          spacing={2}
          sx={{
            mx: { xs: 2, md: 3 },
            // Phones: room for the bottom bar.
            pb: { xs: `${BOTTOM_NAV_HEIGHT_PX + 24}px`, md: 5 },
            pt: { xs: 10, md: 3 },
          }}
        >
          {signedIn ? <MaintenanceBanner /> : null}
          <Outlet />
        </Stack>
      </Box>
      <BottomNav
        signedIn={signedIn}
        isAdmin={isAdmin}
        permissions={permissions}
        authLoading={authLoading}
        user={user ?? null}
      />
    </Box>
  );
}
