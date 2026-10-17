import { alpha, type Theme } from "@mui/material/styles";
import { GLASS_LOOK_ID, STANDARD_LOOK_ID } from "../../lib/look-choice";
import type { LookTokens, UiLook } from "./types";

/** Today's panel shape: the values the dashboard used before Looks existed. */
function standardTokens(theme: Theme): LookTokens {
  const r = Number(theme.shape.borderRadius) || 0;
  const dark = theme.palette.mode === "dark";
  const accent = theme.palette.primary.main;
  return {
    panelRadius: `${r * 2}px`,
    panelBorder: `1px solid ${theme.palette.divider}`,
    panelShadow: "none",
    mainTileRadius: `${r * 1.5}px`,
    tileRadius: `${r * 2}px`,
    miniPanelRadius: "12px",
    controlRadius: `${r}px`,
    pillRadius: "999px",
    controlSurface: alpha(theme.palette.text.primary, dark ? 0.1 : 0.08),
    controlRaise: `0 1px 2px rgba(0,0,0,${dark ? 0.45 : 0.2})`,
    controlPress: `inset 0 1px 3px rgba(0,0,0,${dark ? 0.45 : 0.22})`,
    knob: "#ffffff",
    knobShadow: "0 1px 3px rgba(0,0,0,0.4)",
    trackOn: accent,
    accentInk: theme.palette.primary.contrastText,
    accentSoft: alpha(accent, 0.16),
    chip: alpha(theme.palette.text.primary, 0.12),
    glow: "0 0 0 transparent",
    textGlow: "none",
  };
}

/** Standard's shape with softer, see-through controls that glow a little when on. */
function glassTokens(theme: Theme): LookTokens {
  const accent = theme.palette.primary.main;
  return {
    ...standardTokens(theme),
    controlRadius: "14px",
    controlSurface: "rgba(255,255,255,0.12)",
    controlRaise: "inset 0 1px 0 rgba(255,255,255,0.28)",
    controlPress: "inset 0 2px 6px rgba(0,0,0,0.28)",
    knob: "rgba(255,255,255,0.96)",
    knobShadow: "0 2px 8px rgba(0,0,0,0.25)",
    accentSoft: alpha(accent, 0.2),
    chip: "rgba(255,255,255,0.24)",
    glow: `0 0 18px ${alpha(accent, 0.5)}`,
    textGlow: `0 0 14px ${alpha(accent, 0.45)}`,
  };
}

export const standardLook: UiLook = {
  id: STANDARD_LOOK_ID,
  label: "Standard",
  description: "Clean and flat. Solid panels.",
  frosted: false,
  tokens: standardTokens,
};

export const glassLook: UiLook = {
  id: GLASS_LOOK_ID,
  label: "Glass",
  description: "Frosted see-through panels over a colourful background.",
  frosted: true,
  defaultBackground: "glow-aurora",
  tokens: glassTokens,
};

export const BUILTIN_LOOKS: UiLook[] = [standardLook, glassLook];
