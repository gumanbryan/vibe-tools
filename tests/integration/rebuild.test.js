import test from "node:test";
import assert from "node:assert/strict";
import { prepareRebuild } from "../../src/storage/rebuild.js";
import { createBook } from "../../src/storage/book.js";
test("historical rebuild previews differences and leaves original untouched", () => {
  const b = createBook("personal", "2026-09-03");
  b.accounts[0].openingCash = "100000";
  const original = structuredClone(b);
  const market = {
    bars: [],
    securities: [],
    events: [],
    calendar: { businessDates: ["2026-09-01", "2026-09-02", "2026-09-03"] },
  };
  const p = prepareRebuild(
    b,
    { openingDate: "2026-09-01", openingCash: "90000" },
    market,
  );
  assert.equal(p.ok, true);
  assert.deepEqual(b, original);
  assert.equal(p.value.anchorChecks.cash.matches, false);
  assert.equal(p.value.draft.accounts[0].openingCash, "90000");
});
