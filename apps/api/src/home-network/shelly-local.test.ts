import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import { pointShellyAtNexternel, readShelly, ShellyPasswordNeeded } from "./shelly-local.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const SERVICE = { host: "10.0.0.2", port: 1883, username: "nx", password: "secret" };

/** A pretend Gen 3 Shelly with a password (digest, user admin). */
function fakeGen3(password: string | null) {
  const calls: Array<{ method: string; params: any }> = [];
  const realm = "shelly1minig3-aabbccddeeff";
  const nonce = "12345";
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/shelly") {
        res.end(JSON.stringify({ id: realm, mac: "AABBCCDDEEFF", model: "S3SW-001X8EU", gen: 3, auth_en: Boolean(password) }));
        return;
      }
      if (password) {
        const auth = req.headers.authorization ?? "";
        const f = (k: string) => new RegExp(`${k}="?([^",]+)"?`).exec(auth)?.[1] ?? "";
        const ok =
          f("response") ===
          sha(`${sha(`admin:${realm}:${password}`)}:${nonce}:${f("nc")}:${f("cnonce")}:auth:${sha("POST:/rpc")}`);
        if (!ok) {
          res.writeHead(401, { "www-authenticate": `Digest qop="auth", realm="${realm}", nonce="${nonce}", algorithm=SHA-256` });
          res.end();
          return;
        }
      }
      const rpc = JSON.parse(body);
      calls.push({ method: rpc.method, params: rpc.params });
      const results: Record<string, unknown> = {
        "Shelly.GetStatus": { "switch:0": { output: false }, sys: {} },
        "Sys.GetConfig": { device: { name: "Porch light" } },
        "Mqtt.GetConfig": { enable: true, server: "10.0.0.9:1883" },
        "Mqtt.SetConfig": { restart_required: true },
        "Shelly.Reboot": null,
      };
      res.end(JSON.stringify({ id: 1, result: results[rpc.method] }));
    });
  });
  return { server, calls };
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test("Gen 3 with a password: asks for it, then points the switch at Nexternel", async () => {
  const { server, calls } = fakeGen3("pw1");
  const ip = await listen(server);
  try {
    await assert.rejects(() => readShelly(ip), ShellyPasswordNeeded);
    await assert.rejects(() => readShelly(ip, "wrong"), ShellyPasswordNeeded);
    const facts = await readShelly(ip, "pw1");
    assert.deepEqual(facts, {
      gen: 2,
      id: "shelly1minig3-aabbccddeeff",
      mac: "AABBCCDDEEFF",
      name: "Porch light",
      model: "S3SW-001X8EU",
      switchCount: 1,
    });
    const { previousServer } = await pointShellyAtNexternel(ip, facts, SERVICE, "pw1");
    assert.equal(previousServer, "10.0.0.9:1883");
    const set = calls.find((c) => c.method === "Mqtt.SetConfig")!;
    assert.equal(set.params.config.server, "10.0.0.2:1883");
    assert.equal(set.params.config.topic_prefix, "shelly1minig3-aabbccddeeff");
    assert.equal(set.params.config.user, "nx");
    assert.ok(calls.some((c) => c.method === "Shelly.Reboot"));
  } finally {
    server.close();
  }
});

test("Gen 1 without a password: settings changed through its settings page", async () => {
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url ?? "");
    if (req.url === "/shelly") return res.end(JSON.stringify({ type: "SHSW-1", mac: "AABBCC112233", auth: false }));
    if (req.url === "/settings")
      return res.end(
        JSON.stringify({ device: { hostname: "shelly1-AABBCC112233", mac: "AABBCC112233", num_outputs: 1, type: "SHSW-1" }, name: null, mqtt: { enable: false } })
      );
    res.end("{}");
  });
  const ip = await listen(server);
  try {
    const facts = await readShelly(ip);
    assert.equal(facts.gen, 1);
    assert.equal(facts.id, "shelly1-AABBCC112233");
    const { previousServer } = await pointShellyAtNexternel(ip, facts, SERVICE);
    assert.equal(previousServer, null);
    const change = seen.find((u) => u.startsWith("/settings?"))!;
    const q = new URLSearchParams(change.split("?")[1]);
    assert.equal(q.get("mqtt_enable"), "true");
    assert.equal(q.get("mqtt_server"), "10.0.0.2:1883");
    assert.equal(q.get("mqtt_id"), "shelly1-AABBCC112233");
    assert.ok(seen.includes("/reboot"));
  } finally {
    server.close();
  }
});
