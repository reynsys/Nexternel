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
          // Nothing wider than the page shows a sideways scrollbar. "clip" (not a scrolling box), so
          // the page scrolls as a whole and a bar can stay at the top of the screen (sticky).
          overflowX: "clip",
          minWidth: 0,
          // Height of the phone's top bar (MUI toolbar heights); none on wide screens.
          "--nx-top-bar": "56px",
          "@media (orientation: landscape)": { "--nx-top-bar": "48px" },
          "@media (min-width: 600px)": { "--nx-top-bar": "64px" },
          "@media (min-width: 900px)": { "--nx-top-bar": "0px" },
        }}
      >
        <Stack
          spacing={2}
          sx={{
            mx: { xs: 2, md: 3 },
            // Room at the end of the page: the phone's bottom bar, and a dock menu when one is shown
            // (it sets --nx-dock-space), so nothing at the end is ever covered.
            pb: {
              xs: `calc(${BOTTOM_NAV_HEIGHT_PX + 24}px + var(--nx-dock-space, 0px))`,
              md: "max(40px, var(--nx-dock-space, 0px))",
            },
            // The page starts just below the phone's top bar; on wide screens its first row lines
            // up with the side menu's title row.
            pt: { xs: "calc(var(--nx-top-bar) + 24px)", md: 1.5 },
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
