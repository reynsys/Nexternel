/** V4 onboarding pipeline — shared types. */

export type CapabilityCandidate = {
  kind: string;
  name: string;
  unit?: string | null;
  sourceType: "sensor" | "relay";
  /** sensors/relays slug — stable within device */
  sourceSlug: string;
  stateTopic: string;
  commandTopic?: string | null;
  esphomeEntityId: string;
};

export type DriverManifest = {
  driverId: "esphome";
  deviceName: string;
  mqttTopicPrefix: string;
  esphomeName: string;
  yamlFile: string;
  candidates: CapabilityCandidate[];
};
