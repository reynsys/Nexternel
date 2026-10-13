import { Box, Stack, Typography } from "@mui/material";
import { api, type SystemInfo, type WidgetInstance } from "../../api";
import { APP_VERSION } from "../../version";
import { panelContentRootSx } from "../../components/DashboardTileBody";
import { useMetricAppearance } from "../../skins/useMetricAppearance";
import { useWidgetBodyHeading } from "./heading";
import { genericTileLinesQuerySx, genericTileLinesSize } from "./tile-type";
import { usePanelPoll } from "../../lib/usePanelPoll";
import { PanelNotice } from "../../components/PanelNotice";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Row({ label, value }: { label: string; value: string }) {
  const { valueSx, labelSx } = useMetricAppearance();
  return (
    <Stack direction="row" justifyContent="space-between" spacing={1}>
      <Typography sx={{ ...labelSx, fontSize: genericTileLinesSize, lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography noWrap sx={{ ...valueSx, fontWeight: 600, fontSize: genericTileLinesSize, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Stack>
  );
}

export function SystemInfoWidget({ widget }: { widget: WidgetInstance }) {
  const { data: info, error } = usePanelPoll<SystemInfo>(() => api.system(), 5_000);
  const title = useWidgetBodyHeading(widget, "System");

  const mem = info?.memory;
  const memPercent =
    mem?.percent != null
      ? mem.percent
      : mem && mem.totalMb > 0
        ? Math.round((mem.usedMb / mem.totalMb) * 100)
        : null;

  const uptimeSeconds =
    info?.hostUptimeSeconds != null && info.hostUptimeSeconds > 0
      ? info.hostUptimeSeconds
      : info?.uptimeSeconds;

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
        <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ mb: 0.75, flexShrink: 0 }}>
          {title}
        </Typography>
      )}
      {error && <PanelNotice>{error}</PanelNotice>}
      <Box sx={panelContentRootSx(genericTileLinesQuerySx)}>
      <Stack spacing={0.5} sx={{ flex: 1, minHeight: 0, justifyContent: "center", p: 1.5 }}>
        <Row label="Version" value={APP_VERSION} />
        <Row label="Uptime" value={uptimeSeconds != null ? formatUptime(uptimeSeconds) : "—"} />
        <Row label="CPU" value={info ? `${info.cpu.loadPercent}%` : "—"} />
        <Row label="RAM" value={memPercent != null ? `${memPercent}%` : "—"} />
        <Row
          label="Temperature"
          value={
            info?.temperatureC != null && Number.isFinite(info.temperatureC)
              ? `${info.temperatureC}°C`
              : "—"
          }
        />
        <Row label="WAN" value={info?.wanIp ?? "—"} />
      </Stack>
      </Box>
    </Box>
  );
}
