import { Box, Button } from "@mui/material";
import WeekendOutlinedIcon from "@mui/icons-material/WeekendOutlined";
import type { Capability, PanelInstance, PanelResolveResult, ResolvedPanelCapability } from "../../api";
import { DashboardDataRuntimeProvider } from "../../lib/dashboard-data-runtime/DashboardDataRuntimeContext";
import type { PanelResolveBatchFetch } from "../../lib/dashboard-data-runtime/panel-resolver-batcher";
import type { CapabilityStatus } from "../../lib/dashboard-data-runtime/status-store";
import { decodePanelInstance } from "../../lib/panel-compatibility/normalize-panel";
import { listSkins } from "../../skins/registry";
import type { SkinControls } from "../../skins/SkinProvider";
import { DashboardSectionFrame } from "../DashboardSectionFrame";
import { SectionGrid } from "../SectionGrid";

/**
 * What the Appearance previews show, with sample readings (nothing here reaches a device or saves
 * anything): a dashboard section of real panels (the preview), two of them (a Look tile) or one
 * button (a button style tile). Drawn in whatever Appearance is around it (LookLayer).
 */

export type LookSampleShow = "dashboard" | "look" | "buttons";

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

/**
 * A Look's tile: two of the same panels side by side, at the size they have on a dashboard (each two
 * squares across and two down), so the tile shows them as they really look.
 */
const TILE_PANELS = PANELS.filter((p) => p.id === "p-heating" || p.id === "p-gauge").map((p, i) => ({
  ...p,
  layout: { ...p.layout, x: i * 12, y: 0, w: 12, h: 2 },
}));

/** The sample readings' details, for the preview page's sample history. */
export const sampleCapability = (id: string) => CAPABILITIES.find((c) => c.id === id);
export const SAMPLE_ENERGY = ENERGY;

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

/** Appearance controls for a sample: none (it only shows a Look). */
export const NO_CONTROLS: SkinControls = {
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


/**
 * The sample: only to look at, so a switch in it does nothing. A button tile shows the normal button
 * (the outlined one, used most), whose hover each button style changes; pointing at it shows that.
 */
export function LookSample({ show }: { show: LookSampleShow }) {
  if (show === "buttons") {
    return (
      <Button variant="outlined" component="span" tabIndex={-1} aria-hidden>
        Apply
      </Button>
    );
  }
  const panels = show === "look" ? TILE_PANELS : PANELS;
  return (
    <DashboardDataRuntimeProvider connectLive={noLive} resolvePanels={resolveSamples} statuses={STATUSES}>
      <Box sx={{ p: 2, pointerEvents: "none", userSelect: "none" }} aria-hidden>
        <DashboardSectionFrame id="look-preview" title={AREA} icon={WeekendOutlinedIcon} panelCount={panels.length} collapsed={false} onCollapsedChange={nothing}>
          <SectionGrid
            gridCols={60}
            sectionId="look-preview"
            sectionTitle={AREA}
            panels={panels}
            capabilities={CAPABILITIES}
            editMode={false}
            onLayoutChange={nothing}
            onRemovePanel={nothing}
            onUpdatePanel={nothing}
          />
        </DashboardSectionFrame>
      </Box>
    </DashboardDataRuntimeProvider>
  );
}
