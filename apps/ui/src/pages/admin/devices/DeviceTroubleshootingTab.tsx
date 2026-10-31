import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import type { BoardStatus, DeviceConnection, DeviceRecord } from "../../../api";
import { CODE_TEXT } from "../../../lib/appearance/type";
import { InfoCard, durationWords, shortWhen } from "./DeviceBits";
import { LastBoardUpdates } from "./BoardSoftware";
import { ActivityList } from "../../../components/ActivityList";
import { devicesOutlinedButton } from "./devices-panel-styles";

const DAY_MS = 24 * 60 * 60_000;

/** The last 24 hours as stretches of online (and offline), for the connection bar. */
export function connectionStretches(c: DeviceConnection, now = Date.now()): { online: boolean; share: number }[] {
  const start = now - DAY_MS;
  const off = c.outages
    .map((o) => ({ from: Math.max(start, Date.parse(o.from)), to: o.to ? Date.parse(o.to) : now }))
    .filter((o) => o.to > start)
    .sort((a, b) => a.from - b.from);
  const out: { online: boolean; share: number }[] = [];
  let at = start;
  for (const o of off) {
    if (o.from > at) out.push({ online: true, share: (o.from - at) / DAY_MS });
    // A drop-out is drawn at least a little wide, so even a few seconds can be seen.
    out.push({ online: false, share: Math.max((o.to - o.from) / DAY_MS, 0.004) });
    at = Math.max(at, o.to);
  }
  if (at < now) out.push({ online: c.state !== "offline", share: (now - at) / DAY_MS });
  return out;
}

function technical(device: DeviceRecord, board: BoardStatus | null): { label: string; value: string }[] {
  return [
    { label: "Message address (MQTT)", value: device.mqttTopicPrefix },
    { label: "Network address", value: device.ipAddress ?? "Not known" },
    ...(board?.file ? [{ label: "ESPHome settings file", value: board.file }] : []),
    ...(board
      ? [{ label: "Software", value: [board.deployedVersion ? `ESPHome ${board.deployedVersion}` : null, board.fingerprint ? `fingerprint ${board.fingerprint}` : null].filter(Boolean).join(" · ") || "Not known" }]
      : []),
  ];
}

/**
 * Troubleshooting: everything needed when a device misbehaves — when it was online and offline in
 * the last 24 hours (and its Wi‑Fi), every update with its details, its technical details, and a
 * report to copy for support.
 */
export function DeviceTroubleshootingTab({ device, connection, board }: { device: DeviceRecord; connection: DeviceConnection | null; board: BoardStatus | null }) {
  const [copied, setCopied] = useState(false);
  const isBoard = (device.firmwareType || "esphome") === "esphome";
  const details = technical(device, board);

  function report(): string {
    const lines = [
      `${device.name} (${device.roomName ?? "no area"})`,
      connection
        ? `Connection: ${connection.state}${connection.since ? ` since ${connection.since}` : ""}; ${connection.outages.length} drop-outs in 24 h (longest ${connection.longestMinutes} min); Wi-Fi ${connection.wifiDbm ?? "?"} dBm; ${connection.restarts} restarts`
        : "Connection: not known",
      ...connection?.outages.map((o) => `  offline ${o.from} – ${o.to ?? "now"} (${o.minutes} min)`) ?? [],
      ...details.map((d) => `${d.label}: ${d.value}`),
      board ? `Update state: ${board.updateState}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          {...devicesOutlinedButton}
          startIcon={<ContentCopyRoundedIcon />}
          onClick={() => void navigator.clipboard?.writeText(report()).then(() => setCopied(true)).catch(() => undefined)}
        >
          {copied ? "Copied" : "Copy report"}
        </Button>
      </Box>

      <InfoCard
        title="Connection — last 24 hours"
        action={
          connection ? (
            <Typography variant="body2" color={connection.outages.length >= 3 ? "warning.main" : "text.secondary"}>
              {connection.outages.length ? `${connection.outages.length} drop-outs · longest ${durationWords(connection.longestMinutes)}` : "No drop-outs"}
            </Typography>
          ) : null
        }
      >
        {connection ? (
          <>
            <Box role="img" aria-label="Online and offline in the last 24 hours" sx={{ display: "flex", height: 16, borderRadius: 1, overflow: "hidden" }}>
              {connectionStretches(connection).map((s, n) => (
                <Box key={n} sx={{ flexGrow: s.share, flexBasis: 0, bgcolor: s.online ? "success.main" : "error.main" }} />
              ))}
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="caption" color="text.secondary">
                24 hours ago
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Now
              </Typography>
            </Box>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
              {connection.wifiDbm != null ? (
                <Typography variant="body2" color={connection.wifiQuality === "weak" || connection.wifiQuality === "very weak" ? "warning.main" : "text.secondary"}>
                  Wi‑Fi signal: {connection.wifiQuality} ({connection.wifiDbm} dBm)
                </Typography>
              ) : null}
              {connection.restartedAt ? (
                <Typography variant="body2" color="text.secondary">
                  Last restart: {shortWhen(connection.restartedAt)}
                </Typography>
              ) : null}
            </Stack>
            {connection.outages.slice(0, 8).map((o) => (
              <Typography key={o.from} variant="caption" color="text.secondary">
                {shortWhen(o.from)} – {o.to ? new Date(o.to).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "now"} · offline {durationWords(o.minutes)}
              </Typography>
            ))}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        )}
      </InfoCard>

      {isBoard ? (
        <InfoCard title="Updates from Nexternel">
          <LastBoardUpdates deviceId={device.id} name={device.name} refreshKey="" max={10} />
          <Typography variant="caption" color="text.secondary">
            The last 10 updates are kept, each with everything ESPHome wrote (Show details).
          </Typography>
        </InfoCard>
      ) : null}

      <InfoCard title="Activity">
        <ActivityList deviceId={device.id} showFilters={false} pageSize={20} />
      </InfoCard>

      <InfoCard title="Technical details">
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
          {details.map((d) => (
            <Box key={d.label}>
              <Typography variant="caption" color="text.secondary" display="block">
                {d.label}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: CODE_TEXT.fontFamily, wordBreak: "break-all" }}>
                {d.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </InfoCard>
    </Stack>
  );
}
