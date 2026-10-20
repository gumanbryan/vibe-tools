import test from "node:test";
import assert from "node:assert/strict";
import { createBook } from "../../src/storage/book.js";
import { DEFAULT_PROFILE } from "../../src/ledger/fees.js";
import {
  valueAccount,
  prepareTrades,
  applyCloseFlow,
} from "../../src/performance/portfolio.js";
import { listReminders } from "../../src/events/events.js";
const dates = [
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-07",
  "2026-09-08",
];
const m = {
  bars: dates.map((date) => ({
    code: "1",
    date,
    close: "100",
    quality: "valid",
  })),
  securities: [{ code: "1", productType: "stock" }],
  calendar: { businessDates: dates },
  events: [],
};
const profile = {
  ...DEFAULT_PROFILE,
  annualRate: "0.06",
  shortFeeRate: "0",
  shortAnnualRate: "0",
};
function book() {
  const b = createBook("personal", dates[0]);
  b.accounts[0].profile = structuredClone(profile);
  b.accounts[0].openingCash = "100000";
  return b;
}
const trade = (id, date, side, creditType, extra = {}) => ({
  id,
  accountId: "default",
  code: "1",
  date,
  side,
  creditType,
  qty: "1000",
  price: "100",
  marketType: "regular",
  ruleSnapshot: structuredClone(profile),
  ...extra,
});
test("R1 negative equity without withdrawal preserves accounting and suspends percentage performance", () => {
  const r = applyCloseFlow({
    equityBeforeFlow: "-1",
    previousUnits: "10",
    flow: "0",
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.equity, "-1");
  assert.equal(r.value.unitNav, null);
});
test("R2 overnight manual cash-close receives ordinary stock tax", () => {
  const b = book();
  b.trades = [
    trade("buy", dates[0], "buy", "cash"),
    trade("sell", dates[1], "sell", "cash"),
  ];
  b.allocations = [
    {
      id: "a",
      openTradeId: "buy",
      closeTradeId: "sell",
      kind: "cash-close",
      qty: "1000",
    },
  ];
  assert.equal(
    prepareTrades(b, dates[1]).details.find((t) => t.id === "sell").tax,
    "300",
  );
});
test("R3 full short cover releases actual net collateral not gross sale proceeds", () => {
  const b = book();
  b.trades = [
    trade("short", dates[0], "sell", "short", { actualGrossFee: "142" }),
    trade("cover", dates[1], "buy", "short", { actualGrossFee: "0" }),
  ];
  const s = valueAccount(b, m, dates[3]).value;
  assert.equal(s.balances.restricted, "0");
  assert.equal(s.balances.cash, "99558");
});
test("R4 maintenance uses settlement quantities until credit repayment", () => {
  const b = book();
  b.openingPositions = [
    {
      id: "p",
      accountId: "default",
      code: "1",
      date: dates[0],
      qty: "1000",
      price: "100",
      creditType: "margin",
      principal: "60000",
      annualRate: "0.06",
      ruleSnapshot: profile,
    },
  ];
  b.trades = [
    trade("sell", dates[1], "sell", "margin", { actualGrossFee: "0" }),
  ];
  const s = valueAccount(b, m, dates[1], "default").value;
  assert.ok(Number(s.maintenance.ratio) > 160);
  const c = book();
  c.openingPositions = [
    {
      id: "q",
      accountId: "default",
      code: "1",
      date: dates[0],
      qty: "1000",
      price: "100",
      creditType: "short",
      restricted: "190000",
      ruleSnapshot: profile,
    },
  ];
  c.trades = [
    trade("cover", dates[1], "buy", "short", { actualGrossFee: "0" }),
  ];
  assert.equal(
    valueAccount(c, m, dates[1], "default").value.maintenance.ratio,
    "190",
  );
});
test("R6 payment reminder references original confirmation and receipt action", () => {
  const b = book();
  b.confirmations = [
    {
      id: "c",
      accountId: "default",
      eventId: "e",
      eventVersion: "1",
      code: "1",
      kind: "cash-dividend",
      confirmed: true,
      exDate: dates[0],
      qty: "1000",
      amount: "2000",
    },
  ];
  const r = listReminders(b, m, dates[2]).find((r) => r.id === "c:payment");
  assert.equal(r.action, "receive-dividend");
  assert.equal(r.confirmationId, "c");
});
test("R7 and R8 revised and unconfirmed events remain actionable per account", () => {
  const b = book();
  b.accounts.push({ ...structuredClone(b.accounts[0]), id: "other" });
  b.openingPositions = b.accounts.map((a) => ({
    id: a.id,
    accountId: a.id,
    code: "1",
    qty: "1000",
    price: "100",
    date: dates[0],
    creditType: "cash",
  }));
  b.confirmations = [
    {
      id: "c",
      accountId: "default",
      eventId: "e",
      eventVersion: "1",
      code: "1",
      kind: "cash-dividend",
      confirmed: true,
      exDate: dates[0],
      qty: "1000",
      amount: "2000",
    },
  ];
  const r = listReminders(
    b,
    {
      ...m,
      events: [
        {
          id: "e",
          code: "1",
          kind: "cash-dividend",
          version: "2",
          perShare: "3",
          exDate: dates[0],
        },
      ],
    },
    dates[2],
  );
  assert.ok(
    r.some(
      (x) =>
        x.accountId === "default" &&
        x.action === "revise-event" &&
        x.needsAction,
    ),
  );
  assert.ok(
    r.some(
      (x) =>
        x.accountId === "other" &&
        x.action === "confirm-event" &&
        x.needsAction,
    ),
  );
});
test("R9 explicit first sell of cash day trade can be saved before its buy", () => {
  const b = book();
  b.trades = [
    trade("first", dates[0], "sell", "cash", { dayType: "cash-first" }),
  ];
  const r = valueAccount(b, m, dates[0]);
  assert.equal(r.ok, true);
  assert.ok(r.value.warnings.some((x) => x.includes("未完成")));
});
test("R10 changing account basis does not rewrite frozen financing history", () => {
  const b = book();
  b.trades = [trade("buy", dates[0], "buy", "margin", { actualGrossFee: "0" })];
  const a = valueAccount(b, m, dates[3]).value.interestAccrued;
  b.accounts[0].profile.interestBasis = 360;
  const c = valueAccount(b, m, dates[3]).value.interestAccrued;
  assert.equal(a, c);
});
test("discounted tax rejects an imported cross-date day-trade allocation", () => {
  const b = book();
  b.trades = [
    trade("buy", dates[0], "buy", "cash"),
    trade("sell", dates[1], "sell", "cash"),
  ];
  b.allocations = [
    {
      id: "bad",
      openTradeId: "buy",
      closeTradeId: "sell",
      kind: "cash-day",
      qty: "1000",
    },
  ];
  assert.throws(() => prepareTrades(b, dates[1]));
});
