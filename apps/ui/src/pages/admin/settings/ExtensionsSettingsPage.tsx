import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Collapse, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { api, type AddonInfo, type AddonsResponse, type PluginCatalogEntry, type PluginsResponse } from "../../../api";
import { useConfirm } from "../../../components/confirm";
import { usePluginHost } from "../../../plugins/PluginHostContext";
import { useShellAuth } from "../../../skins/useShellAuth";
import { hasPermission } from "../../../lib/permissions";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { loadAddons } from "../../../skins/looks/addon-loader";
import { describeAddonCheck } from "../../../lib/addon-check";
import { ButtonRow } from "../../../components/ButtonRow";
import { useLiveChanges } from "../../../lib/live-changes";
import { InstallDialog, InstalledPlugin, type InstallTarget } from "./plugins/PluginRow";
import { ADDON_STATUS, day } from "./addon-status";

/**
 * Settings → Extensions: everything that adds to Nexternel, in one place. Each one is a Feature (runs on
 * the server, e.g. the AI assistant), a Style (a Look for every screen) or later Device support; free
 * ones install with one click, paid ones unlock with the licence key from the email. (Under the hood,
 * features are plugins and paid styles are licensed add-on packs; the person sees one list.)
 */
type ExtType = "all" | "feature" | "style";

const TYPE_LABEL: Record<Exclude<ExtType, "all">, string> = { feature: "Feature", style: "Style" };

function Badges({ type, paid }: { type: Exclude<ExtType, "all">; paid: boolean }) {
  return (
    <>
      <Chip size="small" variant="outlined" label={TYPE_LABEL[type]} />
      <Chip size="small" variant="outlined" color={paid ? "info" : "secondary"} label={paid ? "Paid" : "Free"} />
    </>
  );
}

export function ExtensionsSettingsPage() {
  const surfaceSx = useContentSurfaceSx();
  const { confirm } = useConfirm();
  const host = usePluginHost();
  const { isAdmin, permissions } = useShellAuth();
  const canManage = hasPermission(permissions, "manageUsers", Boolean(isAdmin));
  const [type, setType] = useState<ExtType>("all");
  const [plugins, setPlugins] = useState<PluginsResponse | null>(null);
  const [catalog, setCatalog] = useState<PluginCatalogEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [addons, setAddons] = useState<AddonsResponse | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [installing, setInstalling] = useState<InstallTarget | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [key, setKey] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const loadPlugins = useCallback(async () => setPlugins(await api.plugins()), []);
  const loadAddonList = useCallback(async () => {
    if (canManage) setAddons(await api.addons());
  }, [canManage]);
  const loadCatalog = useCallback(async (refresh = false) => {
    try {
      setCatalog((await api.pluginCatalog(refresh)).plugins);
      setCatalogError(null);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "The official list could not be loaded.");
    }
  }, []);
  // Changes made on another screen show here straight away.
  useLiveChanges(["plugins", "addons"], (topic) => void (topic === "addons" ? loadAddonList() : loadPlugins()));

  useEffect(() => {
    void loadPlugins().catch((err) => setNotice({ ok: false, text: err instanceof Error ? err.message : "Could not load extensions" }));
    void loadAddonList().catch(() => {});
    if (canManage) void loadCatalog();
    // Features start and stop; keep their status current while the page is open.
    const timer = setInterval(() => void loadPlugins().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [loadPlugins, loadAddonList, loadCatalog, canManage]);

  async function run(label: string, action: () => Promise<string | void>) {
    setBusy(label);
    setNotice(null);
    try {
      const text = await action();
      await Promise.all([loadPlugins(), loadAddonList()]);
      void host.refresh();
      if (text) setNotice({ ok: true, text });
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

  const show = (t: Exclude<ExtType, "all">) => type === "all" || type === t;
  const installedPlugins = plugins?.plugins ?? [];
  const installedIds = new Set(installedPlugins.map((p) => p.id));
  const available = (catalog ?? []).filter((e) => !installedIds.has(e.id));
  const updates = new Map((catalog ?? []).filter((e) => e.updateAvailable).map((e) => [e.id, e]));
  const styles = addons?.addons ?? [];
  const nothingInstalled = (!show("feature") || installedPlugins.length === 0) && (!show("style") || styles.length === 0);

  const addonRow = (a: AddonInfo): ReactNode => (
    <Paper key={a.id} variant="inset" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography fontWeight="fontWeightBold">{a.name}</Typography>
        <Typography variant="body2" color="text.secondary">{a.version}</Typography>
        <Badges type="style" paid />
        <Chip size="small" color={ADDON_STATUS[a.status].color} label={ADDON_STATUS[a.status].label} />
        <Box sx={{ flex: 1 }} />
        {canManage ? (
          <Button
            size="small"
            color="error"
            disabled={busy !== null}
            onClick={async () => {
              const ok = await confirm({
                title: `Remove ${a.name}?`,
                message:
                  "It stops working on this server and its place on your licence is freed, so you can install it on another server. You can install it here again with the same key.",
                confirmLabel: "Remove",
              });
              if (ok) await run(`remove-${a.id}`, async () => void (await api.removeAddon(a.id), await loadAddons()));
            }}
          >
            Remove
          </Button>
        ) : null}
      </Stack>
      {a.description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {a.description} Choose it in Settings → My appearance → Style.
        </Typography>
      ) : null}
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
        Licence {a.licenceId}
        {a.holder ? ` · ${a.holder}` : ""} · Valid until {day(a.validUntil)} (renewed automatically) · Last checked {day(a.checkedAt)}
      </Typography>
      {a.message && a.status !== "active" ? (
        <Alert severity={a.status === "expired" ? "warning" : "error"} sx={{ mt: 1 }}>
          {a.message}
        </Alert>
      ) : null}
    </Paper>
  );

  return (
    <Stack spacing={3}>
      <Card sx={surfaceSx}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
              <Box sx={{ flex: 1 }}>
                <ToggleButtonGroup exclusive size="small" value={type} onChange={(_e, v: ExtType | null) => v && setType(v)} aria-label="Show">
                  <ToggleButton value="all">All</ToggleButton>
                  <ToggleButton value="feature">Features</ToggleButton>
                  <ToggleButton value="style">Styles</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              {canManage && addons?.available ? (
                <Button variant={keyOpen ? "contained" : "outlined"} onClick={() => setKeyOpen((o) => !o)}>
                  Enter licence key
                </Button>
              ) : null}
            </Stack>
            <Collapse in={keyOpen} unmountOnExit>
              <Box
                component="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!key.trim()) return;
                  void run("install-key", async () => {
                    const r = await api.installAddon(key);
                    await loadAddons();
                    setKey("");
                    setKeyOpen(false);
                    return `Unlocked: ${r.addons.map((x) => x.name).join(", ")}. Choose it in Settings → My appearance.`;
                  });
                }}
              >
                <ButtonRow direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "flex-start" }} flexWrap="nowrap">
                  <TextField
                    id="addon-licence-key"
                    size="small"
                    label="Licence key (from your email)"
                    placeholder="NX-XXXX-XXXX-XXXX-XXXX"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    autoComplete="off"
                    inputProps={{ spellCheck: false }}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                  <Button type="submit" variant="contained" disabled={!key.trim() || busy !== null}>
                    {busy === "install-key" ? <CircularProgress size={20} color="inherit" /> : "Unlock"}
                  </Button>
                </ButtonRow>
              </Box>
            </Collapse>
            {plugins && !plugins.host.connected ? (
              <Alert severity="warning">
                The service that runs features is not running, so features cannot start. It starts with Nexternel; if this message stays, restart Nexternel
                (Settings → System → Help &amp; troubleshooting).
              </Alert>
            ) : null}
            {notice ? (
              <Alert severity={notice.ok ? "success" : "error"} onClose={() => setNotice(null)}>
                {notice.text}
              </Alert>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={surfaceSx}>
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center">
              <Typography variant="h6" sx={{ flex: 1 }}>
                Installed
              </Typography>
              {canManage && show("style") && styles.length ? (
                <Button
                  size="small"
                  disabled={busy !== null}
                  onClick={() => {
                    const before = styles;
                    void run("check", async () => {
                      const after = (await api.checkAddons()).addons;
                      await loadAddons();
                      return describeAddonCheck(before, after).text;
                    });
                  }}
                >
                  {busy === "check" ? <CircularProgress size={18} /> : "Check for updates"}
                </Button>
              ) : null}
            </Stack>
            {!plugins ? <CircularProgress size={24} /> : null}
            {plugins && nothingInstalled ? <Typography color="text.secondary">Nothing of this kind is installed.</Typography> : null}
            {show("feature")
              ? installedPlugins.map((p) => (
                  <InstalledPlugin
                    key={p.id}
                    plugin={p}
                    badges={<Badges type="feature" paid={false} />}
                    canManage={canManage}
                    busy={busy}
                    update={updates.get(p.id) ?? null}
                    onToggle={(on) => void run(`toggle-${p.id}`, async () => void (await api.setPluginEnabled(p.id, on)))}
                    onUpdate={() =>
                      void run(`update-${p.id}`, async () => {
                        await api.installPlugin(p.id, p.grants);
                        void loadCatalog(true);
                        return `${p.name} updated.`;
                      })
                    }
                    onGrants={(g) => void run(`grants-${p.id}`, async () => void (await api.setPluginGrants(p.id, g)))}
                    onBell={(b) => void run(`bell-${p.id}`, async () => void (await api.setPluginBell(p.id, b)))}
                    onSettings={async (values) => {
                      await api.savePluginSettings(p.id, values);
                      await loadPlugins();
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
                ))
              : null}
            {show("style") ? styles.map(addonRow) : null}
            {canManage && addons ? (
              <Typography variant="caption" color="text.secondary">
                Paid extensions are licensed to this server and may not be copied or shared. Server id {addons.serverId.slice(0, 8)}.
              </Typography>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {canManage ? (
        <Card sx={surfaceSx}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6">Available</Typography>
              {show("feature") ? (
                <>
                  {catalogError ? <Alert severity="warning">{catalogError}</Alert> : null}
                  {catalog === null && !catalogError ? <CircularProgress size={24} /> : null}
                  {available.map((e) => (
                    <Paper key={e.id} variant="inset" sx={{ p: 2 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography fontWeight="fontWeightBold">{e.name}</Typography>
                            <Typography variant="body2" color="text.secondary">{e.version}</Typography>
                            <Badges type="feature" paid={false} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">{e.description}</Typography>
                          {!e.compatible ? (
                            <Typography variant="body2" color="warning.main">Needs Nexternel {e.minNexternel} or newer.</Typography>
                          ) : null}
                        </Box>
                        <Button variant="contained" disabled={!e.compatible || busy !== null} onClick={() => setInstalling({ kind: "catalog", entry: e })}>
                          Install
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                  {catalog && available.length === 0 ? (
                    <Typography color="text.secondary">Every free feature is already installed.</Typography>
                  ) : null}
                </>
              ) : null}
              {show("style") ? (
                <Typography variant="body2" color="text.secondary">
                  {addons?.available
                    ? "Paid styles (3D, HUD and more) unlock with a licence key from the Nexternel shop — press Enter licence key above."
                    : "Paid styles will be available when the Nexternel shop opens."}
                </Typography>
              ) : null}
              <Box sx={{ pt: 1 }}>
                <Typography variant="subtitle2">Install from a file</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  For features that are not in the official list. Only use files from people you trust.
                </Typography>
                <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => void chooseFile(e.target.files?.[0])} />
                <Button variant="outlined" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
                  Choose file…
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
              const res = t.kind === "catalog" ? await api.installPlugin(t.entry.id, grants) : await api.installPluginFile(t.file, grants);
              void loadCatalog();
              return res.plugin.missingSettings.length
                ? `${res.plugin.name} is installed. Fill in its settings to start it.`
                : `${res.plugin.name} is installed and starting.`;
            });
            setInstalling(null);
          }}
        />
      ) : null}
    </Stack>
  );
}
