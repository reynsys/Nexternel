import assert from "node:assert/strict";
import test from "node:test";
import { redactUrlSecrets, serializeRequestForLog } from "./log-redact.js";

test("the sign-in pass in the live-updates address is hidden, the rest is kept", () => {
  assert.equal(
    redactUrlSecrets("/api/v1/ws?access_token=eyJhbGci.abc.def&channel=changes"),
    "/api/v1/ws?access_token=[hidden]&channel=changes"
  );
});

test("other secret-looking parameters are hidden too", () => {
  assert.equal(redactUrlSecrets("/x?token=1&api_key=2&password=3&limit=30"), "/x?token=[hidden]&api_key=[hidden]&password=[hidden]&limit=30");
});

test("addresses without secrets are unchanged", () => {
  assert.equal(redactUrlSecrets("/api/v1/notifications?limit=30"), "/api/v1/notifications?limit=30");
  assert.equal(redactUrlSecrets("/api/v1/plugin-host/desired"), "/api/v1/plugin-host/desired");
});

test("the request log keeps its usual fields", () => {
  assert.deepEqual(
    serializeRequestForLog({ method: "GET", url: "/ws?access_token=t", host: "api:4000", ip: "172.18.0.1", socket: { remotePort: 4321 } }),
    { method: "GET", url: "/ws?access_token=[hidden]", host: "api:4000", remoteAddress: "172.18.0.1", remotePort: 4321 }
  );
});
