/** Panel scope stored on dashboard widgets (`config.panelScope`). */

import type { PanelContentMode } from "@nexternel/domain";
import {
  defaultPanelContentMode,
  resolvePanelContentMode,
} from "@nexternel/domain";

export type { PanelContentMode };

export type PanelScopeConfig = {
  inheritSectionArea?: boolean;
  areaIds?: string[];
  systemIds?: string[];
  groupIds?: string[];
  contentMode?: PanelContentMode;
  capabilityIds?: string[];
  cameraIds?: string[];
};

export function readPanelContentMode(config: PanelScopeConfig | undefined): PanelContentMode {
  return resolvePanelContentMode({
    contentMode: config?.contentMode,
    capabilityIds: config?.capabilityIds ?? [],
    cameraIds: config?.cameraIds ?? [],
  });
}

export function defaultContentModeForPanel(panelKind: string): PanelContentMode {
  return defaultPanelContentMode(panelKind);
}

export function buildPanelScopeConfig(opts: {
  inheritSectionArea?: boolean;
  areaIds?: string[];
  systemIds?: string[];
  groupIds?: string[];
  contentMode: PanelContentMode;
  capabilityIds: string[];
  cameraIds?: string[];
}): PanelScopeConfig {
  const manual = opts.contentMode === "manual";
  return {
    inheritSectionArea: opts.inheritSectionArea,
    areaIds: opts.areaIds,
    systemIds: opts.systemIds,
    groupIds: opts.groupIds,
    contentMode: opts.contentMode,
    capabilityIds: manual ? opts.capabilityIds : [],
    cameraIds: manual ? (opts.cameraIds ?? []) : [],
  };
}

export function effectivePanelScope(
  config: PanelScopeConfig | undefined,
  sectionAreaId: string | null
): {
  areaIds: string[];
  systemIds: string[];
  groupIds: string[];
  contentMode: PanelContentMode;
  capabilityIds: string[];
  cameraIds: string[];
} {
  const areaIds = [...(config?.areaIds ?? [])];
  if (config?.inheritSectionArea && sectionAreaId && !areaIds.includes(sectionAreaId)) {
    areaIds.push(sectionAreaId);
  }
  const contentMode = readPanelContentMode(config);
  const capabilityIds =
    contentMode === "manual" ? [...(config?.capabilityIds ?? [])] : [];
  const cameraIds = contentMode === "manual" ? [...(config?.cameraIds ?? [])] : [];
  return {
    areaIds,
    systemIds: config?.systemIds ?? [],
    groupIds: config?.groupIds ?? [],
    contentMode,
    capabilityIds,
    cameraIds,
  };
}

/** Scope for listing available items in Add/Edit panel pickers (ignores manual selection). */
export function previewPanelScopeForItemOptions(opts: {
  inheritSectionArea: boolean;
  sectionRoomId: string | null;
  areaId: string;
  systemIds: string[];
  groupIds?: string[];
}): ReturnType<typeof effectivePanelScope> {
  const areaIds =
    opts.inheritSectionArea && opts.sectionRoomId
      ? [opts.sectionRoomId]
      : opts.areaId
        ? [opts.areaId]
        : [];
  return effectivePanelScope(
    {
      areaIds,
      systemIds: opts.systemIds,
      groupIds: opts.groupIds ?? [],
      contentMode: "auto",
      capabilityIds: [],
    },
    null
  );
}

/** Build panel scope for Add/Edit dialogs before the widget is saved. */
export function previewPanelScopeFromEditorFields(opts: {
  inheritSectionArea: boolean;
  sectionRoomId: string | null;
  areaId: string;
  systemIds: string[];
  groupIds?: string[];
  contentMode?: PanelContentMode;
  capabilityIds?: string[];
  cameraIds?: string[];
}): ReturnType<typeof effectivePanelScope> {
  const areaIds =
    opts.inheritSectionArea && opts.sectionRoomId
      ? [opts.sectionRoomId]
      : opts.areaId
        ? [opts.areaId]
        : [];
  return effectivePanelScope(
    {
      areaIds,
      systemIds: opts.systemIds,
      groupIds: opts.groupIds ?? [],
      contentMode: opts.contentMode,
      capabilityIds: opts.capabilityIds ?? [],
      cameraIds: opts.cameraIds ?? [],
    },
    null
  );
}
