import {test,expect} from '@playwright/test';
test('footer distinguishes listed and OTC dates and partial-download warnings',async({page})=>{
 const manifest=await (await page.request.get('/data/manifest.json')).json();
 await page.route('**/data/manifest.json',async route=>{const response=await route.fetch();const json=await response.json();json.warnings=['test source unavailable'];await route.fulfill({response,json});});
 await page.goto('/');await page.getByRole('button',{name:'載入模擬帳本',exact:true}).click();
 await expect(page.locator('footer')).toContainText(`上市 ${manifest.marketAsOf.twse}`);
 await expect(page.locator('footer')).toContainText(`上櫃 ${manifest.marketAsOf.tpex}`);
 await expect(page.locator('footer')).toContainText('部分更新');
});
