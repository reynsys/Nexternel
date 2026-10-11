import {
  PanelKindSchema,
  PanelScopeSchema,
  getPanelDefinition,
  normalizePanelKind,
  resolvePanelContentMode,
  type PanelKind,
  type PanelScope,
} from "@nexternel/domain";
import { getPool } from "../db.js";
import { getAllLiveStates } from "../telemetry/state-cache.js";

export type ResolvedCapability = {
  id: string;
  deviceId: string;
  deviceName: string;
  kind: string;
  name: string;
  /** Icon id, or "auto" (chosen by the kind of reading). */
  icon: string | null;
  unit: string | null;
  sourceType: string;
  sourceEntityId: string | null;
  hasCommand: boolean;
  systemId: string | null;
  areaId: string | null;
  groupId: string | null;
  areaName: string | null;
  state: {
    value: unknown;
    quality: string;
    updatedAt: string;
  } | null;
};

export type ResolvePanelResult = {
  panelKind: PanelKind;
  panelScope: PanelScope;
  capabilities: ResolvedCapability[];
};

export type ResolvePanelInput = {
  panelKind?: string;
  panelScope?: unknown;
  /** @deprecated legacy request field */
  viewKind?: string;
  /** @deprecated legacy request field */
  viewScope?: unknown;
};

export type ResolvePanelBatchItem =
  | { result: ResolvePanelResult; error?: never }
  | { result?: never; error: string };

type CapabilityRow = {
  id: string;
  device_id: string;
  device_name: string;
  kind: string;
  name: string;
  icon: string | null;
  unit: string | null;
  source_type: string;
  source_entity_id: string | null;
  has_command: boolean;
  system_id: string | null;
  area_id: string | null;
  group_id: string | null;
  area_name: string | null;
};

function readPanelScope(raw: unknown): PanelScope {
  if (raw && typeof raw === "object") {
    return PanelScopeSchema.parse(raw);
  }
  return PanelScopeSchema.parse({});
}

function matchesScope(row: CapabilityRow, scope: PanelScope): boolean {
  // Hand-picked panels show exactly the picked items. Area / system / group only narrow
  // "fill automatically" panels; applying them here hid picked items with no way back.
  if (resolvePanelContentMode(scope) === "manual") {
    return scope.capabilityIds.includes(row.id);
  }
  if (scope.areaIds.length > 0) {
    const areaId = row.area_id;
    if (!areaId || !scope.areaIds.includes(areaId)) return false;
  }
  if (scope.systemIds.length > 0) {
    if (!row.system_id || !scope.systemIds.includes(row.system_id as never)) {
      return false;
    }
  }
  if (scope.groupIds.length > 0) {
    if (!row.group_id || !scope.groupIds.includes(row.group_id)) return false;
  }
  return true;
}

function matchesPanelDefinition(
  row: CapabilityRow,
  panelKind: PanelKind
): boolean {
  const def = getPanelDefinition(panelKind);
  if (!def) return false;

  if (def.excludeKinds?.includes(row.kind as never)) return false;
  if (!def.supportedKinds.includes(row.kind as never)) return false;

  return true;
}

type PanelResolutionSnapshot = {
  rows: CapabilityRow[];
  live: Map<
    string,
    {
      value: unknown;
      quality: string;
      updatedAt: string;
    }
  >;
};

async function loadPanelResolutionSnapshot(): Promise<PanelResolutionSnapshot> {
  const result = await getPool().query<CapabilityRow>(
    `SELECT c.id, c.device_id, d.name AS device_name,
            c.kind, COALESCE(NULLIF(c.custom_name, ''), c.name) AS name, c.icon, c.unit, c.source_type,
            c.system_id, c.area_id, c.group_id,
            r.name AS area_name,
            rel.esphome_entity_id AS source_entity_id,
            (b.command_topic IS NOT NULL AND b.command_topic <> '') AS has_command
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     LEFT JOIN rooms r ON r.id = c.area_id
     LEFT JOIN capability_bindings b ON b.capability_id = c.id
     LEFT JOIN relays rel ON c.source_type = 'relay' AND c.source_id = rel.id
     WHERE c.is_enabled = TRUE
       AND COALESCE(d.is_enabled, TRUE) = TRUE
     ORDER BY COALESCE(r.name, ''), d.name ASC, COALESCE(NULLIF(c.custom_name, ''), c.name) ASC`
  );
  return {
    rows: result.rows,
    live: new Map(getAllLiveStates().map((state) => [state.capabilityId, state])),
  };
}

function resolvePanelFromSnapshot(
  input: ResolvePanelInput,
  snapshot: PanelResolutionSnapshot
): ResolvePanelResult {
  const rawKind = (input.panelKind ?? input.viewKind ?? "").trim();
  const panelKind = PanelKindSchema.parse(normalizePanelKind(rawKind));
  const rawScope = input.panelScope ?? input.viewScope;
  const panelScope = readPanelScope(rawScope);

  const def = getPanelDefinition(panelKind);
  if (!def) {
    throw new Error(`Unknown panel kind: ${panelKind}`);
  }

  const capabilities: ResolvedCapability[] = [];
  for (const row of snapshot.rows) {
    if (!matchesPanelDefinition(row, panelKind)) continue;
    if (!matchesScope(row, panelScope)) continue;

    const state = snapshot.live.get(row.id);
    capabilities.push({
      id: row.id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      kind: row.kind,
      name: row.name,
      icon: row.icon,
      unit: row.unit,
      sourceType: row.source_type,
      sourceEntityId: row.source_entity_id,
      hasCommand: row.has_command,
      systemId: row.system_id,
      areaId: row.area_id,
      groupId: row.group_id,
      areaName: row.area_name,
      state: state
        ? {
            value: state.value,
            quality: state.quality,
            updatedAt: state.updatedAt,
          }
        : null,
    });
  }

  const contentMode = resolvePanelContentMode(panelScope);
  if (contentMode === "manual" && panelScope.capabilityIds.length > 0) {
    const order = new Map(panelScope.capabilityIds.map((id, index) => [id, index]));
    capabilities.sort(
      (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
  }

  return { panelKind, panelScope, capabilities };
}

export async function resolvePanelCapabilities(
  input: ResolvePanelInput
): Promise<ResolvePanelResult> {
  const snapshot = await loadPanelResolutionSnapshot();
  return resolvePanelFromSnapshot(input, snapshot);
}

/**
 * Resolve many independent Panel requests from one capability/live snapshot.
 * Invalid items fail independently so one Panel cannot blank the whole batch.
 */
export async function resolvePanelCapabilitiesBatch(
  inputs: readonly ResolvePanelInput[]
): Promise<ResolvePanelBatchItem[]> {
  if (inputs.length === 0) return [];
  const snapshot = await loadPanelResolutionSnapshot();
  return inputs.map((input) => {
    try {
      return { result: resolvePanelFromSnapshot(input, snapshot) };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Panel resolve failed",
      };
    }
  });
}
