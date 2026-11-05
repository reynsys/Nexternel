import { useEffect, useMemo, useState } from "react";
import { Stack, ToggleButton, ToggleButtonGroup, Typography, useTheme } from "@mui/material";
import ReactECharts from "echarts-for-react";
import { api, type BoardHealthHistory } from "../../../api";
import { InfoCard } from "./DeviceBits";

const RANGES = [
  { hours: 24, label: "24 hours" },
  { hours: 168, label: "7 days" },
  { hours: 336, label: "14 days" },
];
const REFRESH_MS = 60_000;

/**
 * Troubleshooting → Wi‑Fi signal history: the signal the board reported, with a gap wherever its reports
 * did not arrive. A falling line means a weak signal; gaps with a steady line mean its messages are not
 * getting through although the board hears the Wi‑Fi well.
 */
export function BoardSignalHistory({ deviceId }: { deviceId: string }) {
  const theme = useTheme();
  const [hours, setHours] = useState(24);
  const [history, setHistory] = useState<BoardHealthHistory | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .boardHealthHistory(deviceId, hours)
        .then((r) => {
          if (live) setHistory(r.history);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [deviceId, hours]);

  const option = useMemo(
    () => ({
      animation: false,
      grid: { left: 44, right: 12, top: 12, bottom: 24 },
      tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (v == null ? "No report" : `${String(v)} dBm`) },
      xAxis: { type: "time", axisLabel: { color: theme.palette.text.secondary, hideOverlap: true }, splitLine: { show: false } },
      yAxis: {
        type: "value",
        min: -100,
        max: -20,
        interval: 20,
        axisLabel: { color: theme.palette.text.secondary },
        splitLine: { lineStyle: { color: theme.palette.divider } },
      },
      series: [
        {
          name: "Wi‑Fi signal",
          type: "line",
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2, color: theme.palette.primary.main },
          itemStyle: { color: theme.palette.primary.main },
          data: (history?.points ?? []).map((p) => [p.at, p.rssi]),
        },
      ],
    }),
    [history, theme]
  );

  const missing = history ? history.expected - history.received : 0;

  return (
    <InfoCard
      title="Wi‑Fi signal history"
      action={
        <ToggleButtonGroup size="small" exclusive value={hours} onChange={(_, v: number | null) => v && setHours(v)} aria-label="Period shown">
          {RANGES.map((r) => (
            <ToggleButton key={r.hours} value={r.hours}>
              {r.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      }
    >
      {history && history.received ? (
        <>
          <ReactECharts option={option} notMerge style={{ height: 180, width: "100%" }} />
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <Typography variant="body2" color={missing > history.expected * 0.1 ? "warning.main" : "text.secondary"}>
              Reports received: {history.received} of {history.expected}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Signal: {history.weakest} to {history.strongest} dBm
            </Typography>
            <Typography variant="body2" color={history.mqttDrops > 2 ? "warning.main" : "text.secondary"}>
              Message service drops: {history.mqttDrops}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            A gap means no report arrived. A steady line with gaps means the board hears the Wi‑Fi well, but its messages are not getting through.
          </Typography>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No reports recorded in this period yet. The board sends one every minute.
        </Typography>
      )}
    </InfoCard>
  );
}
