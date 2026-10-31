import { alpha, type SxProps, type Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";
import { insetStyle } from "../../../skins/surfaceStyles";

/** Outer shell shared by navigator and detail pane: a card, as the Look draws cards. */
export function devicesPanelChromeSx(surface: Record<string, unknown>, theme: Theme): SxProps<Theme> {
  return {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    borderRadius: 2,
    border: theme.nx.cardBorder,
    overflow: "hidden",
    ...surface,
    boxShadow:
      theme.nx.cardShadow ||
      (theme.palette.mode === "dark" ? "inset 0 1px 0 rgba(255,255,255,0.05)" : "0 1px 3px rgba(15, 23, 42, 0.08)"),
  };
}

export function devicesPanelHeaderSx(theme: Theme): SxProps<Theme> {
  return {
    px: 2,
    py: 1.5,
    borderBottom: "1px solid",
    borderColor: "divider",
    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05),
    flexShrink: 0,
  };
}

export function devicesPanelBodySx(): SxProps<Theme> {
  return {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    p: 2,
  };
}

export function devicesSectionHeaderSx(theme: Theme): SxProps<Theme> {
  return {
    px: 2,
    py: 0.75,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.04 : 0.03),
    borderBottom: "1px solid",
    borderColor: "divider",
    cursor: "pointer",
    userSelect: "none",
  };
}

/** A device in the list; the chosen one looks like a chosen option tile in the Look. */
export function devicesNavItemSx(theme: Theme, selected: boolean): SxProps<Theme> {
  const n = theme.nx;
  const chosen = {
    backgroundColor: n.choiceSelectedFill,
    border: n.choiceSelectedBorder,
    boxShadow: n.choiceSelectedShadow,
  };
  return {
    mx: 1,
    my: 0.35,
    px: 1.5,
    py: 1,
    borderRadius: 1.5,
    alignItems: "flex-start",
    border: "1px solid transparent",
    transition: theme.transitions.create(["background-color", "border-color"], {
      duration: theme.transitions.duration.shorter,
    }),
    ...(selected ? chosen : {}),
    "&:hover": selected ? { ...chosen, filter: "brightness(1.08)" } : { bgcolor: theme.palette.action.hover },
    "&.Mui-selected, &.Mui-selected:hover": selected ? chosen : {},
  };
}

/** A group of actions inside the detail pane: a box inside a card. */
export function devicesActionGroupSx(theme: Theme): SystemStyleObject<Theme> {
  return { p: 2, ...insetStyle(theme.nx) };
}

export const devicesOutlinedButton = {
  size: "small" as const,
  variant: "outlined" as const,
};

export const devicesContainedButton = {
  size: "small" as const,
  variant: "contained" as const,
};
