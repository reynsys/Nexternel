import { useCallback, useSyncExternalStore } from "react";
import { Box, Tooltip } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import {
  STATUS_WORDS,
  statusReason,
  type PanelStatusLight,
  type StatusLightPosition,
  type StatusLightStyle,
  type StatusState,
} from "@nexternel/domain";
import {
  useCapabilityStatus,
  useOptionalDashboardDataRuntime,
  type CapabilityStatus,
} from "../../lib/dashboard-data-runtime";
import { useOptionalSkin } from "../../skins/SkinProvider";
import { lightToShow } from "../../lib/status-light-show";
import {
  DEFAULT_STATUS_LIGHT_PREFS,
  normalizeStatusLightPrefs,
  type StatusLightPrefs,
} from "../../skins/themePrefs";

const STALE_COLOUR = "#5B6474";
const DOT_OFF = "rgba(128, 138, 156, 0.28)";

const pulse = keyframes`50% { opacity: .3; }`;

/** The look a panel's lights use: the panel's own choice (Edit menu → Status light), else the starting look. */
export type StatusLook = {
  style: StatusLightStyle;
  position: StatusLightPosition;
  blink: boolean;
  colours: { ok: string; watch: string; alert: string };
};

/** The starting look for panels that have not chosen (saved person settings from before V5.2.100, else the defaults). */
export function useStatusLightPrefs(): StatusLightPrefs {
  const skin = useOptionalSkin();
  return normalizeStatusLightPrefs(skin?.themePrefs.statusLight ?? DEFAULT_STATUS_LIGHT_PREFS);
}

export function resolveStatusLook(panel: PanelStatusLight | null | undefined, prefs: StatusLightPrefs): StatusLook {
  return {
    style: !panel || panel.style === "default" ? prefs.style : panel.style,
    position: !panel || panel.position === "default" ? prefs.position : panel.position,
    blink: !panel || panel.blink === "default" ? prefs.blink : panel.blink,
    colours: panel?.colours ?? prefs.colours,
  };
}

export function statusColour(state: StatusState, look: StatusLook): string {
  return state === "stale" ? STALE_COLOUR : look.colours[state];
}

/** The reading's live value, for the tooltip. */
function useLiveValue(capabilityId: string): unknown {
  const runtime = useOptionalDashboardDataRuntime();
  const subscribe = useCallback(
    (listener: () => void) => (runtime ? runtime.capabilities.subscribe([capabilityId], listener) : () => undefined),
    [runtime, capabilityId]
  );
  const get = useCallback(() => runtime?.capabilities.get(capabilityId)?.value, [runtime, capabilityId]);
  return useSyncExternalStore(subscribe, get, get);
}

/** "28.4 °C, above 27 °C: act now" */
export function statusTooltip(status: CapabilityStatus, value: unknown, unit: string | null | undefined): string {
  if (!status.state) return "";
  if (status.state === "stale") return "No recent reading";
  const v = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(v) || !status.settings) return STATUS_WORDS[status.state];
  const shown = `${Math.round(v * 10) / 10}${unit ? ` ${unit}` : ""}`;
  if (status.state === "ok") return `${shown}: normal`;
  return `${shown}, ${statusReason(v, status.settings.limits, status.state, unit)}: ${STATUS_WORDS[status.state]}`;
}

type Props = {
  capabilityId: string | null | undefined;
  /** The kind of reading (temperature, power, switch…): decides whether it can have a light. */
  kind: string | null | undefined;
  unit?: string | null;
  look: StatusLook;
  /**
   * Where it sits. "inline" = in a title row; "under-title" = bar along the title's bottom edge;
   * "in-tile" = bottom centre (pill, dots) or bottom edge (bar) of the reading tile;
   * "frame" = glowing border around the nearest positioned box; "gap-bar" = bar in the gap
   * between a panel's title tile and its reading tile (takes no space of its own).
   */
  placement: "inline" | "under-title" | "in-tile" | "frame" | "gap-bar";
};

/**
 * One reading's status light. Draws nothing for readings without a light (no limits set,
 * switched off) and outside a dashboard.
 */
export function StatusLight({ capabilityId, kind, unit, look, placement }: Props) {
  const status = useCapabilityStatus(capabilityId);
  const value = useLiveValue(capabilityId ?? "");
  const shown = capabilityId ? lightToShow(status, kind, value) : null;
  if (!shown || look.style === "off") return null;
  if (shown === "unset") return <UnsetLight look={look} placement={placement} />;
  const state = shown;
  const colour = statusColour(state, look);
  const blinkSx =
    look.blink && state === "alert"
      ? { animation: `${pulse} 1.4s ease-in-out infinite`, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }
      : {};
  const label = state === "stale" || !status ? "No recent reading" : statusTooltip(status, value, unit);
  const centred = placement === "in-tile" ? ({ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", zIndex: 2 } as const) : {};

  const common = { role: "img", "aria-label": label, "data-nx-status-light": state };
  let node;
  if (look.style === "pill") {
    node = (
      <Box
        {...common}
        sx={{
          // Narrower on phones, where panel titles have little room.
          width: placement === "inline" ? { xs: 32, sm: 46 } : 46,
          height: 16,
          borderRadius: "8px",
          flex: "none",
          bgcolor: colour,
          boxShadow: `0 0 10px -2px ${colour}`,
          ...centred,
          ...blinkSx,
        }}
      />
    );
  } else if (look.style === "dots") {
    const lit = (s: StatusState) => state === "stale" || state === s;
    node = (
      <Box {...common} sx={{ display: "flex", gap: "6px", alignItems: "center", flex: "none", ...centred, ...blinkSx }}>
        {(["ok", "watch", "alert"] as const).map((s) => (
          <Box
            key={s}
            sx={{
              width: 15,
              height: 15,
              borderRadius: "50%",
              bgcolor: lit(s) ? (state === "stale" ? STALE_COLOUR : look.colours[s]) : DOT_OFF,
              boxShadow: lit(s) && state !== "stale" ? `0 0 8px ${look.colours[s]}` : "none",
            }}
          />
        ))}
      </Box>
    );
  } else if (look.style === "bar") {
    const edge =
      placement === "under-title"
        ? ({ position: "absolute", left: 10, right: 10, bottom: 3 } as const)
        : placement === "in-tile"
          ? ({ position: "absolute", left: 12, right: 12, bottom: 9, zIndex: 2 } as const)
          : placement === "gap-bar"
            ? // Sits in the 6px gap: 4px tall, pulled up and down so the layout does not move.
              { mx: "10px", my: "-5px", flexShrink: 0 }
            : { width: 46, flex: "none" };
    const height = placement === "gap-bar" ? 4 : 5;
    node = <Box {...common} sx={{ height, borderRadius: "5px", bgcolor: colour, ...edge, ...blinkSx }} />;
  } else {
    // Glowing border: covers the box it sits in, so the reading inside stays clickable.
    return (
      <Box
        {...common}
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          zIndex: 1,
          boxShadow: `inset 0 0 0 2px ${colour}, 0 0 16px -4px ${colour}`,
          ...blinkSx,
        }}
      />
    );
  }

  return (
    <Tooltip title={label} placement="top" arrow>
      {node}
    </Tooltip>
  );
}

const UNSET_LABEL = "No limits set yet. Open Edit → Status light to set them.";
const UNSET_LINE = "rgba(141, 151, 168, 0.75)";

/**
 * The empty "not set up" light: same shape and place as a real one, outline only, for a reading
 * that could have a light but has no limits yet. It never blinks.
 */
function UnsetLight({ look, placement }: { look: StatusLook; placement: Props["placement"] }) {
  const common = { role: "img", "aria-label": UNSET_LABEL, "data-nx-status-light": "unset" };
  const centred = placement === "in-tile" ? ({ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", zIndex: 2 } as const) : {};
  const outline = `1.5px solid ${UNSET_LINE}`;
  let node;
  if (look.style === "glow") {
    return (
      <Box
        {...common}
        sx={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", zIndex: 1, border: `1px dashed ${UNSET_LINE}` }}
      />
    );
  } else if (look.style === "dots") {
    node = (
      <Box {...common} sx={{ display: "flex", gap: "6px", alignItems: "center", flex: "none", ...centred }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ width: 15, height: 15, borderRadius: "50%", boxSizing: "border-box", border: outline }} />
        ))}
      </Box>
    );
  } else if (look.style === "bar") {
    const edge =
      placement === "under-title"
        ? ({ position: "absolute", left: 10, right: 10, bottom: 3 } as const)
        : placement === "in-tile"
          ? ({ position: "absolute", left: 12, right: 12, bottom: 9, zIndex: 2 } as const)
          : placement === "gap-bar"
            ? { mx: "10px", my: "-5px", flexShrink: 0 }
            : { width: 46, flex: "none" };
    node = (
      <Box {...common} sx={{ height: placement === "gap-bar" ? 4 : 5, boxSizing: "border-box", borderRadius: "5px", border: `1px solid ${UNSET_LINE}`, ...edge }} />
    );
  } else {
    node = (
      <Box
        {...common}
        sx={{
          width: placement === "inline" ? { xs: 32, sm: 46 } : 46,
          height: 16,
          boxSizing: "border-box",
          borderRadius: "8px",
          flex: "none",
          border: outline,
          ...centred,
        }}
      />
    );
  }
  return (
    <Tooltip title={UNSET_LABEL} placement="top" arrow>
      {node}
    </Tooltip>
  );
}

/** Which placement a light gets for a box, given the look. */
export function lightPlacement(
  look: StatusLook,
  where: "title" | "reading"
): Props["placement"] | null {
  if (look.style === "off") return null;
  if (look.style === "glow") return look.position === where ? "frame" : null;
  if (look.position !== where) return null;
  if (where === "reading") return "in-tile";
  return look.style === "bar" ? "under-title" : "inline";
}
