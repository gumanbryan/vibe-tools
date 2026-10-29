import { D, dec, sum } from "../domain/money.js";
import { ok, err } from "../domain/result.js";
export const DEFAULT_PROFILE = {
  id: "account-default-v1",
  feeRate: "0.001425",
  minRegular: "20",
  minOdd: "1",
  discountTenths: "10",
  marginRatio: "0.6",
  annualRate: "0.0645",
  shortMarginRatio: "0.9",
  shortFeeRate: "",
  shortAnnualRate: "",
  interestBasis: 365,
  interestRounding: "retained",
  maintenanceThreshold: "130",
  status: "estimated",
  sourceRefs: [],
};
export function snapshotRule(p, date) {
  return ok({ ...structuredClone(p), snapshotDate: date });
}
export function calculateFee({
  gross,
  marketType = "regular",
  profile = DEFAULT_PROFILE,
  actualGrossFee,
}) {
  try {
    const g = dec(gross),
      f = dec(profile.feeRate),
      d = dec(profile.discountTenths);
    if (g.lt(0) || f.lt(0) || d.lt(0) || d.gt(10))
      throw Error("費率、折扣或成交金額超出範圍");
    let raw =
      actualGrossFee != null && actualGrossFee !== ""
        ? dec(actualGrossFee)
        : D.max(
            g.mul(f).floor(),
            marketType === "odd" ? profile.minOdd : profile.minRegular,
          );
    if (raw.lt(0)) throw Error("手續費不可為負");
    const net = raw.mul(d).div(10);
    return ok({
      grossFee: raw.toString(),
      netFee: net.toString(),
      rebate: raw.minus(net).toString(),
    });
  } catch (e) {
    return err("FEE_INVALID", e.message);
  }
}
export function calculateFeeGroup(executions, profile, marketType) {
  return calculateFee({
    gross: sum(executions.map((x) => x.gross)).toString(),
    profile,
    marketType,
  });
}
export function calculateTax({ gross, security, date, allocation, profile }) {
  try {
    const g = dec(gross);
    if (
      security.productType === "bond-etf" &&
      security.bondTaxExempt === undefined
    )
      return err("BOND_TAX_UNVERIFIED", "請先確認此債券ETF的免稅資格");
    if (g.lt(0)) throw Error("稅基不可為負");
    let rate, id;
    if (security.productType === "stock") {
      rate = dec("0.003");
      id = "stock-regular";
      if (allocation?.kind === "cash-day") {
        if (date > "2027-12-31")
          return err("TAX_UNVERIFIED", "當沖優惠到期，請核對新稅則");
        const ratio = dec(allocation.ratio ?? 1);
        if (ratio.lt(0) || ratio.gt(1)) throw Error("沖銷比例錯誤");
        rate = rate.mul(dec(1).minus(ratio)).plus(dec("0.0015").mul(ratio));
        id = "stock-cash-day";
      }
    } else if (security.productType === "bond-etf" && security.bondTaxExempt) {
      if (date > "2026-12-31")
        return err("TAX_UNVERIFIED", "債券ETF免稅期限已過，請核對新稅則");
      rate = dec(0);
      id = "qualified-bond-etf-exempt";
    } else if (["etf", "bond-etf"].includes(security.productType)) {
      rate = dec("0.001");
      id = "etf";
    } else return err("TAX_PRODUCT_UNKNOWN", "請先確認商品類型");
    return ok({ tax: g.mul(rate).floor().toString(), rawTax: g.mul(rate).toString(), ruleId: id });
  } catch (e) {
    return err("TAX_INVALID", e.message);
  }
}
