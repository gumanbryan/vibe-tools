import {
  E,
  num,
  pct,
  signed,
  color,
  badge,
  button,
  table,
  card,
  note,
} from "../helpers.js";
export function overview(v) {
  const s = v.latest;
  const kpis = [
    [
      "總淨資產",
      num(s?.equity),
      `扣預估平倉費稅 · ${s?.quality === "complete" ? "計算完整" : "含暫估／待核對"}`,
      "wallet",
    ],
    ["今日資產變動", signed(s?.pnl), "包含當日入出金", "trend"],
    ["累積資產變動率", pct(s?.return), "相對啟用日，包含入出金影響", "return"],
    [
      "待退手續費折讓",
      num(s?.balances?.rebateReceivable ?? 0, 2),
      "已計入淨值，尚未入帳",
      "pending",
    ],
  ];
  const alerts = v.reminders.filter((x) => x.needsAction).slice(0, 3);
  const marketEvents = v.reminders
    .filter((x) => x.type === "information")
    .slice(0, 3);
  return `<div class="kpi-grid">${kpis.map(([l, n, sub], i) => `<section class="kpi card"><div class="kpi-label">${l}<span class="kpi-symbol">${["◈", "↗", "◎", "◷"][i]}</span></div><strong class="kpi-number ${i === 1 ? color(s?.pnl) : i === 2 ? color(s?.return) : ""}">${i===0 ? `<button type="button" class="value-link" data-action="equity-detail" aria-label="查看淨資產明細">${n}<small> 查看明細 ↗</small></button>` : n}</strong><div class="kpi-sub">${sub}</div></section>`).join("")}</div>
 <div class="overview-grid">${card("資產成長軌跡", `<div class="chart-summary"><strong>${num(s?.equity)} <small>元 · 扣費後淨資產</small></strong><label>圖表內容 <select id="asset-chart-mode" aria-label="圖表內容"><option value="amount" ${v.assetChartMode!=="comparison"?"selected":""}>資產金額（元）</option><option value="comparison" ${v.assetChartMode==="comparison"?"selected":""}>報酬比較</option></select></label></div><div class="legend"><span class="dot purple"></span>我的帳戶 ${v.assetChartMode==="comparison"?'<span class="dot" style="background:#2563eb"></span>加權指數 <span class="dot" style="background:#d97706"></span>櫃買指數':""}</div><div class="chart" id="performance-chart"></div>${note("圖表僅顯示已有行情的開盤日；休市期間的利息仍累計至下一個開盤日。資產金額直接顯示元；報酬比較以起點＝100，個人資產變動包含入出金，指數為不含息價格報酬，因此不代表純投資績效。")}`, badge("啟用日至今"))}${card(
   "每日市場筆記",
   `<div class="summary-date"><span class="tiny-label">MARKET BRIEF</span><span>${E(v.market.asOf)}</span></div><div class="summary-list">${v.summary.sentences
     .slice(0, 4)
     .map(
       (s, i) =>
         `<div class="summary-item"><span class="summary-number">0${i + 1}</span><p>${E(s.text)}</p></div>`,
     )
     .join("")}</div><a class="text-link" href="#market">查看大盤與題材 →</a>`,
   badge("規則摘要", "lavender"),
 )}</div>
 <div class="overview-bottom">${card(
   "題材動態",
   `<div class="sector-preview">${
     v.themeMetrics
       .filter((t) => t.returns[1] != null)
       .sort((a, b) => Number(b.returns[1]) - Number(a.returns[1]))
       .slice(0, 5)
       .map(
         (t, i) =>
           `<a href="#market" class="sector-row"><span class="sector-icon shade-${i % 3}">${E(t.name.slice(0, 1))}</span><div><strong>${E(t.name)}</strong><small>${t.count} 檔成分股</small></div><div class="sector-spark"><span style="width:${Math.min(100, Math.abs(Number(t.returns[1])) * 500 + 15)}%;background:${Number(t.returns[1]) >= 0 ? "#f3c8ce" : "#bde4d9"}"></span></div><strong class="${color(t.returns[1])}">${pct(t.returns[1])}</strong></a>`,
       )
       .join("") || note("新增題材成分後，這裡會顯示近期表現。")
   }</div>`,
   '<a href="#market" class="text-link">全部題材 ↗</a>',
 )}
 <div class="stack">${card("帳務待確認", alerts.length ? alerts.map((x) => `<div class="reminder-row"><span class="reminder-dot"></span><div><strong>${E(x.title)}</strong><small>${E(x.code)} · ${E(x.date ?? "日期待公告")}</small></div></div>`).join("") : `<div class="calm-empty"><span>✓</span><div><strong>目前沒有待確認項目</strong><small>股利、退費與交割提醒會顯示在這裡</small></div></div>`, badge(String(alerts.length)))}${card("近期持股事件", marketEvents.length ? marketEvents.map((x) => `<div class="reminder-row"><div><strong>${E(x.title)}</strong><small>${E(x.code)} · ${E(x.date ?? "詳見公告")}</small></div></div>`).join("") : note("目前未取得近期法說會或股東會公告；不代表沒有事件。"), '<a href="#events" class="text-link">查看事件 ↗</a>')}</div></div>
 ${s?.warnings?.length ? `<details class="data-notes"><summary>計算狀態 · ${s.warnings.length} 項提醒</summary>${s.warnings.map((x) => `<p>${E(x)}</p>`).join("")}</details>` : ""}`;
}
