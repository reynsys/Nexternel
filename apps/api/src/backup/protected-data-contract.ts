/**
 * Machine-oriented contract: what backup/restore must preserve vs adapt.
 * Used by automated tests — not an architecture document.
 */

export const PROTECTED_HOME_DATA = [
  "areas",
  "devices",
  "deviceIdentity",
  "capabilities",
  "capabilityIdentity",
  "capabilityBindings",
  "systemAssignments",
  "areaAssignments",
  "groups",
  "dashboards",
  "dashboardLayouts",
  "dashboardWidgetReferences",
  "cameras",
  "users",
  "roles",
  "pluginConfiguration",
  "esphomeDeviceDefinitions",
  "historicalSensorData",
] as const;

export const INSTALLATION_SPECIFIC_DATA = [
  "serverIp",
  "mqttBrokerAddress",
  "mqttCredentials",
  "mqttTopicPrefix",
  "mosquittoPasswd",
  "databaseCredentials",
  "influxCredentials",
  "jwtSecrets",
  "installationId",
  "containerRuntimeSecrets",
] as const;

export type ProtectedHomeKey = (typeof PROTECTED_HOME_DATA)[number];
export type InstallationSpecificKey = (typeof INSTALLATION_SPECIFIC_DATA)[number];
