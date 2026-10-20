import test from 'node:test';import assert from 'node:assert/strict';
import {pauseRecord,restoreRecord} from '../../src/storage/recovery.js';
import {createBook} from '../../src/storage/book.js';
test('pause preserves full original and linked allocations and restore is reversible',()=>{
 const b=createBook('personal','2026-09-01');
 b.trades=[{id:'t',price:'',code:'2313'}];b.allocations=[{id:'a',openTradeId:'t',closeTradeId:'other',qty:'1'}];
 const p=pauseRecord(b,'trades','t','q');
 assert.equal(b.trades.length,1);assert.equal(p.trades.length,0);assert.equal(p.allocations.length,0);
 assert.equal(p.quarantine[0].record.price,'');
 const restored=restoreRecord(p,'q');assert.deepEqual(restored.trades,b.trades);assert.deepEqual(restored.allocations,b.allocations);
 assert.equal(restored.quarantine.length,0);
});
test('cannot suspend an account or silently overwrite an existing record during restore',()=>{
 const b=createBook('personal','2026-09-01');
 assert.throws(()=>pauseRecord(b,'accounts','default','q'));
 b.trades=[{id:'t'}];const p=pauseRecord(b,'trades','t','q');p.trades.push({id:'t'});
 assert.throws(()=>restoreRecord(p,'q'));
});
test('delete transaction preserves audit-ready original and other transactions',async()=>{
 const {deleteTrade}=await import('../../src/storage/recovery.js');
 const b=createBook('personal','2026-09-01');b.trades=[{id:'t',code:'2313',qty:'1000'},{id:'keep',code:'2330'}];
 b.allocations=[{id:'pair',openTradeId:'t',closeTradeId:'keep',qty:'1000'}];
 const draft=deleteTrade(b,'t','deleted');assert.equal(draft.trades.length,1);assert.equal(draft.trades[0].id,'keep');
 assert.equal(draft.allocations.length,0);assert.equal(draft.quarantine[0].deleted,true);assert.equal(b.trades.length,2);
});
