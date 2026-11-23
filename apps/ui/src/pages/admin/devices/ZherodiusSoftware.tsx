import { useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import { api, type DeviceRecord } from "../../../api";
import { refreshBoards, updateBoards, useBoardUpdates } from "../../../lib/board-updates";
import { ButtonRow } from "../../../components/ButtonRow";
import { StepIcon } from "./BoardUpdatesCard";
import { LastBoardUpdates } from "./BoardSoftware";
import { Fact, InfoCard } from "./DeviceBits";
import { devicesContainedButton, devicesOutlinedButton } from "./devices-panel-styles";

/**
 * Overview → Software (Zherodius devices): the version it runs, whether a newer one is ready and what is
 * new in it, and the two actions — Update board (the device downloads and installs it; Nexternel shows
 * each step, the same as Update boards on the Devices page) and Check for update (the device also looks
 * once a day by itself). Nothing is installed without a press.
 */
export function ZherodiusSoftware({
  device,
  zherodius,
  canEdit,
}: {
  device: DeviceRecord;
  zherodius: NonNullable<DeviceRecord["zherodius"]>;
  canEdit: boolean;
}) {
  const { boards, run } = useBoardUpdates();
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const board = boards?.find((b) => b.deviceId === device.id);
  const item = run?.items.find((i) => i.deviceId === device.id);
  const showItem = item && (run?.running || (item.finishedAt && Date.now() - Date.parse(item.finishedAt) < 30 * 60_000));
  const version = board?.deployedVersion ?? zherodius.version;
  const ownPage = board?.updateState === "own-page";
  const ready = board?.updateState === "update";
  const connected = board?.reachable ?? false;

  const status = !board
    ? "Checking…"
    : ownPage
      ? "This version can't be updated from Nexternel yet. Update it once on the device's own page (Firmware); after that Nexternel can update it."
      : ready
        ? `An update is ready. ${board.updateReason}.`
        : "Up to date — no newer version found.";

  const check = () => {
    setNote(null);
    setChecking(true);
    api
      .zherodiusCheckUpdate(device.id)
      .then(async (r) => {
        await refreshBoards();
        setNote({ tone: "info", text: r.latest ? `Zherodius ${r.latest} is ready.` : `No newer version: Zherodius ${r.version} is the newest.` });
      })
      .catch((err) => setNote({ tone: "error", text: err instanceof Error ? err.message : "Could not check for an update" }))
      .finally(() => setChecking(false));
  };

  return (
    <InfoCard title="Software">
      <Typography variant="h6">Zherodius {version ?? ""}</Typography>
      {showItem ? (
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ pt: 0.25 }}>
            <StepIcon step={item.step} />
          </Box>
          <Typography variant="body2" color={item.step === "failed" ? "error" : "text.secondary"}>
            {item.message}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" color={ready ? "warning.main" : "text.secondary"}>
          {checking ? "Looking for a newer version…" : status}
        </Typography>
      )}
      {note && !checking && !showItem ? (
        <Alert severity={note.tone} sx={{ mt: 1 }}>
          {note.text}
        </Alert>
      ) : null}
      <Box sx={{ mt: 1 }}>
        <Fact label="Serial number" value={zherodius.serial} />
        <Fact label="IP address" value={zherodius.address} />
      </Box>
      <Box sx={{ mt: 1.5 }}>
        <LastBoardUpdates deviceId={device.id} name={device.name} refreshKey={item?.logId ?? ""} max={1} />
      </Box>
      <Box sx={{ mt: "auto", pt: 1 }}>
        <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
          {canEdit && ready ? (
            <Button
              {...devicesContainedButton}
              startIcon={<SystemUpdateAltRoundedIcon />}
              disabled={!connected || Boolean(run?.running)}
              onClick={() => {
                setNote(null);
                updateBoards([device.id]).catch((err) => setNote({ tone: "error", text: err instanceof Error ? err.message : "Could not start the update" }));
              }}
            >
              Update board
            </Button>
          ) : null}
          {canEdit && board && !ownPage ? (
            <Button {...devicesOutlinedButton} disabled={!connected || checking || Boolean(run?.running)} onClick={check}>
              Check for update
            </Button>
          ) : null}
          <Button {...devicesOutlinedButton} href={`http://${zherodius.address}/`} target="_blank" rel="noreferrer" endIcon={<OpenInNewRoundedIcon />}>
            Open device page
          </Button>
        </ButtonRow>
        {canEdit && board && !ownPage && !connected ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            The device is not connected to Nexternel right now, so it can't be updated from here. It can as soon as it is back.
          </Typography>
        ) : null}
      </Box>
    </InfoCard>
  );
}
