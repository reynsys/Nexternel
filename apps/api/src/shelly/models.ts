/**
 * Shelly Gen2/Gen3 model presets for Phase 3 multi-channel adopt.
 * Channel counts are what Nexternel creates as relays (MQTT switch:0..N-1).
 */

export type ShellyModelPreset = {
  id: string;
  label: string;
  /** Number of switch outputs to create (switch:0 .. switch:count-1). */
  switchCount: number;
  /** Short help under the picker. */
  hint: string;
};

export const SHELLY_MODEL_PRESETS: ShellyModelPreset[] = [
  {
    id: "switch_1",
    label: "1 switch",
    switchCount: 1,
    hint: "Mini Gen 3, Plus 1, 1PM, most single relays",
  },
  {
    id: "switch_2",
    label: "2 switches",
    switchCount: 2,
    hint: "Plus 2PM, 2PM Gen 3, dual-channel",
  },
  {
    id: "switch_3",
    label: "3 switches",
    switchCount: 3,
    hint: "Less common 3-channel modules",
  },
  {
    id: "switch_4",
    label: "4 switches",
    switchCount: 4,
    hint: "Pro 4PM and similar",
  },
];

export function getShellyModelPreset(id: string | null | undefined): ShellyModelPreset {
  const found = SHELLY_MODEL_PRESETS.find((p) => p.id === id);
  return found ?? SHELLY_MODEL_PRESETS[0]!;
}

/** Guess channel count from Shelly announce / GetDeviceInfo app or model strings. */
export function guessShellySwitchCount(opts: {
  app?: string | null;
  model?: string | null;
  name?: string | null;
}): number {
  const blob = `${opts.app ?? ""} ${opts.model ?? ""} ${opts.name ?? ""}`.toLowerCase();
  if (/4pm|pro4|4\s*ch|quad/.test(blob)) return 4;
  if (/3pm|pro3|3\s*ch/.test(blob)) return 3;
  if (/2pm|plus\s*2|2\s*ch|dual|2mini/.test(blob)) return 2;
  return 1;
}

export function shellyPresetIdForSwitchCount(count: number): string {
  const n = Math.min(4, Math.max(1, Math.floor(count) || 1));
  return `switch_${n}`;
}

/** Guess Shelly firmware generation from announce / model strings. */
export function guessShellyGen(opts: {
  gen?: number | null;
  model?: string | null;
  app?: string | null;
  topicPrefix?: string | null;
}): 1 | 2 {
  if (opts.gen === 1) return 1;
  if (opts.gen === 2 || opts.gen === 3) return 2;

  const blob = `${opts.model ?? ""} ${opts.app ?? ""}`.toLowerCase();
  if (/plus|mini|pro|gen3|gen2|shellyplus|shsp-|1pm\s*gen|2pm\s*gen|3em\s*gen/.test(blob)) {
    return 2;
  }
  if (/shsw-|shelly-plug|shellyplug|shellyem|shelly\s*rgbw2|shelly\s*i3/.test(blob)) {
    return 1;
  }

  const id = (opts.topicPrefix ?? "").toLowerCase();
  if (/^shelly1-/.test(id) && !/plus|mini|gen/.test(id)) return 1;
  if (/^shelly2-/.test(id) && !/plus|mini|gen/.test(id)) return 1;

  return 2;
}
