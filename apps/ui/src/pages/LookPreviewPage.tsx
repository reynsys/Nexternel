import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Stack } from "@mui/material";
import WeekendOutlinedIcon from "@mui/icons-material/WeekendOutlined";
import { answerWithSamples, type Capability, type HistoryRange, type PanelInstance, type PanelResolveResult, type ResolvedPanelCapability } from "../api";
import { LookLayer, type SkinControls } from "../skins/SkinProvider";
import { getSkin, listSkins } from "../skins/registry";
import { normalizeThemePrefs, type ThemePrefs } from "../skins/themePrefs";
import { loadAddons } from "../skins/looks/addon-loader";
import { DashboardDataRuntimeProvider } from "../lib/dashboard-data-runtime/DashboardDataRuntimeContext";
import type { PanelResolveBatchFetch } from "../lib/dashboard-data-runtime/panel-resolver-batcher";
import type { CapabilityStatus } from "../lib/dashboard-data-runtime/status-store";
import { decodePanelInstance } from "../lib/panel-compatibility/normalize-panel";
import { DashboardSectionFrame } from "../components/DashboardSectionFrame";
import { SectionGrid } from "../components/SectionGrid";
import {
  LOOK_PREVIEW_HEIGHT,
  LOOK_PREVIEW_PREFS,
  LOOK_PREVIEW_READY,
  type LookPreviewMessage,
  type LookPreviewShow,
} from "../lib/look-preview-messages";

/**
 * The Appearance preview's own page (/look-preview), shown inside Settings → Appearance and
 * Users → Edit → Appearance. It draws a dashboard section with the real panels, in the settings the
 * page sends it, with sample readings: nothing here reaches a device or saves anything.
 */

const AREA = "Living Room";
const now = new Date().toISOString();

function sample(id: string, kind: string, name: string, unit: string | null, value: unknown, hasCommand = false): Capability {
  return {
    id,
    deviceId: "look-preview",
    deviceName: "Sample device",
    roomId: null,
    roomName: AREA,
    kind,
    name,
    icon: "auto",
    unit,
    sourceType: hasCommand ? "relay" : "sensor",
    hasCommand,
    features: null,
    statusLight: null,
    systemId: null,
    areaId: "look-preview-area",
    groupId: null,
    serviceId: null,
    state: { value, quality: "good", updatedAt: now },
  } as Capability;
}

const T = "look-preview-temperature";
const POWER = "look-preview-power";
const ENERGY = "look-preview-energy";
const HEATING = "look-preview-heating";
const LIGHT = "look-preview-light";
const BLINDS = "look-preview-blinds";

const CAPABILITIES: Capability[] = [
  sample(T, "temperature", "Temperature", "°C", 21.4),
  sample(POWER, "power", "Power now", "W", 1240),
  sample(ENERGY, "energy", "Energy", "kWh", 9.6),
  { ...sample(HEATING, "thermostat", "Heating", null, { on: true, target: 21.5, current: 20.8, heating: true, humidity: 48 }, true), features: { min: 10, max: 30, step: 0.5 } },
  { ...sample(LIGHT, "light", "Ceiling light", null, { on: true, brightness: 70, color: { h: 32, s: 55 } }, true), features: { brightness: true, color: true } },
  sample(BLINDS, "cover", "Blinds", null, { position: 60 }, true),
];

const STATUSES: CapabilityStatus[] = [{ capabilityId: T, state: "ok", since: now, settings: null, custom: false }];

const scope = (capabilityIds: string[]) => ({
  areaIds: [],
  groupIds: [],
  cameraIds: [],
  systemIds: [],
  contentMode: capabilityIds.length ? "manual" : "auto",
  capabilityIds,
  inheritSectionArea: false,
});

const card = { layout: "card", direction: "across", itemStyle: "auto" };
const at = (i: string, x: number, y: number, w: number, h: number) => ({ i, x, y, w, h });
const control = (id: string, title: string, cap: string, layout: ReturnType<typeof at>) => ({
  id, type: "panel.controls", title, config: { appearance: card, panelScope: scope([cap]), configSchemaVersion: 1 }, layout, bindings: {},
});
const gauge = (id: string, title: string, cap: string, presetId: string, max: number, layout: ReturnType<typeof at>) => ({
  id, type: "panel.gauge", title, config: { max, presetId, panelScope: scope([]), configSchemaVersion: 1 }, layout, bindings: { sourceType: "sensor", sourceId: "look-preview", capabilityId: cap },
});
const chart = (id: string, title: string, cap: string, presetId: string, chartRange: string, layout: ReturnType<typeof at>) => ({
  id, type: "panel.charts", title, config: { appearance: { layout: "card" }, chartRange, chartPresetId: presetId, panelScope: scope([cap]), configSchemaVersion: 1 }, layout, bindings: {},
});

/** A showcase of good-looking panels, five places to a row like a laptop dashboard: heating, a light, a gauge and a chart; the weather, power, energy and blinds below. */
const PANELS = (
  [
    control("p-heating", "Heating", HEATING, at("p-heating", 0, 0, 12, 3)),
    control("p-light", "Ceiling light", LIGHT, at("p-light", 12, 0, 12, 3)),
    gauge("p-gauge", "Temperature", T, "gauge-temperature", 40, at("p-gauge", 24, 0, 12, 3)),
    chart("p-chart", "Temperature today", T, "area-gradient", "24h", at("p-chart", 36, 0, 24, 3)),
    { id: "p-weather", type: "panel.weather", config: { appearance: { layout: "card" }, panelScope: scope([]), weatherLat: 51.5, weatherLon: -0.12, weatherLocation: "London", configSchemaVersion: 1 }, layout: at("p-weather", 0, 3, 12, 3), bindings: {} },
    gauge("p-power", "Power now", POWER, "gauge-progress", 3000, at("p-power", 12, 3, 12, 3)),
    chart("p-energy", "Energy this week", ENERGY, "bar-rounded", "7d", at("p-energy", 24, 3, 24, 3)),
    control("p-blinds", "Blinds", BLINDS, at("p-blinds", 48, 3, 12, 3)),
  ] as unknown as PanelInstance[]
).map(decodePanelInstance);

/** A Look's tile: two panels side by side. */
const LOOK_PANELS = PANELS.filter((p) => p.id === "p-heating" || p.id === "p-gauge").map((p, i) => ({
  ...p,
  layout: { ...p.layout, x: i * 12, y: 0, w: 12, h: 3 },
}));

/** Sample history for the charts and a sample forecast, so the preview asks the server nothing. */
const HOUR = 3600_000;
function samplePoints(range: string, cap: string): { t: string; v: number }[] {
  const end = Date.now();
  if (cap === ENERGY || range === "7d")
    return [8.2, 11.4, 9.1, 12.8, 10.3, 7.6, 9.6].map((v, i) => ({ t: new Date(end - (6 - i) * 24 * HOUR).toISOString(), v }));
  return Array.from({ length: 25 }, (_, i) => {
    const h = i - 24;
    return { t: new Date(end + h * HOUR).toISOString(), v: Math.round((20 + 1.6 * Math.sin(((h + 9) / 24) * 2 * Math.PI) + 0.3 * Math.sin(i * 1.7)) * 10) / 10 };
  });
}
const nameOf = (id: string) => CAPABILITIES.find((c) => c.id === id);
answerWithSamples((path) => {
  const url = new URL(path, window.location.origin);
  if (url.pathname === "/api/v1/history") {
    const range = (url.searchParams.get("range") ?? "24h") as HistoryRange;
    const one = url.searchParams.get("capabilityId");
    const ids = one ? [one] : (url.searchParams.get("capabilityIds") ?? "").split(",").filter(Boolean);
    const series = ids.map((id) => ({ capabilityId: id, name: nameOf(id)?.name ?? id, unit: nameOf(id)?.unit ?? null, aggregateEvery: range === "7d" ? "1d" : "1h", points: samplePoints(range, id) }));
    return one ? { ...series[0], range } : { range, series };
  }
  if (url.pathname === "/api/v1/weather") {
    const day = (d: number, code: number, description: string, max: number, min: number) => ({ date: new Date(Date.now() + d * 24 * HOUR).toISOString().slice(0, 10), weatherCode: code, description, tempMax: max, tempMin: min, precipProbability: code > 50 ? 60 : 5 });
    return {
      temperature: 14, humidity: 62, windSpeed: 11, weatherCode: 1, description: "Mainly clear", time: new Date().toISOString(), source: "sample",
      forecast: [day(0, 1, "Mainly clear", 15, 8), day(1, 3, "Cloudy", 13, 7), day(2, 61, "Light rain", 12, 6), day(3, 2, "Partly cloudy", 14, 7), day(4, 0, "Clear", 16, 8)],
    };
  }
  return undefined;
});

const SHOWS: LookPreviewShow[] = ["dashboard", "look", "buttons"];
const show: LookPreviewShow = (() => {
  const v = new URLSearchParams(window.location.search).get("show") as LookPreviewShow | null;
  return v && SHOWS.includes(v) ? v : "dashboard";
})();

/** One button in the chosen button style (button style tiles). */
function SampleButton() {
  return <Button variant="contained">Apply</Button>;
}

/** Panels ask what they show; the preview answers with its sample readings. */
const resolveSamples: PanelResolveBatchFetch = async (requests) =>
  requests.map(({ requestId, request }) => {
    const ids = request.panelScope?.capabilityIds ?? [];
    const capabilities: ResolvedPanelCapability[] = CAPABILITIES.filter((c) => ids.includes(c.id)).map((c) => ({
      id: c.id,
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      kind: c.kind,
      name: c.name,
      icon: c.icon,
      unit: c.unit,
      sourceType: c.sourceType,
      sourceEntityId: null,
      hasCommand: c.hasCommand,
      features: c.features,
      systemId: null,
      areaId: c.areaId ?? null,
      groupId: null,
      areaName: AREA,
      state: c.state,
    }));
    const result: PanelResolveResult = {
      panelKind: request.panelKind,
      panelScope: { areaIds: [], systemIds: [], groupIds: [], contentMode: "manual", capabilityIds: ids, cameraIds: [] },
      capabilities,
    };
    return { requestId, result };
  });

const noLive = () => () => undefined;
const nothing = () => undefined;

const NO_CONTROLS: SkinControls = {
  skins: listSkins(),
  setSkinId: nothing,
  setThemePrefs: nothing,
  tryThemePrefs: nothing,
  trySkinId: nothing,
  trying: false,
  applyTrial: nothing,
  cancelTrial: nothing,
  applyAccountPrefs: nothing,
  onPhone: false,
  phoneOwnLook: false,
  dropPhoneLook: nothing,
};

export function LookPreviewPage() {
  const [shown, setShown] = useState<{ prefs: ThemePrefs; skinId: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Settings come from the page this preview sits in (same address only).
  useEffect(() => {
    void loadAddons();
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const msg = e.data as LookPreviewMessage;
      if (msg?.type === LOOK_PREVIEW_PREFS) setShown({ prefs: normalizeThemePrefs(msg.prefs), skinId: msg.skinId });
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: LOOK_PREVIEW_READY } satisfies LookPreviewMessage, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Tell the page how tall the preview is, so it shows all of it.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const report = () =>
      window.parent.postMessage({ type: LOOK_PREVIEW_HEIGHT, height: Math.ceil(el.getBoundingClientRect().height) } satisfies LookPreviewMessage, window.location.origin);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown !== null]);

  const skin = useMemo(() => getSkin(shown?.skinId ?? ""), [shown?.skinId]);
  if (!shown) return <div ref={contentRef} />;

  return (
    <LookLayer skin={skin} themePrefs={shown.prefs} controls={NO_CONTROLS}>
      <DashboardDataRuntimeProvider connectLive={noLive} resolvePanels={resolveSamples} statuses={STATUSES}>
        {/* Only to look at: a switch in the preview must not do anything. */}
        <Box ref={contentRef} sx={{ p: 2, pointerEvents: "none", userSelect: "none", display: show === "buttons" ? "inline-block" : "block" }} aria-hidden>
          {show === "buttons" ? (
            <SampleButton />
          ) : (
            <Stack spacing={2}>
              <DashboardSectionFrame
                id="look-preview"
                title={AREA}
                icon={WeekendOutlinedIcon}
                panelCount={show === "look" ? LOOK_PANELS.length : PANELS.length}
                collapsed={false}
                onCollapsedChange={nothing}
              >
                <SectionGrid
                  gridCols={60}
                  sectionId="look-preview"
                  sectionTitle={AREA}
                  panels={show === "look" ? LOOK_PANELS : PANELS}
                  capabilities={CAPABILITIES}
                  editMode={false}
                  onLayoutChange={nothing}
                  onRemovePanel={nothing}
                  onUpdatePanel={nothing}
                />
              </DashboardSectionFrame>
            </Stack>
          )}
        </Box>
      </DashboardDataRuntimeProvider>
    </LookLayer>
  );
}
