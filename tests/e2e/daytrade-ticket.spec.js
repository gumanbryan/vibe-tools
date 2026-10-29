import {test,expect} from '@playwright/test';
async function setup(page){await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).click();await page.locator('[name=openingDate]').fill('2026-10-19');await page.locator('[name=cash]').fill('1000000');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();await page.getByRole('link',{name:'持股與交易',exact:true}).click();}
async function seed(page,paired=true){await page.evaluate(async paired=>{const {openBookStore}=await import('/src/storage/database.js');const s=await openBookStore('personal'),b=await s.load();const common={accountId:'default',date:'2026-10-28',code:'2313',creditType:'cash',marketType:'regular',qty:'1000',price:'100',dayType:'cash-day',ruleSnapshot:b.accounts[0].profile};b.trades=[{...common,id:'buy',side:'buy',sequence:1},{...common,id:'sell',side:'sell',sequence:2}];b.allocations=paired?[{id:'pair',openTradeId:'buy',closeTradeId:'sell',qty:'1000',kind:'cash-day'}]:[];await s.save(b,b.revision);s.close();},paired);await page.reload();await page.locator('#asof-date').fill('2026-10-28');}
async function read(page){return page.evaluate(async()=>{const {openBookStore}=await import('/src/storage/database.js');const s=await openBookStore('personal'),b=await s.load();s.close();return b;});}
test('fee-only edits keep existing day-trade allocations and the 150 tax after reload',async({page})=>{
 await setup(page);await seed(page);
 await page.locator('tr').filter({hasText:'現股當沖'}).filter({hasText:'賣'}).getByRole('button',{name:'修訂',exact:true}).click();
 await expect(page.locator('[name=pairedTradeId]')).toHaveValue('keep');await expect(page.locator('[name=marginRatio]')).toBeHidden();
 await page.getByText('進階費用設定',{exact:true}).click();await page.locator('[name=actualGrossFee]').fill('99');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.getByRole('row').filter({hasText:'本筆交易稅'})).toContainText('150.00');await page.getByRole('button',{name:'確認套用',exact:true}).click();
 expect((await read(page)).allocations).toHaveLength(1);await page.reload();expect((await read(page)).allocations[0].id).toBe('pair');
});
test('quick ticket adds multi-price fills, splits a sale and previews different same-order fees',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'當沖快速輸入',exact:true}).click();await page.locator('[name=date]').fill('2026-10-28');await page.locator('[name=code]').fill('2313');
 await page.locator('[name=buy-price-0]').fill('5');await page.locator('[name=sell-price-0]').fill('5');
 await page.locator('[data-ticket-rows=sell] [data-ticket-action=split]').click();
 await page.locator('.ticket-side').filter({hasText:'賣出成交'}).getByRole('button',{name:'同一委託分批成交',exact:true}).click();
 await page.getByRole('button',{name:'預覽當沖試算',exact:true}).click();await expect(page.locator('#modal')).toContainText('確認當沖試算');await expect(page.locator('#modal')).toContainText('本次原始手續費 40 元');await page.getByRole('button',{name:'確認套用',exact:true}).click();
 const b=await read(page);expect(b.trades).toHaveLength(3);expect(b.allocations).toHaveLength(2);expect(b.trades.filter(t=>t.side==='sell')[0].feeGroupId).toBe(b.trades.filter(t=>t.side==='sell')[1].feeGroupId);
});
test('repair previews missing pairing and restores day tax without overwriting trades',async({page})=>{
 await setup(page);await seed(page,false);await page.getByRole('button',{name:'檢查當沖配對',exact:true}).click();await expect(page.locator('#modal')).toContainText('300');await expect(page.locator('#modal')).toContainText('150');expect((await read(page)).allocations).toHaveLength(0);await page.getByRole('button',{name:'備份並套用',exact:true}).click();expect((await read(page)).allocations).toHaveLength(1);expect((await read(page)).trades).toHaveLength(2);
});
