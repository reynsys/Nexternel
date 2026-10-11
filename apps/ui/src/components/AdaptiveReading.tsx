import { Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

type Props = {
  value: string;
  unit?: string;
  valueColor?: string;
  unitColor?: string;
  /** Stack unit below value — avoids horizontal collision in narrow metric cells. */
  layout?: "inline" | "stack";
  sx?: SxProps<Theme>;
};

/**
 * Value + unit presentation that scales with a size container ancestor (`container-type: size`).
 * Parent or an ancestor must set `containerType: "size"` (panel root or tile host).
 */
export function AdaptiveReading({
  value,
  unit,
  valueColor,
  unitColor,
  layout = "inline",
  sx,
}: Props) {
  const stacked = layout === "stack";
  return (
    <Stack
      direction={stacked ? "column" : "row"}
      alignItems="center"
      justifyContent="center"
      flexWrap={stacked ? "nowrap" : "wrap"}
      useFlexGap
      sx={{
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        rowGap: 0.25,
        columnGap: 0.5,
        px: 0.25,
        ...(!stacked
          ? {
              alignItems: "baseline",
              "@container (max-width: 6.5rem)": {
                flexDirection: "column",
                alignItems: "center",
              },
            }
          : null),
        ...sx,
      }}
    >
      <Typography
        component="div"
        sx={{
          fontSize: "clamp(0.75rem, 18cqi, 1.65rem)",
          fontWeight: 800,
          lineHeight: 1.05,
          fontVariantNumeric: "tabular-nums",
          color: valueColor ?? "text.primary",
          minWidth: 0,
          maxWidth: "100%",
          flex: "0 1 auto",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>
      {unit ? (
        <Typography
          component="span"
          sx={{
            fontSize: "clamp(0.65rem, 10cqi, 0.95rem)",
            fontWeight: 700,
            color: unitColor ?? "text.secondary",
            lineHeight: 1.1,
            minWidth: 0,
            maxWidth: "100%",
            flex: "0 1 auto",
            textAlign: "center",
            overflowWrap: "anywhere",
          }}
        >
          {unit}
        </Typography>
      ) : null}
    </Stack>
  );
}
