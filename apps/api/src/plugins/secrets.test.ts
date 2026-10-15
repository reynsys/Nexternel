import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";

process.env.JWT_SECRET ||= "test-secret-for-plugin-settings";

const { decryptSecret, encryptSecret, hashToken, pluginIdFromToken, tokenMatches, newPluginToken } = await import("./secrets.js");
const { inspectPackage } = await import("./packages.js");

test("secret settings round-trip and are not stored as plain text", () => {
  const stored = encryptSecret("sk-live-123");
  assert.ok(!stored.includes("sk-live-123"));
  assert.equal(decryptSecret(stored), "sk-live-123");
  assert.equal(decryptSecret(stored.slice(0, -4) + "AAAA"), null);
});

test("plugin tokens name their plugin and are checked by hash", () => {
  const token = newPluginToken("ai-assistant");
  assert.equal(pluginIdFromToken(token), "ai-assistant");
  assert.equal(tokenMatches(token, hashToken(token)), true);
  assert.equal(tokenMatches(token, hashToken(token + "x")), false);
  assert.equal(tokenMatches(token, null), false);
});

async function zip(files: Record<string, string>): Promise<Buffer> {
  const z = new JSZip();
  for (const [name, body] of Object.entries(files)) z.file(name, body);
  return z.generateAsync({ type: "nodebuffer" });
}

const manifest = JSON.stringify({ id: "example", name: "Example", version: "1.0.0", pluginApi: 1 });

test("a package needs a manifest and its main file", async () => {
  assert.equal((await inspectPackage(await zip({ "manifest.json": manifest, "main.mjs": "export default () => {}" }))).ok, true);
  assert.equal((await inspectPackage(await zip({ "main.mjs": "" }))).ok, false);
  assert.equal((await inspectPackage(await zip({ "manifest.json": manifest }))).ok, false);
  assert.equal((await inspectPackage(Buffer.from("not a zip"))).ok, false);
});

test("paths that climb out of the plugin folder are refused", async () => {
  const z = new JSZip();
  z.file("manifest.json", manifest);
  z.file("main.mjs", "");
  z.file("../outside.txt", "x");
  const result = await inspectPackage(await z.generateAsync({ type: "nodebuffer" }));
  assert.equal(result.ok, false);
});
