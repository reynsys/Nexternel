import assert from "node:assert/strict";
import test from "node:test";
import { buildCaddyfile, homeNames, validName } from "./https.js";

const base = { enabled: true, extraNames: [], domain: null };

test("home certificate covers the server address, nexternel.local and localhost", () => {
  assert.deepEqual(homeNames({ ...base, extraNames: ["damn-server"] }, "192.0.2.10"), [
    "192.0.2.10",
    "nexternel.local",
    "localhost",
    "damn-server",
  ]);
});

test("secure on: https sites, default name for bare-address connections, http forwards", () => {
  const c = buildCaddyfile(base, "192.0.2.10", false);
  assert.match(c, /default_sni 192\.0\.2\.10/);
  assert.match(c, /https:\/\/192\.0\.2\.10, https:\/\/nexternel\.local, https:\/\/localhost \{\n\ttls internal/);
  assert.match(c, /redir https:\/\/\{host\}\{uri\} permanent/);
  assert.match(c, /handle \/nexternel-home-certificate\.crt/);
});

test("secure off: plain http only, still offering the certificate", () => {
  const c = buildCaddyfile({ ...base, enabled: false }, "192.0.2.10", false);
  assert.doesNotMatch(c, /https:\/\//);
  assert.match(c, /reverse_proxy ui:80/);
});

test("own domain is served only once its certificate is there", () => {
  const withDomain = { ...base, domain: "home.example.com" };
  assert.doesNotMatch(buildCaddyfile(withDomain, "10.0.0.2", false), /home\.example\.com/);
  assert.match(buildCaddyfile(withDomain, "10.0.0.2", true), /tls \/etc\/caddy\/certs\/home\.example\.com\.crt/);
});

test("names are checked", () => {
  assert.equal(validName("damn-server"), true);
  assert.equal(validName("192.168.1.20"), true);
  assert.equal(validName("bad name"), false);
  assert.equal(validName("x}\nimport /etc/passwd"), false);
});
