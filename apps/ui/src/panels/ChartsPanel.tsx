import { useEffect, useState } from "react";
import { Typography } from "@mui/material";
import type { HistoryPoint, HistoryRange, ResolvedPanelCapability } from "../api";
import { api } from "../api";
import { PanelItemGrid } from "../components/PanelItemGrid";
import { PanelTile } from "../components/PanelTile";
import type { PanelAppearanceLayout } from "../lib/panel-appearance";
import { CapabilityHistoryChart } from "./CapabilityHistoryChart";

const MAX_CHARTS = 12;

type HistoryLoadState = {
  loading: boolean;
  error: string | null;
  points: HistoryPoint[];
};

type Props = {
  capabilities: ResolvedPanelCapability[];
  range: HistoryRange;
  presetId?: string;
  chartMin?: number;
  chartMax?: number;
  layout?: PanelAppearanceLayout;
  /** Section tile title — when set on a single-series chart, chrome must not repeat it. */
  panelTitle?: string | null;
};

function friendlyHistoryError(message: string): string {
  if (message.includes("HTTP 429")) {
    return "Too many chart requests — wait a moment and refresh";
  }
  return message;
}

export function ChartsPanel({
  capabilities,
  range,
  presetId,
  chartMin,
  chartMax,
  layout = "card",
  panelTitle,
}: Props) {
  const chartCaps = capabilities.filter((c) => c.kind !== "switch");
  const shown = chartCaps.slice(0, MAX_CHARTS);
  const shownIdsKey = shown.map((c) => c.id).join(",");

  const [historyByCap, setHistoryByCap] = useState<Record<string, HistoryLoadState>>({});

  useEffect(() => {
    if (shown.length === 0) {
      setHistoryByCap({});
      return;
    }

    let cancelled = false;
    const ids = shown.map((c) => c.id);
    setHistoryByCap(
      Object.fromEntries(
        ids.map((id) => [id, { loading: true, error: null, points: [] } satisfies HistoryLoadState])
      )
    );

    void api
      .historyBatch(ids, range)
      .then((batch) => {
        if (cancelled) return;
        const next: Record<string, HistoryLoadState> = {};
        for (const id of ids) {
          const series = batch.series.find((s) => s.capabilityId === id);
          if (!series) {
            next[id] = { loading: false, error: "No data", points: [] };
            continue;
          }
          const err =
            series.error ??
            (series.points.length === 0 ? "No data" : null);
          next[id] = {
            loading: false,
            error: err ? friendlyHistoryError(err) : null,
            points: series.points,
          };
        }
        setHistoryByCap(next);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = friendlyHistoryError(
          err instanceof Error ? err.message : "Failed to load history"
        );
        setHistoryByCap(
          Object.fromEntries(
            ids.map((id) => [id, { loading: false, error: message, points: [] }])
          )
        );
      });

    return () => {
      cancelled = true;
    };
  }, [shownIdsKey, range]);

  const overflow = chartCaps.length - shown.length;
  const hideItemTitle = Boolean(panelTitle?.trim()) && shown.length <= 1;

  if (chartCaps.length === 0) {
    return (
      <PanelTile sx={{ alignItems: "center", justifyContent: "center", p: 1.5 }}>
        <Typography color="text.secondary" role="status" variant="body2" textAlign="center">
          No chartable history is currently available for this panel.
        </Typography>
      </PanelTile>
    );
  }

  return (
    <PanelItemGrid
      layout={layout}
      rowSize="fluid"
      itemCount={shown.length}
      footer={
        overflow > 0 ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.75, display: "block", flexShrink: 0, textAlign: "right" }}
          >
            +{overflow} more sensor(s) not shown — narrow the Area scope.
          </Typography>
        ) : undefined
      }
    >
      {shown.map((cap) => (
        <CapabilityHistoryChart
          key={cap.id}
          capability={cap}
          range={range}
          presetId={presetId}
          chartMin={chartMin}
          chartMax={chartMax}
          prefetched={historyByCap[cap.id]}
          hideItemTitle={hideItemTitle}
        />
      ))}
    </PanelItemGrid>
  );
}
