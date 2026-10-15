import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  DEFAULT_NOTIFY_AFTER_MIN,
  DEFAULT_STATUS_LIMITS,
  type PanelStatusLight,
  type StatusLightSettings,
  type StatusLimits,
} from "@nexternel/domain";
import { api } from "../../api";
import {
  useCapabilityStatus,
  useOptionalDashboardDataRuntime,
  type CapabilityStatus,
} from "../../lib/dashboard-data-runtime";
import { resolveStatusLook, statusColour, useStatusLightPrefs } from "./StatusLight";

/** Kinds of reading that are plain numbers, so limits make sense. */
const NON_NUMERIC_KINDS = new Set([
  "switch",
  "binary_sensor",
  "motion",
  "door",
  "lock",
  "camera",
  "alarm",
  "weather",
  "gps",
  "enum",
  "text",
  "json",
  "colour",
]);

export function readingCanHaveLight(kind: string): boolean {
  return !NON_NUMERIC_KINDS.has(kind);
}

export type StatusReading = { id: string; name: string; unit: string | null; kind: string };

/** The panel's own light settings for its saved config; nothing when it follows the defaults. */
export function statusLightConfig(value: PanelStatusLight): { statusLight?: PanelStatusLight } {
  return value.style === "default" && value.position === "default" && value.blink === "default"
    ? {}
    : { statusLight: value };
}

const STYLE_LABELS = {
  pill: "Rounded rectangle",
  bar: "Bar",
  dots: "Traffic light dots",
  glow: "Glowing border",
  off: "Off",
} as const;

const POSITION_LABELS = { title: "In the title", reading: "Under the reading" } as const;

/** "Act now below 16 · keep an eye on it 18 to 24 · act now above 27 °C" */
export function limitsSummary(limits: StatusLimits, unit: string | null): string {
  const u = unit ? ` ${unit}` : "";
  const parts: string[] = [];
  const n = (v: number | null | undefined) => (typeof v === "number" ? v : null);
  if (n(limits.alertLow) !== null) parts.push(`act now below ${limits.alertLow}`);
  const wl = n(limits.watchLow);
  const wh = n(limits.watchHigh);
  if (wl !== null && wh !== null) parts.push(`normal ${wl} to ${wh}`);
  else if (wl !== null) parts.push(`keep an eye on it below ${wl}`);
  else if (wh !== null) parts.push(`keep an eye on it above ${wh}`);
  if (n(limits.alertHigh) !== null) parts.push(`act now above ${limits.alertHigh}`);
  if (!parts.length) return "No limits";
  const text = parts.join(" · ") + u;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Edit menu → Status light: how this panel shows its lights, and the limits of each reading.
 * The look belongs to the panel; the limits belong to the reading (shared everywhere).
 */
export function StatusLightEditorSection({
  value,
  onChange,
  readings,
}: {
  value: PanelStatusLight;
  onChange: (next: PanelStatusLight) => void;
  readings: StatusReading[];
}) {
  const prefs = useStatusLightPrefs();
  const [editing, setEditing] = useState<StatusReading | null>(null);
  const numeric = readings.filter((r) => readingCanHaveLight(r.kind));
  if (numeric.length === 0) return null;
  const look = resolveStatusLook(value, prefs);

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Status light</Typography>
      <FormControl fullWidth size="small">
        <InputLabel id="status-light-style">Style</InputLabel>
        <Select
          labelId="status-light-style"
          label="Style"
          value={value.style}
          onChange={(e) => onChange({ ...value, style: e.target.value as PanelStatusLight["style"] })}
        >
          <MenuItem value="default">Default ({STYLE_LABELS[prefs.style]})</MenuItem>
          {(Object.keys(STYLE_LABELS) as (keyof typeof STYLE_LABELS)[]).map((k) => (
            <MenuItem key={k} value={k}>
              {STYLE_LABELS[k]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {look.style !== "off" ? (
        <>
          <FormControl fullWidth size="small">
            <InputLabel id="status-light-position">Where</InputLabel>
            <Select
              labelId="status-light-position"
              label="Where"
              value={value.position}
              onChange={(e) => onChange({ ...value, position: e.target.value as PanelStatusLight["position"] })}
            >
              <MenuItem value="default">Default ({POSITION_LABELS[prefs.position]})</MenuItem>
              <MenuItem value="title">{POSITION_LABELS.title}</MenuItem>
              <MenuItem value="reading">{POSITION_LABELS.reading}</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel id="status-light-blink">Blink on act now</InputLabel>
            <Select
              labelId="status-light-blink"
              label="Blink on act now"
              value={value.blink === "default" ? "default" : value.blink ? "on" : "off"}
              onChange={(e) =>
                onChange({ ...value, blink: e.target.value === "default" ? "default" : e.target.value === "on" })
              }
            >
              <MenuItem value="default">Default ({prefs.blink ? "On" : "Off"})</MenuItem>
              <MenuItem value="on">On</MenuItem>
              <MenuItem value="off">Off</MenuItem>
            </Select>
          </FormControl>
        </>
      ) : null}
      <Stack spacing={1}>
        {numeric.map((r) => (
          <ReadingLimitsRow key={r.id} reading={r} colours={look} onChange={() => setEditing(r)} />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Limits belong to the reading, so they apply wherever it is shown and to bell alerts. Colours and
        the default style are in Settings → Appearance.
      </Typography>
      {editing ? <StatusLimitsDialog reading={editing} onClose={() => setEditing(null)} /> : null}
    </Stack>
  );
}

function ReadingLimitsRow({
  reading,
  colours,
  onChange,
}: {
  reading: StatusReading;
  colours: Parameters<typeof statusColour>[1];
  onChange: () => void;
}) {
  const status = useCapabilityStatus(reading.id);
  const settings = status?.settings ?? null;
  const text =
    !settings || !settings.enabled
      ? "No limits yet: set them to show a light"
      : limitsSummary(settings.limits, reading.unit) + (status?.custom ? "" : " (starting limits)");
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          flex: "none",
          bgcolor: status?.state ? statusColour(status.state, colours) : "action.disabled",
        }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap title={reading.name}>
          {reading.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {text}
        </Typography>
      </Box>
      <Button size="small" onClick={onChange} sx={{ flex: "none" }}>
        {settings?.enabled ? "Change limits" : "Set limits"}
      </Button>
    </Box>
  );
}

type Field = keyof StatusLimits;
const FIELDS: { key: Field; label: string }[] = [
  { key: "alertHigh", label: "Act now above" },
  { key: "watchHigh", label: "Keep an eye on it above" },
  { key: "watchLow", label: "Keep an eye on it below" },
  { key: "alertLow", label: "Act now below" },
];

const toText = (v: number | null | undefined) => (typeof v === "number" ? String(v) : "");

/** One reading's limits: where its light turns amber or red, and when the bell rings. */
export function StatusLimitsDialog({ reading, onClose }: { reading: StatusReading; onClose: () => void }) {
  const runtime = useOptionalDashboardDataRuntime();
  const live = useCapabilityStatus(reading.id);
  const [status, setStatus] = useState<CapabilityStatus | null>(live);
  const start: StatusLightSettings = status?.settings ?? {
    enabled: true,
    limits: { ...(DEFAULT_STATUS_LIMITS[reading.kind] ?? {}) },
    notifyAfterMin: DEFAULT_NOTIFY_AFTER_MIN,
  };
  const [enabled, setEnabled] = useState(start.enabled || !status?.settings);
  const [text, setText] = useState<Record<Field, string>>({
    alertLow: toText(start.limits.alertLow),
    watchLow: toText(start.limits.watchLow),
    watchHigh: toText(start.limits.watchHigh),
    alertHigh: toText(start.limits.alertHigh),
  });
  const [notifyOn, setNotifyOn] = useState(start.notifyAfterMin !== null);
  const [minutes, setMinutes] = useState(String(start.notifyAfterMin ?? DEFAULT_NOTIFY_AFTER_MIN));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Outside a dashboard (Devices page) there is no live store: fetch this reading's limits once.
  useEffect(() => {
    if (live || status) return;
    void api
      .capabilities()
      .then((r) => {
        const s = r.capabilities.find((c) => c.id === reading.id)?.statusLight ?? null;
        if (!s) return;
        setStatus(s);
        if (s.settings) {
          setEnabled(s.settings.enabled);
          setText({
            alertLow: toText(s.settings.limits.alertLow),
            watchLow: toText(s.settings.limits.watchLow),
            watchHigh: toText(s.settings.limits.watchHigh),
            alertHigh: toText(s.settings.limits.alertHigh),
          });
          setNotifyOn(s.settings.notifyAfterMin !== null);
          setMinutes(String(s.settings.notifyAfterMin ?? DEFAULT_NOTIFY_AFTER_MIN));
        }
      })
      .catch(() => undefined);
  }, [live, status, reading.id]);

  const unit = reading.unit ? <InputAdornment position="end">{reading.unit}</InputAdornment> : undefined;

  async function done(promise: Promise<{ statusLight: CapabilityStatus | null }>) {
    setSaving(true);
    setError(null);
    try {
      const r = await promise;
      if (r.statusLight) runtime?.statuses.set(r.statusLight);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the limits");
    } finally {
      setSaving(false);
    }
  }

  function save() {
    const limits: StatusLimits = {};
    for (const { key, label } of FIELDS) {
      const t = text[key].trim();
      if (!t) {
        limits[key] = null;
        continue;
      }
      const n = Number(t);
      if (!Number.isFinite(n)) {
        setError(`"${label}" must be a number, or left empty.`);
        return;
      }
      limits[key] = n;
    }
    const mins = Number(minutes);
    if (notifyOn && (!Number.isInteger(mins) || mins < 1 || mins > 1440)) {
      setError("Minutes before a bell alert must be a whole number from 1 to 1440.");
      return;
    }
    void done(api.setStatusLimits(reading.id, { enabled, limits, notifyAfterMin: notifyOn ? mins : null }));
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Limits for {reading.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label="Show a status light for this reading"
          />
          {enabled ? (
            <>
              <Typography variant="body2" color="text.secondary">
                Leave a box empty when that side does not matter (for example CO₂ is never too low). The
                light changes after the reading has stayed past a limit for 1 minute.
              </Typography>
              {FIELDS.map(({ key, label }) => (
                <TextField
                  key={key}
                  size="small"
                  label={label}
                  value={text[key]}
                  inputMode="decimal"
                  onChange={(e) => setText({ ...text, [key]: e.target.value })}
                  InputProps={{ endAdornment: unit }}
                />
              ))}
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControlLabel
                  sx={{ mr: 0 }}
                  control={<Switch checked={notifyOn} onChange={(e) => setNotifyOn(e.target.checked)} />}
                  label="Bell alert after"
                />
                <TextField
                  size="small"
                  value={minutes}
                  disabled={!notifyOn}
                  inputMode="numeric"
                  onChange={(e) => setMinutes(e.target.value)}
                  sx={{ width: 120 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                The bell rings when the reading has been at act now this long, and again when it is back to normal.
              </Typography>
            </>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {status?.custom ? (
          <Button disabled={saving} onClick={() => void done(api.resetStatusLimits(reading.id))} sx={{ mr: "auto" }}>
            Back to starting limits
          </Button>
        ) : null}
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
