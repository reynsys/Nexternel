/**
 * ECharts lab — local Vite entry only (`echarts-lab.html`). Not in the
 * production rollup input, so it never ships in dist.
 *
 * The first chart is the official temperature example, drawn by ECharts 6
 * with no Nexternel preset around it.
 */
import { createRoot } from "react-dom/client";
import ReactECharts from "echarts-for-react";
import { init } from "echarts";
import { GAUGE_PRESETS } from "./widgets/echarts/presets/gauges";
import type { EchartsBuildCtx } from "./widgets/echarts/types";

type Opt = Record<string, unknown>;

const officialTemperature: Opt = {
  series: [
    {
      type: "gauge",
      center: ["50%", "60%"],
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 60,
      splitNumber: 12,
      itemStyle: { color: "#FFAB91" },
      progress: { show: true, width: 30 },
      pointer: { show: false },
      axisLine: { lineStyle: { width: 30 } },
      axisTick: { distance: -45, splitNumber: 5, lineStyle: { width: 2, color: "#999" } },
      splitLine: { distance: -52, length: 14, lineStyle: { width: 3, color: "#999" } },
      axisLabel: { distance: -20, color: "#999", fontSize: 20 },
      anchor: { show: false },
      title: { show: false },
      detail: {
        valueAnimation: true,
        width: "60%",
        lineHeight: 40,
        borderRadius: 8,
        offsetCenter: [0, "-15%"],
        fontSize: 60,
        fontWeight: "bolder",
        formatter: "{value} °C",
        color: "inherit",
      },
      data: [{ value: 20 }],
    },
    {
      type: "gauge",
      center: ["50%", "60%"],
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 60,
      itemStyle: { color: "#FD7347" },
      progress: { show: true, width: 8 },
      pointer: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: { show: false },
      data: [{ value: 20 }],
    },
  ],
};

function buildCtx(extra: Partial<EchartsBuildCtx> = {}): EchartsBuildCtx {
  return {
    value: extra.value ?? 23.4,
    unit: extra.unit ?? "°C",
    title: "Temperature",
    kind: extra.kind ?? "temperature",
    min: extra.min ?? 0,
    max: extra.max ?? 60,
    points: [],
    range: "24h",
    ...extra,
  };
}

const namedHost = document.createElement("div");
namedHost.id = "named-export-chart";
namedHost.setAttribute("data-demo", "named-export");
namedHost.style.width = "320px";
namedHost.style.height = "240px";
namedHost.style.background = "#fff";
document.getElementById("root")!.before(namedHost);
init(namedHost).setOption({
  series: [{ type: "gauge", min: 0, max: 100, data: [{ value: 50 }] }],
});

createRoot(document.getElementById("root")!).render(
  <div style={{ background: "#111", padding: 16, fontFamily: "sans-serif" }}>
    <h2 style={{ color: "#fff" }}>ECharts 6 — official temperature example</h2>
    <div data-demo="official-temperature" style={{ width: 480, height: 420, background: "#fff" }}>
      <ReactECharts option={officialTemperature} style={{ width: "100%", height: "100%" }} />
    </div>
    <h2 style={{ color: "#fff" }}>Live presets</h2>
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      {GAUGE_PRESETS.map((preset) => (
        <div key={preset.id} style={{ marginRight: 16 }}>
          <div style={{ color: "#fff", marginBottom: 4 }}>{preset.id}</div>
          <div data-demo={preset.id} style={{ width: 373, height: 358, background: "#1a1a1a" }}>
            <ReactECharts
              option={preset.buildOption(buildCtx()) as Opt}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);
