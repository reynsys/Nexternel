import { Typography } from "@mui/material";
import type { Scheme } from "../../lib/appearance/scheme";

/** Whether every text and control can be read with these colours. */
export function ReadableLine({ scheme }: { scheme: Scheme }) {
  const allReadable = scheme.audit.every((a) => a.pass);
  return (
    <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: allReadable ? "success.main" : "warning.main" }}>
      {allReadable
        ? "✓ Every text and control is readable."
        : "Some text may be hard to read with these settings."}
    </Typography>
  );
}
