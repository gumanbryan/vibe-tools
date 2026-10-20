import { receiptsOf } from "../../events/events.js";
import { dec, sum } from "../../domain/money.js";
import {
  E,
  badge,
  button,
  table,
  card,
  note,
  safeLink,
  num,
} from "../helpers.js";
export function eventsPage(v) {
  return `<div class="section-actions"><p class="muted">持股公告與帳務確認分開；公告未取得不等於沒有事件。</p>${button("manual-event", "手動補登事件")}</div>${card(
    "近期持股事件",
    table(
      ["日期", "帳戶", "商品", "事件", "來源", "操作"],
      v.reminders.map((e) => [
        E(e.date ?? "待公告"),
        E(v.book.accounts.find((a) => a.id === e.accountId)?.name ?? ""),
        E(e.code + " " + v.securityName(e.code)),
        E(e.title),
        safeLink(e.sourceUrl),
        e.needsAction
          ? button(
              e.action ?? "confirm-event",
              e.action === "receive-dividend"
                ? "核對實收"
                : e.revised
                  ? "核對修訂"
                  : "確認權益",
              "ghost",
              `data-id="${E(e.action === "receive-dividend" ? e.confirmationId : e.id)}"`,
            )
          : badge("資訊提醒"),
      ]),
    ),
  )}
 ${card(
   "已確認的股利",
   table(
     ["除權息日", "帳戶", "商品", "類型", "資格股數", "應收／配股", "入帳狀態"],
     v.book.confirmations.map((c) => [
       E(c.exDate),
       E(v.book.accounts.find((a) => a.id === c.accountId)?.name ?? ""),
       E(c.code),
       c.kind === "stock-dividend" ? "股票股利" : "現金股利",
       num(c.qty),
       c.kind === "stock-dividend"
         ? num(c.pendingQty) + " 股"
         : num(c.amount, 2) + " 元",
       (
         c.kind === "stock-dividend"
           ? !!c.receivedDate
           : dec(c.amount).lte(sum(receiptsOf(c).map((r) => r.entitlement)))
       )
         ? badge("已入帳", "mint")
         : button(
             "receive-dividend",
             c.kind === "stock-dividend" ? "確認交付" : "核對實收",
             "ghost",
             `data-id="${E(c.id)}"`,
           ),
     ]),
   ),
 )}${note("確認未來事件不會提前增加今天資產；已生效事件尚未確認時，相關淨值會標示暫估。融券權益補償請按券商資料另作費用校正。")}`;
}
