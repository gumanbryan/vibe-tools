import {test,expect} from '@playwright/test';
async function personal(page){await page.goto('/');await page.getByRole('button',{name:'建立自己的帳本',exact:true}).click();await page.locator('[name=openingDate]').fill('2026-09-01');await page.locator('[name=cash]').fill('1000000');await page.getByRole('button',{name:'確認儲存',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();}
test('large trade form uses common presets while retaining special trades',async({page})=>{
 await personal(page);await page.getByRole('button',{name:'＋ 新增交易',exact:true}).click();await expect(page.locator('[name=tradePreset]')).toBeVisible();
 await page.locator('[name=tradePreset]').selectOption('margin-buy');await expect(page.locator('[name=marginRatio]')).toBeVisible();await expect(page.locator('[name=side]')).not.toBeVisible();
 await page.locator('[name=tradePreset]').selectOption('cash-buy');await expect(page.locator('[name=annualRate]')).not.toBeVisible();
 await page.locator('[name=tradePreset]').selectOption('cash-day');await expect(page.locator('[name=side]')).toBeVisible();await expect(page.locator('[name=pairedTradeId]')).toBeHidden();await page.locator('[name=side]').selectOption('sell');await expect(page.locator('[name=pairedTradeId]')).toBeVisible();
 await page.locator('[name=tradePreset]').selectOption('other');await expect(page.locator('[name=creditType]')).toBeVisible();await expect(page.locator('[name=dayType]')).toBeVisible();
 expect(await page.locator('[name=price]').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
});
test('market tables share turnover ranking and omit turnover share',async({page})=>{
 await personal(page);await page.getByRole('link',{name:'大盤與題材',exact:true}).click();await expect(page.locator('#market-sort')).toBeVisible();await expect(page.getByRole('columnheader',{name:'成交占比',exact:true})).toHaveCount(0);
 const industry=page.locator('section.card').filter({has:page.getByRole('heading',{name:'官方產業分類',exact:true})});await expect(industry.getByRole('columnheader',{name:'放量倍率（成交額）',exact:true})).toBeVisible();
 const values=()=>industry.locator('tbody tr').evaluateAll(rows=>rows.map(r=>r.querySelector('[data-volume-ratio]')?.getAttribute('data-volume-ratio')).filter(x=>x!=null&&x!=='').map(Number));
 const high=await values();expect(high.length).toBeGreaterThan(0);expect(high).toEqual([...high].sort((a,b)=>b-a));await page.locator('#market-sort').selectOption('volume-asc');const low=await values();expect(low).toEqual([...low].sort((a,b)=>a-b));
});
test('cash day trade shows net pending T+2 and rolls into T+1 without changing NAV',async({page})=>{
 await personal(page);await page.evaluate(async()=>{const {openBookStore}=await import('/src/storage/database.js');const s=await openBookStore('personal');const b=await s.load();const tx=(id,side,price,sequence)=>({id,side,price,sequence,accountId:'default',date:'2026-09-02',code:'2313',creditType:'cash',marketType:'regular',qty:'1000',dayType:'cash-day',productType:'stock',ruleSnapshot:b.accounts[0].profile});b.trades=[tx('buy','buy','100',1),tx('sell','sell','102',2)];b.allocations=[{id:'pair',openTradeId:'buy',closeTradeId:'sell',kind:'cash-day',qty:'1000'}];await s.save(b,b.revision);s.close();});await page.reload();
 await page.locator('#asof-date').fill('2026-09-02');await page.getByRole('link',{name:'帳務與費用',exact:true}).click();await expect(page.locator('[data-settlement-lag="2"]')).toContainText('+1,560');await expect(page.locator('[data-pending-receivable]')).toContainText('1,560');await expect(page.locator('[data-pending-payable]')).toContainText('0');
 await page.locator('#asof-date').fill('2026-09-03');await expect(page.locator('[data-settlement-lag="1"]')).toContainText('+1,560');
});
test('market chart retains the data range after resize and scrolling',async({page})=>{
 await personal(page);await page.getByRole('link',{name:'大盤與題材',exact:true}).click();
 const ranges=await page.evaluate(async()=>{
  const {marketChart}=await import('/src/ui/charts.js');const el=document.createElement('div');el.id='range-check';el.style.cssText='width:900px;height:300px';document.body.append(el);
  const c=marketChart(el.id,{bars:[{date:'2026-09-01',close:'100'},{date:'2026-09-02',close:'101'},{date:'2026-09-03',close:'102'},{date:'2026-09-04',close:'103'}]},'2026-09-03');
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await frame();const first=c.timeScale().getVisibleLogicalRange();el.style.width='400px';await frame();const second=c.timeScale().getVisibleLogicalRange();return {first,second,options:c.options().handleScroll};
 });
 for(const r of [ranges.first,ranges.second]){expect(r.from).toBeGreaterThanOrEqual(-1);expect(r.to).toBeLessThanOrEqual(3);expect(r.to-r.from).toBeGreaterThanOrEqual(1);}
 expect(ranges.options.mouseWheel).toBe(true);
});
test('market wheel zoom and horizontal drag stay inside data boundaries',async({page})=>{
 await personal(page);
 await page.evaluate(async()=>{const {marketChart}=await import('/src/ui/charts.js');const el=document.createElement('div');el.id='gesture-check';el.style.cssText='width:900px;height:300px';document.body.append(el);window.gestureChart=marketChart(el.id,{bars:Array.from({length:20},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,close:String(100+i)}))});});
 await page.locator('#gesture-check').scrollIntoViewIfNeeded();
 const get=()=>page.evaluate(()=>window.gestureChart.timeScale().getVisibleLogicalRange());const initial=await get();const box=await page.locator('#gesture-check').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+100);await page.mouse.wheel(0,-500);
 await expect.poll(async()=>{const r=await get();return r.to-r.from;}).toBeLessThan(initial.to-initial.from);
 const zoom=await get();await page.mouse.move(box.x+box.width/2,box.y+100);await page.mouse.down();await page.mouse.move(box.x+box.width-80,box.y+100,{steps:10});await page.mouse.up();
 await expect.poll(async()=>{const r=await get();return Math.abs(r.from-zoom.from);}).toBeGreaterThan(0.01);
 for(const target of [{from:-100,to:-90},{from:100,to:110},{from:-100,to:110}]){
  await page.evaluate(r=>window.gestureChart.timeScale().setVisibleLogicalRange(r),target);
  await expect.poll(async()=>{const r=await get();return r.from>=-0.50001&&r.to<=19.50001;}).toBe(true);
 }
});
