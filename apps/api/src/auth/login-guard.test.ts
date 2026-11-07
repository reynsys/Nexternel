import { test } from "node:test";
import assert from "node:assert/strict";
import { FREE_TRIES, LoginGuard, isHomeAddress, waitText } from "./login-guard.js";

function guard() {
  let t = 1_000_000;
  const g = new LoginGuard(() => t);
  return { g, advance: (ms: number) => (t += ms) };
}

test("home addresses are recognised", () => {
  for (const ip of ["192.168.50.140", "10.0.0.5", "172.18.0.4", "127.0.0.1", "::1", "::ffff:192.168.1.2", "fd00::1"]) {
    assert.equal(isHomeAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "81.2.69.160", "172.32.0.1", "2a00:1450::1"]) {
    assert.equal(isHomeAddress(ip), false, ip);
  }
});

test("first wrong passwords are free, then the wait grows", () => {
  const { g, advance } = guard();
  for (let i = 0; i < FREE_TRIES - 1; i++) {
    g.fail("8.8.8.8");
    assert.equal(g.check("8.8.8.8").ok, true);
  }
  g.fail("8.8.8.8");
  const first = g.check("8.8.8.8");
  assert.equal(first.ok, false);
  assert.ok(!first.ok && first.retryAfterMs === 30_000);
  advance(30_000);
  assert.equal(g.check("8.8.8.8").ok, true);
  g.fail("8.8.8.8");
  const second = g.check("8.8.8.8");
  assert.ok(!second.ok && second.retryAfterMs === 60_000);
});

test("a right password clears the address", () => {
  const { g } = guard();
  for (let i = 0; i < FREE_TRIES; i++) g.fail("192.168.50.9");
  assert.equal(g.check("192.168.50.9").ok, false);
  g.succeed("192.168.50.9");
  assert.equal(g.check("192.168.50.9").ok, true);
});

test("other addresses are not slowed by one address", () => {
  const { g } = guard();
  for (let i = 0; i < FREE_TRIES; i++) g.fail("8.8.8.8");
  assert.equal(g.check("1.1.1.1").ok, true);
});

test("wait text", () => {
  assert.equal(waitText(30_000), "30 seconds");
  assert.equal(waitText(60_000), "1 minute");
  assert.equal(waitText(61_000), "2 minutes");
});
