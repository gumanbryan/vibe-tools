# 日見 v0.15：櫃買官方收盤 API 與重試

## 更新方式
1. 解壓縮，將 `src`、`scripts`、`tests` 資料夾與本說明檔一同拖進 GitHub 專案根目錄的 Upload files，保留資料夾結構，Commit 到 main。共 12 個檔案，無須上傳 node_modules、dist 或 ZIP 本身。
2. 等 Commit 的 Deploy GitHub Pages 完成。
3. Actions → Refresh public market data → Run workflow（main）。
4. 等資料更新與其後啟動的 Deploy GitHub Pages 都完成，再 Ctrl+F5。
5. 左下版本應為 v0.15。底部會分別顯示「上市 YYYY-MM-DD · 上櫃 YYYY-MM-DD」，有缺漏或日期不一致時顯示「部分更新」。

## 內容
- 最新上櫃行情優先使用官方 https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes 。
- 最新 API 只讀一次，按回傳 Date 記錄真實資料日，不把舊資料改標成今天。
- 新來源失敗、格式不符，或未包含需要的日期時，沿用原有可指定日期的官方 dailyQuotes 查詢；歷史日期也保留原查詢。
- 網路請求包含讀取 JSON 本文的整段流程，最多嘗試 3 次，間隔遞增，處理下載中斷。
- 解析民國日期與無成交的 ----；排除原本不支援的權證商品，不把 Capitals（資本額）當成發行股數計算市值。
- 保留已有歷史行情及已驗證市值；不改個人帳本、融資計息規則與既有排程。
- 部分行情失敗時，Actions 會產生警告及更新摘要；仍保留可用資料與正常部署，不保證綠勾代表行情齊全。請看上市、上櫃各自日期。

## 驗證
115 項單元及整合測試、43 項 Chromium 瀏覽器測試、正式建置通過。以官方實際資料完整執行更新成功：上市與上櫃均為 2026-10-28，上櫃支援商品 1,013 筆，抓取警告 0。本包僅含程式更新，未包含這次測試產生的行情資料；請依上述步驟手動更新一次。
