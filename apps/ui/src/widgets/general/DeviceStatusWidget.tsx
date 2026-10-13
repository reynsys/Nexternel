import { useMemo } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { api, type DeviceRecord, type WidgetInstance } from "../../api";
import { panelContentRootSx } from "../../components/DashboardTileBody";
import { parseDeviceStatusConfig } from "./config";
import { genericTileLinesQuerySx } from "./tile-type";
import { usePanelPoll } from "../../lib/usePanelPoll";
import { PanelNotice } from "../../components/PanelNotice";
import { useWidgetBodyHeading } from "./heading";
import { formatLastSeen, connectivityChipColor, deviceConnectivityState } from "../../lib/device-utils";

export function DeviceStatusWidget({ widget }: { widget: WidgetInstance }) {
  const { offlineOnly } = parseDeviceStatusConfig(widget.config);
  const { data, error } = usePanelPoll(() => api.devices(), 30_000);
  const devices: DeviceRecord[] = data?.devices ?? [];
  const title = useWidgetBodyHeading(widget, "Devices");

  const online = devices.filter(
    (d) => d.isEnabled && deviceConnectivityState(d) === "online"
  ).length;
  const noRecent = devices.filter(
    (d) => d.isEnabled && deviceConnectivityState(d) === "no_recent_data"
  ).length;
  const offline = devices.filter(
    (d) => d.isEnabled && deviceConnectivityState(d) === "offline"
  ).length;
  const disabled = devices.filter((d) => !d.isEnabled).length;

  const list = useMemo(() => {
    const sorted = [...devices].sort((a, b) => {
      const aConn = deviceConnectivityState(a);
      const bConn = deviceConnectivityState(b);
      if (aConn !== bConn) {
        const order = { offline: 0, no_recent_data: 1, online: 2 } as const;
        return order[aConn] - order[bConn];
      }
      return a.name.localeCompare(b.name);
    });
    if (offlineOnly) {
      return sorted.filter((d) => deviceConnectivityState(d) === "offline");
    }
    return sorted;
  }, [devices, offlineOnly]);

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {title && (
        <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ mb: 0.5, flexShrink: 0 }}>
          {title}
        </Typography>
      )}
      <Box sx={panelContentRootSx(genericTileLinesQuerySx)}>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.75, flexShrink: 0, p: 1 }}>
        <Chip size="small" color="success" label={`${online} online`} />
        {noRecent > 0 && (
          <Chip size="small" label={`${noRecent} no recent data`} />
        )}
        <Chip size="small" color={offline ? "warning" : "default"} label={`${offline} offline`} />
        {disabled > 0 && <Chip size="small" label={`${disabled} disabled`} />}
      </Stack>
      {error && <PanelNotice>{error}</PanelNotice>}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {list.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            {offlineOnly ? "No offline devices." : "No devices registered."}
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {list.map((d) => {
              const connectivity = deviceConnectivityState(d);
              return (
              <Stack
                key={d.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{
                  px: 1,
                  py: 0.35,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={600} noWrap display="block">
                    {d.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {d.roomName ?? "No area"} · {formatLastSeen(d.lastSeenAt)}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={
                    !d.isEnabled
                      ? "off"
                      : connectivity === "online"
                        ? "on"
                        : connectivity === "no_recent_data"
                          ? "no data"
                          : "out"
                  }
                  color={
                    !d.isEnabled
                      ? "default"
                      : connectivityChipColor(connectivity)
                  }
                  sx={{ height: 24 }}
                />
              </Stack>
            );
            })}
          </Stack>
        )}
      </Box>
      </Box>
    </Box>
  );
}
