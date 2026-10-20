import test from "node:test";
import assert from "node:assert/strict";
import {
  accrueInterest,
  estimateMaintenance,
  shortOpeningBalances,
} from "../../src/credit/credit.js";
test("ACT365 includes weekends with partial repayment and opening accrual excluded", () => {
  const lot = { principal: "60000", annualRate: "0.06", repayments: [] };
  const r = accrueInterest(lot, "2026-09-01", "2026-09-10", {
    interestBasis: 365,
  }).value;
  assert.equal(r.daily.length, 10);
  assert.ok(Math.abs(Number(r.total) - (60000 * 0.06 * 10) / 365) < 1e-9);
  lot.repayments = [{ date: "2026-09-06", principal: "30000" }];
  assert.ok(
    Number(
      accrueInterest(lot, "2026-09-01", "2026-09-10", { interestBasis: 365 })
        .value.total,
    ) < Number(r.total),
  );
  assert.equal(
    accrueInterest({ ...lot, annualRate: "" }, "2026-09-01", "2026-09-10", {})
      .ok,
    false,
  );
});
test("short cash is restricted and short liability reflects market", () => {
  const b = shortOpeningBalances("100000", "0.9");
  assert.deepEqual(b, {
    cash: "-90000",
    restricted: "190000",
    shortLiability: "100000",
  });
  assert.equal(100000 + Number(b.cash) + Number(b.restricted) - 110000, 90000);
});
test("maintenance has components and a zero denominator is not applicable", () => {
  assert.equal(
    estimateMaintenance(
      {
        marginValue: "100000",
        marginPrincipal: "60000",
        shortValue: "0",
        shortCollateral: "0",
        extraCollateral: "0",
      },
      null,
      { maintenanceThreshold: "130" },
    ).value.ratio,
    "166.6666666666666666666666666666666666667",
  );
  assert.equal(
    estimateMaintenance(
      {
        marginValue: "0",
        marginPrincipal: "0",
        shortValue: "0",
        shortCollateral: "0",
      },
      null,
      {},
    ).value.status,
    "not-applicable",
  );
});
