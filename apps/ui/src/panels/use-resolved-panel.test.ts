import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { panelCapabilityResolverKey } from "../lib/dashboard-data-runtime/panel-resolver-key.js";

const hookSource = readFileSync(
  fileURLToPath(new URL("./useResolvedPanel.ts", import.meta.url)),
  "utf8"
);

test("useResolvedPanel keys resolver effect by stable resolverKey, not scope object identity", () => {
  const effectStart = hookSource.indexOf("useEffect(() => {");
  const effectEnd = hookSource.indexOf("}, [resolverKey, kind, runtime, shouldResolve, reloadNonce]);");
  const effect = hookSource.slice(effectStart, effectEnd);

  assert.ok(effectStart >= 0 && effectEnd > effectStart);
  assert.doesNotMatch(effect, /\[load,/);
  assert.doesNotMatch(hookSource, /panelCapabilityResolverKey\(kind, resolvedScope\)/);
});

test("panelCapabilityResolverKey is stable across scope array ordering", () => {
  const first = panelCapabilityResolverKey("panel.status", {
    areaIds: ["b", "a"],
    systemIds: ["environment"],
    contentMode: "manual",
    capabilityIds: ["cap-1"],
  });
  const second = panelCapabilityResolverKey("panel.status", {
    areaIds: ["a", "b"],
    systemIds: ["environment"],
    contentMode: "manual",
    capabilityIds: ["cap-1"],
  });

  assert.equal(first, second);
});
