import {
  Box,
  CardActionArea,
  Stack,
  Switch,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { AdaptiveReading } from "../../components/AdaptiveReading";
import type { PanelAppearanceLayout } from "../../lib/panel-appearance";
import { useSwitchControl } from "../../widgets/switch/useSwitchControl";
import { useDashboardTileChrome } from "../../lib/dashboard-tile-context";
import { PanelItemChrome } from "../PanelItemChrome";
import { asSwitchCapability } from "../panel-capabilities";
import { PanelReadingValue } from "../PanelReadingValue";
import type { SemanticCapabilityView } from "./types";

type Props = {
  item: SemanticCapabilityView;
  layout?: PanelAppearanceLayout;
  showSecondary: boolean;
};

export function SemanticCapabilityTile({ item, showSecondary }: Props) {
  const theme = useTheme();
  const { showItemContext, showItemLabel } = useDashboardTileChrome();
  const cap = item.source;

  const showName = showItemLabel;
  const showArea = showSecondary && showItemContext;
  const itemTitle = showName ? item.label : null;

  if (item.presentationClass === "control") {
    const switchCap = asSwitchCapability(cap);
    const { on, busy, error, toggle } = useSwitchControl(switchCap, false);
    const accent = theme.palette.primary.main;
    const muted = alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.38 : 0.42);

    return (
      <Box sx={{ height: "100%", minHeight: 0, minWidth: 0 }} role="group" aria-label={item.label}>
        <PanelItemChrome
          cap={cap}
          title={itemTitle}
          showContext={showArea}
          contentSx={{ p: 0, flex: 1, containerType: "size" }}
        >
          <CardActionArea
            onClick={() => toggle()}
            disabled={busy || !cap.hasCommand}
            sx={{ flex: 1, minHeight: 0, p: 1.5, height: "100%" }}
          >
            <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
              {/* The item's icon lives in its heading (or the title tile); the tile shows the state like any reading. */}
              <AdaptiveReading
                value={on ? "On" : "Off"}
                valueColor={on ? accent : muted}
                sx={{ "& > div": { fontSize: "clamp(1.25rem, 18cqi, 3.75rem)" } }}
              />
              <Switch
                size="small"
                checked={on}
                disabled={busy || !cap.hasCommand}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggle()}
                inputProps={{ "aria-label": `${item.label} switch` }}
              />
              {error && (
                <Typography variant="caption" color="error" textAlign="center">
                  {error}
                </Typography>
              )}
            </Stack>
          </CardActionArea>
        </PanelItemChrome>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", minHeight: 0, minWidth: 0 }} role="group" aria-label={item.label}>
      <PanelItemChrome
        cap={cap}
        title={itemTitle}
        showContext={showArea}
        contentSx={{
          alignItems: "center",
          justifyContent: "center",
          px: 1,
          containerType: "size",
        }}
      >
        {item.presentationClass === "reading" || item.presentationClass === "enum" || item.presentationClass === "binary" ? (
          <PanelReadingValue cap={cap} />
        ) : (
          <Typography variant="body2" textAlign="center" sx={{ wordBreak: "break-word" }}>
            {item.value}
            {item.unit ? ` ${item.unit}` : ""}
          </Typography>
        )}
      </PanelItemChrome>
    </Box>
  );
}
