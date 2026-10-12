import { useState } from "react";
import {
  Alert,
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import type { PluginInfo, PluginSettingField } from "../../../../api";

type Draft = Record<string, string | boolean>;

function initialDraft(plugin: PluginInfo): Draft {
  const draft: Draft = {};
  for (const f of plugin.settingsFields) {
    const v = plugin.settings[f.key];
    if (!v || v.type === "secret") draft[f.key] = "";
    else if (f.type === "toggle") draft[f.key] = v.value === true;
    else draft[f.key] = v.value === null || v.value === undefined ? "" : String(v.value);
  }
  return draft;
}

function secretHelp(plugin: PluginInfo, field: PluginSettingField): string | undefined {
  const v = plugin.settings[field.key];
  if (v?.type !== "secret") return field.help;
  const state = v.unreadable
    ? "Saved on another server and cannot be read here — type it again."
    : v.isSet
      ? "Saved. Leave empty to keep it, or type a new one."
      : "Not set.";
  return field.help ? `${field.help} ${state}` : state;
}

/** The plugin's settings page, drawn from the fields the plugin describes. */
export function PluginSettingsForm({
  plugin,
  onSave,
}: {
  plugin: PluginInfo;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(plugin));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (plugin.settingsFields.length === 0) return null;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const values: Record<string, unknown> = {};
    for (const f of plugin.settingsFields) {
      const v = draft[f.key];
      // An empty secret box means "keep what is saved".
      if (f.type === "secret" && v === "") continue;
      values[f.key] = f.type === "number" ? Number(v) : v;
    }
    try {
      await onSave(values);
      setSaved(true);
      setDraft((d) => {
        const next = { ...d };
        for (const f of plugin.settingsFields) if (f.type === "secret") next[f.key] = "";
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 520 }}>
      {plugin.settingsFields.map((f) => {
        const id = `plugin-${plugin.id}-${f.key}`;
        if (f.type === "toggle") {
          return (
            <FormControlLabel
              key={f.key}
              control={
                <Switch
                  id={id}
                  checked={draft[f.key] === true}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.checked })}
                />
              }
              label={f.label}
            />
          );
        }
        return (
          <TextField
            key={f.key}
            id={id}
            size="small"
            label={f.label}
            required={f.required}
            select={f.type === "select"}
            type={f.type === "secret" ? "password" : f.type === "number" ? "number" : f.type === "time" ? "time" : "text"}
            value={draft[f.key] ?? ""}
            onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            helperText={secretHelp(plugin, f)}
            autoComplete={f.type === "secret" ? "new-password" : "off"}
            slotProps={{
              htmlInput: f.type === "number" ? { min: f.min, max: f.max } : undefined,
              inputLabel: f.type === "time" ? { shrink: true } : undefined,
            }}
          >
            {f.type === "select"
              ? (f.options ?? []).map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))
              : null}
          </TextField>
        );
      })}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {saved ? <Alert severity="success">Saved. The plugin restarts with the new settings.</Alert> : null}
      <div>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>
          Save settings
        </Button>
      </div>
    </Stack>
  );
}
