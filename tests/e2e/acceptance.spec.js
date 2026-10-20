import { test, expect } from "@playwright/test";
test("cash flow, fee correction, account settings and backup do not upload personal data", async ({
  page,
}) => {
  const posts = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") posts.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "載入模擬帳本", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "帳務待確認", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "帳務與費用", exact: true }).click();
  await page.getByRole("button", { name: "新增入出金", exact: true }).click();
  await page.locator("input[name=amount]").fill("55000");
  await page.getByRole("button", { name: "確認儲存", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await expect(
    page.getByRole("cell", { name: "外部入金", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "設定與備份", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "匯出完整備份", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toContain("daily-equity");
  expect(posts).toEqual([]);
});
test("malicious announcement text is escaped and bad import retains book", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "載入模擬帳本", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "帳務待確認", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const { E } = await import("/src/ui/helpers.js");
    return E("<img src=x onerror=alert(1)>");
  });
  expect(result).toBe("&lt;img src=x onerror=alert(1)&gt;");
  await page.getByRole("link", { name: "設定與備份", exact: true }).click();
  await page.locator("#backup-file").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.locator("#toast")).toBeVisible();
  await expect(
    page.getByText("模擬帳本", { exact: true }).first(),
  ).toBeVisible();
});
