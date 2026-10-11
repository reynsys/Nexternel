import { createTheme, alpha, type Theme } from "@mui/material/styles";
import type { ThemePrefs } from "../../themePrefs";
import { contentPanelStyles, isGradientActive } from "../../surfaceStyles";

/** Classic flat theme — respects configurator mode + primary. */
export function createClassicTheme(prefs: ThemePrefs): Theme {
  const mode = prefs.mode;
  const gradientActive = isGradientActive(prefs);
  const solidContentPanels = Boolean(prefs.solidContentPanels);

  return createTheme({
    palette: {
      mode,
      primary: { main: prefs.primary },
      secondary: { main: mode === "dark" ? "#c4a35a" : "#8a7040" },
      background:
        mode === "dark"
          ? { default: "#0f1419", paper: "#1a222c" }
          : { default: "#f5f7fa", paper: "#ffffff" },
    },
    typography: {
      fontFamily: '"IBM Plex Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${alpha(theme.palette.mode === "dark" ? "#fff" : "#000", 0.08)}`,
            ...contentPanelStyles(theme, { gradientActive, solidContentPanels }),
          }),
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: ({ theme }) => ({
            ...contentPanelStyles(theme, { gradientActive, solidContentPanels }),
            "&:before": { display: "none" },
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none" },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&.nexternel-nav-active": {
              color: theme.palette.primary.main,
              fontWeight: 700,
            },
          }),
        },
      },
      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&.Mui-selected": {
              color: theme.palette.primary.main,
              fontWeight: 600,
            },
          }),
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: ({ theme }) => ({
            "&.Mui-checked": {
              color: theme.palette.primary.main,
            },
            "&.Mui-checked + .MuiSwitch-track": {
              backgroundColor: theme.palette.primary.main,
            },
          }),
        },
      },
    },
  });
}
