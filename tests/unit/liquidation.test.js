import test from 'node:test';
import assert from 'node:assert/strict';
import {createBook} from '../../src/storage/book.js';
import {valueAccount,buildSnapshots,valuationRows} from '../../src/performance/liquidation.js';
const market={bars:[{code:'1',date:'2026-09-01',close:'100',quality:'valid'},{code:'1',date:'2026-09-02',close:'110',quality:'valid'},{code:'1',date:'2026-09-03',close:'110',quality:'valid'}],calendar:{businessDates:['2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-09-07']},securities:[{code:'1',productType:'stock'}],events:[]};
function book(){const b=createBook('personal','2026-09-01');b.accounts[0].openingCash='200000';b.accounts[0].profile.discountTenths='4';return b;}
test('gross fees reduce cash once, existing rebate is separate, future rebate is not an asset',()=>{
 const b=book();b.trades=[{id:'buy',accountId:'default',date:b.openingDate,code:'1',side:'buy',qty:'1000',price:'100',creditType:'cash',marketType:'regular',ruleSnapshot:b.accounts[0].profile}];
 const s=valueAccount(b,market,b.openingDate).value;
 assert.equal(s.markedEquity,'199943.2');assert.equal(s.balances.rebateReceivable,'85.2');assert.equal(s.exitFee,'142');assert.equal(s.exitTax,'300');assert.equal(s.equity,'199501.2');
 assert.equal(s.positions[0].unrealized,'-584');assert.equal(s.positions[0].entryFee,'142');assert.equal(s.positions[0].entryRebate,'85.2');
 assert.equal(valuationRows(s).reduce((n,r)=>n+Number(r.amount),0),Number(s.equity));
});
test('same stock lots share exit minimum fee and partial holdings allocate original fees',()=>{
 const b=book();b.openingPositions=['a','b'].map(id=>({id,accountId:'default',code:'1',creditType:'cash',qty:'2',price:'100',date:b.openingDate}));
 const s=valueAccount(b,market,b.openingDate).value;assert.equal(s.exitFee,'1');assert.equal(s.exitTax,'1');assert.equal(s.positions[0].entryFeeEstimated,true);
 b.openingPositions=[];b.trades=[{id:'buy',accountId:'default',date:b.openingDate,code:'1',side:'buy',qty:'1000',price:'100',creditType:'cash',actualGrossFee:'100',ruleSnapshot:b.accounts[0].profile},{id:'sell',accountId:'default',date:'2026-09-02',code:'1',side:'sell',qty:'500',price:'110',creditType:'cash',ruleSnapshot:b.accounts[0].profile}];
 const p=valueAccount(b,market,'2026-09-02').value.positions[0];assert.equal(p.entryFee,'50');assert.equal(p.entryRebate,'30');
});
test('asset return and change include deposits without unit normalization',()=>{
 const b=book();b.cashFlows=[{id:'f',date:'2026-09-02',accountId:'default',amount:'50000'}];const s=buildSnapshots(b,market,'2026-09-02').value;
 assert.equal(s[1].equity,'250000');assert.equal(s[1].pnl,'50000');assert.equal(s[1].return,'0.25');
});
test('unknown exit tax leaves liquidation value pending rather than silently zero',()=>{
 const b=book();b.openingPositions=[{id:'p',accountId:'default',code:'1',creditType:'cash',qty:'1000',price:'100'}];const m={...market,securities:[{code:'1',productType:'bond-etf'}]};const s=valueAccount(b,m,b.openingDate).value;assert.equal(s.equity,null);assert.equal(s.quality,'insufficient');assert.ok(s.warnings.some(x=>x.includes('免稅資格')));
});
test('ETF sell tax and short cover costs use the existing product rules',()=>{
 const b=book();b.openingPositions=[{id:'p',accountId:'default',code:'1',creditType:'cash',qty:'1000',price:'100'}];let s=valueAccount(b,{...market,securities:[{code:'1',productType:'etf'}]},b.openingDate).value;assert.equal(s.exitTax,'100');
 b.accounts[0].profile.shortAnnualRate='0';b.accounts[0].profile.shortFeeRate='0';b.openingPositions[0]={...b.openingPositions[0],creditType:'short',restricted:'190000'};s=valueAccount(b,market,b.openingDate).value;assert.equal(s.exitTax,'0');assert.equal(s.positions[0].entryTax,'300');assert.equal(s.positions[0].unrealized,'-584');
});
test('fees of separate accounts are not merged',()=>{
 const b=book();b.accounts.push({...structuredClone(b.accounts[0]),id:'second'});b.openingPositions=b.accounts.map(a=>({id:a.id,accountId:a.id,code:'1',creditType:'cash',qty:'2',price:'100'}));const s=valueAccount(b,market,b.openingDate).value;assert.equal(s.exitFee,'2');assert.equal(s.exitTax,'0');
});
