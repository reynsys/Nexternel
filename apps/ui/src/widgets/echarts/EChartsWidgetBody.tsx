import { useEffect, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ReactECharts from "echarts-for-react";
import type { Capability, HistoryRange, WidgetInstance } from "../../api";
import { api } from "../../api";
import { liveValue, parseEchartsConfig, resolveMinMax } from "./config";
import { primaryCapabilityId } from "../../lib/widget-bindings";
import { buildFinalOption } from "./merge-option";
import { echartsInitTheme, echartsPaletteFromTheme } from "./chart-theme";
import { applySafeChartTooltip } from "./chart-tooltip";
import { getEchartsPreset } from "./registry";
import type { EchartsBuildCtx, HistoryPoint } from "./types";
import { useDashboardTileChrome } from "../../lib/dashboard-tile-context";
import { useEChartsHost } from "./EChartsHost";

function capabilityIdOf(widget: WidgetInstance): string | null {
  const id = primaryCapabilityId(widget.bindings);
  return id ?? null;
}

export function EChartsWidgetBody({
  widget,
  cap,
  dataLabel,
  tileTitle = null,
}: {
  widget: WidgetInstance;
  cap: Capability | undefined;
  dataLabel: string;
  tileTitle?: string | null;
}) {
  const config = parseEchartsConfig(widget.config);
  const preset = getEchartsPreset(config.presetId);
  const theme = useTheme();
  const chartPalette = useMemo(() => echartsPaletteFromTheme(theme), [theme]);
  const initTheme = useMemo(() => echartsInitTheme(theme), [theme]);
  const range: HistoryRange = config.range ?? "24h";
  const capabilityId = capabilityIdOf(widget);
  const { titleTile } = useDashboardTileChrome();
  const { rect: visualizationRect, chartRef } = useEChartsHost();
  const rangeInTitleTile = Boolean(titleTile?.rangeNote);
  const hostSize = useMemo(
    () => ({ w: visualizationRect.width, h: visualizationRect.height }),
    [visualizationRect.width, visualizationRect.height]
  );

  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const needsHistory = preset.dataMode === "history";

  useEffect(() => {
    if (!needsHistory) {
      setPoints([]);
      setError(null);
      return;
    }
    if (!capabilityId) {
      setPoints([]);
      setError("No capability bound");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .history(capabilityId, range)
      .then((res) => {
        if (cancelled) return;
        setPoints(res.points);
        if (res.points.length === 0) {
          setError("No history data for this range yet");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setPoints([]);
        setError(err instanceof Error ? err.message : "History load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsHistory, capabilityId, range]);

  const { min, max } = resolveMinMax(config, cap);
  const live = liveValue(cap);
  const chartName = dataLabel.trim() || tileTitle || "";

  const ctx: EchartsBuildCtx = useMemo(
    () => ({
      value: live ?? 0,
      unit: cap?.unit ?? "",
      title: chartName,
      kind: cap?.kind ?? "",
      min,
      max,
      accent: config.accent,
      palette: chartPalette,
      points,
      range,
      tileWidth: hostSize.w,
      tileHeight: hostSize.h,
    }),
    [cap, chartName, min, max, config.accent, chartPalette, points, range, live, hostSize.w, hostSize.h]
  );

  const option = useMemo(() => {
    try {
      const built = preset.buildOption(ctx);
      if (preset.family === "gauge") return built;
      return applySafeChartTooltip(buildFinalOption(built, config.optionOverride));
    } catch (err) {
      console.error("ECharts option build failed", err);
      return { title: { text: "Chart error", left: "center", top: "center" } };
    }
  }, [preset, ctx, config.optionOverride, chartPalette]);

  if (preset.needsCapability && !capabilityId && preset.dataMode !== "none") {
    return (
      <Typography variant="body2" color="text.secondary">
        No capability bound
      </Typography>
    );
  }

  if (preset.needsCapability && capabilityId && !cap) {
    return (
      <Typography variant="body2" color="text.secondary">
        Capability missing — edit widget and re-select
      </Typography>
    );
  }

  if (needsHistory && loading && points.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading history…
      </Typography>
    );
  }

  if (needsHistory && error && points.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {error}
      </Typography>
    );
  }

  const renderer = needsHistory || preset.family === "heatmap" ? "canvas" : "svg";
  const chartReady = hostSize.w > 0 && hostSize.h > 0;

  return (
    <Box
      data-nx-chart-preset={config.presetId}
      sx={{
        position: "relative",
        flex: 1,
        alignSelf: "stretch",
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {needsHistory && !rangeInTitleTile && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ position: "absolute", top: 0, right: 4, zIndex: 1 }}
        >
          {range}
          {error ? ` · ${error}` : ""}
        </Typography>
      )}
      {chartReady && (
        <ReactECharts
          theme={initTheme}
          option={option}
          style={{ width: "100%", height: "100%", display: "block", flex: 1, minHeight: 0 }}
          opts={{ renderer }}
          notMerge
          onChartReady={(chart) => {
            chartRef.current = chart;
            if (hostSize.w > 0 && hostSize.h > 0) {
              chart.resize({ width: hostSize.w, height: hostSize.h });
            }
          }}
        />
      )}
    </Box>
  );
}
