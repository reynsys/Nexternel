import type { BuilderComponent } from "@nexternel/domain";
import { componentCatalogEntry } from "@nexternel/domain";
import { esphomeEntityIdPrefix, esphomeObjectIdFromName } from "../yaml.js";

export type GeneratorParts = {
  sensorBlocks: string[];
  switchBlocks: string[];
  i2cBuses: { sda: number; scl: number }[];
  oneWirePins: number[];
  uartBlocks: { id: string; tx: number; rx: number }[];
  needsTime: boolean;
};

export function emptyGeneratorParts(): GeneratorParts {
  return {
    sensorBlocks: [],
    switchBlocks: [],
    i2cBuses: [],
    oneWirePins: [],
    uartBlocks: [],
    needsTime: false,
  };
}

function yamlQuote(value: string): string {
  if (/^[a-zA-Z0-9 _.-]+$/.test(value)) return `"${value}"`;
  return JSON.stringify(value);
}

function entityBase(slug: string, component: BuilderComponent): string {
  const prefix = esphomeEntityIdPrefix(slug);
  if (component.kind === "gpio_switch" && component.name) {
    const fromName = esphomeObjectIdFromName(component.name);
    return fromName || `${prefix}_${component.id}`;
  }
  return `${prefix}_${component.id}`;
}

function interval(component: BuilderComponent): number {
  return component.updateIntervalSeconds ?? 60;
}

function i2cBusId(sda: number, scl: number): string {
  return `i2c_${sda}_${scl}`;
}

function oneWireBusId(pin: number): string {
  return `onewire_${pin}`;
}

function uartId(componentId: string): string {
  return `uart_${componentId}`;
}

function measureBlock(
  slug: string,
  component: BuilderComponent,
  suffix: string,
  displayName: string,
  measureLabel: string,
  unit: string,
  decimals: number
): string {
  const base = entityBase(slug, component);
  return `    ${suffix}:
      name: ${yamlQuote(`${displayName} ${measureLabel}`)}
      id: ${base}_${suffix}
      unit_of_measurement: ${yamlQuote(unit)}
      accuracy_decimals: ${decimals}`;
}

export function appendComponentYaml(
  parts: GeneratorParts,
  slug: string,
  displayName: string,
  component: BuilderComponent
): void {
  const catalog = componentCatalogEntry(component.kind);
  if (!catalog) return;

  const base = entityBase(slug, component);
  const iv = interval(component);

  switch (catalog.generator) {
    case "dht": {
      const variant = component.variant?.trim();
      const modelLine = variant ? `\n    model: ${variant}` : "";
      parts.sensorBlocks.push(
        `  - platform: dht
    pin: GPIO${component.pin}${modelLine}
    temperature:
      name: ${yamlQuote(`${displayName} Temperature`)}
      id: ${base}_temperature
      unit_of_measurement: "°C"
      accuracy_decimals: 1
    humidity:
      name: ${yamlQuote(`${displayName} Humidity`)}
      id: ${base}_humidity
      unit_of_measurement: "%"
      accuracy_decimals: 0
    update_interval: ${iv}s`
      );
      break;
    }
    case "i2c_bme280": {
      parts.i2cBuses.push({ sda: component.sdaPin!, scl: component.sclPin! });
      parts.sensorBlocks.push(
        `  - platform: bme280
    i2c_id: ${i2cBusId(component.sdaPin!, component.sclPin!)}
    address: ${component.address ?? "0x76"}
    update_interval: ${iv}s
${measureBlock(slug, component, "temperature", displayName, "Temperature", "°C", 1)}
${measureBlock(slug, component, "pressure", displayName, "Pressure", "hPa", 1)}
${measureBlock(slug, component, "humidity", displayName, "Humidity", "%", 0)}`
      );
      break;
    }
    case "i2c_bmp280": {
      parts.i2cBuses.push({ sda: component.sdaPin!, scl: component.sclPin! });
      parts.sensorBlocks.push(
        `  - platform: bmp280
    i2c_id: ${i2cBusId(component.sdaPin!, component.sclPin!)}
    address: ${component.address ?? "0x76"}
    update_interval: ${iv}s
${measureBlock(slug, component, "temperature", displayName, "Temperature", "°C", 1)}
${measureBlock(slug, component, "pressure", displayName, "Pressure", "hPa", 1)}`
      );
      break;
    }
    case "i2c_bme680": {
      parts.i2cBuses.push({ sda: component.sdaPin!, scl: component.sclPin! });
      parts.sensorBlocks.push(
        `  - platform: bme680
    i2c_id: ${i2cBusId(component.sdaPin!, component.sclPin!)}
    address: ${component.address ?? "0x76"}
    update_interval: ${iv}s
${measureBlock(slug, component, "temperature", displayName, "Temperature", "°C", 1)}
${measureBlock(slug, component, "pressure", displayName, "Pressure", "hPa", 1)}
${measureBlock(slug, component, "humidity", displayName, "Humidity", "%", 0)}
    gas_resistance:
      name: ${yamlQuote(`${displayName} Gas resistance`)}
      id: ${base}_gas_resistance`
      );
      break;
    }
    case "i2c_sht3xd": {
      parts.i2cBuses.push({ sda: component.sdaPin!, scl: component.sclPin! });
      parts.sensorBlocks.push(
        `  - platform: sht3xd
    i2c_id: ${i2cBusId(component.sdaPin!, component.sclPin!)}
    address: ${component.address ?? "0x76"}
    update_interval: ${iv}s
${measureBlock(slug, component, "temperature", displayName, "Temperature", "°C", 1)}
${measureBlock(slug, component, "humidity", displayName, "Humidity", "%", 0)}`
      );
      break;
    }
    case "i2c_sht4x": {
      parts.i2cBuses.push({ sda: component.sdaPin!, scl: component.sclPin! });
      parts.sensorBlocks.push(
        `  - platform: sht4x
    i2c_id: ${i2cBusId(component.sdaPin!, component.sclPin!)}
    address: ${component.address ?? "0x76"}
    update_interval: ${iv}s
${measureBlock(slug, component, "temperature", displayName, "Temperature", "°C", 1)}
${measureBlock(slug, component, "humidity", displayName, "Humidity", "%", 0)}`
      );
      break;
    }
    case "i2c_htu21d": {
      parts.i2cBuses.push({ sda: component.sdaPin!, scl: component.sclPin! });
      parts.sensorBlocks.push(
        `  - platform: htu21d
    i2c_id: ${i2cBusId(component.sdaPin!, component.sclPin!)}
    update_interval: ${iv}s
${measureBlock(slug, component, "temperature", displayName, "Temperature", "°C", 1)}
${measureBlock(slug, component, "humidity", displayName, "Humidity", "%", 0)}`
      );
      break;
    }
    case "i2c_aht10": {
      parts.i2cBuses.push({ sda: component.sdaPin!, scl: component.sclPin! });
      parts.sensorBlocks.push(
        `  - platform: aht10
    i2c_id: ${i2cBusId(component.sdaPin!, component.sclPin!)}
    update_interval: ${iv}s
${measureBlock(slug, component, "temperature", displayName, "Temperature", "°C", 1)}
${measureBlock(slug, component, "humidity", displayName, "Humidity", "%", 0)}`
      );
      break;
    }
    case "i2c_bh1750": {
      parts.i2cBuses.push({ sda: component.sdaPin!, scl: component.sclPin! });
      parts.sensorBlocks.push(
        `  - platform: bh1750
    i2c_id: ${i2cBusId(component.sdaPin!, component.sclPin!)}
    address: ${component.address ?? "0x23"}
    name: ${yamlQuote(`${displayName} Light`)}
    id: ${base}_illuminance
    update_interval: ${iv}s`
      );
      break;
    }
    case "i2c_scd4x": {
      parts.i2cBuses.push({ sda: component.sdaPin!, scl: component.sclPin! });
      parts.sensorBlocks.push(
        `  - platform: scd4x
    i2c_id: ${i2cBusId(component.sdaPin!, component.sclPin!)}
    update_interval: ${iv}s
    co2:
      name: ${yamlQuote(`${displayName} CO2`)}
      id: ${base}_co2
    temperature:
      name: ${yamlQuote(`${displayName} Temperature`)}
      id: ${base}_temperature
    humidity:
      name: ${yamlQuote(`${displayName} Humidity`)}
      id: ${base}_humidity`
      );
      break;
    }
    case "onewire_dallas": {
      parts.oneWirePins.push(component.pin!);
      parts.sensorBlocks.push(
        `  - platform: dallas
    one_wire_id: ${oneWireBusId(component.pin!)}
    name: ${yamlQuote(`${displayName} Temperature`)}
    id: ${base}_temperature
    unit_of_measurement: "°C"
    accuracy_decimals: 1
    update_interval: ${iv}s`
      );
      break;
    }
    case "uart_pms": {
      const uid = uartId(component.id);
      parts.uartBlocks.push({
        id: uid,
        tx: component.uartTxPin!,
        rx: component.uartRxPin!,
      });
      parts.sensorBlocks.push(
        `  - platform: pmsx003
    type: ${component.variant ?? "PMSX003"}
    uart_id: ${uid}
    update_interval: ${iv}s
    pm_1_0:
      name: ${yamlQuote(`${displayName} PM1`)}
      id: ${base}_pm1
    pm_2_5:
      name: ${yamlQuote(`${displayName} PM2.5`)}
      id: ${base}_pm25
    pm_10_0:
      name: ${yamlQuote(`${displayName} PM10`)}
      id: ${base}_pm10`
      );
      break;
    }
    case "uart_mhz19": {
      const uid = uartId(component.id);
      parts.uartBlocks.push({
        id: uid,
        tx: component.uartTxPin!,
        rx: component.uartRxPin!,
      });
      parts.sensorBlocks.push(
        `  - platform: mhz19
    uart_id: ${uid}
    update_interval: ${iv}s
    co2:
      name: ${yamlQuote(`${displayName} CO2`)}
      id: ${base}_co2`
      );
      break;
    }
    case "adc_pin": {
      parts.sensorBlocks.push(
        `  - platform: adc
    pin: GPIO${component.pin}
    name: ${yamlQuote(`${displayName} Analog`)}
    id: ${base}_voltage
    attenuation: ${component.attenuation ?? "12db"}
    update_interval: ${iv}s`
      );
      break;
    }
    case "hc_sr04": {
      parts.sensorBlocks.push(
        `  - platform: ultrasonic
    trigger_pin: GPIO${component.pin}
    echo_pin: GPIO${component.echoPin}
    name: ${yamlQuote(`${displayName} Distance`)}
    id: ${base}_distance
    unit_of_measurement: "m"
    accuracy_decimals: 2
    update_interval: ${iv}s`
      );
      break;
    }
    case "gpio_pulse_meter": {
      parts.needsTime = true;
      const rate = component.pulseRate ?? 1000;
      parts.sensorBlocks.push(
        `  - platform: pulse_meter
    name: ${yamlQuote(`${displayName} Power`)}
    id: ${base}_power
    pin: GPIO${component.pin}
    unit_of_measurement: "W"
    device_class: power
    state_class: measurement
    accuracy_decimals: 0
    filters:
      - lambda: return x * ((60.0 / ${rate}) * 1000.0);
    total:
      name: ${yamlQuote(`${displayName} Total Energy`)}
      id: ${base}_total
      unit_of_measurement: "kWh"
      device_class: energy
      state_class: total_increasing
      accuracy_decimals: 3
      filters:
        - lambda: return x * (1.0 / ${rate});`,
        `  - platform: total_daily_energy
    name: ${yamlQuote(`${displayName} Daily Energy`)}
    id: ${base}_daily
    power_id: ${base}_power
    unit_of_measurement: "kWh"
    device_class: energy
    state_class: total_increasing
    accuracy_decimals: 3
    filters:
      - multiply: 0.001`
      );
      break;
    }
    case "gpio_switch": {
      const inverted = component.inverted !== false;
      parts.switchBlocks.push(
        `  - platform: gpio
    pin: GPIO${component.pin}
    name: ${yamlQuote(component.name ?? "Switch")}
    id: ${base}
    inverted: ${inverted ? "true" : "false"}
    restore_mode: RESTORE_DEFAULT_OFF`
      );
      break;
    }
    default:
      break;
  }
}

export function renderI2cSection(buses: { sda: number; scl: number }[]): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const bus of buses) {
    const id = i2cBusId(bus.sda, bus.scl);
    if (seen.has(id)) continue;
    seen.add(id);
    lines.push(`  - id: ${id}
    sda: GPIO${bus.sda}
    scl: GPIO${bus.scl}`);
  }
  return lines;
}

export function renderOneWireSection(pins: number[]): string[] {
  return [...new Set(pins)]
    .sort((a, b) => a - b)
    .map(
      (pin) => `  - platform: gpio
    pin: GPIO${pin}
    id: ${oneWireBusId(pin)}`
    );
}

export function renderUartSection(
  blocks: { id: string; tx: number; rx: number }[]
): string[] {
  return blocks.map(
    (u) => `  - id: ${u.id}
    tx_pin: GPIO${u.tx}
    rx_pin: GPIO${u.rx}
    baud_rate: 9600`
  );
}
