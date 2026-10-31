import { Box, Paper, Typography } from "@mui/material";
import { SidePanelButtons } from "../components/side-panel/SidePanelButtons";
import { BOTTOM_NAV_HEIGHT_PX } from "./builtin/mui-dashboard/BottomNav";

/**
 * Shown while Appearance changes are being tried (Settings → Appearance), on every page until they
 * are applied or cancelled — so leaving the page never keeps or loses them without asking.
 */
export function AppearanceTrialBar({ onCancel, onApply }: { onCancel: () => void; onApply: () => void }) {
  return (
    <Paper
      role="region"
      aria-label="Appearance changes not applied"
      elevation={8}
      sx={{
        position: "fixed",
        zIndex: (t) => t.zIndex.snackbar,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(760px, calc(100% - 32px))",
        bottom: {
          xs: `calc(${BOTTOM_NAV_HEIGHT_PX + 12}px + var(--nx-dock-space, 0px))`,
          md: "calc(16px + var(--nx-dock-space, 0px))",
        },
        px: 2,
        py: 1.5,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "warning.main", flexShrink: 0 }} />
      <Typography variant="body2" sx={{ flex: "1 1 260px" }}>
        Your Appearance changes are not applied yet. You can already see them; nothing is kept until you press Apply.
      </Typography>
      <Box sx={{ flex: "0 0 auto", width: { xs: "100%", sm: 240 } }}>
        <SidePanelButtons onCancel={onCancel} onApply={onApply} />
      </Box>
    </Paper>
  );
}
