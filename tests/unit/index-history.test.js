import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIndexHistory } from "../../scripts/data/data-core.mjs";
test("official OTC monthly history maps dated OHLC from September 1", () => {
  const rows = normalizeIndexHistory(
    {
      tables: [
        {
          fields: ["日期", "開市", "最高", "最低", "收市", "漲/跌"],
          data: [
            ["2026/09/01", "402.12", "412.90", "402.12", "410.77", "9.07"],
          ],
        },
      ],
    },
    "TPEX",
    "櫃買指數",
  );
  assert.deepEqual(rows[0], {
    code: "TPEX",
    name: "櫃買指數",
    date: "2026-09-01",
    open: "402.12",
    high: "412.90",
    low: "402.12",
    close: "410.77",
  });
});
