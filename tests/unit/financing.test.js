import test from 'node:test';
import assert from 'node:assert/strict';
import {financedPrincipal,closingInterest} from '../../src/credit/financing.js';
import {createBook} from '../../src/storage/book.js';
import {valueAccount} from '../../src/performance/portfolio.js';
import {settlementSchedule} from '../../src/ledger/settlements.js';
import {estimatedOpeningPrincipal} from '../../src/ui/opening-position.js';
const dates=['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-27','2026-10-28','2026-10-29'];
const market={calendar:{businessDates:dates},securities:[{code:'A',productType:'stock'}],bars:dates.map(date=>({code:'A',date,close:'312.5'})),events:[]};
test('financed principal truncates to thousands and respects an explicit actual amount',()=>{
 assert.equal(financedPrincipal('625000','0.5'),'312000');assert.equal(financedPrincipal('999999','0.6'),'599000');assert.equal(financedPrincipal('100000','0.6'),'60000');assert.equal(financedPrincipal('625000','0.5','311000'),'311000');assert.throws(()=>financedPrincipal('625000','0.5','700000'));
 assert.equal(estimatedOpeningPrincipal('312.5','2000','50'),'312000');
});
test('opening manual principal is retained while new financed loans use the same amount in lots, cash and liabilities',()=>{
 const b=createBook('personal',dates[0]);b.accounts[0].openingCash='1000000';b.trades=[{id:'buy',accountId:'default',code:'A',date:'2026-10-21',qty:'2000',price:'312.5',creditType:'margin',side:'buy',ruleSnapshot:{...b.accounts[0].profile,marginRatio:'0.5',annualRate:'0'}}];
 const before=valueAccount(b,market,'2026-10-21').value,after=valueAccount(b,market,'2026-10-23').value;
 assert.equal(before.positions[0].principal,'312000');assert.equal(settlementSchedule(before.entries)[0].amount,'-313890');assert.equal(after.balances.marginDebt,'-312000');assert.equal(after.balances.cash,'686110');assert.equal(before.equity,after.equity);
});
test('closing interest includes weekends and the holiday before settlement; statement override remains possible',()=>{
 const p={principal:'312000',initialQty:'2000',annualRate:'0.0645',interestStart:'2026-10-23',accruedInterest:'0',ruleSnapshot:{interestBasis:365,interestRounding:'retained'}};
 const r=closingInterest(p,'2000','2026-10-27');assert.equal(r.charged,'221');assert.equal(Number(r.raw).toFixed(6),'220.536986');
});
test('financed close deducts projected interest in settlement and clears only the paid interest without reducing equity twice',()=>{
 const b=createBook('personal','2026-10-21');b.accounts[0].openingCash='1000000';b.openingPositions=[{id:'p',accountId:'default',code:'A',creditType:'margin',qty:'2000',price:'312.5',principal:'312000',annualRate:'0.0645',interestStart:'2026-10-23',accruedInterest:'0'}];
 b.trades=[{id:'sell',accountId:'default',code:'A',date:'2026-10-22',qty:'2000',price:'303.5',side:'sell',creditType:'margin',ruleSnapshot:b.accounts[0].profile}];
 const a=valueAccount(b,market,'2026-10-22').value,pre=valueAccount(b,market,'2026-10-26').value,paid=valueAccount(b,market,'2026-10-27').value;
 assert.equal(settlementSchedule(a.entries)[0].amount,'292094');assert.equal(paid.balances.cash,'1292094');assert.equal(paid.balances.marginDebt,'0');assert.ok(Math.abs(Number(paid.balances.interestPayable??0))<1e-20);assert.ok(Math.abs(Number(pre.equity)-Number(paid.equity))<1);
 b.trades[0].actualCreditInterest='230';assert.equal(settlementSchedule(valueAccount(b,market,'2026-10-22').value.entries)[0].amount,'292085');
});
test('partial exits allocate opening interest and preserve accrued liability for remaining shares',()=>{
 const b=createBook('personal','2026-10-19');b.openingPositions=[{id:'p',accountId:'default',code:'A',creditType:'margin',qty:'2000',price:'100',principal:'120000',annualRate:'0',interestStart:'2026-10-19',accruedInterest:'100'}];b.trades=[{id:'s',accountId:'default',code:'A',date:'2026-10-20',qty:'1000',price:'100',side:'sell',creditType:'margin',ruleSnapshot:b.accounts[0].profile}];
 const s=valueAccount(b,market,'2026-10-23').value;assert.equal(s.balances.marginDebt,'-60000');assert.equal(s.balances.interestPayable,'-50');assert.equal(s.positions[0].qty,'1000');
});
test('daily-floor and total-floor profiles clear all liability after staggered partial repayments',()=>{
 for(const rounding of ['daily-floor','total-floor']){
  const b=createBook('personal','2026-10-19');b.accounts[0].profile.interestRounding=rounding;b.openingPositions=[{id:'p',accountId:'default',code:'A',creditType:'margin',qty:'2000',price:'100',principal:'120000',annualRate:'0.06',interestStart:'2026-10-19',accruedInterest:'0',ruleSnapshot:b.accounts[0].profile}];
  b.trades=['2026-10-20','2026-10-21'].map((date,i)=>({id:'s'+i,accountId:'default',code:'A',date,qty:'1000',price:'100',side:'sell',creditType:'margin',ruleSnapshot:b.accounts[0].profile}));
  const r=valueAccount(b,market,'2026-10-27');assert.equal(r.ok,true);assert.ok(Math.abs(Number(r.value.balances.interestPayable??0))<1e-20,rounding);
 }
});
