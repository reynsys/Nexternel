import assert from "node:assert/strict";
import test from "node:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  checkPackage,
  licenceCovers,
  licenceState,
  normalizeLicenceKey,
  packageSigningText,
  readLicence,
  type AddonPackage,
  type LicencePayload,
} from "./licence.js";

const shop = generateKeyPairSync("ed25519");
const forger = generateKeyPairSync("ed25519");
const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function token(p: LicencePayload, key = shop.privateKey): string {
  const body = b64url(Buffer.from(JSON.stringify(p)));
  return `${body}.${b64url(sign(null, Buffer.from(body), key))}`;
}

const licence: LicencePayload = { v: 1, lid: "L-1", serverId: "srv-a", packs: ["look-3d"], iat: 1000, exp: 5000 };

test("a licence signed by the licence server is read", () => {
  assert.deepEqual(readLicence(token(licence), [shop.publicKey]), licence);
});

test("a made-up or changed licence is refused", () => {
  assert.equal(readLicence(token(licence, forger.privateKey), [shop.publicKey]), null);
  const [body, sig] = token(licence).split(".");
  const changed = b64url(Buffer.from(JSON.stringify({ ...licence, packs: ["*"] })));
  assert.equal(readLicence(`${changed}.${sig}`, [shop.publicKey]), null);
  assert.equal(readLicence(`${body}`, [shop.publicKey]), null);
  assert.equal(readLicence(token(licence), []), null);
});

test("a licence works only on its own server and until it ends", () => {
  assert.equal(licenceState(licence, "srv-a", 2000), "active");
  assert.equal(licenceState(licence, "srv-a", 6000), "expired");
  assert.equal(licenceState(licence, "srv-b", 2000), "other-server");
});

test("a licence unlocks its packs; the owner's unlocks all", () => {
  assert.equal(licenceCovers(licence, "look-3d"), true);
  assert.equal(licenceCovers(licence, "look-hud"), false);
  assert.equal(licenceCovers({ ...licence, packs: ["*"] }, "look-hud"), true);
});

function pack(code: string, key = shop.privateKey, licenceId = "L-1"): AddonPackage {
  const base = { manifest: { id: "look-3d", name: "3D", kind: "look" as const, version: "1.0.0" }, bundle: Buffer.from(code).toString("base64"), licenceId };
  return { format: 1, ...base, signature: b64url(sign(null, Buffer.from(packageSigningText(base)), key)) };
}

test("a genuine pack is accepted and its code returned", () => {
  const r = checkPackage(pack("export default 1"), [shop.publicKey], { packId: "look-3d", licenceId: "L-1" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.code.toString(), "export default 1");
});

test("a changed, forged, swapped or someone else's pack is refused", () => {
  const p = pack("export default 1");
  const changed = { ...p, bundle: Buffer.from("export default 2").toString("base64") };
  assert.equal(checkPackage(changed, [shop.publicKey], { licenceId: "L-1" }).ok, false);
  assert.equal(checkPackage(pack("x", forger.privateKey), [shop.publicKey], { licenceId: "L-1" }).ok, false);
  assert.equal(checkPackage(p, [shop.publicKey], { packId: "look-hud", licenceId: "L-1" }).ok, false);
  assert.equal(checkPackage(pack("x", shop.privateKey, "L-2"), [shop.publicKey], { licenceId: "L-1" }).ok, false);
  assert.equal(checkPackage({ hello: 1 }, [shop.publicKey], { licenceId: "L-1" }).ok, false);
});

test("the signing text covers the code itself", () => {
  const a = packageSigningText(pack("a"));
  assert.ok(a.includes(createHash("sha256").update("a").digest("hex")));
});

test("licence keys are read the way people type them", () => {
  assert.equal(normalizeLicenceKey(" nx3d-abcd-1234-efgh "), "NX3D-ABCD-1234-EFGH");
  assert.equal(normalizeLicenceKey("short"), null);
  assert.equal(normalizeLicenceKey("bad;key-1234567890"), null);
});
