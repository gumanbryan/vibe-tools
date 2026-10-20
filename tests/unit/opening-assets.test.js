import test from 'node:test';import assert from 'node:assert/strict';
import {createBook} from '../../src/storage/book.js';import {valueAccount} from '../../src/performance/portfolio.js';
import {applyOpeningAssets,readOpeningAssets,openingRebateTrades} from '../../src/storage/opening-assets.js';
import {groupRebates} from '../../src/ledger/rebates.js';
const calendar={businessDates:['2026-10-19','2026-10-20','2026-10-21','2026-10-22']};const market={calendar,bars:[],securities:[],events:[]};
test('T+1 and T+2 opening amounts transfer between receivable/payable and cash without profit',()=>{
 const book=createBook('personal','2026-10-19');
 const draft=applyOpeningAssets(book,{accountId:'default',cash:'17025',t1:'-1000',t2:'85522',rebateAmount:'100',rebateMonth:'2026-10'},calendar);
 const day0=valueAccount(draft,market,'2026-10-19').value,day1=valueAccount(draft,market,'2026-10-20').value,day2=valueAccount(draft,market,'2026-10-21').value;
 assert.equal(day0.balances.cash,'17025');assert.equal(day0.balances.payable,'-1000');assert.equal(day0.balances.receivable,'85522');
 assert.equal(day1.balances.cash,'16025');assert.equal(day1.balances.payable,'0');assert.equal(day1.balances.receivable,'85522');
 assert.equal(day2.balances.cash,'101547');assert.equal(day2.balances.receivable,'0');assert.equal(day2.equity,day0.equity);assert.equal(day0.equity,'101647');
 assert.equal(book.entries.length,0);
});
test('editing starting balances replaces generated entries and combines starting rebate with later trades once',()=>{
 let b=createBook('personal','2026-10-19');const input={accountId:'default',cash:'17025',t1:'0',t2:'85522',rebateAmount:'100',rebateMonth:'2026-10'};
 b=applyOpeningAssets(b,input,calendar);b=applyOpeningAssets(b,{...input,t2:'85523'},calendar);
 assert.equal(b.entries.length,3);assert.equal(readOpeningAssets(b,'default',calendar).t2,'85523');
 const r=groupRebates([...openingRebateTrades(b),{id:'new',accountId:'default',date:'2026-10-20',rebate:'20'}]);assert.equal(r.value[0].amount,'120');
});
test('legacy corrected snapshot settlement imports into editable fields instead of double counting',()=>{
 const b=createBook('personal','2026-10-19');b.entries=[{id:'old',accountId:'default',date:b.openingDate,dueDate:'2026-10-21',openingSettlement:true,lines:[{bucket:'receivable',debit:'85522',credit:'0'},{bucket:'openingEquity',debit:'0',credit:'85522'}]}];
 const initial=readOpeningAssets(b,'default',calendar);assert.equal(initial.t2,'85522');
 const next=applyOpeningAssets(b,{...initial,accountId:'default'},calendar);assert.equal(next.entries.filter(e=>e.date===b.openingDate).length,1);
});
test('invalid amounts and uncovered settlement dates fail without changing the book',()=>{
 const b=createBook('personal','2026-10-19'),input={accountId:'default',cash:'0',t1:'0',t2:'0',rebateAmount:'0',rebateMonth:'2026-10'};
 for(const key of ['cash','t1','t2','rebateAmount'])assert.throws(()=>applyOpeningAssets(b,{...input,[key]:''},calendar));
 assert.throws(()=>applyOpeningAssets(b,{...input,t2:'10'},{businessDates:[]}));assert.equal(b.entries.length,0);
});
test('received opening rebates cannot be changed, and other accounts remain untouched',()=>{
 let b=createBook('personal','2026-10-19');const input={accountId:'default',cash:'0',t1:'0',t2:'0',rebateAmount:'100',rebateMonth:'2026-10'};b=applyOpeningAssets(b,input,calendar);b.rebateReceipts=[{id:'default:2026-10',accountId:'default'}];
 assert.throws(()=>applyOpeningAssets(b,{...input,rebateAmount:'200'},calendar));assert.doesNotThrow(()=>applyOpeningAssets(b,input,calendar));
 b.accounts.push({...structuredClone(b.accounts[0]),id:'second'});b=applyOpeningAssets(b,{...input,accountId:'second',rebateAmount:'0',t2:'200'},calendar);assert.equal(readOpeningAssets(b,'default',calendar).rebateAmount,'100');assert.equal(valueAccount(b,market,'2026-10-19','second').value.equity,'200');
});
