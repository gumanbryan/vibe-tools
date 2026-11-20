import {test,expect} from '@playwright/test';
test('holdings combine same-type lots with weighted cost while financing and original edits stay separate',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).click();await page.locator('[name=openingDate]').fill('2026-10-19');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.evaluate(async()=>{const {openBookStore}=await import('/src/storage/database.js');const s=await openBookStore('personal'),b=await s.load();b.accounts[0].openingCash='1000000';const p={accountId:'default',date:b.openingDate,acquiredDate:b.openingDate,code:'2313',creditType:'cash',ruleSnapshot:b.accounts[0].profile};b.openingPositions=[{...p,id:'cash-a',qty:'1000',price:'100'},{...p,id:'cash-b',qty:'2000',price:'200'},{...p,id:'margin',creditType:'margin',qty:'1000',price:'150',principal:'90000',annualRate:'0.0645',interestStart:b.openingDate,accruedInterest:'0'}];await s.save(b,b.revision);s.close();});
 await page.reload();await page.getByRole('link',{name:'持股與交易',exact:true}).click();
 const holdings=page.locator('section.card').filter({has:page.getByRole('heading',{name:'目前持倉',exact:true})});
 await expect(holdings.locator('tbody tr')).toHaveCount(2);
 const cash=holdings.locator('tbody tr').filter({hasText:'現股'});await expect(cash).toContainText('3,000');await expect(cash).toContainText('166.67');await expect(cash).toContainText('2 個批次');
 await expect(holdings.locator('tbody tr').filter({hasText:'融資'})).toContainText('150.00');
 await cash.getByRole('button',{name:'查看批次',exact:true}).click();await expect(page.locator('#modal')).toContainText('原始持倉批次');await expect(page.locator('#modal')).toContainText('100.00');await expect(page.locator('#modal')).toContainText('200.00');
 await page.locator('#modal [data-action=edit-opening][data-id=cash-b]').click();await expect(page.locator('[name=qty]')).toHaveValue('2000');await expect(page.locator('[name=price]')).toHaveValue('200');
});
