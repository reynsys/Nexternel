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
          fontSize: "clamp(1rem, min(18cqi, 42cqb), 3.75rem)",
        },
        "& > span": {
          fontSize: "clamp(0.75rem, 10cqi, 1.35rem)",
        },
      }}
    />
  );
}
