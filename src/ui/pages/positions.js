import {
  E,
  num,
  signed,
  color,
  badge,
  button,
  table,
  card,
  note,
} from "../helpers.js";
const credit = { cash: "現股", margin: "融資", short: "融券" };
export function positions(v) {
  const rows = v.latest?.positions ?? [];
  return `<div class="section-actions"><p class="muted">依成交日更新部位，交割款另行追蹤。</p><div>${button("opening-assets", "設定起始資產")}${button("opening-position", "新增起始部位")}${button("trade", "新增交易", "primary")}</div></div>${card(
    "目前持倉",
    table(
      [
        "股票／批次",
        "類型",
        "持有股數",
        "成本價",
        "估值價格",
        "市值",
        "扣費後未實現損益",
        "操作",
      ],
      rows.map((p) => [
        `<strong>${E(p.code)} ${E(v.securityName(p.code))}</strong><small class="block">${E(p.id.slice(0, 12))} · ${E(p.accountId)}</small>`,
        badge(credit[p.creditType] ?? p.creditType),
        num(p.qty),
        num(p.price, 2),
        `${num(p.marketPrice, 2)}<small class="block">${E(p.priceDate)}</small>`,
        num(p.marketValue),
        `<button type="button" class="value-link ${color(p.unrealized)}" data-action="position-detail" data-id="${E(p.id)}">${signed(p.unrealized)} ↗</button>`,
        p.opening ? button("edit-opening","編輯起始持股","ghost",`data-id="${E(p.id)}"`)+button("delete-opening", "刪除起始持股", "ghost", `data-id="${E(p.id)}"`) : "請至交易紀錄操作",
      ]),
    ),
    badge(rows.length + " 個批次"),
  )}
 ${card(
   "交易紀錄",
   table(
     [
       "日期",
       "商品",
       "交易類型",
       "股數",
       "成交價",
       "原始手續費",
       "待退折讓",
       "交易稅",
       "操作",
     ],
     v.book.trades
       .filter((t) => v.account === "all" || t.accountId === v.account)
       .slice()
       .reverse()
       .map((t) => {
         const d = v.latest?.tradeDetails?.find((x) => x.id === t.id);
         return [
           E(t.date),
           `<strong>${E(t.code)}</strong> ${E(v.securityName(t.code))}`,
           E(
             t.dayType ||
               `${credit[t.creditType]}${t.side === "buy" ? "買進" : "賣出"}`,
           ),
           num(t.qty),
           num(t.price, 2),
           num(d?.grossFee, 2),
           num(d?.rebate, 2),
           num(d?.tax),
           button("edit-trade", "修訂", "ghost", `data-id="${E(t.id)}"`) + button("delete-trade", "刪除", "ghost", `data-id="${E(t.id)}"`),
         ];
       }),
   ),
   button("trade", "新增交易", "secondary"),
 )}${note("當沖必須指定類型並連結兩側成交。批次指定可在交易表單中設定，紀錄修訂會先顯示重算差異。")}`;
}
