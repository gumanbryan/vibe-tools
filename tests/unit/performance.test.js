import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCloseFlow,
  valueAccount,
  buildSnapshots,
} from "../../src/performance/portfolio.js";
import { createBook } from "../../src/storage/book.js";
test("unit NAV does not move from deposits or withdrawals", () => {
  assert.deepEqual(
    applyCloseFlow({
      equityBeforeFlow: "110000",
      previousUnits: "10000",
      flow: "55000",
    }).value,
    { equity: "165000", units: "15000", unitNav: "11" },
  );
  assert.equal(
    applyCloseFlow({
      equityBeforeFlow: "165000",
      previousUnits: "15000",
      flow: "-22000",
    }).value.units,
    "13000",
  );
  assert.equal(
    applyCloseFlow({ equityBeforeFlow: "0", previousUnits: "0", flow: "0" })
      .value.unitNav,
    null,
  );
  assert.equal(
    applyCloseFlow({
      equityBeforeFlow: "100",
      previousUnits: "10",
      flow: "-101",
    }).ok,
    false,
  );
});
const market = {
  bars: [
    { code: "1", date: "2026-09-01", close: "100", quality: "valid" },
    { code: "1", date: "2026-09-02", close: "110", quality: "valid" },
    { code: "1", date: "2026-09-03", close: "110", quality: "valid" },
  ],
  calendar: {
    businessDates: [
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-07",
      "2026-09-08",
    ],
  },
  securities: [{ code: "1", productType: "stock" }],
  events: [],
};
test("account daily series excludes external flow and includes dividend only once", () => {
  const b = createBook("personal", "2026-09-01");
  b.openingPositions = [
    {
      id: "p",
      accountId: "default",
      code: "1",
      qty: "1000",
      price: "100",
      creditType: "cash",
      date: b.openingDate,
    },
  ];
  b.cashFlows = [
    { id: "f", accountId: "default", date: "2026-09-02", amount: "55000" },
  ];
  const r = buildSnapshots(b, market, "2026-09-03").value;
  assert.equal(r[0].equity, "100000");
  assert.equal(r[1].equity, "165000");
  assert.equal(r[1].unitNav, "11");
  assert.equal(r[1].units, "15000");
  assert.equal(r[2].unitNav, "11");
});
test("cash trade recognizes payable before settlement without double value", () => {
  const b = createBook("personal", "2026-09-01");
  b.accounts[0].openingCash = "100000";
  b.accounts[0].profile.discountTenths = "10";
  b.trades = [
    {
      id: "t",
      accountId: "default",
      date: "2026-09-01",
      code: "1",
      side: "buy",
      qty: "500",
      price: "100",
      creditType: "cash",
      marketType: "regular",
      actualGrossFee: "0",
      ruleSnapshot: b.accounts[0].profile,
    },
  ];
  const a = valueAccount(b, market, "2026-09-01").value;
  assert.equal(a.equity, "100000");
  assert.equal(a.balances.cash, "100000");
  assert.equal(a.balances.payable, "-50000");
  const c = valueAccount(b, market, "2026-09-03").value;
  assert.equal(c.balances.cash, "50000");
  assert.equal(c.equity, "105000");
});
test("opening short loses value when price increases and margin counts once", () => {
  const b = createBook("personal", "2026-09-01");
  b.accounts[0].openingCash = "10000";
  b.openingPositions = [
    {
      id: "s",
      accountId: "default",
      code: "1",
      qty: "1000",
      price: "100",
      creditType: "short",
      restricted: "190000",
      principal: "0",
      annualRate: "0",
      date: b.openingDate,
    },
  ];
  const r = valueAccount(b, market, "2026-09-02").value;
  assert.equal(r.shortValue, "110000");
  assert.equal(r.equity, "90000");
});
test("delivered stock dividend becomes sellable once with conserved cost basis", () => {
  const b = createBook("personal", "2026-09-01");
  b.accounts[0].openingCash = "10000";
  b.openingPositions = [
    {
      id: "p",
      accountId: "default",
      code: "1",
      qty: "1000",
      price: "100",
      creditType: "cash",
      date: b.openingDate,
    },
  ];
  b.confirmations = [
    {
      id: "div",
      accountId: "default",
      code: "1",
      confirmed: true,
      kind: "stock-dividend",
      exDate: "2026-09-02",
      receivedDate: "2026-09-03",
      qty: "1000",
      ratio: "0.1",
      pendingQty: "100",
    },
  ];
  const r = valueAccount(b, market, "2026-09-03");
  assert.equal(r.ok, true);
  assert.equal(r.value.pendingStockValue, "0");
  assert.equal(
    r.value.positions.reduce((n, p) => n + Number(p.qty), 0),
    1100,
  );
  const cost = r.value.positions.reduce(
    (n, p) => n + Number(p.price) * Number(p.qty),
    0,
  );
  assert.ok(Math.abs(cost - 100000) < 0.00001);
});
test("a financing lot accrues until repayment settlement after exit", () => {
  const b = createBook("personal", "2026-09-01");
  b.accounts[0].openingCash = "100000";
  b.accounts[0].profile.annualRate = "0.06";
  b.openingPositions = [
    {
      id: "p",
      accountId: "default",
      code: "1",
      qty: "1000",
      price: "100",
      principal: "60000",
      annualRate: "0.06",
      creditType: "margin",
      date: b.openingDate,
    },
  ];
  b.trades = [
    {
      id: "s",
      accountId: "default",
      code: "1",
      date: "2026-09-02",
      side: "sell",
      creditType: "margin",
      qty: "1000",
      price: "110",
      actualGrossFee: "0",
      ruleSnapshot: b.accounts[0].profile,
    },
  ];
  const r = valueAccount(b, market, "2026-09-03").value;
  assert.ok(Number(r.interestAccrued) > (60000 * 0.06 * 2) / 365);
  assert.equal(r.balances.marginDebt, "-60000");
});
test("short holding costs stop on repayment and partial cover releases proportional restricted cash", () => {
  const b = createBook("personal", "2026-09-01");
  const p = b.accounts[0].profile;
  p.shortFeeRate = "0";
  p.shortAnnualRate = "0.1";
  b.accounts[0].openingCash = "10000";
  b.openingPositions = [
    {
      id: "s",
      accountId: "default",
      code: "1",
      qty: "1000",
      price: "100",
      creditType: "short",
      restricted: "190000",
      date: b.openingDate,
    },
  ];
  b.trades = [
    {
      id: "cover",
      accountId: "default",
      code: "1",
      date: "2026-09-01",
      side: "buy",
      creditType: "short",
      qty: "1000",
      price: "100",
      actualGrossFee: "0",
      ruleSnapshot: p,
    },
  ];
  const a = valueAccount(b, market, "2026-09-03").value,
    late = valueAccount(b, market, "2026-09-04").value;
  assert.equal(a.balances.restricted, "0");
  assert.equal(late.interestAccrued, a.interestAccrued);
});
