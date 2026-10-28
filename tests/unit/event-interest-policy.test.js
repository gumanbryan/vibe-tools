import test from 'node:test';import assert from 'node:assert/strict';
import * as finance from '../../src/credit/financing.js';
import {createBook} from '../../src/storage/book.js';import {valueAccount} from '../../src/performance/portfolio.js';
import {applyCalendarClosures} from '../../src/market/calendar-closures.js';
const dates=['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-27','2026-10-28','2026-10-29','2026-10-30'];
const market={calendar:applyCalendarClosures({businessDates:dates}),securities:[],events:[],bars:dates.flatMap(date=>['A','B','C'].map(code=>({date,code,close:'300'})))};
function fixture(){const b=createBook('personal','2026-10-19');
 b.openingPositions=[{id:'a',code:'A',principal:'146000',price:'243.5'},{id:'b',code:'B',principal:'173000',price:'289',acquiredDate:'2026-10-19',interestStart:'2026-10-19',interestMode:'estimate'}].map(p=>({...p,accountId:'default',creditType:'margin',qty:'1000',annualRate:'0.0645',date:'2026-10-19',accruedInterest:'0'}));
 b.trades=[{id:'sa',code:'A',date:'2026-10-21',side:'sell',qty:'1000',price:'249.5'},{id:'sb',code:'B',date:'2026-10-21',side:'sell',qty:'1000',price:'338'},{id:'bc',code:'C',date:'2026-10-21',side:'buy',qty:'2000',price:'312.5'},{id:'sc',code:'C',date:'2026-10-22',side:'sell',qty:'2000',price:'303.5'}].map(t=>({...t,accountId:'default',creditType:'margin',ruleSnapshot:{...b.accounts[0].profile,marginRatio:'0.5'}}));return b;}
const configure=b=>finance.applyInterestPolicy(b,{accountId:'default',policy:'taishin-20261023-inferred',openingDates:[{id:'a',date:'2026-10-19'},{id:'b',date:'2026-10-19'}]},market.calendar);
test('approved typhoon hypothesis calculates 52, 61, 221 without overriding statement amounts',()=>{
 assert.equal(typeof finance.applyInterestPolicy,'function');const original=fixture(),before=JSON.stringify(original),b=configure(original);assert.equal(JSON.stringify(original),before);
 const result=valueAccount(b,market,'2026-10-28');assert.equal(result.ok,true);const d=result.value.tradeDetails.filter(t=>t.side==='sell');
 assert.deepEqual(d.map(t=>t.creditInterest),['52','61','221']);assert.deepEqual(d.map(t=>t.creditInterestParts[0].days),[2,2,4]);
 assert.deepEqual(d.map(t=>t.creditInterestParts[0].from),['2026-10-21','2026-10-21','2026-10-23']);assert.deepEqual(d.map(t=>t.creditInterestParts[0].through),['2026-10-22','2026-10-22','2026-10-26']);
 assert.ok(d.every(t=>t.creditInterestEstimated));assert.ok(b.trades.every(t=>t.actualCreditInterest===undefined));
 assert.equal(result.value.entries.find(e=>e.tradeId==='sa').dueDate,'2026-10-27');assert.equal(result.value.entries.find(e=>e.tradeId==='sc').dueDate,'2026-10-28');assert.ok(Math.abs(Number(result.value.balances.interestPayable??0))<1e-15);
 assert.equal(valueAccount(b,market,'2026-10-26').value.balances.marginDebt,'-319000');assert.equal(Number(valueAccount(b,market,'2026-10-23').value.balances.interestPayable).toFixed(6),'-167.876712');
});
test('standard mode, unrelated later trades, manual historical interest and actual charges remain independent',()=>{
 assert.equal(typeof finance.applyInterestPolicy,'function');const b=configure(fixture());b.accounts[0].creditInterestPolicy='standard';assert.deepEqual(valueAccount(b,market,'2026-10-28').value.tradeDetails.filter(t=>t.side==='sell').map(t=>t.creditInterest),['155','183','55']);
 b.accounts[0].creditInterestPolicy='taishin-20261023-inferred';b.trades[0].actualCreditInterest='99';assert.equal(valueAccount(b,market,'2026-10-28').value.tradeDetails.find(t=>t.id==='sa').creditInterest,'99');
 assert.equal(finance.marginInterestDates({date:'2026-10-27',side:'buy'},'2026-10-29','taishin-20261023-inferred').start,'2026-10-29');
 const manual=fixture();manual.openingPositions[0].interestMode='manual';manual.openingPositions[0].accruedInterest='20';assert.equal(configure(manual).openingPositions[0].accruedInterest,'20');
});
test('configuration rejects unknown rules/accounts, duplicate rows and invalid opening dates',()=>{
 assert.equal(typeof finance.applyInterestPolicy,'function');const b=fixture();for(const input of [{accountId:'bad',policy:'standard'},{accountId:'default',policy:'invented'},{accountId:'default',policy:'standard',openingDates:[{id:'a',date:'2026-10-22'}]},{accountId:'default',policy:'standard',openingDates:[{id:'a',date:'2026-10-19'},{id:'a',date:'2026-10-19'}]}])assert.throws(()=>finance.applyInterestPolicy(b,input,market.calendar));
});
