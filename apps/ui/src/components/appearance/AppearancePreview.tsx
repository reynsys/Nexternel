import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import type { ThemePrefs } from "../../skins/themePrefs";
import { resolveLook } from "../../skins/looks/registry";
import { schemeForPrefs } from "../../skins/appearance-scheme";
import { LookFrame } from "./LookFrame";

/**
 * The preview is drawn as wide as a laptop's dashboard (five panels in a row), in one shape for every
 * Look (a Look with a taller frame is fitted inside, so the preview never changes size), then shrunk to fit.
 */
const DRAWN_WIDTH = 1160;
const DRAWN_HEIGHT = 880;

/**
 * The settings being chosen (not necessarily the ones in use, e.g. when an admin sets a wall screen's
 * look), drawn as a real dashboard section with real panels and sample readings (LookFrame). Under
 * it: whether every text is readable.
 */
export function AppearancePreview({ prefs, skinId, deviceDark = true }: { prefs: ThemePrefs; skinId: string; deviceDark?: boolean }) {
  const look = resolveLook(prefs.lookId);
  const mode = look.forceMode ?? (prefs.autoMode ? (deviceDark ? "dark" : "light") : prefs.mode);
  const scheme = useMemo(() => schemeForPrefs({ ...prefs, mode }, mode, Boolean(look.frosted)), [prefs, mode, look]);
  const allReadable = scheme.audit.every((a) => a.pass);

  return (
    <Box>
      <Box sx={(t) => ({ borderRadius: 2, overflow: "hidden", border: `1px solid ${t.nxScheme.line.edge}` })}>
        <LookFrame prefs={prefs} skinId={skinId} drawnWidth={DRAWN_WIDTH} drawnHeight={DRAWN_HEIGHT} title="Preview of these settings" />
      </Box>
      <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: allReadable ? "success.main" : "warning.main" }}>
        {allReadable
          ? `✓ Every text and control is readable (${scheme.audit.length} checks).`
          : "Some text may be hard to read with these settings."}
      </Typography>
    </Box>
  );
}
