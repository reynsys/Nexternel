/**
 * Shared types for the ESPHome Device Builder catalogue.
 * Component kinds are defined by catalogue entries — not a hand-maintained union.
 */

export type EsphomePlatform = "esp32" | "esp8266";

export type EsphomeBoardId =
  | "esp32dev"
  | "esp32-c3-devkitm-1"
  | "nodemcuv2"
  | "esp01_1m";

export type BuilderComponentGroup =
  | "climate"
  | "air_quality"
  | "light"
  | "distance"
  | "energy"
  | "environment"
  | "actuators";

export type BuilderConnectionType = "gpio" | "i2c" | "onewire" | "uart" | "adc";

/** YAML generation profile — multiple catalogue ids may share one profile. */
export type BuilderGeneratorProfile =
  | "dht"
  | "i2c_bme280"
  | "i2c_bmp280"
  | "i2c_bme680"
  | "i2c_sht3xd"
  | "i2c_htu21d"
  | "i2c_aht10"
  | "i2c_sht4x"
  | "i2c_bh1750"
  | "i2c_scd4x"
  | "onewire_dallas"
  | "uart_pms"
  | "uart_mhz19"
  | "gpio_pulse_meter"
  | "gpio_switch"
  | "adc_pin"
  | "hc_sr04";

export type BuilderFieldType = "number" | "string" | "select" | "boolean";

export type BuilderFieldDef = {
  key: string;
  label: string;
  type: BuilderFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  defaultValue?: string | number | boolean;
  help?: string;
  /** When set, value is validated as a GPIO pin and tracked for duplicates. */
  gpio?: boolean;
};

export type BuilderComponentCatalogEntry = {
  id: string;
  category: "sensor" | "actuator";
  group: BuilderComponentGroup;
  connectionType: BuilderConnectionType;
  generator: BuilderGeneratorProfile;
  sortOrder: number;
  tags: string[];
  label: string;
  description: string;
  platforms: EsphomePlatform[];
  fields: BuilderFieldDef[];
  createsCapabilities: { kind: string; label: string }[];
};

/** Stored on device JSON — field set depends on catalogue entry. */
export type BuilderComponent = {
  id: string;
  kind: string;
  variant?: string;
  pin?: number;
  sdaPin?: number;
  sclPin?: number;
  uartTxPin?: number;
  uartRxPin?: number;
  address?: string;
  updateIntervalSeconds?: number;
  pulseRate?: number;
  name?: string;
  inverted?: boolean;
  attenuation?: string;
  triggerPin?: number;
  echoPin?: number;
};
