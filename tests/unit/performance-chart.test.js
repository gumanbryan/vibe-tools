import test from 'node:test';
import assert from 'node:assert/strict';
import * as data from '../../src/ui/market-data.js';

const dates=['2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26','2026-10-27','2026-10-28'];
const snapshots=dates.map((date,i)=>({date,equity:String(100000-i*10),return:String(-i/10000)}));
const market={asOf:'2026-10-27',calendar:{holidayDates:['2026-10-26'],businessDates:['2026-10-22','2026-10-23','2026-10-27','2026-10-28']},indices:[{code:'TAIEX',bars:dates.slice(0,6).map(date=>({date,close:'30000'}))}]};

test('asset chart removes weekends and supplementary holidays while retaining idle trading days',()=>{
 assert.equal(typeof data.performanceSnapshots,'function');
 assert.deepEqual(data.performanceSnapshots(snapshots,market).map(s=>s.date),['2026-10-22','2026-10-23','2026-10-27']);
 assert.equal(snapshots.length,7);
});
test('next market session retains the fully accrued asset value, not the last visible value',()=>{
 assert.equal(typeof data.performanceSnapshots,'function');
 const rows=data.performanceSnapshots(snapshots,market);
 assert.equal(rows.at(-1).equity,'99950');
});
test('calendar estimates cannot create chart points before closing data is available',()=>{
 assert.equal(typeof data.performanceSnapshots,'function');
 const m={...market,indices:[{bars:[{date:'2026-10-22',close:'30000'},{date:'2026-10-23',close:null},{date:'2026-10-27',close:'NaN'},{date:'2026-10-28',close:'30100'}]}]};
 assert.deepEqual(data.performanceSnapshots(snapshots,m).map(s=>s.date),['2026-10-22']);
});
test('available OTC sessions remain visible when the other benchmark is missing that day',()=>{
 assert.equal(typeof data.performanceSnapshots,'function');
 const m={...market,indices:[{bars:[{date:'2026-10-22',close:'30000'}]},{bars:[{date:'2026-10-23',close:'300'}]}]};
 assert.deepEqual(data.performanceSnapshots(snapshots,m).map(s=>s.date),['2026-10-22','2026-10-23']);
});
test('stock observations can supply dates without benchmarks, but a future calendar alone cannot',()=>{
 assert.equal(typeof data.performanceSnapshots,'function');
 assert.deepEqual(data.performanceSnapshots(snapshots,{...market,indices:[],bars:[{date:'2026-10-23',close:'100'}]}).map(s=>s.date),['2026-10-23']);
 assert.deepEqual(data.performanceSnapshots(snapshots,{...market,indices:[],bars:[]}),[]);
});
