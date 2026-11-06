import { Link as RouterLink } from "react-router-dom";
import { Button, Stack, Typography } from "@mui/material";
import { api } from "../api";
import { PluginSettingsForm } from "../pages/admin/settings/plugins/PluginSettingsForm";
import { usePluginHost } from "./PluginHostContext";

/**
 * An extension's settings on its own page. An extension with a page keeps its settings there, and
 * Settings → Extensions only links to them, so they are never split between two places.
 */
export function PluginPageSettings({ pluginId, onSaved }: { pluginId: string; onSaved?: () => void }) {
  const { plugins, refresh } = usePluginHost();
  const plugin = plugins.find((p) => p.id === pluginId);
  if (!plugin) return null;
  return (
    <PluginSettingsForm
      plugin={plugin}
      onSave={async (values) => {
        await api.savePluginSettings(plugin.id, values);
        await refresh();
        onSaved?.();
      }}
    />
  );
}

/** Which of an extension's messages reach the bell is chosen with everything else's, in one place. */
export function PluginBellLink() {
  return (
    <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
      <Typography variant="body2" color="text.secondary">
        The bell shows messages from all of Nexternel, so its choices are kept together on one page.
      </Typography>
      <Button variant="outlined" size="small" component={RouterLink} to="/admin/settings/notifications">
        Choose what reaches the bell
      </Button>
    </Stack>
  );
}
