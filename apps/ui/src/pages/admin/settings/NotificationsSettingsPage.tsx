import { isPhoneScreen } from "../../../lib/phone-screen";
import { Fragment, useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from "@mui/material";
import { api, type BellTopics, type PluginInfo } from "../../../api";
import { BellFields } from "../../../components/BellFields";
import { useSkin } from "../../../skins/SkinProvider";
import { useShellAuth } from "../../../skins/useShellAuth";
import { hasPermission } from "../../../lib/permissions";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

/** Nexternel's own kinds of message, in the order shown. */
const TOPICS: { key: keyof BellTopics; label: string }[] = [
  { key: "readings", label: 'Readings at "Act now"' },
  { key: "devices", label: "Devices going offline" },
  { key: "mqtt", label: "Device messages stopped" },
  { key: "disk", label: "Disk getting full" },
  { key: "backup", label: "Automatic backup failed" },
  { key: "updates", label: "New Nexternel version" },
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
  const [offlineMinutes, setOfflineMinutes] = useState(5);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    void api
      .bellTopics()
      .then((r) => {
        setTopics(r.topics);
        setOfflineMinutes(r.offlineMinutes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load"));
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

  async function saveOfflineMinutes(minutes: number) {
    setError(null);
    try {
      setOfflineMinutes((await api.setBellTopics({}, minutes)).offlineMinutes);
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
          <BellFields value={themePrefs.bell} showPlace={!isPhoneScreen()} onChange={(bell) => setThemePrefs((prev) => ({ ...prev, bell }))} />
        </CardContent>
      </Card>

      {canManage ? (
        <Card sx={surfaceSx}>
          <CardContent>
            <Typography variant="h6">What reaches the bell</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              For everyone on this Nexternel.
            </Typography>
            {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              From Nexternel
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 2 }}>
              {TOPICS.map((t) => (
                <Fragment key={t.key}>
                <FormControlLabel
                  control={<Switch checked={topics?.[t.key] ?? true} disabled={!topics} onChange={(e) => void setTopic(t.key, e.target.checked)} />}
                  label={
                    <Typography variant="body2" component="span" fontWeight="fontWeightBold">
                      {t.label}
                    </Typography>
                  }
                />
                {t.key === "devices" ? (
                  // In its own box: the list around it resets margins, which squeezed it against the text above.
                  <Box sx={{ pl: 7, pt: 1.5, pb: 0.5 }}>
                  <FormControl size="small" fullWidth sx={{ maxWidth: 420 }} disabled={!topics?.devices}>
                    <InputLabel id="bell-offline-minutes">Report a device after</InputLabel>
                    <Select
                      labelId="bell-offline-minutes"
                      label="Report a device after"
                      value={offlineMinutes}
                      onChange={(e) => void saveOfflineMinutes(Number(e.target.value))}
                    >
                      {[1, 5, 15, 30, 60].map((m) => (
                        <MenuItem key={m} value={m}>
                          {m === 60 ? "1 hour" : `${m} minute${m === 1 ? "" : "s"}`} offline
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  </Box>
                ) : null}
                </Fragment>
              ))}
            </Stack>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              From extensions
            </Typography>
            {plugins.length ? (
              <Stack spacing={1.5}>
                {plugins.map((p) => (
                  <FormControl key={p.id} size="small" fullWidth sx={{ maxWidth: 420 }}>
                    <InputLabel id={`bell-topic-${p.id}`}>{p.name}</InputLabel>
                    <Select
                      labelId={`bell-topic-${p.id}`}
                      label={p.name}
                      value={p.bell ?? "important"}
                      onChange={(e) => void setPluginBell(p.id, e.target.value as "all" | "important" | "none")}
                    >
                      <MenuItem value="important">Only important ones</MenuItem>
                      <MenuItem value="all">All, including information such as summaries</MenuItem>
                      <MenuItem value="none">None</MenuItem>
                    </Select>
                  </FormControl>
                ))}
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
