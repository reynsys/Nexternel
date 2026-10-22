import { createTheme, alpha, type Theme } from "@mui/material/styles";
import type { ThemePrefs } from "../../themePrefs";
import { buildScheme, type Scheme } from "../../../lib/appearance/scheme";
import { DEFAULT_FONT_ID, coreFont } from "../../../lib/appearance/fonts";

/**
 * MUI dashboard skin theme. Every colour comes from the Appearance engine's roles (lib/appearance):
 * the page, panels, text, lines, the main / second / third colours and the status colours.
 */
export function createMuiDashboardTheme(prefs: ThemePrefs, scheme?: Scheme): Theme {
  const s = scheme ?? buildScheme({ mode: prefs.mode, surfaces: "solid", main: prefs.primary, harmony: prefs.harmony ?? "split" });
  const r = s.roles;
  const solid = (c: { solid: string; solidHover: string; ink: string; text: string }) => ({
    main: c.solid,
    dark: c.solidHover,
    light: c.text,
    contrastText: c.ink,
  });
  return createTheme({
    palette: {
      mode: r.mode,
      primary: solid(r.main),
      secondary: solid(r.second),
      success: solid(r.status.ok),
      warning: solid(r.status.watch),
      error: solid(r.status.alert),
      info: solid(r.third),
      background: { default: r.surfaceSolid.background, paper: r.surfaceSolid.panel },
      divider: r.line.divider,
      text: { primary: r.text.main, secondary: r.text.quiet, disabled: alpha(r.text.quiet, 0.6) },
      action: {
        hover: alpha(r.main.solid, 0.1),
        selected: r.main.soft,
        disabledBackground: alpha(r.text.quiet, 0.12),
        disabled: alpha(r.text.quiet, 0.55),
      },
    },
    typography: {
      fontFamily: coreFont(DEFAULT_FONT_ID)!.family,
      h4: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    // Building blocks are styled from the chosen Look (skins/look-theme.ts).
    components: {
      MuiLink: { styleOverrides: { root: { "&.MuiLink-underlineHover:hover": { color: r.main.text } } } },
    },
  });
}
