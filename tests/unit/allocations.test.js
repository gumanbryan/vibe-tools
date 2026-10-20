import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateClose,
  validateDayTrade,
} from "../../src/ledger/allocations.js";
const a = {
  id: "a",
  accountId: "x",
  code: "2330",
  date: "2026-09-01",
  sequence: 1,
  side: "buy",
  creditType: "margin",
  qty: "1000",
};
const b = { ...a, id: "b", date: "2026-09-02" };
const sell = { ...a, id: "s", side: "sell", date: "2026-09-03", qty: "1500" };
test("FIFO and manual partial closing never over-allocate", () => {
  assert.deepEqual(
    allocateClose([a, b], sell).value.map((x) => x.qty),
    ["1000", "500"],
  );
  assert.equal(
    allocateClose([a, b], sell, [
      { openTradeId: "b", qty: "1000" },
      { openTradeId: "a", qty: "500" },
    ]).value[0].openTradeId,
    "b",
  );
  assert.equal(allocateClose([a], sell).ok, false);
  assert.equal(allocateClose([{ ...a, accountId: "y" }], sell).ok, false);
});
test("day trade legs cannot be duplicated or cross dates", () => {
  const s = { ...sell, date: a.date, creditType: "cash", qty: "1000" };
  const buy = { ...a, creditType: "cash" };
  const x = {
    openTradeId: "a",
    closeTradeId: "s",
    qty: "1000",
    kind: "cash-day",
  };
  assert.equal(validateDayTrade([buy, s], [x], []).ok, true);
  assert.equal(validateDayTrade([buy, s], [x, x], []).ok, false);
  assert.equal(
    validateDayTrade([buy, { ...s, date: "2026-09-02" }], [x], []).ok,
    false,
  );
  assert.equal(
    validateDayTrade([{ ...buy, marketType: "odd" }, s], [x], []).ok,
    false,
  );
});
test("credit-day requires margin buy and short sell rather than arbitrary two credit types", () => {
  const x = { ...a, creditType: "margin" },
    y = { ...sell, date: a.date, qty: "1000", creditType: "cash" };
  assert.equal(
    validateDayTrade(
      [x, y],
      [
        {
          openTradeId: "a",
          closeTradeId: "s",
          kind: "credit-day",
          qty: "1000",
        },
      ],
    ).ok,
    false,
  );
});
