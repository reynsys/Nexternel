import { alpha, type SxProps, type Theme } from "@mui/material/styles";

/** Outer shell shared by navigator and detail pane. */
export function devicesPanelChromeSx(surface: Record<string, unknown>, theme: Theme): SxProps<Theme> {
  return {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    borderRadius: 2,
    border: "1px solid",
    borderColor: "divider",
    overflow: "hidden",
    ...surface,
    boxShadow:
      theme.palette.mode === "dark"
        ? "inset 0 1px 0 rgba(255,255,255,0.05)"
        : "0 1px 3px rgba(15, 23, 42, 0.08)",
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

export function devicesNavItemSx(theme: Theme, selected: boolean): SxProps<Theme> {
  return {
    mx: 1,
    my: 0.35,
    px: 1.5,
    py: 1,
    borderRadius: 1.5,
    alignItems: "flex-start",
    border: "1px solid",
    borderColor: selected ? alpha(theme.palette.primary.main, 0.45) : "transparent",
    bgcolor: selected
      ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.1)
      : "transparent",
    transition: theme.transitions.create(["background-color", "border-color"], {
      duration: theme.transitions.duration.shorter,
    }),
    "&:hover": {
      bgcolor: selected
        ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.26 : 0.14)
        : alpha(theme.palette.action.hover, 1),
    },
    "&.Mui-selected": {
      bgcolor: selected
        ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.1)
        : undefined,
    },
    "&.Mui-selected:hover": {
      bgcolor: selected
        ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.26 : 0.14)
        : undefined,
    },
  };
}

export function devicesActionGroupSx(theme: Theme): SxProps<Theme> {
  return {
    p: 2,
    borderRadius: 1.5,
    border: "1px solid",
    borderColor: "divider",
    bgcolor: alpha(theme.palette.background.default, theme.palette.mode === "dark" ? 0.35 : 0.6),
  };
}

export const devicesOutlinedButton = {
  size: "small" as const,
  variant: "outlined" as const,
};

export const devicesContainedButton = {
  size: "small" as const,
  variant: "contained" as const,
};
