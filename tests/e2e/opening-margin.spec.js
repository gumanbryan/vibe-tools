import {test,expect} from '@playwright/test';
test('opening margin ratio calculates principal and preserves an explicit manual balance',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).click();
 await page.locator('[name=openingDate]').fill('2026-09-01');await page.locator('[name=cash]').fill('100000');await page.getByRole('button',{name:'確認儲存',exact:true}).click();
 await page.getByRole('link',{name:'持股與交易',exact:true}).click();await page.getByRole('button',{name:'新增起始部位',exact:true}).click();
 await expect(page.locator('[name=principal]')).not.toBeVisible();await expect(page.locator('[name=annualRate]')).not.toBeVisible();
 await page.locator('[name=code]').fill('2313');await page.locator('[name=price]').fill('240.5');await page.locator('[name=creditType]').selectOption('margin');
 await expect(page.locator('[name=marginRatio]')).toHaveValue('60');await expect(page.locator('[name=principal]')).toHaveValue('144300');
 await page.locator('[name=marginRatio]').fill('50');await expect(page.locator('[name=principal]')).toHaveValue('120250');
 await page.locator('[name=principal]').fill('100000');await page.locator('[name=price]').fill('241');await expect(page.locator('[name=principal]')).toHaveValue('100000');
 await page.getByRole('button',{name:'依成數重算本金',exact:true}).click();await expect(page.locator('[name=principal]')).toHaveValue('120500');
 await page.locator('[name=principal]').fill('100000');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 const saved=await page.evaluate(async()=>{const {openBookStore}=await import('/src/storage/database.js');const s=await openBookStore('personal');const b=await s.load();s.close();return b.openingPositions[0]});
 expect(saved.principal).toBe('100000');expect(saved.marginRatio).toBe('0.5');
});
test('switching a financing opening to cash saves no financing debt or hidden interest',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).click();await page.getByRole('button',{name:'確認儲存',exact:true}).click();
 await page.getByRole('link',{name:'持股與交易',exact:true}).click();await page.getByRole('button',{name:'新增起始部位',exact:true}).click();await page.locator('[name=code]').fill('2313');await page.locator('[name=price]').fill('240.5');await page.locator('[name=creditType]').selectOption('margin');await page.locator('[name=accruedInterest]').fill('100');
 await page.locator('[name=creditType]').selectOption('cash');await expect(page.locator('[name=principal]')).not.toBeVisible();await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 const saved=await page.evaluate(async()=>{const {openBookStore}=await import('/src/storage/database.js');const s=await openBookStore('personal');const b=await s.load();s.close();return b.openingPositions[0]});
 expect(saved.principal).toBe('0');expect(saved.accruedInterest).toBe('0');
});
