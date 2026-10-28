import {test,expect} from '@playwright/test';
test('footer distinguishes listed and OTC stock dates instead of claiming a full refresh',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'載入模擬帳本',exact:true}).click();
 await expect(page.locator('footer')).toContainText('上市 2026-10-28');
 await expect(page.locator('footer')).toContainText('上櫃 2026-10-27');
 await expect(page.locator('footer')).toContainText('部分更新');
 await expect(page.locator('.version')).toContainText('v0.15');
});
