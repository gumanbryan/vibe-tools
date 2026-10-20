import { test, expect } from '@playwright/test';
async function personal(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '建立自己的帳本', exact: true }).click();
  await page.locator('[name=openingDate]').fill('2026-09-01');
  await page.locator('[name=cash]').fill('1000000');
  await page.getByRole('button', { name: '確認儲存', exact: true }).click();
  await expect(page.locator('#modal')).not.toBeVisible();
}
async function trade(page) {
  await page.getByRole('button', { name: '＋ 新增交易', exact: true }).click();
  await page.locator('[name=date]').fill('2026-09-02');
  await page.locator('[name=code]').fill('2313');
  await page.locator('[name=price]').fill('100');
}
test('blank numeric override is blocked inline and cancel remains usable', async ({page}) => {
  await personal(page); await trade(page);
  await page.locator('[name=discountTenths]').fill('');
  await expect(page.getByRole('button', {name:'確認儲存',exact:true})).toBeDisabled();
  await expect(page.locator('#modal')).toContainText('請填寫本筆手續費打幾折');
  await page.locator('[name=discountTenths]').fill('2.8');
  await expect(page.getByRole('button', {name:'確認儲存',exact:true})).toBeEnabled();
  await page.getByRole('button', {name:'取消',exact:true}).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await page.getByRole('link', {name:'設定與備份',exact:true}).click();
  await expect(page.getByRole('button', {name:'匯出完整備份',exact:true})).toBeVisible();
});
test('first margin trade defaults interest and saves through preview', async ({page}) => {
  await personal(page); await trade(page);
  await page.locator('[name=tradePreset]').selectOption('margin-buy');
  await expect(page.locator('[name=annualRate]')).toHaveValue('6.45');
  await page.getByRole('button', {name:'確認儲存',exact:true}).click();
  await expect(page.getByRole('heading', {name:'確認交易試算',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'確認套用',exact:true}).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name:'帳務待確認',exact:true})).toBeVisible();
});
test('invalid product gives recoverable inline error and original input survives', async ({page}) => {
  await personal(page); await trade(page);
  await page.locator('[name=code]').fill('bad-code');
  await expect(page.getByRole('button',{name:'確認儲存',exact:true})).toBeDisabled();
  await expect(page.locator('#modal')).toContainText('查無商品');
  await page.locator('[name=code]').fill('2313');
  await page.getByRole('button', {name:'確認儲存',exact:true}).click();
  await expect(page.getByRole('heading', {name:'確認交易試算',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'取消',exact:true}).click();
  await expect(page.locator('#modal')).not.toBeVisible();
});
test('failed oversell retains input and both close controls still work', async ({page}) => {
  await personal(page); await trade(page);
  await page.locator('[name=tradePreset]').selectOption('cash-sell');
  await page.getByRole('button', {name:'確認儲存',exact:true}).click();
  await expect(page.locator('#form-error')).not.toBeEmpty();
  await expect(page.locator('[name=price]')).toHaveValue('100');
  await page.getByRole('button',{name:'關閉',exact:true}).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await trade(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).not.toBeVisible();
  await page.reload();
  await page.getByRole('link',{name:'持股與交易',exact:true}).click();
  await expect(page.getByRole('cell',{name:'現股賣出',exact:true})).toHaveCount(0);
});
test('existing legacy catalog expands without recreating personal account', async ({page}) => {
  await personal(page);
  await page.evaluate(async()=>{
    const {openBookStore}=await import('/src/storage/database.js');
    const store=await openBookStore('personal'); const book=await store.load();
    book.themes=await (await fetch('/src/sectors/legacy-themes.json')).json();
    book.accounts[0].profile.annualRate='';
    await store.save(book,book.revision); store.close();
  });
  await page.reload();
  await page.getByRole('link',{name:'大盤與題材',exact:true}).click();
  const row=page.getByRole('row').filter({hasText:'ABF載板'});
  await expect(row).toContainText('3 / 3');
  await row.getByRole('button',{name:'成分',exact:true}).click();
  await expect(page.locator('#modal')).toContainText('3037');
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await trade(page);
  await expect(page.locator('[name=annualRate]')).toHaveValue('6.45');
});
test('opening financing position requires principal before it can be saved',async({page})=>{
 await personal(page);
 await page.getByRole('link',{name:'持股與交易',exact:true}).click();
 await page.getByRole('button',{name:'新增起始部位',exact:true}).click();
 await page.locator('[name=code]').fill('2313');
 await page.locator('[name=price]').fill('100');
 await page.locator('[name=creditType]').selectOption('margin');
 await page.locator('[name=principal]').fill('0');
 await expect(page.getByRole('button',{name:'確認儲存',exact:true})).toBeDisabled();
 await expect(page.locator('#modal')).toContainText('大於0的未償融資本金');
 await page.locator('[name=principal]').fill('60000');
 await page.getByRole('button',{name:'確認儲存',exact:true}).click();
 await expect(page.locator('#modal')).not.toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'目前持倉',exact:true})).toBeVisible();
});
