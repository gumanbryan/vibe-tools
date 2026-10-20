import test from "node:test";
import assert from "node:assert/strict";
import {
  postTrade,
  replayEntries,
  validateEntry,
  settleTrade,
} from "../../src/ledger/journal.js";
const calendar = {
  businessDates: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"],
};
const base = {
  id: "t",
  accountId: "a",
  date: "2026-09-01",
  code: "2330",
  side: "buy",
  creditType: "cash",
  qty: "1000",
  price: "50",
};
const fee = { grossFee: "0", rebate: "0" };
test("cash settlement keeps equity and entries are balanced and idempotent", () => {
  const e = postTrade(base, [], fee, "0", calendar).value;
  assert.equal(
    e.every((x) => validateEntry(x).ok),
    true,
  );
  const s = settleTrade(base, e, "2026-09-03").value;
  const bal = replayEntries([...e, ...s, ...s], "2026-09-03").value.balances;
  assert.equal(bal.cash, "-50000");
  assert.equal(bal.payable, "0");
  assert.equal(bal.inventory, "50000");
  assert.equal(
    validateEntry({ lines: [{ debit: "1", credit: "0" }] }).ok,
    false,
  );
});
test("financing draw replaces payable instead of double counting debt", () => {
  const t = {
    ...base,
    qty: "1000",
    price: "100",
    creditType: "margin",
    ruleSnapshot: { marginRatio: "0.6" },
  };
  const e = postTrade(t, [], fee, "0", calendar).value;
  const before = replayEntries(e, t.date).value.balances;
  assert.equal(before.payable, "-100000");
  assert.equal(before.marginDebt ?? "0", "0");
  const s = settleTrade(t, e, "2026-09-03").value;
  const b = replayEntries([...e, ...s], "2026-09-03").value.balances;
  assert.equal(b.cash, "-40000");
  assert.equal(b.marginDebt, "-60000");
  assert.equal(b.payable, "0");
});
test("margin exit below principal creates cash debit obligation instead of invalid negative journal line", () => {
  const t = {
    ...base,
    side: "sell",
    creditType: "margin",
    price: "20",
    principalRepaid: "60000",
    ruleSnapshot: { marginRatio: "0.6" },
  };
  const e = postTrade(t, [], fee, "0", calendar).value;
  const r = settleTrade(t, e, "2026-09-03");
  assert.equal(r.ok, true);
  assert.equal(
    replayEntries([...e, ...r.value], "2026-09-03").value.balances.cash,
    "-40000",
  );
});
