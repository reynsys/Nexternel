import type { Theme } from "@mui/material/styles";
import type { ComponentType } from "react";

/**
 * What a Look decides about the dashboard's shape. Panels, tiles and controls read these as
 * CSS variables (AppearanceCssVars), never their own fixed values, so a new Look restyles
 * every part at once and nothing is rebuilt per Look.
 */
export type LookTokens = {
  /** Outer corner of a panel. */
  panelRadius: string;
  panelBorder: string;
  /** Shadow under a panel (not while arranging the dashboard). */
  panelShadow: string;
  /** Corner of the main tile area inside a panel. */
  mainTileRadius: string;
  /** Corner of a tile (the box an item is drawn in). */
  tileRadius: string;
  /** Corner of one reading's small panel inside a several-reading panel. */
  miniPanelRadius: string;
  /** Corner of buttons and switch bodies (rocker, tile, pair). */
  controlRadius: string;
  /** Corner of round-ended tracks and knobs (999px = fully round). */
  pillRadius: string;
  /** Fill of a switch's track or well. */
  controlSurface: string;
  /** Shadow that makes a control stand up from the panel. */
  controlRaise: string;
  /** Shadow that makes a control look pressed in. */
  controlPress: string;
  /** Fill of a sliding knob (a colour or a gradient). */
  knob: string;
  knobShadow: string;
  /** Fill of a track that is on. */
  trackOn: string;
  /** Text on the accent colour. */
  accentInk: string;
  /** Pale accent behind things that are on. */
  accentSoft: string;
  /** Neutral chip fill (an "off" button in a pair). */
  chip: string;
  /** Glow around things that are on (a box-shadow; "0 0 0 transparent" for none). */
  glow: string;
  /** Glow on text that is on (a text-shadow; "none" for none). */
  textGlow: string;
  /** Optional: a panel's own fill (else the theme's paper, or frosted glass). */
  panelFill?: string;
  /** Optional: the inside of tiles (fill, border, shadow). */
  tileFill?: string;
  tileBorder?: string;
  tileShadow?: string;
};

export type UiLook = {
  id: string;
  label: string;
  /** One line shown under the name in Settings → Appearance. */
  description: string;
  /** Panels let the background show through (when there is one). */
  frosted: boolean;
  /** Background chosen with this Look when the page has none yet (a gradient id). */
  defaultBackground?: string;
  tokens: (theme: Theme) => LookTokens;
  /** Decoration drawn behind each panel's content, sized to the panel (e.g. HUD frames). */
  PanelFrame?: ComponentType;
  /** The page background this Look brings, used while Appearance → Background is Plain. */
  background?: (mode: "light" | "dark") => {
    colour: string;
    /** CSS background-image layers. */
    image?: string;
    /** background-size for each layer (e.g. "100% 100%, 28px 28px"). */
    size?: string;
  };
  /** Extra CSS while this Look is chosen (may start with @import for fonts). */
  css?: string;
  /** A Look that only works in one colour mode (e.g. HUD is always dark). */
  forceMode?: "light" | "dark";
};
