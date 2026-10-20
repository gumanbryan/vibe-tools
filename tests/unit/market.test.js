import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDataset, validateManifest } from "../../src/market/schema.js";
import { addBusinessDays } from "../../src/domain/calendar.js";
test("normalization preserves code, source units and start date", () => {
  const spec = {
    market: "twse",
    sourceId: "test",
    version: "1",
    volumeMultiplier: 1000,
    turnoverMultiplier: 1000,
  };
  const r = normalizeDataset(
    [
      {
        code: "0050",
        date: "2026-09-01",
        close: "100",
        volume: "2",
        turnover: "200",
      },
    ],
    spec,
  );
  assert.equal(r.value.rows[0].code, "0050");
  assert.equal(r.value.rows[0].volumeShares, "2000");
  assert.equal(r.value.rows[0].turnoverTwd, "200000");
  assert.equal(
    normalizeDataset([{ code: "0050", date: "2026-08-31", close: "100" }], spec)
      .ok,
    false,
  );
});
test("calendar follows listed business dates and fails beyond coverage", () => {
  const c = { businessDates: ["2026-09-04", "2026-09-07", "2026-09-08"] };
  assert.equal(addBusinessDays("2026-09-04", 2, c).value, "2026-09-08");
  assert.equal(addBusinessDays("2026-09-08", 2, c).ok, false);
});
test("duplicate bars and invalid manifest are rejected", () => {
  const b = { code: "1", date: "2026-09-01", close: "1" };
  assert.equal(
    normalizeDataset([b, b], { sourceId: "a", version: "v", market: "twse" })
      .ok,
    false,
  );
  assert.equal(validateManifest({}).ok, false);
});
