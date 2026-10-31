import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { ButtonRow } from "../../../components/ButtonRow";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import { UNSTEADY_DROPS, type BoardUpdateStep } from "../../../api";
import { updateBoards, useBoardUpdates } from "../../../lib/board-updates";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { ICON_SIZE } from "../../../lib/appearance/type";
import { BoardUpdateDetailsButton } from "./BoardUpdateDetails";

export function StepIcon({ step }: { step: BoardUpdateStep }) {
  if (step === "done") return <CheckCircleRoundedIcon color="success" sx={{ fontSize: ICON_SIZE.title }} />;
  if (step === "failed") return <ErrorRoundedIcon color="error" sx={{ fontSize: ICON_SIZE.title }} />;
  if (step === "waiting") return <ScheduleRoundedIcon color="disabled" sx={{ fontSize: ICON_SIZE.title }} />;
  return <CircularProgress size={ICON_SIZE.title} />;
}

/**
 * Devices page: the ESPHome boards that need an update (the software they report differs from the
 * newest build of their settings, or a newer ESPHome), with one button to update them all over Wi-Fi,
 * one after another; and the boards that do not report which software they run yet ("not known"),
 * which one update starts. Shows each board's step while that runs. Hidden when every board is known
 * to be up to date and nothing ran.
 */
export function BoardUpdatesCard({ canEdit }: { canEdit: boolean }) {
  const surfaceSx = useContentSurfaceSx();
  const { boards, run } = useBoardUpdates();
  const [error, setError] = useState<string | null>(null);
  if (!boards) return null;
  const behind = boards.filter((b) => b.updateState === "update");
  const unknown = boards.filter((b) => b.known && b.updateState === "unknown");
  const unsteady = [...behind, ...unknown].filter((b) => b.recentDrops >= UNSTEADY_DROPS);
  const showRun = run && run.items.length > 0 && (run.running || run.items.some((i) => i.finishedAt && Date.now() - Date.parse(i.finishedAt) < 30 * 60_000));
  if (!behind.length && !unknown.length && !showRun) return null;
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
                  : unknown.length
                    ? "Board software not known yet"
                    : "Board updates finished"}
            </Typography>
            {run?.running ? (
              <Typography variant="body2" color="text.secondary">
                One after another, over Wi‑Fi. Each board restarts once; you can keep using Nexternel.
              </Typography>
            ) : (
              <>
                {behind.length ? (
                  <Typography variant="body2" color="text.secondary">
                    They run older software than the newest build of their settings: {behind.map((b) => b.name).join(", ")}.
                  </Typography>
                ) : null}
                {unknown.length ? (
                  <Typography variant="body2" color="text.secondary">
                    Not known yet: {unknown.map((b) => b.name).join(", ")}. {unknown.length === 1 ? "It does" : "They do"} not report which
                    software {unknown.length === 1 ? "it runs" : "they run"} yet; one update from Nexternel starts it.
                  </Typography>
                ) : null}
                {!behind.length && !unknown.length ? (
                  <Typography variant="body2" color="text.secondary">
                    Every board is up to date.
                  </Typography>
                ) : null}
              </>
            )}
          </Box>
          {canEdit && !run?.running && (behind.length || unknown.length) ? (
            <ButtonRow>
              {behind.length ? (
                <Button variant="contained" onClick={() => start(behind.map((b) => b.deviceId))}>
                  Update all boards
                </Button>
              ) : null}
              {unknown.length ? (
                <Button variant={behind.length ? "outlined" : "contained"} onClick={() => start(unknown.map((b) => b.deviceId))}>
                  Update {unknown.length === 1 ? "it" : "them"} once
                </Button>
              ) : null}
            </ButtonRow>
          ) : null}
        </Stack>
        {error ? <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert> : null}
        {unsteady.length && !run?.running ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {unsteady.map((b) => `${b.name} dropped off Wi‑Fi ${b.recentDrops} times in the last 15 minutes`).join("; ")}. Updating over Wi‑Fi
            may fail; a USB cable is safer (Devices → the board → Install with a USB cable).
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
