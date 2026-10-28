import test from 'node:test';import assert from 'node:assert/strict';
import * as financing from '../../src/credit/financing.js';
import {createBook} from '../../src/storage/book.js';
import {valueAccount} from '../../src/performance/portfolio.js';
import {applyCalendarClosures} from '../../src/market/calendar-closures.js';
const make=()=>{const b=createBook('personal','2026-10-19');b.openingPositions=[{id:'p',accountId:'default',code:'A',qty:'1000',price:'100',creditType:'margin',principal:'60000',annualRate:'0.0645',interestStart:'2026-10-21',accruedInterest:'0'}];b.trades=[{id:'s',accountId:'default',code:'A',qty:'1000',price:'110',creditType:'margin',side:'sell',date:'2026-10-21',ruleSnapshot:b.accounts[0].profile}];return b;};
const market={calendar:applyCalendarClosures({businessDates:['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-27','2026-10-28','2026-10-29']}),securities:[],events:[],bars:['2026-10-19','2026-10-21','2026-10-27','2026-10-28'].map(date=>({code:'A',date,close:'110'}))};
test('broker interest calibration preserves the original book, rate, and settlement dates',()=>{
 assert.equal(typeof financing.applyBrokerInterest,'function');
 const b=make(),before=JSON.stringify(b),d=financing.applyBrokerInterest(b,[{tradeId:'s',amount:'21'}]);
 assert.equal(JSON.stringify(b),before);assert.equal(d.trades[0].actualCreditInterest,'21');
 const v=valueAccount(d,market,'2026-10-28');assert.equal(v.ok,true);const t=v.value.tradeDetails[0];
 assert.equal(t.creditInterest,'21');assert.equal(t.creditInterestEstimate,'64');assert.equal(t.creditInterestEstimated,false);
 assert.equal(t.creditInterestParts[0].days,6);assert.equal(t.creditInterestParts[0].from,'2026-10-21');assert.equal(t.creditInterestParts[0].through,'2026-10-26');
 assert.equal(v.value.entries.find(e=>e.tradeId==='s').dueDate,'2026-10-27');assert.ok(Math.abs(Number(v.value.balances.interestPayable??0))<1e-15);
});
test('zero is a real broker amount, while blank explicitly restores the estimate',()=>{
 assert.equal(typeof financing.applyBrokerInterest,'function');
 const zero=financing.applyBrokerInterest(make(),[{tradeId:'s',amount:'0'}]);assert.equal(valueAccount(zero,market,'2026-10-28').value.tradeDetails[0].creditInterest,'0');
 const reset=financing.applyBrokerInterest(zero,[{tradeId:'s',amount:''}]);assert.equal(reset.trades[0].actualCreditInterest,undefined);assert.equal(valueAccount(reset,market,'2026-10-28').value.tradeDetails[0].creditInterestEstimated,true);
});
test('calibration rejects invalid amounts, unknown trades, duplicate rows, and cash trades',()=>{
 assert.equal(typeof financing.applyBrokerInterest,'function');
 for(const amount of ['-1','abc','NaN','Infinity','1.5'])assert.throws(()=>financing.applyBrokerInterest(make(),[{tradeId:'s',amount}]));
 assert.throws(()=>financing.applyBrokerInterest(make(),[{tradeId:'missing',amount:'1'}]));
 assert.throws(()=>financing.applyBrokerInterest(make(),[{tradeId:'s',amount:'1'},{tradeId:'s',amount:'2'}]));
 const b=make();b.trades[0].creditType='cash';assert.throws(()=>financing.applyBrokerInterest(b,[{tradeId:'s',amount:'1'}]));
});
