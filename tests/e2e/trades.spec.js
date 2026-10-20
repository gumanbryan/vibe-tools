import { test, expect } from "@playwright/test";
test("create local book enter trade preview then save and persist", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "建立自己的帳本", exact: true })
    .click();
  await page.locator("input[name=openingDate]").fill("2026-09-01");
  await page.locator("input[name=cash]").fill("1000000");
  await page.getByRole("button", { name: "確認儲存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "帳務待確認", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "＋ 新增交易", exact: true }).click();
  await page.locator("input[name=date]").fill("2026-09-02");
  await page.locator("input[name=code]").fill("2313");
  await page.locator("input[name=qty]").fill("1000");
  await page.locator("input[name=price]").fill("100");
  await page.getByRole("button", { name: "確認儲存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "確認交易試算", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "確認套用", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await page.getByRole("link", { name: "持股與交易", exact: true }).click();
  await expect(page.getByText("現股買進", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("現股買進", { exact: true })).toBeVisible();
});
