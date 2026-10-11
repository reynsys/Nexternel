import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api, type BackupInspectResult, type BackupJob } from "../../../api";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

const PHASE_LABELS: Record<string, string> = {
  queued: "Checking backup",
  collecting_home: "Configuration",
  collecting_esphome: "Devices",
  collecting_automations: "Automations",
  collecting_history: "Historical sensor data",
  packaging: "Finalising backup",
  encrypting: "Finalising backup",
  verifying: "Verifying installation",
  ready: "Backup ready",
  restoring_home: "Home configuration",
  restoring_esphome: "Devices",
  adapting_network: "Adapting network configuration",
  restoring_automations: "Automations",
  restoring_history: "Historical sensor data",
  syncing: "Rebuilding device configuration",
};

function progressLines(job: BackupJob | null): string[] {
  if (!job) return [];
  const order = [
    "collecting_home",
    "collecting_esphome",
    "collecting_automations",
    "collecting_history",
    "packaging",
  ];
  const restoreOrder = [
    "queued",
    "restoring_home",
    "restoring_esphome",
    "adapting_network",
    "restoring_automations",
    "restoring_history",
    "syncing",
    "verifying",
  ];
  const phases = job.type === "restore" ? restoreOrder : order;
  const current = job.status;
  const idx = phases.indexOf(current);
  return phases.map((p, i) => {
    const label = PHASE_LABELS[p] ?? p;
    if (job.status === "ready" || job.status === "completed") return `✓ ${label}`;
    if (job.status === "failed") {
      if (i < idx) return `✓ ${label}`;
      if (i === idx) return `✗ ${label}`;
      return `○ ${label}`;
    }
    if (i < idx) return `✓ ${label}`;
    if (i === idx) return `→ ${label}`;
    return `○ ${label}`;
  });
}

function formatInspectCounts(inspect: BackupInspectResult): string[] {
  const c = inspect.manifest?.counts;
  if (!c) return [];
  const lines = [
    `Areas: ${c.areas}`,
    `Devices: ${c.devices}`,
    `Capabilities: ${c.capabilities}`,
    `Dashboards: ${c.dashboards}`,
    `Cameras: ${c.cameras}`,
    `Users: ${c.users}`,
    `Automations: ${c.automationsIncluded ? "included" : "not included"}`,
    `Historical data: ${c.historyIncluded ? "included" : "not included"}`,
  ];
  return lines;
}

export function BackupRestoreSection() {
  const surfaceSx = useContentSurfaceSx();
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [includeHistory, setIncludeHistory] = useState(true);
  const [createBusy, setCreateBusy] = useState(false);
  const [createJob, setCreateJob] = useState<BackupJob | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [, setServerIp] = useState<string | null>(null);
  const [inspect, setInspect] = useState<BackupInspectResult | null>(null);
  const [inspectBusy, setInspectBusy] = useState(false);
  const [inspectErr, setInspectErr] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreJob, setRestoreJob] = useState<BackupJob | null>(null);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  useEffect(() => {
    void api
      .system()
      .then((info) => setServerIp(info.lanIp ?? null))
      .catch(() => setServerIp(null));
  }, []);

  useEffect(() => {
    if (!createJob || createJob.status === "ready" || createJob.status === "failed") return;
    const id = createJob.id;
    const timer = window.setInterval(() => {
      void api.getBackupJob(id).then((r) => setCreateJob(r.job));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [createJob]);

  useEffect(() => {
    if (!restoreJob || restoreJob.status === "completed" || restoreJob.status === "failed") return;
    const id = restoreJob.id;
    const timer = window.setInterval(() => {
      void api.getBackupJob(id).then((r) => setRestoreJob(r.job));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [restoreJob]);

  async function onCreateBackup() {
    setCreateErr(null);
    if (password.length < 8) {
      setCreateErr("Backup password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setCreateErr("Backup passwords do not match.");
      return;
    }
    setCreateBusy(true);
    setCreateJob(null);
    try {
      const { job } = await api.createBackupJob({
        password,
        confirmPassword,
        includeHistory,
      });
      setCreateJob(job);
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setCreateBusy(false);
    }
  }

  async function onDownloadBackup() {
    if (!createJob) return;
    try {
      const { blob, filename } = await api.downloadBackupJob(createJob.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function onInspect() {
    if (!restoreFile) {
      setInspectErr("Select a backup file (.nexbackup) first.");
      return;
    }
    if (!restorePassword) {
      setInspectErr("Enter the backup password.");
      return;
    }
    setInspectBusy(true);
    setInspectErr(null);
    setInspect(null);
    try {
      const result = await api.inspectBackup({ file: restoreFile, password: restorePassword });
      if (!result.valid) {
        setInspectErr(result.blockingErrors[0] || "Invalid backup.");
        return;
      }
      setInspect(result);
    } catch (err) {
      setInspectErr(err instanceof Error ? err.message : "Could not read backup");
    } finally {
      setInspectBusy(false);
    }
  }

  async function onRestore() {
    if (!restoreFile || !inspect?.valid) return;
    if (restoreConfirm !== "RESTORE") {
      setRestoreErr('Type RESTORE to continue.');
      return;
    }
    setRestoreBusy(true);
    setRestoreErr(null);
    setRestoreMsg(null);
    setRestoreJob(null);
    try {
      const { job } = await api.restoreBackup({
        file: restoreFile,
        password: restorePassword,
        confirm: restoreConfirm,
        wifiSsid: wifiSsid.trim() || undefined,
        wifiPassword: wifiPassword || undefined,
      });
      setRestoreJob(job);
    } catch (err) {
      setRestoreErr(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoreBusy(false);
    }
  }

  useEffect(() => {
    if (!restoreJob) return;
    if (restoreJob.status === "completed" && restoreJob.restoreResult?.ok) {
      setRestoreMsg("Restore complete.");
    } else if (restoreJob.status === "failed") {
      setRestoreErr(restoreJob.error?.message || "Restore failed.");
    } else if (restoreJob.status === "completed" && restoreJob.restoreResult && !restoreJob.restoreResult.ok) {
      setRestoreErr(restoreJob.restoreResult.errors.join("; ") || "Restore completed with errors.");
    }
  }, [restoreJob]);

  return (
    <Stack spacing={2}>
      <Card sx={surfaceSx}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Back up to a file · Restore from a file
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A one-off backup with a password you choose, downloaded to this computer — or restore a
            backup file from another server. For a backup made automatically on this server, use
            the backup key from the emergency kit as the password.
          </Typography>

          <Typography variant="subtitle2" gutterBottom>
            Create Backup
          </Typography>
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <TextField
              label="Backup password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="new-password"
            />
            <TextField
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              autoComplete="new-password"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                />
              }
              label="Include historical sensor data"
            />
            <Button
              variant="contained"
              onClick={() => void onCreateBackup()}
              disabled={createBusy || (!!createJob && createJob.status !== "ready" && createJob.status !== "failed")}
            >
              {createBusy ? "Starting…" : "Create Backup"}
            </Button>
            {createErr && <Alert severity="error">{createErr}</Alert>}
            {createJob && createJob.status !== "ready" && createJob.status !== "failed" && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Creating backup…
                </Typography>
                <LinearProgress variant="determinate" value={createJob.percent} sx={{ mb: 1 }} />
                <Stack spacing={0.25}>
                  {progressLines(createJob).map((line) => (
                    <Typography key={line} variant="body2" color="text.secondary">
                      {line}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
            {createJob?.status === "ready" && (
              <Box>
                <Alert severity="success" sx={{ mb: 1 }}>
                  Backup ready
                  {createJob.filename ? `: ${createJob.filename}` : ""}
                </Alert>
                <Button variant="contained" onClick={() => void onDownloadBackup()}>
                  Download Backup
                </Button>
              </Box>
            )}
            {createJob?.status === "failed" && (
              <Alert severity="error">{createJob.error?.message || createJob.message}</Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={surfaceSx}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Restore Backup
          </Typography>
          <input
            ref={restoreFileRef}
            type="file"
            accept=".nexbackup,application/octet-stream"
            hidden
            onChange={(e) => {
              setRestoreFile(e.target.files?.[0] ?? null);
              setInspect(null);
              setInspectErr(null);
              e.target.value = "";
            }}
          />
          <Stack spacing={2} sx={{ maxWidth: 520 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
              <Button variant="outlined" onClick={() => restoreFileRef.current?.click()}>
                Select Backup File
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
                {restoreFile ? restoreFile.name : "No file selected"}
              </Typography>
            </Stack>
            <TextField
              label="Backup password"
              type="password"
              value={restorePassword}
              onChange={(e) => {
                setRestorePassword(e.target.value);
                setInspect(null);
              }}
              fullWidth
              autoComplete="current-password"
            />
            <Button
              variant="outlined"
              disabled={inspectBusy || !restoreFile}
              onClick={() => void onInspect()}
            >
              {inspectBusy ? "Inspecting…" : "Inspect backup"}
            </Button>
            {inspectErr && <Alert severity="error">{inspectErr}</Alert>}
            {inspect?.valid && inspect.manifest && (
              <Alert severity={inspect.compatible ? "success" : "warning"}>
                <Typography variant="subtitle2" gutterBottom>
                  {inspect.compatible
                    ? "Backup is compatible with this installation."
                    : "Backup may not be fully compatible."}
                </Typography>
                <Typography variant="body2">
                  Date: {new Date(inspect.manifest.createdAt).toLocaleString()}
                </Typography>
                <Typography variant="body2">Version: {inspect.manifest.appVersion}</Typography>
                <Typography variant="body2">
                  Format: v{inspect.manifest.formatVersion}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2, mt: 1 }}>
                  {formatInspectCounts(inspect).map((line) => (
                    <li key={line}>
                      <Typography variant="body2">{line}</Typography>
                    </li>
                  ))}
                </Box>
                {inspect.warnings.map((w) => (
                  <Typography key={w} variant="body2" color="warning.main">
                    {w}
                  </Typography>
                ))}
              </Alert>
            )}
            {inspect?.networkAdaptation && (
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Network adaptation
                </Typography>
                {inspect.networkAdaptation.differentInstallation ? (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    This backup was created on a different Nexternel installation. Network-specific
                    settings will be adapted automatically.
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    This backup matches this installation. Network settings will still be refreshed
                    from the current server.
                  </Typography>
                )}
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {inspect.networkAdaptation.adaptations.map((row) => (
                    <li key={row.label}>
                      <Typography variant="body2">
                        {row.label}: {row.from} → {row.to}
                      </Typography>
                    </li>
                  ))}
                </Box>
                {inspect.networkAdaptation.wifiMayBeRequired && (
                  <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                    Some devices may require Wi-Fi configuration.
                  </Typography>
                )}
                {inspect.networkAdaptation.usersInBackup > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Backup contains {inspect.networkAdaptation.usersInBackup} user
                    {inspect.networkAdaptation.usersInBackup === 1 ? "" : "s"}. Your current
                    administrator password will be kept.
                  </Typography>
                )}
              </Alert>
            )}

            {inspect?.valid && inspect.compatible && (
              <>
                <TextField
                  label="Wi‑Fi network name (optional)"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  fullWidth
                  helperText="Only if devices must join a different Wi‑Fi network on this site."
                />
                <TextField
                  label="Wi‑Fi password (optional)"
                  type="password"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  fullWidth
                  autoComplete="new-password"
                />
                <Alert severity="warning">
                  This will replace the current Nexternel configuration with the selected backup.
                  Current Areas, Devices, Dashboards, Automations and other configuration may be
                  replaced. Type RESTORE to continue.
                </Alert>
                <TextField
                  label='Type RESTORE'
                  value={restoreConfirm}
                  onChange={(e) => setRestoreConfirm(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="contained"
                  color="warning"
                  disabled={restoreBusy || restoreConfirm !== "RESTORE"}
                  onClick={() => void onRestore()}
                >
                  {restoreBusy ? "Starting…" : "Restore Backup"}
                </Button>
              </>
            )}

            {restoreJob && restoreJob.status !== "completed" && restoreJob.status !== "failed" && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Restoring…
                </Typography>
                <LinearProgress variant="determinate" value={restoreJob.percent} sx={{ mb: 1 }} />
                <Stack spacing={0.25}>
                  {progressLines(restoreJob).map((line) => (
                    <Typography key={line} variant="body2" color="text.secondary">
                      {line}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
            {restoreMsg && (
              <Alert severity="success">
                {restoreMsg}
                {restoreJob?.restoreResult?.warnings.map((w) => (
                  <Typography key={w} variant="body2" sx={{ mt: 1 }}>
                    {w}
                  </Typography>
                ))}
              </Alert>
            )}
            {restoreErr && <Alert severity="error">{restoreErr}</Alert>}
            {restoreJob?.restoreResult && !restoreJob.restoreResult.ok && (
              <Alert severity="warning">
                {restoreJob.restoreResult.errors.join("; ")}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
