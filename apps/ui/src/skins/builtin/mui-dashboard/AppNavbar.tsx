import { NotificationBell, useMenuDot } from "../../../components/NotificationBell";
import { hasPermission } from "../../../lib/permissions";
import { useState } from "react";
import { styled } from "@mui/material/styles";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import MuiToolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { Theme } from "@mui/material/styles";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { MenuContent } from "./MenuContent";
import type { User } from "../../../api";
import type { RolePermissions } from "../../../lib/permissions";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import { Link as RouterLink } from "react-router-dom";
import { barSurfaceSx } from "../../surfaceStyles";
import { useGradientActive } from "../../useSurfaceStyles";
import { BrandMark } from "../../../components/BrandMark";
import { MenuFooter } from "./MenuFooter";

const Toolbar = styled(MuiToolbar)({
  width: "100%",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "start",
  justifyContent: "center",
  gap: "12px",
  flexShrink: 0,
});

type Props = {
  signedIn: boolean;
  isAdmin: boolean;
  permissions?: RolePermissions | null;
  authLoading?: boolean;
  user: User | null;
  onLogout: () => void;
};

export function AppNavbar({
  signedIn,
  isAdmin,
  permissions,
  authLoading = false,
  user,
  onLogout,
}: Props) {
  const [open, setOpen] = useState(false);
  const gradientActive = useGradientActive();
  const dot = useMenuDot();

  return (
    <AppBar
      position="fixed"
      sx={{
        display: { xs: "auto", md: "none" },
        boxShadow: 0,
        ...barSurfaceSx(gradientActive),
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar variant="regular">
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            flexGrow: 1,
            width: "100%",
            gap: 1,
          }}
        >
          {/* The logo and name lead to the start dashboard (as on most websites). */}
          <Stack
            direction="row"
            spacing={1}
            component={RouterLink}
            to="/"
            aria-label="Nexternel, start dashboard"
            sx={{ mr: "auto", alignItems: "center", textDecoration: "none", color: "inherit" }}
          >
            <BrandMark size={24} />
            <Typography variant="h6" component="h1" sx={{ color: "text.primary" }}>
              Nexternel
            </Typography>
          </Stack>
          {signedIn ? (
            <NotificationBell canClear={hasPermission(permissions ?? null, "manageUsers", isAdmin)} />
          ) : null}
          {/* The menu: every page, App settings and Sign out. The bottom of a phone's screen is left to
              the dashboards (the dock), so there is one row there, not two. */}
          <Button variant="outlined" aria-label={dot ? "Menu, new messages" : "Menu"} onClick={() => setOpen(true)} sx={{ minWidth: 40, width: 40, height: 40, p: 0, position: "relative" }}>
            <MenuRoundedIcon />
            {/* New messages while the bell is off. */}
            {dot ? (
              <Box component="span" sx={{ position: "absolute", top: -4, right: -4, width: 12, height: 12, borderRadius: "50%", bgcolor: dot, border: "2px solid", borderColor: "background.default" }} />
            ) : null}
          </Button>
        </Stack>
      </Toolbar>
      <SwipeableDrawer
        anchor="right"
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        // Opened by the menu button only; a swipe to the right closes it.
        disableSwipeToOpen
        slotProps={{ backdrop: { sx: { bgcolor: "rgba(0, 0, 0, 0.6)" } } }}
        PaperProps={{
          sx: {
            width: "min(272px, 78vw)",
            pb: "env(safe-area-inset-bottom)",
            // Solid, so the dashboard does not show through the menu: the frame colour laid over the page colour.
            backgroundColor: "background.default",
            backgroundImage: (t: Theme) => `linear-gradient(${t.nxScheme.surface.frame}, ${t.nxScheme.surface.frame})`,
            borderLeft: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        {/* The same top as the side menu: logo and name, then the menu; only the close button is extra. */}
        <Stack direction="row" sx={{ p: 2, alignItems: "center", gap: 1.5, minHeight: 64 }}>
          <BrandMark size={28} />
          <Typography variant="subtitle1" sx={(t) => ({ fontWeight: "fontWeightBold", lineHeight: 1.2, flex: 1, textTransform: t.nx.headingCase, letterSpacing: t.nx.headingSpacing })}>
            Nexternel
          </Typography>
          <Button variant="outlined" aria-label="Close menu" onClick={() => setOpen(false)} sx={{ minWidth: 40, width: 40, height: 40, p: 0, flexShrink: 0 }}>
            <CloseRoundedIcon />
          </Button>
        </Stack>
        {signedIn ? (
          <Box sx={{ px: 2, pb: 1.5, "&:empty": { display: "none" } }}>
            <NotificationBell place="phone-menu" canClear={hasPermission(permissions ?? null, "manageUsers", isAdmin)} />
          </Box>
        ) : null}
        <Divider />
        <MenuContent
          unfold
          signedIn={signedIn}
          isAdmin={isAdmin}
          permissions={permissions}
          authLoading={authLoading}
          onNavigate={() => setOpen(false)}
        />
        <Box sx={{ mt: "auto", p: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
          {signedIn ? (
            <MenuFooter
              user={user}
              isAdmin={isAdmin}
              permissions={permissions}
              onNavigate={() => setOpen(false)}
              onLogout={() => {
                setOpen(false);
                onLogout();
              }}
            />
          ) : (
            <Button fullWidth variant="contained" component={RouterLink} to="/login" onClick={() => setOpen(false)}>
              Sign in
            </Button>
          )}
        </Box>
      </SwipeableDrawer>
    </AppBar>
  );
}
