import { useEffect, useRef, useState } from "react";
import { Box, Button, Card, CardContent, Dialog, DialogActions, DialogTitle, Typography } from "@mui/material";
import { setLeaveGuard } from "../lib/leave-guard";
import { SidePanelButtons } from "../components/side-panel/SidePanelButtons";
import { useSkin } from "./SkinProvider";
import { ThemeOptionsFields } from "./ThemeOptionsFields";
import { useContentSurfaceSx } from "./useSurfaceStyles";

/**
 * Theme / appearance controls (light-dark, accent, skin).
 * Used on Settings → Appearance — not as a floating FAB.
 * Changes show straight away; Apply (always at the top of the page, greyed until something changes)
 * saves them to the account (on a phone: to this phone only), Cancel puts back how it was. Leaving the page with changes not applied asks Stay / Don't keep / Apply;
 * leaving any other way (the browser's Back) puts back how it was.
 */
export function ThemeOptionsPanel() {
  const { skin, skins, tryThemePrefs, trySkinId, trying, themePrefs, applyTrial, cancelTrial, onPhone, phoneOwnLook, dropPhoneLook } = useSkin();
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
        {/* Cancel and Apply stay in reach while scrolling: a small floating holder at the right (only as
            wide as the buttons, so it never draws a band across the page). */}
        <Box sx={(t) => ({ position: "sticky", top: "var(--nx-top-bar, 0px)", zIndex: t.zIndex.appBar, display: "flex", justifyContent: "flex-end", mb: 1, pointerEvents: "none" })}>
          <Box
            data-nx-role="popup"
            sx={(t) => ({
              pointerEvents: "auto",
              width: { xs: "100%", sm: 260 },
              // One outer size in every Look (its edge counts inside it), so switching Look never moves what is below.
              boxSizing: "border-box",
              height: 58,
              display: "flex",
              alignItems: "center",
              "& > *": { flex: 1 },
              px: 1,
              borderRadius: `${t.nx.radiusUnit}px`,
              bgcolor: t.nx.popupFill || "background.paper",
              border: t.nx.popupBorder || undefined,
              boxShadow: t.nx.popupShadow || undefined,
            })}
          >
            <SidePanelButtons onCancel={cancelTrial} onApply={applyTrial} applyDisabled={!trying} cancelDisabled={!trying} />
          </Box>
        </Box>
        {onPhone ? (
          // A phone keeps its own Appearance (lib/phone-screen.ts).
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              For this screen only.
            </Typography>
            {phoneOwnLook && !trying ? (
              <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={dropPhoneLook}>
                Use the same as my other screens
              </Button>
            ) : null}
          </Box>
        ) : null}
        <ThemeOptionsFields
          themePrefs={themePrefs}
          skinId={skin.id}
          skins={skins}
          onThemeChange={tryThemePrefs}
          onSkinChange={trySkinId}
          onPhone={onPhone}
        />
      </CardContent>
      <Dialog open={Boolean(leaveAsk)} onClose={() => setLeaveAsk(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Keep the Appearance changes?</DialogTitle>
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
