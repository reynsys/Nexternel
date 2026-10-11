import type { Capability, ResolvedPanelCapability } from "../api";
import { isInternalRelayEntity } from "../lib/capability-labels";

const CONTROL_KINDS = new Set(["switch", "brightness", "colour"]);

export function isControllableResolvedCapability(
  cap: ResolvedPanelCapability
): boolean {
  if (!CONTROL_KINDS.has(cap.kind)) return false;
  if (!cap.hasCommand) return false;
  if (cap.kind === "switch") {
    return !isInternalRelayEntity(cap.name, cap.sourceEntityId);
  }
  return true;
}

/** @deprecated use isControllableResolvedCapability */
export function isControllableResolvedSwitch(
  cap: ResolvedPanelCapability
): boolean {
  return isControllableResolvedCapability(cap);
}

export function controlsActionCapabilities(
  capabilities: ResolvedPanelCapability[]
): ResolvedPanelCapability[] {
  return capabilities.filter(isControllableResolvedCapability);
}

/** @deprecated use controlsActionCapabilities */
export function controlsSwitchCapabilities(
  capabilities: ResolvedPanelCapability[]
): ResolvedPanelCapability[] {
  return controlsActionCapabilities(capabilities);
}

export function asSwitchCapability(cap: ResolvedPanelCapability): Capability {
  return {
    id: cap.id,
    deviceId: cap.deviceId,
    deviceName: cap.deviceName,
    roomId: cap.areaId,
    roomName: cap.areaName,
    kind: cap.kind,
    name: cap.name,
    unit: cap.unit,
    sourceType: cap.sourceType,
    hasCommand: cap.hasCommand,
    state: cap.state,
  };
}
