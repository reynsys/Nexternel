import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import type { BoardUpdateStep } from "../../../api";
import { updateBoards, useBoardUpdates } from "../../../lib/board-updates";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { ICON_SIZE } from "../../../lib/appearance/type";

export function StepIcon({ step }: { step: BoardUpdateStep }) {
  if (step === "done") return <CheckCircleRoundedIcon color="success" sx={{ fontSize: ICON_SIZE.title }} />;
  if (step === "failed") return <ErrorRoundedIcon color="error" sx={{ fontSize: ICON_SIZE.title }} />;
  if (step === "waiting") return <ScheduleRoundedIcon color="disabled" sx={{ fontSize: ICON_SIZE.title }} />;
  return <CircularProgress size={ICON_SIZE.title} />;
}

/**
 * Devices page: the ESPHome boards that need an update (their settings changed since they were last
 * installed, or a newer ESPHome), with one button to update them all over Wi-Fi, one after another.
 * Shows each board's step while that runs. Hidden when every board is up to date and nothing ran.
 */
export function BoardUpdatesCard({ canEdit }: { canEdit: boolean }) {
  const surfaceSx = useContentSurfaceSx();
  const { boards, run } = useBoardUpdates();
  const [error, setError] = useState<string | null>(null);
  if (!boards) return null;
  const behind = boards.filter((b) => b.needsUpdate);
  const showRun = run && run.items.length > 0 && (run.running || run.items.some((i) => i.finishedAt && Date.now() - Date.parse(i.finishedAt) < 30 * 60_000));
  if (!behind.length && !showRun) return null;

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
                  : "Board updates finished"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {run?.running
                ? "One after another, over Wi‑Fi. Each board restarts once; you can keep using Nexternel."
                : behind.length
                  ? `Their settings changed since they were last installed: ${behind.map((b) => b.name).join(", ")}.`
                  : "Every board is up to date."}
            </Typography>
          </Box>
          {canEdit && behind.length && !run?.running ? (
            <Button
              variant="contained"
              onClick={() => {
                setError(null);
                updateBoards(behind.map((b) => b.deviceId)).catch((err) => setError(err instanceof Error ? err.message : "Could not start"));
              }}
            >
              Update all boards
            </Button>
          ) : null}
        </Stack>
        {error ? <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert> : null}
        {showRun ? (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {run!.items.map((i) => (
              <Stack key={i.deviceId} direction="row" spacing={1.25} alignItems="flex-start">
                <Box sx={{ pt: 0.25 }}>
                  <StepIcon step={i.step} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {i.name}
                  </Typography>
                  <Typography variant="body2" color={i.step === "failed" ? "error" : "text.secondary"}>
                    {i.message}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}
