import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";
import { APP_VERSION } from "../../../version";
import { NotificationBell } from "../../../components/NotificationBell";
import { hasPermission } from "../../../lib/permissions";
import { filterNav, MAIN_NAV, navItemActive, SECONDARY_NAV } from "../../nav";
import { useShellAuth } from "../../useShellAuth";
import { MaintenanceBanner } from "../../../components/MaintenanceBanner";
import { useSkin } from "../../SkinProvider";
import { isGradientActive } from "../../surfaceStyles";
import { ButtonRow } from "../../../components/ButtonRow";

/** Flat top-nav shell (original V3 look). */
export function ClassicLayout() {
  const { signedIn, user, isAdmin, permissions, authLoading, logout } = useShellAuth();
  const { themePrefs } = useSkin();
  const { pathname } = useLocation();
  const hasGradient = isGradientActive(themePrefs);
  const main = filterNav(MAIN_NAV, { signedIn, isAdmin, permissions, authLoading });
  const secondary = filterNav(SECONDARY_NAV, { signedIn, isAdmin, permissions, authLoading });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: hasGradient ? "transparent" : "background.default",
      }}
    >
      <AppBar position="static" elevation={0} color="transparent">
        <Toolbar sx={{ gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mr: 1 }}>
            Nexternel {APP_VERSION}
          </Typography>
          <ButtonRow
            direction="row"
            alignItems="center"
            sx={{ flexGrow: 1 }}
            flexWrap="wrap"
            useFlexGap
          >
            {main.map((item) => {
              const active = navItemActive(item, pathname);
              return (
                <Button
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  size="small"
                  variant={active ? "contained" : "outlined"}
                  color={active ? "primary" : "inherit"}
                  sx={{ textTransform: "none" }}
                >
                  {item.label}
                </Button>
              );
            })}
            {secondary.map((item) => {
              const active = navItemActive(item, pathname);
              return (
                <Button
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  size="small"
                  variant={active ? "contained" : "outlined"}
                  color={active ? "primary" : "inherit"}
                  sx={{ textTransform: "none" }}
                >
                  {item.label}
                </Button>
              );
            })}
          </ButtonRow>
          {signedIn ? <NotificationBell canClear={hasPermission(permissions ?? null, "manageUsers", isAdmin)} /> : null}
          {signedIn ? (
            <Button color="inherit" size="small" onClick={() => void logout()}>
              Sign out
              {user
                ? ` (${user.displayName?.trim() || user.username})`
                : ""}
            </Button>
          ) : (
            <Button component={RouterLink} to="/login" variant="outlined" size="small">
              Login
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3, flex: 1 }}>
        {signedIn ? <MaintenanceBanner /> : null}
        <Outlet />
      </Container>
    </Box>
  );
}
