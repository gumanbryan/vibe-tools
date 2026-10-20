import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTwse,
  normalizeTpex,
  mergeDaily,
  checkSize,
} from "../../scripts/data/data-core.mjs";
test("historical source mapping keeps shares and excludes warrants", () => {
  const tw = {
    date: "20260901",
    tables: [
      {
        fields: [
          "證券代號",
          "證券名稱",
          "成交股數",
          "成交金額",
          "開盤價",
          "最高價",
          "最低價",
          "收盤價",
        ],
        data: [
          ["2330", "台積電", "1,000", "100,000", "100", "101", "99", "100"],
          ["031234", "權證", "10", "1", "1", "1", "1", "1"],
        ],
      },
    ],
  };
  const r = normalizeTwse(tw, "2026-09-01");
  assert.equal(r.bars.length, 1);
  assert.equal(r.bars[0].volumeShares, "1000");
  const ot = {
    date: "20260901",
    tables: [
      {
        fields: [
          "代號",
          "名稱",
          "收盤",
          "開盤",
          "最高",
          "最低",
          "成交股數",
          "成交金額(元)",
          "發行股數",
        ],
        data: [
          ["8069", "元太", "100", "99", "101", "98", "1000", "100000", "10000"],
        ],
      },
    ],
  };
  assert.equal(normalizeTpex(ot, "2026-09-01").caps[0].marketCap, "1000000");
});
test("failed daily source preserves previous rows and warns rather than zero", () => {
  const old = {
    bars: [{ code: "1", date: "2026-09-01", close: "1", market: "tpex" }],
    warnings: [],
  };
  const r = mergeDaily(old, [{ market: "tpex", error: "HTTP503" }]);
  assert.equal(r.bars[0].close, "1");
  assert.equal(r.coverage, "partial");
  assert.equal(r.warnings.length, 1);
});
test("capacity gates and date floor", () => {
  assert.equal(checkSize(1024 ** 3 + 1).ok, false);
  assert.equal(checkSize(600 * 1024 ** 2).warning, true);
  assert.throws(() => normalizeTwse({}, "2026-08-31"));
});
test("mismatched response dates cannot be silently recorded under requested date", () => {
  assert.throws(() =>
    normalizeTwse({ date: "20260902", tables: [] }, "2026-09-01"),
  );
});
