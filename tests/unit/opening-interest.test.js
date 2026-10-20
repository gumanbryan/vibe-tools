import test from 'node:test';import assert from 'node:assert/strict';
import {openingInterestEstimate} from '../../src/credit/opening-interest.js';
import {createBook} from '../../src/storage/book.js';import {valueAccount} from '../../src/performance/portfolio.js';
test('pre-opening interest includes weekends but excludes opening day',()=>{
 const r=openingInterestEstimate('60000','6.45','2026-10-15','2026-10-19');assert.equal(r.days,4);assert.equal(Number(r.amount).toFixed(6),'42.410959');
 assert.equal(openingInterestEstimate('60000','6.45','2026-10-21','2026-10-19').amount,'0');
});
test('opening interest is carried once and daily accrual starts at the later of financed and opening dates',()=>{
 const b=createBook('personal','2026-10-19');b.openingPositions=[{id:'p',accountId:'default',code:'A',creditType:'margin',qty:'1000',price:'100',principal:'60000',annualRate:'0.0645',acquiredDate:'2026-10-13',interestStart:'2026-10-15',accruedInterest:openingInterestEstimate('60000','6.45','2026-10-15',b.openingDate).amount}];
 const m={bars:[{code:'A',date:'2026-10-19',close:'100'},{code:'A',date:'2026-10-20',close:'100'}],calendar:{businessDates:['2026-10-19','2026-10-20','2026-10-21']},securities:[],events:[]};
 const a=valueAccount(b,m,'2026-10-19').value,c=valueAccount(b,m,'2026-10-20').value;assert.equal(Number(a.balances.interestPayable).toFixed(6),'-53.013699');assert.equal(Number(c.balances.interestPayable).toFixed(6),'-63.616438');
 b.openingPositions[0].interestStart='2026-10-21';b.openingPositions[0].accruedInterest='0';assert.equal(valueAccount(b,m,'2026-10-19').value.balances.interestPayable??'0','0');
});
