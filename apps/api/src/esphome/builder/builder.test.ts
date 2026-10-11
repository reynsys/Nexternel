import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateEsphomeYaml } from "./generate.js";
import {
  normalizeBuilderConfig,
  validateEsphomeBuilderConfig,
} from "./validate.js";
import {
  inferBuilderConfigFromYaml,
  parseManagedBuilderConfigFromYaml,
} from "./parse-config.js";
import { nexternelFirmwareFromLegacyYaml } from "./replace-firmware.js";
import { parseEsphomeYaml } from "../yaml.js";

const baseConfig = {
  version: 1 as const,
  platform: "esp32" as const,
  boardId: "esp32dev" as const,
  displayName: "Garden Controller",
  components: [
    {
      id: "climate",
      kind: "dht" as const,
      variant: "DHT22" as const,
      pin: 4,
    },
    {
      id: "light",
      kind: "gpio_switch" as const,
      pin: 16,
      name: "Garden Light",
      inverted: true,
    },
  ],
};

describe("esphome builder validate", () => {
  it("accepts a DHT + relay configuration", () => {
    const result = validateEsphomeBuilderConfig(baseConfig);
    assert.equal(result.valid, true);
    assert.equal(result.issues.length, 0);
  });

  it("rejects device names starting with a number", () => {
    const result = validateEsphomeBuilderConfig({
      ...baseConfig,
      displayName: "2Garden",
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.code === "invalid_name"));
  });

  it("rejects duplicate GPIO pins", () => {
    const result = validateEsphomeBuilderConfig({
      ...baseConfig,
      components: [
        { id: "a", kind: "dht", variant: "DHT22", pin: 4 },
        { id: "b", kind: "gpio_switch", pin: 4, name: "Relay" },
      ],
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.code === "duplicate_pin"));
  });
});

describe("esphome builder generate", () => {
  it("generates BME280 I2C environmental sensors", () => {
    const config = normalizeBuilderConfig({
      ...baseConfig,
      components: [
        {
          id: "env",
          kind: "bme280" as const,
          sdaPin: 21,
          sclPin: 22,
          address: "0x76" as const,
        },
      ],
    });
    const yaml = generateEsphomeYaml(config);
    assert.match(yaml, /i2c:/);
    assert.match(yaml, /platform: bme280/);
    assert.match(yaml, /platform: bme280[\s\S]*humidity:/);
  });

  it("uses underscores in entity ids when slug contains hyphens", () => {
    const config = normalizeBuilderConfig({
      ...baseConfig,
      displayName: "Hallway Monitor",
      components: [
        {
          id: "scd401",
          kind: "scd40" as const,
          sdaPin: 21,
          sclPin: 22,
        },
      ],
    });
    const yaml = generateEsphomeYaml(config);
    assert.match(yaml, /id: hallway_monitor_scd401_co2/);
    assert.doesNotMatch(yaml, /id: hallway-monitor/);
    assert.match(yaml, /device_name: hallway-monitor/);
  });

  it("generates SCD40 I2C CO2 sensor", () => {
    const config = normalizeBuilderConfig({
      ...baseConfig,
      components: [
        {
          id: "co2",
          kind: "scd40" as const,
          sdaPin: 21,
          sclPin: 22,
          address: "0x76" as const,
        },
      ],
    });
    const yaml = generateEsphomeYaml(config);
    assert.match(yaml, /platform: scd4x/);
    assert.match(yaml, /co2:/);
  });

  it("generates BH1750 illuminance sensor", () => {
    const config = normalizeBuilderConfig({
      ...baseConfig,
      components: [{ id: "lux", kind: "bh1750" as const, sdaPin: 21, sclPin: 22 }],
    });
    const yaml = generateEsphomeYaml(config);
    assert.match(yaml, /platform: bh1750/);
  });

  it("generates DS18B20 one-wire temperature", () => {
    const config = normalizeBuilderConfig({
      ...baseConfig,
      components: [{ id: "probe", kind: "ds18b20" as const, pin: 4 }],
    });
    const yaml = generateEsphomeYaml(config);
    assert.match(yaml, /one_wire:/);
    assert.match(yaml, /platform: dallas/);
  });

  it("generates PMS UART and particulate sensors", () => {
    const config = normalizeBuilderConfig({
      ...baseConfig,
      components: [
        {
          id: "pms",
          kind: "pms" as const,
          variant: "PMSX003" as const,
          uartTxPin: 12,
          uartRxPin: 13,
        },
      ],
    });
    const yaml = generateEsphomeYaml(config);
    assert.match(yaml, /uart:/);
    assert.match(yaml, /platform: pmsx003/);
    const parsed = parseEsphomeYaml(yaml, "garden-controller", "garden-controller");
    assert.equal(parsed.sensors.length, 3);
  });

  it("generates pulse meter energy sensors and SNTP time", () => {
    const config = normalizeBuilderConfig({
      ...baseConfig,
      components: [
        {
          id: "energy",
          kind: "pulse_meter" as const,
          pin: 12,
          pulseRate: 1000,
        },
      ],
    });
    const yaml = generateEsphomeYaml(config);
    assert.match(yaml, /platform: pulse_meter/);
    assert.match(yaml, /platform: total_daily_energy/);
    assert.match(yaml, /platform: sntp/);
    const parsed = parseEsphomeYaml(yaml, "garden-controller", "garden-controller");
    assert.equal(parsed.sensors.length, 3);
  });

  it("generates secrets-based MQTT and round-trips through the parser", () => {
    const config = normalizeBuilderConfig(baseConfig);
    const yaml = generateEsphomeYaml(config);
    assert.match(yaml, /!include packages\/nexternel-device\.yaml/);
    assert.doesNotMatch(yaml, /^api:\s*$/m);
    assert.match(yaml, /broker: !secret mqtt_broker/);
    assert.match(yaml, /platform: dht/);
    assert.match(yaml, /platform: gpio/);
    assert.match(yaml, /topic_prefix: nexternel\/garden-controller/);

    const parsed = parseEsphomeYaml(yaml, "garden-controller", "devices/garden-controller");
    assert.equal(parsed.sensors.length, 2);
    assert.equal(parsed.relays.length, 1);
    assert.equal(parsed.esphomeName, "garden-controller");
  });

  it("parses builder YAML back into managed config", () => {
    const config = normalizeBuilderConfig(baseConfig);
    const yaml = generateEsphomeYaml(config);
    const roundTrip = parseManagedBuilderConfigFromYaml(
      yaml,
      "garden-controller",
      "Garden Controller"
    );
    assert.ok(roundTrip);
    assert.equal(roundTrip!.components.length, 2);
    assert.equal(roundTrip!.components[0]?.kind, "dht");
    assert.equal(roundTrip!.components[1]?.kind, "gpio_switch");
  });

  it("infers legacy DHT YAML without builder marker", () => {
    const yaml = `
esphome:
  name: living-room
  friendly_name: Living Room
esp32:
  board: esp32dev
sensor:
  - platform: dht
    pin: GPIO2
    temperature:
      name: "Living Room Temperature"
      id: living_room_temperature
    humidity:
      name: "Living Room Humidity"
      id: living_room_humidity
    update_interval: 60s
`;
    const inferred = inferBuilderConfigFromYaml(yaml, "living-room", "Living Room");
    assert.ok(inferred);
    assert.equal(inferred!.components.length, 1);
    assert.equal(inferred!.components[0]?.kind, "dht");
    assert.equal((inferred!.components[0] as { pin: number }).pin, 2);
  });

  it("infers legacy relay YAML without builder marker", () => {
    const yaml = `
esp32:
  board: esp32dev
switch:
  - platform: gpio
    pin: GPIO32
    name: "Relay 1"
    id: relay_1
    inverted: true
`;
    const inferred = inferBuilderConfigFromYaml(yaml, "garden-relays", "Garden Relays");
    assert.ok(inferred);
    assert.equal(inferred!.components[0]?.kind, "gpio_switch");
    assert.equal((inferred!.components[0] as { pin: number }).pin, 32);
  });

  it("infers DHT YAML with substitutions", () => {
    const yaml = `
substitutions:
  dht_pin: GPIO4
  friendly_name: Kids Room
esp32:
  board: esp32dev
sensor:
  - platform: dht
    pin: \${dht_pin}
    temperature:
      id: kids_room_temperature
    humidity:
      id: kids_room_humidity
    update_interval: 60s
`;
    const inferred = inferBuilderConfigFromYaml(yaml, "kids-room", "Kids Room");
    assert.ok(inferred);
    assert.equal(inferred!.components[0]?.kind, "dht");
    assert.equal((inferred!.components[0] as { pin: number }).pin, 4);
  });

  it("infers pulse meter YAML with substitutions (Glow-style)", () => {
    const yaml = `
substitutions:
  pulse_pin: GPIO12
  pulse_rate: "1000"
esp8266:
  board: nodemcuv2
sensor:
  - platform: pulse_meter
    id: sensor_energy_pulse_meter
    pin: \${pulse_pin}
    filters:
      - lambda: return x * ((60.0 / \${pulse_rate}) * 1000.0);
`;
    const inferred = inferBuilderConfigFromYaml(yaml, "glow-energy", "Glow Energy");
    assert.ok(inferred);
    assert.equal(inferred!.components[0]?.kind, "pulse_meter");
    assert.equal((inferred!.components[0] as { pin: number }).pin, 12);
    assert.equal((inferred!.components[0] as { pulseRate: number }).pulseRate, 1000);
  });

  it("infers relay from output + switch platform output", () => {
    const yaml = `
esp32:
  board: esp32dev
output:
  - platform: gpio
    pin: GPIO16
    id: relay_out
switch:
  - platform: output
    name: "Garden Light"
    id: garden_light
    output: relay_out
`;
    const inferred = inferBuilderConfigFromYaml(yaml, "garden", "Garden");
    assert.ok(inferred);
    assert.equal(inferred!.components[0]?.kind, "gpio_switch");
    assert.equal((inferred!.components[0] as { pin: number }).pin, 16);
  });

  it("skips internal status lights when inferring", () => {
    const yaml = `
esp8266:
  board: nodemcuv2
output:
  - platform: gpio
    pin: GPIO2
    id: output_red
light:
  - platform: binary
    internal: true
    id: led_red
    name: Red
    output: output_red
sensor:
  - platform: dht
    pin: GPIO4
    temperature:
      id: test_temperature
    humidity:
      id: test_humidity
`;
    const inferred = inferBuilderConfigFromYaml(yaml, "test", "Test");
    assert.ok(inferred);
    assert.equal(inferred!.components.length, 1);
    assert.equal(inferred!.components[0]?.kind, "dht");
  });

  it("replaces a foreign temperature file with the Nexternel firmware", () => {
    const yaml = `
substitutions:
  device_name: living-room
  ota_password: "kept-for-install"
esphome:
  name: "\${device_name}"
  friendly_name: Living Room
esp32:
  board: esp32dev
  framework:
    type: arduino
logger:
api:
ota:
  - platform: esphome
    password: "\${ota_password}"
wifi:
  ssid: "old-network"
  password: "old-secret"
mqtt:
  broker: 192.168.1.2
  username: old-user
  password: old-secret
sensor:
  - platform: dht
    pin: GPIO2
    temperature:
      name: "Living Room Temperature"
      id: living_room_temperature
    humidity:
      name: "Living Room Humidity"
      id: living_room_humidity
    update_interval: 60s
`;
    const replaced = nexternelFirmwareFromLegacyYaml(yaml, "living-room", "Living Room");
    assert.ok(replaced);
    assert.match(replaced!.yaml, /!include packages\/nexternel-device\.yaml/);
    assert.match(replaced!.yaml, /pin: GPIO2/);
    assert.match(replaced!.yaml, /update_interval: 60s/);
    assert.match(replaced!.yaml, /ssid: !secret wifi_ssid/);
    assert.match(replaced!.yaml, /password: "kept-for-install"/);
    assert.doesNotMatch(replaced!.yaml, /model:/);
    assert.doesNotMatch(replaced!.yaml, /^api:\s*$/m);
    assert.equal(replaced!.config.components[0]?.variant, undefined);
  });

  it("leaves a file alone when it uses hardware the shared firmware cannot represent", () => {
    const yaml = `
esphome:
  name: hallway-monitor
esp32:
  board: esp32dev
i2c:
  sda: GPIO21
  scl: GPIO22
sensor:
  - platform: scd4x
    co2:
      name: "CO2"
`;
    assert.equal(
      nexternelFirmwareFromLegacyYaml(yaml, "hallway-monitor", "Hallway"),
      null
    );
  });
});
