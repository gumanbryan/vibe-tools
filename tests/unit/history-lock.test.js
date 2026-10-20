import test from "node:test";
import assert from "node:assert/strict";
import {
  captureMarketHistory,
  compareMarketHistory,
  useLockedMarket,
} from "../../src/market/history-lock.js";
const book = {
  openingDate: "2026-09-01",
  openingPositions: [{ code: "1" }],
  trades: [],
  confirmations: [],
  benchmarks: [],
};
const market = {
  bars: [{ code: "1", date: "2026-09-01", close: "100" }],
  indices: [],
  events: [],
  asOf: "2026-09-01",
  calendar: { businessDates: ["2026-09-01"] },
};
test("R5 changed consumed historical price requires preview and old values stay effective", () => {
  const lock = captureMarketHistory(book, market);
  const incoming = {
    ...market,
    bars: [{ code: "1", date: "2026-09-01", close: "50" }],
  };
  const diff = compareMarketHistory(lock, incoming);
  assert.equal(diff.length, 1);
  assert.equal(useLockedMarket(lock, incoming).bars[0].close, "100");
  assert.equal(incoming.bars[0].close, "50");
});
