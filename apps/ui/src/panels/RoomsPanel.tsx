import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import { api, type DashboardSummary } from "../api";
import { dashboardPath, dashboardPaths } from "../lib/dashboard-path";
import { getDashboardIcon } from "../lib/dashboard-icons";
import { displayPath, useDisplayMode } from "../lib/display-mode";
import { useLiveChanges } from "../lib/live-changes";
import { panelContentRootSx } from "../components/DashboardTileBody";

/**
 * The Rooms panel: every room (dashboard) as a button, the open one filled. A normal panel —
 * placed, moved and resized like any other; with Room menu = Rooms panel it is the room menu.
 */
export function RoomsPanel() {
  const [rooms, setRooms] = useState<DashboardSummary[]>([]);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const display = useDisplayMode();
  const load = useCallback(() => {
    void api
      .dashboards()
      .then((r) => setRooms(r.dashboards))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);
  useLiveChanges(["dashboards"], load);
  const paths = dashboardPaths(rooms);
  const here = pathname.replace(/^\/display(?=\/|$)/, "").replace(/\/$/, "") || "/";
  return (
    <Box
      sx={panelContentRootSx({
        p: 1,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        alignContent: "start",
        gap: "var(--nx-list-gap)",
      })}
    >
      {rooms.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          Loading rooms…
        </Typography>
      ) : null}
      {rooms.map((d) => {
        const Icon = getDashboardIcon(d.tabIcon);
        const path = paths.get(d.id) ?? dashboardPath(d, rooms);
        const active = path === here || (here.startsWith("/d/") ? false : path === "/" && here === "/");
        return (
          <Button
            key={d.id}
            variant={active ? "contained" : "outlined"}
            startIcon={<Icon fontSize="small" />}
            onClick={() => navigate(display.active ? displayPath(path) + search : path)}
            aria-current={active ? "page" : undefined}
            sx={{ justifyContent: "flex-start", textTransform: "none", minWidth: 0 }}
          >
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.name}
            </Box>
          </Button>
        );
      })}
    </Box>
  );
}
