import { DEFAULT_PROFILE } from "../ledger/fees.js";
export const newId = () => crypto.randomUUID();
export function createBook(namespace = "personal", date) {
  return {
    id: newId(),
    namespace,
    schemaVersion: 1,
    revision: 0,
    openingDate: date,
    accounts: [
      {
        id: "default",
        name: "主要證券帳戶",
        openingCash: "0",
        profile: structuredClone(DEFAULT_PROFILE),
      },
    ],
    openingPositions: [],
    openingBalances: [],
    trades: [],
    allocations: [],
    entries: [],
    creditLots: [],
    confirmations: [],
    cashFlows: [],
    rebateReceipts: [],
    feeAdjustments: [],
    collateralEvents: [],
    rules: [],
    themes: [],
    audit: [],
    eventsSinceBackup: 0,
  };
}
export function recordAudit(book, kind, details) {
  book.audit.push({ id: newId(), at: new Date().toISOString(), kind, details });
  book.eventsSinceBackup++;
}
