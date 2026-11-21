import { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import WeekendOutlinedIcon from "@mui/icons-material/WeekendOutlined";
import type { Capability, PanelInstance, PanelResolveResult, ResolvedPanelCapability } from "../api";
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

const CAPABILITIES: Capability[] = [
  sample("look-preview-temperature", "temperature", "Temperature", "°C", 21.4),
  sample("look-preview-humidity", "humidity", "Humidity", "%", 63),
  sample("look-preview-co2", "co2", "Air quality (CO₂)", "ppm", 1180),
  sample("look-preview-light", "switch", "Ceiling light", null, true, true),
  sample("look-preview-lamp", "switch", "Lamp", null, false, true),
];

const STATUSES: CapabilityStatus[] = [
  { capabilityId: "look-preview-temperature", state: "ok", since: now, settings: null, custom: false },
  { capabilityId: "look-preview-humidity", state: "watch", since: now, settings: null, custom: false },
  { capabilityId: "look-preview-co2", state: "alert", since: now, settings: null, custom: false },
];

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

const PANELS = (
  [
    { id: "p-clock", type: "panel.clock", config: { clockFace: "digital", clockColor: "accent", clockFont: "theme", appearance: { layout: "card" }, panelScope: scope([]), configSchemaVersion: 1 }, layout: { i: "p-clock", x: 0, y: 0, w: 20, h: 2 }, bindings: {} },
    { id: "p-climate", type: "panel.status", title: "Climate", config: { appearance: card, panelScope: scope(["look-preview-temperature", "look-preview-humidity"]), configSchemaVersion: 1 }, layout: { i: "p-climate", x: 20, y: 0, w: 20, h: 2 }, bindings: {} },
    { id: "p-gauge", type: "panel.gauge", title: "Temperature", config: { max: 40, presetId: "gauge-double", panelScope: scope([]), configSchemaVersion: 1 }, layout: { i: "p-gauge", x: 40, y: 0, w: 20, h: 2 }, bindings: { sourceType: "sensor", sourceId: "look-preview", capabilityId: "look-preview-temperature" } },
    { id: "p-lights", type: "panel.controls", title: "Lights", config: { appearance: card, panelScope: scope(["look-preview-light", "look-preview-lamp"]), configSchemaVersion: 1 }, layout: { i: "p-lights", x: 0, y: 2, w: 30, h: 1 }, bindings: {} },
    { id: "p-air", type: "panel.status", title: "Air quality", config: { appearance: card, panelScope: scope(["look-preview-co2"]), configSchemaVersion: 1 }, layout: { i: "p-air", x: 30, y: 2, w: 30, h: 1 }, bindings: {} },
  ] as unknown as PanelInstance[]
).map(decodePanelInstance);

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
        <Box ref={contentRef} sx={{ p: 2, pointerEvents: "none", userSelect: "none" }} aria-hidden>
          <DashboardSectionFrame id="look-preview" title={AREA} icon={WeekendOutlinedIcon} panelCount={PANELS.length} collapsed={false} onCollapsedChange={nothing}>
            <SectionGrid
              gridCols={60}
              sectionId="look-preview"
              sectionTitle={AREA}
              panels={PANELS}
              capabilities={CAPABILITIES}
              editMode={false}
              onLayoutChange={nothing}
              onRemovePanel={nothing}
              onUpdatePanel={nothing}
            />
          </DashboardSectionFrame>
        </Box>
      </DashboardDataRuntimeProvider>
    </LookLayer>
  );
}
