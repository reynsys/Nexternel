import type { Theme, ThemeOptions } from "@mui/material/styles";
import type { LookTokens } from "./looks/types";
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
  }
  interface ThemeOptions {
    nx?: LookTokens;
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
  const heading = { textTransform: t.headingCase, letterSpacing: t.headingSpacing };
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

  return {
    nx: t,
    // Every "1×, 1.5×, 2×" corner in Nexternel is measured in this.
    shape: { borderRadius: t.radiusUnit },
    palette: { divider: t.line, background: { default: t.ground, paper: t.paper } },
    typography: {
      fontFamily: t.font,
      h1: heading,
      h2: heading,
      h3: heading,
      h4: { ...heading, fontWeight: 600 },
      h5: heading,
      h6: { ...heading, fontWeight: 600 },
      // Overlines are capitals already; a Look only adds its letter spacing.
      overline: { letterSpacing: t.headingSpacing === "normal" ? undefined : t.headingSpacing },
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
      MuiDrawer: {
        defaultProps: { PaperProps: role("chrome") },
        styleOverrides: {
          paper: { backgroundImage: "none", borderRight: t.chromeEdge, ...set("boxShadow", t.chromeShadow) },
        },
      },
      MuiAppBar: { defaultProps: role("chrome"), styleOverrides: { root: { ...set("boxShadow", t.chromeShadow) } } },
      MuiButton: {
        styleOverrides: {
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
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: t.radiusControl,
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
      MuiTab: { styleOverrides: { root: { "&.Mui-selected": { color: primary.main, fontWeight: 600 } } } },
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
