/**
 * Home network search (Devices → Add device → Search my home): one found device.
 * Shared by the server (apps/api/src/home-network/) and the screen.
 */

/**
 * What bringing the device in takes:
 * - board: an ESPHome board (Nexternel installs its own board software once)
 * - shelly: a Shelly switch (Nexternel changes one setting; the old app keeps working)
 * - matterNew: a Matter device waiting to be added (code on the device or box)
 * - matterShared: a Matter device another app already runs (needs a share code from that app)
 * - camera: a camera or doorbell with its own video stream
 * - other: on the network, but Nexternel can't control it yet
 */
export type FoundDeviceKind = "board" | "shelly" | "matterNew" | "matterShared" | "camera" | "other";

export type FoundDevice = {
  key: string;
  kind: FoundDeviceKind;
  name: string;
  /** Short plain description, e.g. "ESPHome board · ESP32", "Shelly 1 Mini Gen 3", "TV". */
  what: string;
  address: string | null;
  mac: string | null;
  /** ESPHome: the board's own name; Shelly: its device id (e.g. shelly1minig3-aabbccddeeff). */
  deviceId: string | null;
  /** Shelly generation (1 = original, 2+ = Plus/Pro/Gen 3/Gen 4). */
  shellyGen: number | null;
  /** ESPHome: ready-made board software that may be taken over without the old settings file. */
  readyMade: boolean;
  /** ESPHome: the kind of board it says it is (e.g. "esp32dev", "nodemcuv2"). */
  board: string | null;
  /** ESPHome software version, when the board says. */
  version: string | null;
  /** Set when this device is already in Nexternel. */
  alreadyIn: { kind: "device" | "camera"; id: string; name: string } | null;
};
