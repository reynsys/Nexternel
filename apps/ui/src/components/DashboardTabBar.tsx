import { dashboardPath } from "../lib/dashboard-path";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { LookDecor } from "../skins/looks/LookDecor";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { api, type DashboardSummary } from "../api";
import { getDashboardIcon } from "../lib/dashboard-icons";
import { NotificationBell } from "./NotificationBell";
import { useSkin } from "../skins/SkinProvider";
import { useLiveChanges } from "../lib/live-changes";
import { displayPath, useDisplayMode } from "../lib/display-mode";
import type { RoomNav } from "../lib/room-nav";
import { RoomMenu } from "./RoomMenu";

type Props = {
  activeId?: string;
  refreshKey?: number;
  editMode?: boolean;
  /** Show gear / enter Dashboard options */
  canEdit?: boolean;
  /** Enter Dashboard options (layout edit + manage). */
  onDashboardOptions?: () => void;
  /** May clear all notifications (bell beside the cog). */
  canClearNotifications?: boolean;
  /** Which form to draw (lib/room-nav.ts); the page decides from the person's choice and the screen. */
  variant?: RoomNav;
};

/**
 * Dashboard tabs + top-right gear.
 * Gear opens Dashboard options (edit mode) — not a choice menu.
 */
export function DashboardTabBar({
  activeId,
  refreshKey = 0,
  editMode = false,
  canEdit = true,
  onDashboardOptions,
  canClearNotifications = false,
  variant = "tabs",
}: Props) {
  const { skin } = useSkin();
  const display = useDisplayMode();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const tabsRef = useRef<HTMLDivElement>(null);

  /** Keep the open dashboard's tab visible when the row is wider than the screen. */
  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>("[data-nx-active-tab]");
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, dashboards]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Dashboards added, renamed or reordered on another screen.
  const [liveKey, setLiveKey] = useState(0);
  useLiveChanges(["dashboards"], () => setLiveKey((k) => k + 1));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (liveKey === 0) setLoading(true); // a live refresh keeps the tabs on screen
      try {
        const res = await api.dashboards();
        if (!cancelled) {
          setDashboards(res.dashboards);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tabs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, liveKey]);

  const go = (d: DashboardSummary) => {
    const path = dashboardPath(d, dashboards);
    navigate(display.active ? displayPath(path) + window.location.search : path);
  };
  // The bell and the Dashboard Options cog travel with the room menu.
  // In the dock, rail and rooms-panel corner the cog is a button like the rooms beside it.
  const tools = (dir: "row" | "column", size = 44) => (
    <Stack direction={dir} alignItems="center" sx={{ flexShrink: 0, gap: "var(--nx-control-gap)" }}>
      {skin.id === "mui-dashboard" && !display.active ? <NotificationBell place="dashboard" canClear={canClearNotifications} /> : null}
      {canEdit && (
        <Tooltip title="Dashboard Options">
          <Button
            variant={editMode ? "contained" : "outlined"}
            aria-label="Dashboard Options"
            aria-pressed={editMode}
            onClick={() => onDashboardOptions?.()}
            data-nx-room=""
            sx={{ minWidth: size, width: size, height: size, p: 0 }}
          >
            <SettingsOutlinedIcon fontSize="small" />
          </Button>
        </Tooltip>
      )}
    </Stack>
  );
  if (variant !== "tabs") {
    return (
      <RoomMenu
        variant={variant}
        dashboards={dashboards}
        activeId={activeId}
        loading={loading}
        error={error}
        onGo={go}
        tools={tools}
      />
    );
  }

  return (
    <Stack
      data-nx-tabbar
      direction="row"
      alignItems="center"
      spacing={1}
      sx={(t) => ({
        minWidth: 0,
        position: "relative",
        // Room for the Look's own line drawing under the tabs (core space rule).
        pb: `calc(4px + ${t.nx.barEdgeSpace})`,
        // The Look's room bar: its bottom line.
        borderBottom: t.nx.barEdge,
      })}
    >

      <Box
        ref={tabsRef}
        sx={(t) => ({
          display: "flex",
          alignItems: "center",
          // The Look's spacing between room buttons, and room for their shadows inside the scroll area.
          gap: `max(${t.nx.barGap}, var(--nx-control-gap))`,
          minWidth: 0,
          flex: 1,
          overflowX: "auto",
          py: `calc(4px + ${t.nx.barInset} + var(--nx-decor-reach))`,
          px: `calc(${t.nx.barInset} + var(--nx-decor-reach))`,
          // Swipeable on touch screens; no scrollbar strip under the tabs.
          scrollSnapType: "x proximity",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          "& > *": { scrollSnapAlign: "start" },
        })}
      >
        {loading && (
          <Typography variant="caption" color="text.secondary">
            Loading tabs…
          </Typography>
        )}
        {!loading && error && (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        )}
        {!loading && !error && dashboards.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No dashboards — open Dashboard options to create one.
          </Typography>
        )}
        {!loading &&
          dashboards.map((d) => {
            const Icon = getDashboardIcon(d.tabIcon);
            const active = d.id === activeId;
            const showLabel = d.showTabLabel !== false;
            const tab = (
              <Button
                key={d.id}
                size="small"
                data-nx-active-tab={active ? "" : undefined}
                variant={active ? "contained" : "outlined"}
                color={active ? "primary" : "inherit"}
                onClick={() => {
                  const path = dashboardPath(d, dashboards);
                  navigate(display.active ? displayPath(path) + window.location.search : path);
                }}
                startIcon={<Icon fontSize="small" />}
                sx={{
                  flexShrink: 0,
                  textTransform: "none",
                  minWidth: showLabel ? undefined : 40,
                  px: showLabel ? 1.5 : 1,
                  ...(showLabel
                    ? {}
                    : { "& .MuiButton-startIcon": { mr: 0 } }),
                }}
              >
                {showLabel ? (
                  <Box
                    component="span"
                    sx={{
                      maxWidth: 128,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.name}
                  </Box>
                ) : null}
              </Button>
            );
            return showLabel ? (
              tab
            ) : (
              <Tooltip key={d.id} title={d.name}>
                <span>{tab}</span>
              </Tooltip>
            );
          })}
      </Box>
      {skin.id === "mui-dashboard" && !display.active ? (
        <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
          <NotificationBell place="dashboard" canClear={canClearNotifications} />
        </Box>
      ) : null}
      {canEdit && (
        <Tooltip title="Dashboard Options">
          <IconButton
            size="small"
            color={editMode ? "primary" : "default"}
            aria-label="Dashboard Options"
            aria-pressed={editMode}
            onClick={() => onDashboardOptions?.()}
          >
            <SettingsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {/* Last, so the row's spacing does not shift the tabs; "!important" beats the row's gap margin. */}
      <Box sx={(t) => ({ position: "absolute", left: 0, right: 0, bottom: 0, height: t.nx.barEdgeSpace, pointerEvents: "none", ml: "0 !important" })}>
        <LookDecor slot="barEdge" />
      </Box>
    </Stack>
  );
}
