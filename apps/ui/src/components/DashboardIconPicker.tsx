import { useState } from "react";
import { Box, Button, ButtonBase, Collapse, Stack, Tooltip, Typography } from "@mui/material";
import { DASHBOARD_ICONS } from "../lib/dashboard-icons";
import { choiceSx, insetSx } from "../skins/surfaceStyles";
import { ICON_SIZE } from "../lib/appearance/type";

type Props = {
  value?: string;
  onChange: (iconId: string) => void;
  /** Compact grid for side panels and narrow places. */
  dense?: boolean;
};

/**
 * Icon choice: the chosen icon and its name, with Change to open the full list (closes again once one
 * is picked), so a settings panel stays short.
 */
export function DashboardIconPicker({ value, onChange, dense }: Props) {
  const [open, setOpen] = useState(false);
  const current = DASHBOARD_ICONS.find((i) => i.id === value) ?? DASHBOARD_ICONS[0];
  const Current = current?.Icon;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Icon
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={[insetSx(), { width: 44, height: 44, display: "grid", placeItems: "center", color: "primary.main", flexShrink: 0 }]}>
          {Current ? <Current sx={{ fontSize: ICON_SIZE.picker }} /> : null}
        </Box>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {current?.label ?? "None"}
        </Typography>
        <Button variant={open ? "contained" : "outlined"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Done" : "Change"}
        </Button>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: dense ? "repeat(auto-fill, minmax(40px, 1fr))" : "repeat(auto-fill, minmax(48px, 1fr))",
            gap: 0.75,
            mt: 1.5,
          }}
        >
          {DASHBOARD_ICONS.map(({ id, label, Icon }) => {
            const selected = value === id;
            return (
              <Tooltip key={id} title={label}>
                <ButtonBase
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  aria-label={label}
                  aria-pressed={selected}
                  sx={[{ p: dense ? 0.75 : 1, color: selected ? "primary.main" : "text.secondary" }, choiceSx(selected, { hover: true, radius: "field" })]}
                >
                  <Icon fontSize={dense ? "small" : "medium"} />
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}
