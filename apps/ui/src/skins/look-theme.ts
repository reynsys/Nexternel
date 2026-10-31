import { alpha, type Theme, type ThemeOptions } from "@mui/material/styles";
import type { LookTokens } from "./looks/types";
import type { Roles } from "../lib/appearance/scheme";
import { TYPE_SCALE, WEIGHTS } from "../lib/appearance/type";
import { contentPanelStyles, insetStyle } from "./surfaceStyles";

declare module "@mui/material/Paper" {
  interface PaperPropsVariantOverrides {
    /** A box inside a card, drawn from the Look's inset role. */
    inset: true;
  }
}

declare module "@mui/material/styles" {
  interface Theme {
    /** The chosen Look's role values (skins/looks/types.ts) — hand-built parts read these. */
    nx: LookTokens;
    /** Every colour by role, from the Appearance engine (lib/appearance/scheme.ts). */
    nxScheme: Roles;
  }
  interface ThemeOptions {
    nx?: LookTokens;
    nxScheme?: Roles;
  }
}

/** Only set a property when the Look gives it a value ("" = keep the building block's default). */
const set = (key: string, value: string) => (value ? { [key]: value } : {});
/** Marks a building block with its role, so a Look's CSS can decorate it. */
const role = (name: string) => ({ "data-nx-role": name }) as never;

/**
 * The one place where Nexternel's building blocks get their look: every button, card, menu,
 * field and list is styled from the chosen Look's roles here. Skins only decide the layout;
 * Look packs only give role values (and optional CSS decorations on roles).
 */
export function lookThemeOptions(
  base: Theme,
  t: LookTokens,
  surface: { gradientActive: boolean; solidContentPanels: boolean }
): ThemeOptions {
  const glass = surface.gradientActive && !surface.solidContentPanels;
  // Each MUI text variant keeps the font it was created with, so the Look's font is set on all of them.
  const font = { fontFamily: t.font };
  const heading = { ...font, textTransform: t.headingCase, letterSpacing: t.headingSpacing };
  const primary = base.palette.primary;
  const field = `${t.radiusUnit}px`;
  const popup = {
    borderRadius: field,
    ...set("backgroundColor", t.popupFill),
    ...set("border", t.popupBorder),
    ...set("boxShadow", t.popupShadow),
  };
  const brighter = (fill: string) => (fill ? { "&:hover": { backgroundColor: fill, filter: "brightness(1.12)" } } : {});
  // Buttons the Look gives a shadow look pressed in while held.
  const pressable = (shadow: string) => (shadow ? { "&:active": { boxShadow: t.controlPress } } : {});
  // Menu items and tabs look like buttons too (same edge as an outlined button; chosen = filled).
  const buttonEdge = t.secondaryBorder || `1px solid ${alpha(primary.main, 0.5)}`;

  return {
    nx: t,
    // Every "1×, 1.5×, 2×" corner in Nexternel is measured in this.
    shape: { borderRadius: t.radiusUnit },
    palette: { divider: t.line, background: { default: t.ground, paper: t.paper } },
    // The type scale (lib/appearance/type.ts): one size and weight per kind of text, in the Look's font.
    typography: {
      fontFamily: t.font,
      fontWeightRegular: WEIGHTS.regular,
      fontWeightMedium: WEIGHTS.medium,
      fontWeightBold: WEIGHTS.bold,
      h1: heading,
      h2: heading,
      h3: heading,
      h4: { ...heading, ...TYPE_SCALE.h4 },
      h5: { ...heading, ...TYPE_SCALE.h5 },
      h6: { ...heading, ...TYPE_SCALE.h6 },
      // Overlines are capitals already; a Look only adds its letter spacing.
      overline: { ...font, ...TYPE_SCALE.overline, ...(t.headingSpacing === "normal" ? {} : { letterSpacing: t.headingSpacing }) },
      subtitle1: { ...font, ...TYPE_SCALE.subtitle1 },
      subtitle2: { ...font, ...TYPE_SCALE.subtitle2 },
      body1: { ...font, ...TYPE_SCALE.body1 },
      body2: { ...font, ...TYPE_SCALE.body2 },
      button: { ...font, ...TYPE_SCALE.button },
      caption: { ...font, ...TYPE_SCALE.caption },
    },
    components: {
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: "none" } },
        variants: [{ props: { variant: "inset" }, style: insetStyle(t) }],
      },
      MuiCard: {
        defaultProps: role("card"),
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: t.radiusCard,
            border: t.cardBorder,
            ...(glass ? contentPanelStyles(theme, surface) : { backgroundColor: t.cardFill }),
            ...set("boxShadow", t.cardShadow),
          }),
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: ({ theme }) => ({
            ...contentPanelStyles(theme, surface),
            backgroundImage: "none",
            "&:before": { display: "none" },
          }),
        },
      },
      MuiDialog: { defaultProps: { PaperProps: role("popup") }, styleOverrides: { paper: popup } },
      MuiPopover: { defaultProps: { slotProps: { paper: role("popup") } }, styleOverrides: { paper: popup } },
      MuiMenu: { styleOverrides: { paper: popup } },
      // A folded side menu's group pops its pages out beside it, drawn as a pop-up.
      MuiTooltip: {
        styleOverrides: {
          tooltip: { "&.nx-nav-popout": { backgroundColor: base.palette.background.paper, ...popup, backgroundImage: "none", color: base.palette.text.primary, padding: 8, maxWidth: "none" } },
        },
      },
      // The pages of a side-menu group: indented under it, joined by a line down the left.
      MuiList: {
        styleOverrides: {
          root: { "&[data-nx-nav-group]": { marginLeft: 14, paddingLeft: 2, borderLeft: `2px solid ${base.palette.divider}` } },
        },
      },
      MuiDrawer: {
        defaultProps: { PaperProps: role("chrome") },
        styleOverrides: {
          paper: { backgroundImage: "none", borderRight: t.chromeEdge, ...set("boxShadow", t.chromeShadow) },
        },
      },
      MuiAppBar: { defaultProps: role("chrome"), styleOverrides: { root: { ...set("boxShadow", t.chromeShadow) } } },
      MuiButton: {
        // Every button looks like a button: no bare text that might or might not be clickable.
        defaultProps: { variant: "outlined" },
        styleOverrides: {
          // Comfortable sizes for touch and wall screens (40 / 36 / 48 px).
          sizeMedium: { minHeight: 40 },
          sizeSmall: { minHeight: 36 },
          sizeLarge: { minHeight: 48 },
          root: ({ ownerState }) => {
            const tinted = !ownerState.color || ownerState.color === "primary" || ownerState.color === "inherit";
            return {
              textTransform: t.buttonCase,
              borderRadius: t.radiusControl,
              ...(t.buttonShape && t.buttonShape !== "none" ? { clipPath: t.buttonShape } : {}),
              ...(ownerState.variant === "contained" && tinted
                ? {
                    ...set("backgroundColor", t.primaryFill),
                    ...set("color", t.primaryInk),
                    ...set("border", t.primaryBorder),
                    ...set("boxShadow", t.primaryShadow),
                    ...brighter(t.primaryFill),
                    ...pressable(t.primaryShadow),
                  }
                : {}),
              ...(ownerState.variant === "outlined" && tinted
                ? {
                    ...set("backgroundColor", t.secondaryFill),
                    ...set("color", t.secondaryInk),
                    ...set("border", t.secondaryBorder),
                    ...set("boxShadow", t.secondaryShadow),
                    ...pressable(t.secondaryShadow),
                    ...(t.secondaryBorder ? { "&:hover": { border: t.secondaryBorder, ...set("backgroundColor", t.secondaryFill), filter: "brightness(1.15)" } } : {}),
                  }
                : {}),
              ...(ownerState.variant === "text" && tinted ? set("color", t.quietInk) : {}),
            };
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          sizeMedium: { minWidth: 40, minHeight: 40 },
          sizeSmall: { minWidth: 36, minHeight: 36 },
        },
      },
      // Buttons at the foot of a dialog or card: Nexternel's space between buttons.
      MuiDialogActions: {
        styleOverrides: { root: { gap: "var(--nx-control-gap)", padding: "12px 24px 20px", "& > :not(style) ~ :not(style)": { marginLeft: 0 } } },
      },
      MuiCardActions: {
        styleOverrides: { root: { gap: "var(--nx-control-gap)", "& > :not(style) ~ :not(style)": { marginLeft: 0 } } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: t.radiusControl,
            // Side-menu entries are buttons: each has the outlined button's edge.
            "&[data-nx-nav]": {
              border: buttonEdge,
              minHeight: 44,
              marginBottom: "var(--nx-list-gap)",
              marginInline: "var(--nx-decor-reach)",
              ...set("backgroundColor", t.secondaryFill),
            },
            "&[data-nx-nav].Mui-selected": { borderColor: "transparent" },
            // A page inside a group (Settings → System): a smaller button.
            "&[data-nx-nav-child]": { minHeight: 36, paddingTop: 2, paddingBottom: 2 },
            // The entry of a group whose page is open: marked by its text and icon, not filled.
            "&[data-nx-nav-within]": {
              borderColor: primary.main,
              "& .MuiListItemIcon-root": { color: primary.main },
              "& .MuiListItemText-primary": { fontWeight: 600 },
            },
            // The chosen menu item, as the Look draws it.
            "&.Mui-selected": {
              backgroundColor: t.selectedFill,
              color: t.selectedInk,
              ...set("boxShadow", t.selectedShadow),
              "& .MuiListItemIcon-root": { color: t.selectedInk },
              "& .MuiListItemText-primary": { color: t.selectedInk, fontWeight: 600 },
              "&:hover": t.selectedFill === primary.main ? { backgroundColor: primary.dark } : { backgroundColor: t.selectedFill, filter: "brightness(1.1)" },
            },
            "&.Mui-selected.Mui-focusVisible": { backgroundColor: t.selectedFill === primary.main ? primary.dark : t.selectedFill },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: field, ...set("backgroundColor", t.fieldFill), ...set("boxShadow", t.fieldShadow) },
          notchedOutline: { ...set("borderColor", t.fieldBorderColour) },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: t.radiusChip } } },
      MuiAvatar: {
        styleOverrides: {
          colorDefault: { backgroundColor: t.avatarFill, color: t.avatarInk, ...set("border", t.avatarBorder) },
        },
      },
      // Tabs are drawn as a row of buttons: outlined, the chosen one filled.
      // Tabs never look like buttons: words on a thin line, the chosen one in the main colour with a
      // bar under it — no box, no fill. Buttons (boxed) do things; tabs switch what is shown.
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 0, borderBottom: `1px solid ${t.line || base.palette.divider}` },
          indicator: { height: 3, borderRadius: "3px 3px 0 0", backgroundColor: primary.main },
          flexContainer: { gap: 4 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            padding: "8px 14px",
            textTransform: "none",
            fontWeight: 600,
            color: "inherit",
            opacity: 0.72,
            borderRadius: `${t.radiusControl} ${t.radiusControl} 0 0`,
            "&:hover": { opacity: 1, backgroundColor: "rgba(128,128,128,.08)" },
            "&.Mui-selected": { opacity: 1, color: primary.main },
            "&.Mui-focusVisible": { outline: `2px solid ${primary.main}`, outlineOffset: -2 },
          },
        },
      },
      // Choice buttons (5 / 4, Full / Half…) write their words like every other button.
      MuiToggleButton: { styleOverrides: { root: { textTransform: t.buttonCase } } },
      MuiSwitch: {
        styleOverrides: {
          switchBase: { "&.Mui-checked": { color: primary.main }, "&.Mui-checked + .MuiSwitch-track": { backgroundColor: primary.main } },
        },
      },
      MuiCheckbox: { styleOverrides: { root: { "&.Mui-checked": { color: primary.main } } } },
      MuiRadio: { styleOverrides: { root: { "&.Mui-checked": { color: primary.main } } } },
    },
  };
}
