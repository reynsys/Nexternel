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
