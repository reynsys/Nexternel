import { test } from "node:test";
import assert from "node:assert/strict";
import { ENTRANCE_HEADER, FREE_TRIES, LoginGuard, isFromHome, isHomeAddress, secureCookieHeader, waitText } from "./login-guard.js";

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

test("visitors through the outside entrance never count as home, even with a home address", () => {
  assert.equal(isFromHome({ ip: "192.168.50.140", headers: {} }), true);
  assert.equal(isFromHome({ ip: "172.18.0.9", headers: { [ENTRANCE_HEADER]: "outside" } }), false);
  assert.equal(isFromHome({ ip: "192.168.50.140", headers: { [ENTRANCE_HEADER]: "" } }), false);
  assert.equal(isFromHome({ ip: "81.2.69.160", headers: {} }), false);
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

test("cookies from outside get the padlock-only mark, once", () => {
  assert.equal(secureCookieHeader("a=1; Path=/; HttpOnly"), "a=1; Path=/; HttpOnly; Secure");
  assert.deepEqual(secureCookieHeader(["a=1; Secure", "b=2"]), ["a=1; Secure", "b=2; Secure"]);
  assert.equal(secureCookieHeader(undefined), undefined);
});
