import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));

test("EChartsHost consumes VisualizationRect and does not add ResizeObserver", () => {
  const source = readFileSync(join(dir, "EChartsHost.tsx"), "utf8");
  assert.match(source, /useVisualizationRect\(/);
  assert.doesNotMatch(source, /ResizeObserver/);
  assert.match(source, /data-nx-visualization-host/);
  assert.match(source, /chartRef\.current\?\.resize/);
});

test("EChartsWidgetBody does not remount chart on scale bucket changes", () => {
  const source = readFileSync(join(dir, "EChartsWidgetBody.tsx"), "utf8");
  assert.doesNotMatch(source, /key=\{`\$\{config\.presetId\}-\$\{scalePx\}`\}/);
  assert.doesNotMatch(source, /new ResizeObserver/);
  assert.doesNotMatch(source, /applyGaugePresentation/);
  assert.doesNotMatch(source, /enforceAllGaugeSeries/);
  assert.match(source, /useEChartsHost\(/);
  assert.doesNotMatch(source, /withGaugeMedia/);
  assert.doesNotMatch(source, /gaugeMediaBucket/);
  assert.match(source, /width: hostSize\.w/);
});

test("dashboard echarts path wires VisualizationSlot to EChartsHost", () => {
  const source = readFileSync(join(dir, "EchartsContributionWidget.tsx"), "utf8");
  assert.match(source, /VisualizationSlot/);
  assert.match(source, /EChartsHost/);
  assert.match(source, /EChartsWidgetBody/);
});

test("CapabilityHistoryChart uses VisualizationSlot and EChartsHost without local ResizeObserver", () => {
  const panelsDir = join(dir, "..", "..", "panels");
  const source = readFileSync(join(panelsDir, "CapabilityHistoryChart.tsx"), "utf8");
  assert.match(source, /VisualizationSlot/);
  assert.match(source, /EChartsHost/);
  assert.match(source, /useEChartsHost\(/);
  assert.doesNotMatch(source, /new ResizeObserver/);
});
