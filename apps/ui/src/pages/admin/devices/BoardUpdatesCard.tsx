import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import { UNSTEADY_DROPS, type BoardUpdateStep } from "../../../api";
import { updateBoards, useBoardUpdates } from "../../../lib/board-updates";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { ICON_SIZE } from "../../../lib/appearance/type";
import { BoardUpdateDetailsButton } from "./BoardUpdateDetails";

/** "Kids Room", "Kids Room and Garden", "Kids Room, Garden and Hallway". */
function names(list: { name: string }[]): string {
  const n = list.map((b) => b.name);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : (n[0] ?? "");
}

export function StepIcon({ step }: { step: BoardUpdateStep }) {
  if (step === "done") return <CheckCircleRoundedIcon color="success" sx={{ fontSize: ICON_SIZE.title }} />;
  if (step === "failed") return <ErrorRoundedIcon color="error" sx={{ fontSize: ICON_SIZE.title }} />;
  if (step === "waiting") return <ScheduleRoundedIcon color="disabled" sx={{ fontSize: ICON_SIZE.title }} />;
  return <CircularProgress size={ICON_SIZE.title} />;
}

/**
 * Devices page: the boards that need an update (ESPHome: the software they report differs from the
 * newest build of their settings; Zherodius: the device found a newer version), with one button to
 * update them all over Wi-Fi, one after another; the ESPHome boards that do not report which software
 * they run yet ("not known"), which one update starts; and the Zherodius devices too old to be updated
 * from here (updated once on their own page). Shows each board's step while that runs. Hidden when
 * every board is known to be up to date and nothing ran.
 */
export function BoardUpdatesCard({ canEdit }: { canEdit: boolean }) {
  const surfaceSx = useContentSurfaceSx();
  const { boards, run, preparing } = useBoardUpdates();
  const [error, setError] = useState<string | null>(null);
  if (!boards) return null;
  const behind = boards.filter((b) => b.updateState === "update");
  // Not known: only boards that answer can be updated; one that does not answer is checked when it answers again.
  const unknownAll = boards.filter((b) => b.known && b.updateState === "unknown");
  const unknown = unknownAll.filter((b) => b.reachable);
  const silent = unknownAll.filter((b) => !b.reachable);
  const ownPage = boards.filter((b) => b.updateState === "own-page");
  // Only ESPHome boards can be installed with USB from Nexternel.
  const unsteady = [...behind, ...unknown].filter((b) => b.kind === "esphome" && b.recentDrops >= UNSTEADY_DROPS);
  const showRun = run && run.items.length > 0 && (run.running || run.items.some((i) => i.finishedAt && Date.now() - Date.parse(i.finishedAt) < 30 * 60_000));
  if (preparing?.running) {
    // The shared board settings changed (a Nexternel update): ESPHome builds every board once first.
    return (
      <Card sx={surfaceSx}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <CircularProgress size={ICON_SIZE.title + 4} />
            <Box>
              <Typography variant="subtitle1">Preparing new board firmware</Typography>
              <Typography variant="body2" color="text.secondary">
                {preparing.done} of {preparing.total} boards{preparing.current ? ` · now ${preparing.current}` : ""}. Nothing is sent yet.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }
  if (!behind.length && !unknown.length && !silent.length && !ownPage.length && !showRun) return null;
  const start = (ids: string[]) => {
    setError(null);
    updateBoards(ids).catch((err) => setError(err instanceof Error ? err.message : "Could not start"));
  };

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
          <SystemUpdateAltRoundedIcon color="primary" />
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="subtitle1">
              {run?.running
                ? "Updating boards…"
                : behind.length
                  ? `${behind.length} board${behind.length === 1 ? " needs" : "s need"} an update`
                  : unknown.length || silent.length || ownPage.length
                    ? "Board firmware to check"
                    : "Board updates finished"}
            </Typography>
            {run?.running ? (
              <Typography variant="body2" color="text.secondary">
                {run.startedBy && run.startedAt
                  ? `Started by ${run.startedBy} at ${new Date(run.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`
                  : "Updating…"}
              </Typography>
            ) : (
              <>
                {behind.map((b) => (
                  <Typography key={b.deviceId} variant="body2" color="text.secondary">
                    <b>{b.name}</b>: {b.updateReason ?? "it runs older firmware than the newest build of its settings"}.
                  </Typography>
                ))}
                {unknown.length ? (
                  <Typography variant="body2" color="text.secondary">
                    Firmware version not known: {names(unknown)}. Update boards once.
                  </Typography>
                ) : null}
                {silent.length ? (
                  <Typography variant="body2" color="text.secondary">
                    Not answering: {names(silent)}.
                  </Typography>
                ) : null}
                {ownPage.length ? (
                  <Typography variant="body2" color="text.secondary">
                    Update once on the device's page (Firmware): {names(ownPage)}.
                  </Typography>
                ) : null}
                {!behind.length && !unknown.length && !silent.length && !ownPage.length ? (
                  <Typography variant="body2" color="text.secondary">
                    Every board is up to date.
                  </Typography>
                ) : null}
              </>
            )}
          </Box>
          {canEdit && !run?.running && (behind.length || unknown.length) ? (
            <Button variant="contained" onClick={() => start([...behind, ...unknown].map((b) => b.deviceId))}>
              Update boards
            </Button>
          ) : null}
        </Stack>
        {error ? <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert> : null}
        {unsteady.length && !run?.running ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {unsteady.map((b) => `${b.name} dropped off Wi‑Fi ${b.recentDrops} times in the last 15 minutes`).join("; ")}. Updating over Wi‑Fi
            may fail; a USB cable is safer (Devices → the board → Install with USB).
          </Alert>
        ) : null}
        {showRun ? (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {run!.items.map((i) => (
              <Stack key={i.deviceId} direction="row" spacing={1.25} alignItems="flex-start">
                <Box sx={{ pt: 0.25 }}>
                  <StepIcon step={i.step} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {i.name}
                  </Typography>
                  <Typography variant="body2" color={i.step === "failed" ? "error" : "text.secondary"}>
                    {i.message}
                  </Typography>
                </Box>
                {i.logId ? <BoardUpdateDetailsButton logId={i.logId} name={i.name} /> : null}
              </Stack>
            ))}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}
