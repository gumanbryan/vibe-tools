import { dec } from "../domain/money.js";
import { ok, err } from "../domain/result.js";
import { entry, line } from "./journal.js";
export function groupRebates(trades) {
  const map = new Map();
  for (const t of trades) {
    const month = t.date.slice(0, 7),
      id = t.accountId + ":" + month;
    const [y, m] = month.split("-").map(Number);
    const expectedDate = new Date(Date.UTC(y, m, 15))
      .toISOString()
      .slice(0, 10);
    const b = map.get(id) ?? {
      id,
      accountId: t.accountId,
      month,
      expectedDate,
      amount: "0",
      tradeIds: [],
    };
    b.amount = dec(b.amount)
      .plus(t.rebate ?? 0)
      .toString();
    b.tradeIds.push(t.id);
    map.set(id, b);
  }
  return ok([...map.values()].sort((a, b) => a.month.localeCompare(b.month)));
}
export function confirmRebate(bucket, actualAmount, receivedDate) {
  try {
    if (bucket.received) return err("REBATE_DUPLICATE", "此月份已確認入帳");
    const actual = dec(actualAmount);
    if (actual.lt(0)) throw Error("實收不可為負");
    const diff = actual.minus(bucket.amount),
      lines = [
        line("cash", actual),
        line("rebateReceivable", "0", bucket.amount),
        ...(diff.gte(0)
          ? [line("rebateIncome", "0", diff)]
          : [line("expense", diff.neg())]),
      ];
    return ok({
      id: bucket.id,
      accountId: bucket.accountId,
      receivedDate,
      amount: actual.toString(),
      adjustment: diff.toString(),
      entries: [
        entry(
          bucket.id + ":rebate-payment",
          receivedDate,
          bucket.accountId,
          lines,
        ),
      ],
    });
  } catch (e) {
    return err("REBATE_INVALID", e.message);
  }
}
