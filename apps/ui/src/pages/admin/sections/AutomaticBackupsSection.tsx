import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Paper,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { api, type BackupSchedule, type StoredBackup } from "../../../api";
import { useConfirm } from "../../../components/confirm";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { ButtonRow } from "../../../components/ButtonRow";

function saveBlob({ blob, filename }: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const formatSize = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;
const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const KEEP = [3, 5, 7, 14, 30];

/** Daily backups on the server, the backups kept there, and the key needed to open them. */
export function AutomaticBackupsSection() {
  const surfaceSx = useContentSurfaceSx();
  const { confirm } = useConfirm();
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [files, setFiles] = useState<StoredBackup[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.backupSchedule();
    setSchedule(res.schedule);
    setFiles(res.files);
  }, []);

  useEffect(() => {
    void load().catch((err) =>
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Could not load backups" })
    );
  }, [load]);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  }

  async function save(patch: Partial<BackupSchedule>) {
    await run("save", async () => {
      const res = await api.saveBackupSchedule(patch);
      setSchedule(res.schedule);
      setFiles(res.files);
    });
  }

  async function restore(file: StoredBackup) {
    const ok = await confirm({
      title: "Restore this backup?",
      message: `Everything in Nexternel will be replaced by the backup from ${formatWhen(file.createdAt)}. Your own sign-in is kept. This takes about a minute.`,
      confirmLabel: "Restore",
    });
    if (!ok) return;
    await run(`restore:${file.name}`, async () => {
      const { job } = await api.restoreStoredBackup(file.name);
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        let current;
        try {
          current = (await api.getBackupJob(job.id)).job;
        } catch {
          setRestoreProgress("Reconnecting…");
          continue;
        }
        setRestoreProgress(`${current.percent ?? 0}% — ${current.message ?? ""}`);
        if (current.status === "completed" || current.status === "failed") {
          setRestoreProgress(null);
          const result = current.restoreResult;
          setNotice(
            current.status === "completed"
              ? { ok: true, text: "Restore complete. Reload the page to see the restored home." }
              : { ok: false, text: result?.errors?.join(" ") || current.message || "Restore failed." }
          );
          break;
        }
      }
    });
  }

  if (!schedule) {
    return (
      <Card sx={surfaceSx}>
        <CardContent>
          {notice ? <Alert severity="error">{notice.text}</Alert> : <LinearProgress />}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Automatic backups
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A full backup every day — devices, dashboards, settings, and sensor history — kept on the
          server in the <strong>backups</strong> folder (~/nexternel/backups). Download the emergency
          kit once and keep it somewhere safe: it holds the key that opens these backups on a new
          server.
        </Typography>

        {notice && (
          <Alert severity={notice.ok ? "success" : "error"} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}
        {restoreProgress && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Restoring: {restoreProgress}
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={schedule.enabled}
                disabled={busy !== null}
                onChange={(e) => void save({ enabled: e.target.checked })}
              />
            }
            label="Back up every day"
          />
          <FormControl size="small" sx={{ minWidth: 120 }} disabled={!schedule.enabled || busy !== null}>
            <InputLabel id="backup-hour">At</InputLabel>
            <Select
              labelId="backup-hour"
              label="At"
              value={schedule.hour}
              onChange={(e) => void save({ hour: Number(e.target.value) })}
            >
              {HOURS.map((h) => (
                <MenuItem key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }} disabled={!schedule.enabled || busy !== null}>
            <InputLabel id="backup-keep">Keep</InputLabel>
            <Select
              labelId="backup-keep"
              label="Keep"
              value={KEEP.includes(schedule.keep) ? schedule.keep : 7}
              onChange={(e) => void save({ keep: Number(e.target.value) })}
            >
              {KEEP.map((k) => (
                <MenuItem key={k} value={k}>
                  last {k}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={schedule.includeHistory}
                disabled={!schedule.enabled || busy !== null}
                onChange={(e) => void save({ includeHistory: e.target.checked })}
              />
            }
            label="Include sensor history"
          />
        </Stack>

        <Typography variant="body2" color={schedule.lastOk === false ? "error" : "text.secondary"} sx={{ mb: 2 }}>
          {schedule.lastRunAt
            ? `Last backup ${formatWhen(schedule.lastRunAt)}: ${schedule.lastOk ? "OK" : "failed"} — ${schedule.lastMessage ?? ""}`
            : "No backup yet — the first runs at the chosen time, or press Back up now."}
        </Typography>

        <ButtonRow direction="row" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Button
            variant="contained"
            disabled={busy !== null}
            onClick={() =>
              void run("now", async () => {
                const res = await api.backupNow();
                setSchedule(res.schedule);
                setFiles(res.files);
                setNotice(
                  res.result.ok
                    ? {
                        ok: true,
                        text: `${res.result.message} It opens with this server's backup key, not a password — download the emergency kit if you have not kept it yet.`,
                      }
                    : { ok: false, text: `Backup failed: ${res.result.message}` }
                );
              })
            }
          >
            {busy === "now" ? "Backing up…" : "Back up now"}
          </Button>
          <Button
            variant="outlined"
            disabled={busy !== null}
            onClick={() => void run("kit", async () => saveBlob(await api.downloadEmergencyKit()))}
          >
            Download emergency kit
          </Button>
        </ButtonRow>

        {busy === "now" && <LinearProgress sx={{ mb: 2 }} />}

        {files.length > 0 && (
          // One row per backup: when and how big, then its buttons with their words; Delete apart from the others.
          <Stack spacing={1}>
            {files.map((f) => (
              <Paper key={f.name} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                <Typography variant="body2">
                  {formatWhen(f.createdAt)}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {f.automatic ? "automatic" : "manual"} · {formatSize(f.sizeBytes)}
                  </Typography>
                </Typography>
                <ButtonRow direction="row" sx={{ mt: 1, alignItems: "center" }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadRoundedIcon fontSize="small" />}
                    disabled={busy !== null}
                    onClick={() => void run(`dl:${f.name}`, async () => saveBlob(await api.downloadStoredBackup(f.name)))}
                  >
                    Download
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<RestoreRoundedIcon fontSize="small" />} disabled={busy !== null} onClick={() => void restore(f)}>
                    Restore
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                    disabled={busy !== null}
                    onClick={() =>
                      void (async () => {
                        const ok = await confirm({
                          title: "Delete this backup?",
                          message: `The backup from ${formatWhen(f.createdAt)} will be removed from the server.`,
                          confirmLabel: "Delete",
                        });
                        if (ok) await run(`del:${f.name}`, async () => setFiles((await api.deleteStoredBackup(f.name)).files));
                      })()
                    }
                  >
                    Delete
                  </Button>
                </ButtonRow>
              </Paper>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
