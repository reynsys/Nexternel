import assert from "node:assert/strict";
import test from "node:test";
import { changeTopicFor, publishChange, subscribeChanges } from "./changes.js";

test("a change is announced with the area it touched; reads and sign-ins are not", () => {
  assert.equal(changeTopicFor("PUT", "/api/v1/dashboards/abc"), "dashboards");
  assert.equal(changeTopicFor("PATCH", "/api/v1/auth/me"), "me");
  assert.equal(changeTopicFor("POST", "/api/v1/auth/login"), null);
  assert.equal(changeTopicFor("GET", "/api/v1/dashboards"), null);
  assert.equal(changeTopicFor("POST", "/api/v1/v5/panels/resolve-batch"), null);
  assert.equal(changeTopicFor("POST", "/api/v1/v4/devices/esphome/x/yaml/validate"), null);
  assert.equal(changeTopicFor("POST", "/api/v1/v4/devices/onboard/esphome"), "devices");
  assert.equal(changeTopicFor("DELETE", "/api/v1/addons/look-hud?x=1"), "addons");
  assert.equal(changeTopicFor("POST", "/api/v1/plugin-panels/ai/p/ask"), null);
});

test("every open screen hears about a change", () => {
  const got: string[] = [];
  const stop = subscribeChanges((e) => got.push(`${e.topic}:${e.client}`));
  publishChange("dashboards", { client: "c1" });
  stop();
  publishChange("users");
  assert.deepEqual(got, ["dashboards:c1"]);
});
