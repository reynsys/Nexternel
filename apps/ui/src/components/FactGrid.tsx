import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

export type FactItem = {
  label: string;
  value: ReactNode;
  /** Colours the value: "good" green, "warn" orange, "bad" red; plain otherwise. */
  tone?: "good" | "warn" | "bad";
};

const TONE_COLOUR = { good: "success.main", warn: "warning.main", bad: "error.main" } as const;

/**
 * Label + value pairs side by side (stacked on a phone): the small label on top, the value under it,
 * every pair in the same size. Used for Settings → System (Health, Updates).
 */
export function FactGrid({ items }: { items: FactItem[] }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
      {items.map((f) => (
        <Box key={f.label} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{f.label}</Typography>
          <Typography
            variant="body2"
            component="div"
            color={f.tone ? TONE_COLOUR[f.tone] : "text.secondary"}
            sx={{ overflowWrap: "anywhere" }}
          >
            {f.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
