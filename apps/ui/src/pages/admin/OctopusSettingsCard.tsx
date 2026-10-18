import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { api, type OctopusSettingsPublic } from "../../api";
import { ButtonRow } from "../../components/ButtonRow";

const emptyForm = {
  accountNumber: "",
  apiKey: "",
  electricityDeviceId: "",
  enabled: false,
  pollIntervalSec: "60",
};

type OctopusSettingsCardProps = {
  embedded?: boolean;
};

export function OctopusSettingsCard({ embedded = false }: OctopusSettingsCardProps) {
  const [form, setForm] = useState(emptyForm);
  const [settings, setSettings] = useState<OctopusSettingsPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [discoverBusy, setDiscoverBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.octopusSettings();
      setSettings(res.settings);
      setForm({
        accountNumber: res.settings.accountNumber,
        apiKey: "",
        electricityDeviceId: res.settings.electricityDeviceId,
        enabled: res.settings.enabled,
        pollIntervalSec: String(res.settings.pollIntervalSec),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Octopus settings");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const body: {
        accountNumber: string;
        electricityDeviceId: string;
        enabled: boolean;
        pollIntervalSec: number;
        apiKey?: string;
      } = {
        accountNumber: form.accountNumber.trim(),
        electricityDeviceId: form.electricityDeviceId.trim(),
        enabled: form.enabled,
        pollIntervalSec: Number(form.pollIntervalSec) || 60,
      };
      if (form.apiKey.trim()) {
        body.apiKey = form.apiKey.trim();
      }
      const res = await api.updateOctopusSettings(body);
      setSettings(res.settings);
      setForm((f) => ({ ...f, apiKey: "" }));
      setInfo(
        res.settings.enabled
          ? "Octopus connected. Bind gauges to: Live power, Usage today (electricity), Gas usage today."
          : "Octopus settings saved."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDiscover() {
    setDiscoverBusy(true);
    setError(null);
    try {
      const res = await api.discoverOctopusDevice();
      setSettings(res.settings);
      setForm((f) => ({
        ...f,
        electricityDeviceId:
          res.electricityDeviceId ?? res.settings.electricityDeviceId ?? f.electricityDeviceId,
      }));
      if (!res.electricityDeviceId) {
        setError("No electricity meter device ID found. Check API key and account number.");
      } else {
        const gasNote = res.gasDeviceId ? ` Gas meter: ${res.gasDeviceId}` : "";
        setInfo(`Electricity meter: ${res.electricityDeviceId}.${gasNote}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discover failed");
    } finally {
      setDiscoverBusy(false);
    }
  }

  async function onTestPoll() {
    setTestBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.testOctopusPoll();
      setSettings(res.settings);
      const summary = `Test poll — live: ${res.liveDemandW ?? "—"} W · electricity today: ${res.electricityTodayKwh ?? "—"} kWh · gas today: ${res.gasTodayKwh ?? "—"} kWh`;
      if (res.cooldown && res.message) {
        setInfo(`${res.message} Last values: ${summary.replace("Test poll — ", "")}`);
      } else {
        setInfo(summary);
      }
      if (res.settings.lastError && !res.cooldown) {
        setError(res.settings.lastError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test poll failed");
    } finally {
      setTestBusy(false);
    }
  }

  const body = (
    <>
      {!embedded && (
        <Typography variant="h6" gutterBottom>
          Octopus Home Mini
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Polls Octopus Energy for live power (W) and usage today (kWh) from your Home Mini
        via the Kraken API. The Mini itself stays on Octopus Wi‑Fi — no MQTT on your LAN.
      </Typography>

      {settings?.lastPollAt && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Last poll: {new Date(settings.lastPollAt).toLocaleString()}
          {settings.lastError ? ` · Error: ${settings.lastError}` : ""}
        </Typography>
      )}

      <Stack component="form" spacing={2} onSubmit={(e) => void onSave(e)}>
          <TextField
            label="Account number"
            value={form.accountNumber}
            onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
            placeholder="A-12345678"
            fullWidth
            required
          />
          <TextField
            label="API key"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            placeholder={settings?.hasApiKey ? "Saved — enter only to replace" : "sk_live_…"}
            fullWidth
            helperText="From octopus.energy → Account → API access (developer key)"
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Electricity meter device ID"
              value={form.electricityDeviceId}
              onChange={(e) =>
                setForm((f) => ({ ...f, electricityDeviceId: e.target.value }))
              }
              fullWidth
              placeholder="Use Discover"
            />
            <Button
              variant="outlined"
              disabled={busy || discoverBusy || testBusy}
              onClick={() => void onDiscover()}
            >
              {discoverBusy ? "…" : "Discover"}
            </Button>
          </Stack>
          <TextField
            label="Poll interval (seconds)"
            type="number"
            inputProps={{ min: 30, max: 300 }}
            value={form.pollIntervalSec}
            onChange={(e) => setForm((f) => ({ ...f, pollIntervalSec: e.target.value }))}
            fullWidth
            helperText="60s recommended (Octopus rate limit ~100 calls/hour)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
            }
            label="Enable Octopus polling"
          />
          {error && <Alert severity="error">{error}</Alert>}
          {info && <Alert severity="success">{info}</Alert>}
          <ButtonRow direction="row">
            <Button type="submit" variant="contained" disabled={busy || discoverBusy || testBusy}>
              {busy ? "Saving…" : "Save Octopus settings"}
            </Button>
            <Button
              variant="outlined"
              disabled={busy || discoverBusy || testBusy}
              onClick={() => void onTestPoll()}
            >
              {testBusy ? "Testing…" : "Test poll now"}
            </Button>
          </ButtonRow>
        </Stack>
    </>
  );

  if (embedded) {
    return body;
  }

  return (
    <Card>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
