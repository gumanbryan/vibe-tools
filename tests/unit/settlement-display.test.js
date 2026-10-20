import test from 'node:test';import assert from 'node:assert/strict';
import {settlementSchedule,settlementSummary} from '../../src/ledger/settlements.js';
const calendar={businessDates:['2026-10-19','2026-10-20','2026-10-21','2026-10-22']};
const item=(id,accountId,dueDate,bucket,amount)=>({id,date:'2026-10-19',accountId,dueDate,lines:[{bucket,debit:amount>0?String(amount):'0',credit:amount<0?String(-amount):'0'}]});
test('net same-account same-date receipts and payments, retaining different accounts and due dates',()=>{
 const es=[item('buy','a','2026-10-21','payable',-993413),item('sell','a','2026-10-21','receivable',1087583),item('next','a','2026-10-20','payable',-1000),item('other','b','2026-10-21','payable',-2000)];
 const rows=settlementSchedule(es);assert.equal(rows.find(x=>x.accountId==='a'&&x.date==='2026-10-21').amount,'94170');
 const s=settlementSummary(rows,'2026-10-19',calendar);assert.equal(s.receivable,'94170');assert.equal(s.payable,'3000');assert.equal(s.t1.amount,'-1000');assert.equal(s.t2.amount,'92170');
 const later=settlementSummary(rows,'2026-10-20',calendar);assert.equal(later.t1.amount,'92170');assert.equal(later.payable,'2000');
});
test('scheduled cash amount includes financing principal instead of gross trade notional',()=>{
 const e=item('margin','a','2026-10-21','payable',-100142);e.settlementAmount='-40142';assert.equal(settlementSchedule([e])[0].amount,'-40142');
});
import {createBook} from '../../src/storage/book.js';
import {valueAccount} from '../../src/performance/portfolio.js';
test('financed settlement preview matches actual due-day cash transfer and preserves equity',()=>{
 const b=createBook('personal','2026-10-19');b.accounts[0].openingCash='1000000';b.trades=[{id:'margin',accountId:'default',date:'2026-10-19',code:'A',side:'buy',creditType:'margin',marketType:'regular',qty:'1000',price:'100',sequence:1,productType:'stock',ruleSnapshot:{...b.accounts[0].profile,annualRate:'0'}}];
 const market={calendar,bars:calendar.businessDates.map(date=>({code:'A',date,close:'100'})),securities:[{code:'A',productType:'stock'}],events:[]};
 const before=valueAccount(b,market,'2026-10-19').value,after=valueAccount(b,market,'2026-10-21').value;
 assert.equal(settlementSchedule(before.entries)[0].amount,'-40142');assert.equal(after.balances.cash,'959858');assert.equal(before.equity,after.equity);
});
