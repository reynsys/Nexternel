import { classifySystemForCapability, type SystemId } from "@nexternel/domain";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import {
  classifyCapabilitiesForDevice,
  syncCapabilityAreasFromDevices,
} from "../capabilities/classify.js";
import type { CapabilityCandidate } from "./types.js";

export type MappedCapability = {
  kind: string;
  name: string;
  unit?: string | null;
  sourceType: "sensor" | "relay";
  stateTopic: string;
  commandTopic?: string | null;
  systemId: SystemId | null;
};

/** Preview classification for driver candidates (no DB writes). */
export function mapCandidatesToCapabilities(
  candidates: CapabilityCandidate[],
  context: {
    deviceName?: string | null;
    areaName?: string | null;
    systemOverrides?: Record<string, SystemId>;
  }
): MappedCapability[] {
  return candidates.map((c) => {
    const overrideKey = `${c.sourceType}:${c.sourceSlug}`;
    const systemId =
      context.systemOverrides?.[overrideKey] ??
      context.systemOverrides?.[c.kind] ??
      classifySystemForCapability(c.kind, {
        deviceName: context.deviceName,
        areaName: context.areaName,
        capabilityName: c.name,
      });
    return {
      kind: c.kind,
      name: c.name,
      unit: c.unit,
      sourceType: c.sourceType,
      stateTopic: c.stateTopic,
      commandTopic: c.commandTopic,
      systemId,
    };
  });
}

export async function syncAndClassifyCapabilities(
  deviceId: string,
  systemOverrides?: Record<string, SystemId>
): Promise<{
  sync: { sensors: number; relays: number };
  classified: number;
}> {
  const sync = await syncCapabilitiesFromLegacy();
  await syncCapabilityAreasFromDevices();
  const classified = await classifyCapabilitiesForDevice(deviceId, systemOverrides);
  return { sync, classified };
}
