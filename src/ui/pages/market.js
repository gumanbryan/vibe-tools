import {
  E,
  num,
  pct,
  color,
  badge,
  button,
  table,
  card,
  note,
  select,
  safeLink,
} from "../helpers.js";
export function marketPage(v) {
  const index =
    v.market.indices.find((i) => i.code === v.indexCode) ??
    v.market.indices.find((i) => i.code === "TAIEX");
  const last = index?.bars.filter((b) => b.date <= v.date).at(-1);
  return `<div class="section-actions"><p class="muted">題材與官方產業使用相同排序，缺資料者排最後。</p><label class="market-sort-label">板塊排序 <select id="market-sort" aria-label="板塊排序">${[['volume-desc','放量倍率：高 → 低'],['volume-asc','放量倍率：低 → 高'],['return1-desc','近1日報酬：高 → 低'],['return5-desc','近5日報酬：高 → 低'],['return20-desc','近20日報酬：高 → 低'],['name-asc','名稱']].map(([value,label])=>`<option value="${value}" ${v.marketSort===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="market-tickers">${v.market.indices
    .filter((x) => ["TAIEX", "TPEX"].includes(x.code))
    .map((i) => {
      const a = i.bars.filter((b) => b.date <= v.date),
        b = a.at(-1),
        p = a.at(-2),
        r = p ? Number(b.close) / Number(p.close) - 1 : null;
      return `<div class="card ticker"><span>${E(i.name)}</span><strong>${num(b?.close, 2)}</strong><span class="${color(r)}">${pct(r)}</span><small>${E(b?.date)}</small></div>`;
    })
    .join("")}</div>
 ${card(
   index?.name ?? "大盤走勢",
   `<div id="market-chart" class="chart tall"></div><div class="legend"><span class="dot gold"></span>MA5 <span class="dot purple"></span>MA20 <span class="dot teal"></span>MA60</div>${note("日K線與未調整收盤價。可用滾輪／雙指縮放、左右拖曳，時間範圍限制在已取得的資料內。9/1起累積，均線資料不足時不顯示。")}`,
   `<select id="index-select" aria-label="選擇大盤">${v.market.indices
     .filter((i) => ["TAIEX", "TPEX"].includes(i.code))
     .map(
       (i) =>
         `<option value="${i.code}" ${v.indexCode === i.code ? "selected" : ""}>${E(i.name)}</option>`,
     )
     .join("")}</select>`,
 )}
 <div class="section-actions"><div><h2>題材輪動</h2><p class="muted">目前觀察名單回看區間報酬 · 非當時已知成分 · 題材可能重疊</p></div><div><select id="weight-select" aria-label="題材加權方式"><option value="equal" ${v.weighting === "equal" ? "selected" : ""}>等權平均</option><option value="cap" ${v.weighting === "cap" ? "selected" : ""}>起點市值加權</option></select>${button("theme", "新增／編輯題材")}</div></div>
 ${card(
   "電子供應鏈題材",
   table(
     [
       "題材",
       "有效成分",
       "近1日",
       "近5日",
       "近20日",
       "近60日",
       "放量倍率（成交額）",
       "5日超額報酬",
       "操作",
     ],
     v.themeMetrics.map((t) => [
       `<strong>${E(t.name)}</strong><small class="block">${E(t.angle ?? "產品／技術")}</small>`,
       `${t.valid20 ?? "—"} / ${t.count}`,
       ...[1, 5, 20, 60].map(
         (n) =>
           `<span class="${color(t.returns[n])}" title="${E(t.errors[n] ?? "")}">${pct(t.returns[n])}</span>`,
       ),
       activityCell(t),
       pct(t.relative5),
       button("theme-detail", "成分", "ghost", `data-id="${E(t.id)}"`),
     ]),
   ),
   badge(v.weighting === "equal" ? "等權" : "市值加權"),
 )}
 ${
   card(
     "官方產業分類",
     table(
       ["產業名稱", "分類代碼", "成分股數", "近1日平均", "近5日平均", "近20日平均", "放量倍率（成交額）", "操作"],
       v.industries.map((t) => [
         E(t.name),
         E(t.code),
         num(t.count),
         ...[1, 5, 20].map(
           (n) =>
             `<span class="${color(t.returns[n])}">${pct(t.returns[n])}</span>`,
         ),
         activityCell(t),
         button("industry-detail", "查看成分股", "ghost", `data-id="${E(t.id)}"`),
       ]),
     ),
   ) +
   note(
     "放量倍率＝當日成分股成交額合計 ÷ 前20個交易日平均成交額（不含當日）。只使用當日及前20日均有成交額資料的相同成分，缺資料或分母為零顯示—，數字下方標示有效樣本。官方分類平均為本站計算，並非官方產業指數。",
   )
 }`;
}

function activityCell(t){const a=t.activity??{};return `<span data-volume-ratio="${E(a.volumeRatio??'')}">${a.volumeRatio!=null?num(a.volumeRatio,2)+'×':'—'}</span><small class="block">成交額樣本 ${a.volumeMembers??0} / ${a.totalMembers??t.count}</small>`;}
