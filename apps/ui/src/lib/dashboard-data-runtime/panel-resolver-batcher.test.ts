import assert from "node:assert/strict";
import test from "node:test";
import type {
  PanelResolveRequest,
  PanelResolveResult,
} from "../../api.js";
import { PanelResolverBatcher } from "./panel-resolver-batcher.js";

function resultFor(request: PanelResolveRequest): PanelResolveResult {
  return {
    panelKind: request.panelKind,
    panelScope: {
      areaIds: request.panelScope?.areaIds ?? [],
      systemIds: request.panelScope?.systemIds ?? [],
      groupIds: request.panelScope?.groupIds ?? [],
      capabilityIds: request.panelScope?.capabilityIds ?? [],
      cameraIds: [],
    },
    capabilities: [],
  };
}

for (const panelCount of [10, 50, 100]) {
  test(`${panelCount} distinct Panel resolves coalesce into one batch`, async () => {
    let calls = 0;
    let largestBatch = 0;
    const batcher = new PanelResolverBatcher(async (requests) => {
      calls += 1;
      largestBatch = Math.max(largestBatch, requests.length);
      return requests.map(({ requestId, request }) => ({
        requestId,
        result: resultFor(request),
      }));
    });

    const requests = Array.from({ length: panelCount }, (_, index) => {
      const controller = new AbortController();
      return batcher.request(
        {
          panelKind: "panel.status",
          panelScope: { areaIds: [`area-${index}`] },
        },
        controller.signal
      );
    });

    await Promise.all(requests);
    assert.equal(calls, 1);
    assert.equal(largestBatch, panelCount);
    assert.equal(batcher.diagnostics().batchesSent, 1);
  });
}

test("aborted queued Panel resolve is omitted from the batch", async () => {
  let batchSize = 0;
  const batcher = new PanelResolverBatcher(async (requests) => {
    batchSize = requests.length;
    return requests.map(({ requestId, request }) => ({
      requestId,
      result: resultFor(request),
    }));
  });
  const aborted = new AbortController();
  const active = new AbortController();
  const ignored = batcher.request(
    { panelKind: "panel.status" },
    aborted.signal
  );
  const kept = batcher.request(
    { panelKind: "panel.controls" },
    active.signal
  );
  aborted.abort();

  await assert.rejects(ignored, { name: "AbortError" });
  assert.equal((await kept).panelKind, "panel.controls");
  assert.equal(batchSize, 1);
});
