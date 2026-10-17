import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";
import { DASHBOARD_ICONS } from "../lib/dashboard-icons";
import { choiceSx } from "../skins/surfaceStyles";

type Props = {
  value?: string;
  onChange: (iconId: string) => void;
  /** Compact grid for drawers / dialogs */
  dense?: boolean;
};

export function DashboardIconPicker({ value, onChange, dense }: Props) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Icon
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: dense
            ? "repeat(auto-fill, minmax(40px, 1fr))"
            : "repeat(auto-fill, minmax(48px, 1fr))",
          gap: 0.75,
        }}
      >
        {DASHBOARD_ICONS.map(({ id, label, Icon }) => {
          const selected = value === id;
          return (
            <Tooltip key={id} title={label}>
              <ButtonBase
                onClick={() => onChange(id)}
                aria-label={label}
                aria-pressed={selected}
                sx={[
                  {
                  p: dense ? 0.75 : 1,
                  color: selected ? "primary.main" : "text.secondary",
                },
                choiceSx(selected, { hover: true, radius: "field" }),
              ]}
              >
                <Icon fontSize={dense ? "small" : "medium"} />
              </ButtonBase>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
