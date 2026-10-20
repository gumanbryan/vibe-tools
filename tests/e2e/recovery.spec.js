import {test,expect} from '@playwright/test';
async function corrupt(page){
 await page.goto('/');
 await page.getByRole('button',{name:'建立自己的帳本',exact:true}).waitFor();
 await page.evaluate(async()=>{
  const {createBook}=await import('/src/storage/book.js');
  const {openBookStore}=await import('/src/storage/database.js');
  const b=createBook('personal','2026-09-01'); b.accounts[0].openingCash='1000000';
  b.openingPositions=[{id:'bad-opening',accountId:'default',date:'2026-09-01',code:'2313',creditType:'cash',qty:'1000',price:'100',principal:'',annualRate:'',restricted:'0',accruedInterest:'0'}];
  const store=await openBookStore('personal');await store.save(b,0);store.close();
 });
 await page.reload();
 await expect(page.getByRole('heading',{name:'帳務需要確認',exact:true})).toBeVisible();
}
test('existing blank principal cannot trap settings; reversible isolation restores dashboard',async({page})=>{
 await corrupt(page);
 await page.getByRole('link',{name:'設定與備份',exact:true}).click();
 await expect(page.getByRole('button',{name:'匯出完整備份',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'檢查與修正原始紀錄',exact:true}).click();
 await expect(page.getByRole('heading',{name:'帳本修復',exact:true})).toBeVisible();
 const row=page.getByRole('row').filter({hasText:'bad-opening'});
 await row.getByRole('button',{name:'暫停這筆紀錄',exact:true}).click();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button',{name:'備份並暫停',exact:true}).click(),
 ]);
 expect(download.suggestedFilename()).toContain('before-repair');
 await page.getByRole('link',{name:'資產總覽',exact:true}).click();
 await expect(page.getByRole('heading',{name:'帳務待確認',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'設定與備份',exact:true}).click();
 await page.getByRole('button',{name:'檢查與修正原始紀錄',exact:true}).click();
 await expect(page.getByRole('heading',{name:'已暫停的紀錄',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'恢復紀錄',exact:true}).click();
 await page.getByRole('button',{name:'確認恢復',exact:true}).click();
 await page.getByRole('link',{name:'資產總覽',exact:true}).click();
 await expect(page.getByRole('heading',{name:'帳務需要確認',exact:true})).toBeVisible();
});
test('opening cash position can be repaired without losing other records',async({page})=>{
 await corrupt(page);
 await page.getByRole('button',{name:'前往備份與修正',exact:true}).click();
 await page.getByRole('row').filter({hasText:'bad-opening'}).getByRole('button',{name:'修正數值',exact:true}).click();
 await page.locator('[name=principal]').fill('0');
 await page.getByRole('button',{name:'預覽修正',exact:true}).click();
 await page.getByRole('button',{name:'備份並套用修正',exact:true}).click();
 await page.getByRole('link',{name:'資產總覽',exact:true}).click();
 await expect(page.getByRole('heading',{name:'帳務待確認',exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('link',{name:'持股與交易',exact:true}).click();
 await expect(page.getByRole('cell',{name:/2313 華通/}).first()).toBeVisible();
});
