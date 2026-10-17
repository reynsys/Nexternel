import { createTheme, alpha, type Theme } from "@mui/material/styles";
import type { ThemePrefs } from "../../themePrefs";

function lightSurfaces() {
  return {
    default: "#f0f2f5",
    paper: "#ffffff",
  };
}

function darkSurfaces() {
  return {
    default: "hsl(220, 30%, 6%)",
    paper: "hsl(220, 30%, 7%)",
  };
}

/** MUI dashboard skin theme — mode + primary from Theme Configurator. */
export function createMuiDashboardTheme(prefs: ThemePrefs): Theme {
  const mode = prefs.mode;
  const primary = prefs.primary;
  const surfaces = mode === "dark" ? darkSurfaces() : lightSurfaces();

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primary,
        // Let MUI pick readable ink (dark on bright orange, light on deep accents)
      },
      secondary: {
        main: mode === "dark" ? alpha(primary, 0.85) : primary,
      },
      background: surfaces,
      divider: alpha(mode === "dark" ? "#fff" : "#000", mode === "dark" ? 0.12 : 0.08),
      text: {
        primary: mode === "dark" ? "#fff" : "#1a1f36",
        secondary: mode === "dark" ? "hsl(220, 20%, 65%)" : "rgba(0,0,0,0.6)",
      },
      action: {
        hover: alpha(primary, 0.08),
        // Keep soft for generic lists; nav uses solid primary (see MuiListItemButton)
        selected: alpha(primary, 0.16),
      },
    },
    typography: {
      fontFamily: '"Inter", "IBM Plex Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      h4: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    // Building blocks are styled from the chosen Look (skins/look-theme.ts); only the menu's
    // own link colour stays here.
    components: {
      MuiLink: {
        styleOverrides: {
          root: {
            "&.MuiLink-underlineHover:hover": {
              color: primary,
            },
          },
        },
      },
    },
  });
}
