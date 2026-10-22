import { PANEL_TEXT } from "../lib/appearance/type";
import { Stack, Typography } from "@mui/material";
import { AdaptiveReading } from "../components/AdaptiveReading";
import { useMetricAppearance } from "../skins/useMetricAppearance";

type Props = {
  label: string;
  value: string;
  unit?: string;
};

/** Compact value readout when a panel is too small for its full visualisation. */
export function PanelValueSummary({ label, value, unit }: Props) {
  const { valueColor } = useMetricAppearance();
  return (
    <Stack
      height="100%"
      alignItems="center"
      justifyContent="center"
      spacing={0.5}
      sx={{ px: 1, minHeight: 0 }}
      role="status"
    >
      <AdaptiveReading
        value={value}
        unit={unit}
        valueColor={valueColor}
        sx={{
          "& > div": { fontSize: PANEL_TEXT.valueShared },
          "& > span": { fontSize: PANEL_TEXT.unit },
        }}
      />
      <Typography variant="caption" color="text.secondary" textAlign="center" noWrap sx={{ maxWidth: "100%" }}>
        {label}
      </Typography>
    </Stack>
  );
}
