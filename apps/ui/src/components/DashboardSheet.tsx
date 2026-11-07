import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button, Drawer, Typography } from "@mui/material";
import { api, type DashboardSummary } from "../api";
import { getDashboardIcon } from "../lib/dashboard-icons";
import { dashboardPath } from "../lib/dashboard-path";
import { leaveThen } from "../lib/leave-guard";
import { useLiveChanges } from "../lib/live-changes";

/**
 * Phones: the dashboards in one sheet, opened from Dashboards in the bottom bar, beside the dock
 * (which slides under a finger) and swiping on the dashboard (lib/use-dashboard-swipe.ts).
 */

let open = false;
const subs = new Set<() => void>();
function setOpen(next: boolean) {
  if (open === next) return;
  open = next;
  subs.forEach((cb) => cb());
}
export function openDashboardSheet() {
  setOpen(true);
}
function useSheetOpen() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => open
  );
}

/** The id of the dashboard on screen, from the address (null when no dashboard is open). */
export function openDashboardId(pathname: string, list: readonly DashboardSummary[]): string | null {
  if (pathname === "/" || pathname === "") return list.find((d) => d.isDefault)?.id ?? list[0]?.id ?? null;
  for (const d of list) if (dashboardPath(d, list) === pathname || pathname === `/dashboards/${d.id}`) return d.id;
  return null;
}

export function DashboardSheet() {
  const shown = useSheetOpen();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dashboards, setDashboards] = useState<DashboardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveKey, setLiveKey] = useState(0);
  useLiveChanges(["dashboards"], () => setLiveKey((k) => k + 1));

  useEffect(() => {
    if (!shown) return;
    let cancelled = false;
    api
      .dashboards()
      .then((r) => {
        if (cancelled) return;
        setDashboards(r.dashboards);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the dashboards");
      });
    return () => {
      cancelled = true;
    };
  }, [shown, liveKey]);

  const activeId = dashboards ? openDashboardId(pathname, dashboards) : null;
  const go = (d: DashboardSummary) => {
    setOpen(false);
    leaveThen(() => navigate(dashboardPath(d, dashboards ?? [])));
  };

  return (
    <Drawer
      anchor="bottom"
      open={shown}
      onClose={() => setOpen(false)}
      PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: "env(safe-area-inset-bottom)" } }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" component="h2" sx={{ mb: 1.5 }}>
          Dashboards
        </Typography>
        {error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : !dashboards ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : dashboards.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No dashboards yet.
          </Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 1 }}>
            {dashboards.map((d) => {
              const Icon = getDashboardIcon(d.tabIcon);
              const active = d.id === activeId;
              return (
                <Button
                  key={d.id}
                  onClick={() => go(d)}
                  variant={active ? "contained" : "outlined"}
                  aria-current={active ? "page" : undefined}
                  sx={{ flexDirection: "column", gap: 0.5, py: 1.5, minHeight: 84, textTransform: "none" }}
                >
                  <Icon />
                  <Box
                    component="span"
                    sx={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", typography: "body2" }}
                  >
                    {d.name}
                  </Box>
                </Button>
              );
            })}
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
