import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { type Capability, type DeviceConnection, type DeviceRecord } from "../../../api";
import { deviceConnectivityState } from "../../../lib/device-utils";
import { BoardSoftware } from "./BoardSoftware";
import { InfoCard, durationWords, shortWhen, wifiSignalWords } from "./DeviceBits";
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
 * switches with their values — and, only when something needs doing, what to do.
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
              {wifiSignalWords(connection)}
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
              Its readings and switches come straight from the device over your home network.
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

      <WhatToDo device={device} isBoard={isBoard} isAdmin={isAdmin} busy={busy} values={values} onUsb={onUsb} />
    </Stack>
  );
}

/**
 * Only when something needs doing: what is wrong in plain words and what to do. (What happened is on
 * the Troubleshooting tab; it is not repeated here.)
 */
function WhatToDo({ device, isBoard, isAdmin, busy, values, onUsb }: { device: DeviceRecord; isBoard: boolean; isAdmin: boolean; busy: boolean; values: Map<string, Capability>; onUsb: () => void }) {
  const offline = device.isEnabled && deviceConnectivityState(device) === "offline";
  const notAnswering = device.sensors.filter((s) => s.isEnabled && s.capabilityId && values.get(s.capabilityId)?.state?.quality === "error");
  if (!offline && notAnswering.length === 0) return null;
  return (
    <InfoCard title="What to do">
      {offline ? (
        <Stack spacing={1}>
          <Typography variant="body2">
            {isBoard ? "This board is not answering." : "This device is not answering."} Check that it has power and that your Wi-Fi is working; it comes back by itself once it can reach Nexternel.
          </Typography>
          {isBoard ? (
            <Typography variant="body2" color="text.secondary">
              Moved Nexternel to a new computer? A board set up for the old one cannot find this one. Plug the board into this computer with a USB cable and press Install with USB: Nexternel puts this server's address and your Wi-Fi on it, once.
            </Typography>
          ) : null}
          {isBoard && isAdmin ? (
            <Box>
              <Button {...devicesOutlinedButton} disabled={busy} onClick={onUsb}>
                Install with USB
              </Button>
            </Box>
          ) : null}
        </Stack>
      ) : null}
      {notAnswering.length ? (
        <Typography variant="body2" sx={{ mt: offline ? 1.5 : 0 }}>
          {notAnswering.length === 1 ? `${notAnswering[0].customName ?? notAnswering[0].name} says "Sensor not answering"` : `${notAnswering.length} readings say "Sensor not answering"`}: the board is working, but it cannot read the sensor. Check the sensor's wires and plug.
        </Typography>
      ) : null}
    </InfoCard>
  );
}
