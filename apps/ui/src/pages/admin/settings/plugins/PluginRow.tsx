import { useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Checkbox, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Stack, Switch, Typography } from "@mui/material";
import type { PluginCatalogEntry, PluginGrants, PluginInfo, PluginManifestInfo } from "../../../../api";
import { PluginPermissionsForm, defaultGrants } from "./PluginPermissionsForm";
import { PluginSettingsForm } from "./PluginSettingsForm";
import { PluginActivityView } from "./PluginActivityView";
import { ButtonRow } from "../../../../components/ButtonRow";

export const PLUGIN_STATUS: Record<PluginInfo["status"], { label: string; color: "success" | "warning" | "error" | "default" | "info" }> = {
  running: { label: "Running", color: "success" },
  starting: { label: "Starting", color: "info" },
  waiting: { label: "Waiting", color: "warning" },
  crashed: { label: "Problem", color: "error" },
  stopped: { label: "Off", color: "default" },
};

type RowTab = "settings" | "permissions" | "activity";

export type InstallTarget =
  | { kind: "catalog"; entry: PluginCatalogEntry }
  | { kind: "file"; file: File; manifest: PluginManifestInfo };

export function InstalledPlugin({
  plugin: p,
  canManage,
  busy,
  update,
  onToggle,
  onUpdate,
  onGrants,
  onSettings,
  onRemove,
  badges,
}: {
  /** Labels shown after the name (e.g. Feature · Free on Settings → Extensions). */
  badges?: ReactNode;
  plugin: PluginInfo;
  canManage: boolean;
  busy: string | null;
  update: PluginCatalogEntry | null;
  onToggle: (on: boolean) => void;
  onUpdate: () => void;
  onGrants: (g: PluginGrants) => void;
  onSettings: (values: Record<string, unknown>) => Promise<void>;
  onRemove: () => void;
}) {
  // An extension with its own page keeps its settings there, so they are in one place.
  const page = p.pages?.[0];
  const [tab, setTab] = useState<RowTab | null>(p.missingSettings.length > 0 && !page ? "settings" : null);
  const [grants, setGrants] = useState<PluginGrants>(p.grants);
  const status = p.enabled ? PLUGIN_STATUS[p.status] : PLUGIN_STATUS.stopped;
  const grantsChanged = JSON.stringify(grants) !== JSON.stringify(p.grants);
  const tabButton = (value: RowTab, label: string) => (
    <Button
      size="small"
      variant={tab === value ? "contained" : "outlined"}
      aria-expanded={tab === value}
      onClick={() => setTab(tab === value ? null : value)}
    >
      {label}
    </Button>
  );

  return (
    <Paper variant="inset" sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: "fontWeightBold" }}>{p.name}</Typography>
            <Typography variant="body2" color="text.secondary">{p.version}</Typography>
            {badges}
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
          <ButtonRow>
            {update ? (
              <Button size="small" variant="contained" disabled={busy !== null} onClick={onUpdate}>
                Update to {update.version}
              </Button>
            ) : null}
            <FormControlLabel
              control={<Switch checked={p.enabled} disabled={busy !== null} onChange={(e) => onToggle(e.target.checked)} />}
              label="Switched on"
            />
            <Button color="error" size="small" disabled={busy !== null} onClick={onRemove}>
              Remove
            </Button>
          </ButtonRow>
        ) : null}
      </Stack>

      <ButtonRow sx={{ mt: 1.5 }}>
        {p.settingsFields.length > 0 && canManage && page ? (
          <Button
            size="small"
            variant="outlined"
            disabled={!p.enabled}
            component={RouterLink}
            to={`/plugin-page/${encodeURIComponent(p.id)}/${encodeURIComponent(page.id)}?tab=settings`}
          >
            Open {p.name} settings
          </Button>
        ) : null}
        {p.settingsFields.length > 0 && canManage && !page ? tabButton("settings", "Settings") : null}
        {canManage ? tabButton("permissions", "Permissions") : null}
        {tabButton("activity", "Activity")}
      </ButtonRow>

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
                <Typography variant="caption" color="text.secondary">
                  Which of its messages reach the bell is chosen in Settings → Notifications.
                </Typography>
              ) : null}
            </Stack>
          ) : null}
          {tab === "activity" ? <PluginActivityView pluginId={p.id} /> : null}
          <Box sx={{ pt: 2 }}>
            <Button variant="outlined" size="small" onClick={() => setTab(null)}>
              Close
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}

export function InstallDialog({
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
