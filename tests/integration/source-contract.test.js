import test from "node:test";
import assert from "node:assert/strict";
import { validateSourceReport } from "../../scripts/data/probe-sources.mjs";
test("verified sources require captured evidence and terms", () => {
  const result = validateSourceReport({
    sources: [{ sourceId: "twse", status: "verified" }],
  });
  assert.equal(result.ok, false);
});
test("partial sources retain their actual gap", () => {
  assert.equal(
    validateSourceReport({
      sources: [
        { sourceId: "twse", status: "partial", reason: "History not tested" },
      ],
    }).ok,
    true,
  );
});
