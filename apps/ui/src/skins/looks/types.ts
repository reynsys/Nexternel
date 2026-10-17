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

  // ---- The rest of Nexternel: every screen is built from these roles (skins/look-theme.ts). ----
  // An empty string "" means "leave the building block's own default".

  /** Page ground and the plain fill most things sit on. */
  ground: string;
  paper: string;
  /** Lines: borders and dividers everywhere. */
  line: string;
  /** Text. */
  font: string;
  headingCase: "none" | "uppercase";
  headingSpacing: string;
  /**
   * Corners. radiusUnit is the base size every "1×, 1.5×, 2×" corner in Nexternel is measured in
   * (fields, pop-ups, option tiles, boxes inside cards); the others are buttons and menu items,
   * chips and cards.
   */
  radiusUnit: number;
  radiusControl: string;
  radiusChip: string;
  radiusCard: string;
  /** The side menu and the top bar. */
  chromeFill: string;
  chromeEdge: string;
  chromeShadow: string;
  /** Cards (Settings and other pages). */
  cardFill: string;
  cardBorder: string;
  cardShadow: string;
  /** Pop-ups: menus, dialogs, drop-down lists. */
  popupFill: string;
  popupBorder: string;
  popupShadow: string;
  /** Text and number fields. */
  fieldFill: string;
  fieldBorderColour: string;
  fieldShadow: string;
  /** Option tiles (pickers: Looks, backgrounds, icons, switch styles). */
  choiceFill: string;
  choiceBorder: string;
  choiceShadow: string;
  choiceSelectedFill: string;
  choiceSelectedBorder: string;
  choiceSelectedShadow: string;
  /** A box inside a card (a list, a row, an expanded item, a group of settings): <Paper variant="inset">. */
  insetFill: string;
  insetBorder: string;
  insetShadow: string;
  /** The bar of room buttons above a dashboard: its bottom line, the space between buttons, its inner margin. */
  barEdge: string;
  barGap: string;
  barInset: string;
  /**
   * The Gears switch: fill, outline, outline width and shadow ("" = the accent-coloured gears).
   * "url(#nx-gear-metal)" gives polished metal.
   */
  gearFill: string;
  gearStroke: string;
  gearStrokeWidth: string;
  gearShadow: string;
  /** Space inside a panel around its title and tiles, and at the sides of its title. */
  panelInset: string;
  titleInset: string;
  /** Each reading's small panel inside a several-reading panel: its border. */
  miniPanelBorder: string;
  /** Dashboard sections (the box around a group of panels). */
  sectionFill: string;
  sectionBorder: string;
  sectionShadow: string;
  sectionRadius: string;
  /** Buttons: shape (a CSS clip-path or "none") and letters. */
  buttonShape: string;
  buttonCase: "none" | "uppercase";
  primaryFill: string;
  primaryInk: string;
  primaryBorder: string;
  primaryShadow: string;
  secondaryFill: string;
  secondaryInk: string;
  secondaryBorder: string;
  secondaryShadow: string;
  quietInk: string;
  /** The chosen item in a menu or list. */
  selectedFill: string;
  selectedInk: string;
  selectedShadow: string;
  /** A person's picture circle when there is no photo. */
  avatarFill: string;
  avatarInk: string;
  avatarBorder: string;
  /** The Nexternel mark at the top of the menu (when there is no own logo). */
  brandFill: string;
  brandBorder: string;
  brandShadow: string;
  brandRadius: string;
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
  /** The Look's values; anything left out is Standard's. */
  tokens: (theme: Theme) => Partial<LookTokens>;
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
  /**
   * Extra CSS while this Look is chosen (may start with @import for fonts). Decorations attach to
   * roles: [data-nx-role="card" | "section" | "chrome" | "popup"], [data-nx-tabbar], [data-nx-panel-body].
   */
  css?: string;
  /** A Look that only works in one colour mode (e.g. HUD is always dark). */
  forceMode?: "light" | "dark";
};
