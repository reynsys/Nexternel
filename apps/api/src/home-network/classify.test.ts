import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySearch, normaliseMac, shellyModelName, type RawService } from "./classify.js";

function svc(type: string, instance: string, address: string, txt: Record<string, string> = {}): RawService {
  return { type, instance, host: null, port: null, address, txt, seenSecondsAgo: 1 };
}

// Shapes as real devices send them (names and addresses made up).
const raw = {
  services: [
    svc("_esphomelib._tcp", "porch-sensor", "10.0.0.20", {
      platform: "ESP32",
      mac: "a1b2c3d4e5f6",
      version: "2026.9.1",
      friendly_name: "Porch Sensor",
    }),
    svc("_esphomelib._tcp", "smart-plug-1", "10.0.0.21", {
      platform: "ESP8266",
      mac: "a1b2c3d4e5aa",
      project_name: "maker.smart-plug",
      friendly_name: "Smart Plug",
    }),
    svc("_shelly._tcp", "shelly1minig3-aabbccddeeff", "10.0.0.30", { gen: "3", app: "Mini1G3" }),
    svc("_http._tcp", "shelly1minig3-aabbccddeeff", "10.0.0.30", { gen: "3" }),
    svc("_http._tcp", "shelly1-AABBCC112233", "10.0.0.31", { id: "shelly1-AABBCC112233", app: "switch1" }),
    svc("_http._tcp", "My printer", "10.0.0.40"),
    svc("_airplay._tcp", "40in Example TV", "10.0.0.50", { manufacturer: "Example", model: "K1" }),
    svc("_matter._tcp", "ABCDEF0123456789-0000000000000001", "10.0.0.50"),
    svc("_matter._tcp", "ABCDEF0123456789-0000000000000002", "10.0.0.60"),
    svc("_matterc._udp", "1A2B3C4D5E6F7A8B", "10.0.0.61", { dn: "Smart plug", d: "3840" }),
    svc("_amzn-wplay._tcp", "amzn.dmgr:x", "10.0.0.70", { n: "Kitchen Fire TV" }),
  ],
  cameras: [
    {
      address: "10.0.0.80",
      xaddrs: ["http://10.0.0.80:8000/onvif/device_service"],
      scopes: ["onvif://www.onvif.org/name/Front%20Door", "onvif://www.onvif.org/hardware/Doorbell_X1"],
      seenSecondsAgo: 2,
    },
  ],
};

test("one line per device, grouped by what bringing it in takes", () => {
  const found = classifySearch(raw, { devices: [], cameras: [] });
  assert.deepEqual(
    found.map((f) => [f.kind, f.name]),
    [
      ["board", "Porch Sensor"],
      ["board", "Smart Plug"],
      ["shelly", "Shelly 1"],
      ["shelly", "Shelly 1 Mini Gen 3"],
      ["matterNew", "Smart plug"],
      ["camera", "Front Door"],
      ["matterShared", "Matter device"],
      ["other", "40in Example TV"],
      ["other", "Kitchen Fire TV"],
    ]
  );
  const tv = found.find((f) => f.name === "40in Example TV")!;
  assert.equal(tv.what, "Example K1 · Matter");
  const cam = found.find((f) => f.kind === "camera")!;
  assert.equal(cam.what, "Camera · Doorbell X1");
  const plug = found.find((f) => f.name === "Smart Plug")!;
  assert.equal(plug.readyMade, true);
  const gen1 = found.find((f) => f.name === "Shelly 1")!;
  assert.equal(gen1.shellyGen, 1);
  assert.equal(gen1.deviceId, "shelly1-aabbcc112233");
});

test("devices Nexternel already has are marked", () => {
  const found = classifySearch(raw, {
    devices: [
      {
        id: "d1",
        name: "Porch",
        firmwareType: "esphome",
        esphomeName: null,
        mqttTopicPrefix: "nexternel/porch",
        ipAddress: null,
        macAddress: "A1:B2:C3:D4:E5:F6",
      },
      {
        id: "d2",
        name: "Hall light",
        firmwareType: "shelly",
        esphomeName: null,
        mqttTopicPrefix: "shelly1minig3-aabbccddeeff",
        ipAddress: null,
        macAddress: null,
      },
    ],
    cameras: [{ id: "c1", name: "Door", host: "10.0.0.80" }],
  });
  const byName = (n: string) => found.find((f) => f.name === n)!.alreadyIn;
  assert.deepEqual(byName("Porch Sensor"), { kind: "device", id: "d1", name: "Porch" });
  assert.deepEqual(byName("Shelly 1 Mini Gen 3"), { kind: "device", id: "d2", name: "Hall light" });
  assert.deepEqual(byName("Front Door"), { kind: "camera", id: "c1", name: "Door" });
  assert.equal(byName("Smart Plug"), null);
});

test("helpers", () => {
  assert.equal(normaliseMac("ecfabc6305c1"), "ec:fa:bc:63:05:c1");
  assert.equal(normaliseMac("EC-FA-BC-63-05-C1"), "ec:fa:bc:63:05:c1");
  assert.equal(normaliseMac("abc"), null);
  assert.equal(shellyModelName("shellyplus1pm-a8032ab12345"), "Shelly Plus 1PM");
  assert.equal(shellyModelName("shellyunknown-1"), "Shelly switch");
});

test("a Zherodius device is named, and one already paired is known by its serial number", () => {
  const found = classifySearch(
    {
      services: [
        svc("_zherodius._tcp", "Garden Relays", "10.0.0.70", { board: "esp32-relay-x2", version: "1.10.2", serial: "ZH-50E4-6792" }),
        svc("_http._tcp", "Garden Relays", "10.0.0.70"),
        svc("_zherodius._tcp", "Shed Sensor", "10.0.0.71", { serial: "ZH-1111-2222" }),
      ],
      cameras: [],
    },
    {
      devices: [
        { id: "d1", name: "Garden", firmwareType: "zherodius", esphomeName: null, mqttTopicPrefix: null, ipAddress: "10.0.0.99", macAddress: null, zherodiusSerial: "ZH-50E4-6792" },
      ],
      cameras: [],
    }
  );
  assert.deepEqual(
    found.map((f) => [f.kind, f.name, f.what, f.address, f.deviceId, f.alreadyIn?.id ?? null]),
    [
      ["zherodius", "Garden Relays", "Zherodius device", "10.0.0.70", "ZH-50E4-6792", "d1"],
      ["zherodius", "Shed Sensor", "Zherodius device", "10.0.0.71", "ZH-1111-2222", null],
    ]
  );
});
