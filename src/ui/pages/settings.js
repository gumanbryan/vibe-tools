import { E, num, button, table, card, note, badge } from "../helpers.js";
export function settings(v) {
  return `<div class="two-col">${card("帳戶與費率", v.book.accounts.map((a) => `<div class="account-setting"><div><strong>${E(a.name)}</strong><small>${E(a.id)} · 基礎費率 ${num(Number(a.profile.feeRate) * 100, 4)}% · ${E(a.profile.discountTenths)} 折</small></div>${button("opening-assets", "設定起始資產", "secondary", `data-id="${E(a.id)}"`)}${button("edit-account", "編輯", "ghost", `data-id="${E(a.id)}"`)}</div>`).join("") + button("add-account", "新增帳戶"))}${card("備份與還原", `<p class="muted">個人帳務只存在這個瀏覽器。換裝置、清除資料或搬移網址前，請先匯出。</p><div class="button-row">${button("export", "匯出完整備份", "primary")}${button("import", "匯入備份")}</div><input hidden id="backup-file" type="file" accept="application/json,.json">${note("匯入會先檢查格式與檢查碼，顯示摘要；確認前不會覆蓋目前資料。")}`)}</div>
 ${
   card(
     "資料與計算狀態",
     table(
       ["項目", "狀態"],
       [
         ["公開行情起點", "2026/09/01"],
         ["行情截止日", E(v.market.asOf)],
         ["更新時間", E(v.market.manifest.generatedAt)],
         ["價格覆蓋", E(v.market.coverage)],
         ["行情筆數", num(v.market.bars.length)],
         ["市值紀錄筆數", num(v.market.caps.length)],
         ["融資與融券規則", "估算，可依實際帳單校正"],
         ["個人帳本", "IndexedDB · 不上傳 · 無跨裝置同步"],
         ["未來交割日曆", E(v.market.calendar.futureStatus ?? "待核對")],
       ],
     ),
   ) +
   note(
     "公開資料來源：TWSE、TPEx。股利發放日、法說日期及券商個別契約仍需核對。缺市值時不顯示市值加權結果。",
   )
 }
 ${card("歷史紀錄與比較設定", `<div class="button-row">${button("history", "補登較早起始資產")}${button("benchmarks", "設定比較ETF")}${button("switch-book", v.book.demo ? "回到個人帳本" : "切換模擬帳本")}</div>${note("補登歷史建立獨立副本，核對原啟用日的資產差異後再套用。9/1之前缺行情，不產生完整績效。")}`)}
 ${card(
   "操作紀錄",
   table(
     ["時間", "操作", "說明"],
     v.book.audit
       .slice(-15)
       .reverse()
       .map((a) => [
         E(a.at?.slice(0, 19).replace("T", " ")),
         E(a.kind),
         E(a.details),
       ]),
   ),
 )}${note("把GitHub儲存庫改私人不會自動讓網站僅你可見。搬移網址需先匯出、再於新網址匯入。")}`;
}
