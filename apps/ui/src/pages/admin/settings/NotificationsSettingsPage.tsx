import { useEffect, useState } from "react";
import { Alert, Card, CardContent, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from "@mui/material";
import { api, type BellTopics, type PluginInfo } from "../../../api";
import { BellFields } from "../../../components/BellFields";
import { useSkin } from "../../../skins/SkinProvider";
import { useShellAuth } from "../../../skins/useShellAuth";
import { hasPermission } from "../../../lib/permissions";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

/** Nexternel's own kinds of message, in the order shown. */
const TOPICS: { key: keyof BellTopics; label: string; text: string }[] = [
  { key: "readings", label: "Readings at act now", text: "A reading's status light stayed red (and when it is back to normal)." },
  { key: "devices", label: "Devices going offline", text: "A device says it went offline, and when it is back." },
  { key: "mqtt", label: "Device messages stopped", text: "Readings and switches stopped updating for 5 minutes." },
  { key: "disk", label: "Disk getting full", text: "Less than 10 % (or 2 GB) free on the server." },
  { key: "backup", label: "Automatic backup failed", text: "The nightly backup could not be made." },
  { key: "updates", label: "New Nexternel version", text: "A newer version is ready to install." },
];

/**
 * Settings → Notifications: your own bell (when it shows, where it sits), and for administrators
 * which messages reach everyone's bell — Nexternel's own kinds and each extension's.
 */
export function NotificationsSettingsPage() {
  const surfaceSx = useContentSurfaceSx();
  const { themePrefs, setThemePrefs } = useSkin();
  const { isAdmin, permissions } = useShellAuth();
  const canManage = hasPermission(permissions, "manageUsers", Boolean(isAdmin));
  const [topics, setTopics] = useState<BellTopics | null>(null);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    void api.bellTopics().then((r) => setTopics(r.topics)).catch((err) => setError(err instanceof Error ? err.message : "Could not load"));
    void api.plugins().then((r) => setPlugins(r.plugins.filter((p) => p.permissions.notify))).catch(() => {});
  }, [canManage]);

  async function setTopic(key: keyof BellTopics, on: boolean) {
    setError(null);
    try {
      setTopics((await api.setBellTopics({ [key]: on })).topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function setPluginBell(id: string, bell: "all" | "important" | "none") {
    setError(null);
    try {
      const { plugin } = await api.setPluginBell(id, bell);
      setPlugins((list) => list.map((p) => (p.id === id ? { ...p, bell: plugin.bell } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Stack spacing={2}>
      <Card sx={surfaceSx}>
        <CardContent>
          <Typography variant="h6">Your bell</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Its number has the colour of the most important new message: your main colour for information, amber for keep an eye on it, red for act now.
            Saved to your account.
          </Typography>
          <BellFields value={themePrefs.bell} onChange={(bell) => setThemePrefs((prev) => ({ ...prev, bell }))} />
        </CardContent>
      </Card>

      {canManage ? (
        <Card sx={surfaceSx}>
          <CardContent>
            <Typography variant="h6">What reaches the bell</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              For everyone on this Nexternel. Saved straight away.
            </Typography>
            {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              From Nexternel
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 2 }}>
              {TOPICS.map((t) => (
                <FormControlLabel
                  key={t.key}
                  control={<Switch checked={topics?.[t.key] ?? true} disabled={!topics} onChange={(e) => void setTopic(t.key, e.target.checked)} />}
                  label={
                    <span>
                      <Typography variant="body2" component="span" fontWeight="fontWeightBold">
                        {t.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t.text}
                      </Typography>
                    </span>
                  }
                />
              ))}
            </Stack>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              From extensions
            </Typography>
            {plugins.length ? (
              <Stack spacing={1.5}>
                {plugins.map((p) => (
                  <FormControl key={p.id} size="small" fullWidth>
                    <InputLabel id={`bell-topic-${p.id}`}>{p.name}</InputLabel>
                    <Select
                      labelId={`bell-topic-${p.id}`}
                      label={p.name}
                      value={p.bell ?? "important"}
                      onChange={(e) => void setPluginBell(p.id, e.target.value as "all" | "important" | "none")}
                    >
                      <MenuItem value="important">Only important ones (keep an eye on it)</MenuItem>
                      <MenuItem value="all">All, including information such as summaries</MenuItem>
                      <MenuItem value="none">None</MenuItem>
                    </Select>
                  </FormControl>
                ))}
                <Typography variant="caption" color="text.secondary">
                  An extension's messages are never red: red is kept for Nexternel itself.
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No installed extension sends messages.
              </Typography>
            )}
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
