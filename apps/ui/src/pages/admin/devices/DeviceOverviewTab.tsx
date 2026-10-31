import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { api, type Capability, type DeviceConnection, type DeviceRecord } from "../../../api";
import { deviceConnectivityState } from "../../../lib/device-utils";
import { BoardSoftware } from "./BoardSoftware";
import { InfoCard, durationWords, shortWhen } from "./DeviceBits";
import { readingValue, switchWord } from "./device-summary";
import { devicesOutlinedButton } from "./devices-panel-styles";

type Props = {
  device: DeviceRecord;
  isAdmin: boolean;
  busy: boolean;
  connection: DeviceConnection | null;
  values: Map<string, Capability>;
  onUsb: () => void;
  onShowReadings: () => void;
};

/**
 * A device's Overview: three equal boxes — Connection, Software (boards) and its readings or
 * switches with their values — and, under them, what happened recently (updates, drop-outs).
 */
export function DeviceOverviewTab({ device, isAdmin, busy, connection, values, onUsb, onShowReadings }: Props) {
  const isBoard = (device.firmwareType || "esphome") === "esphome";
  const connectivity = deviceConnectivityState(device);
  const items = [
    ...device.relays.filter((r) => r.isEnabled).map((r) => ({ id: r.id, name: r.customName ?? r.name, value: switchWord(r.lastState) })),
    ...device.sensors
      .filter((s) => s.isEnabled)
      .map((s) => ({ id: s.id, name: s.customName ?? s.name, value: readingValue((s.capabilityId && values.get(s.capabilityId)) || { state: null, unit: s.unit }) })),
  ];
  const shown = items.slice(0, 5);

  return (
    <Stack spacing={2}>
      {device.esphomeLifecycleState === "configuration_missing" ? (
        <Alert severity="warning">
          The board's ESPHome settings file is missing on the server.{" "}
          {device.esphomeManagementMode === "managed"
            ? "Recreate it under Advanced → Recreate settings file."
            : "Put the file back on the server, or delete this device."}
        </Alert>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2, alignItems: "stretch" }}>
        <InfoCard title="Connection">
          <Typography variant="h6" color={!device.isEnabled ? "text.disabled" : connectivity === "online" ? "success.main" : connectivity === "offline" ? "error.main" : "warning.main"}>
            {!device.isEnabled ? "Switched off" : connectivity === "online" ? "Online" : connectivity === "offline" ? "Offline" : "No recent data"}
          </Typography>
          {connection?.since ? (
            <Typography variant="body2" color="text.secondary">
              Since {shortWhen(connection.since).replace(/^Today /, "")}
            </Typography>
          ) : null}
          {connection?.wifiDbm != null ? (
            <Typography variant="body2" color={connection.wifiQuality === "weak" || connection.wifiQuality === "very weak" ? "warning.main" : "text.secondary"}>
              Wi‑Fi signal: {connection.wifiQuality} ({connection.wifiDbm} dBm)
            </Typography>
          ) : null}
          {connection ? (
            <Typography variant="body2" color={connection.outages.length >= 3 ? "warning.main" : "text.secondary"}>
              {connection.outages.length
                ? `${connection.outages.length === 1 ? "1 drop-out" : `${connection.outages.length} drop-outs`} in the last 24 hours (longest ${durationWords(connection.longestMinutes)})`
                : "No drop-outs in the last 24 hours"}
            </Typography>
          ) : null}
          {connection?.restartedAt ? (
            <Typography variant="body2" color="text.secondary">
              Last restart: {shortWhen(connection.restartedAt)}
              {connection.health?.resetReason ? ` (${connection.health.resetReason})` : ""}
            </Typography>
          ) : null}
        </InfoCard>

        {isBoard ? (
          <BoardSoftware device={device} canEdit={isAdmin} busy={busy} onUsb={onUsb} showHistory={false} />
        ) : (
          <InfoCard title="Device">
            <Typography variant="h6">{device.firmwareType === "shelly" ? "Shelly switch" : "Device"}</Typography>
            <Typography variant="body2" color="text.secondary">
              Its readings and switches come straight from the device over MQTT.
            </Typography>
          </InfoCard>
        )}

        <InfoCard title={device.relays.length && !device.sensors.length ? "Switches" : device.sensors.length && !device.relays.length ? "Readings" : "Readings & switches"}>
          {shown.length ? (
            shown.map((i) => (
              <Box key={i.id} sx={{ display: "flex", gap: 1, justifyContent: "space-between" }}>
                <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                  {i.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {i.value}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No readings or switches yet.
            </Typography>
          )}
          <Box sx={{ mt: "auto", pt: 1 }}>
            <Button {...devicesOutlinedButton} onClick={onShowReadings}>
              {items.length > shown.length ? `Show all ${items.length}` : "Show details"}
            </Button>
          </Box>
        </InfoCard>
      </Box>

      <RecentActivity device={device} connection={connection} isBoard={isBoard} />
    </Stack>
  );
}

/** Updates from Nexternel and drop-outs, newest first. */
function RecentActivity({ device, connection, isBoard }: { device: DeviceRecord; connection: DeviceConnection | null; isBoard: boolean }) {
  const [updates, setUpdates] = useState<{ id: string; finishedAt: string; outcome: string; message: string }[]>([]);
  useEffect(() => {
    if (!isBoard) return;
    void api
      .boardUpdateHistory(device.id)
      .then((r) => setUpdates(r.updates))
      .catch(() => setUpdates([]));
  }, [device.id, isBoard]);
  const events = [
    ...updates.map((u) => ({ at: u.finishedAt, text: u.message, bad: u.outcome === "failed" })),
    ...(connection?.outages ?? []).map((o) => ({
      at: o.from,
      text: o.to ? `Offline for ${durationWords(o.minutes)}` : "Went offline",
      bad: true,
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 6);
  return (
    <InfoCard title="Recent activity">
      {events.length ? (
        events.map((e) => (
          <Box key={`${e.at}-${e.text}`} sx={{ display: "flex", gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 150, flexShrink: 0 }}>
              {shortWhen(e.at)}
            </Typography>
            <Typography variant="body2" color={e.bad ? "warning.main" : "text.primary"}>
              {e.text}
            </Typography>
          </Box>
        ))
      ) : (
        <Typography variant="body2" color="text.secondary">
          Nothing in the last 24 hours.
        </Typography>
      )}
    </InfoCard>
  );
}
