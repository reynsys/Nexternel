import { ICON_SIZE } from "../lib/appearance/type";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddHomeRoundedIcon from "@mui/icons-material/AddHomeRounded";
import SettingsBackupRestoreRoundedIcon from "@mui/icons-material/SettingsBackupRestoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { TERMS_SECTIONS, TERMS_SUMMARY } from "@nexternel/domain";
import { api, rememberAuth, type BackupInspectResult, type BackupJob, type PasswordCheck, type SetupStatusResponse } from "../api";
import { useSkin } from "../skins/SkinProvider";
import { choiceSx, insetSx } from "../skins/surfaceStyles";
import { ChoiceTile } from "../skins/ThemePresetTile";
import { toAccountThemePrefs } from "../skins/themePrefs";
import { THEME_PRESETS } from "../lib/appearance/presets";
import { ThemePresetTile, prefsWithPreset, presetIsChosen } from "../skins/ThemePresetTile";
import { ButtonRow } from "../components/ButtonRow";
import { DevicesWifiFields, type DevicesWifiValue } from "../components/DevicesWifi";
import { BrandMark } from "../components/BrandMark";
import { PlaceSearch, type ChosenPlace } from "../components/PlaceSearch";
import { PasswordTicks, passwordChecksPass } from "../components/PasswordTicks";
import { backupSecretError, backupSecretField } from "../lib/backup-file";

/**
 * The setup wizard on a new installation, step by step with Next and Back:
 * Welcome → Terms → Your account → Your home (can skip) → Your look (can skip) → Ready.
 * "Restore from a backup" goes Welcome → Terms → backup file → check → restore, then sign-in with the
 * backup's own accounts. Nothing is saved until Finish: the server gets everything in one go.
 * Full screen, without the menu (there is nothing in it yet).
 */
type Step = "welcome" | "terms" | "account" | "home" | "devices-wifi" | "look" | "ready" | "pick-backup" | "review" | "restoring" | "restored";

const FRESH: Step[] = ["welcome", "terms", "account", "home", "devices-wifi", "look", "ready"];
const RESTORE: Step[] = ["welcome", "terms", "pick-backup", "review", "restored"];
/** The ready-made themes offered in setup: clearly different from each other (the rest are in Appearance). */
const SETUP_THEMES = ["nexternel", "aurora", "emerald", "ember"];
/** Where Nexternel for Android is explained and downloaded. */
const ANDROID_PAGE = "https://www.nexternel.com/#android";

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Choice({ icon, title, selected, onClick }: { icon: ReactNode; title: string; selected: boolean; onClick: () => void }) {
  return (
    <ChoiceTile selected={selected} onClick={onClick} title={title} sx={{ flex: 1, p: 2 }}>
      <Box sx={{ color: "primary.main", mb: 0.5, "& svg": { fontSize: ICON_SIZE.feature } }}>{icon}</Box>
    </ChoiceTile>
  );
}

/** How far along: "Step 3 of 6" and a bar per step. */
function Progress({ at, of }: { at: number; of: number }) {
  return (
    <Stack spacing={0.75} aria-label={`Step ${at} of ${of}`}>
      <Typography variant="caption" color="text.secondary">
        Step {at} of {of}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {Array.from({ length: of }, (_, i) => (
          <Box key={i} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: i < at ? "primary.main" : "divider" }} />
        ))}
      </Box>
    </Stack>
  );
}

/** One address to open Nexternel at, in its own box (two addresses on one line get typed as one). */
function AddressBox({ label, address }: { label: string; address: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="div" variant="body1" sx={[{ px: 1.5, py: 1, userSelect: "all", wordBreak: "break-all", fontWeight: "fontWeightBold" }, insetSx()]}>{address}</Typography>
    </Stack>
  );
}

/** A suggestion on the last step: opens the right page. */
function NextLink({ title, to, href }: { title: string; to?: string; href?: string }) {
  const linkProps = href ? { component: "a" as const, href, target: "_blank", rel: "noreferrer" } : { component: RouterLink, to: to! };
  return (
    <ButtonBase {...linkProps} sx={[{ justifyContent: "space-between", textAlign: "left", px: 1.5, py: 1.25, gap: 1 }, choiceSx(false)]}>
      <Typography variant="body2" fontWeight="fontWeightBold" sx={{ minWidth: 0 }}>{title}</Typography>
      <ChevronRightRoundedIcon color="action" />
    </ButtonBase>
  );
}

export function SetupPage() {
  const navigate = useNavigate();
  const { applyAccountPrefs, themePrefs, setThemePrefs, skin } = useSkin();
  const [status, setStatus] = useState<SetupStatusResponse | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [path, setPath] = useState<"fresh" | "restore">("fresh");
  const [agreed, setAgreed] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [checks, setChecks] = useState<PasswordCheck[]>([]);
  const [place, setPlace] = useState<ChosenPlace | null>(null);
  const [devicesWifi, setDevicesWifi] = useState<DevicesWifiValue>({ ssid: "", password: "" });
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
      .then((s) => {
        if (!s.needsSetup) {
          navigate("/login", { replace: true });
          return;
        }
        setStatus(s);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not reach Nexternel");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  function go(next: Step) {
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  const steps = path === "fresh" ? FRESH : RESTORE;
  const at = Math.max(steps.indexOf(step === "restoring" ? "review" : step), 0) + 1;

  const emailProblem = email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "That email address does not look right." : null;
  const accountReady =
    username.trim().length >= 2 && passwordChecksPass(checks) && password === confirmPassword && !emailProblem;

  function onAccountNext(e: FormEvent) {
    e.preventDefault();
    if (username.trim().length < 2) return setError("The username needs at least 2 characters.");
    if (!passwordChecksPass(checks)) return setError("The password does not meet all the rules yet.");
    if (password !== confirmPassword) return setError("The two passwords are not the same.");
    if (emailProblem) return setError(emailProblem);
    go("home");
  }

  /** Create the account and the home in one go (the end of the Look step, Next or Skip). */
  async function onFinish() {
    setError(null);
    setBusy(true);
    try {
      const data = await api.setupComplete({
        username: username.trim(),
        password,
        confirmPassword,
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
        termsVersion: status!.termsVersion,
        place: place ? { name: place.name, latitude: place.latitude, longitude: place.longitude } : null,
        themePrefs: toAccountThemePrefs(themePrefs, skin.id),
        devicesWifi: devicesWifi.ssid.trim() ? devicesWifi : null,
      });
      rememberAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      applyAccountPrefs(data.user.themePrefs);
      go("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup did not finish. Try again.");
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
      setError(backupSecretError(backupFile.name, err instanceof Error ? err.message : "Could not open the backup"));
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    if (!backupFile || !status) return;
    setError(null);
    setBusy(true);
    try {
      const { job: started } = await api.welcomeRestoreBackup({ file: backupFile, password: backupPassword, termsVersion: status.termsVersion });
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
  const addresses = status?.localAddresses ?? [];
  const setupThemes = SETUP_THEMES.map((id) => THEME_PRESETS.find((p) => p.id === id)).filter((p) => !!p);
  const nexternelTheme = THEME_PRESETS.find((p) => p.id === "nexternel");

  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", py: { xs: 2, sm: 6 }, px: 2 }}>
      <Card sx={{ width: "100%", maxWidth: 600 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <BrandMark size={44} />
              <Typography variant="h6">Nexternel</Typography>
            </Stack>
            {status && <Progress at={at} of={steps.length} />}

            {!status && error && <Alert severity="error">{error}</Alert>}

            {status && step === "welcome" && (
              <>
                <Typography variant="h5">Welcome to your Nexternel</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Choice
                    icon={<AddHomeRoundedIcon />}
                    title="Start fresh"
                    selected={path === "fresh"}
                    onClick={() => setPath("fresh")}
                  />
                  <Choice
                    icon={<SettingsBackupRestoreRoundedIcon />}
                    title="Restore from a backup"
                    selected={path === "restore"}
                    onClick={() => setPath("restore")}
                  />
                </Stack>
                <ButtonRow direction="row" justifyContent="flex-end">
                  <Button variant="contained" onClick={() => go("terms")}>
                    Next
                  </Button>
                </ButtonRow>
              </>
            )}

            {step === "terms" && (
              <>
                <Typography variant="h5">Terms of use</Typography>
                <Box sx={[{ p: 2, maxHeight: 260, overflowY: "auto" }, insetSx()]} tabIndex={0} aria-label="Terms of use">
                  <Stack spacing={1.25}>
                    <Typography variant="body2">
                      <strong>In short:</strong> {TERMS_SUMMARY}
                    </Typography>
                    {TERMS_SECTIONS.map((sec) => (
                      <Box key={sec.title}>
                        <Typography variant="body2" fontWeight="fontWeightBold">{sec.title}</Typography>
                        <Typography variant="body2" color="text.secondary">{sec.text}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <FormControlLabel
                  control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
                  label="I have read and agree to the terms of use"
                />
                <ButtonRow direction="row" justifyContent="space-between">
                  <Button onClick={() => go("welcome")}>Back</Button>
                  <Button variant="contained" disabled={!agreed} onClick={() => go(path === "fresh" ? "account" : "pick-backup")}>
                    Next
                  </Button>
                </ButtonRow>
              </>
            )}

            {step === "account" && (
              <Stack spacing={2} component="form" onSubmit={onAccountNext}>
                <Typography variant="h5">Your account</Typography>
                <TextField label="Your name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth autoComplete="name" />
                <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required fullWidth autoComplete="username" />
                <Stack spacing={0.75}>
                  <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth autoComplete="new-password" />
                  <PasswordTicks password={password} username={username} onChecks={setChecks} />
                </Stack>
                <TextField
                  label="Type the password again"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  fullWidth
                  autoComplete="new-password"
                  error={!!confirmPassword && confirmPassword !== password}
                  helperText={confirmPassword && confirmPassword !== password ? "Not the same as the password above." : " "}
                />
                <TextField
                  label="Email (optional)"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  autoComplete="email"
                  error={!!emailProblem}
                  helperText={emailProblem}
                />
                {error && <Alert severity="error">{error}</Alert>}
                <ButtonRow direction="row" justifyContent="space-between">
                  <Button onClick={() => go("terms")}>Back</Button>
                  <Button type="submit" variant="contained" disabled={!accountReady}>
                    Next
                  </Button>
                </ButtonRow>
              </Stack>
            )}

            {step === "home" && (
              <>
                <Typography variant="h5">Weather</Typography>
                <PlaceSearch value={place} onChange={setPlace} search={api.setupPlaces} label="Town or postcode" />
                {status?.timeZone ? (
                  <Typography variant="body2" color="text.secondary">
                    Time zone: {status.timeZone}
                  </Typography>
                ) : null}
                <ButtonRow direction="row" justifyContent="space-between">
                  <Button onClick={() => go("account")}>Back</Button>
                  <ButtonRow direction="row">
                    <Button
                      onClick={() => {
                        setPlace(null);
                        go("devices-wifi");
                      }}
                    >
                      Skip
                    </Button>
                    <Button variant="contained" onClick={() => go("devices-wifi")}>
                      Next
                    </Button>
                  </ButtonRow>
                </ButtonRow>
              </>
            )}

            {step === "devices-wifi" && (
              <>
                <Typography variant="h5">Wi-Fi for your devices</Typography>
                <DevicesWifiFields idPrefix="setup-devices-wifi" value={devicesWifi} onChange={setDevicesWifi} />
                {error && <Alert severity="error">{error}</Alert>}
                <ButtonRow direction="row" justifyContent="space-between">
                  <Button onClick={() => go("home")}>Back</Button>
                  <ButtonRow direction="row">
                    <Button
                      onClick={() => {
                        setDevicesWifi({ ssid: "", password: "" });
                        go("look");
                      }}
                    >
                      Skip
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => {
                        const { ssid, password } = devicesWifi;
                        if (!ssid.trim()) return setError("Type the Wi-Fi name, or press Skip.");
                        if (password.length < 8 || password.length > 63) return setError("A Wi-Fi password has 8 to 63 characters.");
                        go("look");
                      }}
                    >
                      Next
                    </Button>
                  </ButtonRow>
                </ButtonRow>
              </>
            )}

            {step === "look" && (
              <>
                <Typography variant="h5">Theme</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 1 }}>
                  {setupThemes.map((p) => (
                    <ThemePresetTile key={p.id} preset={p} prefs={themePrefs} mode={themePrefs.mode} selected={presetIsChosen(themePrefs, p)} onPick={() => setThemePrefs(prefsWithPreset(themePrefs, p))} />
                  ))}
                </Box>
                {busy && <LinearProgress />}
                {error && <Alert severity="error">{error}</Alert>}
                <ButtonRow direction="row" justifyContent="space-between">
                  <Button onClick={() => go("devices-wifi")} disabled={busy}>
                    Back
                  </Button>
                  <ButtonRow direction="row">
                    <Button
                      disabled={busy}
                      onClick={() => {
                        if (nexternelTheme) setThemePrefs(prefsWithPreset(themePrefs, nexternelTheme));
                        void onFinish();
                      }}
                    >
                      Skip
                    </Button>
                    <Button variant="contained" disabled={busy} onClick={() => void onFinish()}>
                      {busy ? "Setting up…" : "Finish setup"}
                    </Button>
                  </ButtonRow>
                </ButtonRow>
              </>
            )}

            {step === "ready" && (
              <>
                <Typography variant="h5">Your Nexternel is ready</Typography>
                <Stack spacing={1.25}>
                  {addresses[0] ? <AddressBox label="Your Nexternel address" address={addresses[0]} /> : null}
                  {addresses[1] ? <AddressBox label="If it doesn't open" address={addresses[1]} /> : null}
                </Stack>
                <Stack spacing={1}>
                  <NextLink title="Add areas" to="/admin/areas" />
                  <NextLink title="Add a device" to="/admin/devices" />
                  <NextLink title="Nexternel for Android" href={ANDROID_PAGE} />
                </Stack>
                <Alert severity="info">
                  Daily backups are on. Download your emergency kit from{" "}
                  <Link component={RouterLink} to="/admin/settings/backup">Backup &amp; Restore</Link> and keep it somewhere safe: without
                  it, a backup cannot be opened on a new machine.
                </Alert>
                <ButtonRow direction="row" justifyContent="flex-end">
                  <Button variant="contained" onClick={() => navigate("/", { replace: true })}>
                    Open my dashboard
                  </Button>
                </ButtonRow>
              </>
            )}

            {step === "pick-backup" && (
              <Stack spacing={2} component="form" onSubmit={onCheckBackup}>
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
                  label={backupSecretField(backupFile?.name).label}
                  helperText={backupSecretField(backupFile?.name).hint}
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
                <ButtonRow direction="row" justifyContent="space-between">
                  <Button onClick={() => go("terms")} disabled={busy}>
                    Back
                  </Button>
                  <Button type="submit" variant="contained" disabled={busy || !backupFile || !backupPassword}>
                    {busy ? "Opening…" : "Open backup"}
                  </Button>
                </ButtonRow>
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
                    Devices look for <strong>{network!.backupServerIp}</strong>; this server is{" "}
                    <strong>{network!.currentServerIp}</strong>. Easiest: give this server {network!.backupServerIp} in
                    your router, restart it, then restore. Restore now and each device needs updating after.
                  </Alert>
                ) : null}
                {error && <Alert severity="error">{error}</Alert>}
                <ButtonRow direction="row" justifyContent="space-between">
                  <Button onClick={() => go("pick-backup")} disabled={busy}>
                    Back
                  </Button>
                  <Button variant="contained" onClick={() => void onRestore()} disabled={busy}>
                    Restore backup
                  </Button>
                </ButtonRow>
              </>
            )}

            {step === "restoring" && (
              <>
                <Typography variant="body1">Restoring…</Typography>
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
                    Restored.
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
                <ButtonRow direction="row" justifyContent="flex-end">
                  {restoreOk ? (
                    <Button variant="contained" onClick={() => navigate("/login", { replace: true })}>
                      Sign in
                    </Button>
                  ) : (
                    <Button variant="contained" onClick={() => go("welcome")}>
                      Start again
                    </Button>
                  )}
                </ButtonRow>
              </>
            )}

            <Typography variant="caption" color="text.secondary">
              Nexternel {status?.version || ""}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
