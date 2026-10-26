import {test,expect} from '@playwright/test';

test('asset amount and comparison charts collapse closed sessions and unavailable dates',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {performanceChart,clearCharts}=await import('/src/ui/charts.js');
  const dates=['2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26','2026-10-27','2026-10-28'];
  const snapshots=dates.map((date,i)=>({date,equity:100000-i*10,return:-i/10000}));
  const benchmarks=[{code:'TAIEX',bars:['2026-10-22','2026-10-23','2026-10-27'].map(date=>({date,close:'30000'}))}];
  const market={asOf:'2026-10-27',indices:benchmarks,calendar:{holidayDates:['2026-10-26']}};
  const output=[];
  for(const mode of ['amount','comparison']){
   const el=document.createElement('div');el.id='chart-regression';el.style.cssText='width:800px;height:300px';document.body.append(el);
   const chart=performanceChart(el.id,snapshots,benchmarks,mode,market);
   const scale=chart.timeScale();
   output.push({mode,weekend:scale.timeToCoordinate('2026-10-24'),holiday:scale.timeToCoordinate('2026-10-26'),future:scale.timeToCoordinate('2026-10-28'),friday:scale.timeToCoordinate('2026-10-23'),tuesday:scale.timeToCoordinate('2026-10-27')});
   clearCharts();el.remove();
  }
  return output;
 });
 for(const r of result){
  expect(r.weekend,r.mode).toBeNull();expect(r.holiday,r.mode).toBeNull();expect(r.future,r.mode).toBeNull();
  expect(r.friday,r.mode).not.toBeNull();expect(r.tuesday,r.mode).not.toBeNull();
 }
});
