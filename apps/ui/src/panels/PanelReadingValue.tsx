import { PANEL_TEXT } from "../lib/appearance/type";
import type { ResolvedPanelCapability } from "../api";
import { AdaptiveReading } from "../components/AdaptiveReading";
import { useMetricAppearance } from "../skins/useMetricAppearance";
import { parseCapabilityReading } from "./parse-capability-reading";

type Props = {
  cap: ResolvedPanelCapability;
};

/**
 * Large centred reading for Status (and future capability tiles).
 * Scales with the tile via container query units — matches plugin metric styling.
 */
export function PanelReadingValue({ cap }: Props) {
  const { valueColor } = useMetricAppearance();
  const { value, unit } = parseCapabilityReading(cap);

  return (
    <AdaptiveReading
      value={value}
      unit={unit || undefined}
      valueColor={valueColor}
      sx={{
        "& > div": {
          fontSize: PANEL_TEXT.value,
        },
        "& > span": {
          fontSize: PANEL_TEXT.unit,
        },
      }}
    />
  );
}
