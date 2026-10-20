import {test,expect} from '@playwright/test';
test('create and edit opening cash with signed settlement amounts',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).click();
 await page.locator('[name=openingDate]').fill('2026-10-19');await page.locator('[name=cash]').fill('17025');await page.locator('[name=t1]').fill('-1000');await page.locator('[name=t2]').fill('85522');
 await expect(page.locator('[data-opening-preview]')).toContainText('101,547');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.getByRole('link',{name:'設定與備份',exact:true}).click();await page.getByRole('button',{name:'設定起始資產',exact:true}).click();await expect(page.locator('[name=t2]')).toHaveValue('85522');await page.locator('[name=t2]').fill('85523');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.reload();await page.getByRole('button',{name:'設定起始資產',exact:true}).click();await expect(page.locator('[name=t2]')).toHaveValue('85523');
 const b=await page.evaluate(async()=>{const {openBookStore}=await import('/src/storage/database.js');const s=await openBookStore('personal');const b=await s.load();s.close();return b});expect(b.entries.filter(e=>e.openingAssetsAccountId)).toHaveLength(4);
});
