import { CODE_TEXT } from "../../../../lib/appearance/type";
import { useEffect, useState } from "react";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { api, type PluginActivity } from "../../../../api";

const ACTION_LABELS: Record<string, string> = {
  installed: "Installed",
  updated: "Updated",
  removed: "Removed",
  "switched-on": "Switched on",
  "switched-off": "Switched off",
  "permissions-changed": "Permissions changed",
  "settings-changed": "Settings changed",
  control: "Switched a device",
};

function describe(action: string, detail: Record<string, unknown>): string {
  const label = ACTION_LABELS[action] ?? action;
  if (action === "control") return `${label}: ${String(detail.action ?? "")} (${String(detail.capabilityId ?? "")})`;
  if (action === "installed" || action === "updated") return `${label}: version ${String(detail.version ?? "")}`;
  return label;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });

/** What the plugin has been doing: its own messages, and every change and control action. */
export function PluginActivityView({ pluginId }: { pluginId: string }) {
  const [data, setData] = useState<PluginActivity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .pluginActivity(pluginId)
        .then((d) => alive && setData(d))
        .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load activity"));
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pluginId]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2">Messages from the plugin</Typography>
        {data.logs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Nothing yet (messages are kept until Nexternel restarts).</Typography>
        ) : (
          <Box
            component="pre"
            sx={{
              m: 0,
              mt: 0.5,
              p: 1.5,
              maxHeight: 260,
              overflow: "auto",
              borderRadius: 1,
              bgcolor: "action.hover",
              ...CODE_TEXT,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {data.logs
              .slice(-100)
              .map((l) => `${new Date(l.t).toLocaleTimeString()}  ${l.stream === "stderr" ? "! " : ""}${l.line}`)
              .join("\n")}
          </Box>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2">History</Typography>
        {data.actions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No changes recorded.</Typography>
        ) : (
          <Stack spacing={0.25} sx={{ mt: 0.5 }}>
            {data.actions.slice(0, 20).map((a, i) => (
              <Typography key={i} variant="body2">
                <Box component="span" sx={{ color: "text.secondary", mr: 1, fontVariantNumeric: "tabular-nums" }}>
                  {when(a.at)}
                </Box>
                {describe(a.action, a.detail)}
              </Typography>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
