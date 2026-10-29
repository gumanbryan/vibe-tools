import test from 'node:test';import assert from 'node:assert/strict';
import {createBook} from '../../src/storage/book.js';import {prepareTrades} from '../../src/performance/portfolio.js';
import * as ticket from '../../src/ledger/daytrade-ticket.js';
const buy=(id,extra={})=>({id,accountId:'default',date:'2026-10-28',code:'2313',side:'buy',creditType:'cash',marketType:'regular',qty:'1000',price:'100',sequence:1,productType:'stock',...extra});
const book=()=>{const b=createBook('personal','2026-10-19');b.trades=[buy('b'),buy('s',{side:'sell',dayType:'cash-day',sequence:2})];b.allocations=[{id:'a',openTradeId:'b',closeTradeId:'s',kind:'cash-day',qty:'1000'}];return b;};
test('fee-only revisions preserve multi-pair allocations and discounted tax, with stable IDs',()=>{
 const b=book();const revised=ticket.reviseTrade(b,{...b.trades[1],actualGrossFee:'99'});
 assert.deepEqual(revised.allocations,b.allocations);assert.equal(prepareTrades(revised,'2026-10-28').details.find(t=>t.id==='s').tax,'150');assert.equal(b.trades[1].actualGrossFee,undefined);
 const again=ticket.reviseTrade(revised,{...revised.trades.find(t=>t.id==='s'),actualGrossFee:'88'});assert.equal(again.trades.length,2);assert.equal(again.allocations.length,1);
 assert.throws(()=>ticket.reviseTrade(b,{...b.trades[1],qty:'500'}));
});
test('candidates contain only unconsumed same-account same-day same-stock cash buys',()=>{
 const b=book();b.trades.push(buy('today',{price:'101'}),buy('yesterday',{date:'2026-10-27'}),buy('margin',{creditType:'margin'}),buy('other',{code:'1303'}),buy('account',{accountId:'another'}));
 assert.deepEqual(ticket.dayBuyCandidates(b,{accountId:'default',date:'2026-10-28',code:'2313'}).map(t=>t.id),['today']);
});
test('ticket matches multiple buy/sell prices and respects selected buy prices without over-allocation',()=>{
 const b=createBook('personal','2026-10-19');const input={accountId:'default',date:'2026-10-28',code:'2313',buys:[{price:'100',qty:'1000',order:'1'},{price:'101',qty:'1000',order:'2'}],sells:[{price:'102',qty:'1500',order:'1'},{price:'103',qty:'500',order:'2'}]};
 const draft=ticket.buildDayTicket(b,input,{productType:'stock'},'batch');assert.equal(draft.trades.length,4);assert.equal(draft.allocations.length,3);assert.equal(draft.allocations.reduce((n,a)=>n+Number(a.qty),0),2000);assert.equal(b.trades.length,0);
 assert.throws(()=>ticket.buildDayTicket(b,{...input,sells:[{price:'102',qty:'2001',order:'1'}]},{productType:'stock'},'batch'));
 const other=ticket.buildDayTicket(b,{...input,sells:[{price:'102',qty:'1000',order:'1',buyTradeId:'batch:buy:1'}]},{productType:'stock'},'batch');assert.equal(other.allocations[0].openTradeId,'batch:buy:1');
});
test('same-price single-order and separate-order sales retain execution rows but charge different minimums and tax rounding',()=>{
 const b=createBook('personal','2026-10-19');const input={accountId:'default',date:'2026-10-28',code:'2313',buys:[{price:'5',qty:'200',order:'1'}],sells:[{price:'5',qty:'100',order:'1'},{price:'5',qty:'100',order:'1'}]};
 const same=ticket.buildDayTicket(b,input,{productType:'stock'},'batch');const separated=ticket.buildDayTicket(b,{...input,sells:input.sells.map((s,i)=>({...s,order:String(i+1)}))},{productType:'stock'},'batch');
 const sum=bs=>prepareTrades(bs,'2026-10-28').details.filter(t=>t.side==='sell').reduce((o,t)=>({fee:o.fee+Number(t.grossFee),tax:o.tax+Number(t.tax)}),{fee:0,tax:0});
 assert.deepEqual(sum(same),{fee:20,tax:1});assert.deepEqual(sum(separated),{fee:40,tax:0});
});
test('editing either side of a many-to-many match keeps all allocation quantities',()=>{
 const b=book();b.trades[0].qty='500';b.trades.push(buy('b2',{qty:'500',price:'101',sequence:1.5}));b.allocations[0].qty='500';b.allocations.push({id:'a2',openTradeId:'b2',closeTradeId:'s',kind:'cash-day',qty:'500'});
 const draft=ticket.reviseTrade(b,{...b.trades.find(t=>t.id==='b2'),actualGrossFee:'30'});assert.deepEqual(draft.allocations,b.allocations);assert.equal(prepareTrades(draft,'2026-10-28').details.find(t=>t.id==='s').tax,'150');
});
test('actual fee entered on any execution in an order is applied once to the whole order',()=>{
 const b=createBook('personal','2026-10-19');b.trades=[buy('b1',{feeGroupId:'order',qty:'500'}),buy('b2',{feeGroupId:'order',qty:'500',actualGrossFee:'75'})];
 assert.equal(prepareTrades(b,'2026-10-28').details.reduce((n,t)=>n+Number(t.grossFee),0),75);
 b.trades[0].actualGrossFee='80';assert.throws(()=>prepareTrades(b,'2026-10-28'),/不同實收手續費/);
});
test('buy options exclude quantities already sold as ordinary cash trades',()=>{
 const b=createBook('personal','2026-10-19');b.trades=[buy('b'),buy('normal-sale',{side:'sell',qty:'400',sequence:2})];
 assert.equal(ticket.dayBuyCandidates(b,{accountId:'default',date:'2026-10-28',code:'2313'})[0].availableQty,'600');
});
