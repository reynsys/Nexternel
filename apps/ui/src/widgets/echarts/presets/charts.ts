import type { EchartsBuildCtx, EchartsPreset } from "../types";
import type { HistoryRange } from "../../../api";
import { chartFont } from "../types";

function timeSeries(ctx: EchartsBuildCtx): [string, number][] {
  return ctx.points.map((p) => [p.t, p.v]);
}

function accent(ctx: EchartsBuildCtx, fallback = "#5470c6"): string {
  if (ctx.accent) return ctx.accent;
  if (ctx.palette?.accent) return ctx.palette.accent;
  return fallback;
}

function yFmt(ctx: EchartsBuildCtx) {
  return (v: number) => (ctx.unit ? `${v}${ctx.unit}` : String(v));
}

const historyGrid = { left: 48, right: 16, top: 28, bottom: 32 };

/**
 * Range-aware time axis — short windows must not show year / calendar-day noise.
 * (ECharts default tick levels pick `{yyyy}` / `{d} {MMM}` on 24h charts.)
 */
function timeXAxisFor(ctx: EchartsBuildCtx): Record<string, unknown> {
  const range: HistoryRange = ctx.range || "24h";
  const short = range === "1h" || range === "6h" || range === "24h";

  if (short) {
    return {
      type: "time",
      minInterval: range === "1h" ? 5 * 60 * 1000 : 60 * 60 * 1000,
      axisLabel: {
        fontSize: chartFont(ctx, 10),
        hideOverlap: true,
        color: ctx.palette?.textMuted,
        // Force clock time only — never year / month / day templates
        formatter: "{HH}:{mm}",
      },
    };
  }

  // 7d+: allow day labels, still avoid bare year ticks
  return {
    type: "time",
    minInterval: 6 * 60 * 60 * 1000,
    axisLabel: {
      fontSize: chartFont(ctx, 10),
      hideOverlap: true,
      color: ctx.palette?.textMuted,
      formatter: {
        year: "{MMM} {yyyy}",
        month: "{d} {MMM}",
        day: "{d} {MMM}",
        hour: "{d} {MMM}\n{HH}:{mm}",
        minute: "{HH}:{mm}",
        second: "{HH}:{mm}",
      },
    },
  };
}

/**
 * Y-axis honours Edit Chart Min/Max (via ctx from resolveMinMax).
 * Without this, `scale: true` auto-zooms to data (e.g. 30–38) and ignores 0–100.
 */
function valueYAxis(
  ctx: EchartsBuildCtx,
  opts?: { flip?: boolean }
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: "value",
    min: ctx.min,
    max: ctx.max,
    scale: false,
    axisLabel: { fontSize: chartFont(ctx, 10), formatter: yFmt(ctx), color: ctx.palette?.textMuted },
  };
  if (opts?.flip) {
    /* category charts put value on xAxis — caller handles */
  }
  return base;
}

function valueXAxis(ctx: EchartsBuildCtx): Record<string, unknown> {
  return {
    type: "value",
    min: ctx.min,
    max: ctx.max,
    scale: false,
    axisLabel: { fontSize: chartFont(ctx, 10), formatter: yFmt(ctx), color: ctx.palette?.textMuted },
  };
}

export const CHART_PRESETS: EchartsPreset[] = [
  {
    id: "line-basic",
    label: "Line (basic)",
    description: "Basic time-series line from history",
    family: "line",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "line",
          showSymbol: false,
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx) },
        },
      ],
    }),
  },
  {
    id: "line-smooth",
    label: "Line (smooth)",
    description: "Smoothed history line",
    family: "line",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "line",
          smooth: true,
          showSymbol: false,
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx) },
        },
      ],
    }),
  },
  {
    id: "line-step",
    label: "Line (step)",
    description: "Stepped history line (holds value between points)",
    family: "line",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "line",
          step: "end",
          showSymbol: false,
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx) },
        },
      ],
    }),
  },
  {
    id: "line-symbols",
    label: "Line (with points)",
    description: "Line with visible data markers",
    family: "line",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "line",
          showSymbol: true,
          symbol: "circle",
          symbolSize: 6,
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx) },
        },
      ],
    }),
  },
  {
    id: "line-dashed",
    label: "Line (dashed)",
    description: "Dashed line style",
    family: "line",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "line",
          showSymbol: false,
          lineStyle: { type: "dashed", width: 2 },
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx) },
        },
      ],
    }),
  },
  {
    id: "line-mark",
    label: "Line (avg / min / max)",
    description: "Line with average, min and max mark lines",
    family: "line",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "line",
          showSymbol: false,
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx) },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed" },
            data: [{ type: "average", name: "Avg" }, { type: "min" }, { type: "max" }],
            label: { fontSize: chartFont(ctx, 9) },
          },
        },
      ],
    }),
  },
  {
    id: "line-end-label",
    label: "Line (end label)",
    description: "Smooth line with value label at the latest point",
    family: "line",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => {
      const data = timeSeries(ctx);
      return {
        animation: false,
        grid: { ...historyGrid, right: 48 },
        tooltip: { trigger: "axis" },
        xAxis: timeXAxisFor(ctx),
        yAxis: valueYAxis(ctx),
        series: [
          {
            name: ctx.title,
            type: "line",
            smooth: true,
            showSymbol: false,
            data,
            itemStyle: { color: accent(ctx) },
            endLabel: {
              show: data.length > 0,
              formatter: (p: { value?: [string, number] }) => {
                const v = p.value?.[1];
                if (v == null) return "";
                return ctx.unit ? `${v}${ctx.unit}` : String(v);
              },
              fontSize: chartFont(ctx, 11),
              color: accent(ctx),
            },
            labelLayout: { moveOverlap: "shiftY" },
          },
        ],
      };
    },
  },
  {
    id: "area-basic",
    label: "Area (filled)",
    description: "Filled area over time",
    family: "area",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: { opacity: 0.35 },
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx) },
        },
      ],
    }),
  },
  {
    id: "area-gradient",
    label: "Area (gradient)",
    description: "Area with vertical colour gradient fill",
    family: "area",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => {
      const c = accent(ctx);
      return {
        animation: false,
        grid: historyGrid,
        tooltip: { trigger: "axis" },
        xAxis: timeXAxisFor(ctx),
        yAxis: valueYAxis(ctx),
        series: [
          {
            name: ctx.title,
            type: "line",
            smooth: true,
            showSymbol: false,
            data: timeSeries(ctx),
            itemStyle: { color: c },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: c },
                  { offset: 1, color: "rgba(0,0,0,0)" },
                ],
              },
            },
          },
        ],
      };
    },
  },
  {
    id: "area-stack",
    label: "Area (stacked look)",
    description: "Area with stacked visual (single series)",
    family: "area",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "line",
          stack: "Total",
          areaStyle: {},
          showSymbol: false,
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx, "#91cc75") },
        },
      ],
    }),
  },
  {
    id: "bar-basic",
    label: "Bar (vertical)",
    description: "Vertical bars from history samples",
    family: "bar",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "bar",
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx) },
        },
      ],
    }),
  },
  {
    id: "bar-rounded",
    label: "Bar (rounded)",
    description: "Vertical bars with rounded tops",
    family: "bar",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "axis" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          name: ctx.title,
          type: "bar",
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx), borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
  },
  {
    id: "bar-horizontal",
    label: "Bar (horizontal)",
    description: "Category bars (recent samples)",
    family: "bar",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => {
      const sample = ctx.points.slice(-12);
      return {
        animation: false,
        grid: { left: 72, right: 16, top: 16, bottom: 24 },
        tooltip: { trigger: "axis" },
        yAxis: {
          type: "category",
          data: sample.map((p) =>
            new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          ),
          axisLabel: { fontSize: chartFont(ctx, 9) },
        },
        xAxis: valueXAxis(ctx),
        series: [
          {
            type: "bar",
            data: sample.map((p) => p.v),
            itemStyle: { color: accent(ctx) },
          },
        ],
      };
    },
  },
  {
    id: "bar-stack",
    label: "Bar (stacked look)",
    description: "Stacked column look from history samples",
    family: "bar",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => {
      const sample = ctx.points.slice(-16);
      const short = ctx.range === "1h" || ctx.range === "6h" || ctx.range === "24h";
      return {
        animation: false,
        grid: historyGrid,
        tooltip: { trigger: "axis" },
        xAxis: {
          type: "category",
          data: sample.map((p) =>
            short
              ? new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : new Date(p.t).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                })
          ),
          axisLabel: { fontSize: chartFont(ctx, 9), rotate: 30 },
        },
        yAxis: valueYAxis(ctx),
        series: [
          {
            name: ctx.title,
            type: "bar",
            stack: "total",
            data: sample.map((p) => p.v),
            itemStyle: { color: accent(ctx) },
          },
        ],
      };
    },
  },
  {
    id: "pie-basic",
    label: "Pie chart",
    description: "Live value vs remaining-to-max",
    family: "pie",
    category: "sensors",
    dataMode: "live",
    needsCapability: true,
    defaultSize: { w: 4, h: 4 },
    buildOption: (ctx) => {
      const used = Math.max(0, ctx.value - ctx.min);
      const span = Math.max(1, ctx.max - ctx.min);
      const remain = Math.max(0, span - used);
      return {
        tooltip: { trigger: "item" },
        series: [
          {
            type: "pie",
            radius: "70%",
            data: [
              { name: ctx.title || "Value", value: used },
              { name: "Remaining", value: remain },
            ],
            label: { fontSize: chartFont(ctx, 11) },
            itemStyle: { borderRadius: 4 },
            color: [accent(ctx), "rgba(128,128,128,0.25)"],
          },
        ],
      };
    },
  },
  {
    id: "pie-doughnut",
    label: "Doughnut",
    description: "Ring pie of value vs max",
    family: "pie",
    category: "sensors",
    dataMode: "live",
    needsCapability: true,
    defaultSize: { w: 4, h: 4 },
    buildOption: (ctx) => {
      const used = Math.max(0, ctx.value - ctx.min);
      const span = Math.max(1, ctx.max - ctx.min);
      const remain = Math.max(0, span - used);
      return {
        tooltip: { trigger: "item" },
        series: [
          {
            type: "pie",
            radius: ["45%", "70%"],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 6 },
            label: {
              show: true,
              position: "center",
              formatter: () =>
                ctx.unit
                  ? `${Number.isInteger(ctx.value) ? ctx.value : ctx.value.toFixed(1)}\n${ctx.unit}`
                  : String(Number.isInteger(ctx.value) ? ctx.value : ctx.value.toFixed(1)),
              fontSize: chartFont(ctx, 14),
            },
            data: [
              { name: "Value", value: used },
              { name: "Remaining", value: remain },
            ],
            color: [accent(ctx, "#91cc75"), "rgba(128,128,128,0.2)"],
          },
        ],
      };
    },
  },
  {
    id: "pie-rose",
    label: "Nightingale (rose)",
    description: "Rose pie from recent history buckets",
    family: "pie",
    category: "sensors",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 4, h: 4 },
    buildOption: (ctx) => {
      const sample = ctx.points.slice(-8);
      return {
        tooltip: { trigger: "item" },
        series: [
          {
            type: "pie",
            roseType: "area",
            radius: ["15%", "70%"],
            itemStyle: { borderRadius: 4 },
            data:
              sample.length > 0
                ? sample.map((p, i) => ({
                    name: `#${i + 1}`,
                    value: Math.abs(p.v),
                  }))
                : [{ name: "Value", value: Math.abs(ctx.value) || 1 }],
          },
        ],
      };
    },
  },
  {
    id: "scatter-basic",
    label: "Scatter",
    description: "Scatter of history points",
    family: "scatter",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 6, h: 3 },
    buildOption: (ctx) => ({
      animation: false,
      grid: historyGrid,
      tooltip: { trigger: "item" },
      xAxis: timeXAxisFor(ctx),
      yAxis: valueYAxis(ctx),
      series: [
        {
          type: "scatter",
          symbolSize: 8,
          data: timeSeries(ctx),
          itemStyle: { color: accent(ctx, "#ee6666") },
        },
      ],
    }),
  },
  {
    id: "radar-basic",
    label: "Radar",
    description: "Radar axes from min/max and live value",
    family: "radar",
    category: "sensors",
    dataMode: "live",
    needsCapability: true,
    defaultSize: { w: 4, h: 4 },
    buildOption: (ctx) => {
      const mid = (ctx.min + ctx.max) / 2;
      return {
        radar: {
          indicator: [
            { name: ctx.title || "Value", max: ctx.max },
            { name: "Mid", max: ctx.max },
            { name: "Span", max: ctx.max },
            { name: "Floor", max: ctx.max },
            { name: "Ceil", max: ctx.max },
          ],
        },
        series: [
          {
            type: "radar",
            data: [
              {
                value: [ctx.value, mid, ctx.max - ctx.min, ctx.min, ctx.max],
                name: ctx.title,
                areaStyle: { opacity: 0.25 },
              },
            ],
            itemStyle: { color: accent(ctx) },
          },
        ],
      };
    },
  },
  {
    id: "funnel-basic",
    label: "Funnel",
    description: "Funnel of value bands toward max",
    family: "funnel",
    category: "sensors",
    dataMode: "live",
    needsCapability: true,
    defaultSize: { w: 4, h: 4 },
    buildOption: (ctx) => {
      const v = Math.max(0, ctx.value);
      return {
        tooltip: { trigger: "item" },
        series: [
          {
            type: "funnel",
            left: "10%",
            width: "80%",
            label: { fontSize: chartFont(ctx, 11) },
            data: [
              { name: "Max", value: ctx.max },
              { name: "Value", value: v },
              { name: "Half", value: v / 2 },
              { name: "Min", value: Math.max(ctx.min, 0) },
            ].sort((a, b) => b.value - a.value),
          },
        ],
      };
    },
  },
  {
    id: "heatmap-basic",
    label: "Heatmap",
    description: "Hour × weekday intensity from history",
    family: "heatmap",
    category: "history",
    dataMode: "history",
    needsCapability: true,
    defaultSize: { w: 8, h: 4 },
    buildOption: (ctx) => {
      const hours = Array.from({ length: 24 }, (_, i) => String(i));
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const bucket = new Map<string, { sum: number; n: number }>();
      for (const p of ctx.points) {
        const d = new Date(p.t);
        const key = `${d.getDay()}-${d.getHours()}`;
        const cur = bucket.get(key) ?? { sum: 0, n: 0 };
        cur.sum += p.v;
        cur.n += 1;
        bucket.set(key, cur);
      }
      const data: [number, number, number][] = [];
      let vmax = ctx.max;
      let vmin = ctx.min;
      for (const [key, { sum, n }] of bucket) {
        const [day, hour] = key.split("-").map(Number);
        const avg = sum / n;
        vmax = Math.max(vmax, avg);
        vmin = Math.min(vmin, avg);
        data.push([hour!, day!, Math.round(avg * 100) / 100]);
      }
      return {
        tooltip: { position: "top" },
        grid: { left: 40, right: 16, top: 16, bottom: 40 },
        xAxis: { type: "category", data: hours, splitArea: { show: true } },
        yAxis: { type: "category", data: days, splitArea: { show: true } },
        visualMap: {
          min: vmin,
          max: vmax <= vmin ? vmin + 1 : vmax,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          inRange: { color: ["#e0f3ff", accent(ctx, "#5470c6")] },
        },
        series: [
          {
            type: "heatmap",
            data,
            label: { show: false },
            emphasis: { itemStyle: { shadowBlur: 6 } },
          },
        ],
      };
    },
  },
  {
    id: "blank",
    label: "ECharts blank",
    description: "Empty shell — configure entirely via Advanced JSON",
    family: "custom",
    category: "system",
    dataMode: "none",
    needsCapability: false,
    defaultSize: { w: 4, h: 4 },
    buildOption: (ctx) => ({
      title: {
        text: "Blank ECharts",
        subtext: "Set optionOverride in Edit",
        left: "center",
        top: "middle",
        textStyle: { fontSize: chartFont(ctx, 14) },
        subtextStyle: { fontSize: chartFont(ctx, 11) },
      },
    }),
  },
];
