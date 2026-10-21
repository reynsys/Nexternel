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
import { SwitchStyleVisual, SwitchTileFill } from "../../components/switch-styles/SwitchStyleVisual";
import type { SemanticCapabilityView } from "./types";

type Props = {
  item: SemanticCapabilityView;
  layout?: PanelAppearanceLayout;
  showSecondary: boolean;
};

export function SemanticCapabilityTile({ item, showSecondary }: Props) {
  const theme = useTheme();
  const { showItemContext, showItemLabel, itemDisplay, switchStyle: panelSwitchStyle = "toggle" } = useDashboardTileChrome();
  // A switch's own style in this panel, else the panel's.
  const switchStyle = itemDisplay.overrides[item.source.id]?.switchStyle ?? panelSwitchStyle;
  const cap = item.source;

  const showName = showItemLabel;
  const showArea = showSecondary && showItemContext;
  const itemTitle = showName ? item.label : null;

  if (item.presentationClass === "control") {
    const switchCap = asSwitchCapability(cap);
    const { on, busy, error, toggle, setOn } = useSwitchControl(switchCap, false);
    const classic = switchStyle === "toggle";
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
            onClick={(e) => {
              // An "ON / OFF pair" sets the half that was tapped; every other style toggles.
              const half = (e.target as HTMLElement).closest("[data-set]")?.getAttribute("data-set");
              if (half) void setOn(half === "on");
              else toggle();
            }}
            disabled={busy || !cap.hasCommand}
            aria-label={classic ? undefined : `${item.label}: ${on ? "on" : "off"}`}
            aria-pressed={classic ? undefined : on}
            // The classic toggle keeps its old sizing; the new styles fit inside the tile.
            sx={{ flex: 1, minHeight: 0, p: { xs: 1, sm: 1.5 }, height: "100%", ...(classic ? {} : { boxSizing: "border-box" }) }}
          >
            {switchStyle === "tile" ? <SwitchTileFill on={on} /> : null}
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{
                flex: 1,
                position: "relative",
                minHeight: 0,
                gap: 1,
                // A half-height tile: the state and the switch side by side.
                "@container (max-height: 120px)": { flexDirection: "row", gap: 2 },
              }}
            >
              {/* The item's icon lives in its heading (or the title tile); the tile shows the state like any reading. */}
              <AdaptiveReading
                value={on ? "On" : "Off"}
                valueColor={on ? accent : muted}
                sx={{
                  "& > div": { fontSize: "clamp(1rem, min(18cqi, 40cqb), 3.75rem)" },
                  ...(on && !classic ? { textShadow: "var(--nx-text-glow, none)" } : {}),
                }}
              />
              {classic ? (
                <Switch
                  size="small"
                  checked={on}
                  disabled={busy || !cap.hasCommand}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggle()}
                  inputProps={{ "aria-label": `${item.label} switch` }}
                />
              ) : (
                <SwitchStyleVisual style={switchStyle} on={on} disabled={!cap.hasCommand} />
              )}
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
