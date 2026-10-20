import { test, expect } from "@playwright/test";
test("first visitor builds own book or loads independent demo, six pages work", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "載入模擬帳本", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "載入模擬帳本", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "資產總覽", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "帳務待確認", exact: true }),
  ).toBeVisible();
  for (const name of [
    "持股與交易",
    "帳務與費用",
    "大盤與題材",
    "事件中心",
    "設定與備份",
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  const ctx = await browser.newContext(),
    p = await ctx.newPage();
  await p.goto("http://127.0.0.1:4173");
  await expect(
    p.getByRole("button", { name: "建立自己的帳本", exact: true }),
  ).toBeVisible();
  await ctx.close();
});
test("local changes survive reload and responsive shell has no document overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "載入模擬帳本", exact: true }).click();
  await expect(
    page.getByText("模擬帳本", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("模擬帳本", { exact: true }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "資產總覽", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});
