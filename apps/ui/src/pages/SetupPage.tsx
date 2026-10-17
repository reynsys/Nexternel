import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddHomeRoundedIcon from "@mui/icons-material/AddHomeRounded";
import SettingsBackupRestoreRoundedIcon from "@mui/icons-material/SettingsBackupRestoreRounded";
import { api, rememberAuth, type BackupInspectResult, type BackupJob } from "../api";
import { useSkin } from "../skins/SkinProvider";
import { choiceSx } from "../skins/surfaceStyles";

/**
 * Welcome screen on a new installation: start a new home, or take over one from its backup.
 * Restoring needs no account first — the backup brings its own, so the owner then signs in
 * with their usual username and password.
 */
type Step = "choose" | "account" | "ready" | "pick-backup" | "review" | "restoring" | "restored";

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Choice({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={[
        {
        flex: 1,
        display: "block",
        textAlign: "left",
        p: 2.5,
        "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
      },
      choiceSx(false),
    ]}
    >
      <Box sx={{ color: "primary.main", mb: 1, "& svg": { fontSize: 36 } }}>{icon}</Box>
      <Typography variant="subtitle1" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </ButtonBase>
  );
}

export function SetupPage() {
  const navigate = useNavigate();
  const { applyAccountPrefs } = useSkin();
  const [step, setStep] = useState<Step>("choose");
  const [version, setVersion] = useState("");
  const [serverIp, setServerIp] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPassword, setBackupPassword] = useState("");
  const [inspect, setInspect] = useState<BackupInspectResult | null>(null);
  const [job, setJob] = useState<BackupJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api
      .setupStatus()
      .then((status) => {
        if (!status.needsSetup) {
          navigate("/login", { replace: true });
          return;
        }
        setVersion(status.version);
        setServerIp(status.serverIp);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not reach the Nexternel server");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  async function onCreateAdmin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const data = await api.setupComplete({ username: username.trim(), password, confirmPassword });
      rememberAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      applyAccountPrefs(data.user.themePrefs);
      go("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCheckBackup(e: FormEvent) {
    e.preventDefault();
    if (!backupFile) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.welcomeInspectBackup({ file: backupFile, password: backupPassword });
      if (!result.valid || !result.compatible) {
        setError(result.blockingErrors.join(" ") || "This backup cannot be restored.");
        return;
      }
      setInspect(result);
      go("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the backup");
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    if (!backupFile) return;
    setError(null);
    setBusy(true);
    try {
      const { job: started } = await api.welcomeRestoreBackup({ file: backupFile, password: backupPassword });
      setJob(started);
      go("restoring");
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        let current: BackupJob;
        try {
          current = (await api.welcomeRestoreJob(started.id)).job;
        } catch {
          continue; // services restart during a restore — keep asking
        }
        setJob(current);
        if (current.status === "completed" || current.status === "failed") break;
      }
      go("restored");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <LinearProgress sx={{ width: 240 }} />
      </Stack>
    );
  }

  const counts = inspect?.manifest?.counts;
  const network = inspect?.networkAdaptation;
  const addressChanges =
    !!network?.backupServerIp && !!network.currentServerIp && network.backupServerIp !== network.currentServerIp;
  const restoreOk = job?.status === "completed";

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", py: { xs: 2, sm: 6 }, px: 2 }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Typography variant="h5" fontWeight={600}>
              Welcome to Nexternel
            </Typography>

            {step === "choose" && (
              <>
                <Typography variant="body1" color="text.secondary">
                  This server is installed and ready. How would you like to start?
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Choice
                    icon={<AddHomeRoundedIcon />}
                    title="Start fresh"
                    text="Create your account, then add your rooms and devices."
                    onClick={() => go("account")}
                  />
                  <Choice
                    icon={<SettingsBackupRestoreRoundedIcon />}
                    title="Restore from backup"
                    text="Move your home from another server: devices, dashboards, history and accounts."
                    onClick={() => go("pick-backup")}
                  />
                </Stack>
              </>
            )}

            {step === "account" && (
              <Stack spacing={2} component="form" onSubmit={onCreateAdmin}>
                <Typography variant="body2" color="text.secondary">
                  Choose the username and password you will sign in with. Everything else — database,
                  MQTT and service passwords — has been set up for you.
                </Typography>
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  fullWidth
                  disabled={busy}
                  autoComplete="username"
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  disabled={busy}
                  autoComplete="new-password"
                  helperText="At least 8 characters"
                />
                <TextField
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  fullWidth
                  disabled={busy}
                  autoComplete="new-password"
                />
                {error && <Alert severity="error">{error}</Alert>}
                <Stack direction="row" spacing={1} justifyContent="space-between">
                  <Button onClick={() => go("choose")} disabled={busy}>
                    Back
                  </Button>
                  <Button type="submit" variant="contained" disabled={busy}>
                    {busy ? "Creating…" : "Create account"}
                  </Button>
                </Stack>
              </Stack>
            )}

            {step === "ready" && (
              <>
                <Alert severity="success">Your Nexternel is ready.</Alert>
                <Typography variant="body2" color="text.secondary">
                  A starter dashboard with a clock, calendar and server information is waiting for you.
                  Next, add your rooms under <strong>Areas</strong> and your devices under{" "}
                  <strong>Devices</strong> — they appear on the dashboard as you add them.
                </Typography>
                <Button variant="contained" onClick={() => navigate("/", { replace: true })}>
                  Open Nexternel
                </Button>
              </>
            )}

            {step === "pick-backup" && (
              <Stack spacing={2} component="form" onSubmit={onCheckBackup}>
                <Typography variant="body2" color="text.secondary">
                  Choose a backup file (it ends in <strong>.nexbackup</strong>). For a backup you
                  downloaded, enter the password you chose then. For an automatic backup, enter the{" "}
                  <strong>backup key</strong> from your emergency kit.
                </Typography>
                <Button variant="outlined" component="label" disabled={busy}>
                  {backupFile ? backupFile.name : "Choose backup file"}
                  <input
                    hidden
                    type="file"
                    accept=".nexbackup"
                    onChange={(e) => {
                      setBackupFile(e.target.files?.[0] ?? null);
                      setError(null);
                    }}
                  />
                </Button>
                <TextField
                  label="Backup password or key"
                  type="password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                  required
                  fullWidth
                  disabled={busy}
                  autoComplete="off"
                />
                {busy && <LinearProgress />}
                {error && <Alert severity="error">{error}</Alert>}
                <Stack direction="row" spacing={1} justifyContent="space-between">
                  <Button onClick={() => go("choose")} disabled={busy}>
                    Back
                  </Button>
                  <Button type="submit" variant="contained" disabled={busy || !backupFile || !backupPassword}>
                    {busy ? "Opening…" : "Open backup"}
                  </Button>
                </Stack>
              </Stack>
            )}

            {step === "review" && inspect && (
              <>
                <Typography variant="body1">
                  Backup from{" "}
                  <strong>{inspect.manifest ? formatWhen(inspect.manifest.createdAt) : "an unknown date"}</strong>
                  {inspect.manifest?.appVersion ? ` (${inspect.manifest.appVersion})` : ""}.
                </Typography>
                {counts && (
                  <Typography variant="body2" color="text.secondary">
                    {counts.areas} areas · {counts.devices} devices · {counts.dashboards} dashboards ·{" "}
                    {counts.cameras} cameras · {counts.users} accounts
                    {counts.historyIncluded ? " · sensor history" : ""}
                  </Typography>
                )}
                {addressChanges ? (
                  <Alert severity="warning">
                    Your devices are set up to talk to the server at <strong>{network!.backupServerIp}</strong>,
                    but this server is at <strong>{network!.currentServerIp}</strong>. The easy way: in your
                    router, give this server the address {network!.backupServerIp}, restart it, and then
                    restore — every device reconnects by itself. If you restore now, each device will need
                    updating afterwards.
                  </Alert>
                ) : network?.backupServerIp && network.backupServerIp === network.currentServerIp ? (
                  <Alert severity="info">
                    This server has the same address as the old one, so your devices reconnect by themselves.
                  </Alert>
                ) : null}
                {error && <Alert severity="error">{error}</Alert>}
                <Stack direction="row" spacing={1} justifyContent="space-between">
                  <Button onClick={() => go("pick-backup")} disabled={busy}>
                    Back
                  </Button>
                  <Button variant="contained" onClick={() => void onRestore()} disabled={busy}>
                    Restore this home
                  </Button>
                </Stack>
              </>
            )}

            {step === "restoring" && (
              <>
                <Typography variant="body1">Restoring your home — this takes about a minute.</Typography>
                <LinearProgress variant="determinate" value={job?.percent ?? 0} />
                <Typography variant="body2" color="text.secondary">
                  {job?.message || "Starting…"}
                </Typography>
              </>
            )}

            {step === "restored" && (
              <>
                {restoreOk ? (
                  <Alert severity="success">
                    Your home is restored. Sign in with your usual username and password.
                  </Alert>
                ) : (
                  <Alert severity="error">
                    The restore did not finish:{" "}
                    {job?.restoreResult?.errors?.join(" ") || job?.error?.message || job?.message || "unknown error"}
                  </Alert>
                )}
                {!!job?.restoreResult?.warnings?.length && (
                  <Alert severity="warning">{job.restoreResult.warnings.join(" ")}</Alert>
                )}
                {restoreOk ? (
                  <Button variant="contained" onClick={() => navigate("/login", { replace: true })}>
                    Sign in
                  </Button>
                ) : (
                  <Button variant="contained" onClick={() => go("choose")}>
                    Start again
                  </Button>
                )}
              </>
            )}

            {step === "choose" && error && (
              <Alert severity="error">{error}</Alert>
            )}

            <Typography variant="caption" color="text.secondary">
              Nexternel {version || ""}
              {serverIp ? ` · server ${serverIp}` : ""}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
