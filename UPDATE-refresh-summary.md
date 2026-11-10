# 修正 Actions 行情更新摘要

## 原因

Refresh public market data 先執行真實更新，再跑 npm test。整合測試會刻意模擬 2026-10-28 櫃買請求 terminated；原本測試呼叫的更新函式也會寫入 GITHUB_STEP_SUMMARY 並發出 Actions warning，導致每次正式更新都出現同一段假失敗摘要。原本成功的更新則沒有摘要。

## 修正

- 僅命令列的正式 data:update 產生 Actions 摘要及 warning；程式匯入執行的測試不寫正式摘要。
- 每次正式更新都顯示產生時間、查詢截止日、上市與上櫃行情日期，以及成功或部分更新結果。
- 加入回歸測試，驗證測試不污染摘要，並保留正式更新的成功與失敗回報。

## 安裝

解壓後，將 scripts、tests 資料夾及本說明覆蓋上傳至 GitHub 專案根目錄並提交 main。等這次提交完成後，再從 Actions 的 Refresh public market data 按 Run workflow，選 main。修正只影響新執行的摘要；以前那幾次執行留下的摘要不會被改寫。

按 Run workflow 只會啟動背景工作，必須等待該次 Refresh 結束，再等它啟動的 Deploy GitHub Pages 完成，之後重新整理網站。GitHub 原始行情請查看 public/data；根目錄 data 是較早上傳的舊檔。

本更新包不含個人帳本及行情檔，不需要重新匯入交易紀錄。
