import assert from "node:assert/strict";
import test from "node:test";

/** Mirrors batch vs single response selection in history routes. */
function usesBatchResponseShape(query: {
  capabilityId?: string;
  capabilityIds?: string;
}): boolean {
  const ids = (query.capabilityIds?.trim() || query.capabilityId?.trim() || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const batchMode = Boolean(query.capabilityIds?.trim());
  return ids.length > 1 || (ids.length === 1 && batchMode);
}

test("history route returns batch shape when capabilityIds is used", () => {
  assert.equal(
    usesBatchResponseShape({
      capabilityIds: "cap-1",
    }),
    true
  );
  assert.equal(
    usesBatchResponseShape({
      capabilityId: "cap-1",
    }),
    false
  );
  assert.equal(
    usesBatchResponseShape({
      capabilityIds: "cap-1,cap-2",
    }),
    true
  );
});
