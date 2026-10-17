import { dashboardPath } from "../lib/dashboard-path";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { api, type DashboardSummary } from "../api";
import { getDashboardIcon } from "../lib/dashboard-icons";
import { NotificationBell } from "./NotificationBell";
import { useSkin } from "../skins/SkinProvider";

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
}: Props) {
  const { skin } = useSkin();
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
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
  }, [refreshKey]);

  return (
    <Stack
      data-nx-tabbar
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        minWidth: 0,
        pb: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        ref={tabsRef}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          minWidth: 0,
          flex: 1,
          overflowX: "auto",
          py: 0.5,
          // Swipeable on touch screens; no scrollbar strip under the tabs.
          scrollSnapType: "x proximity",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          "& > *": { scrollSnapAlign: "start" },
        }}
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
                onClick={() => navigate(dashboardPath(d, dashboards))}
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
      {skin.id === "mui-dashboard" ? (
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
    </Stack>
  );
}
