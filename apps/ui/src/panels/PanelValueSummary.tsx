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
          "& > div": { fontSize: "clamp(1.1rem, 14cqi, 2.5rem)" },
          "& > span": { fontSize: "clamp(0.7rem, 8cqi, 1rem)" },
        }}
      />
      <Typography variant="caption" color="text.secondary" textAlign="center" noWrap sx={{ maxWidth: "100%" }}>
        {label}
      </Typography>
    </Stack>
  );
}
