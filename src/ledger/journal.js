import { dec, sum } from "../domain/money.js";
import { ok, err } from "../domain/result.js";
import { addBusinessDays } from "../domain/calendar.js";
export const line = (bucket, debit = "0", credit = "0", extra = {}) => ({
  bucket,
  debit: String(debit),
  credit: String(credit),
  ...extra,
});
export const signedLine = (bucket, amount) =>
  dec(amount).gte(0)
    ? line(bucket, amount)
    : line(bucket, "0", dec(amount).neg());
export function entry(id, date, accountId, lines, extra = {}) {
  return { id, date, accountId, sourceId: id, revision: 1, lines, ...extra };
}
export function validateEntry(e) {
  try {
    if (e.lines.some((x) => dec(x.debit).lt(0) || dec(x.credit).lt(0)))
      throw Error("分錄金額不可為負");
    if (!sum(e.lines.map((x) => x.debit)).eq(sum(e.lines.map((x) => x.credit))))
      throw Error("分錄借貸不平衡");
    return ok(e);
  } catch (e) {
    return err("JOURNAL_UNBALANCED", e.message);
  }
}
export function postTrade(t, allocations, fee, tax, calendar) {
  try {
    const due = addBusinessDays(t.date, 2, calendar);
    if (!due.ok) return due;
    const gross = dec(t.qty).mul(t.price),
      cost = dec(fee.grossFee).plus(tax),
      rebate = dec(fee.rebate ?? 0);
    const lines = [];
    if (t.side === "buy") {
      lines.push(
        line(t.creditType === "short" ? "shortDebt" : "inventory", gross),
        line("payable", "0", gross.plus(cost)),
      );
    } else {
      lines.push(
        signedLine("receivable", gross.minus(cost)),
        line(t.creditType === "short" ? "shortDebt" : "inventory", "0", gross),
      );
    }
    if (cost.gt(0)) lines.push(line("expense", cost));
    if (rebate.gt(0))
      lines.push(
        line("rebateReceivable", rebate),
        line("rebateIncome", "0", rebate),
      );
    const e = entry(t.id + ":trade", t.date, t.accountId, lines, {
      tradeId: t.id,
      dueDate: due.value,
      gross: gross.toString(),
      cost: cost.toString(),
      creditType: t.creditType,
    });
    const v = validateEntry(e);
    return v.ok ? ok([e]) : v;
  } catch (e) {
    return err("TRADE_POST_INVALID", e.message);
  }
}
export function settleTrade(t, posted, date) {
  try {
    const p = posted.find((x) => x.tradeId === t.id);
    if (!p || date < p.dueDate) return ok([]);
    const g = dec(p.gross),
      cost = dec(p.cost),
      lines = [];
    if (t.side === "buy") {
      lines.push(line("payable", g.plus(cost)));
      if (t.creditType === "margin") {
        const loan = g.mul(t.ruleSnapshot.marginRatio);
        lines.push(
          line("marginDebt", "0", loan),
          line("cash", "0", g.plus(cost).minus(loan)),
        );
      } else if (t.creditType === "short") {
        const released = dec(t.collateralReleased ?? 0);
        if (released.gt(0))
          lines.push(line("cash", released), line("restricted", "0", released));
        lines.push(line("cash", "0", g.plus(cost)));
      } else lines.push(line("cash", "0", g.plus(cost)));
    } else {
      lines.push(line("receivable", "0", g.minus(cost)));
      if (t.creditType === "short") {
        const margin = g.mul(t.ruleSnapshot.shortMarginRatio ?? "0.9");
        lines.push(
          line("restricted", g.minus(cost).plus(margin)),
          line("cash", "0", margin),
        );
      } else if (t.creditType === "margin") {
        const principal = dec(t.principalRepaid ?? 0);
        lines.push(
          line("marginDebt", principal),
          signedLine("cash", g.minus(cost).minus(principal)),
        );
      } else lines.push(signedLine("cash", g.minus(cost)));
    }
    const e = entry(t.id + ":settlement", p.dueDate, t.accountId, lines);
    const v = validateEntry(e);
    return v.ok ? ok([e]) : v;
  } catch (e) {
    return err("SETTLEMENT_INVALID", e.message);
  }
}
export function replayEntries(entries, date) {
  try {
    const seen = new Set(),
      balances = {};
    for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
      if (e.date > date || seen.has(e.id)) continue;
      const v = validateEntry(e);
      if (!v.ok) return v;
      seen.add(e.id);
      for (const x of e.lines)
        balances[x.bucket] = dec(balances[x.bucket] ?? 0)
          .plus(x.debit)
          .minus(x.credit)
          .toString();
    }
    return ok({ balances });
  } catch (e) {
    return err("REPLAY_INVALID", e.message);
  }
}
