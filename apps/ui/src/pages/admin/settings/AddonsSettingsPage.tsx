import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import { api, type AddonInfo, type AddonsResponse } from "../../../api";
import { useConfirm } from "../../../components/confirm";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { loadAddons } from "../../../skins/looks/addon-loader";
import { describeAddonCheck } from "../../../lib/addon-check";
import { ButtonRow } from "../../../components/ButtonRow";

const STATUS: Record<AddonInfo["status"], { label: string; color: "success" | "warning" | "error" }> = {
  active: { label: "Active", color: "success" },
  expired: { label: "Needs a check", color: "warning" },
  revoked: { label: "Cancelled", color: "error" },
  broken: { label: "Needs the key again", color: "error" },
};

const KIND: Record<string, string> = { look: "Look" };

function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** Settings → Add-ons: install paid add-ons with a licence key, see and remove them. */
export function AddonsSettingsPage() {
  const surfaceSx = useContentSurfaceSx();
  const { confirm } = useConfirm();
  const [data, setData] = useState<AddonsResponse | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; ok: boolean; for: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await api.addons());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(label: string, fn: () => Promise<{ addons: AddonInfo[] }>, success?: (a: AddonInfo[]) => string | { text: string; ok: boolean }) {
    setBusy(label);
    setError(null);
    setDone(null);
    try {
      const r = await fn();
      setData((d) => (d ? { ...d, addons: r.addons } : d));
      await loadAddons();
      if (success) {
        const m = success(r.addons);
        setDone({ ...(typeof m === "string" ? { text: m, ok: true } : m), for: label });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return error ? (
      <Alert severity="error">{error}</Alert>
    ) : (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={surfaceSx}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add-ons
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Extra Looks and features bought from the Nexternel shop. Paste the licence key from your email and press
            Install: the add-on is downloaded and works on this server.
          </Typography>
          {!data.available ? (
            <Alert severity="info">Add-ons will be available when the Nexternel shop opens.</Alert>
          ) : (
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!key.trim()) return;
                void run("install", () => api.installAddon(key), (a) => {
                  setKey("");
                  return `Installed: ${a.map((x) => x.name).join(", ")}. Choose it in Settings → Appearance.`;
                });
              }}
            >
              <ButtonRow direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "flex-start" }} flexWrap="nowrap">
                <TextField
                  id="addon-licence-key"
                  size="small"
                  label="Licence key"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                  inputProps={{ spellCheck: false }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <Button type="submit" variant="contained" disabled={!key.trim() || busy !== null}>
                  {busy === "install" ? <CircularProgress size={20} color="inherit" /> : "Install"}
                </Button>
              </ButtonRow>
            </Box>
          )}
          {error ? (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          ) : null}
          {done && done.for !== "check" ? (
            <Alert severity={done.ok ? "success" : "warning"} sx={{ mt: 2 }} onClose={() => setDone(null)}>
              {done.text}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {data.addons.length > 0 ? (
        <Card variant="outlined" sx={surfaceSx}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="h6">Installed</Typography>
              <Button size="small" disabled={busy !== null} onClick={() => {
                  const before = data.addons;
                  void run("check", () => api.checkAddons(), (after) => describeAddonCheck(before, after));
                }}>
                {busy === "check" ? <CircularProgress size={18} /> : "Check for add-on updates"}
              </Button>
            </Stack>
            {done?.for === "check" ? (
              <Alert severity={done.ok ? "success" : "warning"} sx={{ mb: 1.5 }} onClose={() => setDone(null)}>
                {done.text}
              </Alert>
            ) : null}
            <Stack spacing={1.5}>
              {data.addons.map((a) => (
                <Paper key={a.id} variant="inset" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography fontWeight={600}>{a.name}</Typography>
                    <Chip size="small" variant="outlined" label={KIND[a.kind] ?? a.kind} />
                    <Chip size="small" color={STATUS[a.status].color} label={STATUS[a.status].label} />
                    <Box sx={{ flex: 1 }} />
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
                        if (ok) await run(`remove-${a.id}`, () => api.removeAddon(a.id));
                      }}
                    >
                      Remove
                    </Button>
                  </Stack>
                  {a.description ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {a.description}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
                    Version {a.version} · Licence {a.licenceId}
                    {a.holder ? ` · ${a.holder}` : ""} · Valid until {day(a.validUntil)} (renewed automatically) · Last
                    checked {day(a.checkedAt)}
                  </Typography>
                  {a.message && a.status !== "active" ? (
                    <Alert severity={a.status === "expired" ? "warning" : "error"} sx={{ mt: 1 }}>
                      {a.message}
                    </Alert>
                  ) : null}
                </Paper>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
              Add-ons are licensed to this server and may not be copied or shared. Server id {data.serverId.slice(0, 8)}.
            </Typography>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
