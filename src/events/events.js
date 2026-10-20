import { dec } from "../domain/money.js";
import { ok, err } from "../domain/result.js";
import { entry, line } from "../ledger/journal.js";
export function mergeAnnouncements(existing, incoming) {
  const changed = [],
    added = [];
  for (const e of incoming) {
    const old = existing.find((x) => x.id === e.id);
    if (!old) added.push(e);
    else if (old.version !== e.version) changed.push({ old, new: e });
  }
  return ok({ events: [...existing, ...added], changed });
}
export function confirmEntitlement(p, overrides) {
  try {
    const c = { ...p, ...overrides, confirmed: true };
    if (dec(c.qty).lt(0)) throw Error("資格股數不可為負");
    if (c.kind === "cash-dividend")
      c.amount = dec(c.qty).mul(c.perShare).toString();
    else if (c.kind === "stock-dividend")
      c.pendingQty = dec(c.qty).mul(c.ratio).toString();
    return ok(c);
  } catch (e) {
    return err("ENTITLEMENT_INVALID", e.message);
  }
}
export function receiptsOf(c) {
  return (
    c.receipts ??
    (c.receivedDate && c.kind === "cash-dividend"
      ? [
          {
            id: "received",
            date: c.receivedDate,
            actualAmount: c.actualAmount ?? c.amount,
            entitlement: c.receiptEntitlement ?? c.amount,
          },
        ]
      : [])
  );
}
export function postCorporateEvent(c, date) {
  try {
    if (!c.confirmed || date < c.exDate) return ok([]);
    const out = [];
    if (c.kind === "cash-dividend") {
      out.push(
        entry(c.id + ":entitlement", c.exDate, c.accountId, [
          line("dividendReceivable", c.amount),
          line("dividendIncome", "0", c.amount),
        ]),
      );
      for (const receipt of receiptsOf(c).filter((r) => r.date <= date)) {
        const entitlement = dec(receipt.entitlement),
          actual = dec(receipt.actualAmount),
          diff = entitlement.minus(actual);
        out.push(
          entry(c.id + ":payment:" + receipt.id, receipt.date, c.accountId, [
            line("cash", actual),
            line("dividendReceivable", "0", entitlement),
            ...(diff.gte(0)
              ? [line("expense", diff)]
              : [line("dividendIncome", "0", diff.neg())]),
          ]),
        );
      }
    }
    return ok(out);
  } catch (e) {
    return err("CORPORATE_EVENT_INVALID", e.message);
  }
}
export function listReminders(book, market, today) {
  const out = [];
  const windowStart = new Date(today + "T00:00:00Z");
  windowStart.setUTCDate(windowStart.getUTCDate() - 7);
  const windowEnd = new Date(today + "T00:00:00Z");
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 60);
  for (const e of market.events ?? [])
    for (const account of book.accounts) {
      if (
        ![...book.trades, ...book.openingPositions].some(
          (t) => t.accountId === account.id && t.code === e.code,
        )
      )
        continue;
      const financial = ["cash-dividend", "stock-dividend"].includes(e.kind);
      if (
        !financial &&
        e.date &&
        (e.date < windowStart.toISOString().slice(0, 10) ||
          e.date > windowEnd.toISOString().slice(0, 10))
      )
        continue;
      const c = book.confirmations.find(
        (c) =>
          c.accountId === account.id &&
          c.eventId === e.id &&
          c.kind === e.kind &&
          c.confirmed,
      );
      const revised = !!c && !!e.version && c.eventVersion !== e.version;
      out.push({
        ...e,
        id: e.id + ":" + account.id,
        eventId: e.id,
        accountId: account.id,
        confirmationId: c?.id,
        type: financial ? "accounting" : "information",
        needsAction: financial && (!c || revised),
        action: revised ? "revise-event" : "confirm-event",
        revised,
        previous: c,
      });
    }
  for (const c of book.confirmations) {
    if (!c.confirmed) continue;
    const paid = receiptsOf(c).reduce(
      (n, r) => dec(n).plus(r.entitlement).toString(),
      "0",
    );
    const outstanding =
      c.kind === "cash-dividend" ? dec(c.amount).minus(paid) : null;
    if (
      (c.kind === "cash-dividend" && outstanding.gt(0)) ||
      (c.kind === "stock-dividend" && !c.receivedDate)
    ) {
      out.push({
        id: c.id + ":payment",
        confirmationId: c.id,
        eventId: c.eventId,
        accountId: c.accountId,
        action: "receive-dividend",
        title:
          c.kind === "stock-dividend" ? "股票股利待確認交付" : "股利待核對入帳",
        date: c.paymentDate ?? null,
        code: c.code,
        needsAction: true,
        type: "accounting",
        outstanding: outstanding?.toString(),
      });
    }
  }
  return out.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}
