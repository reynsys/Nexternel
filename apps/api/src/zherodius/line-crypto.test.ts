// The line maths (line-crypto.ts) against the official test vectors: RFC 9383 Appendix C (SPAKE2+)
// and the cacophony Noise vectors (Noise_IK_25519_AESGCM_SHA256). Same tests as Zherodius's tools/line2.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spakeProver, spakeVerifier, spakeL, spakeSecrets, x25519Key, noiseInitiator, noiseResponder, hex, unhex } from "./line-crypto.js";

const R = {
  context: "SPAKE2+-P256-SHA256-HKDF-SHA256-HMAC-SHA256 Test Vectors",
  w0: 0xbb8e1bbcf3c48f62c08db243652ae55d3e5586053fca77102994f23ad95491b3n,
  w1: 0x7e945f34d78785b8a3ef44d0df5a1a97d6b3b460409a345ca7830387a74b1dban,
  L: "04eb7c9db3d9a9eb1f8adab81b5794c1f13ae3e225efbe91ea487425854c7fc00f00bfedcbd09b2400142d40a14f2064ef31dfaa903b91d1faea7093d835966efd",
  x: 0xd1232c8e8693d02368976c174e2088851b8365d0d79a9eee709c6a05a2fad539n,
  shareP: "04ef3bd051bf78a2234ec0df197f7828060fe9856503579bb1733009042c15c0c1de127727f418b5966afadfdd95a6e4591d171056b333dab97a79c7193e341727",
  y: 0x717a72348a182085109c8d3917d6c43d59b224dc6a7fc4f0483232fa6516d8b3n,
  shareV: "04c0f65da0d11927bdf5d560c69e1d7d939a05b0e88291887d679fcadea75810fb5cc1ca7494db39e82ff2f50665255d76173e09986ab46742c798a9a68437b048",
  Z: "04bbfce7dd7f277819c8da21544afb7964705569bdf12fb92aa388059408d50091a0c5f1d3127f56813b5337f9e4e67e2ca633117a4fbd559946ab474356c41839",
  V: "0458bf27c6bca011c9ce1930e8984a797a3419797b936629a5a937cf2f11c8b9514b82b993da8a46e664f23db7c01edc87faa530db01c2ee405230b18997f16b68",
  main: "4c59e1ccf2cfb961aa31bd9434478a1089b56cd11542f53d3576fb6c2a438a29",
  confirmP: "926cc713504b9b4d76c9162ded04b5493e89109f6d89462cd33adc46fda27527",
  confirmV: "9747bcc4f8fe9f63defee53ac9b07876d907d55047e6ff2def2e7529089d3e68",
  shared: "0c5f8ccd1413423a54f6c1fb26ff01534a87f893779c6e68666d772bfd91f3e7",
};

test("SPAKE2+ matches RFC 9383 Appendix C", () => {
  const ids = { context: R.context, idProver: Buffer.from("client"), idVerifier: Buffer.from("server") };
  assert.equal(hex(spakeL(R.w1)), R.L);
  const pr = spakeProver({ ...ids, w0: R.w0, w1: R.w1, x: R.x });
  assert.equal(hex(pr.shareP), R.shareP);
  const ve = spakeVerifier({ ...ids, w0: R.w0, L: unhex(R.L), y: R.y }, pr.shareP);
  assert.equal(hex(ve.shareV), R.shareV);
  assert.equal(hex(ve.Z), R.Z);
  assert.equal(hex(ve.V), R.V);
  assert.equal(hex(ve.keys.main), R.main);
  assert.equal(hex(ve.confirmV), R.confirmV);
  const done = pr.finish(ve.shareV, ve.confirmV);
  assert.equal(hex(done.confirmP), R.confirmP);
  assert.equal(hex(done.shared), R.shared);
  assert.ok(ve.check(done.confirmP));
});

test("SPAKE2+ with a wrong code fails on both sides", () => {
  const salt = Buffer.alloc(16, 7), idP = Buffer.alloc(32, 1), idV = Buffer.alloc(32, 2);
  const good = spakeSecrets("7KQ2-M9XD", salt, idP, idV), bad = spakeSecrets("7KQ2-M9XE", salt, idP, idV);
  assert.deepEqual(spakeSecrets("7kq2 m9xd", salt, idP, idV), good);           // as typed: small letters, space
  const pr = spakeProver({ idProver: idP, idVerifier: idV, ...bad });
  const ve = spakeVerifier({ idProver: idP, idVerifier: idV, w0: good.w0, L: spakeL(good.w1) }, pr.shareP);
  assert.throws(() => pr.finish(ve.shareV, ve.confirmV), /not right/);
  assert.equal(ve.check(Buffer.alloc(32)), false);
});

test("Noise IK matches the cacophony vector", () => {
  const v = JSON.parse(fs.readFileSync(new URL("./vectors/noise-ik-aesgcm-sha256.json", import.meta.url), "utf8"));
  const ini = noiseInitiator({ s: x25519Key(unhex(v.init_static)), rs: unhex(v.init_remote_static), e: x25519Key(unhex(v.init_ephemeral)), prologue: unhex(v.init_prologue) });
  const res = noiseResponder({ s: x25519Key(unhex(v.resp_static)), e: x25519Key(unhex(v.resp_ephemeral)), prologue: unhex(v.resp_prologue) });
  const m1 = ini.writeMessage1(unhex(v.messages[0].payload));
  assert.equal(hex(m1), v.messages[0].ciphertext);
  const r1 = res.readMessage1(m1);
  assert.equal(hex(r1.payload), v.messages[0].payload);
  assert.equal(hex(r1.hubKey), hex(x25519Key(unhex(v.init_static)).pub));
  const w2 = res.writeMessage2(unhex(v.messages[1].payload));
  assert.equal(hex(w2.message), v.messages[1].ciphertext);
  const i2 = ini.readMessage2(w2.message);
  assert.equal(hex(i2.hash), v.handshake_hash);
  for (let k = 2; k < v.messages.length; k++) {                       // transport: initiator, responder, initiator …
    const m = v.messages[k], [snd, rcv] = k % 2 === 0 ? [i2.send, w2.recv] : [w2.send, i2.recv];
    const c = snd.encrypt(Buffer.alloc(0), unhex(m.payload));
    assert.equal(hex(c), m.ciphertext);
    assert.equal(hex(rcv.decrypt(Buffer.alloc(0), c)), m.payload);
  }
});

test("Noise IK: a changed or repeated message is refused", () => {
  const dev = x25519Key(), hub = x25519Key();
  const ini = noiseInitiator({ s: hub, rs: dev.pub }), res = noiseResponder({ s: dev });
  res.readMessage1(ini.writeMessage1());
  const w2 = res.writeMessage2(), i2 = ini.readMessage2(w2.message);
  const c = i2.send.encrypt(Buffer.alloc(0), Buffer.from('{"id":1}'));
  assert.equal(w2.recv.decrypt(Buffer.alloc(0), c).toString(), '{"id":1}');
  assert.throws(() => w2.recv.decrypt(Buffer.alloc(0), c));                         // the same message again
  const d = i2.send.encrypt(Buffer.alloc(0), Buffer.from('{"id":2}')); d[3] ^= 1;
  assert.throws(() => w2.recv.decrypt(Buffer.alloc(0), d));                         // changed on the way
});
