import { Card, CardContent, Typography } from "@mui/material";
import { useSkin } from "./SkinProvider";
import { ThemeOptionsFields } from "./ThemeOptionsFields";
import { useContentSurfaceSx } from "./useSurfaceStyles";

/**
 * Theme / appearance controls (light-dark, accent, skin).
 * Used on Settings → Appearance — not as a floating FAB.
 * When signed in, prefs are saved to the user account.
 */
export function ThemeOptionsPanel() {
  const { skin, skins, setSkinId, themePrefs, setThemePrefs } = useSkin();
  const surfaceSx = useContentSurfaceSx();

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Appearance
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Colours, background, effects and layout. Changes apply straight away and are saved to
          your account.
        </Typography>
        <ThemeOptionsFields
          themePrefs={themePrefs}
          skinId={skin.id}
          skins={skins}
          onThemeChange={setThemePrefs}
          onSkinChange={setSkinId}
        />
      </CardContent>
    </Card>
  );
}
