import { ok, err } from "../domain/result.js";
import { valueAccount } from "../performance/portfolio.js";
import { recordAudit } from "./book.js";
export function prepareRebuild(book, changes, market) {
  try {
    const draft = structuredClone(book);
    if (changes.openingDate && changes.openingDate > book.openingDate)
      throw Error("歷史補登起點不能晚於原啟用日");
    if (changes.openingDate) draft.openingDate = changes.openingDate;
    if (changes.openingCash != null)
      draft.accounts.find(
        (a) => a.id === (changes.accountId ?? draft.accounts[0].id),
      ).openingCash = changes.openingCash;
    if (changes.openingPositions)
      draft.openingPositions = structuredClone(changes.openingPositions);
    if (changes.trades) draft.trades = structuredClone(changes.trades);
    if (changes.cashFlows) draft.cashFlows = structuredClone(changes.cashFlows);
    const old = valueAccount(book, market, book.openingDate),
      next = valueAccount(draft, market, book.openingDate);
    if (!next.ok) return next;
    const keys = [
      "cash",
      "marginDebt",
      "receivable",
      "payable",
      "restricted",
      "dividendReceivable",
      "rebateReceivable",
    ];
    const diff = keys.map((key) => ({
      key,
      before: old.value?.balances[key] ?? "0",
      after: next.value.balances[key] ?? "0",
    }));
    const positionsMatch =
      JSON.stringify(
        old.value?.positions.map((p) => [p.code, p.qty, p.creditType]),
      ) ===
      JSON.stringify(
        next.value.positions.map((p) => [p.code, p.qty, p.creditType]),
      );
    return ok({
      draft,
      expectedRevision: book.revision,
      diff,
      anchorChecks: {
        cash: { matches: diff[0].before === diff[0].after },
        positions: { matches: positionsMatch },
        liabilities: {
          matches: diff
            .filter((x) => x.key === "marginDebt")
            .every((x) => x.before === x.after),
        },
      },
      quality:
        changes.openingDate < "2026-09-01"
          ? "insufficient"
          : next.value.quality,
    });
  } catch (e) {
    return err("REBUILD_INVALID", e.message);
  }
}
export async function commitRebuild(store, proposal, expectedRevision) {
  const draft = structuredClone(proposal.draft);
  recordAudit(draft, "歷史重算", JSON.stringify(proposal.diff));
  return store.save(draft, expectedRevision ?? proposal.expectedRevision);
}
