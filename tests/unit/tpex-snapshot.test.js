import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../scripts/data/data-core.mjs';
const rows=[{Date:'1151028',SecuritiesCompanyCode:'8069',CompanyName:'元太',Close:'100.5',Open:'99',High:'101',Low:'98',TradingShares:'1,234',TransactionAmount:'123,456',Capitals:'10000000'},{Date:'1151028',SecuritiesCompanyCode:'00411A',CompanyName:'ETF',Close:'10',TradingShares:'100',TransactionAmount:'1000'},{Date:'1151028',SecuritiesCompanyCode:'700001',CompanyName:'權證',Close:'1'}];
test('official snapshot maps actual ROC date, units and excludes warrants without treating capital as shares',()=>{
 assert.equal(typeof core.normalizeTpexSnapshot,'function');
 const r=core.normalizeTpexSnapshot(rows,'2026-10-28');
 assert.equal(r.date,'2026-10-28');assert.equal(r.bars.length,2);assert.equal(r.bars[0].volumeShares,'1234');assert.equal(r.bars[0].turnoverTwd,'123456');assert.equal(r.bars[0].close,'100.5');assert.deepEqual(r.caps,[]);
});
test('snapshot rejects future, mixed dates, empty payloads and malformed numbers; stale data keeps its real date',()=>{
 assert.equal(typeof core.normalizeTpexSnapshot,'function');
 assert.equal(core.normalizeTpexSnapshot(rows,'2026-10-29').date,'2026-10-28');
 for(const x of [[],{},[...rows,{...rows[0],Date:'1151027'}],[{...rows[0],Close:'abc'}],[{...rows[0],TradingShares:'abc'}]])assert.throws(()=>core.normalizeTpexSnapshot(x,'2026-10-28'));
 assert.throws(()=>core.normalizeTpexSnapshot(rows,'2026-10-27'));
});
test('new price snapshot retains previously verified same-day market cap when snapshot has no issued shares',()=>{
 const old={bars:[],securities:[],caps:[{code:'8069',date:'2026-10-28',marketCap:'1000'}],indexRows:[]};
 const r=core.mergeDaily(old,[{bars:[{code:'8069',date:'2026-10-28',close:'100'}],caps:[]}]);assert.equal(r.caps.length,1);
});
test('official four-dash no-trade prices remain null and never become zero',()=>{
 const r=core.normalizeTpexSnapshot([{...rows[0],Close:'----',Open:'----',High:'----',Low:'----',TradingShares:'0',TransactionAmount:'0'}],'2026-10-28');
 assert.equal(r.bars[0].close,null);assert.equal(r.bars[0].quality,'no-trade');
});
