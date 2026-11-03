import test from 'node:test';import assert from 'node:assert/strict';
import {createBook} from '../../src/storage/book.js';import {valueAccount} from '../../src/performance/portfolio.js';
const dates=['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-27','2026-10-28','2026-10-29','2026-10-30'];
const market={calendar:{businessDates:dates},securities:[{code:'A',productType:'stock'}],events:[],bars:dates.map(date=>({code:'A',date,close:'110'}))};
function fixture(type='cash'){
 const b=createBook('personal',dates[0]);b.accounts[0].openingCash='1000000';
 b.trades=[{id:'b',date:dates[0],sequence:1,side:'buy',price:'100',qty:'1000',actualGrossFee:'0',actualPrincipal:type==='margin'?'60000':undefined,strategyId:'disposition'},{id:'s',date:dates[2],sequence:2,side:'sell',price:'104',qty:'1000',actualGrossFee:'0',actualCreditInterest:'0'}].map(t=>({...t,code:'A',creditType:type,accountId:'default',marketType:'regular',ruleSnapshot:b.accounts[0].profile}));return b;
}
test('margin own-capital return uses 40000 rather than 100000 and does not deduct loan repayment as expense',()=>{
 const b=fixture('margin');b.trades[1].price='104.312';const d=valueAccount(b,market,dates[3]).value?.tradeDetails.find(t=>t.id==='s');
 assert.equal(d?.realizedProfit,'4000');assert.equal(d.investedCapital,'40000');assert.equal(d.realizedReturn,'0.1');assert.equal(d.realizedParts[0].strategyId,'disposition');
});
test('partial sales allocate entry net fees and principal proportionately, with rebates counted once',()=>{
 const b=fixture('margin');b.accounts[0].profile.discountTenths='5';for(const t of b.trades)t.ruleSnapshot=b.accounts[0].profile;
 b.trades[0].actualGrossFee='100';b.trades[1].qty='500';b.trades[1].actualGrossFee='100';b.trades[1].actualCreditInterest='10';
 const d=valueAccount(b,market,dates[3]).value?.tradeDetails.find(t=>t.id==='s');
 assert.equal(d?.investedCapital,'20050');assert.equal(d.realizedProfit,'1684');assert.equal(d.realizedParts[0].entryNetFee,'25');assert.equal(d.realizedParts[0].exitNetFee,'50');assert.equal(d.realizedParts[0].interest,'10');
});
test('a sale of mixed lots reports exact matched strategy and ordinary parts without tagging the whole stock',()=>{
 const b=fixture();b.trades[0].qty='500';b.trades.splice(1,0,{...b.trades[0],id:'b2',sequence:1.5,price:'102',strategyId:undefined});
 const r=valueAccount(b,market,dates[3]);assert.equal(r.ok,true);const d=r.value.tradeDetails.find(t=>t.id==='s');
 assert.equal(d?.realizedProfit,'2688');assert.equal(d.realizedParts.length,2);assert.equal(d.realizedParts.filter(p=>p.strategyId==='disposition').length,1);assert.equal(d.investedCapital,'101000');
});
test('opening holdings work with estimated entry fees and a zero-cost lot has no fabricated return',()=>{
 const b=fixture();b.openingPositions=[{id:'opening',code:'A',accountId:'default',creditType:'cash',qty:'1000',price:'0',strategyId:'disposition',stockGrant:true}];b.trades=b.trades.filter(t=>t.side==='sell');const d=valueAccount(b,market,dates[3]).value?.tradeDetails[0];assert.equal(d?.investedCapital,'0');assert.equal(d.realizedReturn,null);
});
test('manual close allocation determines which strategy lot was sold',()=>{
 const b=fixture();b.trades[0].qty='500';b.trades.splice(1,0,{...b.trades[0],id:'ordinary',sequence:1.5,price:'102',strategyId:undefined});b.trades.at(-1).qty='500';b.allocations=[{id:'manual',openTradeId:'ordinary',closeTradeId:'s',kind:'cash-close',qty:'500'}];
 const d=valueAccount(b,market,dates[3]).value.tradeDetails.find(t=>t.id==='s');assert.equal(d.realizedParts[0].lotId,'ordinary');assert.equal(d.realizedProfit,'844');assert.equal(d.investedCapital,'51000');
});
test('aggregate strategy return excludes ordinary parts, open positions and later dates',async()=>{
 const {strategySummary}=await import('../../src/performance/realized.js');const b=fixture();b.trades[0].qty='500';b.trades.splice(1,0,{...b.trades[0],id:'ordinary',sequence:1.5,price:'102',strategyId:undefined});
 assert.equal(strategySummary(valueAccount(b,market,dates[1]).value).records.length,0);
 const s=strategySummary(valueAccount(b,market,dates[3]).value);assert.equal(s.records.length,1);assert.equal(s.capital,'50000');assert.equal(s.profit,'1844');assert.equal(s.return,'0.03688');assert.equal(s.wins,1);
});
test('account filter prevents realized records from leaking across accounts',()=>{
 const b=fixture();b.accounts.push({...b.accounts[0],id:'other'});const r=valueAccount(b,market,dates[3],'other');assert.equal(r.ok,true);assert.ok(r.value.tradeDetails.every(t=>t.realizedProfit==null));
});
test('opening actual entry fee overrides estimates and uses the account rebate once',()=>{
 const b=fixture();b.accounts[0].profile.discountTenths='5';b.openingPositions=[{id:'opening',code:'A',accountId:'default',creditType:'cash',qty:'1000',price:'100',actualGrossFee:'100'}];b.trades=b.trades.filter(t=>t.side==='sell');b.trades[0].ruleSnapshot=b.accounts[0].profile;
 const d=valueAccount(b,market,dates[3]).value.tradeDetails[0];assert.equal(d.investedCapital,'100100');assert.equal(d.realizedProfit,'3588');assert.equal(d.realizedParts[0].entryFeeEstimated,false);
});
