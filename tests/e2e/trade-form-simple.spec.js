import {test,expect} from '@playwright/test';
async function personal(page){
 await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).click();await page.locator('[name=openingDate]').fill('2026-09-01');await page.locator('[name=cash]').fill('1000000');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.getByRole('button',{name:'＋ 新增交易',exact:true}).click();await page.locator('[name=date]').fill('2026-09-02');await page.locator('[name=code]').fill('2313');await page.locator('[name=price]').fill('100');
}
test('cash form hides irrelevant fields and switching from incomplete margin still saves cash',async({page})=>{
 await personal(page);
 for(const key of ['marginRatio','annualRate','pairedTradeId','dayQty','feeGroupId','actualGrossFee','bondTaxExempt'])await expect(page.locator(`[name=${key}]`)).not.toBeVisible();
 await page.locator('[name=tradePreset]').selectOption('margin-buy');await expect(page.locator('[name=annualRate]')).toBeVisible();await page.locator('[name=annualRate]').fill('');await expect(page.getByRole('button',{name:'確認儲存',exact:true})).toBeDisabled();
 await page.locator('[name=tradePreset]').selectOption('cash-buy');await expect(page.getByRole('button',{name:'確認儲存',exact:true})).toBeEnabled();await page.getByRole('button',{name:'確認儲存',exact:true}).click();await page.getByRole('button',{name:'確認套用',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 const t=await page.evaluate(async()=>{const {openBookStore}=await import('/src/storage/database.js');const s=await openBookStore('personal');const b=await s.load();s.close();return b.trades[0]});expect(t.creditType).toBe('cash');expect(t.ruleSnapshot.marginRatio).toBe('0');expect(t.ruleSnapshot.annualRate).toBe('0');
});
test('day trade pairing appears only for day trading and advanced fee settings stay accessible',async({page})=>{
 await personal(page);await page.locator('[name=tradePreset]').selectOption('cash-day');await expect(page.locator('[name=pairedTradeId]')).toBeVisible();await expect(page.locator('[data-day-trade-help]')).toContainText('第一筆');
 await page.locator('[name=tradePreset]').selectOption('cash-buy');await expect(page.locator('[name=pairedTradeId]')).not.toBeVisible();await expect(page.locator('[name=dayQty]')).not.toBeVisible();
 await page.getByText('進階費用設定',{exact:true}).click();await expect(page.locator('[name=feeGroupId]')).toBeVisible();await expect(page.locator('#modal')).toContainText('同一張委託');await page.locator('[name=feeGroupId]').fill('order-1');
 await page.getByRole('button',{name:'確認儲存',exact:true}).click();await page.getByRole('button',{name:'確認套用',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
});
for(const remainDayTrade of [false,true])test(`day trade controls ${remainDayTrade?'retain matching for tax preview':'clear hidden matching when switching to ordinary sale'}`,async({page})=>{
 await personal(page);await page.locator('[name=tradePreset]').selectOption('cash-day');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await page.getByRole('button',{name:'確認套用',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.getByRole('button',{name:'＋ 新增交易',exact:true}).click();await page.locator('[name=date]').fill('2026-09-02');await page.locator('[name=code]').fill('2313');await page.locator('[name=price]').fill('100');await page.locator('[name=tradePreset]').selectOption('cash-day');await page.locator('[name=side]').selectOption('sell');
 const id=await page.locator('[name=pairedTradeId] option').nth(1).getAttribute('value');await page.locator('[name=pairedTradeId]').selectOption(id);await page.locator('[name=dayQty]').fill('1000');
 if(!remainDayTrade){await page.locator('[name=tradePreset]').selectOption('cash-sell');await expect(page.locator('[name=pairedTradeId]')).toHaveValue('');await expect(page.locator('[name=dayQty]')).toHaveValue('');}
 await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.getByRole('row').filter({hasText:'本筆交易稅'})).toContainText(remainDayTrade?'150.00':'300.00');await page.getByRole('button',{name:'確認套用',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
});
