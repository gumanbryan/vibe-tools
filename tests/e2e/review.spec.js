import { test, expect } from "@playwright/test";
async function seed(page, kind) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "建立自己的帳本", exact: true })
    .waitFor();
  await page.evaluate(async (kind) => {
    const { createBook } = await import("/src/storage/book.js");
    const { openBookStore } = await import("/src/storage/database.js");
    const b = createBook("personal", "2026-09-01");
    b.accounts[0].openingCash = "10000";
    if (kind === "negative")
      b.feeAdjustments = [
        {
          id: "loss",
          accountId: "default",
          date: "2026-09-01",
          amount: "20000",
          paid: true,
        },
      ];
    if (kind === "broken")
      b.trades = [
        {
          id: "oversell",
          accountId: "default",
          date: "2026-09-01",
          code: "2330",
          side: "sell",
          creditType: "cash",
          qty: "1000",
          price: "100",
          ruleSnapshot: b.accounts[0].profile,
        },
      ];
    if (kind === "dividend") {
      b.openingPositions = [
        {
          id: "p",
          accountId: "default",
          code: "2330",
          date: "2026-09-01",
          qty: "100",
          price: "100",
          creditType: "cash",
        },
      ];
      b.localEvents = [
        {
          id: "manual-dividend",
          code: "2330",
          kind: "cash-dividend",
          title: "測試股利公告",
          exDate: "2026-09-02",
          date: "2026-09-02",
          version: "1",
          perShare: "2",
        },
      ];
      b.confirmations = [
        {
          id: "confirmation",
          accountId: "default",
          eventId: "manual-dividend",
          eventVersion: "1",
          code: "2330",
          confirmed: true,
          kind: "cash-dividend",
          exDate: "2026-09-02",
          qty: "100",
          perShare: "2",
          amount: "200",
        },
      ];
    }
    if (kind === "correction") {
      const { loadMarket } = await import("/src/market/loader.js");
      const { captureMarketHistory } =
        await import("/src/market/history-lock.js");
      const m = await loadMarket("/");
      b.openingPositions = [
        {
          id: "p",
          accountId: "default",
          code: "2330",
          date: "2026-09-01",
          qty: "100",
          price: "100",
          creditType: "cash",
        },
      ];
      b.marketHistory = captureMarketHistory(b, m);
      b.marketHistory.bars[0].close = String(
        Number(b.marketHistory.bars[0].close) * 2,
      );
    }
    const store = await openBookStore("personal");
    await store.save(b, 0);
    store.close();
  }, kind);
  await page.reload();
}
test("R1 negative NAV keeps dashboard and broken ledger still exports", async ({
  page,
}) => {
  await seed(page, "negative");
  await expect(
    page.getByRole("heading", { name: "帳務待確認", exact: true }),
  ).toBeVisible();
  const [d] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "匯出備份", exact: true }).click(),
  ]);
  expect(d.suggestedFilename()).toContain("daily-equity");
});
test("R1 recovery export bypasses failed valuation", async ({ page }) => {
  await seed(page, "broken");
  await expect(
    page.getByRole("heading", { name: "帳務需要確認", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "前往備份與修正", exact: true })
    .click();
  const [d] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "匯出完整備份", exact: true }).click(),
  ]);
  expect(d.suggestedFilename()).toContain("daily-equity");
});
test("R6 payment reminder only receives existing dividend and never adds entitlement", async ({
  page,
}) => {
  await seed(page, "dividend");
  await expect(
    page.getByRole("heading", { name: "帳務待確認", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "事件中心", exact: true }).click();
  await page
    .locator("tr")
    .filter({ hasText: "股利待核對入帳" })
    .getByRole("button", { name: "核對實收" })
    .click();
  await expect(
    page.getByRole("heading", { name: "確認股利入帳／股票交付", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "確認儲存", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  const counts = await page.evaluate(async () => {
    const { openBookStore } = await import("/src/storage/database.js");
    const s = await openBookStore("personal");
    const b = await s.load();
    s.close();
    return [b.confirmations.length, b.confirmations[0].receipts.length];
  });
  expect(counts).toEqual([1, 1]);
});
test("R5 historical corrections show preview without automatically replacing consumed values", async ({
  page,
}) => {
  await seed(page, "correction");
  await expect(
    page.getByRole("button", { name: "預覽重算差異", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "預覽重算差異", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "歷史行情修訂與重算預覽", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "預覽重算差異", exact: true }),
  ).toBeVisible();
});
