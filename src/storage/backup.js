import { ok, err } from "../domain/result.js";
async function digest(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function exportBackup(book) {
  return JSON.stringify(
    {
      format: "stock-daily-backup",
      exportedAt: new Date().toISOString(),
      checksum: await digest(JSON.stringify(book)),
      book,
    },
    null,
    2,
  );
}
export async function inspectBackup(text) {
  try {
    const x = JSON.parse(text);
    if (x.format !== "stock-daily-backup" || x.book?.schemaVersion !== 1)
      throw Error("不支援的備份版本");
    if ((await digest(JSON.stringify(x.book))) !== x.checksum)
      throw Error("備份檢查碼不符");
    const b = x.book;
    if (!Array.isArray(b.accounts) || !b.accounts.length)
      throw Error("帳戶資料缺漏");
    for (const key of [
      "accounts",
      "trades",
      "cashFlows",
      "confirmations",
      "entries",
    ]) {
      if (!Array.isArray(b[key])) throw Error("缺少 " + key);
      const ids = b[key].map((v) => v.id);
      if (new Set(ids).size !== ids.length) throw Error("重複紀錄ID");
    }
    const accounts = new Set(b.accounts.map((a) => a.id));
    if (b.trades.some((t) => !accounts.has(t.accountId)))
      throw Error("交易引用未知帳戶");
    if (
      b.allocations.some(
        (a) =>
          !b.trades.some((t) => t.id === a.closeTradeId) ||
          (!b.trades.some((t) => t.id === a.openTradeId) &&
            !b.openingPositions.some((t) => t.id === a.openTradeId)),
      )
    )
      throw Error("沖銷引用不完整");
    return ok(b);
  } catch (e) {
    return err("BACKUP_INVALID", e.message);
  }
}
export function backupDue(book, today) {
  return (
    !book.lastBackupAt ||
    Date.parse(today) - Date.parse(book.lastBackupAt) >= 7 * 86400000 ||
    (book.eventsSinceBackup ?? 0) >= 20
  );
}
