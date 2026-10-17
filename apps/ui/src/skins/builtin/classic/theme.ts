import { createTheme, type Theme } from "@mui/material/styles";
import type { ThemePrefs } from "../../themePrefs";

/** Classic flat theme — respects configurator mode + primary. */
export function createClassicTheme(prefs: ThemePrefs): Theme {
  const mode = prefs.mode;

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
    // Building blocks are styled from the chosen Look (skins/look-theme.ts); the top menu's
    // active link stays here.
    components: {
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
    },
  });
}
