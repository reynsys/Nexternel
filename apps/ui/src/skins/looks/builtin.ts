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
    ...standardRoles(theme),
  };
}

/** Today's look for every other part of Nexternel (menus, cards, buttons, fields…). */
function standardRoles(theme: Theme) {
  const r = Number(theme.shape.borderRadius) || 0;
  const dark = theme.palette.mode === "dark";
  const fg = dark ? "#fff" : "#000";
  const p = theme.palette;
  return {
    ground: p.background.default,
    paper: p.background.paper,
    line: p.divider,
    font: String(theme.typography.fontFamily),
    headingCase: "none" as const,
    headingSpacing: "normal",
    radiusUnit: r,
    radiusControl: "8px",
    radiusChip: "16px",
    radiusCard: "12px",
    chromeFill: p.background.paper,
    chromeEdge: `1px solid ${alpha(fg, 0.08)}`,
    chromeShadow: "",
    cardFill: p.background.paper,
    cardBorder: `1px solid ${alpha(fg, 0.08)}`,
    cardShadow: "",
    popupFill: "",
    popupBorder: "",
    popupShadow: "",
    fieldFill: "",
    fieldBorderColour: "",
    fieldShadow: "",
    choiceFill: "transparent",
    choiceBorder: `1px solid ${p.divider}`,
    choiceShadow: "none",
    choiceSelectedFill: p.action.selected,
    choiceSelectedBorder: `1px solid ${p.primary.main}`,
    choiceSelectedShadow: "none",
    insetFill: "transparent",
    insetBorder: `1px solid ${p.divider}`,
    insetShadow: "none",
    barEdge: `1px solid ${p.divider}`,
    barGap: "4px",
    controlGap: "12px",
    decorReach: "0px",
    barInset: "0px",
    miniPanelBorder: `1px solid ${p.divider}`,
    gearFill: "",
    gearStroke: "",
    gearStrokeWidth: "",
    gearShadow: "",
    panelInset: "4px",
    titleInset: "8px",
    menuEdgeSpace: "0px",
    dividerSpace: "1px",
    barEdgeSpace: "0px",
    sectionInset: "0px",
    sectionFill: p.background.paper,
    // A section's edge reads clearly on any background (stronger than the divider lines inside it).
    sectionBorder: `1px solid ${alpha(p.text.primary, dark ? 0.28 : 0.24)}`,
    sectionShadow: dark ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
    sectionRadius: `${r * 2}px`,
    buttonShape: "none",
    buttonCase: "none" as const,
    primaryFill: "",
    primaryInk: "",
    primaryBorder: "",
    primaryShadow: "",
    secondaryFill: "",
    secondaryInk: "",
    secondaryBorder: "",
    secondaryShadow: "",
    quietInk: "",
    selectedFill: p.primary.main,
    selectedInk: p.primary.contrastText,
    selectedShadow: "",
    avatarFill: p.primary.dark,
    avatarInk: p.primary.contrastText,
    avatarBorder: "",
    brandFill: "linear-gradient(135deg, hsl(210, 98%, 60%) 0%, hsl(210, 100%, 35%) 100%)",
    brandBorder: `1px solid ${p.primary.main}`,
    brandShadow: "",
    brandRadius: "999px",
  };
}

/** Standard's shape with softer, see-through controls that glow a little when on. */
function glassTokens(theme: Theme): Partial<LookTokens> {
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
    gearFill: "rgba(255,255,255,0.5)",
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
  // Dialogs, menus and pop-ups are frosted glass too, like the panels.
  css: `:root[data-nx-look="glass"] [data-nx-role="popup"] {
  background-color: color-mix(in srgb, var(--nx-surface-paper) 72%, transparent) !important;
  backdrop-filter: blur(18px) saturate(1.25);
}`,
};

export const BUILTIN_LOOKS: UiLook[] = [standardLook, glassLook];
