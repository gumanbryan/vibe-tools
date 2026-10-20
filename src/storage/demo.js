import { createBook } from "./book.js";
export function createDemo(market) {
  const date =
      market.calendar.businessDates.find((d) => d >= "2026-09-01") ??
      "2026-09-01",
    b = createBook("demo", date);
  b.accounts[0].name = "模擬投資帳戶";
  b.accounts[0].openingCash = "350000";
  b.accounts[0].profile = {
    ...b.accounts[0].profile,
    discountTenths: "2.8",
    annualRate: "0.06",
    shortFeeRate: "0.0008",
    shortAnnualRate: "0.02",
  };
  for (const [code, qty, creditType] of [
    ["2330", "100", "cash"],
    ["2313", "1000", "cash"],
    ["6213", "1000", "cash"],
    ["1326", "1000", "margin"],
  ]) {
    const price = market.bars.find(
      (x) => x.code === code && x.date === date,
    )?.close;
    if (!price) continue;
    b.openingPositions.push({
      id: "demo-" + code,
      accountId: "default",
      code,
      qty,
      price,
      creditType,
      date,
      annualRate: "0.06",
      principal:
        creditType === "margin"
          ? String(Number(price) * Number(qty) * 0.6)
          : "0",
    });
  }
  b.demo = true;
  return b;
}
