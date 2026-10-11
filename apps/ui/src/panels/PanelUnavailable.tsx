import { Stack, Typography } from "@mui/material";
import { panelDisplayName } from "../lib/panel-display-name";
import type { PanelAvailability } from "./registry";

type Props = {
  panelType: string;
  availability: PanelAvailability;
  pluginName?: string | null;
  configErrors?: string[];
};

function messageFor(
  availability: PanelAvailability,
  displayName: string,
  pluginName?: string | null
): string {
  switch (availability) {
    case "unknown":
      return `${displayName} is not recognised. Your configuration is preserved.`;
    case "plugin_missing":
      return pluginName
        ? `${pluginName} is not available.`
        : `This extension panel is not installed.`;
    case "plugin_disabled":
      return pluginName
        ? `${pluginName} is disabled.`
        : `This extension panel is disabled.`;
    case "unsupported_config":
      return `${displayName} could not be displayed.`;
    case "unsupported_legacy":
      return `${displayName} is not supported on this version.`;
    default:
      return `${displayName} is unavailable.`;
  }
}

function userFacingDetail(errors: string[]): string | null {
  const detail = errors[0]?.trim();
  if (!detail) return null;
  if (/^panel\./.test(detail) || detail.includes("schema version")) {
    return "Try editing this panel or contact your administrator.";
  }
  return detail;
}

export function PanelUnavailable({
  panelType,
  availability,
  pluginName,
  configErrors = [],
}: Props) {
  const displayName = panelDisplayName(panelType);
  const detail = userFacingDetail(configErrors);

  return (
    <Stack height="100%" justifyContent="center" sx={{ px: 1 }} spacing={0.5}>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {messageFor(availability, displayName, pluginName)}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.disabled" textAlign="center">
          {detail}
        </Typography>
      )}
    </Stack>
  );
}
