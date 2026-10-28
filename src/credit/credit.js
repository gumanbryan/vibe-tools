import { dec, D, sum } from "../domain/money.js";
import { datesBetween } from "../domain/calendar.js";
import { ok, err } from "../domain/result.js";
export function accrueInterest(lot, fromDate, toDate, rule) {
  try {
    if (lot.annualRate === "" || lot.annualRate == null)
      return err("INTEREST_RATE_MISSING", "請設定融資年利率");
    const rate = dec(lot.annualRate);
    if (rate.lt(0)) throw Error("年利率不可為負");
    if (fromDate > toDate) return ok({ daily: [], total: "0" });
    const daily = datesBetween(fromDate, toDate).map((date) => {
      const repaid = sum(
        (lot.repayments ?? [])
          .filter((x) => (x.interestDate ?? x.date) <= date)
          .map((x) => x.principal),
      );
      const principal = dec(lot.principal).minus(repaid);
      if (principal.lt(0)) throw Error("償還本金超過原本金");
      const r =
        (lot.rateSegments ?? [])
          .filter((x) => x.effectiveFrom <= date)
          .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
          .at(-1)?.annualRate ?? rate;
      let amount = principal.mul(r).div(rule.interestBasis ?? 365);
      if (rule.interestRounding === "daily-floor") amount = amount.floor();
      return {
        date,
        principal: principal.toString(),
        amount: amount.toString(),
      };
    });
    let total = sum(daily.map((x) => x.amount));
    if (rule.interestRounding === "total-floor") total = total.floor();
    return ok({ daily, total: total.toString() });
  } catch (e) {
    return err("CREDIT_INVALID", e.message);
  }
}
export function shortOpeningBalances(gross, ratio) {
  const g = dec(gross),
    margin = g.mul(ratio);
  return {
    cash: margin.neg().toString(),
    restricted: g.plus(margin).toString(),
    shortLiability: g.toString(),
  };
}
export function estimateMaintenance(s, market, rule) {
  try {
    const denominator = dec(s.marginPrincipal ?? 0).plus(s.shortValue ?? 0);
    if (denominator.isZero())
      return ok({ ratio: null, status: "not-applicable", components: s });
    const numerator = dec(s.marginValue ?? 0)
      .plus(s.shortCollateral ?? 0)
      .plus(s.extraCollateral ?? 0);
    const ratio = numerator.div(denominator).mul(100);
    return ok({
      ratio: ratio.toString(),
      threshold: rule.maintenanceThreshold ?? "130",
      status: ratio.lt(rule.maintenanceThreshold ?? 130)
        ? "below-threshold"
        : "normal",
      components: {
        ...s,
        numerator: numerator.toString(),
        denominator: denominator.toString(),
      },
    });
  } catch (e) {
    return err("MAINTENANCE_INVALID", e.message);
  }
}
export function creditFees(profile, gross, days) {
  const missing = [];
  if (profile.shortFeeRate === "" || profile.shortFeeRate == null)
    missing.push("融券手續費");
  if (profile.shortAnnualRate === "" || profile.shortAnnualRate == null)
    missing.push("融券年費率");
  return {
    amount: dec(gross)
      .mul(profile.shortFeeRate || 0)
      .plus(
        dec(gross)
          .mul(profile.shortAnnualRate || 0)
          .mul(days)
          .div(365),
      )
      .toString(),
    missing,
  };
}
