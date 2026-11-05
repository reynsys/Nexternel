import { useEffect, useRef, useState } from "react";
import { Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { setLeaveGuard } from "../lib/leave-guard";
import { SidePanelButtons } from "../components/side-panel/SidePanelButtons";
import { useSkin } from "./SkinProvider";
import { ThemeOptionsFields } from "./ThemeOptionsFields";
import { useContentSurfaceSx } from "./useSurfaceStyles";

/**
 * Theme / appearance controls (light-dark, accent, skin).
 * Used on Settings → Appearance — not as a floating FAB.
 * Changes show straight away; Apply (always at the top of the page, greyed until something changes)
 * saves them to the account, Cancel puts back how it was. Leaving the page with changes not applied asks Stay / Don't keep / Apply;
 * leaving any other way (the browser's Back) puts back how it was.
 */
export function ThemeOptionsPanel() {
  const { skin, skins, tryThemePrefs, trySkinId, trying, themePrefs, applyTrial, cancelTrial } = useSkin();
  const surfaceSx = useContentSurfaceSx();
  /** Leaving with changes not applied: where the person wanted to go, while they choose. */
  const [leaveAsk, setLeaveAsk] = useState<{ go: () => void } | null>(null);
  useEffect(() => {
    if (!trying) return undefined;
    setLeaveGuard((go) => setLeaveAsk({ go }));
    return () => setLeaveGuard(null);
  }, [trying]);
  // Gone from the page without choosing: nothing is kept.
  const cancelRef = useRef(cancelTrial);
  cancelRef.current = cancelTrial;
  useEffect(() => () => cancelRef.current(), []);
  const leave = (keep: boolean) => {
    const go = leaveAsk?.go;
    setLeaveAsk(null);
    if (keep) applyTrial();
    else cancelTrial();
    go?.();
  };

  return (
    <Card sx={[surfaceSx, { overflow: "visible" }]}>
      <CardContent>
        <Box
          sx={(t) => ({
            position: "sticky",
            top: "var(--nx-top-bar, 0px)",
            zIndex: t.zIndex.appBar,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1.5,
            mb: 1,
            py: 1,
            bgcolor: t.nxScheme.surfaceSolid.panel,
          })}
        >
          <Typography variant="body2" color={trying ? "text.primary" : "text.secondary"} sx={{ flex: "1 1 260px", display: { xs: "none", sm: "block" } }}>
            {trying ? "You can see your changes. Press Apply to keep them, or Cancel to put back how it was." : "Your changes show straight away. Press Apply to keep them."}
          </Typography>
          <Box sx={{ flex: "0 0 auto", width: { xs: "100%", sm: 240 } }}>
            <SidePanelButtons onCancel={cancelTrial} onApply={applyTrial} applyDisabled={!trying} cancelDisabled={!trying} />
          </Box>
        </Box>
        <ThemeOptionsFields
          themePrefs={themePrefs}
          skinId={skin.id}
          skins={skins}
          onThemeChange={tryThemePrefs}
          onSkinChange={trySkinId}
        />
      </CardContent>
      <Dialog open={Boolean(leaveAsk)} onClose={() => setLeaveAsk(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Keep the Appearance changes?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You changed the Appearance but did not apply the changes yet. Apply them before going on, or leave them out.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setLeaveAsk(null)}>
            Stay here
          </Button>
          <Button variant="outlined" onClick={() => leave(false)}>
            Don't keep
          </Button>
          <Button variant="contained" onClick={() => leave(true)}>
            Apply and continue
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
