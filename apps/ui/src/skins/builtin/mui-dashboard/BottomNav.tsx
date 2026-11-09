import { TYPE_SCALE } from "../../../lib/appearance/type";
import { useState, type MouseEvent } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { guardLinkClick } from "../../../lib/leave-guard";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Drawer from "@mui/material/Drawer";
import Paper from "@mui/material/Paper";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { ButtonRow } from "../../../components/ButtonRow";
import Typography from "@mui/material/Typography";
import type { User } from "../../../api";
import type { RolePermissions } from "../../../lib/permissions";
import { barSurfaceSx } from "../../surfaceStyles";
import { useGradientActive } from "../../useSurfaceStyles";
import { filterNav, navItemActive, type NavItem } from "../../nav";
import { useMainNav } from "../../useMainNav";
import { MenuContent } from "./MenuContent";
import { DashboardSheet, openDashboardSheet } from "../../../components/DashboardSheet";
import { APP_VERSION } from "../../../version";
import { AndroidUpdate } from "../../../components/AndroidUpdate";

/** Phone bottom bar: the first four main pages within thumb reach; everything else under More. */
export const BOTTOM_NAV_HEIGHT_PX = 64;
const BOTTOM_NAV_SLOTS = 4;

type Props = {
  signedIn: boolean;
  isAdmin: boolean;
  permissions?: RolePermissions | null;
  authLoading?: boolean;
  user: User | null;
  onLogout: () => void;
};

export function BottomNav({ signedIn, isAdmin, permissions, authLoading = false, user, onLogout }: Props) {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  // A group in the bar (Extensions) opens a sheet of its pages instead of jumping to the first one.
  const [group, setGroup] = useState<NavItem | null>(null);
  const navigate = useNavigate();
  const gradientActive = useGradientActive();
  const mainNav = useMainNav();
  if (!signedIn) return null;

  const items = filterNav(mainNav, { signedIn, isAdmin, permissions, authLoading });
  const shown = items.slice(0, BOTTOM_NAV_SLOTS);
  const activeIndex = shown.findIndex((item) => navItemActive(item, pathname));

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          display: { xs: "block", md: "none" },
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderTop: "1px solid",
          borderColor: "divider",
          pb: "env(safe-area-inset-bottom)",
          ...barSurfaceSx(gradientActive),
        }}
      >
        <BottomNavigation
          showLabels
          value={moreOpen ? BOTTOM_NAV_SLOTS : activeIndex}
          sx={{
            height: BOTTOM_NAV_HEIGHT_PX,
            bgcolor: "transparent",
            "& .MuiBottomNavigationAction-root": { minWidth: 0, px: 0.5 },
            "& .MuiBottomNavigationAction-label, & .MuiBottomNavigationAction-label.Mui-selected": {
              fontSize: TYPE_SCALE.overline.fontSize,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            },
          }}
        >
          {shown.map((item) => {
            const Icon = item.icon;
            return (
              <BottomNavigationAction
                key={item.to}
                label={item.label}
                icon={<Icon />}
                component={RouterLink}
                to={item.to}
                onClick={(e: MouseEvent) => {
                  // Dashboards opens the sheet of dashboards (phones have no dock).
                  if (item.to === "/") {
                    e.preventDefault();
                    openDashboardSheet();
                    return;
                  }
                  if (item.children?.length) {
                    e.preventDefault();
                    setGroup(item);
                    return;
                  }
                  void guardLinkClick(e, () => navigate(item.to));
                }}
              />
            );
          })}
          <BottomNavigationAction
            label="More"
            icon={<MoreHorizRoundedIcon />}
            onClick={() => setMoreOpen(true)}
          />
        </BottomNavigation>
      </Paper>
      <DashboardSheet />
      <Drawer
        anchor="bottom"
        open={group !== null}
        onClose={() => setGroup(null)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: "env(safe-area-inset-bottom)" } }}
      >
        {group ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" component="h2" sx={{ mb: 1.5 }}>
              {group.label}
            </Typography>
            <ButtonRow direction="column" alignItems="stretch" flexWrap="nowrap">
            {group.children!.map((page) => {
              const Icon = page.icon;
              const here = pathname === page.to || pathname.startsWith(`${page.to}/`);
              return (
                <Button
                  key={page.to}
                  component={RouterLink}
                  to={page.to}
                  variant={here ? "contained" : "outlined"}
                  startIcon={<Icon />}
                  aria-current={here ? "page" : undefined}
                  onClick={(e: MouseEvent) => {
                    if (!guardLinkClick(e, () => (navigate(page.to), setGroup(null)))) setGroup(null);
                  }}
                  sx={{ justifyContent: "flex-start", py: 1.5, textTransform: "none" }}
                >
                  {page.label}
                </Button>
              );
            })}
            </ButtonRow>
          </Box>
        ) : null}
      </Drawer>
      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: "env(safe-area-inset-bottom)" } }}
      >
        <Box sx={{ px: 2, pt: 2 }}>
          <Typography variant="subtitle1">Nexternel {APP_VERSION}</Typography>
          {user ? (
            <Typography variant="caption" color="text.secondary">
              {user.username} · {user.role}
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ pt: 1 }}>
          <AndroidUpdate />
        </Box>
        <MenuContent
          unfold
          signedIn={signedIn}
          isAdmin={isAdmin}
          permissions={permissions}
          authLoading={authLoading}
          onNavigate={() => setMoreOpen(false)}
        />
        <Box sx={{ px: 2, pb: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => {
              setMoreOpen(false);
              onLogout();
            }}
          >
            Sign out
          </Button>
        </Box>
      </Drawer>
    </>
  );
}
