import { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import ReactECharts from "echarts-for-react";
import type { HistoryPoint, HistoryRange, ResolvedPanelCapability } from "../api";
import { api } from "../api";
import { echartsInitTheme, echartsPaletteFromTheme } from "../widgets/echarts/chart-theme";
import { applySafeChartTooltip } from "../widgets/echarts/chart-tooltip";
import { defaultRangeForKind } from "../widgets/echarts/config";
import { buildFinalOption } from "../widgets/echarts/merge-option";
import { getEchartsPreset } from "../widgets/echarts";
import { EChartsHost, useEChartsHost } from "../widgets/echarts/EChartsHost";
import { capabilityOptionPrimary } from "../lib/capability-picker";
import { asSwitchCapability } from "./panel-capabilities";
import { PanelItemChrome } from "./PanelItemChrome";
import { VisualizationSlot } from "../components/VisualizationSlot";
import { PanelValueSummary } from "./PanelValueSummary";
import { usePanelResponsiveSemanticState } from "./responsive";
import { parseCapabilityReading } from "./parse-capability-reading";
import { useSkin } from "../skins/SkinProvider";

type PrefetchedHistory = {
  loading: boolean;
  error: string | null;
  points: HistoryPoint[];
};

type Props = {
  capability: ResolvedPanelCapability;
  range: HistoryRange;
  presetId?: string;
  chartMin?: number;
  chartMax?: number;
  /** Parent-loaded history (Charts panel batch request). */
  prefetched?: PrefetchedHistory;
  /** When the section tile already names the series, omit chrome title. */
  hideItemTitle?: boolean;
};

function resolvePanelChartMinMax(
  capability: ResolvedPanelCapability,
  chartMin?: number,
  chartMax?: number
): { min: number; max: number } {
  const fallback = defaultRangeForKind(capability.kind);
  let { min, max } = fallback;
  if (chartMin !== undefined) min = chartMin;
  if (chartMax !== undefined) max = chartMax;
  if (min >= max) max = min + 1;
  return { min, max };
}

type ChartCanvasProps = {
  capability: ResolvedPanelCapability;
  range: HistoryRange;
  presetId: string;
  chartMin?: number;
  chartMax?: number;
  loading: boolean;
  error: string | null;
  points: HistoryPoint[];
};

function CapabilityHistoryChartCanvas({
  capability,
  range,
  presetId,
  chartMin,
  chartMax,
  loading,
  error,
  points,
}: ChartCanvasProps) {
  const theme = useTheme();
  const chartPalette = useMemo(() => echartsPaletteFromTheme(theme), [theme]);
  const initTheme = useMemo(() => echartsInitTheme(theme), [theme]);
  const preset = getEchartsPreset(presetId);
  const { rect, chartRef } = useEChartsHost();
  const { textScale } = useSkin();

  const option = useMemo(() => {
    const { min, max } = resolvePanelChartMinMax(capability, chartMin, chartMax);
    const built = preset.buildOption({
      value: 0,
      unit: capability.unit ?? "",
      title: capability.name,
      kind: capability.kind,
      min,
      max,
      palette: chartPalette,
      points,
      range,
      textScale,
    });
    const merged = buildFinalOption(built, undefined);
    return applySafeChartTooltip(merged);
  }, [preset, capability, chartMin, chartMax, points, range, chartPalette, textScale]);

  const ready = rect.width > 0 && rect.height > 0;

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (error && points.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        {error}
      </Typography>
    );
  }

  if (!ready) return null;

  return (
    <ReactECharts
          key={preset.id}
      theme={initTheme}
      option={option}
      style={{ width: "100%", height: "100%", display: "block", flex: 1, minHeight: 0 }}
      opts={{ renderer: "canvas" }}
      onChartReady={(chart) => {
        chartRef.current = chart;
        if (rect.width > 0 && rect.height > 0) {
          chart.resize({ width: rect.width, height: rect.height });
        }
      }}
    />
  );
}

export function CapabilityHistoryChart({
  capability,
  range,
  presetId = "line-basic",
  chartMin,
  chartMax,
  prefetched,
  hideItemTitle = false,
}: Props) {
  const [loading, setLoading] = useState(prefetched?.loading ?? true);
  const [error, setError] = useState<string | null>(prefetched?.error ?? null);
  const [points, setPoints] = useState<HistoryPoint[]>(prefetched?.points ?? []);

  useEffect(() => {
    if (prefetched) {
      setLoading(prefetched.loading);
      setError(prefetched.error);
      setPoints(prefetched.points);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .history(capability.id, range)
      .then((res) => {
        if (cancelled) return;
        setPoints(res.points);
        if (res.points.length === 0) {
          setError("No data");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setPoints([]);
        const message = err instanceof Error ? err.message : "Failed";
        setError(message.includes("HTTP 429") ? "Too many chart requests — wait a moment" : message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [capability.id, range, prefetched]);

  const { state: responsiveState } = usePanelResponsiveSemanticState();
  const showSummary =
    responsiveState === "summary" || responsiveState === "insufficient";

  const latestPoint = points.length > 0 ? points[points.length - 1] : null;

  if (showSummary) {
    const reading = latestPoint
      ? {
          value: String(latestPoint.v),
          unit: capability.unit ?? "",
        }
      : parseCapabilityReading(capability);
    return (
      <PanelItemChrome
        cap={capability}
        title={hideItemTitle ? null : capabilityOptionPrimary(asSwitchCapability(capability))}
      >
        <PanelValueSummary
          label={capability.name}
          value={reading.value}
          unit={reading.unit || undefined}
        />
      </PanelItemChrome>
    );
  }

  return (
    <PanelItemChrome
      cap={capability}
      title={hideItemTitle ? null : capabilityOptionPrimary(asSwitchCapability(capability))}
    >
      <VisualizationSlot>
        <EChartsHost>
          <CapabilityHistoryChartCanvas
            capability={capability}
            range={range}
            presetId={presetId}
            chartMin={chartMin}
            chartMax={chartMax}
            loading={loading}
            error={error}
            points={points}
          />
        </EChartsHost>
      </VisualizationSlot>
    </PanelItemChrome>
  );
}

