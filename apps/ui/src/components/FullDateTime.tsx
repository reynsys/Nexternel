import { Box } from "@mui/material";
import { fullDateTime } from "../lib/full-date";

/**
 * A full date in running text ("Since Wednesday 18 November 2026, 13:35"). It stays in one piece:
 * on a narrow screen the line breaks before the date, not inside it.
 */
export function FullDateTime({ when }: { when: string | number | Date }) {
  return (
    <Box component="span" sx={{ display: "inline-block" }}>
      {fullDateTime(when)}
    </Box>
  );
}
