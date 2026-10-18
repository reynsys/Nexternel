import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Paper, Select, Stack, Switch, Tab, Tabs, Typography } from "@mui/material";
import {
  api,
  type PluginCatalogEntry,
  type PluginGrants,
  type PluginInfo,
  type PluginManifestInfo,
  type PluginsResponse,
} from "../../../api";
import { useConfirm } from "../../../components/confirm";
import { usePluginHost } from "../../../plugins/PluginHostContext";
import { useShellAuth } from "../../../skins/useShellAuth";
import { hasPermission } from "../../../lib/permissions";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { PluginPermissionsForm, defaultGrants } from "./plugins/PluginPermissionsForm";
import { PluginSettingsForm } from "./plugins/PluginSettingsForm";
import { PluginActivityView } from "./plugins/PluginActivityView";
import { ButtonRow } from "../../../components/ButtonRow";
import { useLiveChanges } from "../../../lib/live-changes";

const STATUS: Record<PluginInfo["status"], { label: string; color: "success" | "warning" | "error" | "default" | "info" }> = {
  running: { label: "Running", color: "success" },
  starting: { label: "Starting", color: "info" },
  waiting: { label: "Waiting", color: "warning" },
  crashed: { label: "Problem", color: "error" },
  stopped: { label: "Off", color: "default" },
};

type InstallTarget =
  | { kind: "catalog"; entry: PluginCatalogEntry }
  | { kind: "file"; file: File; manifest: PluginManifestInfo };

export function PluginsSettingsPage() {
  const surfaceSx = useContentSurfaceSx();
  const { confirm } = useConfirm();
  const host = usePluginHost();
  const { isAdmin, permissions } = useShellAuth();
  const canManage = hasPermission(permissions, "manageUsers", Boolean(isAdmin));
  const [state, setState] = useState<PluginsResponse | null>(null);
  const [catalog, setCatalog] = useState<PluginCatalogEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [installing, setInstalling] = useState<InstallTarget | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await api.plugins();
    setState(res);
  }, []);
  // Changes made on another screen show here straight away.
  useLiveChanges(["plugins"], () => void load());

  const loadCatalog = useCallback(async (refresh = false) => {
    try {
      const res = await api.pluginCatalog(refresh);
      setCatalog(res.plugins);
      setCatalogError(null);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "The official plugin list could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void load().catch((err) => setNotice({ ok: false, text: err instanceof Error ? err.message : "Could not load plugins" }));
    if (canManage) void loadCatalog();
    // Status changes as plugins start and stop; keep it current while the page is open.
    const timer = setInterval(() => void load().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [load, loadCatalog, canManage]);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setNotice(null);
    try {
      await action();
      await load();
      void host.refresh();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    await run("inspect", async () => {
      const { manifest } = await api.inspectPluginFile(file);
      setInstalling({ kind: "file", file, manifest });
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  const plugins = state?.plugins ?? [];
  const installedIds = new Set(plugins.map((p) => p.id));
  const available = (catalog ?? []).filter((e) => !installedIds.has(e.id));
  const updates = new Map((catalog ?? []).filter((e) => e.updateAvailable).map((e) => [e.id, e]));

  return (
    <Stack spacing={3}>
      <Card sx={surfaceSx}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Installed plugins</Typography>
              <Typography variant="body2" color="text.secondary">
                Plugins add new abilities to Nexternel. Each one runs separately and only gets the permissions you approve.
              </Typography>
            </Box>
            {state && !state.host.connected ? (
              <Alert severity="warning">
                The plugin service is not running, so plugins cannot start. It starts with Nexternel; if this message stays,
                run <code>docker compose up -d plugins</code> in the Nexternel folder on the server.
              </Alert>
            ) : null}
            {notice ? <Alert severity={notice.ok ? "success" : "error"}>{notice.text}</Alert> : null}
            {!state ? <CircularProgress size={24} /> : null}
            {state && plugins.length === 0 ? (
              <Typography color="text.secondary">No plugins installed yet.</Typography>
            ) : null}
            {plugins.map((p) => (
              <InstalledPlugin
                key={p.id}
                plugin={p}
                canManage={canManage}
                busy={busy}
                update={updates.get(p.id) ?? null}
                onToggle={(on) => run(`toggle-${p.id}`, async () => void (await api.setPluginEnabled(p.id, on)))}
                onUpdate={() =>
                  run(`update-${p.id}`, async () => {
                    await api.installPlugin(p.id, p.grants);
                    setNotice({ ok: true, text: `${p.name} updated.` });
                    void loadCatalog(true);
                  })
                }
                onGrants={(g) => run(`grants-${p.id}`, async () => void (await api.setPluginGrants(p.id, g)))}
                onBell={(b) => run(`bell-${p.id}`, async () => void (await api.setPluginBell(p.id, b)))}
                onSettings={async (values) => {
                  await api.savePluginSettings(p.id, values);
                  await load();
                }}
                onRemove={async () => {
                  const ok = await confirm({
                    title: `Remove ${p.name}?`,
                    message: "Its devices disappear from your panels and its settings are deleted. You can install it again later.",
                    confirmLabel: "Remove",
                  });
                  if (ok) await run(`remove-${p.id}`, async () => void (await api.removePlugin(p.id)));
                }}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {canManage ? (
        <Card sx={surfaceSx}>
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6">Available plugins</Typography>
                <Typography variant="body2" color="text.secondary">
                  Official plugins from Nexternel{state && !state.officialCatalog ? " (test list)" : ""}.
                </Typography>
              </Box>
              {catalogError ? <Alert severity="warning">{catalogError}</Alert> : null}
              {catalog === null && !catalogError ? <CircularProgress size={24} /> : null}
              {catalog && available.length === 0 ? (
                <Typography color="text.secondary">Every official plugin is already installed.</Typography>
              ) : null}
              {available.map((e) => (
                <Stack key={e.id} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {e.name} <Typography component="span" variant="body2" color="text.secondary">{e.version}</Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{e.description}</Typography>
                    {!e.compatible ? (
                      <Typography variant="body2" color="warning.main">Needs Nexternel {e.minNexternel} or newer.</Typography>
                    ) : null}
                  </Box>
                  <Button
                    variant="contained"
                    disabled={!e.compatible || busy !== null}
                    onClick={() => setInstalling({ kind: "catalog", entry: e })}
                  >
                    Install
                  </Button>
                </Stack>
              ))}
              <Divider />
              <Box>
                <Typography variant="subtitle2">Install from a file</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  For plugins that are not in the official list. Only use files from people you trust.
                </Typography>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".zip,application/zip"
                  hidden
                  onChange={(e) => void chooseFile(e.target.files?.[0])}
                />
                <Button variant="outlined" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
                  Choose plugin file…
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {installing ? (
        <InstallDialog
          target={installing}
          onClose={() => setInstalling(null)}
          onInstall={async (grants) => {
            const t = installing;
            await run("install", async () => {
              const res =
                t.kind === "catalog" ? await api.installPlugin(t.entry.id, grants) : await api.installPluginFile(t.file, grants);
              setNotice({
                ok: true,
                text: res.plugin.missingSettings.length
                  ? `${res.plugin.name} is installed. Fill in its settings to start it.`
                  : `${res.plugin.name} is installed and starting.`,
              });
              void loadCatalog();
            });
            setInstalling(null);
          }}
        />
      ) : null}
    </Stack>
  );
}

function InstalledPlugin({
  plugin: p,
  canManage,
  busy,
  update,
  onToggle,
  onUpdate,
  onGrants,
  onBell,
  onSettings,
  onRemove,
}: {
  plugin: PluginInfo;
  canManage: boolean;
  busy: string | null;
  update: PluginCatalogEntry | null;
  onToggle: (on: boolean) => void;
  onUpdate: () => void;
  onGrants: (g: PluginGrants) => void;
  onBell: (bell: "all" | "important" | "none") => void;
  onSettings: (values: Record<string, unknown>) => Promise<void>;
  onRemove: () => void;
}) {
  const [tab, setTab] = useState<"settings" | "permissions" | "activity" | null>(
    p.missingSettings.length > 0 ? "settings" : null
  );
  const [grants, setGrants] = useState<PluginGrants>(p.grants);
  const status = p.enabled ? STATUS[p.status] : STATUS.stopped;
  const grantsChanged = JSON.stringify(grants) !== JSON.stringify(p.grants);

  return (
    <Paper variant="inset" sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography>
            <Typography variant="body2" color="text.secondary">{p.version}</Typography>
            <Chip size="small" label={status.label} color={status.color} />
            {p.source === "file" ? <Chip size="small" variant="outlined" color="warning" label="From a file" /> : null}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {p.enabled && p.missingSettings.length
              ? `Fill in: ${p.missingSettings.join(", ")}`
              : p.enabled
                ? p.statusMessage ?? p.description
                : p.description}
          </Typography>
        </Box>
        {canManage ? (
          <Stack direction="row" spacing={1} alignItems="center">
            {update ? (
              <Button size="small" variant="contained" disabled={busy !== null} onClick={onUpdate}>
                Update to {update.version}
              </Button>
            ) : null}
            <FormControlLabel
              control={<Switch checked={p.enabled} disabled={busy !== null} onChange={(e) => onToggle(e.target.checked)} />}
              label={p.enabled ? "On" : "Off"}
            />
          </Stack>
        ) : null}
      </Stack>

      <Tabs
        value={tab ?? false}
        onChange={(_, v) => setTab(v === tab ? null : v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{ mt: 1, minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}
      >
        {p.settingsFields.length > 0 && canManage ? <Tab value="settings" label="Settings" onClick={() => tab === "settings" && setTab(null)} /> : null}
        {canManage ? <Tab value="permissions" label="Permissions" onClick={() => tab === "permissions" && setTab(null)} /> : null}
        <Tab value="activity" label="Activity" onClick={() => tab === "activity" && setTab(null)} />
      </Tabs>

      <Collapse in={tab !== null} unmountOnExit>
        <Box sx={{ pt: 2 }}>
          {tab === "settings" ? <PluginSettingsForm plugin={p} onSave={onSettings} /> : null}
          {tab === "permissions" ? (
            <Stack spacing={2} sx={{ maxWidth: 560 }}>
              <PluginPermissionsForm requested={p.permissions} grants={grants} onChange={setGrants} />
              <ButtonRow direction="row">
                <Button variant="contained" disabled={!grantsChanged || busy !== null} onClick={() => onGrants(grants)}>
                  Save permissions
                </Button>
                <Button disabled={!grantsChanged} onClick={() => setGrants(p.grants)}>
                  Undo
                </Button>
              </ButtonRow>
              {p.permissions.notify ? (
                <FormControl size="small" fullWidth>
                  <InputLabel id={`bell-${p.id}`}>Messages in the bell</InputLabel>
                  <Select
                    labelId={`bell-${p.id}`}
                    label="Messages in the bell"
                    value={p.bell ?? "important"}
                    disabled={busy !== null}
                    onChange={(e) => onBell(e.target.value as "all" | "important" | "none")}
                  >
                    <MenuItem value="important">Only important ones (keep an eye on it)</MenuItem>
                    <MenuItem value="all">All, including information such as summaries</MenuItem>
                    <MenuItem value="none">None</MenuItem>
                  </Select>
                  <FormHelperText>
                    Saved straight away. A plugin's messages are never red: red is kept for Nexternel itself, such as a
                    reading at act now. A plugin's own panels show its information either way.
                  </FormHelperText>
                </FormControl>
              ) : null}
            </Stack>
          ) : null}
          {tab === "activity" ? <PluginActivityView pluginId={p.id} /> : null}
          {canManage ? (
            <Box sx={{ pt: 2 }}>
              <Button color="error" size="small" disabled={busy !== null} onClick={onRemove}>
                Remove plugin
              </Button>
            </Box>
          ) : null}
        </Box>
      </Collapse>
    </Paper>
  );
}

function InstallDialog({
  target,
  onClose,
  onInstall,
}: {
  target: InstallTarget;
  onClose: () => void;
  onInstall: (grants: PluginGrants) => Promise<void>;
}) {
  const info =
    target.kind === "catalog"
      ? target.entry
      : { ...target.manifest, name: target.manifest.name ?? target.manifest.id, permissions: target.manifest.permissions ?? {} };
  const requested = info.permissions ?? {};
  const [grants, setGrants] = useState<PluginGrants>(() => defaultGrants(requested));
  const [trusted, setTrusted] = useState(target.kind === "catalog");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Install {info.name} {info.version}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {info.description ? <Typography variant="body2">{info.description}</Typography> : null}
          {info.author ? (
            <Typography variant="body2" color="text.secondary">By {info.author}</Typography>
          ) : null}
          {target.kind === "file" ? (
            <Alert severity="warning">
              This plugin is not from the official list, so Nexternel cannot check where it came from. A plugin from a
              file can only do what you approve below, but only install it if you trust the person who gave it to you.
            </Alert>
          ) : null}
          <Typography variant="subtitle2">It asks to:</Typography>
          <PluginPermissionsForm requested={requested} grants={grants} onChange={setGrants} controlPickerLater />
          {target.kind === "file" ? (
            <FormControlLabel
              control={<Checkbox checked={trusted} onChange={(e) => setTrusted(e.target.checked)} />}
              label="I trust where this file came from"
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!trusted || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onInstall(grants);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Installing…" : "Install"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
