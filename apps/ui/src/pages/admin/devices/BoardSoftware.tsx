import { useEffect, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import UsbRoundedIcon from "@mui/icons-material/UsbRounded";
import { api, UNSTEADY_DROPS, type DeviceRecord } from "../../../api";
import { refreshBoards, updateBoards, useBoardUpdates } from "../../../lib/board-updates";
import { ButtonRow } from "../../../components/ButtonRow";
import { StepIcon } from "./BoardUpdatesCard";
import { BoardUpdateDetailsButton } from "./BoardUpdateDetails";
import { devicesContainedButton, devicesOutlinedButton } from "./devices-panel-styles";
import { InfoCard } from "./DeviceBits";

/** The board's kept updates (newest first, `max` shown), each with its details. */
export function LastBoardUpdates({ deviceId, name, refreshKey, max = 3 }: { deviceId: string; name: string; refreshKey: string; max?: number }) {
  const [updates, setUpdates] = useState<{ id: string; finishedAt: string; outcome: string; message: string }[]>([]);
  useEffect(() => {
    api
      .boardUpdateHistory(deviceId)
      .then((r) => setUpdates(r.updates.slice(0, max)))
      .catch(() => setUpdates([]));
  }, [deviceId, refreshKey]);
  if (!updates.length) return null;
  return (
    <Stack spacing={1} sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        Last updates from Nexternel
      </Typography>
      {updates.map((u) => (
        <Stack key={u.id} direction="row" spacing={1} alignItems="center">
          <StepIcon step={u.outcome === "failed" ? "failed" : "done"} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" color={u.outcome === "failed" ? "error" : "text.secondary"} noWrap title={u.message}>
              {new Date(u.finishedAt).toLocaleString()} — {u.message}
            </Typography>
          </Box>
          <BoardUpdateDetailsButton logId={u.id} name={name} />
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * Overview → Board software (ESPHome boards): is the board up to date, and the two everyday actions —
 * Update board (over Wi-Fi, Nexternel does every step) and Install with USB (new boards).
 */
export function BoardSoftware({ device, canEdit, busy, onUsb, showHistory = true }: { device: DeviceRecord; canEdit: boolean; busy: boolean; onUsb: () => void; showHistory?: boolean }) {
  const { boards, run } = useBoardUpdates();
  const [error, setError] = useState<string | null>(null);
  const board = boards?.find((b) => b.deviceId === device.id);
  const item = run?.items.find((i) => i.deviceId === device.id);
  const showItem = item && (run?.running || (item.finishedAt && Date.now() - Date.parse(item.finishedAt) < 30 * 60_000));
  const [choice, setChoice] = useState("");
  const status = !boards
    ? "Checking…"
    : !board?.file
      ? board?.linkProblem === "several"
        ? "Several ESPHome settings files use this board's message address. Choose which one is this board's:"
        : `No ESPHome settings file uses this board's message address (${device.mqttTopicPrefix}), so it cannot be updated from here.`
      : !board.known
        ? `ESPHome does not list ${board.file}.`
      : board.updateState === "update"
        ? "An update is ready: the board runs older software than the newest build of its settings."
        : board.updateState === "unknown"
          ? "Not known yet: this board does not report which software it runs. One update from Nexternel starts it."
          : `Up to date — it runs the newest build${board.deployedVersion ? ` (ESPHome ${board.deployedVersion})` : ""}.`;

  return (
    // A full row of its own (long messages wrap or shorten instead of widening the page).
    <InfoCard title="Software">
      {showItem ? (
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box sx={{ pt: 0.25 }}>
            <StepIcon step={item.step} />
          </Box>
          <Typography variant="body2" color={item.step === "failed" ? "error" : "text.secondary"}>
            {item.message}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" color={board?.needsUpdate ? "warning.main" : "text.secondary"} sx={{ mb: 1.5 }}>
          {status}
        </Typography>
      )}
      {board && board.recentDrops >= UNSTEADY_DROPS ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          This board dropped off Wi‑Fi {board.recentDrops} times in the last 15 minutes. Updating over Wi‑Fi may fail; a USB cable is safer.
        </Alert>
      ) : null}
      {showHistory ? <LastBoardUpdates deviceId={device.id} name={device.name} refreshKey={item?.logId ?? ""} /> : null}
      {canEdit && board?.linkProblem === "several" ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <TextField select size="small" label="Settings file" value={choice} onChange={(e) => setChoice(e.target.value)} sx={{ minWidth: 240 }}>
            {board.choices.map((f) => (
              <MenuItem key={f} value={f}>
                {f}
              </MenuItem>
            ))}
          </TextField>
          <Button
            {...devicesContainedButton}
            disabled={!choice}
            onClick={() => {
              setError(null);
              api
                .linkBoardFile(device.id, choice)
                .then(() => refreshBoards())
                .catch((err) => setError(err instanceof Error ? err.message : "Could not link"));
            }}
          >
            Link
          </Button>
        </Stack>
      ) : null}
      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
      {canEdit ? (
        <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
          <Button
            {...(board?.needsUpdate ? devicesContainedButton : devicesOutlinedButton)}
            startIcon={<SystemUpdateAltRoundedIcon />}
            disabled={busy || !board?.known || Boolean(run?.running)}
            onClick={() => {
              setError(null);
              updateBoards([device.id]).catch((err) => setError(err instanceof Error ? err.message : "Could not start the update"));
            }}
          >
            Update board
          </Button>
          <Button {...devicesOutlinedButton} startIcon={<UsbRoundedIcon />} disabled={busy} onClick={onUsb}>
            Install with USB
          </Button>
        </ButtonRow>
      ) : null}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        Update board sends the latest software to the board over Wi‑Fi; it restarts once. A new board, or one not on your
        Wi‑Fi, is installed with a USB cable. More tools for experienced users are under Advanced.
      </Typography>
    </InfoCard>
  );
}
