import { D, dec, sum } from "../domain/money.js";
import { ok, err } from "../domain/result.js";
export function allocateClose(trades, close, manual = [], existing = []) {
  try {
    let need = dec(close.qty);
    if (need.lte(0)) throw Error("股數須大於零");
    const candidates = trades
      .filter(
        (t) =>
          t.id !== close.id &&
          t.accountId === close.accountId &&
          t.code === close.code &&
          t.creditType === close.creditType &&
          t.side !== close.side &&
          t.date <= close.date,
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.sequence ?? 0) - (b.sequence ?? 0) ||
          a.id.localeCompare(b.id),
      );
    const available = (t) =>
      dec(t.qty).minus(
        sum(existing.filter((a) => a.openTradeId === t.id).map((a) => a.qty)),
      );
    const selected = manual.length
      ? manual
      : candidates.map((t) => ({
          openTradeId: t.id,
          qty: D.max(available(t), 0).toString(),
        }));
    const out = [],
      used = new Map();
    for (const s of selected) {
      if (need.isZero()) break;
      const t = candidates.find((t) => t.id === s.openTradeId);
      if (!t) throw Error("找不到同帳戶對應批次");
      const avail = available(t).minus(used.get(t.id) ?? 0);
      let q = dec(s.qty);
      if (!manual.length) q = D.min(q, need);
      if (q.lt(0) || q.gt(avail) || q.gt(need))
        throw Error("沖銷股數超過可用批次");
      if (q.isZero()) continue;
      out.push({
        id: `${close.id}:${t.id}`,
        openTradeId: t.id,
        closeTradeId: close.id,
        kind:
          close.creditType === "short"
            ? "short-cover"
            : close.creditType === "margin"
              ? "margin-close"
              : "cash-close",
        qty: q.toString(),
      });
      used.set(t.id, dec(used.get(t.id) ?? 0).plus(q));
      need = need.minus(q);
    }
    if (!need.isZero()) throw Error("可沖銷股數不足");
    return ok(out);
  } catch (e) {
    return err("ALLOCATION_INVALID", e.message);
  }
}
export function validateDayTrade(trades, allocations, securities = []) {
  try {
    const used = new Map();
    for (const a of allocations) {
      const x = trades.find((t) => t.id === a.openTradeId),
        y = trades.find((t) => t.id === a.closeTradeId);
      if (
        !x ||
        !y ||
        x.date !== y.date ||
        x.accountId !== y.accountId ||
        x.code !== y.code ||
        x.side === y.side
      )
        throw Error("當沖必須同帳戶、同日、同商品且方向相反");
      if (x.marketType === "odd" || y.marketType === "odd")
        throw Error("零股不支援此當沖組合");
      const q = dec(a.qty);
      if (q.lte(0)) throw Error("沖銷股數錯誤");
      for (const t of [x, y]) {
        used.set(t.id, dec(used.get(t.id) ?? 0).plus(q));
        if (used.get(t.id).gt(t.qty)) throw Error("重複或超額沖銷");
      }
      if (
        a.kind === "credit-day" &&
        !(
          [x, y].some((t) => t.creditType === "margin" && t.side === "buy") &&
          [x, y].some((t) => t.creditType === "short" && t.side === "sell")
        )
      )
        throw Error("資券互抵需融資與融券兩側");
    }
    return ok(allocations);
  } catch (e) {
    return err("DAY_TRADE_INVALID", e.message);
  }
}
