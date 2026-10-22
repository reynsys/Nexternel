import { Stack, Typography } from "@mui/material";

type Props = {
  pluginName?: string;
  pluginId?: string;
  reason?: "disabled" | "missing" | "error";
};

export function PluginUnavailable({ pluginName, pluginId, reason = "missing" }: Props) {
  const label = pluginName?.trim() || pluginId?.trim() || "Plugin";
  const detail =
    reason === "disabled"
      ? "This plugin is installed but disabled."
      : reason === "error"
        ? "This plugin failed to render."
        : "This plugin is not available.";

  return (
    <Stack
      height="100%"
      justifyContent="center"
      alignItems="center"
      sx={{ px: 2, textAlign: "center" }}
    >
      <Typography variant="body2" fontWeight="fontWeightBold" gutterBottom>
        Plugin unavailable
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        {detail}
      </Typography>
    </Stack>
  );
}
