import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {updatePublicData} from '../../scripts/data/update.mjs';
const snapshot=[{Date:'1151028',SecuritiesCompanyCode:'8069',CompanyName:'元太',Close:'100',Open:'99',High:'101',Low:'98',TradingShares:'1000',TransactionAmount:'100000'}];
const history=(market,date='20261028')=>({date,tables:[{fields:market==='twse'?['證券代號','證券名稱','收盤價']:['代號','名稱','收盤'],data:[[market==='twse'?'2330':'8069','股票','100']]}]});
test('refresh uses current snapshot first, falls back for stale/unavailable snapshot and preserves historical dates',async()=>{
 const cwd=process.cwd();
 for(const mode of ['current','stale','failed','both-failed']){
  const dir=await mkdtemp(join(tmpdir(),'tpex-refresh-'));const calls=[];
  try{
   process.chdir(dir);
   const requestJson=async url=>{
    calls.push(url);
    if(url.endsWith('/tpex_mainboard_quotes')){if((mode==='failed'||mode==='both-failed'))throw Error('terminated');return mode==='stale'?snapshot.map(x=>({...x,Date:'1151027'})):snapshot;}
    if(url.includes('/dailyQuotes?')){if(mode==='both-failed')throw Error('terminated');return history('tpex');}
    if(url.includes('/MI_INDEX?'))return history('twse');
    if(url.includes('MI_QFIIS?'))return {fields:[],data:[]};
    if(url.includes('holidaySchedule'))return [];
    if(url.includes('MI_5MINS_HIST')||url.includes('indexInfo/inx'))return {};
    return [];
   };
   const out=await updatePublicData({start:'2026-10-28',end:'2026-10-28',requestJson});
   assert.deepEqual(out.marketAsOf,{twse:'2026-10-28',tpex:mode==='both-failed'?null:'2026-10-28'});
   assert.equal(calls.filter(u=>u.endsWith('/tpex_mainboard_quotes')).length,1);
   assert.equal(calls.some(u=>u.includes('/dailyQuotes?')),mode!=='current');
   assert.equal(out.bars.filter(b=>b.code==='8069').length,mode==='both-failed'?0:1);if(mode!=='both-failed')assert.equal(out.bars.find(b=>b.code==='8069').date,'2026-10-28');
   const manifest=JSON.parse(await readFile('public/data/manifest.json','utf8'));assert.deepEqual(manifest.marketAsOf,out.marketAsOf);assert.equal(manifest.coverage,mode==='both-failed'?'partial':'complete');
  }finally{process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
 }
});
