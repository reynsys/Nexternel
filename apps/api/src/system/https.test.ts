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

test("plain http is the normal address; the home certificate is offered but never forced", () => {
  const c = buildCaddyfile(base, "192.0.2.10", false);
  assert.match(c, /default_sni 192\.0\.2\.10/);
  assert.match(c, /https:\/\/192\.0\.2\.10, https:\/\/nexternel\.local, https:\/\/localhost \{\n\ttls internal/);
  assert.doesNotMatch(c, /\tredir /);
  assert.match(c, /auto_https disable_redirects/);
  assert.match(c, /http:\/\/:80, http:\/\/:8080 \{[\s\S]*reverse_proxy ui:80/);
});

test("with a trusted name, plain http forwards to it", () => {
  const c = buildCaddyfile({ ...base, domain: "smith.example.net" }, "192.0.2.10", true);
  assert.match(c, /redir https:\/\/smith\.example\.net\{uri\} permanent/);
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
