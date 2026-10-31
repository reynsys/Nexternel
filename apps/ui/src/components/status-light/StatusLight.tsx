import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { useLook } from "../../skins/looks/useLook";
import {
  DEFAULT_STATUS_LIGHT_PREFS,
  normalizeStatusLightPrefs,
  type StatusLightPrefs,
} from "../../skins/themePrefs";

const STALE_COLOUR = "#5B6474";
const DOT_OFF = "rgba(128, 138, 156, 0.28)";

/**
 * Act now: a quick double flash, like an emergency beacon, once a second. Sharp steps (not a slow
 * fade) so it catches the eye from across the room; it never goes fully dark, so the colour stays readable.
 */
const actNowFlash = keyframes`
  0%, 12% { opacity: 1; }
  12.01%, 24% { opacity: .2; }
  24.01%, 36% { opacity: 1; }
  36.01%, 100% { opacity: .2; }
`;

/** In a narrow panel title (see the title tile's container), lights take less room. */
const COMPACT = { "@container nx-title (max-width: 230px)": { width: 16 } } as const;
const COMPACT_DOTS = { "@container nx-title (max-width: 230px)": { gap: "3px", "& > *": { width: 11, height: 11 } } } as const;

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
  /** For "frame": whether the box is the whole panel (follows the Look's panel outline) or a box inside it. */
  edge?: "panel" | "box";
};

/**
 * One reading's status light. Draws nothing for readings without a light (no limits set,
 * switched off) and outside a dashboard.
 */
export function StatusLight({ capabilityId, kind, unit, look, placement, edge = "box" }: Props) {
  const status = useCapabilityStatus(capabilityId);
  const value = useLiveValue(capabilityId ?? "");
  const shown = capabilityId ? lightToShow(status, kind, value) : null;
  if (!shown || look.style === "off") return null;
  if (shown === "unset") return <UnsetLight look={look} placement={placement} edge={edge} />;
  const state = shown;
  const colour = statusColour(state, look);
  const blinkSx =
    look.blink && state === "alert"
      ? { animation: `${actNowFlash} 1s step-end infinite`, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }
      : {};
  const label = state === "stale" || !status ? "No recent reading" : statusTooltip(status, value, unit);
  const centred = placement === "in-tile" ? ({ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", zIndex: 2 } as const) : {};

  const common = { role: "img", "aria-label": label, "data-nx-status-light": state };
  let node;
  if (look.style === "pill") {
    // Outer part glows, inner part has the shape (a Look may give it its own, e.g. cut corners).
    node = (
      <Box
        {...common}
        data-nx-status-style="pill"
        sx={{
          // Narrower on phones, and a small square in narrow panels, where titles have little room.
          width: placement === "inline" ? { xs: 32, sm: 46 } : 46,
          height: 16,
          display: "flex",
          flex: "none",
          filter: `drop-shadow(0 0 4px ${colour})`,
          ...COMPACT,
          ...centred,
          ...blinkSx,
        }}
      >
        <Box data-nx-status-shape sx={{ flex: 1, borderRadius: "8px", bgcolor: colour }} />
      </Box>
    );
  } else if (look.style === "dots") {
    const lit = (s: StatusState) => state === "stale" || state === s;
    node = (
      <Box
        {...common}
        data-nx-status-style="dots"
        sx={{ display: "flex", gap: "6px", alignItems: "center", flex: "none", ...COMPACT_DOTS, ...centred, ...blinkSx }}
      >
        {(["ok", "watch", "alert"] as const).map((s, i) => (
          <Box
            key={s}
            data-nx-dot={i + 1}
            sx={{
              width: 15,
              height: 15,
              display: "flex",
              filter: lit(s) && state !== "stale" ? `drop-shadow(0 0 4px ${look.colours[s]})` : "none",
            }}
          >
            <Box
              data-nx-status-shape
              sx={{ flex: 1, borderRadius: "50%", bgcolor: lit(s) ? (state === "stale" ? STALE_COLOUR : look.colours[s]) : DOT_OFF }}
            />
          </Box>
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
    // Glowing border: covers the box it sits in, so the reading inside stays clickable. A Look with
    // its own panel outline (e.g. HUD cut corners) gets a border that follows that outline.
    return <GlowBorder common={common} colour={colour} blinkSx={blinkSx} edge={edge} />;
  }

  return (
    <Tooltip title={label} placement="top" arrow>
      {node}
    </Tooltip>
  );
}

function GlowBorder({
  common,
  colour,
  blinkSx,
  edge,
  unset = false,
}: {
  common: Record<string, string>;
  colour: string;
  blinkSx: object;
  edge: "panel" | "box";
  /** "No limits yet": a thin dashed line in the same place, no glow. */
  unset?: boolean;
}) {
  const look = useLook();
  // The whole panel follows the Look's panel outline; a box inside it follows the Look's box outline.
  const outline = edge === "panel" ? look.panelOutline : look.boxOutline;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !outline) return undefined;
    const measure = () => setSize([el.clientWidth, el.clientHeight]);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [outline]);
  if (outline) {
    const [w, h] = size;
    return (
      <Box
        ref={ref}
        {...common}
        data-nx-status-style="glow"
        sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, ...blinkSx }}
      >
        {w > 0 && h > 0 ? (
          // The glow is on the drawing as a whole (not the line), so it is never cut off in a rectangle.
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${w} ${h}`}
            style={{
              position: "absolute",
              inset: 0,
              overflow: "visible",
              filter: unset ? "none" : `drop-shadow(0 0 4px ${colour})`,
            }}
            aria-hidden
          >
            <path
              d={outline(w, h)}
              fill="none"
              stroke={colour}
              strokeWidth={unset ? 1.5 : 2}
              strokeDasharray={unset ? "5 4" : undefined}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
      </Box>
    );
  }
  return <PlainGlowBorder common={common} colour={colour} blinkSx={blinkSx} unset={unset} />;
}

/**
 * Glowing border on a plain rounded box: a band drawn just inside the box's edge, with the box's inner
 * corner rounding. (The box clips what is drawn on its own edge line; a panel colours that line itself
 * while its light is lit — useGlowEdgeSx — so band and edge read as one, with no grey rim.)
 */
function PlainGlowBorder({
  common,
  colour,
  blinkSx,
  unset,
}: {
  common: Record<string, string>;
  colour: string;
  blinkSx: object;
  unset: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [radius, setRadius] = useState<string>("inherit");
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const cs = getComputedStyle(host);
    const inner = Math.max(0, parseFloat(cs.borderTopLeftRadius) - parseFloat(cs.borderTopWidth));
    if (Number.isFinite(inner)) setRadius(`${inner}px`);
  }, []);
  return (
    <Box
      ref={ref}
      {...common}
      data-nx-status-style="glow"
      sx={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        pointerEvents: "none",
        zIndex: 1,
        ...(unset
          ? { border: `1.5px dashed ${colour}` }
          : { border: `3px solid ${colour}`, boxShadow: `inset 0 0 12px -2px ${colour}` }),
        ...blinkSx,
      }}
    />
  );
}

const UNSET_LABEL = "No limits set yet. Open Edit → Status light to set them.";
const UNSET_LINE = "rgba(141, 151, 168, 0.75)";
// Same parts as a real light (so a Look's shapes apply); an outline drawn inside the shape.
const UNSET_FILL = "rgba(141, 151, 168, 0.12)";
const UNSET_EDGE = `inset 0 0 0 1.5px ${UNSET_LINE}`;

/**
 * The empty "not set up" light: same shape and place as a real one, outline only, for a reading
 * that could have a light but has no limits yet. It never blinks.
 */
function UnsetLight({ look, placement, edge }: { look: StatusLook; placement: Props["placement"]; edge: "panel" | "box" }) {
  const common = { role: "img", "aria-label": UNSET_LABEL, "data-nx-status-light": "unset" };
  const centred = placement === "in-tile" ? ({ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", zIndex: 2 } as const) : {};
  let node;
  if (look.style === "glow") {
    return <GlowBorder common={common} colour={UNSET_LINE} blinkSx={{}} edge={edge} unset />;
  } else if (look.style === "dots") {
    node = (
      <Box {...common} data-nx-status-style="dots" sx={{ display: "flex", gap: "6px", alignItems: "center", flex: "none", ...COMPACT_DOTS, ...centred }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} data-nx-dot={i + 1} sx={{ width: 15, height: 15, display: "flex" }}>
            <Box data-nx-status-shape sx={{ flex: 1, borderRadius: "50%", bgcolor: UNSET_FILL, boxShadow: UNSET_EDGE }} />
          </Box>
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
        data-nx-status-style="pill"
        sx={{ width: placement === "inline" ? { xs: 32, sm: 46 } : 46, height: 16, display: "flex", flex: "none", ...COMPACT, ...centred }}
      >
        <Box data-nx-status-shape sx={{ flex: 1, borderRadius: "8px", bgcolor: UNSET_FILL, boxShadow: UNSET_EDGE }} />
      </Box>
    );
  }
  return (
    <Tooltip title={UNSET_LABEL} placement="top" arrow>
      {node}
    </Tooltip>
  );
}

/**
 * The edge line of a plain panel whose glowing border is lit takes the status colour, so band and edge
 * read as one. A Look that draws its own frame (e.g. HUD) keeps its frame as it is: the glowing line
 * follows the frame's outline (GlowBorder), and nothing else of the frame changes colour.
 * Empty when there is nothing lit to show.
 */
export function useGlowEdgeSx(
  capabilityId: string | null | undefined,
  kind: string | null | undefined,
  look: StatusLook,
  active: boolean
): Record<string, string> {
  const status = useCapabilityStatus(capabilityId ?? undefined);
  const value = useLiveValue(capabilityId ?? "");
  const ownFrame = Boolean(useLook().panelOutline);
  if (!active || !capabilityId || look.style !== "glow" || ownFrame) return {};
  const shown = lightToShow(status, kind, value);
  if (!shown || shown === "unset") return {};
  return { borderColor: statusColour(shown, look) };
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
