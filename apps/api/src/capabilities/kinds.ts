/** Map sensor_type strings to capability kinds. */
export function kindFromSensorType(sensorType: string): string {
  const t = sensorType.trim().toLowerCase();
  const known = new Set([
    "temperature",
    "humidity",
    "pressure",
    "battery",
    "voltage",
    "current",
    "power",
    "energy",
    "brightness",
    "motion",
    "door",
    "illuminance",
    "co2",
    "pm1",
    "pm25",
    "pm10",
  ]);
  if (known.has(t)) return t;
  if (t.includes("temp")) return "temperature";
  if (t.includes("humid")) return "humidity";
  if (t.includes("pm10") || t.includes("pm_10")) return "pm10";
  if (t.includes("pm25") || t.includes("pm2") || t.includes("pm_2")) return "pm25";
  if (t.includes("pm1") || t.includes("pm_1")) return "pm1";
  if (t.includes("co2")) return "co2";
  if (t.includes("motion") || t.includes("pir")) return "motion";
  if (t.includes("door") || t.includes("window")) return "door";
  if (t.includes("batt")) return "battery";
  return "number";
}
