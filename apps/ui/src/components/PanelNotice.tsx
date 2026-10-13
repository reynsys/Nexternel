import { Typography } from "@mui/material";

/** A short message inside a panel (e.g. "Can't reach Nexternel right now — trying again."), kept clear of the tile's rounded edges. */
export function PanelNotice({ children }: { children: string }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      role="status"
      sx={{ display: "block", px: 1.5, py: 0.75, flexShrink: 0, textAlign: "center" }}
    >
      {children}
    </Typography>
  );
}
