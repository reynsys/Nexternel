/** Friendly labels for capability kinds shown as badges in pickers. */
export function capabilityKindLabel(kind: string | undefined): string {
  if (!kind) return "Value";
  switch (kind) {
    case "temperature":
      return "Temperature";
    case "humidity":
      return "Humidity";
    case "pressure":
      return "Pressure";
    case "power":
      return "Power";
    case "energy":
      return "Energy";
    case "battery":
      return "Battery";
    case "voltage":
      return "Voltage";
    case "current":
      return "Current";
    case "co2":
      return "CO₂";
    case "pm1":
      return "PM1";
    case "pm25":
      return "PM2.5";
    case "pm10":
      return "PM10";
    case "switch":
      return "Switch";
    case "brightness":
      return "Brightness";
    case "colour":
      return "Colour";
    case "motion":
      return "Motion";
    case "door":
      return "Contact";
    case "lock":
      return "Lock";
    case "alarm":
      return "Alarm";
    case "binary_sensor":
      return "Binary";
    case "camera":
      return "Camera";
    case "weather":
      return "Weather";
    case "gps":
      return "Location";
    case "number":
      return "Number";
    case "text":
      return "Text";
    case "enum":
      return "Status";
    default:
      return kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
