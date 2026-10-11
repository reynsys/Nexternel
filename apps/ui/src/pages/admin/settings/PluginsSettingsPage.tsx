import { useMemo, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { PluginInfo } from "../../../api";
import { getWidgetContribution } from "../../../plugins/registry";
import { usePluginHost } from "../../../plugins/PluginHostContext";
import { useShellAuth } from "../../../skins/useShellAuth";
import { hasPermission } from "../../../lib/permissions";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

function contributionLabels(plugin: PluginInfo): string[] {
  const types = plugin.contributes.widgets ?? [];
  return types.map((type) => getWidgetContribution(type)?.label ?? type);
}

function sourceLabel(plugin: PluginInfo): string {
  if (plugin.builtin) return "Built-in";
  if (plugin.source === "package") return "Installed";
  return "Unknown";
}

export function PluginsSettingsPage() {
  const { plugins, loading, error, setPluginEnabled } = usePluginHost();
  const { user, isAdmin, permissions } = useShellAuth();
  const surfaceSx = useContentSurfaceSx();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = hasPermission(
    permissions,
    "manageUsers",
    Boolean(isAdmin ?? user?.role === "admin")
  );

  const sorted = useMemo(
    () => [...plugins].sort((a, b) => a.name.localeCompare(b.name)),
    [plugins]
  );

  async function toggleEnabled(plugin: PluginInfo, enabled: boolean) {
    setBusyId(plugin.id);
    setActionError(null);
    try {
      await setPluginEnabled(plugin.id, enabled);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update plugin");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Plugins are optional extensions to Nexternel itself. They are not home devices,
        areas, or systems. Core dashboard panels (Gauge, Air quality, Weather, Calendar,
        etc.) are managed separately.
      </Typography>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}

      <Card sx={surfaceSx}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Plugins
          </Typography>
          {loading && sorted.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Loading plugins…
            </Typography>
          ) : sorted.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No plugins are registered.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Plugin</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Contributes</TableCell>
                  {canManage ? <TableCell align="right">Enabled</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((plugin) => (
                  <TableRow key={plugin.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {plugin.name}
                      </Typography>
                      {plugin.description ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          {plugin.description}
                        </Typography>
                      ) : null}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {plugin.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={`v${plugin.version}`} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={sourceLabel(plugin)} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={plugin.enabled ? "success" : "default"}
                        label={plugin.enabled ? "Enabled" : "Disabled"}
                      />
                    </TableCell>
                    <TableCell>
                      {contributionLabels(plugin).length > 0 ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {contributionLabels(plugin).map((label) => (
                            <Chip key={`${plugin.id}-${label}`} size="small" label={label} />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    {canManage ? (
                      <TableCell align="right">
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={plugin.enabled}
                              disabled={busyId === plugin.id}
                              onChange={(_, checked) => void toggleEnabled(plugin, checked)}
                            />
                          }
                          label=""
                          sx={{ m: 0 }}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Alert severity="info">
        External plugin packages can be registered for future runtime loading, but this
        release only loads built-in plugin code bundled with the application. Disabling a
        plugin hides its panels from Add Panel; existing dashboard tiles show a placeholder
        instead of breaking the dashboard.
      </Alert>
    </Stack>
  );
}
