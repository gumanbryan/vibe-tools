import {test,expect} from '@playwright/test';
test('delete one wrong trade with preview and backup; cancel retains it',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).click();
 await page.locator('[name=openingDate]').fill('2026-09-01');await page.locator('[name=cash]').fill('1000000');await page.getByRole('button',{name:'確認儲存',exact:true}).click();
 await page.getByRole('button',{name:'＋ 新增交易',exact:true}).click();await page.locator('[name=date]').fill('2026-09-02');await page.locator('[name=code]').fill('2313');await page.locator('[name=price]').fill('240.5');
 await page.getByRole('button',{name:'確認儲存',exact:true}).click();await page.getByRole('button',{name:'確認套用',exact:true}).click();
 await page.getByRole('link',{name:'持股與交易',exact:true}).click();
 await page.getByRole('button',{name:'刪除',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();
 await expect(page.getByText('現股買進',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'刪除',exact:true}).click();await expect(page.getByRole('heading',{name:'確認刪除交易',exact:true})).toBeVisible();
 const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'備份並刪除',exact:true}).click()]);expect(d.suggestedFilename()).toContain('before-repair');
 await expect(page.getByText('現股買進',{exact:true})).toHaveCount(0);await page.reload();await expect(page.getByText('現股買進',{exact:true})).toHaveCount(0);
});
test('official industry has readable name and opens stock names with period returns',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'載入模擬帳本',exact:true}).click();await page.getByRole('link',{name:'大盤與題材',exact:true}).click();
 const row=page.getByRole('row').filter({has:page.getByRole('cell',{name:'半導體業',exact:true})});await expect(row).toBeVisible();
 await row.getByRole('button',{name:'查看成分股',exact:true}).click();
 await expect(page.getByRole('heading',{name:'半導體業 · 官方分類成分股',exact:true})).toBeVisible();
 await expect(page.locator('#modal')).toContainText('2330 台積電');await expect(page.locator('#modal')).toContainText('近20日');
 await page.getByRole('button',{name:'取消',exact:true}).click();
});
test('cannot delete a buy while a later sell still depends on its shares',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).waitFor();
 await page.evaluate(async()=>{
  const {createBook}=await import('/src/storage/book.js');const {openBookStore}=await import('/src/storage/database.js');
  const b=createBook('personal','2026-09-01');b.accounts[0].openingCash='1000000';
  b.trades=[['buy','2026-09-02'],['sell','2026-09-03']].map(([side,date],i)=>({id:side,accountId:'default',date,sequence:i,code:'2313',side,creditType:'cash',qty:'1000',price:'100',marketType:'regular',ruleSnapshot:b.accounts[0].profile}));
  const store=await openBookStore('personal');await store.save(b,0);store.close();
 });
 await page.reload();await page.getByRole('link',{name:'持股與交易',exact:true}).click();
 await page.getByRole('row').filter({has:page.getByText('現股買進',{exact:true})}).getByRole('button',{name:'刪除',exact:true}).click();
 await expect(page.getByRole('heading',{name:'這筆紀錄目前不能單獨刪除',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await expect(page.getByText('現股買進',{exact:true})).toBeVisible();await expect(page.getByText('現股賣出',{exact:true})).toBeVisible();
});
