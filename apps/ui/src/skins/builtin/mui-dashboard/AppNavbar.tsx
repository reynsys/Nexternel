import { NotificationBell } from "../../../components/NotificationBell";
import { hasPermission } from "../../../lib/permissions";
import { useState } from "react";
import { styled } from "@mui/material/styles";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import MuiToolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { APP_VERSION } from "../../../version";
import { MenuContent } from "./MenuContent";
import type { User } from "../../../api";
import type { RolePermissions } from "../../../lib/permissions";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import { Link as RouterLink } from "react-router-dom";
import { barSurfaceSx } from "../../surfaceStyles";
import { useGradientActive } from "../../useSurfaceStyles";
import { BrandMark } from "../../../components/BrandMark";
import { getBrandLogo } from "../../brandLogo";

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
          <Stack direction="row" spacing={1} sx={{ mr: "auto", alignItems: "center" }}>
            <BrandMark logo={getBrandLogo()} size={24} />
            <Typography variant="h6" component="h1" sx={{ color: "text.primary" }}>
              Nexternel
            </Typography>
          </Stack>
          {signedIn ? (
            <NotificationBell canClear={hasPermission(permissions ?? null, "manageUsers", isAdmin)} />
          ) : null}
          <IconButton aria-label="menu" onClick={() => setOpen(true)} color="inherit">
            <MenuRoundedIcon />
          </IconButton>
        </Stack>
      </Toolbar>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: "min(280px, 90vw)",
            ...barSurfaceSx(gradientActive),
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Nexternel {APP_VERSION}
          </Typography>
          {signedIn && (
            <Typography variant="caption" color="text.secondary">
              {user?.username} · {user?.role}
            </Typography>
          )}
        </Box>
        <Divider />
        <MenuContent
          signedIn={signedIn}
          isAdmin={isAdmin}
          permissions={permissions}
          authLoading={authLoading}
          onNavigate={() => setOpen(false)}
        />
        <Box sx={{ p: 2 }}>
          {signedIn ? (
            <Button fullWidth variant="outlined" onClick={onLogout}>
              Sign out
            </Button>
          ) : (
            <Button
              fullWidth
              variant="contained"
              component={RouterLink}
              to="/login"
              onClick={() => setOpen(false)}
            >
              Login
            </Button>
          )}
        </Box>
      </Drawer>
    </AppBar>
  );
}
