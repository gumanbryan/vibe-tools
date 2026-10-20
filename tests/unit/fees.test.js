import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFee,
  calculateTax,
  snapshotRule,
  DEFAULT_PROFILE,
  calculateFeeGroup,
} from "../../src/ledger/fees.js";
test("minimum before discount and precision retained", () => {
  const p = { ...DEFAULT_PROFILE, discountTenths: "2.8" };
  assert.deepEqual(
    calculateFee({ gross: "10000", marketType: "regular", profile: p }).value,
    { grossFee: "20", netFee: "5.6", rebate: "14.4" },
  );
  assert.equal(
    calculateFee({ gross: "100", marketType: "odd", profile: p }).value
      .grossFee,
    "1",
  );
  assert.equal(
    calculateFee({ gross: "100344", marketType: "regular", profile: p }).value
      .grossFee,
    "142",
  );
  assert.equal(calculateFee({ gross: "-1", profile: p }).ok, false);
  assert.equal(
    calculateFee({ gross: "1", profile: { ...p, discountTenths: "11" } }).ok,
    false,
  );
});
test("grouped executions incur minimum once", () =>
  assert.equal(
    calculateFeeGroup(
      [{ gross: "5000" }, { gross: "5000" }],
      DEFAULT_PROFILE,
      "regular",
    ).value.grossFee,
    "20",
  ));
test("tax depends on actual product type, qualified quantity and dates", () => {
  const base = {
    gross: "100000",
    date: "2026-10-19",
    profile: DEFAULT_PROFILE,
  };
  assert.equal(
    calculateTax({ ...base, security: { productType: "stock" } }).value.tax,
    "300",
  );
  assert.equal(
    calculateTax({
      ...base,
      security: { productType: "stock" },
      allocation: { kind: "cash-day", ratio: "1" },
    }).value.tax,
    "150",
  );
  assert.equal(
    calculateTax({
      ...base,
      security: { productType: "stock" },
      allocation: { kind: "credit-day", ratio: "1" },
    }).value.tax,
    "300",
  );
  assert.equal(
    calculateTax({
      ...base,
      security: { productType: "etf" },
      allocation: { kind: "cash-day", ratio: "1" },
    }).value.tax,
    "100",
  );
  assert.equal(
    calculateTax({
      ...base,
      security: { productType: "stock" },
      allocation: { kind: "cash-day", ratio: "0.5" },
    }).value.tax,
    "225",
  );
  assert.equal(
    calculateTax({
      ...base,
      security: { productType: "bond-etf", bondTaxExempt: true },
    }).value.tax,
    "0",
  );
  assert.equal(
    calculateTax({
      ...base,
      date: "2027-01-01",
      security: { productType: "bond-etf", bondTaxExempt: true },
    }).ok,
    false,
  );
});
test("fee snapshots survive default edits", () => {
  const p = { ...DEFAULT_PROFILE };
  const r = snapshotRule(p, "2026-10-19").value;
  p.minRegular = "99";
  assert.equal(r.minRegular, "20");
});
test("unknown bond ETF tax eligibility cannot silently assume a rate", () => {
  assert.equal(
    calculateTax({
      gross: "100000",
      date: "2026-10-19",
      security: { productType: "bond-etf" },
    }).ok,
    false,
  );
});
