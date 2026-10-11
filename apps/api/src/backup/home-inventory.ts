import type { DomainExport } from "./domain-export.js";

export type HomeInventoryDevice = {
  id: string;
  slug: string;
  name: string;
  firmwareType: string;
  mqttTopicPrefix: string;
  areaId: string | null;
  sensorCount: number;
  relayCount: number;
};

export type HomeInventoryCapability = {
  logicalKey: string;
  id: string;
  name: string;
  kind: string;
  deviceSlug: string;
  sourceType: string;
  sourceId: string;
  systemId: string | null;
  areaId: string | null;
};

export type HomeInventoryBinding = {
  logicalKey: string;
  capabilityLogicalKey: string;
  protocol: string;
  stateTopic: string | null;
  commandTopic: string | null;
};

export type HomeInventory = {
  areas: { id: string; name: string }[];
  devices: HomeInventoryDevice[];
  capabilities: HomeInventoryCapability[];
  bindings: HomeInventoryBinding[];
  dashboards: { id: string; name: string }[];
  cameras: { id: string; name: string }[];
  users: { username: string; role: string }[];
};

function deviceSlugById(domain: DomainExport): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of domain.devices) map.set(d.id, d.slug);
  return map;
}

export function buildHomeInventory(domain: DomainExport): HomeInventory {
  const slugById = deviceSlugById(domain);
  return {
    areas: domain.areas.map((a) => ({ id: a.id, name: a.name })),
    devices: domain.devices.map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      firmwareType: d.firmwareType,
      mqttTopicPrefix: d.mqttTopicPrefix,
      areaId: d.roomId,
      sensorCount: d.sensors.length,
      relayCount: d.relays.length,
    })),
    capabilities: domain.capabilities.map((c) => ({
      logicalKey: `${slugById.get(c.deviceId) ?? c.deviceId}:${c.kind}:${c.sourceId}`,
      id: c.id,
      name: c.name,
      kind: c.kind,
      deviceSlug: slugById.get(c.deviceId) ?? c.deviceId,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      systemId: c.systemId,
      areaId: c.areaId,
    })),
    bindings: domain.capabilityBindings.map((b) => {
      const cap = domain.capabilities.find((c) => c.id === b.capabilityId);
      const deviceSlug = cap ? slugById.get(cap.deviceId) ?? cap.deviceId : b.capabilityId;
      const capKey = cap
        ? `${deviceSlug}:${cap.kind}:${cap.sourceId}`
        : b.capabilityId;
      return {
        logicalKey: `${capKey}:${b.protocol}`,
        capabilityLogicalKey: capKey,
        protocol: b.protocol,
        stateTopic: b.stateTopic,
        commandTopic: b.commandTopic,
      };
    }),
    dashboards: domain.dashboards.map((d) => ({ id: d.id, name: d.name })),
    cameras: domain.cameras.map((c) => ({ id: c.id, name: c.name })),
    users: domain.users.map((u) => ({ username: u.username, role: u.role })),
  };
}

export type InventoryCompareResult = {
  ok: boolean;
  mismatches: string[];
};

function sortedBy<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}

export function compareHomeInventories(
  before: HomeInventory,
  after: HomeInventory,
  opts?: { allowTopicPrefixChange?: boolean }
): InventoryCompareResult {
  const mismatches: string[] = [];
  const allowTopicChange = opts?.allowTopicPrefixChange ?? false;

  if (before.areas.length !== after.areas.length) {
    mismatches.push(`Areas count: ${before.areas.length} → ${after.areas.length}`);
  }
  const beforeAreaNames = sortedBy(before.areas, (a) => a.name).map((a) => a.name);
  const afterAreaNames = sortedBy(after.areas, (a) => a.name).map((a) => a.name);
  if (JSON.stringify(beforeAreaNames) !== JSON.stringify(afterAreaNames)) {
    mismatches.push("Area names differ");
  }

  if (before.devices.length !== after.devices.length) {
    mismatches.push(`Devices count: ${before.devices.length} → ${after.devices.length}`);
  }
  const beforeDevices = sortedBy(before.devices, (d) => d.slug);
  const afterDevices = sortedBy(after.devices, (d) => d.slug);
  for (let i = 0; i < beforeDevices.length; i++) {
    const b = beforeDevices[i];
    const a = afterDevices[i];
    if (!b || !a) continue;
    if (b.slug !== a.slug) mismatches.push(`Device slug mismatch: ${b.slug} vs ${a?.slug}`);
    if (b.name !== a.name) mismatches.push(`Device name mismatch for ${b.slug}`);
    if (b.firmwareType !== a.firmwareType) {
      mismatches.push(`Device firmwareType mismatch for ${b.slug}: ${b.firmwareType} → ${a.firmwareType}`);
    }
    if (b.sensorCount !== a.sensorCount || b.relayCount !== a.relayCount) {
      mismatches.push(`Device sensor/relay counts mismatch for ${b.slug}`);
    }
    if (!allowTopicChange && b.mqttTopicPrefix !== a.mqttTopicPrefix) {
      mismatches.push(`Device mqttTopicPrefix mismatch for ${b.slug}`);
    }
  }

  const beforeCaps = sortedBy(before.capabilities, (c) => c.logicalKey);
  const afterCaps = sortedBy(after.capabilities, (c) => c.logicalKey);
  if (beforeCaps.length !== afterCaps.length) {
    mismatches.push(`Capabilities count: ${beforeCaps.length} → ${afterCaps.length}`);
  }
  for (let i = 0; i < beforeCaps.length; i++) {
    const b = beforeCaps[i];
    const a = afterCaps[i];
    if (!b || !a) continue;
    if (b.logicalKey !== a.logicalKey) {
      mismatches.push(`Capability logical key mismatch: ${b.logicalKey} vs ${a?.logicalKey}`);
    }
    if (b.name !== a.name) mismatches.push(`Capability name mismatch for ${b.logicalKey}`);
    if (b.systemId !== a.systemId) {
      mismatches.push(`Capability systemId mismatch for ${b.logicalKey}`);
    }
  }

  const beforeBindings = sortedBy(before.bindings, (b) => b.logicalKey);
  const afterBindings = sortedBy(after.bindings, (b) => b.logicalKey);
  if (beforeBindings.length !== afterBindings.length) {
    mismatches.push(`Bindings count: ${beforeBindings.length} → ${afterBindings.length}`);
  }
  for (let i = 0; i < beforeBindings.length; i++) {
    const b = beforeBindings[i];
    const a = afterBindings[i];
    if (!b || !a) continue;
    if (b.logicalKey !== a.logicalKey) {
      mismatches.push(`Binding logical key mismatch: ${b.logicalKey}`);
    }
    if (b.protocol !== a.protocol) {
      mismatches.push(`Binding protocol mismatch for ${b.logicalKey}`);
    }
  }

  if (before.dashboards.length !== after.dashboards.length) {
    mismatches.push(`Dashboards count: ${before.dashboards.length} → ${after.dashboards.length}`);
  }
  if (before.cameras.length !== after.cameras.length) {
    mismatches.push(`Cameras count: ${before.cameras.length} → ${after.cameras.length}`);
  }

  return { ok: mismatches.length === 0, mismatches };
}
