import { Box, Card, CardContent, Typography } from "@mui/material";
import { useSkin } from "./SkinProvider";
import { ThemeOptionsFields } from "./ThemeOptionsFields";
import { useContentSurfaceSx } from "./useSurfaceStyles";

/**
 * Theme / appearance controls (light-dark, accent, skin).
 * Used on Settings → Appearance — not as a floating FAB.
 * Changes show straight away; Apply (in the bar at the bottom) saves them to the account, Cancel
 * puts back how it was.
 */
export function ThemeOptionsPanel() {
  const { skin, skins, tryThemePrefs, trySkinId, trying, themePrefs } = useSkin();
  const surfaceSx = useContentSurfaceSx();

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          You see changes straight away; press Apply to keep them.
        </Typography>
        <ThemeOptionsFields
          themePrefs={themePrefs}
          skinId={skin.id}
          skins={skins}
          onThemeChange={tryThemePrefs}
          onSkinChange={trySkinId}
        />
        {/* Room for the Apply bar, so it never covers the last choices. */}
        {trying ? <Box aria-hidden sx={{ height: 96 }} /> : null}
      </CardContent>
    </Card>
  );
}
