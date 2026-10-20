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
export function accounting(v) {
  const b = v.latest?.balances ?? {},
    cash = Number(b.cash ?? 0),
    payable = -Number(v.pendingSettlement?.payable ?? 0),
    pending=v.pendingSettlement;
  return `<div class="section-actions"><p class="muted">已入帳、應收應付與受限制款項分開呈現。</p><div>${button("cashflow", "新增入出金")}${button("adjust-fee", "費用校正")}</div></div><div class="mini-grid">${[
    ["已交割現金", b.cash],
    ["待收交割款（按日互抵）", pending.receivable],
    ["待付交割款（按日互抵）", pending.payable],
    ["受限制擔保款", b.restricted],
  ]
    .map(
      ([l, n]) =>
        `<div class="card metric" ${l.startsWith("待收")?"data-pending-receivable":l.startsWith("待付")?"data-pending-payable":""}><span>${l}</span><strong>${num(n ?? 0)}</strong></div>`,
    )
    .join("")}</div>
 <div class="two-col settlement-next">${[1,2].map(n=>{const s=pending['t'+n];return `<section class="card metric" data-settlement-lag="${n}"><span>T+${n} 淨交割款 · ${E(s.date??'日曆未涵蓋')}</span><strong class="${color(s.amount)}">${s.date?signed(s.amount):'—'}</strong><small>正數待收，負數待付 · 預計交割後現金 ${s.date?num(cash+Number(pending.t1.amount)+(n===2?Number(pending.t2.amount):0)):'—'} 元</small></section>`;}).join('')}</div>
 ${note('T+1、T+2 以畫面估值日為基準，依交易日曆計算。同帳戶、同交割日先互抵；不同帳戶或不同日期仍分開，跨帳戶合計僅供總覽。折讓待實際退回才增加現金。')}
 <div class="two-col">${
   card(
     "資產與負債明細",
     table(
       ["項目", "金額"],
       [
         ["股票多頭市值", num(v.latest?.longValue)],
         ["融券回補市值負債", num(v.latest?.shortValue)],
         ["融資未償本金", num(Math.abs(Number(b.marginDebt ?? 0)))],
         ["應收現金股利", num(b.dividendReceivable ?? 0, 2)],
         ["待交付股票股利估值", num(v.latest?.pendingStockValue ?? 0)],
         ["應收手續費折讓", num(b.rebateReceivable ?? 0, 2)],
         [
           "累計應付利息／信用費用",
           num(Math.abs(Number(b.interestPayable ?? 0)), 2),
         ],
         ["其他應付費用", num(Math.abs(Number(b.feePayable ?? 0)), 2)],
         ["預估可動用現金", num(cash + Math.min(0, payable))],
       ],
     ),
   ) + note("可動用現金為本站估算，尚未扣未知費用，不等於券商即時購買力。")
 }
 ${card("信用帳戶維持率", v.maintenance.map((m) => `<div class="maintenance-box"><span>${E(m.name)}</span><strong class="${m.result?.status === "below-threshold" ? "up" : ""}">${m.result?.ratio ? num(m.result.ratio, 2) + "%" : "不適用"}</strong><small>參考門檻 ${E(m.result?.threshold ?? "130")}% · 收盤估算</small></div>`).join("") + note("各券商帳戶分開計算。低於參考門檻不代表立即處分；實際依券商通知及契約。"))}</div>
 ${card(
   "每月手續費折讓",
   table(
     ["交易月份", "帳戶", "累計待退", "預計退回日", "實收金額", "狀態／操作"],
     v.rebates.map((r) => {
       const rec = v.book.rebateReceipts.find((x) => x.id === r.id);
       return [
         E(r.month),
         E(v.book.accounts.find((a) => a.id === r.accountId)?.name),
         num(r.amount, 2),
         E(r.expectedDate),
         rec ? num(rec.amount, 2) : "—",
         rec
           ? badge("已核對入帳", "mint")
           : button(
               "receive-rebate",
               "確認入帳",
               "ghost",
               `data-id="${E(r.id)}"`,
             ),
       ];
     }),
   ),
   badge("未領到的折讓仍計入淨值"),
 )}
 ${card(
   "交割行事曆",
   table(
     ["日期", "帳戶", "預計淨收付", "狀態"],
     v.settlements.map((s) => [
       E(s.date),
       E(s.accountId),
       `<span class="${color(s.amount)}">${signed(s.amount)}</span>`,
       badge(s.date <= v.date ? "已按日期結算" : "待交割"),
     ]),
   ),
 )}
 ${card(
   "入出金紀錄",
   table(
     ["日期", "帳戶", "金額", "類型"],
     v.book.cashFlows.map((f) => [
       E(f.date),
       E(f.accountId),
       signed(f.amount),
       f.internal
         ? "帳戶間轉帳"
         : Number(f.amount) >= 0
           ? "外部入金"
           : "外部出金",
     ]),
   ),
 )}${note("所有出入金統一在當日收盤後處理；修訂及實際帳單校正保留操作紀錄。")}`;
}
