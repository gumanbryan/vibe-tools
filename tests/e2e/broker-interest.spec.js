import {test,expect} from '@playwright/test';
test('broker statement interest shows estimate details and changes cash only after confirmation',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).click();await page.locator('[name=openingDate]').fill('2026-10-19');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.evaluate(async()=>{const {openBookStore}=await import('/src/storage/database.js');const store=await openBookStore('personal'),b=await store.load();b.openingPositions=[{id:'p',accountId:'default',code:'2313',creditType:'margin',qty:'1000',price:'100',principal:'60000',annualRate:'0.0645',acquiredDate:'2026-10-19',interestStart:'2026-10-21',accruedInterest:'0'}];b.trades=[{id:'s',accountId:'default',code:'2313',creditType:'margin',side:'sell',qty:'1000',price:'110',date:'2026-10-21',ruleSnapshot:b.accounts[0].profile}];await store.save(b,b.revision);store.close();});
 await page.reload();await page.getByRole('link',{name:'持股與交易',exact:true}).click();
 await page.getByRole('button',{name:'核對融資利息',exact:true}).click({timeout:2500});
 await expect(page.locator('#modal')).toContainText('2026-10-27');await expect(page.locator('#modal')).toContainText('6 天');await expect(page.locator('#modal')).toContainText('64');
 await page.locator('[name="interest:s"]').fill('-1');await expect(page.getByRole('button',{name:'預覽校正',exact:true})).toBeDisabled();
 await page.locator('[name="interest:s"]').fill('21');await page.getByRole('button',{name:'預覽校正',exact:true}).click();await expect(page.locator('#modal')).toContainText('套用券商融資利息');
 const read=()=>page.evaluate(async()=>{const {openBookStore}=await import('/src/storage/database.js');const s=await openBookStore('personal'),b=await s.load();s.close();return b.trades[0].actualCreditInterest??null;});expect(await read()).toBeNull();
 await page.getByRole('button',{name:'備份並套用',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();expect(await read()).toBe('21');
 await page.reload();await page.getByRole('link',{name:'持股與交易',exact:true}).click();await page.getByRole('button',{name:'核對融資利息',exact:true}).click();await expect(page.locator('[name="interest:s"]')).toHaveValue('21');await expect(page.locator('#modal')).toContainText('2026-10-27');
});
