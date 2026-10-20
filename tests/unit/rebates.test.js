import test from "node:test";
import assert from "node:assert/strict";
import { groupRebates, confirmRebate } from "../../src/ledger/rebates.js";
test("monthly rebate remains receivable until confirmed then records difference only", () => {
  const buckets = groupRebates([
    { id: "t", accountId: "a", date: "2026-09-02", rebate: "14.4" },
  ]).value;
  assert.equal(buckets[0].expectedDate, "2026-10-15");
  assert.equal(buckets[0].amount, "14.4");
  const r = confirmRebate(buckets[0], "14", "2026-10-16").value;
  assert.equal(r.adjustment, "-0.4");
  assert.equal(
    confirmRebate({ ...buckets[0], received: true }, "14", "2026-10-16").ok,
    false,
  );
});
