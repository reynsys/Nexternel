/**
 * Zherodius devices that no longer accept Nexternel's line, and why. Filled by the connections (connections.ts),
 * read by the device list and by Search my home, so the owner is offered "Reconnect" wherever the device shows.
 * - "forgotten": the device says this Nexternel is not paired (it was removed on the device's page, or its
 *   pairings were cleared);
 * - "reset": the device answers with another key than the one kept at pairing (it was reset to factory settings).
 * Reconnecting (pairing again) keeps the same device in Nexternel (store.ts savePairedDevice), so its panels and history stay.
 */
export type NeedsPairing = "forgotten" | "reset";

const state = new Map<string, NeedsPairing>();

export function setNeedsPairing(deviceId: string, why: NeedsPairing | null): void {
  if (why) state.set(deviceId, why);
  else state.delete(deviceId);
}

export function needsPairing(deviceId: string): NeedsPairing | null {
  return state.get(deviceId) ?? null;
}
