import type { HistoryRange } from "../api";
import { getEchartsPreset } from "../widgets/echarts/registry";

const RANGES: HistoryRange[] = ["1h", "6h", "24h", "7d"];

export const DEFAULT_PANEL_CHART_PRESET = "line-basic";

function coerceOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

const RANGE_LABEL: Record<HistoryRange, string> = {
  "1h": "1h history",
  "6h": "6h history",
  "24h": "24h history",
  "7d": "7d history",
};

/** Words shown on the area line of a chart panel, such as "24h history". */
export function chartRangeLabel(range: HistoryRange): string {
  return RANGE_LABEL[range];
}

export function readPanelChartRange(config: Record<string, unknown> | undefined): HistoryRange {
  const raw =
    config?.chartRange ??
    (config?.appearance &&
    typeof config.appearance === "object" &&
    !Array.isArray(config.appearance)
      ? (config.appearance as Record<string, unknown>).chartRange
      : undefined);
  if (typeof raw === "string" && (RANGES as readonly string[]).includes(raw)) {
    return raw as HistoryRange;
  }
  return "24h";
}

export function readPanelChartPreset(config: Record<string, unknown> | undefined): string {
  const raw = config?.chartPresetId ?? config?.presetId;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const preset = getEchartsPreset(raw);
      if (preset.dataMode === "history") return raw;
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_PANEL_CHART_PRESET;
}

export function readPanelChartMinMax(
  config: Record<string, unknown> | undefined
): { min?: number; max?: number } {
  return {
    min: coerceOptionalNumber(config?.chartMin),
    max: coerceOptionalNumber(config?.chartMax),
  };
}
