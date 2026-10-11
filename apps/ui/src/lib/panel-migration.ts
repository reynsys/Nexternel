import type { DashboardSection, WidgetInstance } from "../api";
import { newId } from "./dashboard-document";
import { sectionPanels, sectionWithPanels } from "./panel-compatibility/section-panels";
import { isCorePanelType } from "./panel-compatibility/panel-type";
import { panelDefaultSize, panelLabel } from "../widgets/panel/registry";
import { isRelayPanelType } from "../widgets/relay-panel/config";
import { isSwitchWidgetType } from "../widgets/switch/config";
import {
  isEchartsWidgetType,
  migrateWidgetToEcharts,
  parseEchartsConfig,
} from "../widgets/echarts/config";
import { getEchartsPreset } from "../widgets/echarts/registry";
import { weatherConfigFromWidget, devicesConfigFromWidget } from "./panel-integration";
import { generalDefaultConfig } from "../widgets/general/config";
import { normalizePanelKind } from "./panel-kind";
import {
  profileConsolidationSystemIds,
  replaceDeprecatedPanelKind,
} from "./panel-profile-hints";

export type PanelMigrationAction = {
  sectionId: string;
  sectionTitle: string;
  removeWidgetIds: string[];
  addWidget?: WidgetInstance;
  summary: string;
};

export type PanelMigrationPlan = {
  actions: PanelMigrationAction[];
  skipped: { sectionTitle: string; reason: string }[];
  /** Widget types present on the dashboard (helps explain empty plans). */
  inventory: { type: string; count: number }[];
  notes: string[];
};

function panelScopeForSection(section: DashboardSection) {
  return {
    inheritSectionArea: Boolean(section.roomId),
    areaIds: [] as string[],
    systemIds: [] as string[],
    groupIds: [] as string[],
  };
}

function makePanelWidget(
  panelKind: string,
  section: DashboardSection,
  anchor: WidgetInstance | undefined,
  titleSuffix?: string,
  extraConfig?: Record<string, unknown>
): WidgetInstance {
  const size = panelDefaultSize(panelKind);
  const widgetId = newId("w");
  const baseTitle = panelLabel(panelKind);
  const title = titleSuffix ? `${baseTitle} — ${titleSuffix}` : baseTitle;
  const layout = anchor?.layout
    ? {
        ...anchor.layout,
        i: widgetId,
        w: Math.max(anchor.layout.w ?? size.w, size.w),
        h: Math.max(anchor.layout.h ?? size.h, size.h),
        minW: size.minW,
        minH: size.minH,
      }
    : {
        i: widgetId,
        x: 0,
        y: 0,
        w: size.w,
        h: size.h,
        minW: size.minW,
        minH: size.minH,
      };

  return {
    id: widgetId,
    type: panelKind,
    title,
    layout,
    bindings: {},
    config: {
      panelScope: panelScopeForSection(section),
      appearance: { layout: "card" },
      ...(panelKind === "panel.charts"
        ? { chartRange: "24h", chartPresetId: "line-basic" }
        : {}),
      ...(panelKind === "panel.weather"
        ? { ...generalDefaultConfig("weather"), ...(extraConfig ?? {}) }
        : {}),
      ...(panelKind === "panel.devices"
        ? { ...generalDefaultConfig("device_status"), ...(extraConfig ?? {}) }
        : {}),
      ...(extraConfig && panelKind !== "panel.weather" && panelKind !== "panel.devices"
        ? extraConfig
        : {}),
    },
  };
}

function sectionHasPanel(section: DashboardSection, panelKind: string): boolean {
  return sectionPanels(section).some(
    (w) => isCorePanelType(w.type) && normalizePanelKind(w.type) === panelKind
  );
}

function isLiveEchartsWidget(widget: WidgetInstance): boolean {
  if (!isEchartsWidgetType(widget.type)) return false;
  const migrated = migrateWidgetToEcharts(widget);
  const cfg = parseEchartsConfig(migrated.config ?? {});
  const preset = getEchartsPreset(cfg.presetId);
  return preset.dataMode === "live";
}

function isHistoryEchartsWidget(widget: WidgetInstance): boolean {
  if (!isEchartsWidgetType(widget.type)) return false;
  const migrated = migrateWidgetToEcharts(widget);
  const cfg = parseEchartsConfig(migrated.config ?? {});
  const preset = getEchartsPreset(cfg.presetId);
  return preset.dataMode === "history";
}

function widgetInventory(sections: DashboardSection[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const section of sections) {
    for (const widget of sectionPanels(section)) {
      const type = widget.type?.trim() || "unknown";
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

export function planPanelMigration(sections: DashboardSection[]): PanelMigrationPlan {
  const actions: PanelMigrationAction[] = [];
  const skipped: PanelMigrationPlan["skipped"] = [];
  const notes: string[] = [];

  let unmigratableOther = 0;

  for (const section of sections) {
    const panels = sectionPanels(section);
    const relayPanels = panels.filter((w) => isRelayPanelType(w.type));
    const switches = panels.filter((w) => isSwitchWidgetType(w.type));
    const stats = panels.filter((w) => w.type === "stat");
    const liveGauges = panels.filter((w) => isLiveEchartsWidget(w));
    const historyCharts = panels.filter((w) => isHistoryEchartsWidget(w));
    const cameraWidgets = panels.filter((w) => w.type === "camera");
    const weatherWidgets = panels.filter((w) => w.type === "weather");
    const calendarWidgets = panels.filter((w) => w.type === "calendar");
    const deviceStatusWidgets = panels.filter((w) => w.type === "device_status");
    const systemWidgets = panels.filter((w) => w.type === "system_info");

    const controlCandidates = [...relayPanels, ...switches];
    if (controlCandidates.length > 0) {
      if (!sectionHasPanel(section, "panel.controls")) {
        const anchor = controlCandidates[0];
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: controlCandidates.map((w) => w.id),
          addWidget: makePanelWidget("panel.controls", section, anchor),
          summary: `Replace ${controlCandidates.length} control widget(s) with Controls panel`,
        });
      } else {
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: controlCandidates.map((w) => w.id),
          summary: `Remove ${controlCandidates.length} legacy control widget(s) — Controls panel already on section`,
        });
      }
    }

    const statusCandidates = [...stats, ...liveGauges];
    if (statusCandidates.length > 0) {
      if (!sectionHasPanel(section, "panel.status")) {
        const anchor = statusCandidates[0];
        const parts: string[] = [];
        if (stats.length > 0) parts.push(`${stats.length} stat`);
        if (liveGauges.length > 0) parts.push(`${liveGauges.length} live gauge`);
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: statusCandidates.map((w) => w.id),
          addWidget: makePanelWidget("panel.status", section, anchor),
          summary: `Replace ${parts.join(" + ")} widget(s) with Status panel`,
        });
      } else {
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: statusCandidates.map((w) => w.id),
          summary: `Remove ${statusCandidates.length} legacy sensor widget(s) — Status panel already on section`,
        });
      }
    }

    if (historyCharts.length > 0) {
      if (!sectionHasPanel(section, "panel.charts")) {
        const anchor = historyCharts[0];
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: historyCharts.map((w) => w.id),
          addWidget: makePanelWidget("panel.charts", section, anchor),
          summary: `Replace ${historyCharts.length} history chart widget(s) with Charts panel`,
        });
      } else {
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: historyCharts.map((w) => w.id),
          summary: `Remove ${historyCharts.length} legacy chart widget(s) — Charts panel already on section`,
        });
      }
    }

    if (cameraWidgets.length > 0) {
      if (!sectionHasPanel(section, "panel.camera")) {
        const anchor = cameraWidgets[0];
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: cameraWidgets.map((w) => w.id),
          addWidget: makePanelWidget("panel.camera", section, anchor),
          summary: `Replace ${cameraWidgets.length} camera widget(s) with Camera panel`,
        });
      } else {
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: cameraWidgets.map((w) => w.id),
          summary: `Remove ${cameraWidgets.length} legacy camera widget(s) — Camera panel already on section`,
        });
      }
    }

    if (weatherWidgets.length > 0) {
      if (!sectionHasPanel(section, "panel.weather")) {
        const anchor = weatherWidgets[0];
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: weatherWidgets.map((w) => w.id),
          addWidget: makePanelWidget(
            "panel.weather",
            section,
            anchor,
            undefined,
            weatherConfigFromWidget(anchor)
          ),
          summary: `Replace ${weatherWidgets.length} weather widget(s) with Weather panel`,
        });
      } else {
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: weatherWidgets.map((w) => w.id),
          summary: `Remove ${weatherWidgets.length} legacy weather widget(s) — Weather panel already on section`,
        });
      }
    }

    if (calendarWidgets.length > 0) {
      if (!sectionHasPanel(section, "panel.calendar")) {
        const anchor = calendarWidgets[0];
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: calendarWidgets.map((w) => w.id),
          addWidget: makePanelWidget("panel.calendar", section, anchor),
          summary: `Replace ${calendarWidgets.length} calendar widget(s) with Calendar panel`,
        });
      } else {
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: calendarWidgets.map((w) => w.id),
          summary: `Remove ${calendarWidgets.length} legacy calendar widget(s) — Calendar panel already on section`,
        });
      }
    }

    if (deviceStatusWidgets.length > 0) {
      if (!sectionHasPanel(section, "panel.devices")) {
        const anchor = deviceStatusWidgets[0];
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: deviceStatusWidgets.map((w) => w.id),
          addWidget: makePanelWidget(
            "panel.devices",
            section,
            anchor,
            undefined,
            devicesConfigFromWidget(anchor)
          ),
          summary: `Replace ${deviceStatusWidgets.length} device status widget(s) with Devices panel`,
        });
      } else {
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: deviceStatusWidgets.map((w) => w.id),
          summary: `Remove ${deviceStatusWidgets.length} legacy device status widget(s) — Devices panel already on section`,
        });
      }
    }

    if (systemWidgets.length > 0) {
      if (!sectionHasPanel(section, "panel.system")) {
        const anchor = systemWidgets[0];
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: systemWidgets.map((w) => w.id),
          addWidget: makePanelWidget("panel.system", section, anchor),
          summary: `Replace ${systemWidgets.length} system widget(s) with System panel`,
        });
      } else {
        actions.push({
          sectionId: section.id,
          sectionTitle: section.title,
          removeWidgetIds: systemWidgets.map((w) => w.id),
          summary: `Remove ${systemWidgets.length} legacy system widget(s) — System panel already on section`,
        });
      }
    }

    const legacyPanels = sectionPanels(section).filter((w) => isCorePanelType(w.type));
    const deprecatedPanels = legacyPanels.filter((w) => {
      const normalized = normalizePanelKind(w.type);
      return replaceDeprecatedPanelKind(w.type) !== normalized;
    });
    for (const widget of deprecatedPanels) {
      const replacement = replaceDeprecatedPanelKind(widget.type);
      const scope = widget.config?.panelScope ?? widget.config?.viewScope;
      const scopeObj =
        scope && typeof scope === "object" ? (scope as Record<string, unknown>) : {};
      const systemIds =
        scope && typeof scope === "object" && Array.isArray((scope as { systemIds?: string[] }).systemIds)
          ? (scope as { systemIds: string[] }).systemIds
          : profileConsolidationSystemIds(widget.type);
      actions.push({
        sectionId: section.id,
        sectionTitle: section.title,
        removeWidgetIds: [widget.id],
        addWidget: {
          ...widget,
          id: newId("w"),
          type: replacement,
          title: panelLabel(replacement),
          config: {
            ...widget.config,
            panelScope: {
              ...scopeObj,
              inheritSectionArea:
                scope && typeof scope === "object"
                  ? Boolean((scope as { inheritSectionArea?: boolean }).inheritSectionArea)
                  : false,
              areaIds:
                scope && typeof scope === "object" && Array.isArray((scope as { areaIds?: string[] }).areaIds)
                  ? (scope as { areaIds: string[] }).areaIds
                  : [],
              systemIds,
              groupIds:
                scope && typeof scope === "object" && Array.isArray((scope as { groupIds?: string[] }).groupIds)
                  ? (scope as { groupIds: string[] }).groupIds
                  : [],
            },
          },
        },
        summary: `Replace deprecated ${normalizePanelKind(widget.type)} with ${replacement}`,
      });
    }

    const legacyMigratable =
      controlCandidates.length +
      statusCandidates.length +
      historyCharts.length +
      cameraWidgets.length +
      weatherWidgets.length +
      calendarWidgets.length +
      deviceStatusWidgets.length +
      systemWidgets.length;
    const panelCount = sectionPanels(section).length;
    if (legacyMigratable === 0 && legacyPanels.length === panelCount && panelCount > 0) {
      skipped.push({
        sectionTitle: section.title,
        reason: "Section already uses panels only",
      });
    }
  }

  for (const section of sections) {
    for (const widget of sectionPanels(section)) {
      if (isCorePanelType(widget.type)) continue;
      if (isRelayPanelType(widget.type) || isSwitchWidgetType(widget.type) || widget.type === "stat") {
        continue;
      }
      if (isLiveEchartsWidget(widget) || isHistoryEchartsWidget(widget)) continue;
      if (widget.type === "camera") continue;
      if (widget.type === "weather" || widget.type === "calendar" || widget.type === "device_status" || widget.type === "system_info") continue;
      unmigratableOther += 1;
    }
  }

  if (unmigratableOther > 0) {
    notes.push(
      `${unmigratableOther} plugin widget(s) are unchanged.`
    );
  }

  const inventory = widgetInventory(sections);
  if (actions.length === 0 && inventory.length === 0) {
    notes.push("This dashboard has no widgets yet.");
  } else if (actions.length === 0 && inventory.length > 0) {
    const summary = inventory.map((i) => `${i.count}× ${i.type}`).join(", ");
    notes.push(`Widgets on this dashboard: ${summary}.`);
  }

  return { actions, skipped, inventory, notes };
}

export function applyPanelMigration(
  sections: DashboardSection[],
  plan: PanelMigrationPlan
): DashboardSection[] {
  if (plan.actions.length === 0) return sections;

  return sections.map((section) => {
    const sectionActions = plan.actions.filter((a) => a.sectionId === section.id);
    if (sectionActions.length === 0) return section;

    const removeIds = new Set(
      sectionActions.flatMap((a) => a.removeWidgetIds)
    );
    const addWidgets = sectionActions
      .map((a) => a.addWidget)
      .filter((w): w is WidgetInstance => Boolean(w));
    const kept = sectionPanels(section).filter((w) => !removeIds.has(w.id));

    return sectionWithPanels(section, [...kept, ...addWidgets]);
  });
}
