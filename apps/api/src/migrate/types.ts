export const CONFIG_FORMAT = "nexternel-config";
export const CONFIG_FORMAT_VERSION = 1;

export type ConfigManifest = {
  format: typeof CONFIG_FORMAT;
  formatVersion: typeof CONFIG_FORMAT_VERSION;
  appVersion: string;
  createdAt: string;
  /** Old server LAN IP (MQTT broker devices were using). */
  serverIp: string;
};

export type ExportedRoom = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type ExportedSensor = {
  id: string;
  name: string;
  slug: string;
  sensorType: string;
  unit: string | null;
  mqttStateTopic: string;
  esphomeEntityId: string | null;
  gpioPin: number | null;
  isEnabled: boolean;
};

export type ExportedRelay = {
  id: string;
  name: string;
  slug: string;
  mqttCommandTopic: string;
  mqttStateTopic: string;
  esphomeEntityId: string | null;
  gpioPin: number | null;
  isEnabled: boolean;
  lastState: string | null;
};

export type ExportedDevice = {
  id: string;
  roomId: string | null;
  name: string;
  slug: string;
  esphomeName: string | null;
  mqttTopicPrefix: string;
  ipAddress: string | null;
  macAddress: string | null;
  firmwareType: string;
  isEnabled: boolean;
  sensors: ExportedSensor[];
  relays: ExportedRelay[];
};

export type ExportedDashboard = {
  id: string;
  name: string;
  document: unknown;
  isDefault: boolean;
};

export type ExportedCamera = {
  id: string;
  name: string;
  streamId: string;
  /** Composed RTSP (always encoded) — kept for older adopt clients. */
  rtspUrl: string;
  host?: string;
  port?: number;
  path?: string;
  username?: string;
  password?: string;
  areaId: string | null;
  enabled: boolean;
  sortOrder: number;
};

export type ConfigPayload = {
  rooms: ExportedRoom[];
  devices: ExportedDevice[];
  dashboards: ExportedDashboard[];
  cameras: ExportedCamera[];
};
